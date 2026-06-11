import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createConfigText } from "./write-config.mjs";

const defaultConfigPath = new URL("../app-config.js", import.meta.url);

export async function connectAlipayService(options) {
  const apiBase = normalizeApiBase(options.apiBase);
  const health = await checkAlipayServiceHealth(apiBase, options.fetchImpl || fetch);
  const configPath = options.config || defaultConfigPath;
  const source = await readFile(configPath, "utf8");
  const current = parseOfferDeskConfig(source);
  if (current.licenseProvider !== "signed") {
    throw new Error("自动支付宝收款必须使用 signed 授权模式。");
  }

  const configText = createConfigText({
    ...current,
    autoPaymentApiBase: apiBase
  });
  const output = options.out || configPath;
  await writeFile(output, configText, "utf8");
  return { apiBase, health, output };
}

export async function checkAlipayServiceHealth(apiBase, fetchImpl = fetch) {
  const response = await fetchImpl(`${normalizeApiBase(apiBase)}/api/health`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`支付宝服务健康检查失败：HTTP ${response.status}。`);
  }
  const health = await response.json();
  if (health.service !== "offerdesk-alipay-payment") {
    throw new Error("支付宝服务类型不正确。");
  }
  if (health.ready !== true) {
    throw new Error("支付宝服务未就绪：ready 不是 true。");
  }
  return health;
}

export function parseOfferDeskConfig(source) {
  return {
    checkoutUrl: readConfigValue(source, "checkoutUrl"),
    autoCheckoutUrl: readConfigValue(source, "autoCheckoutUrl"),
    autoPaymentApiBase: readConfigValue(source, "autoPaymentApiBase"),
    paymentQrImage: readConfigValue(source, "paymentQrImage"),
    licenseProvider: readConfigValue(source, "licenseProvider"),
    lemonSqueezyProductId: readConfigValue(source, "lemonSqueezyProductId"),
    lemonSqueezyVariantId: readConfigValue(source, "lemonSqueezyVariantId"),
    licensePublicKey: readConfigObject(source, "licensePublicKey"),
    supportEmail: readConfigValue(source, "supportEmail")
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
    apiBase: values["api-base"],
    config: values.config,
    out: values.out
  };
}

function normalizeApiBase(value) {
  const apiBase = String(value || "").trim().replace(/\/+$/u, "");
  if (!/^https:\/\/.+/u.test(apiBase)) {
    throw new Error("支付宝服务地址必须是 https 开头。");
  }
  if (containsPlaceholder(apiBase) || apiBase.includes(".test") || apiBase.includes(".invalid")) {
    throw new Error("支付宝服务地址不能是示例地址。");
  }
  return apiBase;
}

function readConfigValue(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*["']([^"']*)["']`));
  return match ? match[1].trim() : "";
}

function readConfigObject(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*(\\{[^;]*?\\})\\s*,?\\n`));
  if (!match) {
    return {};
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function containsPlaceholder(value) {
  const lower = String(value || "").toLowerCase();
  return lower.includes("example") || lower.includes("your-") || value.includes("你的");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await connectAlipayService(parseArgs(process.argv.slice(2)));
    console.log(`支付宝服务已接入：${result.apiBase}`);
    console.log(`配置已写入：${result.output}`);
    console.log("健康检查通过：ready=true");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
