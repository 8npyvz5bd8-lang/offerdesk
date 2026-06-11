import assert from "node:assert/strict";
import { buildAutoRevenueStatus, renderAutoRevenueStatusMarkdown } from "../scripts/auto-revenue-status.mjs";

const status = await buildAutoRevenueStatus({
  env: {},
  testsPassed: true,
  staticCheckPassed: true
});

assert.equal(status.planStepCount, 30);
assert.equal(status.canSell, false);
assert.equal(status.releaseStage, "待部署支付宝自动收款服务");
assert.ok(status.completed > 0);
assert.ok(status.blocked > 0);
assert.equal(status.steps.find((item) => item.number === 5).status, "done");
assert.equal(status.steps.find((item) => item.number === 6).status, "done");
assert.equal(status.steps.find((item) => item.number === 9).status, "blocked");
assert.equal(status.steps.find((item) => item.number === 14).status, "blocked");
assert.equal(status.steps.find((item) => item.number === 29).status, "needs_manual");

const markdown = renderAutoRevenueStatusMarkdown(status, new Date("2026-06-12T00:00:00"));
assert.ok(markdown.includes("# OfferDesk 自动赚钱执行状态"));
assert.ok(markdown.includes("文档步骤数：30"));
assert.ok(markdown.includes("9. 准备支付宝商家参数"));
assert.ok(markdown.includes("状态：被阻塞"));

console.log("auto revenue status tests passed");
