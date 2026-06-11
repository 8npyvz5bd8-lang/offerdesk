# 收款平台填写指南

这份指南用于配置收款方式。当前项目已接入支付宝收款码：`launch/payment-alipay.jpeg`。

支付宝收款码只能解决“收钱入口”，不能自动发授权码。付款后仍要用 `scripts/create-delivery-email.mjs` 生成邮件或手动发送授权码。

## 当前收款方式：支付宝收款码

配置方式：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/write-config.mjs \
  --payment-qr-image "./launch/payment-alipay.jpeg" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

配置后，销售页和解锁弹窗会显示支付宝收款码。

## 推荐优先级

1. 支付宝收款码：当前最快，但授权码需要手动发。
2. Gumroad：适合先验证有没有人愿意付费。
3. Lemon Squeezy：适合数字产品，能拿到产品 checkout URL。
4. Stripe Payment Links：适合已有 Stripe 账号的人。

## Gumroad

官方入口：https://gumroad.com/help/article/149-adding-a-product

填写方式：

- Product type：Digital product。
- Name：OfferDesk 报价单赚钱助手。
- Price：29 元或等值外币。
- Description：复制 `launch/product-page-fields.md` 的短介绍和详细介绍。
- Cover / media：上传 `launch/offerdesk-screenshot.jpg`。
- Content：放线上地址、授权码交付说明，或复制 `launch/buyer-guide.md`。
- After purchase email：复制 `scripts/create-delivery-email.mjs` 生成的内容。

拿到产品链接后，把它当作真实付款链接。

## Lemon Squeezy

官方入口：

- 添加产品：https://docs.lemonsqueezy.com/help/products/adding-products
- 分享产品：https://docs.lemonsqueezy.com/help/products/sharing-products

填写方式：

- Product name：OfferDesk 报价单赚钱助手。
- Product type：一次性购买。
- Price：29 元或等值外币。
- Description：复制 `launch/product-page-fields.md`。
- Product media：上传 `launch/offerdesk-screenshot.jpg`。
- Confirmation / email：放 `scripts/create-delivery-email.mjs` 生成的内容和 `launch/buyer-guide.md`。

发布产品后，在 Share 页面复制 checkout URL。这个 URL 就是 `checkoutUrl`。

## Stripe Payment Links

官方入口：https://docs.stripe.com/payment-links/create

填写方式：

- Product：OfferDesk 报价单赚钱助手。
- Price：一次性价格，29 元或等值外币。
- Payment page：开启需要的付款方式。
- After payment：显示线上地址和客服邮箱；授权码需要你通过邮件或手动发给买家。

创建后复制 Payment Link。这个链接就是 `checkoutUrl`。

## 写入项目配置

如果以后改用真实付款链接，运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/write-config.mjs \
  --checkout-url "真实付款链接" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

然后运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-release.mjs
```

必须失败数为 0，才能继续发布。

## 生成付款后邮件

部署完成后运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/create-delivery-email.mjs \
  --app-url "线上地址" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

把输出内容复制到收款平台的付款后邮件里。这个输出包含明文授权码，不要放进网页发布包。
