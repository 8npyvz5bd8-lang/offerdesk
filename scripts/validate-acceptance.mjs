import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const requiredTextFields = [
  "验收日期",
  "线上地址",
  "收款平台",
  "收款方式",
  "客服邮箱"
];

const requiredYesFields = [
  "授权码是否已写入付款后邮件",
  "`node scripts/validate-release.mjs`",
  "`node scripts/build-release.mjs`",
  "首页能打开",
  "报价能计算",
  "隐私页能打开",
  "条款页能打开",
  "退款页能打开",
  "购买入口能打开收款方式",
  "已完成一笔真实付款",
  "已收到付款通知",
  "已收到付款后邮件",
  "邮件里的授权码正确",
  "输入授权码后水印消失",
  "PDF 打印或保存正常",
  "是否可以正式公开售卖"
];

export function validateAcceptanceText(source) {
  const fields = parseFields(source);
  const checks = [];

  for (const name of requiredTextFields) {
    const value = fields.get(name) || "";
    checks.push({
      name,
      pass: value.length > 0 && !containsPlaceholder(value),
      fix: `填写真实${name}。`
    });
  }

  for (const name of requiredYesFields) {
    const value = fields.get(name) || "";
    checks.push({
      name,
      pass: isYes(value),
      fix: `确认后填写“是”或“通过”：${name}。`
    });
  }

  return checks;
}

export function parseFields(source) {
  const fields = new Map();
  const lines = String(source || "").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^- (.+?)：(.*)$/);
    if (!match) {
      continue;
    }
    fields.set(match[1].trim(), match[2].trim());
  }

  return fields;
}

function isYes(value) {
  return /^(是|已确认|通过|成功|ok|yes|true)$/i.test(String(value || "").trim());
}

function containsPlaceholder(value) {
  const lower = String(value || "").toLowerCase();
  return lower.includes("example") || lower.includes("your-") || lower.includes("你的");
}

export function printAcceptanceReport(checks) {
  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.length - passed;

  console.log("OfferDesk 真实发布验收");
  console.log(`通过：${passed}`);
  console.log(`失败：${failed}`);
  console.log("");

  for (const item of checks) {
    console.log(`${item.pass ? "OK" : "FAIL"} ${item.name}`);
    if (!item.pass) {
      console.log(`  处理：${item.fix}`);
    }
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const acceptancePath = readArg("--file") || new URL("../launch/release-acceptance.md", import.meta.url);
    const text = await readFile(acceptancePath, "utf8");
    const checks = validateAcceptanceText(text);
    printAcceptanceReport(checks);

    if (checks.some((item) => !item.pass)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
