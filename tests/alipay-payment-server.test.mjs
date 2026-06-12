import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHealthPayload,
  buildSignContent,
  createPaymentServer,
  createOrderId,
  signAlipayResponseBody,
  signAlipayParams,
  verifyAlipayResponse,
  verifyAlipayResponseText,
  verifyAlipayParams
} from "../scripts/alipay-payment-server.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});
const licensePair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const privateJwk = await crypto.subtle.exportKey("jwk", licensePair.privateKey);

const params = {
  method: "alipay.trade.precreate",
  app_id: "2021000000000000",
  sign_type: "RSA2",
  charset: "utf-8",
  biz_content: '{"out_trade_no":"OD-20260611190000-ABCD1234EF567890ABCD"}'
};

assert.equal(
  buildSignContent(params),
  'app_id=2021000000000000&biz_content={"out_trade_no":"OD-20260611190000-ABCD1234EF567890ABCD"}&charset=utf-8&method=alipay.trade.precreate'
);

const signed = { ...params, sign: signAlipayParams(params, privateKey) };
assert.equal(verifyAlipayParams(signed, publicKey), true);
assert.equal(verifyAlipayParams({ ...signed, app_id: "changed" }, publicKey), false);
const signedResponseBody = {
  code: "10000",
  qr_code: "https://qr.alipay.com/test-order"
};
const signedResponse = {
  alipay_trade_precreate_response: signedResponseBody,
  sign: signAlipayResponseBody(signedResponseBody, privateKey)
};
assert.equal(verifyAlipayResponse(signedResponse, "alipay_trade_precreate_response", publicKey), true);
assert.equal(verifyAlipayResponse({
  ...signedResponse,
  alipay_trade_precreate_response: { ...signedResponseBody, qr_code: "changed" }
}, "alipay_trade_precreate_response", publicKey), false);
assert.equal(verifyAlipayResponseText(JSON.stringify(signedResponse), "alipay_trade_precreate_response", signedResponse.sign, publicKey), true);
assert.equal(verifyAlipayResponseText(
  JSON.stringify({
    ...signedResponse,
    alipay_trade_precreate_response: { ...signedResponseBody, qr_code: "changed" }
  }),
  "alipay_trade_precreate_response",
  signedResponse.sign,
  publicKey
), false);
const signedErrorBody = {
  code: "40004",
  msg: "Business Failed",
  sub_msg: "商户参数错误"
};
assert.equal(verifyAlipayResponse({
  error_response: signedErrorBody,
  sign: signAlipayResponseBody(signedErrorBody, privateKey)
}, "error_response", publicKey), true);
assert.match(createOrderId(new Date("2026-06-11T19:00:00+08:00")), /^OD-\d{14}-[A-F0-9]{24}$/);
const emptyHealth = await buildHealthPayload({});
assert.equal(emptyHealth.ok, true);
assert.equal(emptyHealth.service, "offerdesk-alipay-payment");
assert.equal(emptyHealth.alipayConfigured, false);
assert.equal(emptyHealth.offerdeskConfigured, false);
assert.equal(emptyHealth.orderStoreConfigured, false);
assert.equal(emptyHealth.emailDeliveryConfigured, false);
assert.equal(emptyHealth.ready, false);
assert.deepEqual(emptyHealth.missingRequirements, [
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY 或 ALIPAY_PRIVATE_KEY_FILE",
  "ALIPAY_PUBLIC_KEY 或 ALIPAY_PUBLIC_KEY_FILE",
  "OFFERDESK_PUBLIC_BASE_URL",
  "OFFERDESK_LICENSE_PRIVATE_JWK 或 OFFERDESK_LICENSE_PRIVATE_KEY_FILE",
  "OFFERDESK_DATA_FILE"
]);
assert.equal(emptyHealth.requirements.length, 6);
assert.ok(emptyHealth.nextActions.join("\n").includes("支付宝开放平台应用 ID"));
assert.equal((await buildHealthPayload({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY: privateKey,
  ALIPAY_PUBLIC_KEY: publicKey,
  OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk),
  OFFERDESK_DATA_FILE: "/data/orders.json",
  RESEND_API_KEY: "re_test",
  OFFERDESK_EMAIL_FROM: "OfferDesk <support@offerdesk.com>"
})).ready, true);
assert.equal((await buildHealthPayload({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY: privateKey,
  ALIPAY_PUBLIC_KEY: publicKey,
  OFFERDESK_PUBLIC_BASE_URL: "http://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk),
  OFFERDESK_DATA_FILE: "/data/orders.json"
})).missingRequirements.includes("OFFERDESK_PUBLIC_BASE_URL"), true);
assert.equal((await buildHealthPayload({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY_FILE: "/tmp/offerdesk-missing-private.pem",
  ALIPAY_PUBLIC_KEY: publicKey,
  OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk),
  OFFERDESK_DATA_FILE: "/data/orders.json"
})).ready, false);
assert.equal((await buildHealthPayload({
  RESEND_API_KEY: "re_test",
  OFFERDESK_EMAIL_FROM: "OfferDesk <support@offerdesk.com>"
})).emailDeliveryConfigured, true);

const server = createPaymentServer({});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
const health = await healthResponse.json();
await new Promise((resolve) => server.close(resolve));
assert.equal(healthResponse.status, 200);
assert.equal(health.service, "offerdesk-alipay-payment");
assert.equal(health.ready, false);

const tempRoot = await mkdtemp(join(tmpdir(), "offerdesk-alipay-service-"));
const storeFile = join(tempRoot, "orders.json");
const emails = [];
const alipayCalls = [];
const serverWithPayment = createPaymentServer({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY: privateKey,
  ALIPAY_PUBLIC_KEY: publicKey,
  ALIPAY_GATEWAY: "https://alipay.test/gateway.do",
  OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk),
  OFFERDESK_DATA_FILE: storeFile,
  OFFERDESK_AMOUNT: "29.00",
  OFFERDESK_APP_URL: "https://offerdesk.app",
  OFFERDESK_SUPPORT_EMAIL: "support@offerdesk.app",
  RESEND_API_KEY: "re_test",
  OFFERDESK_EMAIL_FROM: "OfferDesk <support@offerdesk.app>"
}, {
  fetch: async (url, options) => {
    if (url === "https://api.resend.com/emails") {
      emails.push(JSON.parse(options.body));
      return textResponse("{}", 200);
    }
    assert.equal(url, "https://alipay.test/gateway.do");
    const paramsForCall = Object.fromEntries(new URLSearchParams(options.body));
    alipayCalls.push(paramsForCall.method);
    if (paramsForCall.method === "alipay.trade.precreate") {
      return textResponse(signedAlipayResponse("alipay_trade_precreate_response", {
        code: "10000",
        qr_code: "https://qr.alipay.com/test-order"
      }), 200);
    }
    if (paramsForCall.method === "alipay.trade.query") {
      return textResponse(signedAlipayResponse("alipay_trade_query_response", {
        code: "10000",
        trade_status: "TRADE_SUCCESS",
        trade_no: "202606112200000000"
      }), 200);
    }
    throw new Error(`unexpected alipay method: ${paramsForCall.method}`);
  }
});
await new Promise((resolve) => serverWithPayment.listen(0, "127.0.0.1", resolve));
const { port: paymentPort } = serverWithPayment.address();
const createResponse = await fetch(`http://127.0.0.1:${paymentPort}/api/create-order`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "Buyer@Example.COM", name: "买家" })
});
const created = await createResponse.json();
assert.equal(createResponse.status, 200);
assert.equal(created.amount, "29.00");
assert.equal(created.status, "WAIT_BUYER_PAY");
assert.ok(created.qrCode.includes("qr.alipay.com"));

const statusResponse = await fetch(`http://127.0.0.1:${paymentPort}/api/order-status?order_id=${encodeURIComponent(created.orderId)}`);
const paid = await statusResponse.json();
await new Promise((resolve) => serverWithPayment.close(resolve));
assert.equal(statusResponse.status, 200);
assert.equal(paid.status, "TRADE_SUCCESS");
assert.ok(paid.licenseCode);
assert.equal(paid.emailDeliveryStatus, "sent");
assert.deepEqual(alipayCalls, ["alipay.trade.precreate", "alipay.trade.query"]);
assert.equal(emails.length, 1);
assert.equal(emails[0].to, "buyer@example.com");
assert.equal(emails[0].from, "OfferDesk <support@offerdesk.app>");
assert.equal(emails[0].subject, "你的 OfferDesk 专业版授权码");
assert.ok(emails[0].text.includes("https://offerdesk.app"));
assert.ok(emails[0].text.includes(paid.licenseCode));
const store = JSON.parse(await readFile(storeFile, "utf8"));
assert.equal(store.orders[created.orderId].emailDeliveryStatus, "sent");
await rm(tempRoot, { recursive: true, force: true });

const rejectUnsignedRoot = await mkdtemp(join(tmpdir(), "offerdesk-alipay-unsigned-"));
const rejectUnsignedServer = createPaymentServer({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY: privateKey,
  ALIPAY_PUBLIC_KEY: publicKey,
  ALIPAY_GATEWAY: "https://alipay.test/gateway.do",
  OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk),
  OFFERDESK_DATA_FILE: join(rejectUnsignedRoot, "orders.json")
}, {
  fetch: async () => textResponse(JSON.stringify({
    alipay_trade_precreate_response: {
      code: "10000",
      qr_code: "https://qr.alipay.com/unsigned-order"
    }
  }), 200)
});
await new Promise((resolve) => rejectUnsignedServer.listen(0, "127.0.0.1", resolve));
const { port: rejectUnsignedPort } = rejectUnsignedServer.address();
const unsignedResponse = await fetch(`http://127.0.0.1:${rejectUnsignedPort}/api/create-order`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "buyer@example.com", name: "买家" })
});
const unsignedPayload = await unsignedResponse.json();
await new Promise((resolve) => rejectUnsignedServer.close(resolve));
await rm(rejectUnsignedRoot, { recursive: true, force: true });
assert.equal(unsignedResponse.status, 500);
assert.match(unsignedPayload.error, /签名无效/u);

const signedErrorRoot = await mkdtemp(join(tmpdir(), "offerdesk-alipay-error-"));
const signedErrorServer = createPaymentServer({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY: privateKey,
  ALIPAY_PUBLIC_KEY: publicKey,
  ALIPAY_GATEWAY: "https://alipay.test/gateway.do",
  OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk),
  OFFERDESK_DATA_FILE: join(signedErrorRoot, "orders.json")
}, {
  fetch: async () => signedErrorResponse("商户参数错误")
});
await new Promise((resolve) => signedErrorServer.listen(0, "127.0.0.1", resolve));
const { port: signedErrorPort } = signedErrorServer.address();
const signedErrorCreateResponse = await fetch(`http://127.0.0.1:${signedErrorPort}/api/create-order`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "buyer@example.com", name: "买家" })
});
const signedErrorPayload = await signedErrorCreateResponse.json();
await new Promise((resolve) => signedErrorServer.close(resolve));
await rm(signedErrorRoot, { recursive: true, force: true });
assert.equal(signedErrorCreateResponse.status, 500);
assert.match(signedErrorPayload.error, /商户参数错误/u);

function textResponse(body, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body;
    }
  };
}

function signedAlipayResponse(key, body) {
  return JSON.stringify({
    [key]: body,
    sign: signAlipayResponseBody(body, privateKey)
  });
}

function signedErrorResponse(subMsg) {
  const body = {
    code: "40004",
    msg: "Business Failed",
    sub_msg: subMsg
  };
  return textResponse(JSON.stringify({
    error_response: body,
    sign: signAlipayResponseBody(body, privateKey)
  }), 200);
}

console.log("alipay payment server tests passed");
