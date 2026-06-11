import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureLemonSqueezy, parseArgs } from "../scripts/configure-lemonsqueezy.mjs";

const tempFile = join(tmpdir(), `offerdesk-lemonsqueezy-${Date.now()}.js`);

assert.deepEqual(
  parseArgs([
    "--auto-checkout-url",
    "https://offerdesk.lemonsqueezy.com/buy/demo",
    "--product-id",
    "123",
    "--variant-id",
    "456",
    "--fallback-license-code",
    "OFFERDESK-FALLBACK-2026",
    "--out",
    tempFile
  ]),
  {
    autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo",
    lemonSqueezyProductId: "123",
    lemonSqueezyVariantId: "456",
    licenseCode: "OFFERDESK-FALLBACK-2026",
    supportEmail: "534403209@qq.com",
    checkoutUrl: "https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/buy.html",
    paymentQrImage: "./launch/payment-alipay.jpeg",
    out: tempFile
  }
);

await configureLemonSqueezy({
  autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo",
  lemonSqueezyProductId: "123",
  lemonSqueezyVariantId: "456",
  licenseCode: "OFFERDESK-FALLBACK-2026",
  supportEmail: "support@offerdesk.app",
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/graphics-debug/offerdesk/buy.html",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  out: tempFile
});

const configText = await readFile(tempFile, "utf8");
await rm(tempFile, { force: true });

assert.ok(configText.includes('licenseProvider: "lemonsqueezy"'));
assert.ok(configText.includes('autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo"'));
assert.ok(configText.includes('lemonSqueezyProductId: "123"'));
assert.ok(configText.includes('lemonSqueezyVariantId: "456"'));
assert.ok(configText.includes('supportEmail: "support@offerdesk.app"'));
assert.equal(configText.includes("OFFERDESK-FALLBACK-2026"), false);

await assert.rejects(() => configureLemonSqueezy({
  autoCheckoutUrl: "http://offerdesk.lemonsqueezy.com/buy/demo",
  lemonSqueezyProductId: "123",
  licenseCode: "OFFERDESK-FALLBACK-2026",
  out: tempFile
}));

await assert.rejects(() => configureLemonSqueezy({
  autoCheckoutUrl: "https://example.com/buy/demo",
  lemonSqueezyProductId: "123",
  licenseCode: "OFFERDESK-FALLBACK-2026",
  out: tempFile
}));

console.log("configure lemonsqueezy tests passed");
