import { pathToFileURL } from "node:url";
import { checkAlipayServiceHealth } from "./connect-alipay-service.mjs";

export async function validateAlipayService(options) {
  const apiBase = normalizeApiBase(options.apiBase);
  const fetchImpl = options.fetchImpl || fetch;
  const email = normalizeEmail(options.email || "534403209@qq.com");
  const name = String(options.name || "OfferDesk 自动验收").trim();

  const health = await checkAlipayServiceHealth(apiBase, fetchImpl);
  const order = await createTestOrder({ apiBase, email, name, fetchImpl });
  const status = await readOrderStatus({ apiBase, orderId: order.orderId, fetchImpl });

  if (status.orderId !== order.orderId) {
    throw new Error("订单状态返回的订单号不一致。");
  }
  if (status.amount !== order.amount) {
    throw new Error("订单状态返回的金额不一致。");
  }

  return { apiBase, health, order, status };
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
    apiBase: values["api-base"],
    email: values.email,
    name: values.name
  };
}

async function createTestOrder({ apiBase, email, name, fetchImpl }) {
  const order = await requestJson(fetchImpl, `${apiBase}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, name })
  });

  if (!/^OD-\d{14}-[A-F0-9]{24}$/u.test(order.orderId || "")) {
    throw new Error("创建订单没有返回有效订单号。");
  }
  if (order.status !== "WAIT_BUYER_PAY") {
    throw new Error(`创建订单状态不正确：${order.status || "空"}`);
  }
  if (!String(order.amount || "").trim()) {
    throw new Error("创建订单没有返回金额。");
  }
  if (!String(order.qrCode || "").trim()) {
    throw new Error("创建订单没有返回支付宝二维码内容。");
  }
  return order;
}

async function readOrderStatus({ apiBase, orderId, fetchImpl }) {
  const status = await requestJson(fetchImpl, `${apiBase}/api/order-status?order_id=${encodeURIComponent(orderId)}`, {
    headers: { Accept: "application/json" }
  });

  if (!["WAIT_BUYER_PAY", "TRADE_SUCCESS", "TRADE_FINISHED"].includes(status.status)) {
    throw new Error(`订单状态不正确：${status.status || "空"}`);
  }
  return status;
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.error || `接口请求失败：HTTP ${response.status}。`);
  }
  return payload;
}

function normalizeApiBase(value) {
  const apiBase = String(value || "").trim().replace(/\/+$/u, "");
  if (!/^https:\/\/.+/u.test(apiBase)) {
    throw new Error("支付宝服务地址必须是 https 开头。");
  }
  if (containsPlaceholder(apiBase) || apiBase.includes(".test") || apiBase.includes(".invalid")) {
    throw new Error("支付宝服务地址不能是示例地址。");
  }
  return apiBase;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) {
    throw new Error("验收邮箱格式不正确。");
  }
  return email;
}

function containsPlaceholder(value) {
  const lower = String(value || "").toLowerCase();
  return lower.includes("example") || lower.includes("your-") || value.includes("你的");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await validateAlipayService(parseArgs(process.argv.slice(2)));
    console.log(`支付宝服务验收通过：${result.apiBase}`);
    console.log(`测试订单：${result.order.orderId}`);
    console.log(`订单金额：${result.order.amount}`);
    console.log(`当前状态：${result.status.status}`);
    console.log("注意：这只是创建待支付订单，不代表已经完成真实付款。");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
