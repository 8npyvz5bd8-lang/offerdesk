import { normalizeQuote } from "./pricing.js";

export const quoteTemplates = [
  {
    id: "website",
    name: "官网设计与开发",
    quote: {
      projectName: "品牌官网设计与开发",
      depositRate: 50,
      targetMargin: 35,
      terms: "报价确认后支付首付款，项目验收后支付尾款。\n本报价不包含第三方软件、字体、服务器、广告投放等外部费用。",
      items: [
        { name: "需求梳理与方案", quantity: 1, price: 1800, cost: 500 },
        { name: "页面视觉设计", quantity: 6, price: 900, cost: 260 },
        { name: "前端开发与交付", quantity: 5, price: 1200, cost: 420 }
      ]
    }
  },
  {
    id: "brand",
    name: "品牌视觉设计",
    quote: {
      projectName: "品牌视觉设计",
      depositRate: 50,
      targetMargin: 40,
      terms: "报价确认后支付首付款，交付基础视觉规范后支付尾款。\n本报价不包含商标注册、印刷打样、字体授权等外部费用。",
      items: [
        { name: "品牌调研与方向", quantity: 1, price: 1500, cost: 350 },
        { name: "Logo 设计", quantity: 1, price: 3800, cost: 900 },
        { name: "基础视觉规范", quantity: 1, price: 2600, cost: 650 },
        { name: "应用延展设计", quantity: 4, price: 700, cost: 180 }
      ]
    }
  },
  {
    id: "consulting",
    name: "顾问咨询服务",
    quote: {
      projectName: "顾问咨询服务",
      depositRate: 100,
      targetMargin: 55,
      terms: "报价确认后一次性支付费用。咨询交付包括会议纪要和行动建议。\n本报价不包含第三方工具、差旅和线下场地费用。",
      items: [
        { name: "问题诊断会议", quantity: 1, price: 1200, cost: 120 },
        { name: "方案梳理", quantity: 1, price: 2400, cost: 400 },
        { name: "复盘答疑", quantity: 1, price: 900, cost: 120 }
      ]
    }
  }
];

export function getQuoteTemplate(id) {
  const template = quoteTemplates.find((item) => item.id === id);
  if (!template) {
    throw new Error("报价模板不存在");
  }

  return normalizeQuote(structuredClone(template.quote));
}
