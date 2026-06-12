import { createPrivateKey, createPublicKey, createSign, createVerify, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createDeliveryEmailText } from "./create-delivery-email.mjs";
import { createSignedLicensePayload, signLicensePayload } from "../src/license.js";

const defaultGateway = "https://openapi.alipay.com/gateway.do";
const successStatuses = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

export function buildSignContent(params) {
  return Object.entries(params)
    .filter(([key, value]) => key !== "sign" && key !== "sign_type" && value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function signAlipayParams(params, privateKey) {
  return createSign("RSA-SHA256").update(buildSignContent(params), "utf8").sign(toPrivatePem(privateKey), "base64");
}

export function verifyAlipayParams(params, publicKey) {
  if (!params.sign) {
    return false;
  }
  return createVerify("RSA-SHA256")
    .update(buildSignContent(params), "utf8")
    .verify(toPublicPem(publicKey), params.sign, "base64");
}

export function signAlipayResponseBody(responseBody, privateKey) {
  return createSign("RSA-SHA256").update(JSON.stringify(responseBody), "utf8").sign(toPrivatePem(privateKey), "base64");
}

export function verifyAlipayResponse(payload, responseKey, publicKey) {
  if (!payload?.[responseKey] || !payload.sign) {
    return false;
  }
  return createVerify("RSA-SHA256")
    .update(JSON.stringify(payload[responseKey]), "utf8")
    .verify(toPublicPem(publicKey), payload.sign, "base64");
}

export function verifyAlipayResponseText(responseText, responseKey, sign, publicKey) {
  const bodyText = extractAlipayResponseBodyText(responseText, responseKey);
  if (!bodyText || !sign) {
    return false;
  }
  return createVerify("RSA-SHA256")
    .update(bodyText, "utf8")
    .verify(toPublicPem(publicKey), sign, "base64");
}

export function createOrderId(now = new Date()) {
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `OD-${stamp}-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export async function buildHealthPayload(env = process.env) {
  const alipayAppIdConfigured = Boolean(String(env.ALIPAY_APP_ID || "").trim());
  const alipayPrivateKeyConfigured = await hasUsableAlipayPrivateKey(env);
  const alipayPublicKeyConfigured = await hasUsableAlipayPublicKey(env);
  const publicBaseUrlConfigured = isUsablePublicHttps(env.OFFERDESK_PUBLIC_BASE_URL);
  const licensePrivateKeyConfigured = await hasUsableLicensePrivateJwk(env);
  const orderStoreConfigured = Boolean(String(env.OFFERDESK_DATA_FILE || "").trim());
  const emailDeliveryConfigured = isEmailDeliveryConfigured(env);
  const requirements = [
    healthRequirement("ALIPAY_APP_ID", alipayAppIdConfigured, "在 Render 填写支付宝开放平台应用 ID。"),
    healthRequirement("ALIPAY_PRIVATE_KEY 或 ALIPAY_PRIVATE_KEY_FILE", alipayPrivateKeyConfigured, "在 Render 填写支付宝应用私钥，或填可读取的私钥文件路径。"),
    healthRequirement("ALIPAY_PUBLIC_KEY 或 ALIPAY_PUBLIC_KEY_FILE", alipayPublicKeyConfigured, "在 Render 填写支付宝公钥，或填可读取的公钥文件路径。"),
    healthRequirement("OFFERDESK_PUBLIC_BASE_URL", publicBaseUrlConfigured, "在 Render 填写当前支付服务的公网 https 地址。"),
    healthRequirement("OFFERDESK_LICENSE_PRIVATE_JWK 或 OFFERDESK_LICENSE_PRIVATE_KEY_FILE", licensePrivateKeyConfigured, "在 Render 填写 OfferDesk 授权私钥 JWK，或填可读取的 JWK 文件路径。"),
    healthRequirement("OFFERDESK_DATA_FILE", orderStoreConfigured, "在 Render 保持 OFFERDESK_DATA_FILE=/data/orders.json，并挂载 /data 持久磁盘。")
  ];
  const missing = requirements.filter((item) => !item.pass);
  const alipayConfigured = alipayAppIdConfigured && alipayPrivateKeyConfigured && alipayPublicKeyConfigured;
  const offerdeskConfigured = publicBaseUrlConfigured && licensePrivateKeyConfigured;

  return {
    ok: true,
    service: "offerdesk-alipay-payment",
    alipayConfigured,
    offerdeskConfigured,
    orderStoreConfigured,
    emailDeliveryConfigured,
    ready: missing.length === 0,
    missingRequirements: missing.map((item) => item.name),
    nextActions: missing.map((item) => item.fix),
    requirements
  };
}

export function createPaymentServer(env = process.env, controls = {}) {
  const storeFile = env.OFFERDESK_DATA_FILE || "runtime/orders.json";
  const amount = env.OFFERDESK_AMOUNT || "29.00";
  const allowedOrigin = env.OFFERDESK_ALLOWED_ORIGIN || "*";
  const fetchImpl = controls.fetch || fetch;

  return createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        sendJson(res, 204, null, allowedOrigin);
        return;
      }

      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
        sendJson(res, 200, await buildHealthPayload(env), allowedOrigin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/create-order") {
        assertServerConfig(env);
        const body = await readJsonBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const name = String(body.name || "").trim();
        assertEmail(email);

        const store = await readStore(storeFile);
        const orderId = createOrderId();
        const alipay = await callAlipayPrecreate({
          env,
          fetchImpl,
          orderId,
          amount,
          notifyUrl: `${env.OFFERDESK_PUBLIC_BASE_URL.replace(/\/+$/u, "")}/api/alipay-notify`
        });
        const qrImage = await renderQrImage(alipay.qrCode);

        store.orders[orderId] = {
          orderId,
          email,
          name,
          amount,
          status: "WAIT_BUYER_PAY",
          qrCode: alipay.qrCode,
          alipayTradeNo: "",
          licenseCode: "",
          createdAt: new Date().toISOString()
        };
        await writeStore(storeFile, store);

        sendJson(res, 200, {
          orderId,
          amount,
          status: "WAIT_BUYER_PAY",
          qrCode: alipay.qrCode,
          qrImage
        }, allowedOrigin);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/order-status") {
        assertServerConfig(env);
        const orderId = String(url.searchParams.get("order_id") || "").trim();
        const store = await readStore(storeFile);
        const order = store.orders[orderId];
        if (!order) {
          sendJson(res, 404, { error: "订单不存在。" }, allowedOrigin);
          return;
        }

        if (!successStatuses.has(order.status)) {
          const queried = await callAlipayQuery({ env, fetchImpl, orderId });
          if (successStatuses.has(queried.status)) {
            await markPaidAndIssueLicense({ storeFile, store, order, env, fetchImpl, alipayTradeNo: queried.tradeNo });
          }
        }

        sendJson(res, 200, publicOrder(order), allowedOrigin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/alipay-notify") {
        assertServerConfig(env);
        const params = await readFormBody(req);
        if (!verifyAlipayParams(params, await readAlipayPublicKey(env))) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("failure");
          return;
        }

        const orderId = String(params.out_trade_no || "");
        const store = await readStore(storeFile);
        const order = store.orders[orderId];
        if (!order || String(params.total_amount || "") !== String(order.amount)) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("failure");
          return;
        }

        if (successStatuses.has(String(params.trade_status || ""))) {
          await markPaidAndIssueLicense({ storeFile, store, order, env, fetchImpl, alipayTradeNo: params.trade_no || "" });
        }

        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("success");
        return;
      }

      sendJson(res, 404, { error: "接口不存在。" }, allowedOrigin);
    } catch (error) {
      sendJson(res, 500, { error: error.message }, allowedOrigin);
    }
  });
}

async function callAlipayPrecreate({ env, fetchImpl, orderId, amount, notifyUrl }) {
  const payload = await callAlipay({
    env,
    fetchImpl,
    method: "alipay.trade.precreate",
    notifyUrl,
    bizContent: {
      out_trade_no: orderId,
      total_amount: amount,
      subject: "OfferDesk 专业版",
      product_code: "FACE_TO_FACE_PAYMENT"
    }
  });
  const data = payload.alipay_trade_precreate_response;
  if (payload.error_response) {
    throw new Error(alipayErrorMessage(payload.error_response, "支付宝预下单失败。"));
  }
  if (data?.code !== "10000" || !data?.qr_code) {
    throw new Error(data?.sub_msg || data?.msg || "支付宝预下单失败。");
  }
  return { qrCode: data.qr_code };
}

async function callAlipayQuery({ env, fetchImpl, orderId }) {
  const payload = await callAlipay({
    env,
    fetchImpl,
    method: "alipay.trade.query",
    bizContent: { out_trade_no: orderId }
  });
  const data = payload.alipay_trade_query_response;
  if (payload.error_response) {
    throw new Error(alipayErrorMessage(payload.error_response, "支付宝查单失败。"));
  }
  return {
    status: data?.trade_status || "",
    tradeNo: data?.trade_no || ""
  };
}

async function callAlipay({ env, fetchImpl, method, bizContent, notifyUrl = "" }) {
  const params = {
    app_id: env.ALIPAY_APP_ID,
    method,
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatAlipayTime(new Date()),
    version: "1.0",
    biz_content: JSON.stringify(bizContent)
  };
  if (notifyUrl) {
    params.notify_url = notifyUrl;
  }
  params.sign = signAlipayParams(params, await readAlipayPrivateKey(env));

  const response = await fetchImpl(env.ALIPAY_GATEWAY || defaultGateway, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`支付宝接口请求失败：${response.status}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("支付宝接口返回不是 JSON。");
  }
  const responseKey = alipayResponseKey(method);
  const signedResponseKey = payload[responseKey] ? responseKey : "error_response";
  if (!verifyAlipayResponseText(text, signedResponseKey, payload.sign, await readAlipayPublicKey(env))) {
    throw new Error("支付宝接口返回签名无效。");
  }
  return payload;
}

async function markPaidAndIssueLicense({ storeFile, store, order, env, fetchImpl, alipayTradeNo }) {
  if (!order.licenseCode) {
    const privateJwk = await readOfferDeskLicensePrivateJwk(env);
    const payload = createSignedLicensePayload({
      email: order.email,
      orderId: order.orderId,
      name: order.name
    });
    order.licenseCode = await signLicensePayload(payload, privateJwk);
    order.licenseId = payload.licenseId;
    order.licenseIssuedAt = payload.issuedAt;
  }
  order.status = "TRADE_SUCCESS";
  order.alipayTradeNo = alipayTradeNo || order.alipayTradeNo || "";
  order.paidAt = order.paidAt || new Date().toISOString();
  if (isEmailDeliveryConfigured(env) && order.emailDeliveryStatus !== "sent" && order.emailDeliveryStatus !== "failed") {
    try {
      await sendDeliveryEmail({ env, fetchImpl, order });
      order.emailDeliveryStatus = "sent";
      order.emailDeliveryError = "";
      order.emailDeliveryAt = new Date().toISOString();
    } catch (error) {
      order.emailDeliveryStatus = "failed";
      order.emailDeliveryError = error.message;
      order.emailDeliveryAt = new Date().toISOString();
    }
  }
  await writeStore(storeFile, store);
}

function publicOrder(order) {
  return {
    orderId: order.orderId,
    amount: order.amount,
    status: order.status,
    paidAt: order.paidAt || "",
    licenseCode: successStatuses.has(order.status) ? order.licenseCode : "",
    emailDeliveryStatus: order.emailDeliveryStatus || ""
  };
}

async function sendDeliveryEmail({ env, fetchImpl, order }) {
  const from = String(env.OFFERDESK_EMAIL_FROM || "").trim();
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const appUrl = String(env.OFFERDESK_APP_URL || "https://8npyvz5bd8-lang.github.io/offerdesk/").trim();
  const supportEmail = String(env.OFFERDESK_SUPPORT_EMAIL || "534403209@qq.com").trim();
  const text = createDeliveryEmailText({
    appUrl,
    licenseCode: order.licenseCode,
    supportEmail
  });
  const response = await fetchImpl(env.RESEND_API_BASE || "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: order.email,
      subject: "你的 OfferDesk 专业版授权码",
      text
    })
  });
  if (!response.ok) {
    throw new Error(`授权邮件发送失败：HTTP ${response.status}`);
  }
}

function isEmailDeliveryConfigured(env) {
  return Boolean(String(env.RESEND_API_KEY || "").trim() && String(env.OFFERDESK_EMAIL_FROM || "").trim());
}

async function renderQrImage(qrCode) {
  try {
    const QRCode = await import("qrcode");
    return QRCode.toDataURL(qrCode, { margin: 1, width: 280 });
  } catch {
    return "";
  }
}

async function readStore(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return { orders: {} };
  }
}

async function writeStore(file, store) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}

async function readFormBody(req) {
  const raw = await readBody(req);
  return Object.fromEntries(new URLSearchParams(raw));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res, status, payload, allowedOrigin) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  });
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function assertServerConfig(env) {
  const required = [
    "ALIPAY_APP_ID"
  ];
  const missing = required.filter((key) => !String(env[key] || "").trim());
  if (!isUsablePublicHttps(env.OFFERDESK_PUBLIC_BASE_URL)) {
    missing.push("OFFERDESK_PUBLIC_BASE_URL=https://公网支付服务地址");
  }
  if (!String(env.ALIPAY_PRIVATE_KEY || env.ALIPAY_PRIVATE_KEY_FILE || "").trim()) {
    missing.push("ALIPAY_PRIVATE_KEY 或 ALIPAY_PRIVATE_KEY_FILE");
  }
  if (!String(env.ALIPAY_PUBLIC_KEY || env.ALIPAY_PUBLIC_KEY_FILE || "").trim()) {
    missing.push("ALIPAY_PUBLIC_KEY 或 ALIPAY_PUBLIC_KEY_FILE");
  }
  if (!String(env.OFFERDESK_LICENSE_PRIVATE_JWK || env.OFFERDESK_LICENSE_PRIVATE_KEY_FILE || "").trim()) {
    missing.push("OFFERDESK_LICENSE_PRIVATE_JWK 或 OFFERDESK_LICENSE_PRIVATE_KEY_FILE");
  }
  if (!String(env.OFFERDESK_DATA_FILE || "").trim()) {
    missing.push("OFFERDESK_DATA_FILE");
  }
  if (missing.length > 0) {
    throw new Error(`缺少配置：${missing.join("、")}。`);
  }
}

function assertEmail(value) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new Error("买家邮箱格式不正确。");
  }
}

function healthRequirement(name, pass, fix) {
  return { name, pass, fix };
}

async function readAlipayPrivateKey(env) {
  return env.ALIPAY_PRIVATE_KEY || await readFile(env.ALIPAY_PRIVATE_KEY_FILE, "utf8");
}

async function readAlipayPublicKey(env) {
  return env.ALIPAY_PUBLIC_KEY || await readFile(env.ALIPAY_PUBLIC_KEY_FILE, "utf8");
}

async function readOfferDeskLicensePrivateJwk(env) {
  if (env.OFFERDESK_LICENSE_PRIVATE_JWK) {
    return JSON.parse(env.OFFERDESK_LICENSE_PRIVATE_JWK);
  }
  return JSON.parse(await readFile(env.OFFERDESK_LICENSE_PRIVATE_KEY_FILE || "secrets/offerdesk-license-private.jwk.json", "utf8"));
}

function toPrivatePem(value) {
  return toPem(value, "PRIVATE KEY");
}

function toPublicPem(value) {
  return toPem(value, "PUBLIC KEY");
}

async function hasUsableAlipayPrivateKey(env) {
  if (!String(env.ALIPAY_PRIVATE_KEY || env.ALIPAY_PRIVATE_KEY_FILE || "").trim()) {
    return false;
  }
  try {
    createPrivateKey(toPrivatePem(await readAlipayPrivateKey(env)));
    return true;
  } catch {
    return false;
  }
}

async function hasUsableAlipayPublicKey(env) {
  if (!String(env.ALIPAY_PUBLIC_KEY || env.ALIPAY_PUBLIC_KEY_FILE || "").trim()) {
    return false;
  }
  try {
    createPublicKey(toPublicPem(await readAlipayPublicKey(env)));
    return true;
  } catch {
    return false;
  }
}

async function hasUsableLicensePrivateJwk(env) {
  if (!String(env.OFFERDESK_LICENSE_PRIVATE_JWK || env.OFFERDESK_LICENSE_PRIVATE_KEY_FILE || "").trim()) {
    return false;
  }
  try {
    const jwk = await readOfferDeskLicensePrivateJwk(env);
    return Boolean(
      jwk &&
        jwk.kty === "EC" &&
        jwk.crv === "P-256" &&
        typeof jwk.d === "string" &&
        jwk.d.length > 20 &&
        typeof jwk.x === "string" &&
        jwk.x.length > 20 &&
        typeof jwk.y === "string" &&
        jwk.y.length > 20
    );
  } catch {
    return false;
  }
}

function toPem(value, label) {
  const clean = String(value || "").trim();
  if (clean.includes("-----BEGIN")) {
    return clean;
  }
  const body = clean.replace(/\s+/gu, "").match(/.{1,64}/gu)?.join("\n") || "";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

function isUsablePublicHttps(value) {
  const text = String(value || "").trim();
  return /^https:\/\/.+/u.test(text) && !containsPlaceholder(text);
}

function containsPlaceholder(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("example") || text.includes("your-") || text.includes("你的") || text.includes(".test") || text.includes(".invalid");
}

function alipayResponseKey(method) {
  return `${String(method || "").replace(/\./gu, "_")}_response`;
}

function alipayErrorMessage(errorResponse, fallback) {
  return errorResponse?.sub_msg || errorResponse?.msg || fallback;
}

function extractAlipayResponseBodyText(text, responseKey) {
  const source = String(text || "");
  const match = new RegExp(`"${escapeRegExp(responseKey)}"\\s*:\\s*`, "u").exec(source);
  if (!match) {
    return "";
  }
  let index = match.index + match[0].length;
  while (/\s/u.test(source[index] || "")) {
    index += 1;
  }
  if (source[index] !== "{") {
    return "";
  }

  const start = index;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function formatAlipayTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  createPaymentServer().listen(port, () => {
    console.log(`OfferDesk 支付宝自动收款服务已启动：http://localhost:${port}`);
  });
}
