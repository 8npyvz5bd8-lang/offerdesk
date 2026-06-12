# 最终发布执行手册

这份手册只用于正式上架。没有真实收款方式、授权码和客服邮箱时，不要发布。

## 需要准备

- 一个真实收款方式。当前已接入：`launch/payment-alipay.jpeg`。
- 一个至少 8 位的授权码。
- 一个真实客服邮箱。
- 一个线上部署地址。

## 快速路径：一键准备发布

先看当前状态：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/release-status.mjs
```

再确认本地默认推送目标是 OfferDesk 正式仓库：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-git-remote.mjs
```

如果四项都已经准备好，可以直接运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/prepare-release.mjs \
  --payment-qr-image "./launch/payment-alipay.jpeg" \
  --app-url "线上地址" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

成功后会生成：

- `app-config.js`
- `dist/post-purchase-email.txt`
- `dist/offerdesk-release`
- `dist/offerdesk-release.zip`

`dist/post-purchase-email.txt` 包含明文授权码，只能复制到收款平台的付款后邮件里，不要上传到网页发布包。

一键命令会自动检查发布目录和压缩包里有没有明文授权码，发现就失败。

## 第一步：生成配置

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/write-config.mjs \
  --payment-qr-image "./launch/payment-alipay.jpeg" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

确认 `app-config.js` 里只有 `licenseHash`，没有明文授权码。

## 第二步：发布前检查

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-release.mjs
```

必须看到失败数为 0。

## 第三步：生成发布包

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build-release.mjs
```

成功后使用这个目录发布：

```text
dist/offerdesk-release
```

如果需要上传压缩包，再运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build-upload-zip.mjs
```

成功后使用这个文件：

```text
dist/offerdesk-release.zip
```

如果是分步发布，再手动检查一次授权码是否泄漏：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-license-leak.mjs \
  --license-code "发给买家的授权码" \
  --target dist/offerdesk-release \
  --target dist/offerdesk-release.zip
```

## 第四步：部署网页

把 `dist/offerdesk-release` 发布到 Vercel、Netlify 或 Cloudflare Pages。

部署后打开线上地址，确认首页、报价、隐私、条款、退款、收款入口都正常。

自托管销售页地址通常是：

```text
线上地址/sales.html
```

也要确认销售页上的购买按钮能显示支付宝收款码。

## 第五步：生成付款后邮件

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/create-delivery-email.mjs \
  --app-url "线上地址" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

把输出内容复制到收款平台的付款后邮件里。不要把明文授权码放进网页发布包。

## 第六步：配置收款平台

按 `launch/payment-platform-guide.md` 选择一个收款平台。

在收款平台产品页填写：

- 产品名：OfferDesk 报价单赚钱助手。
- 价格：29 元一次性买断。
- 产品截图：`launch/offerdesk-screenshot.jpg`。
- 产品描述：使用 `launch/product-page-fields.md`。
- 付款后邮件：使用上一步命令生成的内容。

付款后邮件必须包含线上地址、授权码和客服邮箱。

## 第七步：真实付款验收

用真实收款方式完成一次付款测试。

付款后确认：

- 能收到付款成功通知。
- 能收到授权码。
- 输入授权码后水印消失。
- 打印或保存 PDF 正常。
- `launch/release-acceptance.md` 已填写。

然后运行：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-acceptance.mjs
```

必须看到失败数为 0，才能公开售卖。

## 第八步：首批获客

使用 `launch/first-customers.md` 发第一批内容。

用 `launch/sales-tracker.csv` 记录联系、试用、使用、付款和反馈。

7 天内如果 10 个真实试用者里 0 人愿意付费，不继续美化，先改需求或换方向。
