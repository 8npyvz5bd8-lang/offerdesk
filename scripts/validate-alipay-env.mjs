import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function validateAlipayEnv(options = {}) {
  const env = {
    ...(options.env || process.env),
    ...(options.file ? await readEnvFile(options.file) : {})
  };

  const checks = [
    checkValue("ALIPAY_APP_ID", env.ALIPAY_APP_ID, "填写支付宝开放平台应用 ID。"),
    await checkPrivateKey(env),
    await checkPublicKey(env),
    checkUrl("OFFERDESK_PUBLIC_BASE_URL", env.OFFERDESK_PUBLIC_BASE_URL, "填写公网支付服务地址。"),
    checkAllowedOrigin(env.OFFERDESK_ALLOWED_ORIGIN),
    checkAmount(env.OFFERDESK_AMOUNT),
    await checkLicensePrivateJwk(env),
    checkEmailDelivery(env)
  ];

  return {
    passed: checks.filter((item) => item.pass).length,
    failed: checks.filter((item) => !item.pass).length,
    checks
  };
}

export function parseEnvText(text) {
  const env = {};
  for (const rawLine of String(text || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = normalizeEnvValue(line.slice(index + 1).trim());
    if (key) {
      env[key] = value;
    }
  }
  return env;
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
  return { file: values.file };
}

async function readEnvFile(file) {
  return parseEnvText(await readFile(resolveInput(file), "utf8"));
}

function checkValue(name, value, fix) {
  return {
    name,
    pass: hasRealValue(value),
    fix
  };
}

async function checkPrivateKey(env) {
  const key = await readSecretValue(env.ALIPAY_PRIVATE_KEY, env.ALIPAY_PRIVATE_KEY_FILE);
  return {
    name: "ALIPAY_PRIVATE_KEY",
    pass: hasRealValue(key) && canCreatePrivateKey(key),
    fix: "填写支付宝应用私钥，或设置 ALIPAY_PRIVATE_KEY_FILE 指向私钥文件。"
  };
}

async function checkPublicKey(env) {
  const key = await readSecretValue(env.ALIPAY_PUBLIC_KEY, env.ALIPAY_PUBLIC_KEY_FILE);
  return {
    name: "ALIPAY_PUBLIC_KEY",
    pass: hasRealValue(key) && canCreatePublicKey(key),
    fix: "填写支付宝公钥，或设置 ALIPAY_PUBLIC_KEY_FILE 指向公钥文件。"
  };
}

function checkUrl(name, value, fix) {
  const text = String(value || "").trim().replace(/\/+$/u, "");
  return {
    name,
    pass: /^https:\/\/.+/u.test(text) && !containsPlaceholder(text) && !text.includes(".test") && !text.includes(".invalid"),
    fix
  };
}

function checkAllowedOrigin(value) {
  const text = String(value || "").trim();
  return {
    name: "OFFERDESK_ALLOWED_ORIGIN",
    pass: !text || text === "*" || (/^https:\/\/.+/u.test(text) && !containsPlaceholder(text)),
    fix: "填写 GitHub Pages 来源，例如 https://8npyvz5bd8-lang.github.io。"
  };
}

function checkAmount(value) {
  const text = String(value || "29.00").trim();
  const amount = Number(text);
  return {
    name: "OFFERDESK_AMOUNT",
    pass: Number.isFinite(amount) && amount > 0,
    fix: "填写正数金额，例如 29.00。"
  };
}

async function checkLicensePrivateJwk(env) {
  const value = await readSecretValue(env.OFFERDESK_LICENSE_PRIVATE_JWK, env.OFFERDESK_LICENSE_PRIVATE_KEY_FILE);
  return {
    name: "OFFERDESK_LICENSE_PRIVATE_JWK",
    pass: hasRealValue(value) && isValidLicensePrivateJwk(value),
    fix: "把 secrets/offerdesk-license-private.jwk.json 的整段 JSON 写入 OFFERDESK_LICENSE_PRIVATE_JWK。"
  };
}

function checkEmailDelivery(env) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.OFFERDESK_EMAIL_FROM || "").trim();
  if (!apiKey && !from) {
    return {
      name: "付款成功邮件配置",
      pass: true,
      fix: "如需自动邮件，填写 RESEND_API_KEY 和 OFFERDESK_EMAIL_FROM。"
    };
  }
  return {
    name: "付款成功邮件配置",
    pass: hasRealValue(apiKey) && hasRealValue(from) && hasEmailAddress(from),
    fix: "如需自动邮件，填写 RESEND_API_KEY 和 OFFERDESK_EMAIL_FROM，例如 OfferDesk <support@your-domain.com>。"
  };
}

async function readSecretValue(inlineValue, fileValue) {
  const inline = String(inlineValue || "").trim();
  if (inline) {
    return inline;
  }
  const file = String(fileValue || "").trim();
  if (!file || containsPlaceholder(file)) {
    return "";
  }
  try {
    return readFile(resolveInput(file), "utf8");
  } catch {
    return "";
  }
}

function canCreatePrivateKey(value) {
  try {
    createPrivateKey(toPem(value, "PRIVATE KEY"));
    return true;
  } catch {
    return false;
  }
}

function canCreatePublicKey(value) {
  try {
    createPublicKey(toPem(value, "PUBLIC KEY"));
    return true;
  } catch {
    return false;
  }
}

function isValidLicensePrivateJwk(value) {
  try {
    const jwk = JSON.parse(String(value || ""));
    return Boolean(
      jwk &&
        jwk.kty === "EC" &&
        jwk.crv === "P-256" &&
        typeof jwk.d === "string" &&
        jwk.d.length > 20 &&
        typeof jwk.x === "string" &&
        jwk.x.length > 20 &&
        typeof jwk.y === "string" &&
        jwk.y.length > 20
    );
  } catch {
    return false;
  }
}

function hasRealValue(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !containsPlaceholder(text);
}

function containsPlaceholder(value) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  return lower.includes("example") ||
    lower.includes("your-") ||
    text.includes("你的") ||
    text.includes("把 ") ||
    text.includes("放到这里");
}

function hasEmailAddress(value) {
  return /[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+/u.test(String(value || ""));
}

function normalizeEnvValue(value) {
  const unquoted = value.replace(/^["']|["']$/gu, "");
  return unquoted.replaceAll("\\n", "\n");
}

function toPem(value, label) {
  const clean = String(value || "").trim().replaceAll("\\n", "\n");
  if (clean.includes("-----BEGIN")) {
    return clean;
  }
  const body = clean.replace(/\s+/gu, "").match(/.{1,64}/gu)?.join("\n") || "";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

function resolveInput(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("缺少环境变量文件。");
  }
  return isAbsolute(text) ? text : resolve(new URL("../", import.meta.url).pathname, text);
}

function printReport(report) {
  console.log("OfferDesk 支付宝部署环境预检");
  console.log(`通过：${report.passed}`);
  console.log(`失败：${report.failed}`);
  console.log("");
  for (const item of report.checks) {
    console.log(`${item.pass ? "OK" : "FAIL"} ${item.name}`);
    if (!item.pass) {
      console.log(`  处理：${item.fix}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await validateAlipayEnv(parseArgs(process.argv.slice(2)));
    printReport(report);
    if (report.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
