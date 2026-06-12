import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const buyHtml = await readFile(new URL("../buy.html", import.meta.url), "utf8");
const afterPayHtml = await readFile(new URL("../after-pay.html", import.meta.url), "utf8");

assert.ok(buyHtml.includes("offerdesk.manual.order.id"));
assert.ok(buyHtml.includes("copyManualOrderButton"));
assert.ok(buyHtml.includes("manualOrderId"));
assert.ok(buyHtml.includes("getManualOrderId()"));
assert.ok(buyHtml.includes("after-pay.html?order_id="));

assert.ok(afterPayHtml.includes("incomingOrderId"));
assert.ok(afterPayHtml.includes("setStoredOrderId(incomingOrderId)"));
assert.ok(afterPayHtml.includes("offerdesk.manual.order.id"));

console.log("manual checkout flow tests passed");
