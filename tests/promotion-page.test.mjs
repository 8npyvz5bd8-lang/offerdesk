import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../promotion.html", import.meta.url), "utf8");
const pipelineHtml = await readFile(new URL("../pipeline.html", import.meta.url), "utf8");

assert.ok(html.includes("offerdesk-promotion-log-v1"));
assert.ok(html.includes("launch/promotion-log.csv"));
assert.ok(html.includes("date\", \"channel\", \"url\", \"title\", \"status\", \"note"));
assert.ok(html.includes("./site.css"));
assert.ok(html.includes("./pipeline.html"));
assert.ok(html.includes("copyReadinessCommand"));
assert.ok(html.includes("scripts/outreach-readiness.mjs"));
assert.ok(html.includes("launch/outreach-readiness.md"));

assert.ok(pipelineHtml.includes("offerdesk-first-sale-pipeline-v1"));
assert.ok(pipelineHtml.includes('<link rel="stylesheet" href="./site.css" />'));
assert.ok(pipelineHtml.includes("<strong>OfferDesk</strong>"));
assert.ok(pipelineHtml.includes('class="btn primary"'));
assert.ok(pipelineHtml.includes("copyReadinessCommand"));
assert.ok(pipelineHtml.includes("scripts/outreach-readiness.mjs"));
assert.ok(pipelineHtml.includes("launch/outreach-readiness.md"));
assert.ok(pipelineHtml.includes("order_id"));
assert.ok(pipelineHtml.includes("source"));
assert.ok(pipelineHtml.includes("--source"));
assert.ok(!pipelineHtml.includes("border-radius: 999px"));
assert.ok(!pipelineHtml.includes('font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial'));

console.log("promotion page tests passed");
