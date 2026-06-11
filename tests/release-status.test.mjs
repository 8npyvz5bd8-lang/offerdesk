import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReleaseStatus } from "../scripts/release-status.mjs";

const templateAcceptance = await readFile(new URL("../launch/release-acceptance.md", import.meta.url), "utf8");
const emptyConfig = `window.OFFERDESK_CONFIG = {
  checkoutUrl: "",
  paymentQrImage: "",
  licenseHash: "",
  supportEmail: ""
};`;

const emptyStatus = buildReleaseStatus({
  configText: emptyConfig,
  acceptanceText: templateAcceptance,
  artifacts: {
    releaseDir: false,
    uploadZip: false,
    deliveryEmail: false
  }
});

assert.equal(emptyStatus.canSell, false);
assert.equal(emptyStatus.stage, "缺真实收款方式");
assert.ok(emptyStatus.nextStep.includes("真实收款方式"));

const qrOnlyStatus = buildReleaseStatus({
  configText: `window.OFFERDESK_CONFIG = {
  checkoutUrl: "",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseHash: "",
  supportEmail: ""
};`,
  acceptanceText: templateAcceptance,
  artifacts: {
    releaseDir: false,
    uploadZip: false,
    deliveryEmail: false
  }
});

assert.equal(qrOnlyStatus.canSell, false);
assert.equal(qrOnlyStatus.stage, "缺授权或客服配置");
assert.ok(qrOnlyStatus.nextStep.includes("授权码哈希"));

const completeAcceptance = `# 真实发布验收记录

## 基本信息

- 验收日期：2026-06-11
- 线上地址：https://offerdesk.app
- 收款平台：Gumroad
- 收款方式：支付宝收款码
- 客服邮箱：support@offerdesk.app
- 授权码是否已写入付款后邮件：是

## 发布前命令

- \`node scripts/validate-release.mjs\`：通过
- \`node scripts/build-release.mjs\`：通过

## 线上页面检查

- 首页能打开：是
- 报价能计算：是
- 隐私页能打开：是
- 条款页能打开：是
- 退款页能打开：是
- 购买入口能打开收款方式：是

## 真实付款检查

- 已完成一笔真实付款：是
- 已收到付款通知：是
- 已收到付款后邮件：是
- 邮件里的授权码正确：是
- 输入授权码后水印消失：是
- PDF 打印或保存正常：是

## 结果

- 是否可以正式公开售卖：是
- 发现的问题：无
- 下一步：公开售卖
`;

const completeStatus = buildReleaseStatus({
  configText: `window.OFFERDESK_CONFIG = {
  checkoutUrl: "https://pay.offerdesk.app/checkout",
  paymentQrImage: "",
  licenseHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  supportEmail: "support@offerdesk.app"
};`,
  acceptanceText: completeAcceptance,
  artifacts: {
    releaseDir: true,
    uploadZip: true,
    deliveryEmail: true
  }
});

assert.equal(completeStatus.canSell, true);
assert.equal(completeStatus.stage, "可以公开售卖");
assert.equal(completeStatus.nextStep, "可以公开售卖，并开始发首批获客内容。");

const missingEmailStatus = buildReleaseStatus({
  configText: `window.OFFERDESK_CONFIG = {
  checkoutUrl: "",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  supportEmail: "support@offerdesk.app"
};`,
  acceptanceText: templateAcceptance,
  artifacts: {
    releaseDir: true,
    uploadZip: true,
    deliveryEmail: false
  }
});

assert.equal(missingEmailStatus.canSell, false);
assert.equal(missingEmailStatus.stage, "待生成付款后邮件");
assert.ok(missingEmailStatus.nextStep.includes("真实线上地址"));

console.log("release status tests passed");
