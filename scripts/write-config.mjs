import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function createConfigText({ checkoutUrl, paymentQrImage, licenseCode, supportEmail }) {
  const cleanCheckoutUrl = String(checkoutUrl || "").trim();
  const cleanPaymentQrImage = String(paymentQrImage || "").trim();
  const cleanLicenseCode = String(licenseCode || "").trim();
  const cleanSupportEmail = String(supportEmail || "").trim();

  assertValidPaymentMethod(cleanCheckoutUrl, cleanPaymentQrImage);
  assertValidLicenseCode(cleanLicenseCode);
  assertValidSupportEmail(cleanSupportEmail);

  const licenseHash = createHash("sha256").update(cleanLicenseCode).digest("hex");

return `window.OFFERDESK_CONFIG = {
  checkoutUrl: ${JSON.stringify(cleanCheckoutUrl)},
  paymentQrImage: ${JSON.stringify(cleanPaymentQrImage)},
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
    paymentQrImage: values["payment-qr-image"],
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

function assertValidPaymentMethod(checkoutUrl, paymentQrImage) {
  const hasCheckoutUrl = checkoutUrl.length > 0;
  const hasPaymentQrImage = paymentQrImage.length > 0;

  if (!hasCheckoutUrl && !hasPaymentQrImage) {
    throw new Error("必须配置真实付款链接或收款码图片。");
  }

  if (hasCheckoutUrl && !/^https:\/\/.+/.test(checkoutUrl)) {
    throw new Error("付款链接必须是 https 开头的真实链接。");
  }
  if (hasCheckoutUrl && (containsPlaceholder(checkoutUrl) || checkoutUrl.includes(".test") || checkoutUrl.includes(".invalid"))) {
    throw new Error("付款链接不能是示例链接。");
  }

  if (hasPaymentQrImage && !/^\.\/.+\.(png|jpe?g|webp)$/i.test(paymentQrImage)) {
    throw new Error("收款码图片必须是项目内的 png、jpg、jpeg 或 webp 文件。");
  }
  if (hasPaymentQrImage && containsPlaceholder(paymentQrImage)) {
    throw new Error("收款码图片不能是示例路径。");
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
