# 付款后邮件模板

正式上架时优先用命令生成，避免漏填线上地址或授权码：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/create-delivery-email.mjs \
  --app-url "线上地址" \
  --license-code "发给买家的授权码" \
  --support-email "客服邮箱"
```

标题：你的 OfferDesk 专业版授权码

正文：

你好，感谢购买 OfferDesk 专业版。

你的授权码是：

```text
在这里粘贴授权码
```

使用方式：

1. 打开 OfferDesk 线上地址。
2. 点击右上角「解锁专业版」。
3. 输入授权码。
4. 看到「可正式交付」后即可使用专业版。

如果遇到问题，请回复这封邮件。

OfferDesk
