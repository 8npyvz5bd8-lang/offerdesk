import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { scanTargetsForLicenseCode } from "./check-license-leak.mjs";
import { writeDeliveryEmail } from "./create-delivery-email.mjs";
import { writeConfig } from "./write-config.mjs";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

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
    checkoutUrl: values["checkout-url"],
    paymentQrImage: values["payment-qr-image"],
    appUrl: values["app-url"],
    licenseCode: values["license-code"],
    supportEmail: values["support-email"],
    configOut: values["config-out"] || "app-config.js",
    emailOut: values["email-out"] || "dist/post-purchase-email.txt"
  };
}

export async function prepareRelease(options, controls = {}) {
  const configOut = resolveOutput(options.configOut || "app-config.js");
  const emailOut = resolveOutput(options.emailOut || "dist/post-purchase-email.txt");
  const shouldBuild = controls.build !== false;
  const runBuild = controls.runBuild || run;

  await mkdir(dirname(configOut), { recursive: true });
  await mkdir(dirname(emailOut), { recursive: true });

  await writeConfig({
    checkoutUrl: options.checkoutUrl,
    paymentQrImage: options.paymentQrImage,
    licenseCode: options.licenseCode,
    supportEmail: options.supportEmail,
    out: configOut
  });

  await writeDeliveryEmail({
    appUrl: options.appUrl,
    licenseCode: options.licenseCode,
    supportEmail: options.supportEmail,
    out: emailOut
  });

  if (shouldBuild) {
    runBuild(process.execPath, ["scripts/build-upload-zip.mjs"]);
    const leaks = await scanTargetsForLicenseCode(
      [resolveOutput("dist/offerdesk-release"), resolveOutput("dist/offerdesk-release.zip")],
      options.licenseCode
    );
    if (leaks.length > 0) {
      throw new Error(`发布包包含明文授权码：${leaks.join(", ")}`);
    }
  }

  return {
    configOut,
    emailOut,
    releaseDir: resolveOutput("dist/offerdesk-release"),
    uploadZip: resolveOutput("dist/offerdesk-release.zip")
  };
}

function resolveOutput(value) {
  if (!value) {
    throw new Error("缺少输出路径。");
  }
  return resolve(rootPath, value);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await prepareRelease(parseArgs(process.argv.slice(2)));
    console.log(`配置已写入：${result.configOut}`);
    console.log(`付款后邮件已写入：${result.emailOut}`);
    console.log(`发布目录：${result.releaseDir}`);
    console.log(`上传压缩包：${result.uploadZip}`);
    console.log("注意：付款后邮件包含明文授权码，不要放进网页发布包。");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
