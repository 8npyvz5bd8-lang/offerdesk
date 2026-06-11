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
https://8npyvz5bd8-lang.github.io/offerdesk/
```

当前销售页：

```text
https://8npyvz5bd8-lang.github.io/offerdesk/sales.html
```

当前付款页：

```text
https://8npyvz5bd8-lang.github.io/offerdesk/pay.html
```

当前已改成“唯一签名授权码”。还缺支付宝商家自动收款服务地址和一次真实付款验收，所以只能说“已上架、可备用收款”，不能说“已完成全自动售卖闭环”。

生成授权公私钥：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/generate-license-keypair.mjs
```

私钥留在 `secrets/`，不要上传。公钥写入 `app-config.js` 的 `licensePublicKey`。

收到支付宝付款后，运行这一条完成交付：生成唯一授权码、生成回复邮件、记录到销售表。

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/fulfill-manual-order.mjs \
  --email "buyer@example.com" \
  --paid-at "2026-06-11 18:20" \
  --amount "29" \
  --channel "manual-alipay" \
  --name "买家昵称" \
  --note "支付宝备注"
```

输出会放在 `dist/manual-orders/`。这里有明文授权码，不要上传。

只想单独生成唯一授权码：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/issue-signed-license.mjs \
  --email "buyer@example.com" \
  --order-id "OD-20260611190000-ABCD1234EF567890ABCD"
```

全自动收款说明：

```text
launch/alipay-auto-payment.md
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
2. 当前可以用支付宝收款码和付款页备用收款。
3. 开通支付宝商家接口后部署 `scripts/alipay-payment-server.mjs`。
4. 确认收到付款通知。
5. 收到付款后运行 `scripts/fulfill-manual-order.mjs`。
6. 把 `dist/manual-orders/` 里的回复邮件内容发给买家。
7. 确认买家能用授权码去掉水印并保存 PDF。
8. 填写 `launch/release-acceptance.md`。

正式发布时按这份手册执行：

```text
launch/final-release-runbook.md
```
