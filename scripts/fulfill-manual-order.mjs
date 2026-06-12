import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDeliveryEmailText } from "./create-delivery-email.mjs";
import { issueSignedLicense } from "./issue-signed-license.mjs";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const trackerHeader = [
  "date",
  "channel",
  "person",
  "role",
  "contact",
  "trial_sent",
  "used_once",
  "payment_status",
  "paid_at",
  "amount",
  "buyer_email",
  "license_sent",
  "feedback",
  "next_action"
].join(",");

export async function fulfillManualOrder(options) {
  const cleanEmail = normalizeEmail(options.email);
  const now = options.now ? new Date(options.now) : new Date();
  const orderId = String(options.orderId || createManualOrderId(now)).trim();
  const amount = String(options.amount || "29").trim();
  const paidAt = String(options.paidAt || formatLocalDateTime(now)).trim();
  const appUrl = String(options.appUrl || "https://8npyvz5bd8-lang.github.io/offerdesk/").trim();
  const supportEmail = String(options.supportEmail || "534403209@qq.com").trim();
  const outDir = resolveOutput(options.outDir || "dist/manual-orders");
  const tracker = resolveOutput(options.tracker || "launch/sales-tracker.csv");
  const safeOrderId = orderId.replace(/[^A-Za-z0-9_-]/g, "-");
  const licenseOut = resolveOutput(options.licenseOut || `${outDir}/${safeOrderId}-license.txt`);
  const emailOut = resolveOutput(options.emailOut || `${outDir}/${safeOrderId}-email.txt`);

  await assertManualOrderNotFulfilled({ orderId, tracker, licenseOut, emailOut });

  const issued = await issueSignedLicense({
    email: cleanEmail,
    orderId,
    name: options.name || "",
    privateKeyFile: resolveOutput(options.privateKeyFile || "secrets/offerdesk-license-private.jwk.json"),
    out: licenseOut
  });

  const emailText = createDeliveryEmailText({
    appUrl,
    licenseCode: issued.licenseCode,
    supportEmail
  });
  await mkdir(dirname(emailOut), { recursive: true });
  await writeFile(emailOut, emailText, "utf8");

  const row = buildTrackerRow({
    date: formatDate(now),
    channel: options.channel || "manual-alipay",
    person: options.name || cleanEmail,
    role: options.role || "",
    contact: options.contact || cleanEmail,
    paidAt,
    amount,
    buyerEmail: cleanEmail,
    note: [`订单号：${orderId}`, options.note || ""].filter(Boolean).join("；")
  });
  await appendTrackerRow(tracker, row);

  return {
    orderId,
    buyerEmail: cleanEmail,
    paidAt,
    amount,
    licenseCode: issued.licenseCode,
    licenseOut,
    emailOut,
    tracker,
    trackerRow: row,
    emailText
  };
}

export function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key.startsWith("--")) {
      throw new Error(`无法识别参数：${key}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：${key}`);
    }
    values[key.slice(2)] = value;
    index += 1;
  }

  return {
    email: values.email,
    orderId: values["order-id"],
    name: values.name,
    paidAt: values["paid-at"],
    amount: values.amount,
    channel: values.channel,
    role: values.role,
    contact: values.contact,
    note: values.note,
    appUrl: values["app-url"],
    supportEmail: values["support-email"],
    privateKeyFile: values["private-key-file"],
    outDir: values["out-dir"],
    licenseOut: values["license-out"],
    emailOut: values["email-out"],
    tracker: values.tracker
  };
}

export function createManualOrderId(now = new Date(), suffix = randomBytes(8).toString("hex").toUpperCase()) {
  const date = compactDate(now);
  return `OD-MANUAL-${date}-${suffix}`;
}

export function buildTrackerRow({ date, channel, person, role, contact, paidAt, amount, buyerEmail, note }) {
  return [
    date,
    channel,
    person,
    role,
    contact,
    "yes",
    "",
    "paid",
    paidAt,
    amount,
    buyerEmail,
    "yes",
    note,
    "已发送授权码，等待买家确认解锁"
  ].map(csvEscape).join(",");
}

async function appendTrackerRow(tracker, row) {
  await mkdir(dirname(tracker), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(tracker, "utf8");
  } catch {
    existing = "";
  }

  if (!existing.trim()) {
    await writeFile(tracker, `${trackerHeader}\n`, "utf8");
  } else if (!existing.endsWith("\n")) {
    await appendFile(tracker, "\n", "utf8");
  }
  await appendFile(tracker, `${row}\n`, "utf8");
}

async function assertManualOrderNotFulfilled({ orderId, tracker, licenseOut, emailOut }) {
  if (await exists(licenseOut)) {
    throw new Error(`订单已处理：授权码文件已存在 ${licenseOut}`);
  }
  if (await exists(emailOut)) {
    throw new Error(`订单已处理：回复邮件文件已存在 ${emailOut}`);
  }
  const trackerText = await readOptionalText(tracker);
  if (trackerText.includes(orderId)) {
    throw new Error(`订单已处理：销售记录里已存在 ${orderId}`);
  }
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return false;
  }
}

async function readOptionalText(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return "";
  }
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("买家邮箱格式不正确。");
  }
  return email;
}

function resolveOutput(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("缺少路径。");
  }
  return isAbsolute(text) ? text : resolve(rootPath, text);
}

function formatDate(value) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatLocalDateTime(value) {
  const date = new Date(value);
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function compactDate(value) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await fulfillManualOrder(parseArgs(process.argv.slice(2)));
    console.log(`订单号：${result.orderId}`);
    console.log(`买家邮箱：${result.buyerEmail}`);
    console.log(`授权码文件：${result.licenseOut}`);
    console.log(`回复邮件文件：${result.emailOut}`);
    console.log(`销售记录：${result.tracker}`);
    console.log("注意：输出文件包含明文授权码，不要上传到网页或 GitHub。");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
