import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTrackerRow,
  createManualOrderId,
  fulfillManualOrder,
  parseArgs
} from "../scripts/fulfill-manual-order.mjs";
import { verifySignedLicenseCode } from "../src/license.js";

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

const tempRoot = join(tmpdir(), `offerdesk-fulfill-${Date.now()}`);
const keyFile = join(tempRoot, "private.jwk.json");
const outDir = join(tempRoot, "orders");
const tracker = join(tempRoot, "sales-tracker.csv");
await mkdir(tempRoot, { recursive: true });
await writeFile(keyFile, JSON.stringify(privateJwk), "utf8");

const localNow = new Date(2026, 5, 11, 10, 20, 30);

assert.equal(
  createManualOrderId(localNow, "ABC123"),
  "OD-MANUAL-20260611102030-ABC123"
);

assert.deepEqual(
  parseArgs([
    "--email",
    "Buyer@Example.COM",
    "--order-id",
    "OD-MANUAL-20260611102030-ABC123",
    "--paid-at",
    "2026-06-11 18:20",
    "--amount",
    "29",
    "--channel",
    "xianyu",
    "--name",
    "买家",
    "--role",
    "designer",
    "--contact",
    "buyer@example.com",
    "--note",
    "支付宝备注",
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
    email: "Buyer@Example.COM",
    orderId: "OD-MANUAL-20260611102030-ABC123",
    name: "买家",
    paidAt: "2026-06-11 18:20",
    amount: "29",
    channel: "xianyu",
    role: "designer",
    contact: "buyer@example.com",
    note: "支付宝备注",
    appUrl: "https://offerdesk.app",
    supportEmail: "support@offerdesk.app",
    privateKeyFile: keyFile,
    outDir,
    licenseOut: undefined,
    emailOut: undefined,
    tracker
  }
);

const result = await fulfillManualOrder({
  email: "Buyer@Example.COM",
  orderId: "OD-MANUAL-20260611102030-ABC123",
  paidAt: "2026-06-11 18:20",
  amount: "29",
  channel: "xianyu",
  name: "买家",
  role: "designer",
  contact: "buyer@example.com",
  note: "支付宝备注",
  appUrl: "https://offerdesk.app",
  supportEmail: "support@offerdesk.app",
  privateKeyFile: keyFile,
  outDir,
  tracker,
  now: localNow
});

const record = await verifySignedLicenseCode(result.licenseCode, publicJwk);
const emailText = await readFile(result.emailOut, "utf8");
const licenseText = await readFile(result.licenseOut, "utf8");
const trackerText = await readFile(result.tracker, "utf8");

assert.equal(result.buyerEmail, "buyer@example.com");
assert.equal(record.orderId, "OD-MANUAL-20260611102030-ABC123");
assert.equal(record.customerEmail, "buyer@example.com");
assert.ok(emailText.includes("https://offerdesk.app"));
assert.ok(emailText.includes(result.licenseCode));
assert.ok(licenseText.includes(result.licenseCode));
assert.ok(trackerText.includes("xianyu"));
assert.ok(trackerText.includes("buyer@example.com"));
assert.ok(trackerText.includes("已发送授权码"));

const escaped = buildTrackerRow({
  date: "2026-06-11",
  channel: "闲鱼",
  person: "买家, A",
  role: "",
  contact: "buyer@example.com",
  paidAt: "2026-06-11 18:20",
  amount: "29",
  buyerEmail: "buyer@example.com",
  note: "含逗号, 和引号\""
});
assert.ok(escaped.includes('"买家, A"'));
assert.ok(escaped.includes('"含逗号, 和引号"""'));

await rm(tempRoot, { recursive: true, force: true });

await assert.rejects(() => fulfillManualOrder({
  email: "bad",
  privateKeyFile: keyFile,
  outDir,
  tracker
}), /邮箱/);

console.log("manual fulfillment tests passed");
