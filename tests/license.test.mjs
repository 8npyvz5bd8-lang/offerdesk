import assert from "node:assert/strict";
import {
  getLicenseProvider,
  getDeliveryStatus,
  hashLicenseCode,
  isLemonSqueezyProvider,
  isValidLicenseHash,
  normalizeLicenseHash
} from "../src/license.js";

const expected = "4f6076378a76f56ecd5f160d8a23b461d61cba7255e5734ba1c9050e4c6543fd";

assert.equal(normalizeLicenseHash(` ${expected.toUpperCase()} `), expected);
assert.equal(isValidLicenseHash(expected), true);
assert.equal(isValidLicenseHash("not-a-hash"), false);
assert.equal(getLicenseProvider({ licenseProvider: "LemonSqueezy" }), "lemonsqueezy");
assert.equal(isLemonSqueezyProvider({ licenseProvider: "lemonsqueezy" }), true);
assert.equal(isLemonSqueezyProvider({ licenseProvider: "local" }), false);
assert.equal(await hashLicenseCode("OFFERDESK-DEMO-2026"), expected);
assert.deepEqual(getDeliveryStatus(true), {
  level: "ready",
  title: "可正式交付",
  body: "专业版已解锁，水印已移除。导出 PDF 后可以发给客户。"
});
assert.deepEqual(getDeliveryStatus(false), {
  level: "locked",
  title: "还不能正式交付",
  body: "免费版会显示水印。付款并输入授权码后，水印才会消失。"
});

console.log("license tests passed");
