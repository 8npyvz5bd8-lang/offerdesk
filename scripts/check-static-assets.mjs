import { access, readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const pages = [
  "index.html",
  "sales.html",
  "share.html",
  "promotion.html",
  "pipeline.html",
  "buy.html",
  "pay.html",
  "after-pay.html",
  "privacy.html",
  "terms.html",
  "refund.html",
  "launch/social-posters.html"
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = await checkStaticAssets();
  if (failures.length > 0) {
    process.exit(1);
  }
}

export async function checkStaticAssets() {
  const failures = [];

  for (const page of pages) {
    const html = await readFile(page, "utf8");
    const refs = extractLocalRefs(html);

    for (const ref of refs) {
      const path = normalize(join(dirname(page), ref));
      try {
        await access(path);
        report("OK", page, ref);
      } catch {
        failures.push({ page, ref });
        report("FAIL", page, ref);
      }
    }
  }

  console.log("");
  if (failures.length > 0) {
    console.log(`静态页面体检失败：${failures.length}`);
  } else {
    console.log("静态页面体检通过");
  }

  return failures;
}

export function extractLocalRefs(html) {
  const refs = new Set();
  const patterns = [
    /\s(?:href|src)=["']([^"']+)["']/g,
    /\ssrcset=["']([^"']+)["']/g
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      for (const ref of splitSrcSet(match[1])) {
        const cleanRef = cleanLocalRef(ref);
        if (cleanRef) {
          refs.add(cleanRef);
        }
      }
    }
  }

  return [...refs].sort();
}

function splitSrcSet(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function cleanLocalRef(value) {
  const ref = String(value || "").trim();
  if (
    !ref ||
    ref.startsWith("#") ||
    ref.startsWith("mailto:") ||
    ref.startsWith("tel:") ||
    ref.startsWith("http://") ||
    ref.startsWith("https://") ||
    ref.startsWith("data:")
  ) {
    return "";
  }

  return ref.split("#")[0].split("?")[0].replace(/^\.\//, "");
}

function report(status, page, ref) {
  console.log(`${status} ${page} -> ${ref}`);
}
