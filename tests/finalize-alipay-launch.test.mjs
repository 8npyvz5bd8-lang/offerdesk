import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  finalizeAlipayLaunch,
  parseArgs
} from "../scripts/finalize-alipay-launch.mjs";
import { createConfigText } from "../scripts/write-config.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});
const licensePair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const privateJwk = await crypto.subtle.exportKey("jwk", licensePair.privateKey);
const publicJwk = await crypto.subtle.exportKey("jwk", licensePair.publicKey);

assert.deepEqual(parseArgs([
  "--env-file",
  "deploy.env",
  "--api-base",
  "https://pay.offerdesk.com/",
  "--email",
  "buyer@example.com",
  "--name",
  "验收买家",
  "--config",
  "app-config.js",
  "--out",
  "connected.js"
]), {
  envFile: "deploy.env",
  apiBase: "https://pay.offerdesk.com/",
  email: "buyer@example.com",
  name: "验收买家",
  config: "app-config.js",
  out: "connected.js"
});

const tempRoot = await mkdtemp(join(tmpdir(), "offerdesk-finalize-alipay-"));
const configFile = join(tempRoot, "app-config.js");
const outFile = join(tempRoot, "connected.js");
await writeFile(configFile, createConfigText({
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseProvider: "signed",
  licensePublicKey: publicJwk,
  supportEmail: "support@offerdesk.com"
}), "utf8");

const calls = [];
const okFetch = async (url, options = {}) => {
  calls.push(url);
  if (url === "https://pay.offerdesk.com/api/health") {
    return jsonResponse({
      service: "offerdesk-alipay-payment",
      ready: true
    });
  }
  if (url === "https://pay.offerdesk.com/api/create-order") {
    assert.deepEqual(JSON.parse(options.body), {
      email: "buyer@example.com",
      name: "验收买家"
    });
    return jsonResponse({
      orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
      amount: "29.00",
      status: "WAIT_BUYER_PAY",
      qrCode: "https://qr.alipay.com/test-order"
    });
  }
  if (url === "https://pay.offerdesk.com/api/order-status?order_id=OD-20260611203000-ABCDEF123456ABCDEF123456") {
    return jsonResponse({
      orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
      amount: "29.00",
      status: "WAIT_BUYER_PAY"
    });
  }
  throw new Error(`unexpected url: ${url}`);
};

const result = await finalizeAlipayLaunch({
  apiBase: "https://pay.offerdesk.com/",
  email: "buyer@example.com",
  name: "验收买家",
  config: configFile,
  out: outFile,
  fetchImpl: okFetch,
  env: {
    ALIPAY_APP_ID: "2021000000000000",
    ALIPAY_PRIVATE_KEY: privateKey,
    ALIPAY_PUBLIC_KEY: publicKey,
    OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
    OFFERDESK_ALLOWED_ORIGIN: "https://8npyvz5bd8-lang.github.io",
    OFFERDESK_AMOUNT: "29.00",
    OFFERDESK_LICENSE_PRIVATE_JWK: JSON.stringify(privateJwk)
  }
});
const connected = await readFile(outFile, "utf8");
assert.equal(result.envReport.failed, 0);
assert.equal(result.service.order.orderId, "OD-20260611203000-ABCDEF123456ABCDEF123456");
assert.ok(connected.includes('autoPaymentApiBase: "https://pay.offerdesk.com"'));
assert.deepEqual(calls, [
  "https://pay.offerdesk.com/api/health",
  "https://pay.offerdesk.com/api/create-order",
  "https://pay.offerdesk.com/api/order-status?order_id=OD-20260611203000-ABCDEF123456ABCDEF123456",
  "https://pay.offerdesk.com/api/health"
]);

await assert.rejects(() => finalizeAlipayLaunch({
  apiBase: "https://pay.offerdesk.com",
  config: configFile,
  out: outFile,
  fetchImpl: okFetch,
  env: {
    ALIPAY_APP_ID: "你的支付宝应用ID"
  }
}), /预检失败/);

await rm(tempRoot, { recursive: true, force: true });

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

console.log("finalize alipay launch tests passed");
