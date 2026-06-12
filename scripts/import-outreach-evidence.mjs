import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv, validateOutreach } from "./validate-outreach.mjs";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

const salesHeader = [
  "date",
  "channel",
  "person",
  "role",
  "contact",
  "trial_sent",
  "used_once",
  "payment_status",
  "paid_at",
  "order_id",
  "source",
  "amount",
  "buyer_email",
  "license_sent",
  "feedback",
  "next_action"
];

const promotionHeader = ["date", "channel", "url", "title", "status", "note"];

export async function importOutreachEvidence(options) {
  const tracker = resolvePath(options.tracker || "launch/sales-tracker.csv");
  const promotionLog = resolvePath(options.promotionLog || "launch/promotion-log.csv");
  let importedSales = 0;
  let importedPromotions = 0;

  if (options.salesText) {
    importedSales = await importCsv({
      target: tracker,
      header: salesHeader,
      sourceRows: validateSalesRows(parseCsv(options.salesText)),
      dedupeKey: salesDedupeKey
    });
  }

  if (options.promotionText) {
    importedPromotions = await importCsv({
      target: promotionLog,
      header: promotionHeader,
      sourceRows: validatePromotionRows(parseCsv(options.promotionText)),
      dedupeKey: promotionDedupeKey
    });
  }

  if (!options.salesText && !options.promotionText) {
    throw new Error("没有可导入的获客证据。");
  }

  const report = await validateOutreach({
    tracker,
    promotionLog
  });

  return {
    importedSales,
    importedPromotions,
    report
  };
}

export async function parseArgs(args, stdinText = "") {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--sales-stdin" || key === "--promotion-stdin") {
      values[key.slice(2)] = true;
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
    salesText: values["sales-file"] ? await readInput(values["sales-file"]) : values["sales-stdin"] ? stdinText : "",
    promotionText: values["promotion-file"] ? await readInput(values["promotion-file"]) : values["promotion-stdin"] ? stdinText : "",
    tracker: values.tracker,
    promotionLog: values["promotion-log"]
  };
}

async function importCsv({ target, header, sourceRows, dedupeKey }) {
  if (sourceRows.length === 0) {
    return 0;
  }

  const existingRows = await readExistingRows(target);
  const keys = new Set(existingRows.map(dedupeKey));
  const rows = [...existingRows];
  let imported = 0;

  for (const row of sourceRows) {
    const key = dedupeKey(row);
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    rows.push(row);
    imported += 1;
  }

  await writeFile(target, toCsv(header, rows), "utf8");
  return imported;
}

async function readExistingRows(target) {
  try {
    return parseCsv(await readFile(target, "utf8"));
  } catch {
    return [];
  }
}

function validateSalesRows(rows) {
  return rows.filter(hasAnyValue).map((row, index) => {
    assertReal(row.channel, `第 ${index + 1} 条潜在买家的渠道`);
    assertReal(row.person, `第 ${index + 1} 条潜在买家的对象`);
    assertReal(row.role, `第 ${index + 1} 条潜在买家的角色`);
    assertReal(row.contact, `第 ${index + 1} 条潜在买家的联系方式`);
    return normalizeRow(salesHeader, row);
  });
}

function validatePromotionRows(rows) {
  return rows.filter((row) => hasAnyValue(row) && isPublishedStatus(row.status)).map((row, index) => {
    assertReal(row.channel, `第 ${index + 1} 条推广记录的渠道`);
    assertUrl(row.url, `第 ${index + 1} 条推广记录的发布链接`);
    assertReal(row.status, `第 ${index + 1} 条推广记录的状态`);
    return normalizeRow(promotionHeader, row);
  });
}

function normalizeRow(header, row) {
  return Object.fromEntries(header.map((key) => [key, row[key] || ""]));
}

function hasAnyValue(row) {
  return Object.values(row).some((value) => String(value || "").trim());
}

function assertReal(value, name) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  if (
    !text ||
    lower.includes("example") ||
    lower.includes("your-") ||
    text.includes("你的") ||
    text.includes("姓名/账号") ||
    text.includes("买家邮箱")
  ) {
    throw new Error(`${name}不是真实值。`);
  }
}

function assertUrl(value, name) {
  assertReal(value, name);
  if (!/^https?:\/\/.+/u.test(String(value || "").trim())) {
    throw new Error(`${name}必须是 http 或 https 链接。`);
  }
}

function isPublishedStatus(value) {
  return /^(已发布|published|posted|live|是|通过|yes)$/iu.test(String(value || "").trim());
}

function salesDedupeKey(row) {
  const orderId = String(row.order_id || "").trim().toLowerCase();
  if (orderId) {
    return `order|${orderId}`;
  }
  return [
    row.channel,
    row.person,
    row.contact
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function promotionDedupeKey(row) {
  return String(row.url || "").trim().toLowerCase();
}

function toCsv(header, rows) {
  return `${[header, ...rows.map((row) => header.map((key) => row[key] || ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

async function readInput(file) {
  return readFile(resolvePath(file), "utf8");
}

function resolvePath(file) {
  const text = String(file || "").trim();
  if (!text) {
    throw new Error("缺少文件路径。");
  }
  return isAbsolute(text) ? text : resolve(rootPath, text);
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }
  return new Promise((resolveText, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolveText(text));
    process.stdin.on("error", reject);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = await parseArgs(process.argv.slice(2), await readStdin());
    const result = await importOutreachEvidence(options);
    console.log(`导入潜在买家：${result.importedSales}`);
    console.log(`导入推广记录：${result.importedPromotions}`);
    console.log(`当前潜在买家：${result.report.prospects}`);
    console.log(`当前已发布渠道：${result.report.publishedChannels}`);
    console.log(`当前真实付款：${result.report.paid}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
