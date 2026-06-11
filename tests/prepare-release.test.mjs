import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, prepareRelease } from "../scripts/prepare-release.mjs";

const tempRoot = join(tmpdir(), `offerdesk-prepare-${Date.now()}`);
const configOut = join(tempRoot, "app-config.js");
const emailOut = join(tempRoot, "post-purchase-email.txt");

assert.deepEqual(
  parseArgs([
    "--checkout-url",
    "https://pay.offerdesk.app/checkout",
    "--payment-qr-image",
    "./launch/payment-alipay.jpeg",
    "--app-url",
    "https://offerdesk.app",
    "--license-code",
    "OFFERDESK-PRO-2026",
    "--support-email",
    "support@offerdesk.app",
    "--config-out",
    configOut,
    "--email-out",
    emailOut
  ]),
  {
    checkoutUrl: "https://pay.offerdesk.app/checkout",
    paymentQrImage: "./launch/payment-alipay.jpeg",
    appUrl: "https://offerdesk.app",
    licenseCode: "OFFERDESK-PRO-2026",
    supportEmail: "support@offerdesk.app",
    configOut,
    emailOut
  }
);

const result = await prepareRelease({
  checkoutUrl: "https://pay.offerdesk.app/checkout",
  appUrl: "https://offerdesk.app",
  licenseCode: "OFFERDESK-PRO-2026",
  supportEmail: "support@offerdesk.app",
  configOut,
  emailOut
}, { build: false });

const configText = await readFile(result.configOut, "utf8");
const emailText = await readFile(result.emailOut, "utf8");

await rm(tempRoot, { recursive: true, force: true });

assert.ok(configText.includes('checkoutUrl: "https://pay.offerdesk.app/checkout"'));
assert.ok(configText.includes('paymentQrImage: ""'));
assert.ok(configText.includes('supportEmail: "support@offerdesk.app"'));
assert.equal(configText.includes("OFFERDESK-PRO-2026"), false);
assert.ok(emailText.includes("https://offerdesk.app"));
assert.ok(emailText.includes("OFFERDESK-PRO-2026"));
assert.ok(emailText.includes("support@offerdesk.app"));

await assert.rejects(() => prepareRelease({
  checkoutUrl: "https://example.com/checkout",
  appUrl: "https://offerdesk.app",
  licenseCode: "OFFERDESK-PRO-2026",
  supportEmail: "support@offerdesk.app",
  configOut,
  emailOut
}, { build: false }));

console.log("prepare release tests passed");
