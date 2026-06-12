import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shareHtml = await readFile(new URL("../share.html", import.meta.url), "utf8");

assert.ok(shareHtml.includes("OfferDesk 首单推广复制页"));
assert.ok(shareHtml.includes("30 分钟首单包"));
assert.ok(shareHtml.includes("copy-fast-pack"));
assert.ok(shareHtml.includes("复制 30 分钟首单包"));
assert.ok(shareHtml.includes("./buy.html?source=fast-pack"));
assert.ok(shareHtml.includes("document.execCommand(\"copy\")"));
assert.ok(shareHtml.includes("内容已选中，请按复制键"));
assert.ok(shareHtml.includes("copy-xianyu"));
assert.ok(shareHtml.includes("copy-xhs"));
assert.ok(shareHtml.includes("copy-public"));
assert.ok(shareHtml.includes("copy-dm"));
assert.ok(shareHtml.includes("copy-pay"));
assert.ok(shareHtml.includes("copy-after"));
assert.ok(shareHtml.includes("sales.html?source=xianyu"));
assert.ok(shareHtml.includes("sales.html?source=xiaohongshu"));
assert.ok(shareHtml.includes("sales.html?source=friend-circle"));
assert.ok(shareHtml.includes("sales.html?source=direct-message"));
assert.ok(shareHtml.includes("buy.html?source=xianyu"));
assert.ok(shareHtml.includes("buy.html?source=xiaohongshu"));
assert.ok(shareHtml.includes("buy.html?source=friend-circle"));
assert.ok(shareHtml.includes("buy.html?source=direct-message"));
assert.ok(shareHtml.includes("buy.html?source=follow-up"));
assert.ok(shareHtml.includes("launch/social-posters.html?poster=cover"));
assert.ok(shareHtml.includes("./buy.html"));
assert.ok(shareHtml.includes("./after-pay.html"));
assert.ok(shareHtml.includes('<link rel="stylesheet" href="./site.css" />'));
assert.ok(shareHtml.includes("<strong>OfferDesk</strong>"));
assert.ok(shareHtml.includes('class="copy-grid"'));
assert.ok(shareHtml.includes('class="btn primary"'));
assert.ok(!shareHtml.includes('class="btn green"'));
assert.ok(!shareHtml.includes("border-radius: 999px"));
assert.ok(!shareHtml.includes('font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial'));

console.log("share page tests passed");
