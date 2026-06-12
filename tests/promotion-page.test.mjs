import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../promotion.html", import.meta.url), "utf8");

assert.ok(html.includes("offerdesk-promotion-log-v1"));
assert.ok(html.includes("launch/promotion-log.csv"));
assert.ok(html.includes("date\", \"channel\", \"url\", \"title\", \"status\", \"note"));
assert.ok(html.includes("./site.css"));
assert.ok(html.includes("./pipeline.html"));

console.log("promotion page tests passed");
