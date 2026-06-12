import {
  buildProfitAdvice,
  buildQuoteText,
  calculateQuote,
  defaultQuote,
  formatMoney,
  importQuoteFromJsonText,
  normalizeQuote
} from "./pricing.js";
import {
  activateLemonSqueezyLicense,
  getDeliveryStatus,
  hashLicenseCode,
  isLemonSqueezyProvider,
  isSignedLicenseProvider,
  isValidLicenseHash,
  normalizeLicenseHash,
  verifySignedLicenseCode,
  validateLemonSqueezyLicense
} from "./license.js";
import { getQuoteTemplate } from "./templates.js";

const storageKey = "offerdesk.quote.v1";
const licenseKey = "offerdesk.license.v1";
const externalLicenseKey = "offerdesk.externalLicense.v1";
const config = window.OFFERDESK_CONFIG || {};

const fields = {
  sellerName: document.querySelector("#sellerName"),
  clientName: document.querySelector("#clientName"),
  projectName: document.querySelector("#projectName"),
  currency: document.querySelector("#currency"),
  validUntil: document.querySelector("#validUntil"),
  taxRate: document.querySelector("#taxRate"),
  discountRate: document.querySelector("#discountRate"),
  depositRate: document.querySelector("#depositRate"),
  targetMargin: document.querySelector("#targetMargin"),
  terms: document.querySelector("#terms")
};

const elements = {
  form: document.querySelector("#quoteForm"),
  itemsBody: document.querySelector("#itemsBody"),
  addItemButton: document.querySelector("#addItemButton"),
  printButton: document.querySelector("#printButton"),
  copyButton: document.querySelector("#copyButton"),
  saveButton: document.querySelector("#saveButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  templateSelect: document.querySelector("#templateSelect"),
  unlockButton: document.querySelector("#unlockButton"),
  unlockDialog: document.querySelector("#unlockDialog"),
  unlockPitch: document.querySelector("#unlockPitch"),
  checkoutLink: document.querySelector("#checkoutLink"),
  manualClaimLink: document.querySelector("#manualClaimLink"),
  trialPrintButton: document.querySelector("#trialPrintButton"),
  paymentQrBox: document.querySelector("#paymentQrBox"),
  paymentQrImage: document.querySelector("#paymentQrImage"),
  licenseInput: document.querySelector("#licenseInput"),
  applyLicenseButton: document.querySelector("#applyLicenseButton"),
  paymentNotice: document.querySelector("#paymentNotice"),
  modePill: document.querySelector("#modePill"),
  watermark: document.querySelector("#watermark"),
  profitHealth: document.querySelector("#profitHealth"),
  profitValue: document.querySelector("#profitValue"),
  depositValue: document.querySelector("#depositValue"),
  profitAdvice: document.querySelector("#profitAdvice"),
  profitAdviceTitle: document.querySelector("#profitAdviceTitle"),
  profitAdviceBody: document.querySelector("#profitAdviceBody"),
  deliveryStatus: document.querySelector("#deliveryStatus"),
  deliveryStatusTitle: document.querySelector("#deliveryStatusTitle"),
  deliveryStatusBody: document.querySelector("#deliveryStatusBody"),
  previewTitle: document.querySelector("#previewTitle"),
  previewSeller: document.querySelector("#previewSeller"),
  previewClient: document.querySelector("#previewClient"),
  previewValid: document.querySelector("#previewValid"),
  previewDate: document.querySelector("#previewDate"),
  previewItems: document.querySelector("#previewItems"),
  previewTerms: document.querySelector("#previewTerms"),
  quoteNumber: document.querySelector("#quoteNumber"),
  subtotalValue: document.querySelector("#subtotalValue"),
  discountValue: document.querySelector("#discountValue"),
  taxValue: document.querySelector("#taxValue"),
  totalValue: document.querySelector("#totalValue")
};

let state = loadQuote();
let externalLicenseVerified = false;
const defaultUnlockPitch = "专业版去掉免费水印，适合正式发给客户。付款成功后会收到唯一授权码。";

function loadQuote() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? normalizeQuote(JSON.parse(saved)) : normalizeQuote(defaultQuote);
  } catch {
    return normalizeQuote(defaultQuote);
  }
}

function isProUnlocked() {
  const configuredHash = normalizeLicenseHash(config.licenseHash);
  const savedHash = normalizeLicenseHash(localStorage.getItem(licenseKey));
  return externalLicenseVerified || (isValidLicenseHash(configuredHash) && savedHash === configuredHash);
}

function saveQuote() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function syncForm() {
  Object.entries(fields).forEach(([key, input]) => {
    input.value = state[key] ?? "";
  });
  renderItems();
}

function readForm() {
  Object.entries(fields).forEach(([key, input]) => {
    state[key] = input.value;
  });
  state = normalizeQuote(state);
}

function renderItems() {
  elements.itemsBody.replaceChildren();
  state.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.index = String(index);
    row.innerHTML = `
      <input aria-label="项目名称" data-field="name" type="text" value="${escapeHtml(item.name)}" />
      <input aria-label="数量" data-field="quantity" type="number" min="0" step="0.1" value="${item.quantity}" />
      <input aria-label="单价" data-field="price" type="number" min="0" step="1" value="${item.price}" />
      <input aria-label="成本" data-field="cost" type="number" min="0" step="1" value="${item.cost}" />
      <button class="remove-item" type="button" aria-label="删除项目">×</button>
    `;
    elements.itemsBody.append(row);
  });
}

function renderPreview() {
  const result = calculateQuote(state);
  const quote = result.quote;
  const currency = quote.currency || "¥";
  const pro = isProUnlocked();

  elements.modePill.textContent = pro ? "专业版" : "免费版";
  elements.modePill.classList.toggle("pro", pro);
  elements.watermark.classList.toggle("hidden", pro);

  elements.previewTitle.textContent = quote.projectName || "项目报价";
  elements.previewSeller.textContent = quote.sellerName || "你的品牌";
  elements.previewClient.textContent = quote.clientName || "客户名称";
  elements.previewValid.textContent = quote.validUntil ? `有效期至 ${quote.validUntil}` : "有效期未设置";
  elements.previewDate.textContent = new Date().toLocaleDateString("zh-CN");
  elements.quoteNumber.textContent = createQuoteNumber(quote);
  elements.previewTerms.textContent = quote.terms || "付款和交付条款待补充。";

  elements.previewItems.replaceChildren();
  quote.items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${formatMoney(item.price, currency)}</td>
      <td>${formatMoney(item.quantity * item.price, currency)}</td>
    `;
    elements.previewItems.append(tr);
  });

  elements.subtotalValue.textContent = formatMoney(result.subtotal, currency);
  elements.discountValue.textContent = `-${formatMoney(result.discount, currency)}`;
  elements.taxValue.textContent = formatMoney(result.tax, currency);
  elements.totalValue.textContent = formatMoney(result.total, currency);
  elements.profitValue.textContent = formatMoney(result.profit, currency);
  elements.depositValue.textContent = formatMoney(result.deposit, currency);
  elements.profitHealth.className = `health-card ${result.health.level}`;
  elements.profitHealth.querySelector("strong").textContent = result.gapToTarget > 0
    ? `${result.health.label}，差 ${formatMoney(result.gapToTarget, currency)}`
    : result.health.label;

  const advice = buildProfitAdvice(quote);
  elements.profitAdvice.className = `advice-card ${advice.level}`;
  elements.profitAdviceTitle.textContent = advice.title;
  elements.profitAdviceBody.textContent = advice.body;

  const deliveryStatus = getDeliveryStatus(pro);
  elements.deliveryStatus.className = `delivery-card ${deliveryStatus.level}`;
  elements.deliveryStatusTitle.textContent = deliveryStatus.title;
  elements.deliveryStatusBody.textContent = deliveryStatus.body;
}

function update() {
  readForm();
  saveQuote();
  renderPreview();
}

function addItem() {
  state.items.push({ name: "新增服务", quantity: 1, price: 1000, cost: 300 });
  saveQuote();
  syncForm();
  renderPreview();
}

function removeItem(index) {
  if (state.items.length === 1) {
    return;
  }
  state.items.splice(index, 1);
  saveQuote();
  syncForm();
  renderPreview();
}

function applyTemplate(templateId) {
  const template = getQuoteTemplate(templateId);
  state = normalizeQuote({
    ...template,
    sellerName: state.sellerName,
    clientName: state.clientName,
    currency: state.currency,
    validUntil: state.validUntil
  });
  saveQuote();
  syncForm();
  renderPreview();
}

function exportQuote() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `offerdesk-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importQuote(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    state = importQuoteFromJsonText(await file.text());
    saveQuote();
    syncForm();
    renderPreview();
    showButtonStatus(elements.importButton, "已导入");
  } catch {
    showButtonStatus(elements.importButton, "导入失败");
  } finally {
    elements.importFile.value = "";
  }
}

async function copyQuoteText() {
  if (!navigator.clipboard?.writeText) {
    showButtonStatus(elements.copyButton, "复制失败");
    return;
  }

  try {
    await navigator.clipboard.writeText(buildQuoteText(state));
    showButtonStatus(elements.copyButton, "已复制");
  } catch {
    showButtonStatus(elements.copyButton, "复制失败");
  }
}

async function handleCopyQuoteText() {
  if (!isProUnlocked()) {
    promptForProDelivery("copy");
    return;
  }
  await copyQuoteText();
}

function handlePrintQuote() {
  if (!isProUnlocked()) {
    promptForProDelivery("print");
    return;
  }
  window.print();
}

function promptForProDelivery(action) {
  const pitch = action === "print"
    ? "免费版导出 PDF 会带 OfferDesk Free 水印。29 元专业版去掉水印，适合正式发给客户。"
    : "复制客户报价属于正式交付动作。29 元专业版去掉免费水印，适合直接发给客户。";
  openUnlockDialog({
    pitch,
    trialPrint: action === "print",
    action
  });
}

function showButtonStatus(button, text) {
  const originalText = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1200);
}

function openUnlockDialog(options = {}) {
  const checkoutUrl = String(config.checkoutUrl || "").trim();
  const autoCheckoutUrl = String(config.autoCheckoutUrl || "").trim();
  const autoPaymentApiBase = String(config.autoPaymentApiBase || "").trim();
  const paymentQrImage = String(config.paymentQrImage || "").trim();
  const preferredCheckoutUrl = autoCheckoutUrl || checkoutUrl;
  const hasCheckout = preferredCheckoutUrl.startsWith("http://") || preferredCheckoutUrl.startsWith("https://");
  const hasPaymentQr = paymentQrImage.length > 0;
  const autoLicense = isLemonSqueezyProvider(config) && autoCheckoutUrl.startsWith("https://");
  const signedAutoLicense = isSignedLicenseProvider(config) && autoPaymentApiBase.startsWith("https://");

  elements.unlockPitch.textContent = options.pitch || defaultUnlockPitch;
  elements.trialPrintButton.hidden = options.trialPrint !== true;
  elements.checkoutLink.href = hasCheckout ? withCheckoutContext(preferredCheckoutUrl, options) : hasPaymentQr ? paymentQrImage : "#";
  elements.checkoutLink.textContent = autoLicense || signedAutoLicense ? "付款并收授权码" : hasCheckout ? "去付款" : hasPaymentQr ? "查看收款码" : "去付款";
  elements.checkoutLink.classList.toggle("disabled-link", !hasCheckout && !hasPaymentQr);
  elements.checkoutLink.setAttribute("aria-disabled", String(!hasCheckout && !hasPaymentQr));
  elements.manualClaimLink.hidden = autoLicense || signedAutoLicense;
  elements.paymentQrBox.hidden = !hasPaymentQr;
  elements.paymentQrImage.src = hasPaymentQr ? paymentQrImage : "";
  elements.paymentNotice.textContent = autoLicense
    ? "付款平台会自动把授权码发到邮箱。收到后在这里输入即可解锁。"
    : signedAutoLicense
    ? "付款成功后页面会自动显示你的唯一授权码。收到后在这里输入即可解锁。"
    : hasCheckout || hasPaymentQr
    ? "付款后输入你的唯一授权码即可去掉水印。"
    : "还没有配置真实收款方式。现在不能收钱，请先配置 app-config.js。";
  if (!elements.unlockDialog.open) {
    elements.unlockDialog.showModal();
  }
}

function withCheckoutContext(url, options = {}) {
  if (!isOfferDeskCheckoutUrl(url)) {
    return url;
  }

  const target = new URL(url);
  const result = calculateQuote(state);
  const project = state.projectName || "项目报价";
  target.searchParams.set("from", "app");
  target.searchParams.set("intent", options.action || "unlock");
  target.searchParams.set("project", project.slice(0, 60));
  target.searchParams.set("quote_total", String(Math.round(result.total)));
  target.searchParams.set("currency", state.currency || "¥");
  return target.href;
}

function isOfferDeskCheckoutUrl(url) {
  try {
    const target = new URL(url);
    return /\/offerdesk\/(?:buy|pay)\.html$/u.test(target.pathname) || /\/(?:buy|pay)\.html$/u.test(target.pathname);
  } catch {
    return false;
  }
}

async function applyLicense() {
  if (isSignedLicenseProvider(config)) {
    await applySignedLicense();
    return;
  }

  if (isLemonSqueezyProvider(config)) {
    await applyLemonSqueezyLicense();
    return;
  }

  const configuredHash = normalizeLicenseHash(config.licenseHash);
  const inputCode = elements.licenseInput.value.trim();
  if (!isValidLicenseHash(configuredHash)) {
    elements.paymentNotice.textContent = "还没有配置授权码哈希，不能解锁。";
    return;
  }

  let inputHash = "";
  try {
    inputHash = await hashLicenseCode(inputCode);
  } catch (error) {
    elements.paymentNotice.textContent = error.message;
    return;
  }

  if (inputHash !== configuredHash) {
    elements.paymentNotice.textContent = "授权码不正确。";
    return;
  }

  localStorage.setItem(licenseKey, inputHash);
  elements.paymentNotice.textContent = "已解锁专业版。";
  renderPreview();
}

async function applySignedLicense() {
  const inputCode = elements.licenseInput.value.trim();
  if (!inputCode) {
    elements.paymentNotice.textContent = "请输入付款后收到的唯一授权码。";
    return;
  }

  elements.paymentNotice.textContent = "正在验证授权码...";
  try {
    const record = await verifySignedLicenseCode(inputCode, config.licensePublicKey);
    localStorage.setItem(externalLicenseKey, JSON.stringify(record));
    externalLicenseVerified = true;
    elements.paymentNotice.textContent = "已验证并解锁专业版。";
    renderPreview();
  } catch (error) {
    elements.paymentNotice.textContent = error.message;
  }
}

async function applyLemonSqueezyLicense() {
  const inputCode = elements.licenseInput.value.trim();
  if (!inputCode) {
    elements.paymentNotice.textContent = "请输入付款平台发来的授权码。";
    return;
  }

  elements.paymentNotice.textContent = "正在验证授权码...";
  try {
    const record = await activateLemonSqueezyLicense({
      licenseKey: inputCode,
      instanceName: createLicenseInstanceName(),
      config
    });
    localStorage.setItem(externalLicenseKey, JSON.stringify(record));
    externalLicenseVerified = true;
    elements.paymentNotice.textContent = "已自动验证并解锁专业版。";
    renderPreview();
  } catch (error) {
    elements.paymentNotice.textContent = error.message;
  }
}

function createLicenseInstanceName() {
  const seller = fields.sellerName.value.trim() || "OfferDesk";
  const suffix = Date.now().toString(36).toUpperCase();
  return `${seller}-${suffix}`;
}

async function validateStoredExternalLicense() {
  if (isSignedLicenseProvider(config)) {
    const record = readStoredExternalLicense();
    if (!record?.key) {
      return;
    }

    try {
      await verifySignedLicenseCode(record.key, config.licensePublicKey);
      externalLicenseVerified = true;
      renderPreview();
    } catch {
      localStorage.removeItem(externalLicenseKey);
      externalLicenseVerified = false;
      renderPreview();
    }
    return;
  }

  if (!isLemonSqueezyProvider(config)) {
    return;
  }

  const record = readStoredExternalLicense();
  if (!record?.key) {
    return;
  }

  try {
    await validateLemonSqueezyLicense({
      licenseKey: record.key,
      instanceId: record.instanceId,
      config
    });
    externalLicenseVerified = true;
    renderPreview();
  } catch {
    localStorage.removeItem(externalLicenseKey);
    externalLicenseVerified = false;
    renderPreview();
  }
}

function readStoredExternalLicense() {
  try {
    return JSON.parse(localStorage.getItem(externalLicenseKey) || "null");
  } catch {
    return null;
  }
}

function createQuoteNumber(quote) {
  const seed = `${quote.sellerName}-${quote.clientName}-${quote.projectName}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 10000;
  }
  return `OD-${String(hash).padStart(4, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.form.addEventListener("input", update);
elements.addItemButton.addEventListener("click", addItem);
elements.printButton.addEventListener("click", handlePrintQuote);
elements.copyButton.addEventListener("click", handleCopyQuoteText);
elements.importButton.addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", importQuote);
elements.templateSelect.addEventListener("change", (event) => {
  if (!event.target.value) {
    return;
  }
  applyTemplate(event.target.value);
  event.target.value = "";
});
elements.saveButton.addEventListener("click", () => {
  saveQuote();
  showButtonStatus(elements.saveButton, "已保存");
});
elements.exportButton.addEventListener("click", exportQuote);
elements.unlockButton.addEventListener("click", openUnlockDialog);
elements.trialPrintButton.addEventListener("click", () => {
  elements.unlockDialog.close();
  window.print();
});
elements.applyLicenseButton.addEventListener("click", applyLicense);
elements.checkoutLink.addEventListener("click", (event) => {
  const checkoutUrl = String(config.checkoutUrl || "").trim();
  const autoCheckoutUrl = String(config.autoCheckoutUrl || "").trim();
  const paymentQrImage = String(config.paymentQrImage || "").trim();
  if (!autoCheckoutUrl.startsWith("http") && !checkoutUrl.startsWith("http") && !paymentQrImage) {
    event.preventDefault();
  }
});
elements.itemsBody.addEventListener("input", (event) => {
  const input = event.target.closest("input");
  if (!input) {
    return;
  }
  const row = input.closest(".item-row");
  const index = Number(row.dataset.index);
  const field = input.dataset.field;
  state.items[index][field] = input.value;
  update();
});
elements.itemsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-item");
  if (!button) {
    return;
  }
  const index = Number(button.closest(".item-row").dataset.index);
  removeItem(index);
});

syncForm();
renderPreview();
validateStoredExternalLicense();
applyLicenseFromUrl();

async function applyLicenseFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const licenseFromUrl = params.get("license_key");
  if (!licenseFromUrl || (!isLemonSqueezyProvider(config) && !isSignedLicenseProvider(config))) {
    return;
  }

  elements.licenseInput.value = licenseFromUrl;
  openUnlockDialog();
  await applyLicense();

  params.delete("license_key");
  params.delete("email");
  params.delete("order_id");
  params.delete("order_identifier");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}
