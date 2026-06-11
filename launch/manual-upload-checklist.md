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

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/create-delivery-email.mjs \
  --app-url "线上地址" \
  --license-code "付款后授权码" \
  --support-email "534403209@qq.com" \
  --out dist/post-purchase-email.txt
```

然后继续做真实付款验收。

## 不能跳过

- 不要把 `dist/post-purchase-email.txt` 上传到网页目录。
- 付款后邮件里必须有线上地址和授权码。
- 完成一次真实扫码付款后，填写 `launch/release-acceptance.md`。
