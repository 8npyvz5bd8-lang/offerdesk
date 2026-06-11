# 产品页填写内容

## 标题

OfferDesk 报价单赚钱助手

## 价格

29 元一次性买断。

## 短介绍

给自由职业者和小团队用的报价单生成器，帮你算清成本、利润和首付款，避免接单时低报价。

## 详细介绍

OfferDesk 是一个打开就能用的报价单工具。你输入项目、数量、单价和内部成本，它会自动算出小计、折扣、税费、总价、预计利润、首付款和利润状态。

右侧会同步生成一份客户可读的报价单，可以直接打印或保存为 PDF。成本只给自己看，不会出现在客户报价单里。

免费版带水印，专业版去掉水印，适合正式发给客户。

## 上传素材

- 产品截图：`launch/offerdesk-screenshot.jpg`
- 商品封面图：`launch/social-cover.jpg`
- 痛点说明图：`launch/social-profit.jpg`
- 交付说明图：`launch/social-delivery.jpg`
- 买家交付说明：`launch/buyer-guide.md`
- 付款后邮件：用 `scripts/create-delivery-email.mjs` 生成

## 付款后交付

用 `scripts/create-delivery-email.mjs` 生成付款后邮件，里面必须包含线上地址、专业版授权码和客服邮箱。

## 退款政策

建议采用 7 天内可退款。买家如果无法正常解锁专业版，或软件与上架说明明显不符，可以申请退款。

## 上架前不能漏

- 真实收款方式：`launch/payment-alipay.jpeg`
- 真实客服邮箱
- 至少 8 位授权码
- 用 `scripts/write-config.mjs` 生成的 `app-config.js`
- 线上地址
- 自托管销售页地址
- 一次真实付款和解锁测试
