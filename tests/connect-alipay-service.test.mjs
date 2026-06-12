import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkAlipayServiceHealth,
  connectAlipayService,
  parseArgs,
  parseOfferDeskConfig
} from "../scripts/connect-alipay-service.mjs";
import { createConfigText } from "../scripts/write-config.mjs";

const publicKey = {
  kty: "EC",
  crv: "P-256",
  x: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  y: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
};

const tempRoot = await mkdtemp(join(tmpdir(), "offerdesk-connect-alipay-"));
const configFile = join(tempRoot, "app-config.js");
const outFile = join(tempRoot, "connected-config.js");

const signedConfig = createConfigText({
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseProvider: "signed",
  licensePublicKey: publicKey,
  supportEmail: "support@offerdesk.com"
});
await writeFile(configFile, signedConfig, "utf8");

assert.deepEqual(parseArgs([
  "--api-base",
  "https://pay.offerdesk.com/",
  "--config",
  configFile,
  "--out",
  outFile
]), {
  apiBase: "https://pay.offerdesk.com/",
  config: configFile,
  out: outFile
});

assert.equal(parseOfferDeskConfig(signedConfig).paymentQrImage, "./launch/payment-alipay.jpeg");
assert.equal(parseOfferDeskConfig(signedConfig).licenseProvider, "signed");
assert.deepEqual(parseOfferDeskConfig(signedConfig).licensePublicKey, publicKey);

const okFetch = async (url, options) => {
  assert.equal(url, "https://pay.offerdesk.com/api/health");
  assert.equal(options.headers.Accept, "application/json");
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        service: "offerdesk-alipay-payment",
        alipayConfigured: true,
        offerdeskConfigured: true,
        ready: true
      };
    }
  };
};

const health = await checkAlipayServiceHealth("https://pay.offerdesk.com/", okFetch);
assert.equal(health.ready, true);

const result = await connectAlipayService({
  apiBase: "https://pay.offerdesk.com/",
  config: configFile,
  out: outFile,
  fetchImpl: okFetch
});
const connected = await readFile(result.output, "utf8");
assert.equal(result.apiBase, "https://pay.offerdesk.com");
assert.ok(connected.includes('autoPaymentApiBase: "https://pay.offerdesk.com"'));
assert.ok(connected.includes('paymentQrImage: "./launch/payment-alipay.jpeg"'));
assert.ok(connected.includes('licenseProvider: "signed"'));
assert.ok(connected.includes('"crv":"P-256"'));

await assert.rejects(() => checkAlipayServiceHealth("https://pay.offerdesk.com", async () => ({
  ok: true,
  status: 200,
  async json() {
    return {
      service: "offerdesk-alipay-payment",
      ready: false,
      missingRequirements: ["ALIPAY_APP_ID", "OFFERDESK_PUBLIC_BASE_URL"]
    };
  }
})), /ALIPAY_APP_ID.*OFFERDESK_PUBLIC_BASE_URL/u);

await assert.rejects(() => checkAlipayServiceHealth("https://pay.offerdesk.com", async () => ({
  ok: true,
  status: 200,
  async json() {
    return { service: "wrong-service", ready: true };
  }
})), /类型不正确/);

await assert.rejects(() => connectAlipayService({
  apiBase: "http://pay.offerdesk.com",
  config: configFile,
  out: outFile,
  fetchImpl: okFetch
}), /https/);

const localConfig = createConfigText({
  checkoutUrl: "https://pay.offerdesk.com/checkout",
  licenseCode: "OFFERDESK-DEMO-2026",
  supportEmail: "support@offerdesk.com"
});
await writeFile(configFile, localConfig, "utf8");
await assert.rejects(() => connectAlipayService({
  apiBase: "https://pay.offerdesk.com",
  config: configFile,
  out: outFile,
  fetchImpl: okFetch
}), /signed/);

await rm(tempRoot, { recursive: true, force: true });

console.log("connect alipay service tests passed");
