import { createHash } from "node:crypto";

const code = String(process.argv[2] || "").trim();

if (code.length < 8) {
  console.error("授权码至少 8 位。");
  process.exit(1);
}

const hash = createHash("sha256").update(code).digest("hex");

console.log(hash);
console.log("");
console.log("写入 app-config.js：");
console.log(`licenseHash: "${hash}",`);
