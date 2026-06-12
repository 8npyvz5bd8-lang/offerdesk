import assert from "node:assert/strict";
import {
  buildOutreachReadiness,
  parseArgs,
  renderOutreachReadinessMarkdown
} from "../scripts/outreach-readiness.mjs";

const emptyReadiness = await buildOutreachReadiness({
  minProspects: 2,
  minPublishedChannels: 1,
  report: {
    prospects: 0,
    contacted: 0,
    trials: 0,
    usedOnce: 0,
    interested: 0,
    paid: 0,
    revenue: 0,
    publishedChannels: 0,
    readyForReview: false
  }
});
assert.equal(emptyReadiness.stage, "先发布真实推广");
assert.equal(emptyReadiness.gaps.missingProspects, 2);
assert.equal(emptyReadiness.gaps.missingChannels, 1);
assert.equal(emptyReadiness.canReviewMoney, false);

const emptyMarkdown = renderOutreachReadinessMarkdown(
  emptyReadiness,
  new Date("2026-06-12T00:00:00")
);
assert.ok(emptyMarkdown.includes("当前阶段：先发布真实推广"));
assert.ok(emptyMarkdown.includes("潜在买家：0/2"));
assert.ok(emptyMarkdown.includes("已发布渠道：0/1"));
assert.ok(emptyMarkdown.includes("不能由 GPT 伪造"));

const leadReadiness = await buildOutreachReadiness({
  report: {
    prospects: 4,
    contacted: 4,
    trials: 2,
    usedOnce: 1,
    interested: 0,
    paid: 0,
    revenue: 0,
    publishedChannels: 3,
    readyForReview: false
  }
});
assert.equal(leadReadiness.stage, "补真实潜在买家");
assert.equal(leadReadiness.gaps.missingProspects, 6);
assert.equal(leadReadiness.gaps.missingChannels, 0);

const paymentReadiness = await buildOutreachReadiness({
  report: {
    prospects: 10,
    contacted: 10,
    trials: 6,
    usedOnce: 3,
    interested: 1,
    paid: 0,
    revenue: 0,
    publishedChannels: 3,
    readyForReview: false
  }
});
assert.equal(paymentReadiness.stage, "跟进试用到付款");
assert.equal(paymentReadiness.gaps.missingPayments, 1);

const reviewReadiness = await buildOutreachReadiness({
  report: {
    prospects: 10,
    contacted: 10,
    trials: 7,
    usedOnce: 4,
    interested: 2,
    paid: 1,
    revenue: 29,
    publishedChannels: 3,
    readyForReview: true
  }
});
assert.equal(reviewReadiness.stage, "复盘真实收入");
assert.equal(reviewReadiness.canReviewMoney, true);

assert.deepEqual(parseArgs([
  "--tracker",
  "sales.csv",
  "--promotion-log",
  "promos.csv",
  "--min-prospects",
  "2",
  "--min-published-channels",
  "1",
  "--write",
  "launch/outreach-readiness.md",
  "--no-fail"
]), {
  tracker: "sales.csv",
  promotionLog: "promos.csv",
  minProspects: 2,
  minPublishedChannels: 1,
  write: "launch/outreach-readiness.md",
  noFail: true
});

console.log("outreach readiness tests passed");
