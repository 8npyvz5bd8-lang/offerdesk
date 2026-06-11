# OfferDesk 报价单赚钱助手

OfferDesk 是一个静态网页软件，给自由职业者、小团队、设计师、开发者用来生成客户报价单，并检查利润率和首付款。

## 当前能做什么

- 编辑客户、项目、报价项目、成本、税费、折扣、首付款。
- 自动计算总价、预计利润、利润状态和首付款。
- 生成客户可读的报价单。
- 打印或保存为 PDF。
- 自动保存草稿到浏览器本地。
- 免费版显示水印，专业版可通过授权码去掉水印。

## 本地运行

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4173
```

然后打开：

```text
http://localhost:4173
```

自托管销售页：

```text
http://localhost:4173/sales.html
```

## 收款配置

当前已接入支付宝收款码：`launch/payment-alipay.jpeg`。

当前线上地址：

```text
https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/
```

当前付款页：

```text
https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/pay.html
```

授权码哈希、客服邮箱和付款后邮件已经配置。还缺一次真实付款验收，所以只能说“已上架、可收款”，不能说“已完成真实售卖闭环”。

优先用脚本生成 `app-config.js`：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/write-config.mjs \
  --payment-qr-image "./launch/payment-alipay.jpeg" \
  --license-code "你发给买家的授权码" \
  --support-email "你的客服邮箱"
```

脚本只会写入授权码哈希，不会把明文授权码保存进配置文件。

生成后的 `app-config.js` 应该类似这样：

```js
window.OFFERDESK_CONFIG = {
  checkoutUrl: "",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseHash: "授权码的 SHA-256 哈希",
  supportEmail: "你的客服邮箱"
};
```

只想单独生成授权码哈希时，运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/hash-license.mjs "你发给买家的授权码"
```

## 测试

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/pricing.test.mjs
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/license.test.mjs
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/templates.test.mjs
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/config-writer.test.mjs
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/release-report.test.mjs
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/static-assets.test.mjs
```

检查静态页面引用：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-static-assets.mjs
```

## 发布前检查

填入真实收款方式、授权码和客服邮箱后，运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-release.mjs
```

这个检查会故意阻止空收款方式、明文授权码和空客服邮箱。检查不过，不要上架。

## 正式发布包

真实收款方式、授权码哈希和客服邮箱都填好后，运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build-release.mjs
```

成功后会生成：

```text
dist/offerdesk-release
```

如果发布前检查失败，这个目录不会生成。

## 推荐上架方式

1. 当前已经发布到 GitHub Pages。
2. 当前可以用支付宝收款码和付款页收款。
3. 打开付款页完成一次真实付款。
4. 确认收到付款通知。
5. 把 `dist/post-purchase-email.txt` 的内容发给买家。
6. 确认买家能用授权码去掉水印并保存 PDF。
7. 填写 `launch/release-acceptance.md`。

正式发布时按这份手册执行：

```text
launch/final-release-runbook.md
```
