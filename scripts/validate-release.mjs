import { readFile } from "node:fs/promises";
import { calculateQuote, defaultQuote } from "../src/pricing.js";

const configPath = readArg("--config") || new URL("../app-config.js", import.meta.url);
const requiredFiles = [
  "index.html",
  "sales.html",
  "pay.html",
  "after-pay.html",
  "share-copy.txt",
  "styles.css",
  "src/app.js",
  "src/legal.js",
  "src/license.js",
  "src/pricing.js",
  "src/sales.js",
  "src/templates.js",
  "app-config.js",
  "launch/payment-alipay.jpeg",
  "scripts/build-upload-zip.mjs",
  "scripts/check-license-leak.mjs",
  "scripts/prepare-release.mjs",
  "scripts/release-status.mjs",
  "scripts/validate-acceptance.mjs",
  "scripts/check-static-assets.mjs",
  "scripts/create-delivery-email.mjs",
  "scripts/hash-license.mjs",
  "scripts/write-config.mjs",
  "launch/listing.md",
  "launch/checklist.md",
  "launch/buyer-guide.md",
  "launch/final-release-runbook.md",
  "launch/manual-upload-checklist.md",
  "launch/first-customers.md",
  "launch/payment-platform-guide.md",
  "launch/post-purchase-email.md",
  "launch/offerdesk-screenshot.jpg",
  "launch/product-page-fields.md",
  "launch/release-acceptance.md",
  "launch/sales-tracker.csv",
  "privacy.html",
  "terms.html",
  "refund.html",
  "sitemap.xml",
  "robots.txt"
];

const checks = [];

await checkRequiredFiles();

const configText = await readFile(configPath, "utf8");
const checkoutUrl = readConfigValue(configText, "checkoutUrl");
const paymentQrImage = readConfigValue(configText, "paymentQrImage");
const licenseHash = readConfigValue(configText, "licenseHash");
const supportEmail = readConfigValue(configText, "supportEmail");

check(
  "真实收款方式",
  isRealCheckoutUrl(checkoutUrl) || await isRealPaymentQrImage(paymentQrImage),
  "用 scripts/write-config.mjs 写入真实 https 付款链接，或配置项目内收款码图片。"
);

check(
  "授权码哈希",
  /^[a-f0-9]{64}$/.test(licenseHash),
  "用 scripts/write-config.mjs 生成 licenseHash。"
);

check(
  "无明文授权码",
  !configText.includes("licenseCode"),
  "app-config.js 不能出现 licenseCode，只能出现 licenseHash。"
);

check(
  "真实客服邮箱",
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supportEmail) &&
    !supportEmail.includes("example") &&
    !supportEmail.includes("你的"),
  "用 scripts/write-config.mjs 写入真实客服邮箱。"
);

const result = calculateQuote(defaultQuote);
check("默认报价可计算", result.total > 0 && result.profit > 0, "检查 src/pricing.js 默认报价数据。");

printReport();

const failed = checks.filter((item) => !item.pass);
if (failed.length > 0) {
  process.exit(1);
}

async function checkRequiredFiles() {
  for (const file of requiredFiles) {
    try {
      await readText(file);
      check(`文件存在：${file}`, true, "");
    } catch {
      check(`文件存在：${file}`, false, `补齐缺失文件：${file}`);
    }
  }
}

async function readText(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function check(name, pass, fix) {
  checks.push({ name, pass, fix });
}

function printReport() {
  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.length - passed;

  console.log("OfferDesk 发布检查");
  console.log(`通过：${passed}`);
  console.log(`失败：${failed}`);
  console.log("");

  for (const item of checks) {
    console.log(`${item.pass ? "OK" : "FAIL"} ${item.name}`);
    if (!item.pass && item.fix) {
      console.log(`  处理：${item.fix}`);
    }
  }
}

function readConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*["']([^"']*)["']`));
  return match ? match[1].trim() : "";
}

function isRealCheckoutUrl(value) {
  return /^https:\/\/.+/.test(value) &&
    !value.includes("example") &&
    !value.includes("你的") &&
    !value.includes("your-");
}

async function isRealPaymentQrImage(value) {
  if (!/^\.\/.+\.(png|jpe?g|webp)$/i.test(value)) {
    return false;
  }
  if (value.includes("example") || value.includes("你的") || value.includes("your-")) {
    return false;
  }

  try {
    await readFile(new URL(`../${value.replace(/^\.\//, "")}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}
