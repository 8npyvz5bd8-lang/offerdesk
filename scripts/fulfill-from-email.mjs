import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fulfillManualOrder } from "./fulfill-manual-order.mjs";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

export async function fulfillFromEmail(options) {
  const text = options.text ?? await readClaimText(options);
  const claim = parsePaymentClaimText(text);
  return fulfillManualOrder({
    ...claim,
    channel: options.channel || "manual-alipay-email",
    role: options.role,
    contact: claim.email,
    appUrl: options.appUrl,
    supportEmail: options.supportEmail,
    privateKeyFile: options.privateKeyFile,
    outDir: options.outDir,
    tracker: options.tracker
  });
}

export function parsePaymentClaimText(text) {
  const source = String(text || "").replaceAll("\r\n", "\n");
  const email = readField(source, ["我的邮箱", "你的邮箱", "买家邮箱"]) || findEmail(source);
  const orderId = readField(source, ["订单号", "订单编号"]);
  const amount = normalizeAmount(readField(source, ["付款金额", "金额"]));
  const paidAt = readField(source, ["付款时间", "支付时间"]);
  const name = readField(source, ["支付宝昵称或备注", "支付宝昵称", "付款备注"]);
  const extraNote = readField(source, ["其他说明", "说明"]);

  if (!email) {
    throw new Error("邮件正文里没有买家邮箱。");
  }
  if (!orderId) {
    throw new Error("邮件正文里没有订单号。");
  }

  return {
    email,
    orderId,
    amount: amount || undefined,
    paidAt: paidAt || undefined,
    name: name || undefined,
    note: buildNote({ name, extraNote })
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
    file: values.file,
    channel: values.channel,
    role: values.role,
    appUrl: values["app-url"],
    supportEmail: values["support-email"],
    privateKeyFile: values["private-key-file"],
    outDir: values["out-dir"],
    tracker: values.tracker
  };
}

async function readClaimText(options) {
  if (options.file) {
    return readFile(resolveInput(options.file), "utf8");
  }
  if (process.stdin.isTTY) {
    throw new Error("请用 --file 指定邮件正文文件，或把邮件正文通过管道传入。");
  }
  return new Promise((resolveText, reject) => {
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => resolveText(body));
    process.stdin.on("error", reject);
  });
}

function readField(source, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = source.match(new RegExp(`^\\s*${escaped}\\s*[:：]\\s*(.*)$`, "im"));
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function findEmail(source) {
  return source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0] || "";
}

function normalizeAmount(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const match = text.match(/\d+(?:\.\d+)?/u);
  return match ? match[0] : text;
}

function buildNote({ name, extraNote }) {
  return [
    name ? `支付宝备注：${name}` : "",
    extraNote ? `其他说明：${extraNote}` : ""
  ].filter(Boolean).join("；");
}

function resolveInput(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("缺少邮件正文文件。");
  }
  return isAbsolute(text) ? text : resolve(rootPath, text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await fulfillFromEmail(parseArgs(process.argv.slice(2)));
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
