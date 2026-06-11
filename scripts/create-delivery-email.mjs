import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function createDeliveryEmailText({ appUrl, licenseCode, supportEmail }) {
  const cleanAppUrl = String(appUrl || "").trim();
  const cleanLicenseCode = String(licenseCode || "").trim();
  const cleanSupportEmail = String(supportEmail || "").trim();

  assertValidAppUrl(cleanAppUrl);
  assertValidLicenseCode(cleanLicenseCode);
  assertValidSupportEmail(cleanSupportEmail);

  return `标题：你的 OfferDesk 专业版授权码

正文：

你好，感谢购买 OfferDesk 专业版。

线上地址：
${cleanAppUrl}

你的授权码是：

${cleanLicenseCode}

使用方式：

1. 打开线上地址。
2. 点击右上角「解锁专业版」。
3. 输入授权码。
4. 看到「可正式交付」后，就可以导出正式报价单。

如果遇到问题，请联系：${cleanSupportEmail}

OfferDesk
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
    appUrl: values["app-url"],
    licenseCode: values["license-code"],
    supportEmail: values["support-email"],
    out: values.out || ""
  };
}

export async function writeDeliveryEmail(options) {
  const text = createDeliveryEmailText(options);
  if (!options.out) {
    return text;
  }

  await writeFile(options.out, text, "utf8");
  return text;
}

function assertValidAppUrl(value) {
  if (!/^https:\/\/.+/.test(value)) {
    throw new Error("线上地址必须是 https 开头的真实地址。");
  }
  if (containsPlaceholder(value) || value.includes(".test") || value.includes(".invalid")) {
    throw new Error("线上地址不能是示例地址。");
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
    const options = parseArgs(process.argv.slice(2));
    const text = await writeDeliveryEmail(options);
    if (options.out) {
      console.log(`付款后邮件已写入：${options.out}`);
      console.log("注意：这个文件包含明文授权码，不要放进网页发布包。");
    } else {
      console.log(text);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
