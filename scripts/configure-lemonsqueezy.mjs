import { pathToFileURL } from "node:url";
import { writeConfig } from "./write-config.mjs";

const defaultCheckoutUrl = "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html";
const defaultPaymentQrImage = "./launch/payment-alipay.jpeg";
const defaultSupportEmail = "534403209@qq.com";

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
    autoCheckoutUrl: values["auto-checkout-url"],
    lemonSqueezyProductId: values["product-id"],
    lemonSqueezyVariantId: values["variant-id"],
    licenseCode: values["fallback-license-code"],
    supportEmail: values["support-email"] || defaultSupportEmail,
    checkoutUrl: values["checkout-url"] || defaultCheckoutUrl,
    paymentQrImage: values["payment-qr-image"] || defaultPaymentQrImage,
    out: values.out || "app-config.js"
  };
}

export async function configureLemonSqueezy(options) {
  assertLemonSqueezyCheckoutUrl(options.autoCheckoutUrl);

  const output = await writeConfig({
    checkoutUrl: options.checkoutUrl,
    autoCheckoutUrl: options.autoCheckoutUrl,
    paymentQrImage: options.paymentQrImage,
    licenseProvider: "lemonsqueezy",
    lemonSqueezyProductId: options.lemonSqueezyProductId,
    lemonSqueezyVariantId: options.lemonSqueezyVariantId,
    licenseCode: options.licenseCode,
    supportEmail: options.supportEmail,
    out: options.out
  });

  return output;
}

function assertLemonSqueezyCheckoutUrl(value) {
  const urlText = String(value || "").trim();
  if (!urlText) {
    throw new Error("缺少 Lemon Squeezy checkout URL。");
  }

  let parsed;
  try {
    parsed = new URL(urlText);
  } catch {
    throw new Error("Lemon Squeezy checkout URL 格式不正确。");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Lemon Squeezy checkout URL 必须是 https。");
  }

  if (!parsed.hostname.endsWith(".lemonsqueezy.com")) {
    throw new Error("checkout URL 必须来自 lemonsqueezy.com。");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const output = await configureLemonSqueezy(parseArgs(process.argv.slice(2)));
    console.log(`Lemon Squeezy 自动收款配置已写入：${output}`);
    console.log("接下来运行：");
    console.log("/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-auto-payment.mjs");
    console.log("/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-release.mjs");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
