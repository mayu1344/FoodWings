/* =====================================================================
   shell.js - turns any <div> into one of the three apps
   ---------------------------------------------------------------------
     App.mountApp(document.getElementById("x"), "customer")    // or "restaurant", "rider"

   Each app has its own login, its own screens and its own colour, but all
   three call the same API (and the same database).

   Every screen follows the same 4-part pattern:
     state, load(), render(), actions
   and buttons are wired the same way everywhere:
     <button data-action="accept">   -> screen.actions.accept(button)
     <form data-action="pay">        -> screen.actions.pay(form)
     <input data-change="open">      -> screen.actions.open(input)
   ===================================================================== */
(function () {
  App.APPS = {
    customer:   { name: "Foodu", tag: "Customer App",  tagline: "Food & Grocery delivery", roles: ["CUSTOMER"] },
    restaurant: { name: "Foodu", tag: "Kitchen Portal", tagline: "Partner Dashboard",       roles: ["RESTAURANT_OWNER", "RESTAURANT_STAFF"] },
    rider:      { name: "Foodu", tag: "Rider HUD",      tagline: "Delivery Partner Console", roles: ["DELIVERY_PARTNER"] },
  };

  // Foodu clean icon mark
  App.logo = (size = 30) => `<span class="foodu-mini-logo" style="font-size:${size * 0.75}px;display:inline-grid;place-items:center;width:${size}px;height:${size}px;background:#E8F8EE;border-radius:50%;line-height:1;">🥗</span>`;

  App.mountApp = function (root, kind) {
    const meta = App.APPS[kind];
    root.classList.add("app");
    root.dataset.kind = kind;
    root.innerHTML = `<header class="app-bar"></header><main class="app-main"></main><div class="app-toasts" aria-live="polite"></div>`;
    const bar = root.querySelector(".app-bar"), main = root.querySelector(".app-main");

    const fb = App.ui.scopedFeedback(root);
    const session = App.createSession(kind);
    const ctx = { kind, meta, root, session, toast: fb.toast, modal: fb.modal, closeModal: fb.closeModal, busy: App.ui.busy };
    ctx.api = App.createApi(session, kind, {
      onError: (msg, code) => fb.toast(msg, true, code),
      onSuccess: (msg) => fb.toast(msg),
      onUnauthorized: () => { session.logout(); fb.toast("Session expired. Please log in again.", true); go(); },
    });

    let screens = null, screen = null;
    const freshScreens = () => ({ login: App.screens.login(ctx), home: App.screens[kind](ctx), noRole: App.screens.noRole(ctx) });

    function currentScreen() {
      if (!session.token()) return screens.login;
      return meta.roles.some((r) => session.has(r)) ? screens.home : screens.noRole;
    }

    function renderBar() {
      const u = session.user(), { esc, initials } = App.ui;
      if (!u) {
        bar.style.display = "none";
        bar.innerHTML = "";
        return;
      }
      bar.style.display = "flex";
      bar.innerHTML = `
        <div class="user-greeting-pill">
          <span class="user-avatar-circle">${esc(initials(u.name || "U"))}</span>
          <div class="user-info-meta">
            <span class="user-name-text">${esc(u.name || "Foodu User")}</span>
            <span class="user-role-badge">${esc(meta.tag || "Member")}</span>
          </div>
        </div>
        <div class="bar-actions-right">
          <button class="logout-btn-pill" data-bar="logout" title="Log out of account">
            <span>🚪</span> Log out
          </button>
        </div>`;
    }

    async function refresh(reload = false) {
      if (!screen) return;
      if (reload) await screen.load();
      const y = main.scrollTop;
      main.innerHTML = screen.render();
      App.maps?.hydrate(main);
      main.scrollTop = y;
    }

    async function go() {
      if (!screens) screens = freshScreens();
      screen = currentScreen();
      renderBar();
      main.innerHTML = `<div class="empty">Loading…</div>`;
      await screen.load();
      main.innerHTML = screen.render();
      App.maps?.hydrate(main);
      main.scrollTop = 0;
    }

    ctx.refresh = refresh;
    ctx.go = go;
    ctx.logout = () => { session.logout(); screens = freshScreens(); fb.toast("Logged out"); go(); };

    // ---------- event wiring (same for every screen) ----------
    root.addEventListener("click", async (e) => {
      if (e.target.closest("[data-bar=logout]")) return ctx.logout();
      const el = e.target.closest(".app-main [data-action]");
      if (!el || el.tagName === "FORM" || !screen?.actions[el.dataset.action]) return;
      e.preventDefault();
      await screen.actions[el.dataset.action](el, e);
    });
    root.addEventListener("submit", async (e) => {
      const form = e.target.closest(".app-main form[data-action]");
      if (!form) return;
      e.preventDefault();
      await App.ui.busy(form.querySelector("[type=submit]"), () => screen.actions[form.dataset.action](form, e));
    });
    root.addEventListener("change", async (e) => {
      const el = e.target.closest(".app-main [data-change]");
      if (el && screen?.actions[el.dataset.change]) await screen.actions[el.dataset.change](el, e);
    });

    // ---------- stay in sync with the other apps ----------
    let pending = null;
    const syncSoon = () => {
      clearTimeout(pending);
      pending = setTimeout(async () => {
        if (!screen?.poll?.() || root.querySelector(".backdrop")) return;
        ctx.api.polling = true;
        try { await refresh(true); } finally { ctx.api.polling = false; }
      }, 350);
    };
    // another app on this page changed something -> refresh now
    App.bus.on((entry) => { if (entry.app !== kind && entry.op.method !== "GET" && entry.response?.success) syncSoon(); });
    // other tabs / the live server -> refresh every few seconds
    setInterval(() => { if (document.visibilityState === "visible") syncSoon(); }, App.config.pollMs);

    go();
    return ctx;
  };

  // shown when someone logs into an app their account has no role for
  App.screens = App.screens || {};
  App.screens.noRole = (ctx) => ({
    async load() {},
    render() {
      const u = ctx.session.user();
      const what = { customer: "a customer", restaurant: "restaurant staff", rider: "a delivery partner" }[ctx.kind];
      return `<div class="center-card stack">
        <h2>This account is not ${what}</h2>
        <p class="muted">${App.ui.esc(u?.name || "This number")} has the roles: ${App.ui.esc((u?.roles || []).join(", ") || "none")}.
        Log out and use one of the sample accounts for ${App.ui.esc(ctx.meta.name + (ctx.meta.tag ? " " + ctx.meta.tag : ""))}.</p>
        <button class="btn primary" data-action="out">Log out</button></div>`;
    },
    actions: { out() { ctx.logout(); } },
  });
})();
