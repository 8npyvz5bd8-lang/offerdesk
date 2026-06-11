# 真实发布验收记录

需要确认的项目请填写“是”或“通过”。空着就不能公开售卖。

## 基本信息

- 验收日期：2026-06-11
- 线上地址：https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/
- 收款平台：支付宝官方商家接口，待开通
- 收款方式：支付宝扫码支付 notify_url，待部署
- 成交页：https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/buy.html
- 付款页：https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/pay.html
- 客服邮箱：534403209@qq.com
- 是否已接入自动收款平台：否
- 是否自动生成并发送授权码：否

## 发布前命令

- `node scripts/validate-release.mjs`：通过
- `node scripts/validate-auto-payment.mjs`：未通过
- `node scripts/build-release.mjs`：通过

## 线上页面检查

- 首页能打开：通过
- 报价能计算：通过
- 隐私页能打开：通过
- 条款页能打开：通过
- 退款页能打开：通过
- 购买入口能打开收款方式：通过
- 自动付款页能打开：未完成

## 真实付款检查

- 已完成一笔真实付款：未完成
- 已收到付款通知：未完成
- 已收到平台自动邮件：未完成
- 邮件里的自动授权码正确：未完成
- 输入授权码后水印消失：通过
- PDF 打印或保存正常：通过

## 结果

- 是否可以正式公开售卖：否
- 发现的问题：还没有真实付款验收。
- 下一步：开通支付宝当面付或扫码支付接口，部署自动收款服务，完成一笔真实付款后再改为通过。
