# 支付宝收款码全自动方案

## 结论

普通个人收款码不能全自动发授权码，因为网页收不到“已到账”通知。

真正全自动要用支付宝官方商家接口：

1. 服务器调用 `alipay.trade.precreate` 生成每个订单专属二维码。
2. 买家扫码付款。
3. 支付宝把支付结果 POST 到服务器的 `notify_url`。
4. 服务器验签、确认金额和订单号。
5. 服务器用本机私钥签发唯一授权码。
6. 买家页面轮询订单状态，到账后自动显示授权码。

## 需要准备

- 支付宝开放平台应用。
- 已开通当面付或可用的扫码支付产品。
- `ALIPAY_APP_ID`
- 支付宝应用私钥：`ALIPAY_PRIVATE_KEY` 或 `ALIPAY_PRIVATE_KEY_FILE`
- 支付宝公钥：`ALIPAY_PUBLIC_KEY` 或 `ALIPAY_PUBLIC_KEY_FILE`
- 可公网访问的服务器地址，用作 `OFFERDESK_PUBLIC_BASE_URL`
- 本项目生成的授权私钥：本地可用 `secrets/offerdesk-license-private.jwk.json`，线上部署用 `OFFERDESK_LICENSE_PRIVATE_JWK`

环境变量模板见：

```text
launch/alipay-server-env.example
```

填完本地环境变量文件后，先预检：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-alipay-env.mjs \
  --file "你的环境变量文件.env"
```

这个命令只检查缺项和格式，不会打印密钥。

如需付款成功后自动发邮件，还要填：

```text
RESEND_API_KEY
OFFERDESK_EMAIL_FROM
OFFERDESK_APP_URL
OFFERDESK_SUPPORT_EMAIL
```

没填邮件配置时，买家仍可在付款页轮询拿到授权码；填了邮件配置后，到账发码时会同时给买家邮箱发送授权码。

## 本地启动命令

```bash
ALIPAY_APP_ID="你的支付宝应用ID" \
ALIPAY_PRIVATE_KEY_FILE="secrets/alipay-app-private.pem" \
ALIPAY_PUBLIC_KEY_FILE="secrets/alipay-public.pem" \
OFFERDESK_PUBLIC_BASE_URL="https://你的支付服务器域名" \
OFFERDESK_LICENSE_PRIVATE_KEY_FILE="secrets/offerdesk-license-private.jwk.json" \
OFFERDESK_ALLOWED_ORIGIN="https://8npyvz5bd8-lang.github.io" \
PORT=8787 \
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/alipay-payment-server.mjs
```

启动后检查：

```bash
curl https://你的支付服务器域名/api/health
```

返回里的 `ready` 必须是 `true`。

## Render 部署方式

1. 把代码推到 GitHub。
2. 在 Render 新建 Blueprint，选择本仓库。
3. Render 会读取根目录的 `render.yaml` 和 `Dockerfile`。
4. 填好这些环境变量：

```text
ALIPAY_APP_ID
ALIPAY_PRIVATE_KEY
ALIPAY_PUBLIC_KEY
OFFERDESK_PUBLIC_BASE_URL
OFFERDESK_LICENSE_PRIVATE_JWK
```

5. 部署完成后打开：

```text
https://你的支付服务器域名/api/health
```

确认 `ready` 是 `true`。

再跑完整接口验收：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-alipay-service.mjs \
  --api-base "https://你的支付服务器域名" \
  --email "534403209@qq.com"
```

这个命令会创建一个待支付测试订单，并检查订单状态接口能返回。

## 接入前端

部署成功后，用命令检查服务并写进 `app-config.js`：

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/connect-alipay-service.mjs \
  --api-base "https://你的支付服务器域名"
```

这个命令会先请求 `/api/health`，只有返回 `ready=true` 才会写配置。

也可以手动把服务器地址写进 `app-config.js`：

```js
autoPaymentApiBase: "https://你的支付服务器域名"
```

然后提交并推送 GitHub Pages。

## 不能做的假自动

- 监听手机通知。
- 读取短信或邮箱到账提醒。
- 让买家填截图后自动判定。

这些方式容易漏单、错单或泄露账号，不作为正式收款方案。
