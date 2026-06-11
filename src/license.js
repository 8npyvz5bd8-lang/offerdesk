export function normalizeLicenseHash(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidLicenseHash(value) {
  return /^[a-f0-9]{64}$/.test(normalizeLicenseHash(value));
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
