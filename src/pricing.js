export const defaultQuote = {
  sellerName: "你的工作室",
  clientName: "客户公司",
  projectName: "品牌官网设计与开发",
  currency: "¥",
  validUntil: "",
  taxRate: 0,
  discountRate: 0,
  depositRate: 50,
  targetMargin: 35,
  terms: "报价确认后支付首付款，项目验收后支付尾款。\n本报价不包含第三方软件、字体、服务器、广告投放等外部费用。",
  items: [
    { name: "需求梳理与方案", quantity: 1, price: 1800, cost: 500 },
    { name: "页面视觉设计", quantity: 6, price: 900, cost: 260 },
    { name: "前端开发与交付", quantity: 5, price: 1200, cost: 420 }
  ]
};

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function clampRate(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, toNumber(value)));
}

export function calculateQuote(rawQuote) {
  const quote = normalizeQuote(rawQuote);
  const subtotal = quote.items.reduce((sum, item) => {
    return sum + item.quantity * item.price;
  }, 0);
  const costTotal = quote.items.reduce((sum, item) => {
    return sum + item.quantity * item.cost;
  }, 0);
  const discount = subtotal * (quote.discountRate / 100);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (quote.taxRate / 100);
  const total = taxable + tax;
  const profit = total - costTotal;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  const deposit = total * (quote.depositRate / 100);
  const suggestedTotal = costTotal > 0 && quote.targetMargin < 100
    ? costTotal / (1 - quote.targetMargin / 100)
    : 0;
  const gapToTarget = Math.max(0, suggestedTotal - total);

  return {
    quote,
    subtotal,
    costTotal,
    discount,
    tax,
    total,
    profit,
    margin,
    deposit,
    suggestedTotal,
    gapToTarget,
    health: getProfitHealth(margin, quote.targetMargin)
  };
}

export function normalizeQuote(rawQuote = {}) {
  const merged = { ...defaultQuote, ...rawQuote };
  const items = Array.isArray(merged.items) && merged.items.length > 0
    ? merged.items
    : defaultQuote.items;

  return {
    ...merged,
    sellerName: String(merged.sellerName || "").trim(),
    clientName: String(merged.clientName || "").trim(),
    projectName: String(merged.projectName || "").trim(),
    currency: String(merged.currency || defaultQuote.currency).slice(0, 4),
    taxRate: clampRate(merged.taxRate),
    discountRate: clampRate(merged.discountRate),
    depositRate: clampRate(merged.depositRate),
    targetMargin: clampRate(merged.targetMargin, 0, 95),
    terms: String(merged.terms || "").trim(),
    items: items.map((item) => ({
      name: String(item.name || "未命名项目").trim(),
      quantity: Math.max(0, toNumber(item.quantity)),
      price: Math.max(0, toNumber(item.price)),
      cost: Math.max(0, toNumber(item.cost))
    }))
  };
}

export function getProfitHealth(margin, targetMargin) {
  if (margin >= targetMargin) {
    return { level: "good", label: "健康" };
  }
  if (margin >= targetMargin * 0.7) {
    return { level: "warn", label: "偏低" };
  }
  return { level: "bad", label: "危险" };
}

export function formatMoney(value, currency = "¥") {
  const amount = Math.round(toNumber(value)).toLocaleString("zh-CN");
  return `${currency}${amount}`;
}

export function formatPercent(value) {
  return `${Math.round(toNumber(value))}%`;
}

export function buildProfitAdvice(rawQuote) {
  const result = calculateQuote(rawQuote);
  const quote = result.quote;
  const currency = quote.currency || "¥";
  const margin = formatPercent(result.margin);
  const target = formatPercent(quote.targetMargin);

  if (result.gapToTarget > 0) {
    return {
      level: result.health.level,
      title: `建议至少涨价 ${formatMoney(result.gapToTarget, currency)}`,
      body: `当前利润率 ${margin}，目标利润率 ${target}。把总价调到 ${formatMoney(result.suggestedTotal, currency)} 左右，更接近你的目标。`
    };
  }

  return {
    level: "good",
    title: "当前报价达到目标",
    body: `当前利润率 ${margin}，目标利润率 ${target}。可以进入客户确认。`
  };
}

export function buildQuoteText(rawQuote) {
  const result = calculateQuote(rawQuote);
  const quote = result.quote;
  const currency = quote.currency || "¥";
  const lines = [
    `${quote.projectName || "项目报价"} 报价单`,
    `客户：${quote.clientName || "客户名称"}`,
    `报价方：${quote.sellerName || "你的品牌"}`
  ];

  if (quote.validUntil) {
    lines.push(`有效期：${quote.validUntil}`);
  }

  lines.push("", "报价项目：");

  quote.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.name} × ${item.quantity}，单价 ${formatMoney(item.price, currency)}，金额 ${formatMoney(item.quantity * item.price, currency)}`
    );
  });

  lines.push(
    "",
    `小计：${formatMoney(result.subtotal, currency)}`,
    `折扣：-${formatMoney(result.discount, currency)}`,
    `税费：${formatMoney(result.tax, currency)}`,
    `总价：${formatMoney(result.total, currency)}`,
    `首付款：${formatMoney(result.deposit, currency)}`
  );

  if (quote.terms) {
    lines.push("", "条款：", quote.terms);
  }

  return lines.join("\n");
}

export function importQuoteFromJsonText(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch {
    throw new Error("报价文件不是有效 JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("报价文件格式不正确");
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("报价文件缺少报价项目");
  }

  return normalizeQuote(parsed);
}
