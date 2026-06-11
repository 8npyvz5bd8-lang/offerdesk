import assert from "node:assert/strict";
import {
  parseArgs,
  validateAlipayService
} from "../scripts/validate-alipay-service.mjs";

assert.deepEqual(parseArgs([
  "--api-base",
  "https://pay.offerdesk.com/",
  "--email",
  "Buyer@Example.COM",
  "--name",
  "验收买家"
]), {
  apiBase: "https://pay.offerdesk.com/",
  email: "Buyer@Example.COM",
  name: "验收买家"
});

const calls = [];
const okFetch = async (url, options = {}) => {
  calls.push({ url, options });
  if (url === "https://pay.offerdesk.com/api/health") {
    return jsonResponse({
      service: "offerdesk-alipay-payment",
      ready: true
    });
  }
  if (url === "https://pay.offerdesk.com/api/create-order") {
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), {
      email: "buyer@example.com",
      name: "验收买家"
    });
    return jsonResponse({
      orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
      amount: "29.00",
      status: "WAIT_BUYER_PAY",
      qrCode: "https://qr.alipay.com/test-order"
    });
  }
  if (url === "https://pay.offerdesk.com/api/order-status?order_id=OD-20260611203000-ABCDEF123456ABCDEF123456") {
    return jsonResponse({
      orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
      amount: "29.00",
      status: "WAIT_BUYER_PAY",
      licenseCode: ""
    });
  }
  throw new Error(`unexpected url: ${url}`);
};

const result = await validateAlipayService({
  apiBase: "https://pay.offerdesk.com/",
  email: "Buyer@Example.COM",
  name: "验收买家",
  fetchImpl: okFetch
});
assert.equal(calls.length, 3);
assert.equal(result.apiBase, "https://pay.offerdesk.com");
assert.equal(result.order.orderId, "OD-20260611203000-ABCDEF123456ABCDEF123456");
assert.equal(result.status.status, "WAIT_BUYER_PAY");

await assert.rejects(() => validateAlipayService({
  apiBase: "https://pay.offerdesk.com",
  email: "bad",
  fetchImpl: okFetch
}), /邮箱/);

await assert.rejects(() => validateAlipayService({
  apiBase: "http://pay.offerdesk.com",
  email: "buyer@example.com",
  fetchImpl: okFetch
}), /https/);

await assert.rejects(() => validateAlipayService({
  apiBase: "https://pay.offerdesk.com",
  email: "buyer@example.com",
  fetchImpl: async (url) => {
    if (url.endsWith("/api/health")) {
      return jsonResponse({ service: "offerdesk-alipay-payment", ready: true });
    }
    return jsonResponse({
      orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
      amount: "29.00",
      status: "WAIT_BUYER_PAY",
      qrCode: ""
    });
  }
}), /二维码/);

await assert.rejects(() => validateAlipayService({
  apiBase: "https://pay.offerdesk.com",
  email: "buyer@example.com",
  fetchImpl: async (url) => {
    if (url.endsWith("/api/health")) {
      return jsonResponse({ service: "offerdesk-alipay-payment", ready: true });
    }
    if (url.endsWith("/api/create-order")) {
      return jsonResponse({
        orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
        amount: "29.00",
        status: "WAIT_BUYER_PAY",
        qrCode: "https://qr.alipay.com/test-order"
      });
    }
    return jsonResponse({
      orderId: "OD-20260611203000-ABCDEF123456ABCDEF123456",
      amount: "30.00",
      status: "WAIT_BUYER_PAY"
    });
  }
}), /金额/);

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

console.log("validate alipay service tests passed");
