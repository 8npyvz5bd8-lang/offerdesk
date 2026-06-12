import assert from "node:assert/strict";
import {
  buildOutreachReport,
  parseArgs,
  parseCsv
} from "../scripts/validate-outreach.mjs";

assert.deepEqual(parseArgs([
  "--tracker",
  "sales.csv",
  "--promotion-log",
  "promos.csv",
  "--min-prospects",
  "3",
  "--min-published-channels",
  "2"
]), {
  tracker: "sales.csv",
  promotionLog: "promos.csv",
  minProspects: 3,
  minPublishedChannels: 2
});

assert.deepEqual(parseCsv(`name,note
"张三","说了 ""报价"" 这个词"
`), [
  {
    name: "张三",
    note: "说了 \"报价\" 这个词"
  }
]);

const leads = parseCsv(`date,channel,person,role,contact,trial_sent,used_once,payment_status,paid_at,amount,buyer_email,license_sent,feedback,next_action
2026-06-12,闲鱼,张三,设计师,https://xianyu.com/item/123,yes,yes,已付款,2026-06-12 18:00,29,buyer@offerdesk.cn,yes,好用,发码
2026-06-12,小红书,李四,摄影师,redbook-user,yes,,愿意付费,,29,,,继续跟进
2026-06-12,朋友圈,王五,开发者,wechat-wang,,,,,,,,,明天试用
`);
const promotions = parseCsv(`date,channel,url,title,status,note
2026-06-12,闲鱼,https://xianyu.com/item/123,报价工具,已发布,
2026-06-12,小红书,https://xiaohongshu.com/explore/123,报价工具,published,
`);
const report = buildOutreachReport({
  leads,
  promotions,
  minProspects: 3,
  minPublishedChannels: 2
});

assert.equal(report.prospects, 3);
assert.equal(report.contacted, 3);
assert.equal(report.trials, 2);
assert.equal(report.usedOnce, 1);
assert.equal(report.interested, 2);
assert.equal(report.paid, 1);
assert.equal(report.revenue, 29);
assert.equal(report.publishedChannels, 2);
assert.equal(report.readyForReview, true);

const emptyReport = buildOutreachReport({
  leads: [],
  promotions: [],
  minProspects: 1,
  minPublishedChannels: 1
});
assert.equal(emptyReport.readyForReview, false);
assert.equal(emptyReport.checks.filter((item) => !item.pass).length, 3);

console.log("validate outreach tests passed");
