import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  buildHealthPayload,
  buildSignContent,
  createPaymentServer,
  createOrderId,
  signAlipayParams,
  verifyAlipayParams
} from "../scripts/alipay-payment-server.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

const params = {
  method: "alipay.trade.precreate",
  app_id: "2021000000000000",
  sign_type: "RSA2",
  charset: "utf-8",
  biz_content: '{"out_trade_no":"OD-20260611190000-ABCD1234EF567890ABCD"}'
};

assert.equal(
  buildSignContent(params),
  'app_id=2021000000000000&biz_content={"out_trade_no":"OD-20260611190000-ABCD1234EF567890ABCD"}&charset=utf-8&method=alipay.trade.precreate'
);

const signed = { ...params, sign: signAlipayParams(params, privateKey) };
assert.equal(verifyAlipayParams(signed, publicKey), true);
assert.equal(verifyAlipayParams({ ...signed, app_id: "changed" }, publicKey), false);
assert.match(createOrderId(new Date("2026-06-11T19:00:00+08:00")), /^OD-\d{14}-[A-F0-9]{24}$/);
assert.deepEqual(buildHealthPayload({}), {
  ok: true,
  service: "offerdesk-alipay-payment",
  alipayConfigured: false,
  offerdeskConfigured: false,
  ready: false
});
assert.equal(buildHealthPayload({
  ALIPAY_APP_ID: "2021000000000000",
  ALIPAY_PRIVATE_KEY: privateKey,
  ALIPAY_PUBLIC_KEY: publicKey,
  OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
  OFFERDESK_LICENSE_PRIVATE_KEY_FILE: "secrets/offerdesk-license-private.jwk.json"
}).ready, true);

const server = createPaymentServer({});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
const health = await healthResponse.json();
await new Promise((resolve) => server.close(resolve));
assert.equal(healthResponse.status, 200);
assert.equal(health.service, "offerdesk-alipay-payment");
assert.equal(health.ready, false);

console.log("alipay payment server tests passed");
