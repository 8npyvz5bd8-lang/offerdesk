import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { extractLocalRefs } from "../scripts/check-static-assets.mjs";

assert.deepEqual(
  extractLocalRefs(`
    <link rel="stylesheet" href="./styles.css">
    <script src="./src/app.js"></script>
    <img src="./launch/offerdesk-screenshot.jpg">
    <a href="#top">top</a>
    <a href="mailto:support@example.com">mail</a>
  `),
  [
    "launch/offerdesk-screenshot.jpg",
    "src/app.js",
    "styles.css"
  ]
);

const result = spawnSync(process.execPath, ["scripts/check-static-assets.mjs"], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8"
});

assert.equal(result.status, 0);
assert.ok(result.stdout.includes("静态页面体检通过"));

console.log("static asset tests passed");
