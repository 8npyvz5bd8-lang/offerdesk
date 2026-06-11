import assert from "node:assert/strict";
import {
  createSignedLicensePayload,
  getLicenseProvider,
  isSignedLicenseProvider,
  isValidLicensePublicKey,
  parseSignedLicenseCode,
  signLicensePayload,
  verifySignedLicenseCode
} from "../src/license.js";

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

assert.equal(getLicenseProvider({ licenseProvider: "Signed" }), "signed");
assert.equal(isSignedLicenseProvider({ licenseProvider: "signed" }), true);
assert.equal(isValidLicensePublicKey(publicJwk), true);

const payload = createSignedLicensePayload({
  email: "BUYER@EXAMPLE.COM",
  orderId: "OD-20260611190000-ABCD1234EF567890ABCD",
  name: "买家"
});
const code = await signLicensePayload(payload, privateJwk);
const parsed = parseSignedLicenseCode(code);
const record = await verifySignedLicenseCode(code, publicJwk);

assert.equal(parsed.payload.email, "buyer@example.com");
assert.equal(record.provider, "signed");
assert.equal(record.orderId, payload.orderId);
assert.equal(record.customerEmail, "buyer@example.com");

const tampered = code.replace("OD2.", "OD2x.");
await assert.rejects(() => verifySignedLicenseCode(tampered, publicJwk), /格式不正确/);
await assert.rejects(() => verifySignedLicenseCode(`${code.slice(0, -2)}xx`, publicJwk), /签名无效/);
assert.throws(() => createSignedLicensePayload({ email: "bad", orderId: payload.orderId }), /邮箱/);

console.log("signed license tests passed");
