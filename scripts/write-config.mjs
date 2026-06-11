import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function createConfigText({
  checkoutUrl,
  autoCheckoutUrl,
  autoPaymentApiBase,
  paymentQrImage,
  licenseProvider,
  lemonSqueezyProductId,
  lemonSqueezyVariantId,
  licensePublicKey,
  licenseCode,
  supportEmail
}) {
  const cleanCheckoutUrl = String(checkoutUrl || "").trim();
  const cleanAutoCheckoutUrl = String(autoCheckoutUrl || "").trim();
  const cleanAutoPaymentApiBase = String(autoPaymentApiBase || "").trim().replace(/\/+$/u, "");
  const cleanPaymentQrImage = String(paymentQrImage || "").trim();
  const cleanLicenseProvider = String(licenseProvider || "local").trim().toLowerCase();
  const cleanLemonSqueezyProductId = String(lemonSqueezyProductId || "").trim();
  const cleanLemonSqueezyVariantId = String(lemonSqueezyVariantId || "").trim();
  const cleanLicensePublicKey = normalizeLicensePublicKey(licensePublicKey);
  const cleanLicenseCode = String(licenseCode || "").trim();
  const cleanSupportEmail = String(supportEmail || "").trim();

  assertValidPaymentMethod(cleanCheckoutUrl, cleanAutoCheckoutUrl, cleanPaymentQrImage);
  assertValidAutoPaymentApiBase(cleanAutoPaymentApiBase);
  assertValidLicenseProvider(cleanLicenseProvider, cleanAutoCheckoutUrl, cleanLemonSqueezyProductId, cleanLicensePublicKey);
  if (cleanLicenseProvider !== "signed") {
    assertValidLicenseCode(cleanLicenseCode);
  }
  assertValidSupportEmail(cleanSupportEmail);

  const licenseHash = cleanLicenseProvider === "signed"
    ? ""
    : createHash("sha256").update(cleanLicenseCode).digest("hex");

return `window.OFFERDESK_CONFIG = {
  checkoutUrl: ${JSON.stringify(cleanCheckoutUrl)},
  autoCheckoutUrl: ${JSON.stringify(cleanAutoCheckoutUrl)},
  autoPaymentApiBase: ${JSON.stringify(cleanAutoPaymentApiBase)},
  paymentQrImage: ${JSON.stringify(cleanPaymentQrImage)},
  licenseProvider: ${JSON.stringify(cleanLicenseProvider)},
  lemonSqueezyProductId: ${JSON.stringify(cleanLemonSqueezyProductId)},
  lemonSqueezyVariantId: ${JSON.stringify(cleanLemonSqueezyVariantId)},
  licensePublicKey: ${JSON.stringify(cleanLicensePublicKey)},
  licenseHash: ${JSON.stringify(licenseHash)},
  supportEmail: ${JSON.stringify(cleanSupportEmail)}
};
`;
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
    checkoutUrl: values["checkout-url"],
    autoCheckoutUrl: values["auto-checkout-url"],
    autoPaymentApiBase: values["auto-payment-api-base"],
    paymentQrImage: values["payment-qr-image"],
    licenseProvider: values["license-provider"],
    lemonSqueezyProductId: values["lemonsqueezy-product-id"],
    lemonSqueezyVariantId: values["lemonsqueezy-variant-id"],
    licensePublicKey: values["license-public-key"] ? JSON.parse(values["license-public-key"]) : undefined,
    licenseCode: values["license-code"],
    supportEmail: values["support-email"],
    out: values.out || "app-config.js"
  };
}

export async function writeConfig(options) {
  const output = options.out || "app-config.js";
  const configText = createConfigText(options);
  await writeFile(output, configText, "utf8");
  return output;
}

function assertValidPaymentMethod(checkoutUrl, autoCheckoutUrl, paymentQrImage) {
  const hasCheckoutUrl = checkoutUrl.length > 0;
  const hasAutoCheckoutUrl = autoCheckoutUrl.length > 0;
  const hasPaymentQrImage = paymentQrImage.length > 0;

  if (!hasCheckoutUrl && !hasAutoCheckoutUrl && !hasPaymentQrImage) {
    throw new Error("必须配置购买页、自动付款链接或收款码图片。");
  }

  if (hasCheckoutUrl && !/^https:\/\/.+/.test(checkoutUrl)) {
    throw new Error("购买页链接必须是 https 开头的真实链接。");
  }
  if (hasCheckoutUrl && (containsPlaceholder(checkoutUrl) || checkoutUrl.includes(".test") || checkoutUrl.includes(".invalid"))) {
    throw new Error("购买页链接不能是示例链接。");
  }

  if (hasAutoCheckoutUrl && !/^https:\/\/.+/.test(autoCheckoutUrl)) {
    throw new Error("自动付款链接必须是 https 开头的真实链接。");
  }
  if (hasAutoCheckoutUrl && (containsPlaceholder(autoCheckoutUrl) || autoCheckoutUrl.includes(".test") || autoCheckoutUrl.includes(".invalid"))) {
    throw new Error("自动付款链接不能是示例链接。");
  }

  if (hasPaymentQrImage && !/^\.\/.+\.(png|jpe?g|webp)$/i.test(paymentQrImage)) {
    throw new Error("收款码图片必须是项目内的 png、jpg、jpeg 或 webp 文件。");
  }
  if (hasPaymentQrImage && containsPlaceholder(paymentQrImage)) {
    throw new Error("收款码图片不能是示例路径。");
  }
}

function assertValidAutoPaymentApiBase(value) {
  if (!value) {
    return;
  }
  if (!/^https:\/\/.+/.test(value)) {
    throw new Error("支付宝自动收款服务地址必须是 https 开头的真实地址。");
  }
  if (containsPlaceholder(value) || value.includes(".test") || value.includes(".invalid")) {
    throw new Error("支付宝自动收款服务地址不能是示例链接。");
  }
}

function assertValidLicenseProvider(provider, autoCheckoutUrl, lemonSqueezyProductId, licensePublicKey) {
  if (!["local", "lemonsqueezy", "signed"].includes(provider)) {
    throw new Error("licenseProvider 只能是 local、signed 或 lemonsqueezy。");
  }
  if (provider === "lemonsqueezy" && !autoCheckoutUrl) {
    throw new Error("Lemon Squeezy 自动发码必须配置 autoCheckoutUrl。");
  }
  if (provider === "lemonsqueezy" && !/^\d+$/.test(lemonSqueezyProductId)) {
    throw new Error("Lemon Squeezy 自动发码必须配置产品 ID。");
  }
  if (provider === "signed" && !isValidLicensePublicKey(licensePublicKey)) {
    throw new Error("signed 授权必须配置 licensePublicKey。");
  }
}

function assertValidLicenseCode(value) {
  if (value.length < 8) {
    throw new Error("授权码至少 8 位。");
  }
}

function assertValidSupportEmail(value) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new Error("客服邮箱格式不正确。");
  }
  if (containsPlaceholder(value)) {
    throw new Error("客服邮箱不能是示例邮箱。");
  }
}

function containsPlaceholder(value) {
  const lower = value.toLowerCase();
  return lower.includes("example") || lower.includes("your-") || value.includes("你的");
}

function normalizeLicensePublicKey(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function isValidLicensePublicKey(value) {
  return Boolean(
    value &&
      value.kty === "EC" &&
      value.crv === "P-256" &&
      typeof value.x === "string" &&
      value.x.length > 20 &&
      typeof value.y === "string" &&
      value.y.length > 20
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const output = await writeConfig(parseArgs(process.argv.slice(2)));
    console.log(`配置已写入：${output}`);
    console.log("明文授权码没有写入配置文件。");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
