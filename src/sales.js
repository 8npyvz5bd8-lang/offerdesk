const config = window.OFFERDESK_CONFIG || {};
const checkoutUrl = String(config.checkoutUrl || "").trim();
const paymentQrImage = String(config.paymentQrImage || "").trim();
const hasCheckout = checkoutUrl.startsWith("https://");
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

  link.href = hasCheckout ? checkoutUrl : paymentQrImage;
  link.textContent = hasCheckout ? "29 元购买专业版" : "查看支付宝收款码";
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
  if (hasCheckout) {
    notice.textContent = "付款后会收到专业版授权码。";
    return;
  }
  if (hasPaymentQr) {
    notice.textContent = "扫码付款后联系卖家获取授权码。";
    return;
  }
  notice.textContent = "还没有配置真实收款方式，暂时不能购买。";
});
