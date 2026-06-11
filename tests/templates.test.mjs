import assert from "node:assert/strict";
import { calculateQuote } from "../src/pricing.js";
import { getQuoteTemplate, quoteTemplates } from "../src/templates.js";

assert.equal(quoteTemplates.length >= 3, true);

const website = getQuoteTemplate("website");
assert.equal(website.projectName, "品牌官网设计与开发");
assert.equal(website.items.length, 3);
assert.equal(calculateQuote(website).total > 0, true);

const brand = getQuoteTemplate("brand");
brand.items[0].name = "已修改";
assert.notEqual(getQuoteTemplate("brand").items[0].name, "已修改");

assert.throws(() => getQuoteTemplate("missing"), /报价模板不存在/);

console.log("template tests passed");
