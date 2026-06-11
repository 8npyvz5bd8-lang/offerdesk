import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createZipPackage } from "../scripts/build-upload-zip.mjs";

const tempRoot = join(tmpdir(), `offerdesk-zip-${Date.now()}`);
const sourceDir = join(tempRoot, "release");
const outputFile = join(tempRoot, "offerdesk-release.zip");

await mkdir(sourceDir, { recursive: true });
await writeFile(join(sourceDir, "index.html"), "<h1>OfferDesk</h1>", "utf8");
await writeFile(join(sourceDir, "buyer-guide.md"), "买家说明", "utf8");

const created = await createZipPackage({
  sourceDir: pathToFileURL(`${sourceDir}/`),
  outputFile: pathToFileURL(outputFile)
});

const zipStats = await stat(created);
assert.ok(zipStats.size > 0);

const listResult = spawnSync("/usr/bin/unzip", ["-l", created], {
  encoding: "utf8"
});

await rm(tempRoot, { recursive: true, force: true });

assert.equal(listResult.status, 0);
assert.ok(listResult.stdout.includes("index.html"));
assert.ok(listResult.stdout.includes("buyer-guide.md"));

console.log("upload zip tests passed");
