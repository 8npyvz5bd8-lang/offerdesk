import assert from "node:assert/strict";
import { createConfigText, parseArgs } from "../scripts/write-config.mjs";

const config = createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
});

assert.ok(config.includes('checkoutUrl: "https://pay.offerdesk.com/checkout"'));
assert.ok(config.includes('autoCheckoutUrl: ""'));
assert.ok(config.includes('autoPaymentApiBase: ""'));
assert.ok(config.includes('paymentQrImage: ""'));
assert.ok(config.includes('licenseProvider: "local"'));
assert.ok(config.includes('lemonSqueezyProductId: ""'));
assert.ok(config.includes('lemonSqueezyVariantId: ""'));
assert.ok(config.includes('licensePublicKey: {}'));
assert.ok(config.includes('supportEmail: "support@offerdesk.com"'));
assert.ok(config.includes("4f6076378a76f56ecd5f160d8a23b461d61cba7255e5734ba1c9050e4c6543fd"));
assert.equal(config.includes("OFFERDESK-DEMO-2026"), false);

assert.deepEqual(
  parseArgs([
    "--checkout-url",
    "https://pay.offerdesk.com/checkout",
    "--auto-checkout-url",
    "https://offerdesk.lemonsqueezy.com/buy/demo",
    "--license-provider",
    "lemonsqueezy",
    "--lemonsqueezy-product-id",
    "123",
    "--lemonsqueezy-variant-id",
    "456",
    "--license-public-key",
    '{"kty":"EC","crv":"P-256","x":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","y":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}',
    "--license-code",
    "OFFERDESK-DEMO-2026",
    "--support-email",
    "support@offerdesk.com",
    "--out",
    "/tmp/app-config.js"
  ]),
  {
    checkoutUrl: "https://pay.offerdesk.com/checkout",
    autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo",
    paymentQrImage: undefined,
    licenseProvider: "lemonsqueezy",
    lemonSqueezyProductId: "123",
    lemonSqueezyVariantId: "456",
    licensePublicKey: { kty: "EC", crv: "P-256", x: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", y: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    licenseCode: "OFFERDESK-DEMO-2026",
    supportEmail: "support@offerdesk.com",
    out: "/tmp/app-config.js"
  }
);

assert.ok(createConfigText({
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
}).includes('paymentQrImage: "./launch/payment-alipay.jpeg"'));
const lemonConfig = createConfigText({
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
  autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo",
  licenseProvider: "lemonsqueezy",
  lemonSqueezyProductId: "123",
  lemonSqueezyVariantId: "456",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
});
assert.ok(lemonConfig.includes('licenseProvider: "lemonsqueezy"'));
assert.ok(lemonConfig.includes('autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo"'));
assert.ok(lemonConfig.includes('lemonSqueezyProductId: "123"'));
const signedConfig = createConfigText({
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseProvider: "signed",
  licensePublicKey: { kty: "EC", crv: "P-256", x: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", y: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  supportEmail: "support@offerdesk.com"
});
assert.ok(signedConfig.includes('licenseProvider: "signed"'));
assert.ok(signedConfig.includes('licenseHash: ""'));
assert.ok(signedConfig.includes('"crv":"P-256"'));
assert.throws(() => createConfigText({
  checkoutUrl: "",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "http://pay.offerdesk.com/checkout",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  paymentQrImage: "/tmp/payment.jpeg",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseProvider: "lemonsqueezy",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseProvider: "signed",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  autoCheckoutUrl: "https://offerdesk.lemonsqueezy.com/buy/demo",
  licenseProvider: "lemonsqueezy",
  lemonSqueezyProductId: "not-number",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseCode: "short",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@example.com"
}));

console.log("config writer tests passed");
