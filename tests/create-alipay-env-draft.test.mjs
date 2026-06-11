import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAlipayEnvDraft,
  createAlipayEnvText,
  parseArgs
} from "../scripts/create-alipay-env-draft.mjs";
import { parseEnvText } from "../scripts/validate-alipay-env.mjs";

const configText = `window.OFFERDESK_CONFIG = {
  checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
  autoCheckoutUrl: "",
  autoPaymentApiBase: "",
  paymentQrImage: "./launch/payment-alipay.jpeg",
  licenseProvider: "signed",
  lemonSqueezyProductId: "",
  lemonSqueezyVariantId: "",
  licensePublicKey: {},
  licenseHash: "",
  supportEmail: "534403209@qq.com"
};`;

assert.deepEqual(parseArgs([
  "--out",
  "secrets/pay.env",
  "--public-base-url",
  "https://pay.example.com/",
  "--force"
]), {
  out: "secrets/pay.env",
  config: undefined,
  publicBaseUrl: "https://pay.example.com/",
  amount: undefined,
  dataFile: undefined,
  force: true
});

const text = createAlipayEnvText({
  config: {
    checkoutUrl: "https://8npyvz5bd8-lang.github.io/offerdesk/buy.html",
    supportEmail: "534403209@qq.com"
  },
  publicBaseUrl: "https://pay.offerdesk.com/"
});
const parsed = parseEnvText(text);
assert.equal(parsed.ALIPAY_APP_ID, "");
assert.equal(parsed.ALIPAY_PRIVATE_KEY_FILE, "secrets/alipay-app-private.pem");
assert.equal(parsed.ALIPAY_PUBLIC_KEY_FILE, "secrets/alipay-public.pem");
assert.equal(parsed.OFFERDESK_PUBLIC_BASE_URL, "https://pay.offerdesk.com");
assert.equal(parsed.OFFERDESK_ALLOWED_ORIGIN, "https://8npyvz5bd8-lang.github.io");
assert.equal(parsed.OFFERDESK_LICENSE_PRIVATE_KEY_FILE, "secrets/offerdesk-license-private.jwk.json");
assert.equal(parsed.OFFERDESK_APP_URL, "https://8npyvz5bd8-lang.github.io/offerdesk/");
assert.equal(parsed.OFFERDESK_SUPPORT_EMAIL, "534403209@qq.com");
assert.equal(text.includes("OFFERDESK_LICENSE_PRIVATE_JWK="), false);

const tempRoot = await mkdtemp(join(tmpdir(), "offerdesk-alipay-draft-"));
const configFile = join(tempRoot, "app-config.js");
const outFile = join(tempRoot, "alipay.env");
await writeFile(configFile, configText, "utf8");

const result = await createAlipayEnvDraft({
  config: configFile,
  out: outFile
});
assert.equal(result.output, outFile);
assert.equal(await readFile(outFile, "utf8"), result.text);

await assert.rejects(
  () => createAlipayEnvDraft({ config: configFile, out: outFile }),
  /文件已存在/
);

await createAlipayEnvDraft({ config: configFile, out: outFile, force: true });
await rm(tempRoot, { recursive: true, force: true });

console.log("create alipay env draft tests passed");
