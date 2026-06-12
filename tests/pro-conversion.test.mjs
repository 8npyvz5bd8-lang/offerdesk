import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const stylesCss = await readFile(new URL("../styles.css", import.meta.url), "utf8");

assert.ok(indexHtml.includes('id="unlockPitch"'));
assert.ok(indexHtml.includes('id="trialPrintButton"'));
assert.ok(indexHtml.includes("继续带水印导出"));

assert.ok(appJs.includes("function handlePrintQuote()"));
assert.ok(appJs.includes("function handleCopyQuoteText()"));
assert.ok(appJs.includes('promptForProDelivery("print")'));
assert.ok(appJs.includes('promptForProDelivery("copy")'));
assert.ok(appJs.includes("disabled-link"));
assert.ok(appJs.includes("trialPrintButton.addEventListener"));

assert.ok(stylesCss.includes(".disabled-link"));

console.log("pro conversion tests passed");
