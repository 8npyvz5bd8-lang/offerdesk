import assert from "node:assert/strict";
import { createDeliveryEmailText, parseArgs } from "../scripts/create-delivery-email.mjs";

const email = createDeliveryEmailText({
  appUrl: "https://offerdesk.app",
  licenseCode: "OFFERDESK-PRO-2026",
  supportEmail: "support@offerdesk.app"
});

assert.ok(email.includes("https://offerdesk.app"));
assert.ok(email.includes("OFFERDESK-PRO-2026"));
assert.ok(email.includes("support@offerdesk.app"));
assert.ok(email.includes("可正式交付"));

assert.deepEqual(
  parseArgs([
    "--app-url",
    "https://offerdesk.app",
    "--license-code",
    "OFFERDESK-PRO-2026",
    "--support-email",
    "support@offerdesk.app",
    "--out",
    "/tmp/offerdesk-email.txt"
  ]),
  {
    appUrl: "https://offerdesk.app",
    licenseCode: "OFFERDESK-PRO-2026",
    supportEmail: "support@offerdesk.app",
    out: "/tmp/offerdesk-email.txt"
  }
);

assert.throws(() => createDeliveryEmailText({
  appUrl: "http://offerdesk.app",
  licenseCode: "OFFERDESK-PRO-2026",
  supportEmail: "support@offerdesk.app"
}));
assert.throws(() => createDeliveryEmailText({
  appUrl: "https://example.com",
  licenseCode: "OFFERDESK-PRO-2026",
  supportEmail: "support@offerdesk.app"
}));
assert.throws(() => createDeliveryEmailText({
  appUrl: "https://offerdesk.app",
  licenseCode: "short",
  supportEmail: "support@offerdesk.app"
}));
assert.throws(() => createDeliveryEmailText({
  appUrl: "https://offerdesk.app",
  licenseCode: "OFFERDESK-PRO-2026",
  supportEmail: "support@example.com"
}));

console.log("delivery email tests passed");
