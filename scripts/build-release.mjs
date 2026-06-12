import { mkdir, cp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const outDir = new URL("../dist/offerdesk-release/", import.meta.url);

run(process.execPath, ["tests/pricing.test.mjs"]);
run(process.execPath, ["tests/license.test.mjs"]);
run(process.execPath, ["tests/signed-license.test.mjs"]);
run(process.execPath, ["tests/alipay-payment-server.test.mjs"]);
run(process.execPath, ["tests/templates.test.mjs"]);
run(process.execPath, ["tests/config-writer.test.mjs"]);
run(process.execPath, ["tests/connect-alipay-service.test.mjs"]);
run(process.execPath, ["tests/create-alipay-env-draft.test.mjs"]);
run(process.execPath, ["tests/validate-alipay-env.test.mjs"]);
run(process.execPath, ["tests/validate-alipay-service.test.mjs"]);
run(process.execPath, ["tests/finalize-alipay-launch.test.mjs"]);
run(process.execPath, ["tests/render-deployment.test.mjs"]);
run(process.execPath, ["tests/configure-lemonsqueezy.test.mjs"]);
run(process.execPath, ["tests/delivery-email.test.mjs"]);
run(process.execPath, ["tests/manual-fulfillment.test.mjs"]);
run(process.execPath, ["tests/payment-claim.test.mjs"]);
run(process.execPath, ["tests/fulfill-from-email.test.mjs"]);
run(process.execPath, ["tests/manual-checkout-flow.test.mjs"]);
run(process.execPath, ["tests/acceptance.test.mjs"]);
run(process.execPath, ["tests/upload-zip.test.mjs"]);
run(process.execPath, ["tests/license-leak.test.mjs"]);
run(process.execPath, ["tests/prepare-release.test.mjs"]);
run(process.execPath, ["tests/release-status.test.mjs"]);
run(process.execPath, ["tests/release-report.test.mjs"]);
run(process.execPath, ["tests/static-assets.test.mjs"]);
run(process.execPath, ["tests/promotion-page.test.mjs"]);
run(process.execPath, ["tests/verify-public-site.test.mjs"]);
run(process.execPath, ["tests/validate-outreach.test.mjs"]);
run(process.execPath, ["tests/auto-revenue-status.test.mjs"]);
run(process.execPath, ["scripts/validate-release.mjs"]);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const files = [
  "index.html",
  "sales.html",
  "share.html",
  "promotion.html",
  "pipeline.html",
  "buy.html",
  "pay.html",
  "after-pay.html",
  "share-copy.txt",
  "site.css",
  "styles.css",
  "app-config.js",
  "privacy.html",
  "terms.html",
  "refund.html",
  "sitemap.xml",
  "robots.txt",
  "vercel.json",
  "netlify.toml",
  "src",
  "launch"
];

for (const file of files) {
  await cp(new URL(file, root), new URL(file, outDir), { recursive: true });
}

console.log("release package ready: dist/offerdesk-release");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
