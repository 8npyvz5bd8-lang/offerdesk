import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export async function generateLicenseKeypair({
  privateOut = "secrets/offerdesk-license-private.jwk.json",
  publicOut = "secrets/offerdesk-license-public.jwk.json"
} = {}) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

  await mkdir(dirname(privateOut), { recursive: true });
  await mkdir(dirname(publicOut), { recursive: true });
  await writeFile(privateOut, `${JSON.stringify(privateJwk, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await writeFile(publicOut, `${JSON.stringify(publicJwk, null, 2)}\n`, "utf8");

  return { privateOut, publicOut, publicJwk };
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key.startsWith("--")) {
      throw new Error(`无法识别参数：${key}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：${key}`);
    }
    values[key.slice(2)] = value;
    index += 1;
  }
  return {
    privateOut: values["private-out"] || "secrets/offerdesk-license-private.jwk.json",
    publicOut: values["public-out"] || "secrets/offerdesk-license-public.jwk.json"
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await generateLicenseKeypair(parseArgs(process.argv.slice(2)));
    console.log(`授权私钥已写入：${result.privateOut}`);
    console.log(`授权公钥已写入：${result.publicOut}`);
    console.log("把下面的 publicJwk 放进 app-config.js 的 licensePublicKey：");
    console.log(JSON.stringify(result.publicJwk, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
