const config = window.OFFERDESK_CONFIG || {};
const checkoutUrl = String(config.checkoutUrl || "").trim();
const autoCheckoutUrl = String(config.autoCheckoutUrl || "").trim();
const paymentQrImage = String(config.paymentQrImage || "").trim();
const preferredCheckoutUrl = autoCheckoutUrl || checkoutUrl;
const hasCheckout = preferredCheckoutUrl.startsWith("https://");
const hasAutoCheckout = autoCheckoutUrl.startsWith("https://");
const hasPaymentQr = paymentQrImage.length > 0;
const checkoutLinks = document.querySelectorAll("[data-checkout-link]");
const notices = document.querySelectorAll("[data-buy-notice]");
const paymentQrPanels = document.querySelectorAll("[data-payment-qr]");
const paymentQrImages = document.querySelectorAll("[data-payment-qr-image]");

checkoutLinks.forEach((link) => {
  if (!hasCheckout && !hasPaymentQr) {
    link.setAttribute("aria-disabled", "true");
    link.classList.add("disabled-link");
    link.addEventListener("click", (event) => event.preventDefault());
    return;
  }

  link.href = hasCheckout ? preferredCheckoutUrl : paymentQrImage;
  link.textContent = hasAutoCheckout ? "29 元自动购买专业版" : hasCheckout ? "29 元购买专业版" : "查看支付宝收款码";
  link.setAttribute("target", hasCheckout ? "_blank" : "_self");
  link.setAttribute("rel", "noreferrer");
});

paymentQrPanels.forEach((panel) => {
  panel.hidden = !hasPaymentQr;
});

paymentQrImages.forEach((image) => {
  image.src = hasPaymentQr ? paymentQrImage : "";
});

notices.forEach((notice) => {
  if (hasAutoCheckout) {
    notice.textContent = "付款后平台会自动发送专业版授权码。";
    return;
  }
  if (hasCheckout) {
    notice.textContent = "付款后会收到唯一专业版授权码。";
    return;
  }
  if (hasPaymentQr) {
    notice.textContent = "扫码付款后领取唯一授权码。";
    return;
  }
  notice.textContent = "还没有配置真实收款方式，暂时不能购买。";
});
