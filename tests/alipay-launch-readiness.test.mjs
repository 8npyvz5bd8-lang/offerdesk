import assert from "node:assert/strict";
import {
  buildAlipayLaunchReadiness,
  buildRenderEnvChecklist,
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
  configText: configText(""),
  renderText: renderText()
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
assert.ok(failingMarkdown.includes("## Render 环境变量填写表"));
assert.ok(failingMarkdown.includes("| ALIPAY_APP_ID | 需在 Render 手填 | 缺失或格式错误 | 填写支付宝开放平台应用 ID。 |"));
assert.ok(failingMarkdown.includes("| OFFERDESK_AMOUNT | 蓝图已固定 | 已通过 | 不用手填。 |"));
assert.ok(!failingMarkdown.includes("SECRET_PRIVATE_KEY_VALUE"));

await assert.rejects(
  () => buildAlipayLaunchReadiness({
    envFile: "secrets/demo.env",
    envReport: failingReport,
    configText: configText(""),
    renderFile: "missing-render.yaml"
  }),
  /ENOENT/
);

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
  configText: configText(""),
  renderText: renderText()
});
assert.equal(deployReadiness.stage, "部署自动收款服务");
assert.equal(deployReadiness.canCreateAutoOrder, false);

const connectedReadiness = await buildAlipayLaunchReadiness({
  envReport: readyReport,
  configText: configText("https://pay.offerdesk.cn"),
  apiBase: "https://pay.offerdesk.cn",
  renderText: renderText()
});
assert.equal(connectedReadiness.stage, "创建测试订单并做真实付款验收");
assert.equal(connectedReadiness.canCreateAutoOrder, true);
assert.ok(connectedReadiness.commands[1].includes("finalize-alipay-launch.mjs"));

const renderChecklist = buildRenderEnvChecklist({
  envReport: failingReport,
  renderText: renderText()
});
assert.equal(renderChecklist.missingKeys.length, 0);
assert.equal(renderChecklist.rows.find((row) => row.name === "ALIPAY_PUBLIC_KEY").renderStatus, "需在 Render 手填");
assert.equal(renderChecklist.rows.find((row) => row.name === "OFFERDESK_DATA_FILE").renderStatus, "蓝图已固定");
assert.equal(renderChecklist.rows.find((row) => row.name === "RESEND_API_KEY").action, "可先留空；需要自动邮件时再填。");
assert.equal(renderChecklist.rows.find((row) => row.name === "OFFERDESK_APP_URL").envStatus, "蓝图固定");

const missingRenderChecklist = buildRenderEnvChecklist({
  envReport: failingReport,
  renderText: "services:\n  - type: web\n    envVars:\n      - key: OFFERDESK_AMOUNT\n        value: \"29.00\"\n"
});
assert.ok(missingRenderChecklist.missingKeys.includes("ALIPAY_APP_ID"));

assert.deepEqual(parseArgs([
  "--env-file",
  "secrets/demo.env",
  "--render-file",
  "render.yaml",
  "--api-base",
  "https://pay.example.com",
  "--write",
  "launch/readiness.md",
  "--no-fail"
]), {
  envFile: "secrets/demo.env",
  config: undefined,
  renderFile: "render.yaml",
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

function renderText() {
  return `
services:
  - type: web
    envVars:
      - key: OFFERDESK_AMOUNT
        value: "29.00"
      - key: OFFERDESK_DATA_FILE
        value: "/data/orders.json"
      - key: OFFERDESK_ALLOWED_ORIGIN
        value: "https://8npyvz5bd8-lang.github.io"
      - key: ALIPAY_APP_ID
        sync: false
      - key: ALIPAY_PRIVATE_KEY
        sync: false
      - key: ALIPAY_PUBLIC_KEY
        sync: false
      - key: OFFERDESK_PUBLIC_BASE_URL
        sync: false
      - key: OFFERDESK_LICENSE_PRIVATE_JWK
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: OFFERDESK_EMAIL_FROM
        sync: false
      - key: OFFERDESK_APP_URL
        value: "https://8npyvz5bd8-lang.github.io/offerdesk/"
      - key: OFFERDESK_SUPPORT_EMAIL
        value: "534403209@qq.com"
`;
}

console.log("alipay launch readiness tests passed");
