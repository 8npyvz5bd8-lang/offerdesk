import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFields, validateAcceptanceText } from "../scripts/validate-acceptance.mjs";

const template = await readFile(new URL("../launch/release-acceptance.md", import.meta.url), "utf8");
const templateChecks = validateAcceptanceText(template);

assert.ok(templateChecks.length > 0);
assert.ok(templateChecks.some((item) => item.name === "已完成一笔真实付款" && !item.pass));

const complete = `# 真实发布验收记录

## 基本信息

- 验收日期：2026-06-11
- 线上地址：https://offerdesk.app
- 收款平台：Gumroad
- 收款方式：支付宝收款码
- 客服邮箱：support@offerdesk.app
- 授权码是否已写入付款后邮件：是

## 发布前命令

- \`node scripts/validate-release.mjs\`：通过
- \`node scripts/build-release.mjs\`：通过

## 线上页面检查

- 首页能打开：是
- 报价能计算：是
- 隐私页能打开：是
- 条款页能打开：是
- 退款页能打开：是
- 购买入口能打开收款方式：是

## 真实付款检查

- 已完成一笔真实付款：是
- 已收到付款通知：是
- 已收到付款后邮件：是
- 邮件里的授权码正确：是
- 输入授权码后水印消失：是
- PDF 打印或保存正常：是

## 结果

- 是否可以正式公开售卖：是
- 发现的问题：无
- 下一步：公开售卖
`;

assert.equal(parseFields(complete).get("线上地址"), "https://offerdesk.app");
assert.equal(validateAcceptanceText(complete).filter((item) => !item.pass).length, 0);

const tempFile = join(tmpdir(), `offerdesk-acceptance-${Date.now()}.md`);
await writeFile(tempFile, template, "utf8");

const result = spawnSync(process.execPath, ["scripts/validate-acceptance.mjs", "--file", tempFile], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8"
});

await rm(tempFile, { force: true });

assert.equal(result.status, 1);
assert.ok(result.stdout.includes("OfferDesk 真实发布验收"));
assert.ok(result.stdout.includes("FAIL 已完成一笔真实付款"));
assert.equal(result.stderr.includes("AssertionError"), false);

console.log("acceptance tests passed");
