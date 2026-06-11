import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fulfillFromEmail,
  parseArgs,
  parsePaymentClaimText
} from "../scripts/fulfill-from-email.mjs";
import { verifySignedLicenseCode } from "../src/license.js";

const claimText = `
我已支付 OfferDesk 专业版 29 元，请发送授权码。

付款时间：2026-06-11 20:30
付款金额：29 元
订单号：OD-MANUAL-20260611203000-ABC12345
我的邮箱：Buyer@Example.COM
支付宝昵称或备注：老陈设计

其他说明：请发到这个邮箱

软件地址：https://8npyvz5bd8-lang.github.io/offerdesk/
`;

assert.deepEqual(parsePaymentClaimText(claimText), {
  email: "Buyer@Example.COM",
  orderId: "OD-MANUAL-20260611203000-ABC12345",
  amount: "29",
  paidAt: "2026-06-11 20:30",
  name: "老陈设计",
  note: "支付宝备注：老陈设计；其他说明：请发到这个邮箱"
});

assert.equal(parsePaymentClaimText(`
订单号：OD-MANUAL-20260611203000-ABC12345
付款金额：29 元
联系方式：buyer2@example.com
`).email, "buyer2@example.com");

assert.throws(() => parsePaymentClaimText("我的邮箱：buyer@example.com"), /订单号/);
assert.throws(() => parsePaymentClaimText("订单号：OD-MANUAL-1"), /邮箱/);

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

const tempRoot = join(tmpdir(), `offerdesk-email-fulfill-${Date.now()}`);
const keyFile = join(tempRoot, "private.jwk.json");
const claimFile = join(tempRoot, "claim.txt");
const outDir = join(tempRoot, "orders");
const tracker = join(tempRoot, "sales-tracker.csv");
await mkdir(tempRoot, { recursive: true });
await writeFile(keyFile, JSON.stringify(privateJwk), "utf8");
await writeFile(claimFile, claimText, "utf8");

assert.deepEqual(
  parseArgs([
    "--file",
    claimFile,
    "--channel",
    "qq-mail",
    "--role",
    "designer",
    "--app-url",
    "https://offerdesk.app",
    "--support-email",
    "support@offerdesk.app",
    "--private-key-file",
    keyFile,
    "--out-dir",
    outDir,
    "--tracker",
    tracker
  ]),
  {
    file: claimFile,
    channel: "qq-mail",
    role: "designer",
    appUrl: "https://offerdesk.app",
    supportEmail: "support@offerdesk.app",
    privateKeyFile: keyFile,
    outDir,
    tracker
  }
);

const result = await fulfillFromEmail({
  file: claimFile,
  channel: "qq-mail",
  role: "designer",
  appUrl: "https://offerdesk.app",
  supportEmail: "support@offerdesk.app",
  privateKeyFile: keyFile,
  outDir,
  tracker
});

const record = await verifySignedLicenseCode(result.licenseCode, publicJwk);
const emailText = await readFile(result.emailOut, "utf8");
const trackerText = await readFile(result.tracker, "utf8");

assert.equal(result.orderId, "OD-MANUAL-20260611203000-ABC12345");
assert.equal(result.buyerEmail, "buyer@example.com");
assert.equal(result.amount, "29");
assert.equal(result.paidAt, "2026-06-11 20:30");
assert.equal(record.customerEmail, "buyer@example.com");
assert.equal(record.orderId, "OD-MANUAL-20260611203000-ABC12345");
assert.ok(emailText.includes(result.licenseCode));
assert.ok(trackerText.includes("qq-mail"));
assert.ok(trackerText.includes("老陈设计"));
assert.ok(trackerText.includes("支付宝备注"));

await rm(tempRoot, { recursive: true, force: true });

console.log("fulfill from email tests passed");
