import assert from "node:assert/strict";
import {
  buildManualFulfillmentCommand,
  parsePaymentClaimText
} from "../src/payment-claim.js";

const claimText = `
我已支付 OfferDesk 专业版 29 元，请发送授权码。

付款时间：2026-06-12 18:20
付款金额：29 元
订单号：OD-MANUAL-20260612182000-ABC12345
我的邮箱：Buyer@Example.COM
支付宝昵称或备注：老陈设计
来源：xianyu

其他说明：请发到这个邮箱

软件地址：https://8npyvz5bd8-lang.github.io/offerdesk/
`;

const claim = parsePaymentClaimText(claimText);
assert.deepEqual(claim, {
  email: "Buyer@Example.COM",
  orderId: "OD-MANUAL-20260612182000-ABC12345",
  amount: "29",
  paidAt: "2026-06-12 18:20",
  name: "老陈设计",
  source: "xianyu",
  note: "支付宝备注：老陈设计；来源：xianyu；其他说明：请发到这个邮箱"
});

assert.equal(parsePaymentClaimText(`
订单号：OD-MANUAL-20260612182000-ABC12345
付款金额：29 元
联系方式：buyer2@example.com
`).email, "buyer2@example.com");

assert.throws(() => parsePaymentClaimText("我的邮箱：buyer@example.com"), /订单号/u);
assert.throws(() => parsePaymentClaimText("订单号：OD-MANUAL-1"), /邮箱/u);

const command = buildManualFulfillmentCommand(claim, {
  nodePath: "node",
  channel: "manual-test"
});

assert.ok(command.includes("scripts/fulfill-manual-order.mjs"));
assert.ok(command.includes("--order-id"));
assert.ok(command.includes("OD-MANUAL-20260612182000-ABC12345"));
assert.ok(command.includes("--email"));
assert.ok(command.includes("Buyer@Example.COM"));
assert.ok(command.includes("--channel"));
assert.ok(command.includes("manual-test"));
assert.ok(command.includes("--source"));
assert.ok(command.includes("xianyu"));
assert.ok(!command.includes("\n+"));

console.log("payment claim tests passed");
