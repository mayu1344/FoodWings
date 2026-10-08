/* =====================================================================
   foodu.js - shared helpers for every Foodu page (no framework, no build)
   - F.api(app)  : fetch wrapper that adds the login token and turns the
                   backend error envelope into a readable message
   - F.toast     : bottom message
   - F.img       : picks a food photo from frontend/img for a dish / restaurant
   CVV RULE: card number and CVV are only ever sent to the payment gateway
   (/mock-gateway/v1/tokenize) by F.gateway.tokenizeCard. Our API only gets the token.
   ===================================================================== */
(function () {
  const F = {};
  window.F = F;

  // Same origin when the page is served by FastAPI (/app/...), else talk to localhost:8000.
  F.base = (location.port === '8000' || location.pathname.startsWith('/app')) && location.protocol.startsWith('http')
    ? '' : 'http://localhost:8000';

  // ---------- session (one token per app, so you can be customer + rider in two tabs) ----------
  F.key = (app) => 'foodu.' + app;
  F.session = (app) => { try { return JSON.parse(localStorage.getItem(F.key(app)) || 'null'); } catch (e) { return null; } };
  F.saveSession = (app, data) => { try { localStorage.setItem(F.key(app), JSON.stringify(data)); } catch (e) { /* private mode */ } };
  F.logout = (app) => { try { localStorage.removeItem(F.key(app)); } catch (e) { /* ignore */ } location.href = 'login.html?app=' + app; };
  F.guard = (app) => {
    const s = F.session(app);
    if (!s || !s.token) { location.href = 'login.html?app=' + app; throw new Error('not logged in'); }
    return s;
  };

  // ---------- API ----------
  F.api = (app) => async (method, path, body) => {
    const s = app ? F.session(app) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    let res;
    try {
      res = await fetch(F.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      const err = new Error('Cannot reach the server. Is the API running on port 8000?');
      err.status = 0; throw err;
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = { message: text }; } }
    if (res.status === 401 && app) { F.logout(app); }
    if (!res.ok) {
      let msg = (data && (data.message || (typeof data.detail === 'string' ? data.detail : data.detail && data.detail.message))) || ('Request failed (' + res.status + ')');
      if (res.status === 422 && data && data.problems && data.problems.length) {
        msg = 'Please check: ' + data.problems.map((p) => p.field.replace(/_/g, ' ') + ' (' + p.error + ')').join(', ');
      }
      if (res.status === 402 && msg === 'Request failed') msg = 'Payment failed: card declined';
      const err = new Error(msg);
      err.status = res.status; err.code = data && data.code; err.data = data;
      throw err;
    }
    return data;
  };

  // ---------- payment gateway "SDK" (the only place card data goes) ----------
  F.gateway = {
    async tokenizeCard(card) {
      // card = {card_number, expiry_month, expiry_year, cvv, name_on_card}
      const r = await F.api(null)('POST', '/mock-gateway/v1/tokenize', card);
      return r; // {token, network, last4, expiry_month, expiry_year}
    },
    async tokenizeUpi(vpa) { return F.api(null)('POST', '/mock-gateway/v1/upi/tokenize', { vpa }); }
  };

  // ---------- small utils ----------
  F.$ = (sel, root) => (root || document).querySelector(sel);
  F.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  F.esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  F.money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
  F.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(16).slice(2));
  F.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  F.ago = (iso) => {
    if (!iso) return '';
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  F.mins = (iso) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0;
  F.when = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  F.initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  F.param = (k) => new URLSearchParams(location.search).get(k);
  F.hashParam = (k) => new URLSearchParams((location.hash.split('?')[1]) || '').get(k);

  F.toast = (msg, isErr) => {
    let box = F.$('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
  };
  F.shake = (el) => { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

  // Button loading state: F.busy(btn, true, 'Saving…')
  F.busy = (btn, on, label) => {
    if (!btn) return;
    if (on) { if (!btn.disabled || !btn.dataset.label) btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin' + (btn.classList.contains('btn-ghost') ? ' dark' : '') + '"></span>' + (label ? ' ' + F.esc(label) : ''); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  };

  // Dialog: returns the dialog element; close with F.closeDialog()
  F.dialog = (html, onClose) => {
    F.closeDialog();
    const bd = document.createElement('div');
    bd.className = 'backdrop'; bd.id = 'dlg';
    bd.innerHTML = '<div class="dialog" role="dialog" aria-modal="true">' + html + '</div>';
    bd.addEventListener('click', (e) => { if (e.target === bd) { F.closeDialog(); onClose && onClose(); } });
    document.body.appendChild(bd);
    return bd.firstChild;
  };
  F.closeDialog = () => { const d = document.getElementById('dlg'); if (d) d.remove(); };
  F.confirm = (title, text, okLabel) => new Promise((resolve) => {
    const d = F.dialog('<div style="padding:26px" class="col"><h2 style="font-size:22px">' + F.esc(title) + '</h2><p class="muted" style="margin:0">' + F.esc(text) +
      '</p><div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn btn-dark" data-yes>' + F.esc(okLabel || 'OK') + '</button></div></div>', () => resolve(false));
    d.querySelector('[data-no]').onclick = () => { F.closeDialog(); resolve(false); };
    d.querySelector('[data-yes]').onclick = () => { F.closeDialog(); resolve(true); };
  });

  // Count-up number animation
  F.countUp = (el, to, fmt) => {
    const f = fmt || ((v) => F.money(v));
    const start = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  // ---------- photos ----------
  const DISH = [
    [/biryani|pulao/i, 'biryani'], [/masala dosa|dosa|uttapam/i, 'dosa'], [/idli|vada|pongal/i, 'idli'],
    [/pizza|garlic bread/i, 'pizza'], [/burger|fries|sandwich/i, 'burger'], [/gulab|jamun|halwa|ice cream|dessert|kheer|payasam|sweet|cake|brownie/i, 'desserts'],
    [/coffee|tea|chai|lassi|juice|shake|drink|soda|water|buttermilk/i, 'tea'], [/noodle|manchurian|fried rice|chinese|momo/i, 'chinese'],
    [/paneer|dal|naan|roti|butter|tikka|curry|chicken|kebab|kabab/i, 'north-indian'], [/roll|thali|meals/i, 'rolls'], [/salad|bowl|raita/i, 'salad']
  ];
  const CUISINE = [
    [/biryani|hyderabadi/i, 'biryani'], [/south indian|udupi|tiffin|kerala/i, 'south-indian'], [/pizza|italian/i, 'pizza'],
    [/north indian|punjabi|mughlai/i, 'north-indian'], [/chinese|asian/i, 'chinese'], [/dessert|sweet|bakery/i, 'desserts'],
    [/cafe|coffee|beverage/i, 'cafe'], [/burger|fast food|american/i, 'burger'], [/healthy|salad/i, 'salad']
  ];
  F.img = (name) => 'img/' + name + '.jpg';
  F.dishImg = (name, fallbackCuisine) => {
    for (const [re, f] of DISH) if (re.test(name || '')) return F.img(f);
    return F.restImg(fallbackCuisine || '', 0);
  };
  F.restImg = (cuisines, id) => {
    for (const [re, f] of CUISINE) if (re.test(cuisines || '')) return F.img(f);
    return F.img(Number(id) % 2 ? 'restaurant-1' : 'restaurant-2');
  };
  F.photo = (src, alt, extra) => '<div class="photo ' + (extra || '') + '"><img loading="lazy" src="' + F.esc(src) + '" alt="' + F.esc(alt || '') + '" onerror="this.style.display=\'none\'"></div>';

  // ---------- order status ----------
  const ST = {
    PAYMENT_PENDING: ['Waiting for payment', 'b-warn'], PAYMENT_FAILED: ['Payment failed', 'b-err'],
    PLACED: ['Placed', 'b-warn'], ACCEPTED: ['Accepted', 'b-green'], PREPARING: ['Preparing', 'b-green'],
    READY: ['Ready for pickup', 'b-green'], PICKED_UP: ['On the way', 'b-ink'], DELIVERED: ['Delivered', 'b-green'],
    CANCELLED: ['Cancelled', 'b-gray'], REFUNDED: ['Refunded', 'b-gray']
  };
  F.statusInfo = (s) => { const x = ST[s] || [s, 'b-gray']; return { label: x[0], cls: x[1] }; };
  F.badge = (s) => { const x = F.statusInfo(s); return '<span class="badge ' + x.cls + '">' + F.esc(x.label) + '</span>'; };

  // ---------- shared logo ----------
  F.logoSvg = (color) => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + (color || '#13A04F') + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7c0-2 1-3 3-3"/><path d="M14 8c1-2 3-2 4-1"/></svg>';

  // Simple hash router: F.route({'home': fn, 'r/:id': fn}, 'home')
  F.route = (table, fallback) => {
    const run = () => {
      const h = ((location.hash || '').replace(/^#\/?/, '').split('?')[0]) || fallback;
      for (const pat in table) {
        const ps = pat.split('/'), hs = h.split('/');
        if (ps.length !== hs.length) continue;
        const args = []; let ok = true;
        ps.forEach((p, i) => { if (p.startsWith(':')) args.push(decodeURIComponent(hs[i])); else if (p !== hs[i]) ok = false; });
        if (ok) { window.scrollTo(0, 0); return table[pat](...args); }
      }
      location.hash = '#/' + fallback;
    };
    window.addEventListener('hashchange', run);
    run();
  };

  // Polling helper that stops when you navigate away
  F.poll = (() => { let t = null; return (fn, ms) => { clearInterval(t); t = null; if (fn) t = setInterval(fn, ms); }; })();
})();
