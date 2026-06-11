import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createSignedLicensePayload, signLicensePayload } from "../src/license.js";

export async function issueSignedLicense({
  email,
  orderId,
  name,
  privateKeyFile = "secrets/offerdesk-license-private.jwk.json",
  out = ""
}) {
  const privateJwk = JSON.parse(await readFile(privateKeyFile, "utf8"));
  const payload = createSignedLicensePayload({ email, orderId, name });
  const licenseCode = await signLicensePayload(payload, privateJwk);
  const text = [
    "OfferDesk 专业版唯一授权码",
    "",
    `订单号：${payload.orderId}`,
    `邮箱：${payload.email}`,
    `授权 ID：${payload.licenseId}`,
    "",
    licenseCode,
    ""
  ].join("\n");

  if (out) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, text, "utf8");
  }

  return { payload, licenseCode, text };
}

export function parseArgs(args) {
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
    email: values.email,
    orderId: values["order-id"],
    name: values.name || "",
    privateKeyFile: values["private-key-file"] || "secrets/offerdesk-license-private.jwk.json",
    out: values.out || ""
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await issueSignedLicense(parseArgs(process.argv.slice(2)));
    console.log(result.text);
    if (process.argv.includes("--out")) {
      console.log("注意：这个文件包含明文授权码，不要放进网页发布包。");
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
