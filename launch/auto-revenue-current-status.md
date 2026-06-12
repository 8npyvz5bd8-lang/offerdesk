# OfferDesk 自动赚钱执行状态

生成时间：2026-06-12 21:43:43

文档步骤数：30
已完成：15
被阻塞：9
需人工：6
需运行命令确认：0
当前上架阶段：待部署支付宝自动收款服务
可以公开自动售卖：否

下一步：9. 准备支付宝商家参数：查看 launch/alipay-launch-readiness.md，补 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY、OFFERDESK_PUBLIC_BASE_URL。

## 逐步状态

### 1. 固定当前视觉标准

状态：已完成
证据：site.css 已存在。
下一步：补 site.css，并把 sales 风格抽成公共样式。

### 2. 检查所有公开页面

状态：已完成
证据：9/9 个公开页面已接入统一皮肤。
下一步：继续给缺失页面加 site.css 和 surface-page。

### 3. 保持报价工具可用

状态：已完成
证据：index.html 仍包含报价表单和主脚本。
下一步：打开工具页做浏览器点击验收。

### 4. 保证发布包包含新样式

状态：已完成
证据：发布目录和上传压缩包已存在，发布目录包含 site.css。
下一步：运行 node scripts/build-upload-zip.mjs。

### 5. 跑完整测试

状态：已完成
证据：本次状态脚本收到 testsPassed=true。
下一步：运行完整测试，确认通过后再把 testsPassed=true 传入。

### 6. 跑静态页面检查

状态：已完成
证据：本次状态脚本收到 staticCheckPassed=true。
下一步：运行 node scripts/check-static-assets.mjs。

### 7. 确认当前上架状态

状态：已完成
证据：当前阶段：待部署支付宝自动收款服务。
下一步：运行 node scripts/release-status.mjs。

### 8. 选择自动收款路线

状态：已完成
证据：当前配置是 signed 授权 + 支付宝路线。
下一步：确认走支付宝官方商家接口或切换 Lemon Squeezy。

### 9. 准备支付宝商家参数

状态：被阻塞
证据：已发现本地 env 草稿，但还有 4 项支付宝预检未通过。
下一步：查看 launch/alipay-launch-readiness.md，补 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY、OFFERDESK_PUBLIC_BASE_URL。

### 10. 准备授权签名私钥

状态：已完成
证据：本地授权私钥文件存在且字段完整。
下一步：运行 node scripts/generate-license-keypair.mjs 生成授权密钥。

### 11. 准备订单持久存储

状态：已完成
证据：render.yaml 已配置 /data/orders.json 和 /data 持久磁盘。
下一步：给部署平台补持久磁盘和 OFFERDESK_DATA_FILE。

### 12. 准备自动邮件

状态：需人工
证据：当前环境变量里没有自动邮件配置。
下一步：补 RESEND_API_KEY 和 OFFERDESK_EMAIL_FROM；没有也可先让买家页面显示授权码。

### 13. 写真实环境变量文件

状态：被阻塞
证据：已发现本地 env 草稿，但还有 4 项支付宝预检未通过。
下一步：填完 env 后运行 node scripts/alipay-launch-readiness.mjs --write launch/alipay-launch-readiness.md --no-fail。

### 14. 部署自动收款服务

状态：被阻塞
证据：app-config.js 的 autoPaymentApiBase 为空或不是可用自动服务地址。
下一步：部署 scripts/alipay-payment-server.mjs，并拿到 https 服务地址。

### 15. 检查服务健康状态

状态：被阻塞
证据：还没有自动服务地址，无法请求 /api/health。
下一步：服务上线后请求 /api/health，必须 ready=true。

### 16. 创建测试订单

状态：被阻塞
证据：还没有自动服务地址，无法创建测试订单。
下一步：运行 node scripts/validate-alipay-service.mjs。

### 17. 接入前端配置

状态：被阻塞
证据：前端还没有真实 autoPaymentApiBase。
下一步：运行 node scripts/connect-alipay-service.mjs。

### 18. 验证自动购买页

状态：已完成
证据：购买页已有买家名称和邮箱字段。
下一步：自动服务接入后，用浏览器生成专属付款码。

### 19. 做一笔真实小额付款

状态：需人工
证据：GPT 不能替用户真实付款。
下一步：服务上线后请用真实支付宝完成一笔付款。

### 20. 验证授权码自动解锁

状态：被阻塞
证据：尚未发现真实付款生成的授权码证据。
下一步：付款后用 index.html?license_key=... 验证水印消失。

### 21. 填写真实发布验收

状态：被阻塞
证据：launch/release-acceptance.md 仍显示真实付款或自动收款未完成。
下一步：完成真实付款后填写 release-acceptance.md。

### 22. 更新正式发布包

状态：已完成
证据：dist/offerdesk-release 和 dist/offerdesk-release.zip 已生成。
下一步：运行 node scripts/build-upload-zip.mjs。

### 23. 发布到长期公网地址

状态：已完成
证据：线上校验通过：14/14 个文件与本地一致。
下一步：运行 node scripts/verify-public-site.mjs --write launch/public-site-verification.json。

### 24. 检查线上页面

状态：已完成
证据：14 个线上关键文件已和本地一致。
下一步：用线上校验脚本和浏览器截图检查页面。

### 25. 准备首批获客名单

状态：需人工
证据：0/10 个真实潜在买家记录。
下一步：查看 launch/outreach-readiness.md，整理 10 个真实接单人，不编造。

### 26. 发布推广内容

状态：需人工
证据：0/3 个推广渠道有真实发布证据。
下一步：查看 launch/outreach-readiness.md，用 share.html 文案发布到真实渠道，并记录到 promotion-log.csv。

### 27. 跟进每个潜在买家

状态：已完成
证据：pipeline.html 已存在，可记录线索。
下一步：把真实联系人状态录入跟进台。

### 28. 处理第一笔自动订单

状态：被阻塞
证据：尚无第一笔自动订单证据。
下一步：订单成功后检查订单 JSON、授权码和邮件状态。

### 29. 记录收入和问题

状态：需人工
证据：sales-tracker.csv 中没有真实付款记录。
下一步：有真实付款后记录到 sales-tracker.csv，并重新生成 launch/outreach-readiness.md。

### 30. 做 7 天复盘

状态：需人工
证据：尚未达到 7 天真实数据复盘。
下一步：满 7 天后按试用、付费、反馈复盘。

