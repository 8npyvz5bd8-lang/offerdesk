const defaultNodePath = "/Users/chenzhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node";

export function parsePaymentClaimText(text) {
  const source = String(text || "").replaceAll("\r\n", "\n");
  const email = readField(source, ["我的邮箱", "你的邮箱", "买家邮箱"]) || findEmail(source);
  const orderId = readField(source, ["订单号", "订单编号"]);
  const amount = normalizeAmount(readField(source, ["付款金额", "金额"]));
  const paidAt = readField(source, ["付款时间", "支付时间"]);
  const name = readField(source, ["支付宝昵称或备注", "支付宝昵称", "付款备注"]);
  const attributionSource = readField(source, ["来源", "渠道", "推广来源"]);
  const extraNote = readField(source, ["其他说明", "说明"]);

  if (!email) {
    throw new Error("提交内容里没有买家邮箱。");
  }
  if (!orderId) {
    throw new Error("提交内容里没有订单号。");
  }

  const claim = {
    email,
    orderId,
    amount: amount || undefined,
    paidAt: paidAt || undefined,
    name: name || undefined,
    note: buildNote({ name, attributionSource, extraNote })
  };
  if (attributionSource) {
    claim.source = attributionSource;
  }
  return claim;
}

export function buildManualFulfillmentCommand(claim, options = {}) {
  const nodePath = options.nodePath || defaultNodePath;
  const args = [
    nodePath,
    "scripts/fulfill-manual-order.mjs",
    "--email",
    claim.email || "买家邮箱",
    "--order-id",
    claim.orderId || "订单号",
    "--source",
    claim.source || "",
    "--paid-at",
    claim.paidAt || localDateTime(),
    "--amount",
    claim.amount || "29",
    "--channel",
    options.channel || "manual-alipay-email",
    "--name",
    claim.name || "买家",
    "--contact",
    claim.email || "",
    "--note",
    claim.note || "支付宝收款码付款"
  ];
  return args.map(shellArg).join(" \\\n  ");
}

function readField(source, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = source.match(new RegExp(`^\\s*${escaped}\\s*[:：]\\s*(.*)$`, "im"));
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function findEmail(source) {
  return source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0] || "";
}

function normalizeAmount(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const match = text.match(/\d+(?:\.\d+)?/u);
  return match ? match[0] : text;
}

function buildNote({ name, attributionSource, extraNote }) {
  return [
    name ? `支付宝备注：${name}` : "",
    attributionSource ? `来源：${attributionSource}` : "",
    extraNote ? `其他说明：${extraNote}` : ""
  ].filter(Boolean).join("；");
}

function localDateTime() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  return `${date} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function shellArg(value) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9_./:@=-]+$/.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
