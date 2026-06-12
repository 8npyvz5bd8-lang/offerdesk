import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseArgs,
  renderPublicSiteReport,
  verifyPublicSite
} from "../scripts/verify-public-site.mjs";

assert.deepEqual(parseArgs([
  "--base-url",
  "https://example.com/offerdesk",
  "--write",
  "launch/public-site-verification.json",
  "--file",
  "sales.html",
  "--no-fail"
]), {
  baseUrl: "https://example.com/offerdesk",
  write: "launch/public-site-verification.json",
  files: ["sales.html"],
  noFail: true
});
assert.deepEqual(parseArgs([
  "--retry-attempts",
  "3",
  "--retry-delay-ms",
  "10"
]), {
  baseUrl: undefined,
  write: undefined,
  files: undefined,
  retryAttempts: 3,
  retryDelayMs: 10,
  noFail: false
});
assert.throws(() => parseArgs(["--retry-attempts", "abc"]), /--retry-attempts/u);
assert.throws(() => parseArgs(["--retry-delay-ms", "-1"]), /--retry-delay-ms/u);

const tempRoot = await mkdtemp(join(tmpdir(), "offerdesk-public-site-"));
await writeFile(join(tempRoot, "sales.html"), "<h1>Sales</h1>\n", "utf8");
await writeFile(join(tempRoot, "buy.html"), "<h1>Buy</h1>\n", "utf8");

const okReport = await verifyPublicSite({
  rootPath: tempRoot,
  baseUrl: "https://example.com/offerdesk/",
  files: ["sales.html", "buy.html"],
  fetchImpl: async (url) => textResponse(url.endsWith("sales.html") ? "<h1>Sales</h1>\n" : "<h1>Buy</h1>\n")
});
assert.equal(okReport.ok, true);
assert.equal(okReport.files.length, 2);
assert.ok(renderPublicSiteReport(okReport).includes("通过：2"));

let retryCalls = 0;
const retryReport = await verifyPublicSite({
  rootPath: tempRoot,
  baseUrl: "https://example.com/offerdesk/",
  files: ["sales.html"],
  retryDelayMs: 0,
  fetchImpl: async () => {
    retryCalls += 1;
    if (retryCalls === 1) {
      throw new Error("temporary network error");
    }
    return textResponse("<h1>Sales</h1>\n");
  }
});
assert.equal(retryReport.ok, true);
assert.equal(retryCalls, 2);
await assert.rejects(() => verifyPublicSite({
  rootPath: tempRoot,
  baseUrl: "https://example.com/offerdesk/",
  files: ["sales.html"],
  retryAttempts: -1,
  fetchImpl: async () => textResponse("<h1>Sales</h1>\n")
}), /retryAttempts/u);

const badReport = await verifyPublicSite({
  rootPath: tempRoot,
  baseUrl: "https://example.com/offerdesk/",
  files: ["sales.html"],
  fetchImpl: async () => textResponse("<h1>Old</h1>\n")
});
assert.equal(badReport.ok, false);
assert.equal(badReport.files[0].ok, false);
assert.match(badReport.files[0].fix, /不一致/u);

await rm(tempRoot, { recursive: true, force: true });

function textResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body;
    }
  };
}

console.log("verify public site tests passed");
