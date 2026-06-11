import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseOfferDeskConfig } from "./connect-alipay-service.mjs";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const defaultConfigPath = resolve(rootPath, "app-config.js");
const defaultOutPath = "secrets/alipay-auto-payment.env";

export async function createAlipayEnvDraft(options = {}) {
  const output = resolveProjectPath(options.out || defaultOutPath);
  if (!options.force && await existsPath(output)) {
    throw new Error(`文件已存在：${output}。如需覆盖，请加 --force。`);
  }

  const configText = options.configText || await readFile(resolveProjectPath(options.config || defaultConfigPath), "utf8");
  const config = parseOfferDeskConfig(configText);
  const text = createAlipayEnvText({
    config,
    publicBaseUrl: options.publicBaseUrl,
    amount: options.amount,
    dataFile: options.dataFile
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, text, "utf8");
  return { output, text };
}

export function createAlipayEnvText(options = {}) {
  const config = options.config || {};
  const checkoutUrl = String(config.checkoutUrl || "").trim();
  const appUrl = getAppUrl(checkoutUrl);
  const allowedOrigin = getAllowedOrigin(checkoutUrl);
  const supportEmail = String(config.supportEmail || "534403209@qq.com").trim();
  const amount = String(options.amount || "29.00").trim();
  const dataFile = String(options.dataFile || "/data/orders.json").trim();
  const publicBaseUrl = String(options.publicBaseUrl || "").trim().replace(/\/+$/u, "");

  return [
    "# OfferDesk 支付宝自动收款服务 env 草稿",
    "# 不要提交本文件。secrets/ 已经被 .gitignore 忽略。",
    "# TODO: 到支付宝开放平台填入真实应用 ID、公钥，并把应用私钥保存到下方文件。",
    "ALIPAY_APP_ID=",
    "ALIPAY_PRIVATE_KEY_FILE=secrets/alipay-app-private.pem",
    "ALIPAY_PUBLIC_KEY_FILE=secrets/alipay-public.pem",
    `OFFERDESK_PUBLIC_BASE_URL=${publicBaseUrl}`,
    `OFFERDESK_ALLOWED_ORIGIN=${allowedOrigin}`,
    `OFFERDESK_AMOUNT=${amount}`,
    `OFFERDESK_DATA_FILE=${dataFile}`,
    "OFFERDESK_LICENSE_PRIVATE_KEY_FILE=secrets/offerdesk-license-private.jwk.json",
    "",
    "# 可选：填了就自动发授权邮件；不填时买家仍可在付款成功页看到授权码。",
    "RESEND_API_KEY=",
    "OFFERDESK_EMAIL_FROM=",
    `OFFERDESK_APP_URL=${appUrl}`,
    `OFFERDESK_SUPPORT_EMAIL=${supportEmail}`,
    ""
  ].join("\n");
}

export function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--force") {
      values.force = true;
      continue;
    }
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
    out: values.out,
    config: values.config,
    publicBaseUrl: values["public-base-url"],
    amount: values.amount,
    dataFile: values["data-file"],
    force: values.force === true
  };
}

function getAllowedOrigin(checkoutUrl) {
  try {
    return new URL(checkoutUrl).origin;
  } catch {
    return "https://8npyvz5bd8-lang.github.io";
  }
}

function getAppUrl(checkoutUrl) {
  try {
    const url = new URL(checkoutUrl);
    url.pathname = url.pathname.replace(/[^/]*$/u, "");
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "https://8npyvz5bd8-lang.github.io/offerdesk/";
  }
}

function resolveProjectPath(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("缺少文件路径。");
  }
  return resolve(rootPath, text);
}

async function existsPath(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await createAlipayEnvDraft(parseArgs(process.argv.slice(2)));
    console.log(`支付宝 env 草稿已写入：${result.output}`);
    console.log("还不能上线：请补真实支付宝应用 ID、应用私钥、公钥和公网支付服务地址。");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
