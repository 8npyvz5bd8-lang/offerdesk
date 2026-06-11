const config = window.OFFERDESK_CONFIG || {};
const email = String(config.supportEmail || "").trim();
const links = document.querySelectorAll("[data-support-email]");

links.forEach((link) => {
  if (!email) {
    link.textContent = "未配置";
    link.removeAttribute("href");
    return;
  }

  link.textContent = email;
  link.setAttribute("href", `mailto:${email}`);
});
