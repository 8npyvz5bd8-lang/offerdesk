import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { validateOutreach } from "./validate-outreach.mjs";

const root = new URL("../", import.meta.url);
const defaultTracker = "launch/sales-tracker.csv";
const defaultPromotionLog = "launch/promotion-log.csv";
const defaultMinProspects = 10;
const defaultMinPublishedChannels = 3;

export async function buildOutreachReadiness(options = {}) {
  const tracker = options.tracker || defaultTracker;
  const promotionLog = options.promotionLog || defaultPromotionLog;
  const minProspects = Number(options.minProspects || defaultMinProspects);
  const minPublishedChannels = Number(options.minPublishedChannels || defaultMinPublishedChannels);
  const report = options.report || await validateOutreach({
    tracker,
    promotionLog,
    minProspects,
    minPublishedChannels
  });

  const missingProspects = Math.max(0, minProspects - report.prospects);
  const missingChannels = Math.max(0, minPublishedChannels - report.publishedChannels);
  const missingPayments = report.paid > 0 && report.revenue > 0 ? 0 : 1;

  return {
    tracker,
    promotionLog,
    minProspects,
    minPublishedChannels,
    stage: stageName({ missingProspects, missingChannels, missingPayments }),
    canReviewMoney: report.readyForReview,
    report,
    gaps: {
      missingProspects,
      missingChannels,
      missingPayments
    },
    nextActions: nextActions({ missingProspects, missingChannels, missingPayments }),
    commands: commandList({ tracker, promotionLog })
  };
}

export function renderOutreachReadinessMarkdown(readiness, now = new Date()) {
  const lines = [
    "# OfferDesk 获客上线清单",
    "",
    `生成时间：${formatDateTime(now)}`,
    "",
    `当前阶段：${readiness.stage}`,
    `可以复盘真实赚钱：${readiness.canReviewMoney ? "是" : "否"}`,
    "",
    "## 当前证据",
    "",
    `潜在买家：${readiness.report.prospects}/${readiness.minProspects}`,
    `已联系：${readiness.report.contacted}`,
    `已发试用：${readiness.report.trials}`,
    `已试用：${readiness.report.usedOnce}`,
    `愿意付费：${readiness.report.interested}`,
    `已发布渠道：${readiness.report.publishedChannels}/${readiness.minPublishedChannels}`,
    `已付款：${readiness.report.paid}`,
    `收入：¥${Number(readiness.report.revenue || 0).toFixed(2)}`,
    "",
    "## 缺口",
    "",
    `- 还差真实潜在买家：${readiness.gaps.missingProspects} 个`,
    `- 还差真实发布渠道：${readiness.gaps.missingChannels} 个`,
    `- 还差真实付款记录：${readiness.gaps.missingPayments} 笔`,
    "",
    "## 下一步",
    ""
  ];

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
  lines.push("- 真实接单人的姓名、账号或联系方式。");
  lines.push("- 真实发布后的链接。");
  lines.push("- 买家真实付款和收入。");
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
    tracker: values.tracker,
    promotionLog: values["promotion-log"],
    minProspects: values["min-prospects"] ? Number(values["min-prospects"]) : undefined,
    minPublishedChannels: values["min-published-channels"] ? Number(values["min-published-channels"]) : undefined,
    write: values.write,
    noFail: values.noFail === true
  };
}

function stageName({ missingProspects, missingChannels, missingPayments }) {
  if (missingChannels > 0) {
    return "先发布真实推广";
  }
  if (missingProspects > 0) {
    return "补真实潜在买家";
  }
  if (missingPayments > 0) {
    return "跟进试用到付款";
  }
  return "复盘真实收入";
}

function nextActions({ missingProspects, missingChannels, missingPayments }) {
  if (missingChannels > 0) {
    return [
      `先补 ${missingChannels} 个真实发布渠道，优先闲鱼、小红书、朋友圈。`,
      "打开 promotion.html，填真实发布链接，下载 CSV。",
      "运行导入命令，把真实发布证据写入 launch/promotion-log.csv。"
    ];
  }
  if (missingProspects > 0) {
    return [
      `再联系 ${missingProspects} 个真实接单人，不填占位名字。`,
      "打开 pipeline.html，记录真实联系方式、是否试用和下一步。",
      "下载 CSV 后运行导入命令，把线索写入 launch/sales-tracker.csv。"
    ];
  }
  if (missingPayments > 0) {
    return [
      "跟进已试用和愿意付费的人，发成交页链接。",
      "收到真实付款后，先确认到账，再运行发码命令。",
      "把付款金额、买家邮箱和授权状态写入 sales-tracker.csv。"
    ];
  }
  return [
    "整理 7 天内每个渠道的试用、付款和反馈。",
    "保留真实付款证据和退款风险。",
    "再决定继续推广、改产品，还是换方向。"
  ];
}

function commandList({ tracker, promotionLog }) {
  const node = process.execPath;
  return [
    `${node} scripts/import-outreach-evidence.mjs --promotion-file "/Users/chenzhifeng/Downloads/offerdesk-promotions.csv"`,
    `${node} scripts/import-outreach-evidence.mjs --sales-file "/Users/chenzhifeng/Downloads/offerdesk-sales.csv"`,
    `${node} scripts/validate-outreach.mjs --tracker "${tracker}" --promotion-log "${promotionLog}"`,
    `${node} scripts/outreach-readiness.mjs --write launch/outreach-readiness.md --no-fail`
  ];
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const readiness = await buildOutreachReadiness(args);
    const markdown = renderOutreachReadinessMarkdown(readiness);
    if (args.write) {
      await writeFile(new URL(args.write, root), markdown, "utf8");
      console.log(`获客上线清单已写入：${args.write}`);
    } else {
      console.log(markdown.trimEnd());
    }
    if (!readiness.canReviewMoney && !args.noFail) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
