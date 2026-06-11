# 上架检查清单

## 已完成

- 软件雏形可运行。
- 核心报价计算已实现。
- 免费版水印已实现。
- 专业版授权入口已实现。
- 上架文案已准备。
- 产品截图已准备。
- 隐私、条款、退款页面已准备。
- 买家交付说明和付款后邮件生成工具已准备。
- 产品页填写内容已准备。
- 收款平台填写指南已准备。
- 首批获客文案和销售记录表已准备。
- 最终发布执行手册已准备。
- 真实发布验收记录模板已准备。
- 支付宝收款码已接入。
- 唯一签名授权码已实现。

## 上架前必须补齐

- 确认支付宝收款码能真实收款。
- 运行当前上架状态诊断：`node scripts/release-status.mjs`。
- 开通支付宝官方商家扫码支付接口。
- 用 `scripts/validate-alipay-env.mjs` 预检支付宝部署环境变量。
- 按 `launch/alipay-auto-payment.md` 部署自动收款服务。
- 用 `scripts/validate-alipay-service.mjs` 验收健康检查、创建订单和订单状态接口。
- 用 `scripts/connect-alipay-service.mjs` 检查支付服务并写入 `app-config.js`。
- 四项信息齐全后，可用 `node scripts/prepare-release.mjs` 一键准备发布。
- 用 `scripts/write-config.mjs` 生成 `app-config.js`。
- 用 `scripts/create-delivery-email.mjs` 生成付款后邮件。
- 运行发布前检查：`node scripts/validate-release.mjs`。
- 运行正式打包：`node scripts/build-release.mjs`。
- 如需上传压缩包，运行：`node scripts/build-upload-zip.mjs`。
- 检查发布包没有明文授权码：`node scripts/check-license-leak.mjs`。
- 用真实收款方式测试一次付款和解锁流程。
- 填写 `launch/release-acceptance.md`。
- 运行真实发布验收：`node scripts/validate-acceptance.mjs`。

## 推荐发布路径

1. 用 Vercel、Netlify 或 Cloudflare Pages 发布静态网页。
2. 当前先用支付宝收款码收款。
3. 运行 `scripts/release-status.mjs` 看真实缺口。
4. 用 `scripts/prepare-release.mjs` 一键生成配置、付款后邮件、发布包和上传压缩包。
5. 如果不用一键命令，再分别运行 `scripts/write-config.mjs` 和 `scripts/create-delivery-email.mjs`。
6. 确认每个订单生成的授权码都不同。
7. 跑发布前检查。
8. 生成正式发布包或上传压缩包。
9. 检查发布包没有明文授权码。
10. 真实付款后跑发布验收。
11. 截图上传到产品页。
12. 在小红书、即刻、微信群、自由职业者社群发布首批测试。

## 已核对的官方入口

- Stripe Payment Links: https://docs.stripe.com/payment-links
- Lemon Squeezy Checkout: https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- Gumroad 添加产品: https://gumroad.com/help/article/149-adding-a-product
- Vercel 部署: https://vercel.com/docs/deployments

## 不能假装完成的事

授权码、客服邮箱、真实付款验收没完成前，这个产品还不能公开售卖。

发布前检查如果失败，说明还没到能上架收钱的状态。
