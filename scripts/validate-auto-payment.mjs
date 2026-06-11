import { readFile } from "node:fs/promises";

const configPath = readArg("--config") || new URL("../app-config.js", import.meta.url);
const configText = await readFile(configPath, "utf8");

const checks = [
  {
    name: "支付宝自动收款服务",
    pass: isRealAutoCheckoutUrl(readConfigValue(configText, "autoPaymentApiBase")),
    fix: "部署 scripts/alipay-payment-server.mjs，把服务地址写入 autoPaymentApiBase。"
  },
  {
    name: "签名授权模式",
    pass: readConfigValue(configText, "licenseProvider") === "signed",
    fix: "把 app-config.js 的 licenseProvider 改成 signed。"
  },
  {
    name: "授权公钥",
    pass: isValidLicensePublicKey(readConfigObject(configText, "licensePublicKey")),
    fix: "生成授权公私钥，把公钥写入 licensePublicKey。"
  },
  {
    name: "客服邮箱",
    pass: isRealEmail(readConfigValue(configText, "supportEmail")),
    fix: "写入真实客服邮箱。"
  }
];

printReport(checks);

if (checks.some((item) => !item.pass)) {
  process.exit(1);
}

function printReport(items) {
  const passed = items.filter((item) => item.pass).length;
  const failed = items.length - passed;

  console.log("OfferDesk 支付宝全自动收款检查");
  console.log(`通过：${passed}`);
  console.log(`失败：${failed}`);
  console.log("");

  for (const item of items) {
    console.log(`${item.pass ? "OK" : "FAIL"} ${item.name}`);
    if (!item.pass) {
      console.log(`  处理：${item.fix}`);
    }
  }
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

function isRealAutoCheckoutUrl(value) {
  return /^https:\/\/.+/.test(value) &&
    !value.includes("example") &&
    !value.includes("your-") &&
    !value.includes("你的") &&
    !/github\.io\/graphics-debug\/offerdesk\/(buy|pay|after-pay)\.html/.test(value);
}

function isRealEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) &&
    !value.includes("example") &&
    !value.includes("你的");
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

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}
