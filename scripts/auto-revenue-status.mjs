import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildReleaseStatus } from "./release-status.mjs";
import { validateAcceptanceText } from "./validate-acceptance.mjs";
import { validateAlipayEnv } from "./validate-alipay-env.mjs";
import { validateOutreach } from "./validate-outreach.mjs";

const root = new URL("../", import.meta.url);

const publicPages = [
  "buy.html",
  "pay.html",
  "after-pay.html",
  "share.html",
  "promotion.html",
  "pipeline.html",
  "privacy.html",
  "terms.html",
  "refund.html"
];

export async function buildAutoRevenueStatus(options = {}) {
  const planText = await readText("launch/auto-revenue-20-step-plan.md");
  const configText = await readText("app-config.js");
  const publicSiteFile = options.publicSiteFile === undefined ? "launch/public-site-verification.json" : options.publicSiteFile;
  const publicSite = publicSiteFile ? await inspectPublicSiteVerification(publicSiteFile) : {
    ready: false,
    passed: 0,
    total: 0,
    evidence: "当前没有线上校验报告。"
  };
  const outreach = options.outreach === undefined ? await inspectOutreach() : options.outreach;
  const acceptanceText = await readText("launch/release-acceptance.md");
  const buyText = await readText("buy.html");
  const indexText = await readText("index.html");
  const releaseStatus = buildReleaseStatus({
    configText,
    acceptanceText,
    checkoutPageText: buyText,
    artifacts: {
      releaseDir: await exists("dist/offerdesk-release"),
      uploadZip: await exists("dist/offerdesk-release.zip"),
      deliveryEmail: await exists("dist/post-purchase-email.txt")
    }
  });

  const env = options.env || process.env;
  const envFile = options.envFile === undefined ? "secrets/alipay-auto-payment.env" : options.envFile;
  const alipayEnvFile = envFile ? await inspectAlipayEnvFile(envFile) : { exists: false, ready: false };
  const alipayRuntimeEnv = await inspectAlipayRuntimeEnv(env);
  const alipayMerchantReady = hasAlipayMerchantEnv(env) || alipayEnvFile.ready;
  const alipayFullEnvReady = alipayRuntimeEnv.ready || alipayEnvFile.ready;
  const planStepCount = countPlanSteps(planText);
  const pagesWithSurface = await countPagesWithSurface();
  const releaseHasSiteCss = await exists("dist/offerdesk-release/site.css");
  const uploadZipExists = await exists("dist/offerdesk-release.zip");
  const hasPrivateJwk = await hasValidPrivateJwk();
  const renderText = await readText("render.yaml");
  const hasPersistentStore = renderText.includes("/data/orders.json") && renderText.includes("mountPath: /data");
  const autoPaymentApiBase = readConfigValue(configText, "autoPaymentApiBase");
  const licenseProvider = readConfigValue(configText, "licenseProvider");
  const paymentQrImage = readConfigValue(configText, "paymentQrImage");
  const acceptancePass = validateAcceptanceText(acceptanceText).every((item) => item.pass);

  const steps = [
    step(1, "固定当前视觉标准", await exists("site.css"), "site.css 已存在。", "补 site.css，并把 sales 风格抽成公共样式。"),
    step(2, "检查所有公开页面", pagesWithSurface.done === pagesWithSurface.total, `${pagesWithSurface.done}/${pagesWithSurface.total} 个公开页面已接入统一皮肤。`, "继续给缺失页面加 site.css 和 surface-page。"),
    step(3, "保持报价工具可用", indexText.includes("quoteForm") && indexText.includes("./src/app.js"), "index.html 仍包含报价表单和主脚本。", "打开工具页做浏览器点击验收。"),
    step(4, "保证发布包包含新样式", releaseHasSiteCss && uploadZipExists, "发布目录和上传压缩包已存在，发布目录包含 site.css。", "运行 node scripts/build-upload-zip.mjs。"),
    step(5, "跑完整测试", options.testsPassed === true, "本次状态脚本收到 testsPassed=true。", "运行完整测试，确认通过后再把 testsPassed=true 传入。", "needs_command"),
    step(6, "跑静态页面检查", options.staticCheckPassed === true, "本次状态脚本收到 staticCheckPassed=true。", "运行 node scripts/check-static-assets.mjs。", "needs_command"),
    step(7, "确认当前上架状态", true, `当前阶段：${releaseStatus.stage}。`, "运行 node scripts/release-status.mjs。"),
    step(8, "选择自动收款路线", licenseProvider === "signed" && paymentQrImage, "当前配置是 signed 授权 + 支付宝路线。", "确认走支付宝官方商家接口或切换 Lemon Squeezy。"),
    step(9, "准备支付宝商家参数", alipayMerchantReady, alipayMerchantReady ? "已发现可通过预检的支付宝商家参数。" : alipayEnvEvidence(alipayEnvFile), "补 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY、OFFERDESK_PUBLIC_BASE_URL。", "blocked"),
    step(10, "准备授权签名私钥", hasPrivateJwk, "本地授权私钥文件存在且字段完整。", "运行 node scripts/generate-license-keypair.mjs 生成授权密钥。"),
    step(11, "准备订单持久存储", hasPersistentStore, "render.yaml 已配置 /data/orders.json 和 /data 持久磁盘。", "给部署平台补持久磁盘和 OFFERDESK_DATA_FILE。"),
    step(12, "准备自动邮件", hasEmailEnv(env), hasEmailEnv(env) ? "当前环境变量里有自动邮件配置。" : "当前环境变量里没有自动邮件配置。", "补 RESEND_API_KEY 和 OFFERDESK_EMAIL_FROM；没有也可先让买家页面显示授权码。", "needs_manual"),
    step(13, "写真实环境变量文件", alipayFullEnvReady, alipayFullEnvReady ? "当前运行环境或本地 env 文件已通过支付宝预检。" : alipayEnvEvidence(alipayEnvFile), "运行 node scripts/create-alipay-env-draft.mjs 生成草稿，再填真实值，文件不要提交。", "blocked"),
    step(14, "部署自动收款服务", isRealAutoPaymentApiBase(autoPaymentApiBase), isRealAutoPaymentApiBase(autoPaymentApiBase) ? "app-config.js 已写入自动收款服务地址。" : "app-config.js 的 autoPaymentApiBase 为空或不是可用自动服务地址。", "部署 scripts/alipay-payment-server.mjs，并拿到 https 服务地址。", "blocked"),
    step(15, "检查服务健康状态", isRealAutoPaymentApiBase(autoPaymentApiBase), isRealAutoPaymentApiBase(autoPaymentApiBase) ? "已有自动服务地址，下一步请求 /api/health。" : "还没有自动服务地址，无法请求 /api/health。", "服务上线后请求 /api/health，必须 ready=true。", "blocked"),
    step(16, "创建测试订单", isRealAutoPaymentApiBase(autoPaymentApiBase), isRealAutoPaymentApiBase(autoPaymentApiBase) ? "已有自动服务地址，可运行 validate-alipay-service。" : "还没有自动服务地址，无法创建测试订单。", "运行 node scripts/validate-alipay-service.mjs。", "blocked"),
    step(17, "接入前端配置", isRealAutoPaymentApiBase(autoPaymentApiBase), isRealAutoPaymentApiBase(autoPaymentApiBase) ? "前端已接入 autoPaymentApiBase。" : "前端还没有真实 autoPaymentApiBase。", "运行 node scripts/connect-alipay-service.mjs。", "blocked"),
    step(18, "验证自动购买页", buyText.includes("buyerName") && buyText.includes("buyerEmail"), "购买页已有买家名称和邮箱字段。", "自动服务接入后，用浏览器生成专属付款码。"),
    step(19, "做一笔真实小额付款", false, "GPT 不能替用户真实付款。", "服务上线后请用真实支付宝完成一笔付款。", "needs_manual"),
    step(20, "验证授权码自动解锁", false, "尚未发现真实付款生成的授权码证据。", "付款后用 index.html?license_key=... 验证水印消失。", "blocked"),
    step(21, "填写真实发布验收", acceptancePass, acceptancePass ? "launch/release-acceptance.md 已通过验收。" : "launch/release-acceptance.md 仍显示真实付款或自动收款未完成。", "完成真实付款后填写 release-acceptance.md。", "blocked"),
    step(22, "更新正式发布包", releaseHasSiteCss && uploadZipExists, "dist/offerdesk-release 和 dist/offerdesk-release.zip 已生成。", "运行 node scripts/build-upload-zip.mjs。"),
    step(23, "发布到长期公网地址", publicSite.ready, publicSite.ready ? `线上校验通过：${publicSite.passed}/${publicSite.total} 个文件与本地一致。` : publicSite.evidence, "运行 node scripts/verify-public-site.mjs --write launch/public-site-verification.json。", "blocked"),
    step(24, "检查线上页面", publicSite.ready, publicSite.ready ? `${publicSite.total} 个线上关键文件已和本地一致。` : publicSite.evidence, "用线上校验脚本和浏览器截图检查页面。", "blocked"),
    step(25, "准备首批获客名单", outreach.prospects >= 10, `${outreach.prospects}/10 个真实潜在买家记录。`, "整理 10 个真实接单人，不编造。", "needs_manual"),
    step(26, "发布推广内容", outreach.publishedChannels >= 3, `${outreach.publishedChannels}/3 个推广渠道有真实发布证据。`, "用 share.html 文案发布到真实渠道，并记录到 promotion-log.csv。", "needs_manual"),
    step(27, "跟进每个潜在买家", await exists("pipeline.html"), "pipeline.html 已存在，可记录线索。", "把真实联系人状态录入跟进台。"),
    step(28, "处理第一笔自动订单", false, "尚无第一笔自动订单证据。", "订单成功后检查订单 JSON、授权码和邮件状态。", "blocked"),
    step(29, "记录收入和问题", outreach.paid > 0 && outreach.revenue > 0, outreach.paid > 0 ? `sales-tracker.csv 中有 ${outreach.paid} 笔付款，收入 ¥${outreach.revenue.toFixed(2)}。` : "sales-tracker.csv 中没有真实付款记录。", "有真实付款后记录到 sales-tracker.csv。", "needs_manual"),
    step(30, "做 7 天复盘", false, "尚未达到 7 天真实数据复盘。", "满 7 天后按试用、付费、反馈复盘。", "needs_manual")
  ];

  return {
    planStepCount,
    completed: steps.filter((item) => item.status === "done").length,
    blocked: steps.filter((item) => item.status === "blocked").length,
    needsManual: steps.filter((item) => item.status === "needs_manual").length,
    needsCommand: steps.filter((item) => item.status === "needs_command").length,
    nextStep: firstActionableStep(steps),
    releaseStage: releaseStatus.stage,
    canSell: releaseStatus.canSell,
    steps
  };
}

export function renderAutoRevenueStatusMarkdown(status, now = new Date()) {
  const lines = [
    "# OfferDesk 自动赚钱执行状态",
    "",
    `生成时间：${formatDateTime(now)}`,
    "",
    `文档步骤数：${status.planStepCount}`,
    `已完成：${status.completed}`,
    `被阻塞：${status.blocked}`,
    `需人工：${status.needsManual}`,
    `需运行命令确认：${status.needsCommand}`,
    `当前上架阶段：${status.releaseStage}`,
    `可以公开自动售卖：${status.canSell ? "是" : "否"}`,
    "",
    `下一步：${status.nextStep.number}. ${status.nextStep.title}：${status.nextStep.next}`,
    "",
    "## 逐步状态",
    ""
  ];

  for (const item of status.steps) {
    lines.push(`### ${item.number}. ${item.title}`);
    lines.push("");
    lines.push(`状态：${statusLabel(item.status)}`);
    lines.push(`证据：${item.evidence}`);
    lines.push(`下一步：${item.next}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function step(number, title, pass, evidence, next, fallbackStatus = "todo") {
  return {
    number,
    title,
    status: pass ? "done" : fallbackStatus,
    evidence,
    next
  };
}

function firstActionableStep(steps) {
  return steps.find((item) => item.status !== "done") || steps.at(-1);
}

function statusLabel(value) {
  return {
    done: "已完成",
    todo: "待做",
    blocked: "被阻塞",
    needs_manual: "需人工",
    needs_command: "需运行命令确认"
  }[value] || value;
}

async function countPagesWithSurface() {
  let done = 0;
  for (const file of publicPages) {
    const text = await readText(file);
    if (text.includes("./site.css") && text.includes("surface-page")) {
      done += 1;
    }
  }
  return { done, total: publicPages.length };
}

async function hasValidPrivateJwk() {
  try {
    const text = await readText("secrets/offerdesk-license-private.jwk.json");
    const jwk = JSON.parse(text);
    return jwk?.kty === "EC" &&
      jwk?.crv === "P-256" &&
      typeof jwk?.d === "string" &&
      jwk.d.length > 20;
  } catch {
    return false;
  }
}

async function inspectAlipayEnvFile(file) {
  if (!await exists(file)) {
    return { exists: false, ready: false };
  }
  try {
    const report = await validateAlipayEnv({ file, env: {} });
    return {
      exists: true,
      ready: report.failed === 0,
      failed: report.failed
    };
  } catch {
    return { exists: true, ready: false };
  }
}

async function inspectAlipayRuntimeEnv(env) {
  try {
    const report = await validateAlipayEnv({ env });
    return {
      ready: report.failed === 0,
      failed: report.failed
    };
  } catch {
    return { ready: false };
  }
}

async function inspectPublicSiteVerification(file) {
  try {
    const report = JSON.parse(await readText(file));
    const files = Array.isArray(report.files) ? report.files : [];
    const current = await Promise.all(files.map(async (item) => ({
      ...item,
      currentHash: await fileHash(item.file)
    })));
    const passed = current.filter((item) => item.ok && item.localHash === item.currentHash && item.remoteHash === item.currentHash).length;
    return {
      ready: current.length > 0 && passed === current.length,
      passed,
      total: current.length,
      evidence: current.length > 0
        ? `线上校验报告未通过：${passed}/${current.length} 个文件与本地一致。`
        : "当前没有线上校验报告。"
    };
  } catch {
    return {
      ready: false,
      passed: 0,
      total: 0,
      evidence: "当前没有线上校验报告。"
    };
  }
}

function alipayEnvEvidence(result) {
  if (!result.exists) {
    return "当前没有真实支付宝环境变量文件或完整运行环境变量。";
  }
  return `已发现本地 env 草稿，但还有 ${result.failed ?? "若干"} 项支付宝预检未通过。`;
}

async function inspectOutreach() {
  try {
    return await validateOutreach();
  } catch {
    return {
      prospects: 0,
      publishedChannels: 0,
      paid: 0,
      revenue: 0
    };
  }
}

function hasAlipayMerchantEnv(env) {
  return Boolean(
    realValue(env.ALIPAY_APP_ID) &&
      (realValue(env.ALIPAY_PRIVATE_KEY) || realValue(env.ALIPAY_PRIVATE_KEY_FILE)) &&
      (realValue(env.ALIPAY_PUBLIC_KEY) || realValue(env.ALIPAY_PUBLIC_KEY_FILE)) &&
      realHttps(env.OFFERDESK_PUBLIC_BASE_URL)
  );
}

function hasEmailEnv(env) {
  return Boolean(realValue(env.RESEND_API_KEY) && realValue(env.OFFERDESK_EMAIL_FROM));
}

function isRealAutoPaymentApiBase(value) {
  return realHttps(value) && !/github\.io\/(?:graphics-debug\/)?offerdesk\/(buy|pay|after-pay)\.html/.test(value);
}

function realHttps(value) {
  return /^https:\/\/.+/u.test(String(value || "").trim()) && !containsPlaceholder(value);
}

function realValue(value) {
  return Boolean(String(value || "").trim()) && !containsPlaceholder(value);
}

function containsPlaceholder(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("example") || text.includes("your-") || text.includes("你的");
}

function countPlanSteps(text) {
  return [...String(text || "").matchAll(/^## \d+\./gmu)].length;
}

function readConfigValue(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*["']([^"']*)["']`));
  return match ? match[1].trim() : "";
}

async function readText(file) {
  return readFile(new URL(file, root), "utf8");
}

async function fileHash(file) {
  return createHash("sha256").update(await readText(file)).digest("hex");
}

async function exists(file) {
  try {
    await stat(new URL(file, root));
    return true;
  } catch {
    return false;
  }
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (key === "--write") {
      if (!value || value.startsWith("--")) {
        throw new Error("缺少参数值：--write");
      }
      values.write = value;
      index += 1;
      continue;
    }
    if (key === "--tests-passed") {
      values.testsPassed = true;
      continue;
    }
    if (key === "--static-check-passed") {
      values.staticCheckPassed = true;
      continue;
    }
    if (key === "--no-fail") {
      values.noFail = true;
      continue;
    }
    throw new Error(`无法识别参数：${key}`);
  }
  return values;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const status = await buildAutoRevenueStatus({
      testsPassed: args.testsPassed,
      staticCheckPassed: args.staticCheckPassed
    });
    const markdown = renderAutoRevenueStatusMarkdown(status);
    if (args.write) {
      await writeFile(new URL(args.write, root), markdown, "utf8");
      console.log(`自动赚钱状态已写入：${args.write}`);
    } else {
      console.log(markdown.trimEnd());
    }
    if (!status.canSell && !args.noFail) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
