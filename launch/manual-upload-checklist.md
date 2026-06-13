# 手动上传清单

目标：把 `dist/offerdesk-release.zip` 上传成一个真实可访问的网址。

## 需要上传的文件

```text
dist/offerdesk-release.zip
```

## 最快方式

1. 打开 Netlify Drop、Cloudflare Pages 或任意静态网站托管平台。
2. 上传 `dist/offerdesk-release.zip`，或上传解压后的 `dist/offerdesk-release` 文件夹。
3. 等平台生成网址。
4. 打开生成的网址，确认首页能访问。
5. 把线上地址发回来。

## 发回地址后要做

当前签名授权路线不需要先生成固定授权码邮件。买家付款后，让他在 `after-pay.html` 提交信息，再按下面“收到支付宝付款后”的命令生成单笔授权码和回复邮件。

然后继续做真实付款验收。

## 不能跳过

- 不要把 `dist/manual-orders/` 里的邮件上传到网页目录。
- 发给买家的邮件里必须有线上地址和唯一授权码。
- 完成一次真实扫码付款后，填写 `launch/release-acceptance.md`。

## 收到支付宝付款后

复制买家发来的整段邮件正文，然后运行：

```bash
pbpaste | /Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/fulfill-from-email.mjs
```

然后把 `dist/manual-orders/` 里的邮件内容发给买家。
