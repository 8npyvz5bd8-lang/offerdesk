import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const defaultTracker = "launch/sales-tracker.csv";
const defaultPromotionLog = "launch/promotion-log.csv";
const paidStatuses = new Set(["已付款", "已发授权", "paid", "TRADE_SUCCESS", "TRADE_FINISHED"]);
const interestedStatuses = new Set(["愿意付费", "已付款", "已发授权", "interested", "paid"]);

export async function validateOutreach(options = {}) {
  const trackerText = await readText(options.tracker || defaultTracker);
  const promotionText = await readText(options.promotionLog || defaultPromotionLog);
  return buildOutreachReport({
    leads: parseCsv(trackerText),
    promotions: parseCsv(promotionText),
    minProspects: options.minProspects || 10,
    minPublishedChannels: options.minPublishedChannels || 3
  });
}

export function buildOutreachReport({ leads, promotions, minProspects = 10, minPublishedChannels = 3 }) {
  const realLeads = leads.filter(isRealLead);
  const contacted = realLeads.filter((lead) => hasRealValue(lead.contact)).length;
  const trials = realLeads.filter((lead) => isYes(lead.trial_sent)).length;
  const usedOnce = realLeads.filter((lead) => isYes(lead.used_once)).length;
  const interested = realLeads.filter((lead) => interestedStatuses.has(String(lead.payment_status || "").trim())).length;
  const paidRows = realLeads.filter(isPaidLead);
  const revenue = paidRows.reduce((sum, lead) => sum + Number(lead.amount || 0), 0);
  const publishedPromotions = promotions.filter(isPublishedPromotion);
  const publishedChannels = new Set(publishedPromotions.map((item) => normalizeChannel(item.channel)));

  const checks = [
    {
      name: "真实潜在买家",
      pass: realLeads.length >= minProspects,
      evidence: `${realLeads.length}/${minProspects} 个真实潜在买家`,
      fix: "把 10 个真实接单人写入 launch/sales-tracker.csv。"
    },
    {
      name: "推广发布证据",
      pass: publishedChannels.size >= minPublishedChannels,
      evidence: `${publishedChannels.size}/${minPublishedChannels} 个渠道有已发布链接`,
      fix: "把闲鱼、小红书、朋友圈或其他真实发布链接写入 launch/promotion-log.csv。"
    },
    {
      name: "真实付款记录",
      pass: paidRows.length > 0 && revenue > 0,
      evidence: `${paidRows.length} 笔付款，收入 ${formatMoney(revenue)}`,
      fix: "收到真实付款后写入 launch/sales-tracker.csv。"
    }
  ];

  return {
    prospects: realLeads.length,
    contacted,
    trials,
    usedOnce,
    interested,
    paid: paidRows.length,
    revenue,
    publishedPromotions: publishedPromotions.length,
    publishedChannels: publishedChannels.size,
    checks,
    readyForReview: checks.every((item) => item.pass)
  };
}

export function parseCsv(text) {
  const rows = parseCsvRows(text);
  const header = rows.shift() || [];
  return rows
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] || ""])));
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
    tracker: values.tracker,
    promotionLog: values["promotion-log"],
    minProspects: values["min-prospects"] ? Number(values["min-prospects"]) : undefined,
    minPublishedChannels: values["min-published-channels"] ? Number(values["min-published-channels"]) : undefined
  };
}

export function printOutreachReport(report) {
  console.log("OfferDesk 获客证据检查");
  console.log(`潜在买家：${report.prospects}`);
  console.log(`已联系：${report.contacted}`);
  console.log(`已发试用：${report.trials}`);
  console.log(`已试用：${report.usedOnce}`);
  console.log(`愿意付费：${report.interested}`);
  console.log(`已付款：${report.paid}`);
  console.log(`收入：${formatMoney(report.revenue)}`);
  console.log(`已发布渠道：${report.publishedChannels}`);
  console.log("");

  for (const item of report.checks) {
    console.log(`${item.pass ? "OK" : "FAIL"} ${item.name}`);
    console.log(`  证据：${item.evidence}`);
    if (!item.pass) {
      console.log(`  处理：${item.fix}`);
    }
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function isRealLead(lead) {
  return hasRealValue(lead.channel) &&
    hasRealValue(lead.person) &&
    hasRealValue(lead.role) &&
    hasRealValue(lead.contact);
}

function isPublishedPromotion(item) {
  return hasRealValue(item.channel) &&
    hasRealValue(item.url) &&
    /^https?:\/\/.+/u.test(String(item.url || "").trim()) &&
    isPublishedStatus(item.status);
}

function isPaidLead(lead) {
  return paidStatuses.has(String(lead.payment_status || "").trim()) &&
    Number(lead.amount || 0) > 0 &&
    hasRealValue(lead.buyer_email);
}

function isPublishedStatus(value) {
  return /^(已发布|published|posted|live|是|通过|yes)$/iu.test(String(value || "").trim());
}

function isYes(value) {
  return /^(yes|true|是|已发|已试用|通过|ok)$/iu.test(String(value || "").trim());
}

function hasRealValue(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  return Boolean(text) &&
    !lower.includes("example") &&
    !lower.includes("your-") &&
    !text.includes("你的") &&
    !text.includes("姓名/账号") &&
    !text.includes("买家邮箱");
}

function normalizeChannel(value) {
  return String(value || "").trim().toLowerCase();
}

function formatMoney(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

async function readText(file) {
  return readFile(new URL(file, root), "utf8");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await validateOutreach(parseArgs(process.argv.slice(2)));
    printOutreachReport(report);
    if (!report.readyForReview) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
