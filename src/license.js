export function normalizeLicenseHash(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidLicenseHash(value) {
  return /^[a-f0-9]{64}$/.test(normalizeLicenseHash(value));
}

export function getLicenseProvider(config) {
  return String(config?.licenseProvider || "local").trim().toLowerCase();
}

export function isLemonSqueezyProvider(config) {
  return getLicenseProvider(config) === "lemonsqueezy";
}

export function isSignedLicenseProvider(config) {
  return getLicenseProvider(config) === "signed";
}

export function isValidLicensePublicKey(value) {
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

export function getDeliveryStatus(unlocked) {
  if (unlocked) {
    return {
      level: "ready",
      title: "可正式交付",
      body: "专业版已解锁，水印已移除。导出 PDF 后可以发给客户。"
    };
  }

  return {
    level: "locked",
    title: "还不能正式交付",
    body: "免费版会显示水印。付款并输入授权码后，水印才会消失。"
  };
}

export function createSignedLicensePayload({ email, orderId, name, issuedAt, licenseId }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanOrderId = String(orderId || "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    throw new Error("买家邮箱格式不正确。");
  }
  if (!/^OD[-A-Z0-9]{8,}$/i.test(cleanOrderId)) {
    throw new Error("订单号格式不正确。");
  }

  return {
    v: 2,
    product: "offerdesk-pro",
    licenseId: licenseId || createLicenseId(),
    orderId: cleanOrderId,
    email: cleanEmail,
    name: String(name || "").trim(),
    issuedAt: issuedAt || new Date().toISOString()
  };
}

export async function signLicensePayload(payload, privateJwk) {
  if (!privateJwk?.d) {
    throw new Error("缺少授权私钥。");
  }

  const payloadPart = objectToBase64Url(payload);
  const signature = await getSubtle().sign(
    { name: "ECDSA", hash: "SHA-256" },
    await getSubtle().importKey(
      "jwk",
      privateJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    ),
    new TextEncoder().encode(payloadPart)
  );

  return `OD2.${payloadPart}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export function parseSignedLicenseCode(code) {
  const parts = String(code || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "OD2") {
    throw new Error("授权码格式不正确。");
  }

  return {
    payloadPart: parts[1],
    signaturePart: parts[2],
    payload: base64UrlToObject(parts[1])
  };
}

export async function verifySignedLicenseCode(code, publicJwk) {
  if (!isValidLicensePublicKey(publicJwk)) {
    throw new Error("还没有配置授权公钥，不能解锁。");
  }

  const parsed = parseSignedLicenseCode(code);
  const valid = await getSubtle().verify(
    { name: "ECDSA", hash: "SHA-256" },
    await getSubtle().importKey(
      "jwk",
      publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    ),
    base64UrlToBytes(parsed.signaturePart),
    new TextEncoder().encode(parsed.payloadPart)
  );

  if (!valid) {
    throw new Error("授权码签名无效。");
  }
  if (parsed.payload?.product !== "offerdesk-pro" || parsed.payload?.v !== 2) {
    throw new Error("授权码不属于 OfferDesk 专业版。");
  }
  if (!parsed.payload?.licenseId || !parsed.payload?.orderId || !parsed.payload?.email) {
    throw new Error("授权码内容不完整。");
  }

  return {
    provider: "signed",
    key: String(code || "").trim(),
    licenseId: parsed.payload.licenseId,
    orderId: parsed.payload.orderId,
    customerEmail: parsed.payload.email,
    issuedAt: parsed.payload.issuedAt || "",
    checkedAt: new Date().toISOString()
  };
}

export async function hashLicenseCode(code) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    return "";
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("当前浏览器不支持本地授权校验");
  }

  const bytes = new TextEncoder().encode(normalizedCode);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createLicenseId() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `ODL-${Date.now().toString(36).toUpperCase()}-${bytesToBase64Url(bytes).toUpperCase()}`;
}

function objectToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlToObject(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function bytesToBase64Url(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(String(value || ""), "base64url"));
  }

  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getSubtle() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前环境不支持授权签名校验。");
  }
  return globalThis.crypto.subtle;
}

export async function activateLemonSqueezyLicense({ licenseKey, instanceName, config }) {
  const payload = await postLemonSqueezyLicense("activate", {
    license_key: String(licenseKey || "").trim(),
    instance_name: String(instanceName || "OfferDesk").trim()
  });
  assertValidLemonSqueezyLicense(payload, config);

  return {
    provider: "lemonsqueezy",
    key: payload.license_key?.key || String(licenseKey || "").trim(),
    instanceId: payload.instance?.id || "",
    status: payload.license_key?.status || "active",
    productId: payload.meta?.product_id ? String(payload.meta.product_id) : "",
    variantId: payload.meta?.variant_id ? String(payload.meta.variant_id) : "",
    orderId: payload.meta?.order_id ? String(payload.meta.order_id) : "",
    customerEmail: payload.meta?.customer_email || "",
    checkedAt: new Date().toISOString()
  };
}

export async function validateLemonSqueezyLicense({ licenseKey, instanceId, config }) {
  const data = {
    license_key: String(licenseKey || "").trim()
  };
  if (instanceId) {
    data.instance_id = String(instanceId).trim();
  }

  const payload = await postLemonSqueezyLicense("validate", data);
  assertValidLemonSqueezyLicense(payload, config);
  return payload;
}

function assertValidLemonSqueezyLicense(payload, config) {
  if (!payload?.valid) {
    throw new Error(payload?.error || "授权码无效。");
  }

  const status = String(payload.license_key?.status || "").toLowerCase();
  if (!["active", "inactive"].includes(status)) {
    throw new Error("授权码不是可用状态。");
  }

  const expectedProductId = String(config?.lemonSqueezyProductId || "").trim();
  const expectedVariantId = String(config?.lemonSqueezyVariantId || "").trim();
  const actualProductId = payload.meta?.product_id ? String(payload.meta.product_id) : "";
  const actualVariantId = payload.meta?.variant_id ? String(payload.meta.variant_id) : "";

  if (expectedProductId && actualProductId !== expectedProductId) {
    throw new Error("授权码不属于 OfferDesk 产品。");
  }

  if (expectedVariantId && actualVariantId !== expectedVariantId) {
    throw new Error("授权码不属于当前专业版规格。");
  }
}

async function postLemonSqueezyLicense(action, data) {
  const body = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value) {
      body.set(key, value);
    }
  });

  const response = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${action}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok && !payload) {
    throw new Error("授权平台暂时无法验证，请稍后重试。");
  }
  return payload;
}
