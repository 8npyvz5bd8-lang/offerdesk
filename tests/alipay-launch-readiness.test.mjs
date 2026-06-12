import assert from "node:assert/strict";
import {
  buildAlipayLaunchReadiness,
  parseArgs,
  renderAlipayLaunchReadinessMarkdown
} from "../scripts/alipay-launch-readiness.mjs";

const failingReport = {
  passed: 5,
  failed: 4,
  checks: [
    { name: "ALIPAY_APP_ID", pass: false, fix: "填写支付宝开放平台应用 ID。" },
    { name: "ALIPAY_PRIVATE_KEY", pass: false, fix: "填写支付宝应用私钥。" },
    { name: "ALIPAY_PUBLIC_KEY", pass: false, fix: "填写支付宝公钥。" },
    { name: "OFFERDESK_PUBLIC_BASE_URL", pass: false, fix: "填写公网支付服务地址。" },
    { name: "OFFERDESK_AMOUNT", pass: true, fix: "" }
  ]
};

const failingReadiness = await buildAlipayLaunchReadiness({
  envFile: "secrets/demo.env",
  envReport: failingReport,
  configText: configText("")
});
assert.equal(failingReadiness.stage, "补支付宝商家参数");
assert.equal(failingReadiness.canCreateAutoOrder, false);
assert.deepEqual(
  failingReadiness.missing.map((item) => item.name),
  ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "OFFERDESK_PUBLIC_BASE_URL"]
);

const failingMarkdown = renderAlipayLaunchReadinessMarkdown(
  failingReadiness,
  new Date("2026-06-12T00:00:00")
);
assert.ok(failingMarkdown.includes("当前阶段：补支付宝商家参数"));
assert.ok(failingMarkdown.includes("通过：5"));
assert.ok(failingMarkdown.includes("失败：4"));
assert.ok(failingMarkdown.includes("ALIPAY_PRIVATE_KEY"));
assert.ok(!failingMarkdown.includes("SECRET_PRIVATE_KEY_VALUE"));

const readyReport = {
  passed: 9,
  failed: 0,
  checks: [
    { name: "ALIPAY_APP_ID", pass: true, fix: "" },
    { name: "ALIPAY_PRIVATE_KEY", pass: true, fix: "" },
    { name: "ALIPAY_PUBLIC_KEY", pass: true, fix: "" }
  ]
};

const deployReadiness = await buildAlipayLaunchReadiness({
  envReport: readyReport,
  configText: configText("")
});
assert.equal(deployReadiness.stage, "部署自动收款服务");
assert.equal(deployReadiness.canCreateAutoOrder, false);

const connectedReadiness = await buildAlipayLaunchReadiness({
  envReport: readyReport,
  configText: configText("https://pay.offerdesk.cn"),
  apiBase: "https://pay.offerdesk.cn"
});
assert.equal(connectedReadiness.stage, "创建测试订单并做真实付款验收");
assert.equal(connectedReadiness.canCreateAutoOrder, true);
assert.ok(connectedReadiness.commands[1].includes("finalize-alipay-launch.mjs"));

assert.deepEqual(parseArgs([
  "--env-file",
  "secrets/demo.env",
  "--api-base",
  "https://pay.example.com",
  "--write",
  "launch/readiness.md",
  "--no-fail"
]), {
  envFile: "secrets/demo.env",
  config: undefined,
  apiBase: "https://pay.example.com",
  write: "launch/readiness.md",
  noFail: true
});

function configText(apiBase) {
  return `window.OFFERDESK_CONFIG = {
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
  autoCheckoutUrl: "",
  autoPaymentApiBase: "${apiBase}",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseProvider: "signed",
  lemonSqueezyProductId: "",
  lemonSqueezyVariantId: "",
  licensePublicKey: {"kty":"EC","crv":"P-256","x":"abc","y":"def"},
  supportEmail: "534403209@qq.com"
};`;
}

console.log("alipay launch readiness tests passed");
