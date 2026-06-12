import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  importOutreachEvidence,
  parseArgs
} from "../scripts/import-outreach-evidence.mjs";

const tempRoot = join(tmpdir(), `offerdesk-outreach-import-${Date.now()}`);
const tracker = join(tempRoot, "sales-tracker.csv");
const promotionLog = join(tempRoot, "promotion-log.csv");
const salesFile = join(tempRoot, "sales.csv");
const promotionFile = join(tempRoot, "promotions.csv");

await mkdir(tempRoot, { recursive: true });

const salesText = `date,channel,person,role,contact,trial_sent,used_once,payment_status,paid_at,order_id,source,amount,buyer_email,license_sent,feedback,next_action
2026-06-12,闲鱼,张三,设计师,https://www.goofish.com/personal?user=1,yes,,愿意付费,,OD-MANUAL-1,xianyu,29,,,想试用,继续跟进
2026-06-12,小红书,李四,摄影师,https://www.xiaohongshu.com/user/profile/abc,yes,yes,,,OD-MANUAL-2,xiaohongshu,,,,报价场景明确,发成交页
`;

const promotionText = `date,channel,url,title,status,note
2026-06-12,闲鱼,https://www.goofish.com/item?id=123,报价工具,已发布,
2026-06-12,小红书,https://www.xiaohongshu.com/explore/123,报价工具,published,
2026-06-12,朋友圈,,报价工具,待发布,
`;

await writeFile(salesFile, salesText, "utf8");
await writeFile(promotionFile, promotionText, "utf8");

assert.deepEqual(
  await parseArgs([
    "--sales-file",
    salesFile,
    "--promotion-file",
    promotionFile,
    "--tracker",
    tracker,
    "--promotion-log",
    promotionLog
  ]),
  {
    salesText,
    promotionText,
    tracker,
    promotionLog
  }
);

const first = await importOutreachEvidence({
  salesText,
  promotionText,
  tracker,
  promotionLog
});

assert.equal(first.importedSales, 2);
assert.equal(first.importedPromotions, 2);
assert.equal(first.report.prospects, 2);
assert.equal(first.report.publishedChannels, 2);

const second = await importOutreachEvidence({
  salesText,
  promotionText,
  tracker,
  promotionLog
});

assert.equal(second.importedSales, 0);
assert.equal(second.importedPromotions, 0);

const duplicateOrder = await importOutreachEvidence({
  salesText: `date,channel,person,role,contact,trial_sent,used_once,payment_status,paid_at,order_id,source,amount,buyer_email,license_sent,feedback,next_action
2026-06-12,朋友圈,不同名字,设计师,wechat-real,yes,yes,已付款,2026-06-12 20:00,OD-MANUAL-1,friend-circle,29,buyer@example.com,yes,重复订单,不用导入
`,
  tracker,
  promotionLog
});
assert.equal(duplicateOrder.importedSales, 0);

const trackerText = await readFile(tracker, "utf8");
const promotionLogText = await readFile(promotionLog, "utf8");
assert.equal(trackerText.match(/张三/gu).length, 1);
assert.ok(trackerText.includes("order_id,source"));
assert.ok(trackerText.includes("OD-MANUAL-1,xianyu"));
assert.equal(promotionLogText.match(/goofish/gu).length, 1);

await assert.rejects(
  () => importOutreachEvidence({
    salesText: `date,channel,person,role,contact
2026-06-12,闲鱼,姓名/账号,设计师,买家邮箱
`,
    tracker,
    promotionLog
  }),
  /真实值/u
);

await assert.rejects(
  () => importOutreachEvidence({
    promotionText: `date,channel,url,title,status,note
2026-06-12,小红书,not-a-url,报价工具,已发布,
`,
    tracker,
    promotionLog
  }),
  /http/u
);

await rm(tempRoot, { recursive: true, force: true });

console.log("import outreach evidence tests passed");
