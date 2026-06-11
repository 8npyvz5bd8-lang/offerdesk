import assert from "node:assert/strict";
import {
  buildProfitAdvice,
  buildQuoteText,
  calculateQuote,
  formatPercent,
  formatMoney,
  importQuoteFromJsonText,
  normalizeQuote
} from "../src/pricing.js";

const quote = normalizeQuote({
  currency: "¥",
  taxRate: 10,
  discountRate: 20,
  depositRate: 50,
  targetMargin: 40,
  items: [
    { name: "A", quantity: 2, price: 1000, cost: 300 },
    { name: "B", quantity: 1, price: 500, cost: 100 }
  ]
});

const result = calculateQuote(quote);

assert.equal(result.subtotal, 2500);
assert.equal(result.discount, 500);
assert.equal(result.tax, 200);
assert.equal(result.total, 2200);
assert.equal(result.costTotal, 700);
assert.equal(result.profit, 1500);
assert.equal(result.deposit, 1100);
assert.equal(result.health.level, "good");
assert.equal(formatMoney(123456, "¥"), "¥123,456");
assert.equal(formatPercent(34.4), "34%");

const goodAdvice = buildProfitAdvice(quote);
assert.equal(goodAdvice.title, "当前报价达到目标");
assert.equal(goodAdvice.body.includes("目标利润率 40%"), true);

const lowAdvice = buildProfitAdvice({
  targetMargin: 80,
  items: [{ name: "低价服务", quantity: 1, price: 1000, cost: 800 }]
});
assert.equal(lowAdvice.title.includes("建议至少涨价"), true);
assert.equal(lowAdvice.body.includes("目标利润率 80%"), true);

const quoteText = buildQuoteText(quote);
assert.equal(quoteText.includes("报价项目："), true);
assert.equal(quoteText.includes("1. A × 2，单价 ¥1,000，金额 ¥2,000"), true);
assert.equal(quoteText.includes("总价：¥2,200"), true);
assert.equal(quoteText.includes("首付款：¥1,100"), true);
assert.equal(quoteText.includes("成本"), false);
assert.equal(quoteText.includes("建议至少涨价"), false);

const imported = importQuoteFromJsonText(JSON.stringify({
  sellerName: "导入工作室",
  clientName: "导入客户",
  projectName: "导入项目",
  items: [{ name: "导入服务", quantity: 1, price: 1200, cost: 200 }]
}));

assert.equal(imported.sellerName, "导入工作室");
assert.equal(imported.items[0].name, "导入服务");
assert.throws(() => importQuoteFromJsonText("not-json"), /有效 JSON/);
assert.throws(() => importQuoteFromJsonText(JSON.stringify({ items: [] })), /缺少报价项目/);

const empty = calculateQuote({ items: [] });
assert.equal(empty.quote.items.length > 0, true);
assert.equal(empty.total > 0, true);

console.log("pricing tests passed");
