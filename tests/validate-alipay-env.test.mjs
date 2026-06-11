import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseArgs,
  parseEnvText,
  validateAlipayEnv
} from "../scripts/validate-alipay-env.mjs";

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
const privateJwkText = JSON.stringify(privateJwk);

assert.deepEqual(parseArgs(["--file", "deploy.env"]), { file: "deploy.env" });
assert.deepEqual(parseEnvText(`
# comment
ALIPAY_APP_ID=2021000000000000
OFFERDESK_AMOUNT="29.00"
ALIPAY_PRIVATE_KEY=first\\nsecond
`), {
  ALIPAY_APP_ID: "2021000000000000",
  OFFERDESK_AMOUNT: "29.00",
  ALIPAY_PRIVATE_KEY: "first\nsecond"
});

const okReport = await validateAlipayEnv({
  env: {
    ALIPAY_APP_ID: "2021000000000000",
    ALIPAY_PRIVATE_KEY: privateKey,
    ALIPAY_PUBLIC_KEY: publicKey,
    OFFERDESK_PUBLIC_BASE_URL: "https://pay.offerdesk.com",
    OFFERDESK_ALLOWED_ORIGIN: "https://8npyvz5bd8-lang.github.io",
    OFFERDESK_AMOUNT: "29.00",
    OFFERDESK_LICENSE_PRIVATE_JWK: privateJwkText
  }
});
assert.equal(okReport.failed, 0);
assert.equal(okReport.passed, 7);

const badReport = await validateAlipayEnv({
  env: {
    ALIPAY_APP_ID: "你的支付宝应用ID",
    ALIPAY_PRIVATE_KEY: "bad",
    ALIPAY_PUBLIC_KEY: "bad",
    OFFERDESK_PUBLIC_BASE_URL: "http://example.com",
    OFFERDESK_ALLOWED_ORIGIN: "你的前端地址",
    OFFERDESK_AMOUNT: "0",
    OFFERDESK_LICENSE_PRIVATE_JWK: "{}"
  }
});
assert.equal(badReport.failed, 7);
assert.ok(badReport.checks.every((item) => item.pass === false));

const tempRoot = await mkdtemp(join(tmpdir(), "offerdesk-alipay-env-"));
const envFile = join(tempRoot, "deploy.env");
const privateKeyFile = join(tempRoot, "alipay-private.pem");
const publicKeyFile = join(tempRoot, "alipay-public.pem");
const licenseFile = join(tempRoot, "license-private.jwk.json");
await writeFile(privateKeyFile, privateKey, "utf8");
await writeFile(publicKeyFile, publicKey, "utf8");
await writeFile(licenseFile, privateJwkText, "utf8");
await writeFile(envFile, [
  "ALIPAY_APP_ID=2021000000000000",
  `ALIPAY_PRIVATE_KEY_FILE=${privateKeyFile}`,
  `ALIPAY_PUBLIC_KEY_FILE=${publicKeyFile}`,
  "OFFERDESK_PUBLIC_BASE_URL=https://pay.offerdesk.com",
  "OFFERDESK_ALLOWED_ORIGIN=https://8npyvz5bd8-lang.github.io",
  "OFFERDESK_AMOUNT=29.00",
  `OFFERDESK_LICENSE_PRIVATE_KEY_FILE=${licenseFile}`
].join("\n"), "utf8");

const fileReport = await validateAlipayEnv({ file: envFile, env: {} });
assert.equal(fileReport.failed, 0);
assert.equal(fileReport.passed, 7);

await rm(tempRoot, { recursive: true, force: true });

console.log("validate alipay env tests passed");
