import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseOfferDeskConfig } from "./connect-alipay-service.mjs";
import { validateAlipayEnv } from "./validate-alipay-env.mjs";

const root = new URL("../", import.meta.url);
const defaultEnvFile = "secrets/alipay-auto-payment.env";
const defaultConfigFile = "app-config.js";
const defaultEmail = "534403209@qq.com";

export async function buildAlipayLaunchReadiness(options = {}) {
  const envFile = options.envFile || defaultEnvFile;
  const configFile = options.config || defaultConfigFile;
  const envReport = options.envReport || await readEnvReport(envFile, options.env);
  const configText = options.configText || await readFile(new URL(configFile, root), "utf8");
  const config = parseOfferDeskConfig(configText);
  const apiBase = normalizeApiBase(options.apiBase || config.autoPaymentApiBase);
  const envReady = envReport.failed === 0;
  const frontConnected = realHttps(config.autoPaymentApiBase);
  const missing = envReport.checks.filter((item) => !item.pass);
  const passed = envReport.checks.filter((item) => item.pass);

  return {
    envFile,
    configFile,
    stage: stageName({ envReady, frontConnected }),
    conclusion: conclusionText({ envReady, frontConnected }),
    envReady,
    frontConnected,
    canCreateAutoOrder: envReady && frontConnected,
    apiBase,
    envReport,
    missing,
    passed,
    nextActions: nextActions({ envReady, frontConnected, missing }),
    commands: commandList({ envFile, apiBase })
  };
}

export function renderAlipayLaunchReadinessMarkdown(readiness, now = new Date()) {
  const lines = [
    "# 支付宝自动收款上线清单",
    "",
    `生成时间：${formatDateTime(now)}`,
    "",
    `当前阶段：${readiness.stage}`,
    `结论：${readiness.conclusion}`,
    "",
    "## 环境预检",
    "",
    `通过：${readiness.envReport.passed}`,
    `失败：${readiness.envReport.failed}`,
    `环境文件：${readiness.envFile}`,
    "",
    "## 缺少项目",
    ""
  ];

  if (readiness.missing.length === 0) {
    lines.push("- 无");
  } else {
    for (const item of readiness.missing) {
      lines.push(`- ${item.name}：${item.fix}`);
    }
  }

  lines.push("");
  lines.push("## 已通过项目");
  lines.push("");
  for (const item of readiness.passed) {
    lines.push(`- ${item.name}`);
  }

  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  readiness.nextActions.forEach((action, index) => {
    lines.push(`${index + 1}. ${action}`);
  });

  lines.push("");
  lines.push("## 可直接运行的命令");
  lines.push("");
  lines.push("```bash");
  for (const command of readiness.commands) {
    lines.push(command);
    lines.push("");
  }
  lines.pop();
  lines.push("```");

  lines.push("");
  lines.push("## 不能由 GPT 伪造的部分");
  lines.push("");
  lines.push("- 支付宝开放平台应用 ID、应用私钥、支付宝公钥。");
  lines.push("- 公网支付服务部署后的真实 https 地址。");
  lines.push("- 买家真实付款和第一笔收入记录。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--no-fail") {
      values.noFail = true;
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
    envFile: values["env-file"],
    config: values.config,
    apiBase: values["api-base"],
    write: values.write,
    noFail: values.noFail === true
  };
}

async function readEnvReport(envFile, env) {
  try {
    return await validateAlipayEnv({ file: envFile, env: env || {} });
  } catch (error) {
    return {
      passed: 0,
      failed: 1,
      checks: [
        {
          name: "支付宝 env 文件",
          pass: false,
          fix: `读取失败：${error.message}`
        }
      ]
    };
  }
}

function stageName({ envReady, frontConnected }) {
  if (!envReady) {
    return "补支付宝商家参数";
  }
  if (!frontConnected) {
    return "部署自动收款服务";
  }
  return "创建测试订单并做真实付款验收";
}

function conclusionText({ envReady, frontConnected }) {
  if (!envReady) {
    return "还不能自动收款，先补齐支付宝商家参数。";
  }
  if (!frontConnected) {
    return "环境变量已准备好，下一步部署服务并接入前端。";
  }
  return "前端已有自动收款服务地址，下一步创建测试订单和真实付款验收。";
}

function nextActions({ envReady, frontConnected, missing }) {
  if (!envReady) {
    return [
      `补齐 ${missing.map((item) => item.name).join("、")}。`,
      "重新运行环境预检，必须 0 失败。",
      "预检通过后，把服务部署到 Render 或其他公网 https 平台。"
    ];
  }
  if (!frontConnected) {
    return [
      "部署 scripts/alipay-payment-server.mjs，拿到公网 https 服务地址。",
      "运行 finalize-alipay-launch，创建待支付测试订单并写入 app-config.js。",
      "提交 app-config.js，等待 GitHub Pages 同步。"
    ];
  }
  return [
    "运行 validate-alipay-service 创建待支付测试订单。",
    "用真实支付宝完成一笔小额付款。",
    "确认授权码生成、前端解锁、收入记录和 release-acceptance 都有证据。"
  ];
}

function commandList({ envFile, apiBase }) {
  const node = process.execPath;
  const serviceUrl = apiBase || "https://你的支付服务器域名";
  return [
    `${node} scripts/validate-alipay-env.mjs --file ${quoteShell(envFile)}`,
    `${node} scripts/finalize-alipay-launch.mjs --env-file ${quoteShell(envFile)} --api-base ${quoteShell(serviceUrl)} --email ${quoteShell(defaultEmail)}`,
    `${node} scripts/auto-revenue-status.mjs --tests-passed --static-check-passed --write launch/auto-revenue-current-status.md --no-fail`
  ];
}

function normalizeApiBase(value) {
  const text = String(value || "").trim().replace(/\/+$/u, "");
  return realHttps(text) ? text : "";
}

function realHttps(value) {
  const text = String(value || "").trim();
  return /^https:\/\/.+/u.test(text) &&
    !text.includes(".test") &&
    !text.includes(".invalid") &&
    !containsPlaceholder(text);
}

function containsPlaceholder(value) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  return lower.includes("example") || lower.includes("your-") || text.includes("你的");
}

function quoteShell(value) {
  return `"${String(value || "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const readiness = await buildAlipayLaunchReadiness(args);
    const markdown = renderAlipayLaunchReadinessMarkdown(readiness);
    if (args.write) {
      await writeFile(new URL(args.write, root), markdown, "utf8");
      console.log(`支付宝自动收款上线清单已写入：${args.write}`);
    } else {
      console.log(markdown.trimEnd());
    }
    if (!readiness.canCreateAutoOrder && !args.noFail) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
