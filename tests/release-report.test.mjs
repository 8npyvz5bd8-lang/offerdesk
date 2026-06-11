import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempConfig = join(tmpdir(), `offerdesk-invalid-${Date.now()}.js`);

await writeFile(tempConfig, `window.OFFERDESK_CONFIG = {
  checkoutUrl: "",
  paymentQrImage: "",
  licenseHash: "",
  supportEmail: ""
};
`, "utf8");

const result = spawnSync(process.execPath, ["scripts/validate-release.mjs", "--config", tempConfig], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8"
});

await rm(tempConfig, { force: true });

assert.equal(result.status, 1);
assert.ok(result.stdout.includes("OfferDesk 发布检查"));
assert.ok(result.stdout.includes("FAIL 真实收款方式"));
assert.ok(result.stdout.includes("FAIL 授权码哈希"));
assert.ok(result.stdout.includes("FAIL 真实客服邮箱"));
assert.equal(result.stderr.includes("AssertionError"), false);

console.log("release report tests passed");
