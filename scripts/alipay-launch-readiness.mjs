import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseOfferDeskConfig } from "./connect-alipay-service.mjs";
import { validateAlipayEnv } from "./validate-alipay-env.mjs";

const root = new URL("../", import.meta.url);
const defaultEnvFile = "secrets/alipay-auto-payment.env";
const defaultConfigFile = "app-config.js";
const defaultRenderFile = "render.yaml";
const defaultEmail = "534403209@qq.com";
const renderEnvOrder = [
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "OFFERDESK_PUBLIC_BASE_URL",
  "OFFERDESK_LICENSE_PRIVATE_JWK",
  "OFFERDESK_AMOUNT",
  "OFFERDESK_DATA_FILE",
  "OFFERDESK_ALLOWED_ORIGIN",
  "RESEND_API_KEY",
  "OFFERDESK_EMAIL_FROM",
  "OFFERDESK_APP_URL",
  "OFFERDESK_SUPPORT_EMAIL"
];

export async function buildAlipayLaunchReadiness(options = {}) {
  const envFile = options.envFile || defaultEnvFile;
  const configFile = options.config || defaultConfigFile;
  const renderFile = options.renderFile || defaultRenderFile;
  const envReport = options.envReport || await readEnvReport(envFile, options.env);
  const configText = options.configText || await readFile(new URL(configFile, root), "utf8");
  const renderText = options.renderText || await readFile(new URL(renderFile, root), "utf8");
  const config = parseOfferDeskConfig(configText);
  const apiBase = normalizeApiBase(options.apiBase || config.autoPaymentApiBase);
  const envReady = envReport.failed === 0;
  const frontConnected = realHttps(config.autoPaymentApiBase);
  const missing = envReport.checks.filter((item) => !item.pass);
  const passed = envReport.checks.filter((item) => item.pass);
  const renderChecklist = buildRenderEnvChecklist({ envReport, renderText });

  return {
    envFile,
    configFile,
    renderFile,
    stage: stageName({ envReady, frontConnected }),
    conclusion: conclusionText({ envReady, frontConnected }),
    envReady,
    frontConnected,
    canCreateAutoOrder: envReady && frontConnected,
    apiBase,
    envReport,
    missing,
    passed,
    renderChecklist,
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
  lines.push("## Render 环境变量填写表");
  lines.push("");
  lines.push(`Render 文件：${readiness.renderFile}`);
  lines.push("");
  lines.push("| 名称 | Render 蓝图 | 当前预检 | 怎么处理 |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of readiness.renderChecklist.rows) {
    lines.push(`| ${row.name} | ${row.renderStatus} | ${row.envStatus} | ${row.action} |`);
  }
  if (readiness.renderChecklist.missingKeys.length > 0) {
    lines.push("");
    lines.push(`Render 蓝图缺少：${readiness.renderChecklist.missingKeys.join("、")}`);
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
    renderFile: values["render-file"],
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

export function buildRenderEnvChecklist({ envReport, renderText }) {
  const renderKeys = parseRenderEnvKeys(renderText);
  const checksByName = new Map(envReport.checks.map((item) => [item.name, item]));
  const rows = renderEnvOrder.map((name) => {
    const renderState = renderKeys.get(name);
    const envCheck = checksByName.get(name);
    const missingFromRender = !renderState;
    const optional = ["RESEND_API_KEY", "OFFERDESK_EMAIL_FROM"].includes(name);
    const fixedByBlueprint = renderState === "fixed";
    const manualSecret = renderState === "secret";
    const envPass = envCheck ? envCheck.pass : fixedByBlueprint;

    return {
      name,
      renderStatus: renderStatusText(renderState),
      envStatus: envStatusText({ envCheck, optional, fixedByBlueprint }),
      action: renderActionText({ name, missingFromRender, fixedByBlueprint, manualSecret, optional, envPass, envCheck })
    };
  });

  return {
    rows,
    missingKeys: rows.filter((row) => row.renderStatus === "缺失").map((row) => row.name)
  };
}

function parseRenderEnvKeys(text) {
  const keys = new Map();
  const lines = String(text || "").split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*-\s+key:\s*([A-Z0-9_]+)/u);
    if (!match) {
      continue;
    }
    const name = match[1];
    const ownLines = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^\s*-\s+key:\s*[A-Z0-9_]+/u.test(lines[next])) {
        break;
      }
      ownLines.push(lines[next]);
    }
    keys.set(name, /sync:\s*false/u.test(ownLines.join("\n")) ? "secret" : "fixed");
  }
  return keys;
}

function renderStatusText(state) {
  if (state === "secret") {
    return "需在 Render 手填";
  }
  if (state === "fixed") {
    return "蓝图已固定";
  }
  return "缺失";
}

function envStatusText({ envCheck, optional, fixedByBlueprint }) {
  if (!envCheck) {
    if (fixedByBlueprint) {
      return "蓝图固定";
    }
    return optional ? "可选" : "未检查";
  }
  return envCheck.pass ? "已通过" : "缺失或格式错误";
}

function renderActionText({ name, missingFromRender, fixedByBlueprint, manualSecret, optional, envPass, envCheck }) {
  if (missingFromRender) {
    return "先补进 render.yaml。";
  }
  if (fixedByBlueprint) {
    return envPass ? "不用手填。" : (envCheck?.fix || "检查蓝图固定值。");
  }
  if (manualSecret && envPass) {
    return optional ? "需要自动邮件时照当前真实值填写。" : "部署时照当前真实值填写。";
  }
  if (optional) {
    return "可先留空；需要自动邮件时再填。";
  }
  return envCheck?.fix || `在 Render 填写 ${name}。`;
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
