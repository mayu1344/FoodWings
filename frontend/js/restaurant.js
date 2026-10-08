/* Kitchen Portal: live orders board, menu & stock, payouts, restaurant profile.
   Hash routes: #/orders  #/menu  #/payouts  #/profile */
(function () {
  const ME = F.guard('restaurant');
  const api = F.api('restaurant');
  const view = F.$('#view'), side = F.$('#side');
  const S = { rest: null, seen: null, counts: {} };
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem('foodu.k.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem('foodu.k.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const active = () => S.rest && S.rest.status === 'ACTIVE';

  function drawSide(on) {
    const r = S.rest || {};
    const nav = (k, label, locked) => '<a class="nav' + (on === k ? ' on' : '') + (locked ? ' locked' : '') + '" href="#/' + k + '">' + label + (k === 'orders' && S.counts.PLACED ? '<span class="cnt">' + S.counts.PLACED + '</span>' : '') + (locked ? '<span class="small" style="margin-left:auto">after approval</span>' : '') + '</a>';
    side.innerHTML = '<div class="head"><span class="logo" style="background:var(--green)">' + F.logoSvg('#fff') + '</span><span><b>Foodu</b><small>KITCHEN PORTAL</small></span></div>' +
      (r.name ? '<div class="rest">' + F.photo(F.img(r.restaurant_id % 2 ? 'restaurant-1' : 'restaurant-2'), r.name) + '<span>' + F.esc(r.name) + '</span></div>' : '') +
      nav('orders', 'Live orders', !active()) + nav('menu', 'Menu &amp; stock', !active()) + nav('payouts', 'Payouts', !active()) + nav('profile', 'Restaurant profile') +
      '<div class="spacer"></div><button class="nav" id="out" type="button">Sign out · ' + F.esc(ME.name || '') + '</button>';
    F.$('#out').onclick = () => F.logout('restaurant');
  }
  const locked = (what) => { view.innerHTML = '<div class="card empty up" style="max-width:560px;margin:40px auto"><h2 style="color:var(--ink);margin-bottom:6px">' + what + ' opens after approval</h2>Your restaurant is <b>' + F.esc(S.rest.status) + '</b>. The Foodu team checks your FSSAI licence first.<br><br><a class="btn btn-dark" href="#/profile">See status</a></div>'; };

  // ================= LIVE ORDERS =================
  let bellCtx = null;
  function bell() {
    try {
      bellCtx = bellCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((t) => { const o = bellCtx.createOscillator(), g = bellCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(bellCtx.destination); g.gain.setValueAtTime(0.15, bellCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, bellCtx.currentTime + t + 0.3); o.start(bellCtx.currentTime + t); o.stop(bellCtx.currentTime + t + 0.3); });
    } catch (e) { /* sound is optional */ }
  }
  async function orders() {
    drawSide('orders'); if (!active()) return locked('Live orders');
    view.innerHTML = '<div class="row between wrapf" style="margin-bottom:20px"><div><h1 style="font-size:32px;font-weight:800">Live orders</h1><span class="muted">New orders appear here automatically.</span></div>' +
      '<label class="row card" style="padding:10px 16px;gap:12px;font-weight:700"><span id="openTxt"></span><button class="sw" id="open" type="button" aria-label="Accepting orders"></button></label></div>' +
      '<div class="tiles" id="tiles" style="margin-bottom:22px"></div>' +
      '<div class="board"><section><div class="colh">New <span class="n" id="nNew">0</span></div><div class="lane" id="lNew"></div></section>' +
      '<section><div class="colh">Preparing <span class="n" id="nPrep">0</span></div><div class="lane" id="lPrep"></div></section>' +
      '<section><div class="colh">Ready for pickup <span class="n" id="nReady">0</span></div><div class="lane" id="lReady"></div></section></div>';
    const drawOpen = () => { const sw = F.$('#open'); sw.classList.toggle('on', S.rest.is_open); sw.setAttribute('aria-pressed', S.rest.is_open); F.$('#openTxt').textContent = S.rest.is_open ? 'Open · taking orders' : 'Closed'; F.$('#openTxt').style.color = S.rest.is_open ? 'var(--green-text)' : 'var(--muted)'; };
    drawOpen();
    F.$('#open').onclick = async () => {
      const want = !S.rest.is_open;
      try { await api('POST', '/restaurant/' + S.rest.restaurant_id + '/open', { is_open: want }); S.rest.is_open = want; drawOpen(); F.toast(want ? 'You are open for orders' : 'Restaurant closed'); } catch (e) { F.toast(e.message, true); }
    };
    S.seen = null;
    await refresh();
    F.poll(refresh, 5000);
  }
  async function refresh() {
    if (!F.$('#lNew')) return F.poll(null);
    const rid = S.rest.restaurant_id, get = (st) => api('GET', '/restaurant/' + rid + '/orders?status=' + st);
    let placed, acc, prep, ready, done;
    try { [placed, acc, prep, ready, done] = await Promise.all([get('PLACED'), get('ACCEPTED'), get('PREPARING'), get('READY'), get('DELIVERED')]); } catch (e) { F.toast(e.message, true); return; }
    const cooking = acc.concat(prep);
    const ids = new Set(placed.map((o) => o.order_id));
    const fresh = S.seen ? placed.filter((o) => !S.seen.has(o.order_id)) : [];
    if (fresh.length) { bell(); F.toast(fresh.length === 1 ? 'New order #' + fresh[0].order_id : fresh.length + ' new orders'); }
    S.seen = new Set([...(S.seen || []), ...ids]);
    S.counts.PLACED = placed.length;
    const today = done.filter((o) => new Date(o.placed_at).toDateString() === new Date().toDateString());
    F.$('#tiles').innerHTML = [['New', placed.length], ['Cooking', cooking.length], ['Ready', ready.length], ['Delivered today', today.length], ['Sales today', F.money(today.reduce((a, o) => a + Number(o.item_total || 0), 0))]]
      .map((t, i) => '<div class="card tile" style="animation-delay:' + i * 0.05 + 's"><small>' + t[0] + '</small><b>' + t[1] + '</b></div>').join('');
    lane('#lNew', '#nNew', placed, 'new', fresh);
    lane('#lPrep', '#nPrep', cooking, 'prep');
    lane('#lReady', '#nReady', ready, 'ready');
    const navCnt = F.$('.side a.on'); if (navCnt) drawSide('orders');
  }
  function lane(sel, nsel, list, kind, fresh) {
    F.$(nsel).textContent = list.length;
    const box = F.$(sel);
    if (!list.length) { box.innerHTML = '<div class="empty small">' + { new: 'No new orders. The bell rings when one arrives.', prep: 'Nothing cooking right now.', ready: 'No orders waiting for a rider.' }[kind] + '</div>'; return; }
    box.innerHTML = list.map((o) => {
      const mins = F.mins(o.placed_at), late = kind === 'prep' && mins > 20;
      const items = (o.items || []).map((i) => '<div class="row" style="gap:10px">' + F.photo(F.dishImg(i.item), '', 'thumb') + '<span class="grow"><b>' + i.qty + ' ×</b> ' + F.esc(i.item) + ((i.addons || []).length ? '<br><span class="small muted">+ ' + i.addons.map((a) => F.esc(a.name)).join(', ') + '</span>' : '') + '</span></div>').join('');
      return '<article class="card ocard' + (fresh && fresh.some((f) => f.order_id === o.order_id) ? ' new' : '') + '">' +
        '<div class="row between"><b style="font-size:18px">#' + o.order_id + '</b><span class="timer' + (late ? ' late' : '') + '">' + mins + ' min</span></div>' + items +
        (o.special_instructions ? '<div class="note warn small">“' + F.esc(o.special_instructions) + '”</div>' : '') +
        '<div class="row between"><span class="badge ' + (o.payment_mode === 'COD' ? 'b-warn' : 'b-green') + '">' + (o.payment_mode === 'COD' ? 'Cash' : 'Paid · ' + o.payment_mode) + '</span><b>' + F.money(o.item_total) + '</b></div>' +
        (kind !== 'new' ? '<div class="row small" style="gap:8px">' + (o.partner_id ? '🛵 <b>' + F.esc(o.partner_name) + '</b> ' + (kind === 'ready' ? 'is coming to pick up' : 'is assigned') : '<span class="spin dark" style="width:14px;height:14px;border-width:2px"></span><span class="muted">Finding a rider…</span>') + '</div>' : '') +
        (kind === 'new' ? '<button class="btn btn-dark block" data-acc="' + o.order_id + '">Accept order</button>' : kind === 'prep' ? '<button class="btn btn-green block" data-rdy="' + o.order_id + '">Mark ready</button>' : '<span class="muted small">Hand it to the rider when they arrive.</span>') +
        '</article>';
    }).join('');
    F.$$('[data-acc]', box).forEach((b) => b.onclick = () => act(b, 'accept', 'Order accepted · finding a rider'));
    F.$$('[data-rdy]', box).forEach((b) => b.onclick = () => act(b, 'ready', 'Marked ready for pickup'));
  }
  async function act(btn, what, ok) {
    const id = btn.dataset.acc || btn.dataset.rdy;
    F.busy(btn, true);
    try { await api('POST', '/restaurant/' + S.rest.restaurant_id + '/orders/' + id + '/' + what); F.toast(ok); await refresh(); }
    catch (e) { F.busy(btn, false); F.toast(e.message, true); }
  }

  // ================= MENU & STOCK =================
  let mcat = 'All', mq = '';
  async function menu() {
    drawSide('menu'); F.poll(null); if (!active()) return locked('Menu & stock');
    view.innerHTML = '<h1 style="font-size:32px;font-weight:800">Menu &amp; stock</h1><span class="muted">Change a price and press Enter, or switch a dish off when it runs out.</span>' +
      '<div class="row wrapf" style="margin:18px 0"><div class="row wrapf" id="mtabs" style="gap:8px"></div><input class="inp" id="mq" placeholder="Search dishes" style="max-width:260px;margin-left:auto" value="' + F.esc(mq) + '"></div><div class="card" id="mlist" style="overflow:hidden"><div class="skeleton" style="height:200px"></div></div>';
    let m;
    try { m = await api('GET', '/restaurants/' + S.rest.restaurant_id + '/menu'); } catch (e) { F.$('#mlist').innerHTML = '<div class="empty">' + F.esc(e.message) + '</div>'; return; }
    const draw = () => {
      const all = m.menu.reduce((a, c) => a.concat(c.items.map((i) => ({ ...i, category: c.category }))), []);
      F.$('#mtabs').innerHTML = [['All', all.length]].concat(m.menu.map((c) => [c.category, c.items.length])).map((c) => '<button class="pill' + (mcat === c[0] ? ' on' : '') + '" data-c="' + F.esc(c[0]) + '">' + F.esc(c[0]) + ' · ' + c[1] + '</button>').join('');
      F.$$('[data-c]').forEach((b) => b.onclick = () => { mcat = b.dataset.c; draw(); });
      const list = all.filter((i) => (mcat === 'All' || i.category === mcat) && i.name.toLowerCase().includes(mq));
      F.$('#mlist').innerHTML = list.length ? list.map((i, n) => '<div class="mrow' + (i.in_stock ? '' : ' off') + '" style="animation-delay:' + n * 0.03 + 's" data-row="' + i.item_id + '">' + F.photo(F.dishImg(i.name), i.name, 'zoom') +
        '<div class="col" style="gap:2px"><span class="row" style="gap:8px"><span class="veg' + (i.is_veg ? '' : ' nv') + '"></span><b>' + F.esc(i.name) + '</b></span><span class="muted small">' + F.esc(i.category) + (i.in_stock ? '' : ' · <b style="color:var(--nonveg)">Out of stock</b>') + '</span></div>' +
        '<label class="row" style="gap:4px"><span class="bold">₹</span><input class="inp" type="number" min="1" step="1" value="' + Number(i.price) + '" data-price="' + i.item_id + '" aria-label="Price of ' + F.esc(i.name) + '" style="min-height:42px"></label>' +
        '<button class="sw' + (i.in_stock ? ' on' : '') + '" type="button" data-stock="' + i.item_id + '" aria-label="In stock" aria-pressed="' + i.in_stock + '"></button></div>').join('')
        : '<div class="empty">No dishes match.</div>';
      F.$$('[data-price]').forEach((inp) => inp.onchange = async () => {
        const v = Number(inp.value); if (!(v > 0)) { F.shake(inp); return; }
        try { await api('PATCH', '/restaurant/' + S.rest.restaurant_id + '/items/' + inp.dataset.price, { price: v }); find(+inp.dataset.price).price = v; F.toast('Price saved'); } catch (e) { F.toast(e.message, true); }
      });
      F.$$('[data-stock]').forEach((b) => b.onclick = async () => {
        const it = find(+b.dataset.stock), want = !it.in_stock;
        try { await api('PATCH', '/restaurant/' + S.rest.restaurant_id + '/items/' + it.item_id, { in_stock: want }); it.in_stock = want; F.toast(it.name + (want ? ' is back in stock' : ' marked out of stock')); draw(); } catch (e) { F.toast(e.message, true); }
      });
    };
    const find = (id) => { for (const c of m.menu) for (const i of c.items) if (i.item_id === id) return i; return null; };
    F.$('#mq').oninput = (e) => { mq = e.target.value.trim().toLowerCase(); draw(); };
    draw();
  }

  // ================= PAYOUTS =================
  let ptab = 'All';
  async function payouts() {
    drawSide('payouts'); F.poll(null); if (!active()) return locked('Payouts');
    view.innerHTML = '<h1 style="font-size:32px;font-weight:800">Payouts</h1><span class="muted">Every delivered order adds a payout: food total minus the platform commission.</span><div id="pbox" style="margin-top:20px"><div class="skeleton" style="height:200px"></div></div>';
    let rows;
    try { rows = await api('GET', '/restaurant/' + S.rest.restaurant_id + '/payouts'); } catch (e) { F.$('#pbox').innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; return; }
    const paid = (r) => r.payout_status === 'PAID';
    const sum = (l) => l.reduce((a, r) => a + Number(r.payout_amount), 0);
    const gross = rows.reduce((a, r) => a + Number(r.order_amount), 0), com = rows.reduce((a, r) => a + Number(r.commission), 0);
    const pct = gross ? Math.round(com / gross * 100) : 18;
    F.$('#pbox').innerHTML = '<section class="tiles"><div class="card tile" style="background:var(--ink);color:#fff"><small style="color:var(--green-soft)">Pending payout</small><b id="tp">₹0</b><span class="small" style="color:#C9D1CC">' + rows.filter((r) => !paid(r)).length + ' order(s)</span></div>' +
      '<div class="card tile" style="animation-delay:.06s"><small>Paid out</small><b id="td">₹0</b><span class="small muted">' + rows.filter(paid).length + ' order(s)</span></div>' +
      '<div class="card tile col" style="animation-delay:.12s;gap:8px"><small>Where each ₹100 goes</small><div class="split"><i style="width:' + (100 - pct) + '%;background:var(--green)"></i><i style="width:' + pct + '%;background:var(--ink)"></i></div><span class="small muted">₹' + (100 - pct) + ' to you · ₹' + pct + ' commission</span></div></section>' +
      '<div class="row" style="gap:10px;margin:20px 0 14px" id="ptabs"></div><div class="card" style="overflow-x:auto"><div style="min-width:760px" id="prows"></div></div>';
    F.countUp(F.$('#tp'), sum(rows.filter((r) => !paid(r)))); F.countUp(F.$('#td'), sum(rows.filter(paid)));
    const draw = () => {
      F.$('#ptabs').innerHTML = ['All', 'Pending', 'Paid'].map((t) => '<button class="pill' + (ptab === t ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>').join('');
      F.$$('[data-t]').forEach((b) => b.onclick = () => { ptab = b.dataset.t; draw(); });
      const list = rows.filter((r) => ptab === 'All' || (ptab === 'Paid') === paid(r));
      F.$('#prows').innerHTML = '<div class="prow h"><span>Order</span><span>Date</span><span>Food total</span><span>Commission</span><span>You receive</span><span>Status</span></div>' +
        (list.length ? list.map((r, i) => '<div class="prow" style="animation-delay:' + i * 0.04 + 's"><b>#' + r.order_id + '</b><span>' + F.when(r.created_at) + '</span><span>' + F.money(r.order_amount) + '</span><span>' + F.money(r.commission) + '</span><b>' + F.money(r.payout_amount) + '</b><span class="badge ' + (paid(r) ? 'b-green' : 'b-warn') + '" style="justify-self:start">' + F.esc(r.payout_status) + '</span></div>').join('')
          : '<div class="empty">No payouts yet. They appear when orders are delivered.</div>');
    };
    draw();
  }

  // ================= PROFILE =================
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function profile() {
    drawSide('profile'); F.poll(null);
    const r = S.rest, st = r.status;
    const steps = [['Account created', 1], ['Restaurant details sent', 1], ['Approval by Foodu team', st === 'ACTIVE' ? 1 : st === 'PENDING' ? 2 : 3], ['Go live and open', st === 'ACTIVE' ? (r.is_open ? 1 : 2) : 0]];
    const banner = st === 'ACTIVE'
      ? '<section class="card up" style="padding:24px 28px;background:var(--green-tint);box-shadow:none;border:1.5px solid #9FE0B8"><span class="chip">Status: active</span><h1 style="font-size:30px;font-weight:800;margin-top:8px">' + F.esc(r.name) + ' is live</h1><span class="muted">Rating ' + Number(r.avg_rating || 0).toFixed(1) + ' · you are ' + (r.is_open ? 'open' : 'closed') + ' right now.</span></section>'
      : '<section class="card up row wrapf" style="padding:24px 28px;gap:24px;background:' + (st === 'PENDING' ? '#FFF8E6;border:1.5px solid #F3D48A' : 'var(--err-bg);border:1.5px solid #E8B4AE') + ';box-shadow:none">' +
        '<div class="col grow" style="gap:6px;min-width:260px"><span class="bold small" style="letter-spacing:.1em;color:var(--warn)">STATUS: ' + (st === 'PENDING' ? 'PENDING REVIEW' : F.esc(st)) + '</span><h1 style="font-size:30px;font-weight:800">' + F.esc(r.name) + (st === 'PENDING' ? ' is under review' : ' is not active') + '</h1>' +
        '<span style="color:#5D4A1F">' + (st === 'PENDING' ? 'Our team checks your FSSAI licence and details. Orders start once you are approved. Refresh this page to see the latest status.' : 'Please contact Foodu support.') + '</span></div>' +
        '<div class="col" style="gap:10px">' + steps.map((s, i) => '<span class="chk"' + (s[1] === 0 ? ' style="color:#7B847F"' : '') + '><b class="' + (s[1] === 2 ? 'now' : '') + '" style="background:' + (s[1] === 1 ? 'var(--green);color:#fff' : s[1] === 2 ? 'var(--amber);color:#fff' : s[1] === 3 ? 'var(--nonveg);color:#fff' : '#E4E8E5') + '">' + (s[1] === 1 ? '✓' : s[1] === 3 ? '✕' : i + 1) + '</b>' + s[0] + '</span>').join('') + '</div></section>';
    const hours = store.get('hours.' + r.restaurant_id, Object.fromEntries(DAYS.map((d) => [d, { on: d !== 'Sunday', from: '07:00', to: '22:00' }])));
    view.innerHTML = '<div class="col" style="gap:22px">' + banner + '<div class="row wrapf" style="gap:22px;align-items:flex-start">' +
      '<section class="card up col" style="flex:1 1 380px;padding:26px;gap:12px"><h2 style="font-size:22px;font-weight:800">Restaurant details</h2>' +
      [['Restaurant', r.name], ['Restaurant ID', '#' + r.restaurant_id], ['Your role', r.staff_role], ['Owner / staff', ME.name], ['Status', r.status], ['Rating', Number(r.avg_rating || 0).toFixed(1)]]
        .map((x) => '<div class="row between" style="border-bottom:1px solid #EEF1EF;padding-bottom:10px"><span class="muted">' + x[0] + '</span><b>' + F.esc(x[1]) + '</b></div>').join('') +
      '<span class="small muted">To change your licence or address, contact Foodu support (no edit API yet).</span>' +
      '<button class="btn btn-ghost" id="reload">Refresh status</button></section>' +
      '<section class="card up col" style="flex:1 1 420px;padding:26px;gap:12px;animation-delay:.06s"><h2 style="font-size:22px;font-weight:800">Opening hours</h2>' +
      '<div class="day small muted bold" style="letter-spacing:.06em"><span>DAY</span><span>OPEN</span><span>FROM</span><span>TO</span></div><div id="days" class="col" style="gap:10px"></div>' +
      '<button class="btn btn-ghost" id="copy">Copy Monday to all days</button><span class="small muted">Saved on this device. Use the Open switch on Live orders to take orders.</span></section></div></div>';
    const drawDays = () => {
      F.$('#days').innerHTML = DAYS.map((d) => { const x = hours[d]; return '<div class="day' + (x.on ? '' : ' closed') + '"><b>' + d + '</b><button type="button" class="sw' + (x.on ? ' on' : '') + '" data-d="' + d + '" aria-label="Open on ' + d + '"></button><input class="inp" type="time" value="' + x.from + '" data-f="' + d + '"' + (x.on ? '' : ' disabled') + ' style="min-height:42px"><input class="inp" type="time" value="' + x.to + '" data-t="' + d + '"' + (x.on ? '' : ' disabled') + ' style="min-height:42px"></div>'; }).join('');
      F.$$('[data-d]').forEach((b) => b.onclick = () => { hours[b.dataset.d].on = !hours[b.dataset.d].on; save(); drawDays(); });
      F.$$('[data-f]').forEach((i) => i.onchange = () => { hours[i.dataset.f].from = i.value; save(); });
      F.$$('[data-t]').forEach((i) => i.onchange = () => { hours[i.dataset.t].to = i.value; save(); });
    };
    const save = () => store.set('hours.' + r.restaurant_id, hours);
    drawDays();
    F.$('#copy').onclick = (e) => { DAYS.forEach((d) => { hours[d] = { ...hours.Monday }; }); save(); drawDays(); e.currentTarget.textContent = 'Copied to all days ✓'; };
    F.$('#reload').onclick = () => start();
  }

  // ---------------- start ----------------
  async function start() {
    let list;
    try { list = await api('GET', '/restaurant/mine'); }
    catch (e) {
      if (e.status === 403) { view.innerHTML = '<div class="card empty" style="max-width:520px;margin:40px auto"><h2 style="color:var(--ink)">Add your restaurant first</h2><p>Sign in again to fill in your restaurant details.</p><a class="btn btn-dark" href="login.html?app=restaurant&stay=1">Continue</a></div>'; drawSide(''); return; }
      view.innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; return;
    }
    if (!list.length) { location.href = 'login.html?app=restaurant&stay=1'; return; }
    const pick = store.get('rid', null);
    S.rest = list.find((r) => r.restaurant_id === pick) || list[0];
    if (!started) { started = true; F.route({ orders, menu, payouts, profile }, active() ? 'orders' : 'profile'); }
    else { const h = (location.hash.replace(/^#\//, '') || 'profile'); ({ orders, menu, payouts, profile }[h] || profile)(); }
  }
  let started = false;
  start();
})();
