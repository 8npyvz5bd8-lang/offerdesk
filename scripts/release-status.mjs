import { stat, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { validateAcceptanceText } from "./validate-acceptance.mjs";

const root = new URL("../", import.meta.url);

export function buildReleaseStatus({ configText, acceptanceText, artifacts }) {
  const checkoutUrl = readConfigValue(configText, "checkoutUrl");
  const autoCheckoutUrl = readConfigValue(configText, "autoCheckoutUrl");
  const paymentQrImage = readConfigValue(configText, "paymentQrImage");
  const autoPaymentApiBase = readConfigValue(configText, "autoPaymentApiBase");
  const licenseProvider = readConfigValue(configText, "licenseProvider");
  const lemonSqueezyProductId = readConfigValue(configText, "lemonSqueezyProductId");
  const licensePublicKey = readConfigObject(configText, "licensePublicKey");
  const licenseHash = readConfigValue(configText, "licenseHash");
  const supportEmail = readConfigValue(configText, "supportEmail");
  const acceptanceChecks = validateAcceptanceText(acceptanceText);
  const acceptancePass = acceptanceChecks.length > 0 && acceptanceChecks.every((item) => item.pass);
  const autoPaymentReady = isAutomaticPaymentReady({
    autoCheckoutUrl,
    autoPaymentApiBase,
    licenseProvider,
    lemonSqueezyProductId,
    licensePublicKey
  });

  const checks = [
    {
      name: "真实收款方式",
      pass: isRealHttpsUrl(autoCheckoutUrl) || isRealHttpsUrl(checkoutUrl) || isRealPaymentQrImage(paymentQrImage),
      fix: "准备真实付款链接或收款码图片。"
    },
    {
      name: "支付宝自动收款发码",
      pass: autoPaymentReady,
      fix: "部署 scripts/alipay-payment-server.mjs，把服务地址写入 app-config.js 的 autoPaymentApiBase。"
    },
    {
      name: "唯一授权配置",
      pass: isSignedProvider(licenseProvider)
        ? isValidLicensePublicKey(licensePublicKey)
        : autoPaymentReady || /^[a-f0-9]{64}$/.test(licenseHash),
      fix: "生成授权公私钥，把公钥写入 app-config.js，私钥留在服务器。"
    },
    {
      name: "真实客服邮箱",
      pass: isRealEmail(supportEmail),
      fix: "准备真实客服邮箱。"
    },
    {
      name: "发布目录",
      pass: Boolean(artifacts.releaseDir),
      fix: "运行 scripts/prepare-release.mjs 或 scripts/build-release.mjs。"
    },
    {
      name: "上传压缩包",
      pass: Boolean(artifacts.uploadZip),
      fix: "运行 scripts/prepare-release.mjs 或 scripts/build-upload-zip.mjs。"
    },
    {
      name: "自动邮件或补发邮件",
      pass: autoPaymentReady || Boolean(artifacts.deliveryEmail),
      fix: "接入平台自动授权邮件，或运行 scripts/create-delivery-email.mjs 生成补发邮件。"
    },
    {
      name: "真实付款验收",
      pass: acceptancePass,
      fix: "完成一笔真实付款后填写 launch/release-acceptance.md。"
    }
  ];

  return {
    checks,
    canSell: checks.every((item) => item.pass),
    stage: getStage(checks),
    nextStep: getNextStep(checks)
  };
}

export function printReleaseStatus(status) {
  const passed = status.checks.filter((item) => item.pass).length;
  const failed = status.checks.length - passed;

  console.log("OfferDesk 上架状态");
  console.log(`可以公开售卖：${status.canSell ? "是" : "否"}`);
  console.log(`当前阶段：${status.stage}`);
  console.log(`通过：${passed}`);
  console.log(`失败：${failed}`);
  console.log("");

  for (const item of status.checks) {
    console.log(`${item.pass ? "OK" : "FAIL"} ${item.name}`);
    if (!item.pass) {
      console.log(`  下一步：${item.fix}`);
    }
  }

  console.log("");
  console.log(`最先要做：${status.nextStep}`);
}

function getStage(checks) {
  if (!checks[0].pass) {
    return "缺真实收款方式";
  }

  if (!checks[1].pass) {
    return "待部署支付宝自动收款服务";
  }

  if (!checks[2].pass || !checks[3].pass) {
    return "缺授权或客服配置";
  }

  const missingReleasePackage = !checks[4].pass || !checks[5].pass;
  if (missingReleasePackage) {
    return "待生成发布包";
  }

  if (!checks[6].pass) {
    return "待配置自动邮件或补发邮件";
  }

  if (!checks[7].pass) {
    return "待真实付款验收";
  }

  return "可以公开售卖";
}

function getNextStep(checks) {
  const missingConfig = checks.slice(0, 4).filter((item) => !item.pass);
  if (missingConfig.length > 0) {
    return `补齐：${missingConfig.map((item) => item.name).join("、")}。`;
  }

  if (!checks[4].pass || !checks[5].pass) {
    return "运行 scripts/build-upload-zip.mjs 生成发布目录和上传压缩包。";
  }

  if (!checks[6].pass) {
    return "自动服务未上线前，先运行 scripts/issue-signed-license.mjs 生成补发授权码。";
  }

  if (!checks[7].pass) {
    return "完成真实付款测试，并填写 launch/release-acceptance.md。";
  }

  return "可以公开售卖，并开始发首批获客内容。";
}

function isRealHttpsUrl(value) {
  return /^https:\/\/.+/.test(value) && !containsPlaceholder(value) && !isInternalOfferDeskPaymentPage(value);
}

function isRealEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && !containsPlaceholder(value);
}

function isRealPaymentQrImage(value) {
  return /^\.\/.+\.(png|jpe?g|webp)$/i.test(value) && !containsPlaceholder(value);
}

function containsPlaceholder(value) {
  const lower = String(value || "").toLowerCase();
  return lower.includes("example") || lower.includes("your-") || value.includes("你的");
}

function isAutomaticPaymentReady({ autoCheckoutUrl, autoPaymentApiBase, licenseProvider, lemonSqueezyProductId, licensePublicKey }) {
  if (isSignedProvider(licenseProvider)) {
    return isRealHttpsUrl(autoPaymentApiBase) && isValidLicensePublicKey(licensePublicKey);
  }

  return String(licenseProvider || "").trim().toLowerCase() === "lemonsqueezy" &&
    isRealHttpsUrl(autoCheckoutUrl) &&
    /^\d+$/.test(String(lemonSqueezyProductId || "").trim());
}

function isInternalOfferDeskPaymentPage(value) {
  return /github\.io\/graphics-debug\/offerdesk\/(buy|pay|after-pay)\.html/.test(String(value || ""));
}

function readConfigValue(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*["']([^"']*)["']`));
  return match ? match[1].trim() : "";
}

function readConfigObject(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*(\\{[^;]*?\\})\\s*,?\\n`));
  if (!match) {
    return {};
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function isSignedProvider(value) {
  return String(value || "").trim().toLowerCase() === "signed";
}

function isValidLicensePublicKey(value) {
  return Boolean(
    value &&
      value.kty === "EC" &&
      value.crv === "P-256" &&
      typeof value.x === "string" &&
      value.x.length > 20 &&
      typeof value.y === "string" &&
      value.y.length > 20
  );
}

async function exists(file) {
  try {
    await stat(new URL(file, root));
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const configText = await readFile(new URL("../app-config.js", import.meta.url), "utf8");
    const acceptanceText = await readFile(new URL("../launch/release-acceptance.md", import.meta.url), "utf8");
    const status = buildReleaseStatus({
      configText,
      acceptanceText,
      artifacts: {
        releaseDir: await exists("dist/offerdesk-release"),
        uploadZip: await exists("dist/offerdesk-release.zip"),
        deliveryEmail: await exists("dist/post-purchase-email.txt")
      }
    });

    printReleaseStatus(status);
    if (!status.canSell) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
