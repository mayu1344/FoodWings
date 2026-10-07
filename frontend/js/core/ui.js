/* ui.js - small helpers shared by all three apps (no framework). */
window.App = window.App || {};
(function () {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rupees = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const time = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
  const dateTime = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const initials = (name) => String(name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // every status that exists in the database -> a pill colour + friendly text
  const STATUS = {
    PAYMENT_PENDING: ["warn", "Awaiting payment"], PAYMENT_FAILED: ["bad", "Payment failed"], PLACED: ["info", "Placed"],
    ACCEPTED: ["info", "Preparing"], PREPARING: ["info", "Preparing"], READY: ["warn", "Ready for pickup"],
    PICKED_UP: ["warn", "On the way"], DELIVERED: ["ok", "Delivered"], CANCELLED: ["bad", "Cancelled"],
    CREATED: ["warn", "Created"], CAPTURED: ["ok", "Paid"], FAILED: ["bad", "Failed"], REFUNDED: ["info", "Refunded"],
    COD_PENDING: ["warn", "Cash due"], COD_COLLECTED: ["ok", "Cash collected"], PENDING: ["warn", "Pending"], PAID: ["ok", "Paid"],
    ACTIVE: ["ok", "Active"], VERIFIED: ["ok", "KYC verified"], PENDING_KYC: ["warn", "KYC pending"],
  };
  const pill = (status, text) => {
    const [tone, label] = STATUS[status] || ["", status.replaceAll("_", " ")];
    return `<span class="pill ${tone}">${esc(text || label)}</span>`;
  };

  async function busy(btn, fn) {
    if (!btn) return fn();
    btn.disabled = true;
    try { return await fn(); } finally { btn.disabled = false; }
  }

  function prettyJson(obj) {
    const json = esc(JSON.stringify(obj, null, 2) ?? "null");
    return json.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2')
               .replace(/:\s(&quot;.*?&quot;)/g, ': <span class="s">$1</span>');
  }

  // toast + modal that live INSIDE one app (so three apps can sit side by side)
  function scopedFeedback(root) {
    function toast(message, isError = false, code = "") {
      const box = root.querySelector(".app-toasts");
      const el = document.createElement("div");
      el.className = "toast" + (isError ? " error" : "");
      el.innerHTML = isError ? `<b>${esc(code || "Error")}</b>${esc(message)}` : esc(message);
      box.appendChild(el);
      setTimeout(() => el.remove(), isError ? 5500 : 2600);
    }
    function closeModal() { root.querySelector(".backdrop")?.remove(); }
    function modal(html, actions = {}) {
      closeModal();
      const wrap = document.createElement("div");
      wrap.className = "backdrop";
      wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) return closeModal();
        const btn = e.target.closest("[data-modal]");
        if (btn && actions[btn.dataset.modal]) { e.preventDefault(); actions[btn.dataset.modal](btn, wrap); }
      });
      wrap.addEventListener("submit", (e) => {
        e.preventDefault();
        const f = e.target.dataset.modalSubmit;
        if (f && actions[f]) actions[f](e.target, wrap);
      });
      root.appendChild(wrap);
      wrap.querySelector("input, select, button")?.focus();
      return wrap;
    }
    return { toast, modal, closeModal };
  }

  App.ui = { esc, rupees, time, dateTime, initials, pill, busy, prettyJson, scopedFeedback };
})();
