# OfferDesk 获客上线清单

生成时间：2026-06-12 19:12:00

当前阶段：先发布真实推广
可以复盘真实赚钱：否

## 当前证据

潜在买家：0/10
已联系：0
已发试用：0
已试用：0
愿意付费：0
已发布渠道：0/3
已付款：0
收入：¥0.00

## 缺口

- 还差真实潜在买家：10 个
- 还差真实发布渠道：3 个
- 还差真实付款记录：1 笔

## 下一步

1. 先补 3 个真实发布渠道，优先闲鱼、小红书、朋友圈。
2. 打开 promotion.html，填真实发布链接，下载 CSV。
3. 运行导入命令，把真实发布证据写入 launch/promotion-log.csv。

## 可直接运行的命令

```bash
/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/import-outreach-evidence.mjs --promotion-file "/Users/chenzhifeng/Downloads/offerdesk-promotions.csv"

/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/import-outreach-evidence.mjs --sales-file "/Users/chenzhifeng/Downloads/offerdesk-sales.csv"

/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-outreach.mjs --tracker "launch/sales-tracker.csv" --promotion-log "launch/promotion-log.csv"

/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/outreach-readiness.mjs --write launch/outreach-readiness.md --no-fail
```

## 不能由 GPT 伪造的部分

- 真实接单人的姓名、账号或联系方式。
- 真实发布后的链接。
- 买家真实付款和收入。

