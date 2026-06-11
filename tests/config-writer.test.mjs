import assert from "node:assert/strict";
import { createConfigText, parseArgs } from "../scripts/write-config.mjs";

const config = createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
});

assert.ok(config.includes('checkoutUrl: "https://pay.offerdesk.com/checkout"'));
assert.ok(config.includes('paymentQrImage: ""'));
assert.ok(config.includes('supportEmail: "support@offerdesk.com"'));
assert.ok(config.includes("4f6076378a76f56ecd5f160d8a23b461d61cba7255e5734ba1c9050e4c6543fd"));
assert.equal(config.includes("OFFERDESK-DEMO-2026"), false);

assert.deepEqual(
  parseArgs([
    "--checkout-url",
    "https://pay.offerdesk.com/checkout",
    "--license-code",
    "OFFERDESK-DEMO-2026",
    "--support-email",
    "support@offerdesk.com",
    "--out",
    "/tmp/app-config.js"
  ]),
  {
    checkoutUrl: "https://pay.offerdesk.com/checkout",
    paymentQrImage: undefined,
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
  licenseCode: "short",
  supportEmail: "support@offerdesk.com"
}));
assert.throws(() => createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@example.com"
}));

console.log("config writer tests passed");
