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
