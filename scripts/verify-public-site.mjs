import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const defaultBaseUrl = "https://8npyvz5bd8-lang.github.io/offerdesk/";
const defaultFiles = ["sales.html", "buy.html", "share.html", "pipeline.html", "share-copy.txt", "site.css", "app-config.js"];

export async function verifyPublicSite(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || defaultBaseUrl);
  const root = options.rootPath || rootPath;
  const fetchImpl = options.fetchImpl || fetch;
  const files = options.files || defaultFiles;
  const checkedAt = new Date().toISOString();
  const checks = [];

  for (const file of files) {
    checks.push(await verifyFile({ baseUrl, file, root, fetchImpl }));
  }

  return {
    checkedAt,
    baseUrl,
    files: checks,
    ok: checks.every((item) => item.ok)
  };
}

export function renderPublicSiteReport(report) {
  const passed = report.files.filter((item) => item.ok).length;
  const failed = report.files.length - passed;
  const lines = [
    "OfferDesk 线上页面校验",
    `地址：${report.baseUrl}`,
    `通过：${passed}`,
    `失败：${failed}`,
    ""
  ];

  for (const item of report.files) {
    lines.push(`${item.ok ? "OK" : "FAIL"} ${item.file}`);
    if (!item.ok) {
      lines.push(`  处理：${item.fix}`);
    }
  }

  return lines.join("\n");
}

export function parseArgs(args) {
  const values = { files: [] };
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
    if (key === "--file") {
      values.files.push(value);
    } else {
      values[key.slice(2)] = value;
    }
    index += 1;
  }

  return {
    baseUrl: values["base-url"],
    write: values.write,
    files: values.files.length > 0 ? values.files : undefined,
    noFail: values.noFail === true
  };
}

async function verifyFile({ baseUrl, file, root, fetchImpl }) {
  const localText = await readFile(resolve(root, file), "utf8");
  const localHash = sha256(localText);
  const url = new URL(file, baseUrl).href;

  try {
    const response = await fetchImpl(url, { headers: { Accept: "text/plain,*/*" } });
    const remoteText = await response.text();
    const remoteHash = sha256(remoteText);
    const ok = response.ok && remoteHash === localHash;
    return {
      file,
      url,
      status: response.status,
      ok,
      localHash,
      remoteHash,
      bytes: remoteText.length,
      fix: ok ? "" : failureFix(response.status, localHash, remoteHash)
    };
  } catch (error) {
    return {
      file,
      url,
      status: 0,
      ok: false,
      localHash,
      remoteHash: "",
      bytes: 0,
      fix: `线上请求失败：${error.message}`
    };
  }
}

function failureFix(status, localHash, remoteHash) {
  if (status < 200 || status >= 300) {
    return `线上返回 HTTP ${status}，检查 GitHub Pages 部署。`;
  }
  if (localHash !== remoteHash) {
    return "线上文件和本地不一致，等待 Pages 构建或重新推送。";
  }
  return "重新检查线上文件。";
}

function normalizeBaseUrl(value) {
  const text = String(value || "").trim();
  if (!/^https:\/\/.+/u.test(text)) {
    throw new Error("线上地址必须是 https。");
  }
  return text.endsWith("/") ? text : `${text}/`;
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await verifyPublicSite(args);
    if (args.write) {
      await writeFile(new URL(args.write, new URL("../", import.meta.url)), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
    console.log(renderPublicSiteReport(report));
    if (!report.ok && !args.noFail) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
