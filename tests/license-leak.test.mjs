import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createZipPackage } from "../scripts/build-upload-zip.mjs";
import {
  parseArgs,
  scanTargetForLicenseCode,
  scanTargetsForLicenseCode
} from "../scripts/check-license-leak.mjs";

const tempRoot = join(tmpdir(), `offerdesk-leak-${Date.now()}`);
const cleanDir = join(tempRoot, "clean");
const leakDir = join(tempRoot, "leak");
const zipFile = join(tempRoot, "clean.zip");
const licenseCode = "OFFERDESK-PRO-2026";

await mkdir(cleanDir, { recursive: true });
await mkdir(leakDir, { recursive: true });
await writeFile(join(cleanDir, "app-config.js"), "licenseHash: \"hashed-only\"", "utf8");
await writeFile(join(leakDir, "bad.txt"), `code=${licenseCode}`, "utf8");
await createZipPackage({
  sourceDir: pathToFileURL(`${cleanDir}/`),
  outputFile: pathToFileURL(zipFile)
});

assert.deepEqual(
  parseArgs([
    "--license-code",
    licenseCode,
    "--target",
    cleanDir,
    "--target",
    zipFile
  ]),
  {
    licenseCode,
    targets: [cleanDir, zipFile]
  }
);

assert.deepEqual(await scanTargetForLicenseCode(cleanDir, licenseCode), []);
assert.deepEqual(await scanTargetForLicenseCode(zipFile, licenseCode), []);

const leaks = await scanTargetForLicenseCode(leakDir, licenseCode);
const combined = await scanTargetsForLicenseCode([cleanDir, leakDir], licenseCode);

await rm(tempRoot, { recursive: true, force: true });

assert.equal(leaks.length, 1);
assert.equal(combined.length, 1);
assert.ok(leaks[0].endsWith("bad.txt"));
await assert.rejects(() => scanTargetsForLicenseCode([cleanDir], "short"));

console.log("license leak tests passed");
