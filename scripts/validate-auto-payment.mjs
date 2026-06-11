import { readFile } from "node:fs/promises";

const configPath = readArg("--config") || new URL("../app-config.js", import.meta.url);
const configText = await readFile(configPath, "utf8");

const checks = [
  {
    name: "自动收款平台",
    pass: readConfigValue(configText, "licenseProvider") === "lemonsqueezy",
    fix: "把 app-config.js 的 licenseProvider 改成 lemonsqueezy。"
  },
  {
    name: "自动付款链接",
    pass: isRealAutoCheckoutUrl(readConfigValue(configText, "autoCheckoutUrl")),
    fix: "创建 Lemon Squeezy 商品后，把 checkout URL 写入 autoCheckoutUrl。"
  },
  {
    name: "产品 ID",
    pass: /^\d+$/.test(readConfigValue(configText, "lemonSqueezyProductId")),
    fix: "把 Lemon Squeezy 产品 ID 写入 lemonSqueezyProductId。"
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

  console.log("OfferDesk 全自动收款检查");
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

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}
