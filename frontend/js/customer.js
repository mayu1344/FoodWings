/* Customer app: home -> menu -> checkout -> payment -> tracking -> my orders / rating.
   Hash routes: #/home  #/r/{restaurant_id}  #/checkout  #/track/{order_id}  #/orders */
(function () {
  const ME = F.guard('customer');
  const api = F.api('customer');
  const view = F.$('#view');
  F.$('#logo').innerHTML = F.logoSvg();
  F.$('#me').textContent = F.initials(ME.name);
  F.$('#me').onclick = async () => { if (await F.confirm('Sign out?', 'You can sign in again with your phone number.', 'Sign out')) F.logout('customer'); };

  const store = {
    get: (k, d) => { try { const v = localStorage.getItem('foodu.c.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem('foodu.c.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  const S = { addresses: [], addrId: store.get('addr', null), cart: { items: [], item_total: 0 }, menus: {}, restaurants: [], favs: store.get('favs', []), q: '' };

  const COUPONS = {
    WELCOME50: { text: '50% off up to ₹100 on orders above ₹149', min: 149, calc: (t) => Math.min(100, t * 0.5) },
    FLAT75: { text: '₹75 off on orders above ₹299', min: 299, calc: () => 75 }
  };
  const FEES = { delivery: 30, platform: 5, taxPct: 5 };
  const bill = (itemTotal, code) => {
    const c = code && COUPONS[code];
    const discount = c && itemTotal >= c.min ? Math.round(c.calc(itemTotal) * 100) / 100 : 0;
    const taxes = Math.round(itemTotal * FEES.taxPct) / 100;
    return { item_total: itemTotal, delivery_fee: FEES.delivery, platform_fee: FEES.platform, taxes, discount, total: Math.round((itemTotal + FEES.delivery + FEES.platform + taxes - discount) * 100) / 100 };
  };

  // ---------------- addresses + cart (header) ----------------
  async function loadAddresses() {
    S.addresses = await api('GET', '/me/addresses');
    if (!S.addresses.length) return false;
    if (!S.addresses.some((a) => a.address_id === S.addrId)) S.addrId = (S.addresses.find((a) => a.is_default) || S.addresses[0]).address_id;
    store.set('addr', S.addrId);
    const sel = F.$('#addrSel');
    sel.innerHTML = S.addresses.map((a) => '<option value="' + a.address_id + '"' + (a.address_id === S.addrId ? ' selected' : '') + '>' + F.esc(a.label) + ' · ' + F.esc(a.address_line.slice(0, 32)) + '</option>').join('');
    sel.onchange = () => { S.addrId = +sel.value; store.set('addr', S.addrId); S.restaurants = []; if (current === 'home') home(); };
    return true;
  }
  async function loadCart() { S.cart = await api('GET', '/cart'); drawCount(); return S.cart; }
  function drawCount() {
    const n = S.cart.items.reduce((a, i) => a + i.quantity, 0), el = F.$('#cartCount');
    if (el.textContent !== String(n)) { el.textContent = n; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  async function menuOf(rid) {
    if (!S.menus[rid]) S.menus[rid] = await api('GET', '/restaurants/' + rid + '/menu');
    return S.menus[rid];
  }
  const restInfo = (rid) => S.restaurants.find((r) => r.restaurant_id === +rid) || {};

  let current = '';
  F.$('#q').addEventListener('input', (e) => { S.q = e.target.value.trim().toLowerCase(); if (current !== 'home') location.hash = '#/home'; else drawList(); });

  // ================= HOME =================
  const SLIDES = [
    { code: 'WELCOME50', title: '50% off your first order', sub: 'Up to ₹100 on orders above ₹149', img: 'biryani', bg: '#111311' },
    { code: 'FLAT75', title: 'Flat ₹75 off', sub: 'On orders above ₹299 from any restaurant', img: 'pizza', bg: '#0E8A42' },
    { code: null, title: 'South Indian breakfast', sub: 'Dosa, idli and filter coffee, fresh and hot', img: 'dosa', bg: '#7A4B00' }
  ];
  const CHIPS = [
    ['Biryani', (r) => /biryani/i.test(r.cuisines)], ['South Indian', (r) => /south indian/i.test(r.cuisines)], ['Pizza', (r) => /pizza/i.test(r.cuisines)],
    ['North Indian', (r) => /north indian/i.test(r.cuisines)], ['Rating 4.5+', (r) => Number(r.avg_rating) >= 4.5], ['Under 30 min', (r) => r.eta_mins <= 30], ['Saved', (r) => S.favs.includes(r.restaurant_id)]
  ];
  let filters = [], sort = 'rel', slideI = 0, slideT = null;

  async function home() {
    current = 'home'; F.poll(null);
    const pre = F.hashParam('f'); if (pre) filters = CHIPS.some((c) => c[0] === pre) ? [pre] : [];
    view.innerHTML =
      '<section class="carousel up" id="car">' + SLIDES.map((s, i) =>
        '<div class="slide' + (i === 0 ? ' on' : '') + '" style="background:' + s.bg + ';--bg:' + s.bg + '"><div class="txt">' +
        (s.code ? '<span class="chip" style="align-self:flex-start;background:rgba(255,255,255,.16);color:#fff">Use code ' + s.code + '</span>' : '<span class="chip" style="align-self:flex-start;background:rgba(255,255,255,.16);color:#fff">Morning picks</span>') +
        '<h2>' + s.title + '</h2><span style="color:#DDE6E0;font-size:17px">' + s.sub + '</span>' +
        (s.code ? '<button class="btn btn-outline-w sm" style="align-self:flex-start" data-code="' + s.code + '">Apply at checkout</button>' : '') +
        '</div><div class="ph"><img src="' + F.img(s.img) + '" alt=""></div></div>').join('') +
      '<div class="dots">' + SLIDES.map((s, i) => '<button type="button" aria-label="Offer ' + (i + 1) + '" data-dot="' + i + '" class="' + (i === 0 ? 'on' : '') + '"></button>').join('') + '</div></section>' +
      '<div class="filters" id="filters"></div>' +
      '<div class="row between wrapf" style="margin-bottom:14px"><h2 style="font-size:26px;font-weight:800" id="rcount">Restaurants near you</h2></div>' +
      '<div class="rgrid" id="list">' + '<div class="skeleton" style="height:280px"></div>'.repeat(3) + '</div>';
    const show = (i) => { slideI = i; F.$$('.slide').forEach((s, j) => s.classList.toggle('on', j === i)); F.$$('[data-dot]').forEach((d, j) => d.classList.toggle('on', j === i)); };
    clearInterval(slideT); slideT = setInterval(() => { if (!document.getElementById('car')) return clearInterval(slideT); show((slideI + 1) % SLIDES.length); }, 4000);
    F.$$('[data-dot]').forEach((d) => d.onclick = () => show(+d.dataset.dot));
    F.$$('[data-code]').forEach((b) => b.onclick = () => { store.set('coupon', b.dataset.code); F.toast(b.dataset.code + ' will be applied at checkout'); });
    drawFilters();
    try {
      if (!S.restaurants.length) S.restaurants = await api('GET', '/restaurants?address_id=' + S.addrId);
      drawList();
    } catch (e) { F.$('#list').innerHTML = '<div class="empty card">' + F.esc(e.message) + '</div>'; }
  }
  function drawFilters() {
    const f = F.$('#filters'); if (!f) return;
    f.innerHTML = CHIPS.map((c) => '<button type="button" class="pill' + (filters.includes(c[0]) ? ' on' : '') + '" data-f="' + c[0] + '">' + c[0] + (filters.includes(c[0]) ? ' ✕' : '') + '</button>').join('') +
      '<select id="sort" aria-label="Sort"><option value="rel">Sort: Relevance</option><option value="rating">Rating</option><option value="eta">Delivery time</option><option value="km">Distance</option></select>';
    F.$('#sort').value = sort;
    F.$('#sort').onchange = (e) => { sort = e.target.value; drawList(); };
    F.$$('[data-f]', f).forEach((b) => b.onclick = () => { const k = b.dataset.f, i = filters.indexOf(k); if (i >= 0) filters.splice(i, 1); else filters.push(k); drawFilters(); drawList(); });
  }
  function drawList() {
    const box = F.$('#list'); if (!box) return;
    let list = S.restaurants.filter((r) => filters.every((f) => CHIPS.find((c) => c[0] === f)[1](r)));
    if (S.q) list = list.filter((r) => (r.name + ' ' + r.cuisines).toLowerCase().includes(S.q));
    const by = { rating: (a, b) => b.avg_rating - a.avg_rating, eta: (a, b) => a.eta_mins - b.eta_mins, km: (a, b) => a.distance_km - b.distance_km };
    if (by[sort]) list = list.slice().sort(by[sort]);
    F.$('#rcount').textContent = list.length + ' restaurant' + (list.length === 1 ? '' : 's') + ' near you';
    if (!list.length) {
      box.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3 style="color:var(--ink);margin-bottom:6px">No restaurants match</h3>' +
        (S.restaurants.length ? 'Try removing a filter.' : 'Nothing is open near this address right now.') + '<br><br>' + (filters.length || S.q ? '<button class="btn btn-dark" id="clr">Clear filters</button>' : '') + '</div>';
      const c = F.$('#clr'); if (c) c.onclick = () => { filters = []; S.q = ''; F.$('#q').value = ''; drawFilters(); drawList(); };
      return;
    }
    const offers = ['50% OFF up to ₹100', 'FLAT ₹75 OFF', 'Free delivery'];
    box.innerHTML = list.map((r, i) =>
      '<a class="card lift rcard up" style="animation-delay:' + i * 0.06 + 's" href="#/r/' + r.restaurant_id + '">' +
      '<div class="photo"><img loading="lazy" src="' + F.restImg(r.cuisines + ' ' + r.name, r.restaurant_id) + '" alt="' + F.esc(r.name) + '"><span class="off">' + offers[r.restaurant_id % 3] + '</span></div>' +
      '<button type="button" class="heart' + (S.favs.includes(r.restaurant_id) ? ' on' : '') + '" data-fav="' + r.restaurant_id + '" aria-label="Save ' + F.esc(r.name) + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111311" stroke-width="2"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/></svg></button>' +
      '<div class="b"><div class="row between"><h3 style="font-size:19px;font-weight:800">' + F.esc(r.name) + '</h3><span class="rating">★ ' + Number(r.avg_rating).toFixed(1) + '</span></div>' +
      '<span class="muted">' + F.esc(r.cuisines || '') + '</span><span class="bold">' + r.eta_mins + ' min · ' + Number(r.distance_km).toFixed(1) + ' km</span></div></a>').join('');
    F.$$('[data-fav]', box).forEach((b) => b.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = +b.dataset.fav, i = S.favs.indexOf(id);
      if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
      store.set('favs', S.favs);
      b.classList.toggle('on', i < 0); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      F.toast(i < 0 ? 'Saved to favourites' : 'Removed from favourites');
    });
  }

  // ================= MENU =================
  let vegOnly = false, cat = 'All';
  async function menu(rid) {
    current = 'menu'; F.poll(null); rid = +rid; vegOnly = false; cat = 'All';
    view.innerHTML = '<div class="skeleton" style="height:220px"></div>';
    let m;
    try {
      [m] = await Promise.all([menuOf(rid), loadCart(), S.restaurants.length ? null : api('GET', '/restaurants?address_id=' + S.addrId).then((r) => { S.restaurants = r; })]);
    } catch (e) { view.innerHTML = '<div class="card empty">' + F.esc(e.message) + '<br><br><a class="btn btn-dark" href="#/home">Back to restaurants</a></div>'; return; }
    const r = m.restaurant, info = restInfo(rid);
    const cover = F.restImg((info.cuisines || '') + ' ' + r.name, rid);
    view.innerHTML =
      '<section class="banner up"><img src="' + F.img(rid % 2 ? 'restaurant-1' : 'restaurant-2') + '" alt=""><div class="in">' +
      F.photo(cover, r.name, 'dish') +
      '<div class="col grow" style="gap:8px"><a href="#/home" style="color:#DDF3E5;font-weight:600">← All restaurants</a><h1 style="font-size:clamp(28px,4vw,40px);font-weight:800">' + F.esc(r.name) + '</h1>' +
      '<div class="row wrapf" style="gap:8px">' + (info.avg_rating ? '<span class="rating">★ ' + Number(info.avg_rating).toFixed(1) + '</span>' : '') +
      (info.cuisines ? '<span class="glass">' + F.esc(info.cuisines) + '</span>' : '') + (info.eta_mins ? '<span class="glass">' + info.eta_mins + ' min</span><span class="glass">' + Number(info.distance_km).toFixed(1) + ' km</span>' : '') +
      (r.is_open ? '' : '<span class="badge b-err">Closed now</span>') + '</div></div></div></section>' +
      '<div class="menu"><nav class="cats card" style="padding:10px" id="cats"></nav>' +
      '<section><div class="row between wrapf"><h2 style="font-size:24px;font-weight:800" id="catTitle">Menu</h2>' +
      '<label class="row" style="gap:10px;font-weight:600"><span class="veg"></span>Veg only <button type="button" class="sw" id="veg" aria-pressed="false" aria-label="Veg only"></button></label></div><div id="dishes"></div></section>' +
      '<aside class="card cartp" id="cartp"></aside></div>';
    F.$('#veg').onclick = (e) => { vegOnly = !vegOnly; e.currentTarget.classList.toggle('on', vegOnly); e.currentTarget.setAttribute('aria-pressed', vegOnly); drawDishes(rid); };
    drawCats(rid); drawDishes(rid); drawCartPanel();
  }
  function drawCats(rid) {
    const m = S.menus[rid], box = F.$('#cats'); if (!box) return;
    const all = [['All', m.menu.reduce((a, c) => a + c.items.length, 0)]].concat(m.menu.map((c) => [c.category, c.items.length]));
    box.innerHTML = all.map((c) => '<button type="button" class="' + (cat === c[0] ? 'on' : '') + '" data-cat="' + F.esc(c[0]) + '"><span>' + F.esc(c[0]) + '</span><span>' + c[1] + '</span></button>').join('');
    F.$$('[data-cat]', box).forEach((b) => b.onclick = () => { cat = b.dataset.cat; drawCats(rid); drawDishes(rid); });
  }
  const qtyOf = (itemId) => S.cart.items.filter((l) => l.item_id === itemId).reduce((a, l) => a + l.quantity, 0);
  function drawDishes(rid) {
    const m = S.menus[rid], box = F.$('#dishes'); if (!box) return;
    F.$('#catTitle').textContent = cat === 'All' ? 'Full menu' : cat;
    let n = 0, h = '';
    m.menu.filter((c) => cat === 'All' || c.category === cat).forEach((c) => {
      const items = c.items.filter((i) => !vegOnly || i.is_veg);
      if (!items.length) return;
      if (cat === 'All') h += '<h3 style="font-size:19px;font-weight:800;margin-top:22px">' + F.esc(c.category) + '</h3>';
      items.forEach((i) => {
        const q = qtyOf(i.item_id), sold = !i.in_stock || !m.restaurant.is_open;
        const best = Number(i.price) >= 299 || /dum|masala dosa|margherita/i.test(i.name);
        h += '<div class="dish-row" style="animation-delay:' + (n++ * 0.04) + 's"><div class="grow col" style="gap:6px">' +
          '<span class="row" style="gap:8px"><span class="veg' + (i.is_veg ? '' : ' nv') + '" title="' + (i.is_veg ? 'Veg' : 'Non-veg') + '"></span>' + (best ? '<span class="best">★ BESTSELLER</span>' : '') + '</span>' +
          '<h3 style="font-size:18px;font-weight:700">' + F.esc(i.name) + '</h3><b>' + F.money(i.price) + '</b>' +
          '<span class="muted" style="font-size:15px">' + F.esc(i.description || '') + '</span>' + (i.addons.length ? '<span class="small muted">Customisable</span>' : '') + '</div>' +
          '<div class="pic">' + F.photo(F.dishImg(i.name, (restInfo(rid).cuisines || '')), i.name, 'zoom' + (sold ? ' gray' : '')) + '<div class="add">' +
          (sold ? '<button class="addbtn" disabled style="color:var(--muted)">' + (i.in_stock ? 'CLOSED' : 'SOLD OUT') + '</button>'
            : q ? '<div class="step"><button type="button" data-minus="' + i.item_id + '" aria-label="Remove one">−</button><span>' + q + '</span><button type="button" data-plus="' + i.item_id + '" aria-label="Add one">+</button></div>'
              : '<button type="button" class="addbtn" data-plus="' + i.item_id + '">ADD</button>') + '</div></div></div>';
      });
    });
    box.innerHTML = h || '<div class="empty">No dishes here' + (vegOnly ? ' with Veg only on' : '') + '.</div>';
    F.$$('[data-plus]', box).forEach((b) => b.onclick = () => plus(rid, +b.dataset.plus, b));
    F.$$('[data-minus]', box).forEach((b) => b.onclick = () => minus(+b.dataset.minus));
  }
  const findItem = (rid, itemId) => { for (const c of S.menus[rid].menu) for (const i of c.items) if (i.item_id === itemId) return i; return null; };
  async function setLine(itemId, qty, addonIds, replace) {
    try {
      S.cart = await api('POST', '/cart/items', { item_id: itemId, quantity: qty, addon_ids: addonIds, replace_cart: !!replace });
      return true;
    } catch (e) {
      if (e.status === 409 && /another restaurant/i.test(e.message)) {
        if (await F.confirm('Start a new cart?', 'Your cart has dishes from another restaurant. Clear it and add this dish?', 'Clear and add')) return setLine(itemId, qty, addonIds, true);
        return false;
      }
      F.toast(e.message, true); return false;
    } finally { refreshMenuBits(); }
  }
  function refreshMenuBits() { drawCount(); const rid = +((location.hash.match(/#\/r\/(\d+)/) || [])[1]); if (rid && S.menus[rid]) { drawDishes(rid); drawCartPanel(); } }
  async function plus(rid, itemId, btn) {
    const it = findItem(rid, itemId);
    if (it.addons.length) return addonDialog(rid, it);
    const line = S.cart.items.find((l) => l.item_id === itemId && !l.selected_addons.length);
    if (btn) btn.disabled = true;
    if (await setLine(itemId, (line ? line.quantity : 0) + 1, [])) F.toast('Added ' + it.name);
  }
  async function minus(itemId) {
    const lines = S.cart.items.filter((l) => l.item_id === itemId); const l = lines[lines.length - 1]; if (!l) return;
    if (l.quantity > 1) await setLine(itemId, l.quantity - 1, l.selected_addons.map(Number));
    else { S.cart = await api('DELETE', '/cart/items/' + l.cart_item_id).catch((e) => { F.toast(e.message, true); return S.cart; }); refreshMenuBits(); }
  }
  function addonDialog(rid, it) {
    const chosen = new Set();
    const d = F.dialog('<div class="photo" style="height:200px">' + '<img src="' + F.dishImg(it.name, restInfo(rid).cuisines) + '" alt=""></div><div style="padding:22px" class="col">' +
      '<span class="row" style="gap:8px"><span class="veg' + (it.is_veg ? '' : ' nv') + '"></span><h2 style="font-size:22px">' + F.esc(it.name) + '</h2></span>' +
      '<span class="muted">' + F.esc(it.description || '') + '</span><b>Add-ons</b>' +
      it.addons.map((a) => '<label class="opt" style="align-items:center;cursor:pointer"><input type="checkbox" data-ad="' + a.addon_id + '" style="width:20px;height:20px;accent-color:#13A04F"><span class="grow">' + F.esc(a.name) + '</span><b>+' + F.money(a.price) + '</b></label>').join('') +
      '<button class="btn btn-dark lg block" id="adok"></button></div>');
    const price = () => Number(it.price) + it.addons.filter((a) => chosen.has(a.addon_id)).reduce((s, a) => s + Number(a.price), 0);
    const btn = d.querySelector('#adok'), upd = () => { btn.textContent = 'Add item · ' + F.money(price()); };
    upd();
    d.querySelectorAll('[data-ad]').forEach((c) => c.onchange = () => { const id = +c.dataset.ad; c.checked ? chosen.add(id) : chosen.delete(id); upd(); });
    btn.onclick = async () => {
      const ids = [...chosen].sort((a, b) => a - b);
      const same = S.cart.items.find((l) => l.item_id === it.item_id && l.selected_addons.map(Number).sort((a, b) => a - b).join() === ids.join());
      F.busy(btn, true);
      if (await setLine(it.item_id, (same ? same.quantity : 0) + 1, ids)) { F.closeDialog(); F.toast('Added ' + it.name); } else F.busy(btn, false);
    };
  }
  function addonNames(rid, line) {
    const it = rid && S.menus[rid] ? findItem(rid, line.item_id) : null;
    if (!it || !line.selected_addons.length) return '';
    return it.addons.filter((a) => line.selected_addons.map(Number).includes(a.addon_id)).map((a) => a.name).join(', ');
  }
  function drawCartPanel() {
    const box = F.$('#cartp'); if (!box) return;
    const c = S.cart, rid = c.restaurant_id;
    if (!c.items.length) {
      box.innerHTML = '<h2 style="font-size:22px;font-weight:800">Your cart</h2><div class="empty" style="padding:20px 0">' + F.photo(F.img('salad'), '', '') .replace('class="photo "', 'class="photo" style="width:120px;height:120px;border-radius:50%;margin:0 auto 12px"') + 'Your cart is empty.<br>Add something tasty!</div>';
      return;
    }
    const b = bill(c.item_total, null), need = 299 - c.item_total;
    box.innerHTML = '<h2 style="font-size:22px;font-weight:800">Your cart</h2>' + (S.menus[rid] ? '<span class="muted small">from ' + F.esc(S.menus[rid].restaurant.name) + '</span>' : '') +
      c.items.map((l, i) => '<div class="cline" style="animation-delay:' + i * 0.04 + 's">' + F.photo(F.dishImg(l.name), l.name, 'thumb') +
        '<div class="grow col" style="gap:0"><b style="font-size:15px">' + F.esc(l.name) + '</b>' + (addonNames(rid, l) ? '<span class="small muted">' + F.esc(addonNames(rid, l)) + '</span>' : '') + (l.in_stock ? '' : '<span class="small" style="color:var(--nonveg)">Sold out – remove it</span>') + '</div>' +
        '<div class="stp"><button type="button" data-cm="' + l.cart_item_id + '" aria-label="Less">−</button><b style="min-width:20px;text-align:center">' + l.quantity + '</b><button type="button" data-cp="' + l.cart_item_id + '" aria-label="More">+</button></div>' +
        '<b style="min-width:62px;text-align:right">' + F.money(l.line_total) + '</b></div>').join('') +
      (need > 0 ? '<div class="nudge">Add ' + F.money(need) + ' more to unlock FLAT75<div class="prog"><i style="width:' + Math.min(100, c.item_total / 299 * 100) + '%"></i></div></div>' : '<div class="note ok">FLAT75 unlocked · ₹75 off at checkout</div>') +
      '<div class="billrow"><span>Item total</span><span>' + F.money(b.item_total) + '</span></div><div class="billrow muted"><span>Delivery + platform fee</span><span>' + F.money(b.delivery_fee + b.platform_fee) + '</span></div>' +
      '<div class="billrow muted"><span>Taxes (5%)</span><span>' + F.money(b.taxes) + '</span></div><div class="billrow xbold" style="font-size:18px"><span>To pay</span><span>' + F.money(b.total) + '</span></div>' +
      '<a class="btn btn-dark lg block" href="#/checkout">Checkout</a>';
    F.$$('[data-cp]', box).forEach((x) => x.onclick = () => { const l = c.items.find((y) => y.cart_item_id === +x.dataset.cp); setLine(l.item_id, l.quantity + 1, l.selected_addons.map(Number)); });
    F.$$('[data-cm]', box).forEach((x) => x.onclick = async () => {
      const l = c.items.find((y) => y.cart_item_id === +x.dataset.cm);
      if (l.quantity > 1) setLine(l.item_id, l.quantity - 1, l.selected_addons.map(Number));
      else { S.cart = await api('DELETE', '/cart/items/' + l.cart_item_id); refreshMenuBits(); }
    });
  }

  // ================= CHECKOUT =================
  const CO = { pay: 'NEW', coupon: null, pending: store.get('pending', null), saveCard: true, card: { num: '', name: '', exp: '', cvv: '' }, vpa: '' };
  const network = (n) => /^4/.test(n) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(n) ? 'MASTERCARD' : /^(60|65|81|82)/.test(n) ? 'RUPAY' : /^3[47]/.test(n) ? 'AMEX' : '';
  async function checkout() {
    current = 'checkout'; F.poll(null);
    view.innerHTML = '<div class="skeleton" style="height:400px"></div>';
    let methods = [];
    try { [, methods] = await Promise.all([loadCart(), api('GET', '/me/payment-methods')]); if (S.cart.restaurant_id) await menuOf(S.cart.restaurant_id).catch(() => null); } catch (e) { view.innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; return; }
    if (!S.cart.items.length) {
      view.innerHTML = '<div class="card empty up" style="max-width:520px;margin:40px auto">' + '<div class="photo" style="width:160px;height:160px;border-radius:50%;margin:0 auto 16px"><img src="img/salad.jpg" alt=""></div><h2 style="color:var(--ink)">Your cart is empty</h2><p>Pick a restaurant and add a few dishes.</p><a class="btn btn-dark" href="#/home">Browse restaurants</a></div>';
      return;
    }
    if (CO.coupon === null) CO.coupon = store.get('coupon', null) || '';
    const cards = methods.filter((m) => m.method_type === 'CARD');
    if (CO.pay === 'NEW' && cards.length && !CO.touched) CO.pay = 'SAVED:' + cards[0].method_id;
    const rest = S.menus[S.cart.restaurant_id];
    view.innerHTML = '<a href="' + (S.cart.restaurant_id ? '#/r/' + S.cart.restaurant_id : '#/home') + '" class="bold">← Back to menu</a><h1 style="font-size:32px;font-weight:800;margin:10px 0 20px">Checkout</h1>' +
      '<div class="co"><div class="col" style="gap:20px">' +
      '<section class="card up" style="padding:22px"><div class="row between"><h2 style="font-size:20px;font-weight:800">Deliver to</h2><button class="btn btn-ghost sm" id="addAddr">+ Add address</button></div><div class="col" style="margin-top:14px" id="addrs"></div></section>' +
      '<section class="card up" style="padding:22px;animation-delay:.06s"><h2 style="font-size:20px;font-weight:800;margin-bottom:14px">Payment</h2><div class="col" id="pays"></div></section>' +
      '<section class="card up" style="padding:22px;animation-delay:.12s"><h2 style="font-size:20px;font-weight:800;margin-bottom:10px">Note for the restaurant</h2><textarea class="inp" id="note" maxlength="300" placeholder="Less spicy, no onion…"></textarea></section>' +
      '</div><aside class="card up" style="padding:22px;position:sticky;top:96px;animation-delay:.1s" id="billbox"></aside></div>';
    drawAddrs(); drawPays(cards); drawBill(rest);
    F.$('#addAddr').onclick = addAddressDialog;
  }
  function drawAddrs() {
    const box = F.$('#addrs'); if (!box) return;
    box.innerHTML = S.addresses.map((a) => '<button type="button" class="opt' + (a.address_id === S.addrId ? ' on' : '') + '" data-a="' + a.address_id + '"><span class="dot"></span><span class="col" style="gap:2px"><b>' + F.esc(a.label) + '</b><span class="muted">' + F.esc(a.address_line) + (a.landmark ? ' · ' + F.esc(a.landmark) : '') + '</span></span></button>').join('');
    F.$$('[data-a]', box).forEach((b) => b.onclick = () => { S.addrId = +b.dataset.a; store.set('addr', S.addrId); F.$('#addrSel').value = S.addrId; S.restaurants = []; drawAddrs(); });
  }
  function addAddressDialog() {
    const AREAS = [['Jayanagar', 12.9293, 77.5821], ['Koramangala', 12.9352, 77.6245], ['Basavanagudi', 12.9421, 77.5753], ['JP Nagar', 12.9108, 77.5859]];
    let area = 0, label = 'Home';
    const d = F.dialog('<div style="padding:24px" class="col"><h2 style="font-size:22px">New address</h2>' +
      '<div class="row wrapf" style="gap:8px">' + ['Home', 'Work', 'Other'].map((l) => '<button type="button" class="pill' + (l === label ? ' on' : '') + '" data-l="' + l + '">' + l + '</button>').join('') + '</div>' +
      '<div class="row wrapf" style="gap:8px">' + AREAS.map((a, i) => '<button type="button" class="pill g' + (i === 0 ? ' on' : '') + '" data-ar="' + i + '">' + a[0] + '</button>').join('') + '</div>' +
      '<label class="field"><span>House / street</span><input class="inp" id="nl"></label><label class="field"><span>Landmark (optional)</span><input class="inp" id="nm"></label>' +
      '<button class="btn btn-dark lg" id="ns">Save address</button></div>');
    d.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => { label = b.dataset.l; d.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('on', x === b)); });
    d.querySelectorAll('[data-ar]').forEach((b) => b.onclick = () => { area = +b.dataset.ar; d.querySelectorAll('[data-ar]').forEach((x) => x.classList.toggle('on', x === b)); });
    d.querySelector('#ns').onclick = async (e) => {
      const line = d.querySelector('#nl').value.trim(); if (line.length < 3) return F.shake(d.querySelector('#nl'));
      F.busy(e.currentTarget, true);
      try {
        const a = AREAS[area];
        const row = await api('POST', '/me/addresses', { label, address_line: line + ', ' + a[0], landmark: d.querySelector('#nm').value.trim() || null, city: 'Bengaluru', latitude: a[1], longitude: a[2], is_default: false });
        S.addrId = row.address_id; store.set('addr', S.addrId);
        if (!current) { location.reload(); return; }
        await loadAddresses(); F.closeDialog(); drawAddrs(); if (current === 'orders') orders(); F.toast('Address saved');
      } catch (err) { F.busy(e.currentTarget, false); F.toast(err.message, true); }
    };
  }
  function drawPays(cards) {
    const box = F.$('#pays'); if (!box) return;
    const opt = (key, title, sub, extra) => '<button type="button" class="opt' + (CO.pay === key ? ' on' : '') + '" data-p="' + key + '"><span class="dot"></span><span class="col grow" style="gap:2px"><b>' + title + '</b><span class="muted small">' + sub + '</span></span>' + (extra || '') + '</button>';
    let h = cards.map((c) => opt('SAVED:' + c.method_id, (c.card_network || 'Card') + ' •••• ' + c.card_last4, 'Saved card · expires ' + String(c.card_expiry_month || '').padStart(2, '0') + '/' + String(c.card_expiry_year || '').slice(-2))).join('');
    h += opt('NEW', 'New debit / credit card', 'Visa, Mastercard, RuPay');
    if (CO.pay === 'NEW') {
      const n = CO.card.num.replace(/\s/g, ''), net = network(n);
      h += '<div class="col fade" style="padding:6px 4px 10px;gap:14px"><div class="ccard"><div class="row between"><b style="letter-spacing:.1em">' + (net || 'CARD') + '</b><span style="width:40px;height:28px;border-radius:6px;background:linear-gradient(135deg,#F5D27A,#C99A2E)"></span></div>' +
        '<div class="num" id="cnum">' + F.esc((n + '•'.repeat(Math.max(0, 16 - n.length))).replace(/(.{4})/g, '$1 ').trim()) + '</div>' +
        '<div class="row between small"><span id="cname">' + F.esc(CO.card.name.toUpperCase() || 'NAME ON CARD') + '</span><span id="cexp">' + F.esc(CO.card.exp || 'MM/YY') + '</span></div></div>' +
        '<label class="field"><span>Card number</span><input class="inp" id="kn" inputmode="numeric" autocomplete="cc-number" maxlength="19" value="' + F.esc(CO.card.num) + '" placeholder="4111 1111 1111 1111"></label>' +
        '<div class="grid3"><label class="field"><span>Name on card</span><input class="inp" id="kname" autocomplete="cc-name" value="' + F.esc(CO.card.name) + '"></label>' +
        '<label class="field"><span>Expiry</span><input class="inp" id="kexp" inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="MM/YY" value="' + F.esc(CO.card.exp) + '"></label>' +
        '<label class="field"><span>CVV</span><input class="inp" id="kcvv" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="•••"></label></div>' +
        '<label class="row small" style="gap:8px"><input type="checkbox" id="ksave"' + (CO.saveCard ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#13A04F"> Save this card securely (only a token and the last 4 digits are kept, never the CVV)</label>' +
        '<span class="small muted">Test cards: 4111 1111 1111 1111 works · 4000 0000 0000 0002 is declined. Any future expiry, any 3-digit CVV.</span></div>';
    }
    h += opt('UPI', 'UPI', 'Google Pay, PhonePe, Paytm');
    if (CO.pay === 'UPI') h += '<label class="field fade" style="padding:0 4px 10px"><span>UPI ID</span><input class="inp" id="vpa" placeholder="name@okbank" value="' + F.esc(CO.vpa) + '"></label>';
    h += opt('COD', 'Cash on delivery', 'Pay the rider when the food arrives');
    box.innerHTML = h;
    F.$$('[data-p]', box).forEach((b) => b.onclick = () => { CO.pay = b.dataset.p; CO.touched = true; drawPays(cards); drawBill(); });
    const kn = F.$('#kn');
    if (kn) {
      kn.oninput = () => { const v = kn.value.replace(/\D/g, '').slice(0, 16); kn.value = v.replace(/(.{4})/g, '$1 ').trim(); CO.card.num = kn.value; const n = v; F.$('#cnum').textContent = (n + '•'.repeat(Math.max(0, 16 - n.length))).replace(/(.{4})/g, '$1 ').trim(); F.$('.ccard b').textContent = network(n) || 'CARD'; };
      F.$('#kname').oninput = (e) => { CO.card.name = e.target.value; F.$('#cname').textContent = e.target.value.toUpperCase() || 'NAME ON CARD'; };
      F.$('#kexp').oninput = (e) => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; CO.card.exp = v; F.$('#cexp').textContent = v || 'MM/YY'; };
      F.$('#ksave').onchange = (e) => { CO.saveCard = e.target.checked; };
    }
    const vp = F.$('#vpa'); if (vp) vp.oninput = () => { CO.vpa = vp.value.trim(); };
  }
  function drawBill(restArg) {
    const box = F.$('#billbox'); if (!box) return;
    const rest = restArg || S.menus[S.cart.restaurant_id];
    const code = (CO.coupon || '').toUpperCase(), c = COUPONS[code];
    const valid = c && S.cart.item_total >= c.min;
    const b = bill(S.cart.item_total, valid ? code : null);
    let cmsg = '';
    if (code) {
      if (code === 'DIWALI20') cmsg = '<div class="note warn">DIWALI20 has expired.</div>';
      else if (!c) cmsg = '<div class="note err">"' + F.esc(code) + '" is not a valid code.</div>';
      else if (!valid) cmsg = '<div class="note warn">' + code + ' needs an item total of ' + F.money(c.min) + '. Add ' + F.money(c.min - S.cart.item_total) + ' more.</div>';
      else cmsg = '<div class="note ok pop">' + code + ' applied · you save ' + F.money(b.discount) + '</div>';
    }
    box.innerHTML = '<h2 style="font-size:20px;font-weight:800">' + (rest ? F.esc(rest.restaurant.name) : 'Your order') + '</h2>' +
      '<div class="col" style="gap:8px;margin:12px 0">' + S.cart.items.map((l) => '<div class="row" style="gap:10px">' + F.photo(F.dishImg(l.name), l.name, 'thumb') + '<span class="grow">' + l.quantity + ' × ' + F.esc(l.name) + '</span><b>' + F.money(l.line_total) + '</b></div>').join('') + '</div>' +
      '<div class="row" style="gap:8px"><input class="inp" id="cpn" placeholder="Coupon code" value="' + F.esc(code) + '" style="text-transform:uppercase">' +
      (code ? '<button class="btn btn-ghost" id="cpx">Remove</button>' : '<button class="btn btn-dark" id="cpa">Apply</button>') + '</div>' + cmsg +
      '<div class="col" style="gap:8px;margin-top:14px"><div class="billrow"><span>Item total</span><span>' + F.money(b.item_total) + '</span></div>' +
      '<div class="billrow muted"><span>Delivery fee</span><span>' + F.money(b.delivery_fee) + '</span></div><div class="billrow muted"><span>Platform fee</span><span>' + F.money(b.platform_fee) + '</span></div>' +
      '<div class="billrow muted"><span>Taxes (5%)</span><span>' + F.money(b.taxes) + '</span></div>' + (b.discount ? '<div class="billrow" style="color:var(--green-text);font-weight:700"><span>Coupon discount</span><span>− ' + F.money(b.discount) + '</span></div>' : '') +
      '<div class="billrow xbold" style="font-size:20px;border-top:1px dashed var(--line);padding-top:10px"><span>To pay</span><span>' + F.money(b.total) + '</span></div></div>' +
      '<div id="paymsg" style="margin-top:12px"></div><button class="btn btn-dark lg block" id="pay" style="margin-top:12px">' + (CO.pay === 'COD' ? 'Place order · ' : 'Pay ') + F.money(b.total) + '</button>' +
      '<span class="small muted" style="display:block;text-align:center;margin-top:8px">🔒 Card details go only to the payment gateway</span>';
    const cpn = F.$('#cpn');
    cpn.onkeydown = (e) => { if (e.key === 'Enter') { CO.coupon = cpn.value.trim().toUpperCase(); store.set('coupon', CO.coupon); drawBill(); } };
    const a = F.$('#cpa'); if (a) a.onclick = () => { CO.coupon = cpn.value.trim().toUpperCase(); store.set('coupon', CO.coupon); drawBill(); };
    const x = F.$('#cpx'); if (x) x.onclick = () => { CO.coupon = ''; store.set('coupon', ''); drawBill(); };
    F.$('#pay').onclick = () => placeOrder(valid ? code : null);
  }
  function payErr(text) { const m = F.$('#paymsg'); m.innerHTML = '<div class="note err">' + F.esc(text) + '</div>'; F.shake(F.$('#billbox')); }

  async function placeOrder(coupon) {
    const btn = F.$('#pay'); F.$('#paymsg').innerHTML = '';
    // 1. collect payment details first (so a bad card does not create an order)
    let token = null, display = {};
    const cardPay = CO.pay === 'NEW', upi = CO.pay === 'UPI', saved = CO.pay.startsWith('SAVED:');
    if (cardPay) {
      const n = CO.card.num.replace(/\s/g, ''), [mm, yy] = CO.card.exp.split('/'), cvvEl = F.$('#kcvv');
      if (n.length < 13) { F.shake(F.$('#kn')); return payErr('Enter the full card number'); }
      if (!mm || !yy || +mm < 1 || +mm > 12) { F.shake(F.$('#kexp')); return payErr('Enter expiry as MM/YY'); }
      if (!/^[0-9]{3,4}$/.test(cvvEl.value)) { F.shake(cvvEl); return payErr('Enter the 3 digit CVV'); }
      F.busy(btn, true, 'Securing card…');
      try {
        // card number + CVV go ONLY to the gateway; we keep just the token
        const t = await F.gateway.tokenizeCard({ card_number: n, expiry_month: +mm, expiry_year: 2000 + +yy, cvv: cvvEl.value, name_on_card: CO.card.name || 'Card holder' });
        cvvEl.value = '';
        token = t.token; display = { card_network: t.network, card_last4: t.last4, card_expiry_month: t.expiry_month, card_expiry_year: t.expiry_year };
      } catch (e) { cvvEl.value = ''; F.busy(btn, false); return payErr(e.message); }
    } else if (upi) {
      if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(CO.vpa)) { F.shake(F.$('#vpa')); return payErr('Enter a valid UPI ID like name@okbank'); }
      F.busy(btn, true, 'Checking UPI…');
      try { token = (await F.gateway.tokenizeUpi(CO.vpa)).token; } catch (e) { F.busy(btn, false); return payErr(e.message); }
    }
    const mode = CO.pay === 'COD' ? 'COD' : upi ? 'UPI' : 'CARD';
    F.busy(btn, true, mode === 'COD' ? 'Placing order…' : 'Contacting your bank…');
    try {
      // 2. create the order (re-use a failed one if the cart did not change)
      let p = CO.pending;
      const sig = JSON.stringify([S.cart.items.map((l) => [l.cart_item_id, l.quantity]), S.addrId, coupon, mode]);
      if (!p || p.sig !== sig) {
        if (p && p.order_id) await api('POST', '/orders/' + p.order_id + '/cancel', { reason: 'Changed payment or cart' }).catch(() => null);
        const r = await api('POST', '/orders/checkout', { address_id: S.addrId, payment_mode: mode, coupon_code: coupon, special_instructions: (F.$('#note').value || '').trim() || null, idempotency_key: F.uuid() });
        p = { order_id: r.order_id, payment_id: r.payment_id, total: r.bill.total, sig };
        CO.pending = mode === 'COD' ? null : p; store.set('pending', CO.pending);
      }
      // 3. pay with the token only
      if (mode !== 'COD') {
        const body = saved ? { saved_method_id: +CO.pay.split(':')[1] } : { gateway_token: token, save_method: cardPay && CO.saveCard, ...display };
        await api('POST', '/payments/' + p.payment_id + '/pay', body);
        CO.pending = null; store.set('pending', null);
      }
      store.set('coupon', '');
      CO.coupon = null;
      await loadCart();
      success(p.order_id, p.total, mode);
    } catch (e) {
      F.busy(btn, false);
      payErr(e.status === 402 ? 'Payment failed: your bank declined the card. Try another card, UPI or cash.' : e.message);
    }
  }
  function success(orderId, total, mode) {
    const colors = ['#13A04F', '#FFD60A', '#E23744', '#111311', '#9FE0B8'];
    const conf = Array.from({ length: 40 }, (_, i) => '<i style="left:' + (Math.random() * 100) + '%;background:' + colors[i % 5] + ';animation-delay:' + (Math.random() * 0.5) + 's"></i>').join('');
    const d = F.dialog('<div style="position:relative;padding:34px 26px;text-align:center" class="col"><div class="confetti">' + conf + '</div>' +
      '<div class="tickc"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#13A04F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h2 style="font-size:28px;font-weight:800">Order placed!</h2><p class="muted" style="margin:0">Order #' + orderId + ' · ' + F.money(total) + (mode === 'COD' ? ' · pay cash to the rider' : ' · paid') + '</p>' +
      '<p style="margin:0">The restaurant will accept it in a moment.</p><button class="btn btn-dark lg block" id="trk">Track my order</button></div>', () => { location.hash = '#/track/' + orderId; });
    d.querySelector('#trk').onclick = () => { F.closeDialog(); location.hash = '#/track/' + orderId; };
  }

  // ================= TRACKING =================
  const STEPS = [['PLACED', 'Order placed', 'We sent it to the restaurant'], ['ACCEPTED', 'Accepted', 'The kitchen is cooking your food'], ['READY', 'Food is ready', 'Waiting for the rider to pick it up'], ['PICKED_UP', 'On the way', 'Your rider is heading to you'], ['DELIVERED', 'Delivered', 'Enjoy your meal!']];
  const RANK = { PAYMENT_PENDING: -1, PAYMENT_FAILED: -1, PLACED: 0, ACCEPTED: 1, PREPARING: 1, READY: 2, PICKED_UP: 3, DELIVERED: 4 };
  async function track(id) {
    current = 'track';
    view.innerHTML = '<div class="skeleton" style="height:520px"></div>';
    let first = true;
    const tick = async () => {
      let o;
      try { o = await api('GET', '/orders/' + id); } catch (e) { if (first) view.innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; return; }
      if (current !== 'track') return;
      if (first) { trackShell(o); first = false; }
      trackUpdate(o);
      if (['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status)) F.poll(null);
    };
    await tick();
    F.poll(tick, 4000);
  }
  function trackShell(o) {
    view.innerHTML = '<div class="row between wrapf" style="margin-bottom:16px"><div><a href="#/orders" class="bold">← My orders</a><h1 style="font-size:30px;font-weight:800;margin-top:6px">Order #' + o.order_id + '</h1><span class="muted">' + F.esc(o.restaurant_name) + ' · ' + F.money(o.total_amount) + ' · ' + o.payment_mode + '</span></div><span id="tbadge"></span></div>' +
      '<div class="trk"><div class="map tmap up" id="map">' +
      '<div class="park" style="left:6%;top:58%;width:22%;height:26%"></div><div class="park" style="left:62%;top:8%;width:18%;height:20%"></div><div class="water" style="left:40%;top:70%;width:26%;height:14%"></div>' +
      '<div class="seg" id="s1" style="left:18%;top:22%;width:52%;height:8px"><i></i></div><div class="seg v" id="s2" style="left:70%;top:22%;width:8px;height:44%"><i></i></div>' +
      '<div class="pin" style="left:18%;top:23%">' + '<img src="' + F.restImg(o.restaurant_name, o.restaurant_id) + '" alt="Restaurant"></div><div class="tag" style="left:12%;top:12%">' + F.esc(o.restaurant_name) + '</div>' +
      '<div class="ping" style="left:70.5%;top:66%"></div><div class="pin" style="left:70.5%;top:66%;background:var(--green)">⌂</div><div class="tag" style="left:66%;top:72%">You</div>' +
      '<div class="pin rider hide" id="rider" title="Rider">🛵</div>' +
      '<div class="float-card"><div class="row between"><b style="font-size:20px" id="eta"></b><span class="muted small" id="etasub"></span></div><div class="bar" style="margin-top:10px"><i id="pbar"></i></div></div></div>' +
      '<aside class="col" style="gap:16px"><section class="card up" style="padding:22px"><div class="tl" id="tl"></div></section><section class="card up" style="padding:18px;animation-delay:.08s" id="rcard"></section><section class="card up" style="padding:18px;animation-delay:.14s" id="items"></section></aside></div>';
    F.$('#items').innerHTML = '<b>Items</b>' + o.items.map((i) => '<div class="row" style="gap:10px;margin-top:10px">' + F.photo(F.dishImg(i.item_name), '', 'thumb') + '<span class="grow">' + i.quantity + ' × ' + F.esc(i.item_name) + '</span><b>' + F.money(i.line_total) + '</b></div>').join('') +
      '<div class="billrow xbold" style="margin-top:12px"><span>Total</span><span>' + F.money(o.total_amount) + '</span></div>';
  }
  function trackUpdate(o) {
    const rank = RANK[o.status] == null ? -1 : RANK[o.status];
    F.$('#tbadge').innerHTML = F.badge(o.status);
    const at = (st) => { const t = o.timeline.filter((x) => x.status === st).pop(); return t ? F.when(t.changed_at) : ''; };
    F.$('#tl').innerHTML = (o.status === 'CANCELLED' ? '<div class="note err">This order was cancelled' + (o.cancel_reason ? ': ' + F.esc(o.cancel_reason) : '') + '.</div>' : '') +
      (o.status === 'PAYMENT_FAILED' || o.status === 'PAYMENT_PENDING' ? '<div class="note warn" style="margin-bottom:12px">Payment is not complete. Go to checkout to try again.</div>' : '') +
      STEPS.map((s, i) => '<div class="s ' + (i < rank || o.status === 'DELIVERED' ? 'done' : i === rank ? 'now' : 'next') + '"><b class="c">' + (i < rank || o.status === 'DELIVERED' ? '✓' : i + 1) + '</b><div class="col" style="gap:0"><span class="t bold">' + s[1] + '</span><span class="muted small">' + (at(s[0]) || (i === 1 ? at('PREPARING') : '') || s[2]) + '</span></div></div>').join('');
    // ETA + progress + rider position
    const pick = o.timeline.filter((x) => x.status === 'PICKED_UP').pop();
    const ride = pick ? Math.min(0.95, (Date.now() - new Date(pick.changed_at).getTime()) / (15 * 60000)) : 0;
    const eta = { 0: 35, 1: 28, 2: 18, 3: Math.max(1, Math.round(15 * (1 - ride))) }[rank];
    F.$('#eta').textContent = o.status === 'DELIVERED' ? 'Delivered · enjoy!' : o.status === 'CANCELLED' ? 'Order cancelled' : eta ? 'Arriving in ' + eta + ' min' : 'Waiting for payment';
    F.$('#etasub').textContent = F.statusInfo(o.status).label;
    F.$('#pbar').style.width = (o.status === 'DELIVERED' ? 100 : rank < 0 ? 4 : rank === 3 ? 60 + ride * 38 : [10, 30, 50][rank]) + '%';
    const s1 = F.$('#s1'), s2 = F.$('#s2'), rider = F.$('#rider');
    s1.className = 'seg' + (rank >= 3 ? (ride > 0.55 || rank === 4 ? ' gone' : '') : ' todo');
    s2.className = 'seg v' + (rank === 4 ? ' gone' : rank === 3 && ride > 0.55 ? '' : ' todo');
    if (o.partner_id && rank >= 1) {
      rider.classList.remove('hide');
      // route: (18,23)->(70.5,23)->(70.5,66). first 55% of the ride is the horizontal leg.
      let x = 18, y = 23;
      if (rank === 4) { x = 70.5; y = 66; } else if (rank === 3) { if (ride <= 0.55) x = 18 + (52.5 * ride / 0.55); else { x = 70.5; y = 23 + 43 * (ride - 0.55) / 0.45; } }
      rider.style.left = x + '%'; rider.style.top = y + '%';
    } else rider.classList.add('hide');
    F.$('#rcard').innerHTML = o.partner_id
      ? '<div class="row"><span class="avatar" style="background:var(--ink);color:#fff">' + F.initials(o.partner_name) + '</span><div class="grow col" style="gap:0"><b>' + F.esc(o.partner_name || 'Your rider') + '</b><span class="muted small">' + (rank === 4 ? 'delivered your order' : rank === 3 ? 'is on the way with your food' : 'will pick up your food') + '</span></div><a class="btn btn-ghost sm" href="tel:0000000000">Call</a></div>'
      : '<div class="row"><span class="spin dark"></span><span class="muted">' + (rank >= 1 ? 'Finding a rider near the restaurant…' : 'A rider is assigned after the restaurant accepts.') + '</span></div>';
    if (['PLACED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(o.status) && !F.$('#cxl')) {
      F.$('#rcard').insertAdjacentHTML('beforeend', '<button class="btn btn-red sm" id="cxl" style="margin-top:12px">Cancel order</button>');
    }
    const cx = F.$('#cxl');
    if (cx) cx.onclick = async () => { if (!(await F.confirm('Cancel this order?', 'If you paid, the amount is refunded to your card or UPI.', 'Cancel order'))) return; try { await api('POST', '/orders/' + o.order_id + '/cancel', { reason: 'Cancelled by customer' }); F.toast('Order cancelled'); track(o.order_id); } catch (e) { F.toast(e.message, true); } };
    if (o.status === 'DELIVERED' && !F.$('#rateNow')) F.$('#rcard').insertAdjacentHTML('beforeend', '<button class="btn btn-dark block" id="rateNow" style="margin-top:12px">Rate this order</button>');
    const rn = F.$('#rateNow'); if (rn) rn.onclick = () => rateDialog(o.order_id, o.restaurant_name);
  }

  // ================= ORDERS / ADDRESSES / CARDS =================
  let otab = 'Orders';
  async function orders() {
    current = 'orders'; F.poll(null);
    view.innerHTML = '<h1 style="font-size:32px;font-weight:800">My account</h1><div class="tabs" id="otabs"></div><div id="obox"><div class="skeleton" style="height:120px"></div></div>';
    const tabs = () => { F.$('#otabs').innerHTML = ['Orders', 'Addresses', 'Saved cards'].map((t) => '<button class="pill' + (t === otab ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>').join(''); F.$$('[data-t]').forEach((b) => b.onclick = () => { otab = b.dataset.t; orders(); }); };
    tabs();
    const box = F.$('#obox');
    try {
      if (otab === 'Orders') {
        const list = await api('GET', '/me/orders');
        if (!list.length) { box.innerHTML = '<div class="card empty">No orders yet.<br><br><a class="btn btn-dark" href="#/home">Order something</a></div>'; return; }
        box.innerHTML = '<div class="col">' + list.map((o, i) => {
          const live = !['DELIVERED', 'CANCELLED', 'REFUNDED', 'PAYMENT_FAILED'].includes(o.status);
          return '<div class="card lift ocard" style="animation-delay:' + i * 0.05 + 's">' + F.photo(F.restImg(o.restaurant), o.restaurant, o.status === 'CANCELLED' ? 'gray' : '') +
            '<div class="grow col" style="gap:4px;min-width:180px"><div class="row wrapf" style="gap:10px"><b style="font-size:18px">' + F.esc(o.restaurant) + '</b>' + F.badge(o.status) + '</div>' +
            '<span class="muted">#' + o.order_id + ' · ' + F.when(o.placed_at) + ' · ' + o.payment_mode + '</span><b>' + F.money(o.total_amount) + '</b></div>' +
            '<div class="row wrapf" style="gap:8px">' + (live ? '<a class="btn btn-dark sm" href="#/track/' + o.order_id + '">Track</a>' : '<a class="btn btn-ghost sm" href="#/track/' + o.order_id + '">Details</a>') +
            (o.status === 'DELIVERED' ? '<button class="btn btn-green sm" data-rate="' + o.order_id + '" data-rn="' + F.esc(o.restaurant) + '">Rate</button><button class="btn btn-ghost sm" data-again="' + o.order_id + '">Order again</button>' : '') + '</div></div>';
        }).join('') + '</div>';
        F.$$('[data-rate]', box).forEach((b) => b.onclick = () => rateDialog(+b.dataset.rate, b.dataset.rn));
        F.$$('[data-again]', box).forEach((b) => b.onclick = async () => { try { const o = await api('GET', '/orders/' + b.dataset.again); location.hash = '#/r/' + o.restaurant_id; } catch (e) { F.toast(e.message, true); } });
      } else if (otab === 'Addresses') {
        box.innerHTML = '<div class="col">' + S.addresses.map((a, i) => '<div class="card ocard" style="animation-delay:' + i * 0.05 + 's"><span class="avatar" style="background:var(--green-tint);color:var(--green-text)">' + F.esc(a.label[0]) + '</span><div class="grow col" style="gap:2px"><b>' + F.esc(a.label) + (a.is_default ? ' <span class="badge b-green">Default</span>' : '') + '</b><span class="muted">' + F.esc(a.address_line) + (a.landmark ? ' · ' + F.esc(a.landmark) : '') + ', ' + F.esc(a.city) + '</span></div></div>').join('') +
          '<button class="btn btn-dark" id="na" style="align-self:flex-start">+ Add address</button></div>';
        F.$('#na').onclick = () => { addAddressDialog(); };
      } else {
        const ms = await api('GET', '/me/payment-methods');
        box.innerHTML = ms.length ? '<div class="rgrid">' + ms.map((m) => '<div class="ccard up"><div class="row between"><b>' + F.esc(m.card_network || m.method_type) + '</b>' + (m.is_default ? '<span class="badge" style="background:rgba(255,255,255,.2)">Default</span>' : '') + '</div><div class="num">•••• •••• •••• ' + F.esc(m.card_last4 || '') + '</div><div class="small">' + (m.card_expiry_month ? 'Expires ' + String(m.card_expiry_month).padStart(2, '0') + '/' + String(m.card_expiry_year).slice(-2) : F.esc(m.upi_vpa_masked || '')) + '</div></div>').join('') + '</div>' +
          '<p class="muted small">We keep only a gateway token, the card network and last 4 digits. Your CVV is never stored.</p>'
          : '<div class="card empty">No saved cards. Tick "Save this card" when you pay by card.</div>';
      }
    } catch (e) { box.innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; }
  }

  function rateDialog(orderId, name) {
    const WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Loved it'];
    const TAGS = ['Tasty', 'Hot & fresh', 'Good portion', 'Well packed', 'On time', 'Polite rider'];
    const R = { food: 0, del: 0, tags: new Set() };
    const d = F.dialog('<div class="photo" style="height:150px"><img src="' + F.restImg(name) + '" alt=""></div><div style="padding:24px" class="col" id="rb">' +
      '<h2 style="font-size:22px">How was ' + F.esc(name) + '?</h2>' +
      '<div><b>Food</b><div class="row"><div class="stars" data-k="food">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" data-n="' + n + '" aria-label="' + n + ' star">★</button>').join('') + '</div><span class="muted bold" id="wfood"></span></div></div>' +
      '<div><b>Delivery</b><div class="row"><div class="stars" data-k="del">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" data-n="' + n + '" aria-label="' + n + ' star">★</button>').join('') + '</div><span class="muted bold" id="wdel"></span></div></div>' +
      '<div class="row wrapf" style="gap:8px">' + TAGS.map((t) => '<button type="button" class="pill g" data-tag="' + t + '">' + t + '</button>').join('') + '</div>' +
      '<textarea class="inp" id="rc" maxlength="400" placeholder="Anything else? (optional)"></textarea><div id="rmsg"></div>' +
      '<button class="btn btn-dark lg block" id="rs" disabled>Submit rating</button></div>');
    d.querySelectorAll('.stars').forEach((st) => st.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const k = st.dataset.k, n = +b.dataset.n; R[k] = n;
      st.querySelectorAll('button').forEach((x) => x.classList.toggle('on', +x.dataset.n <= n));
      d.querySelector('#w' + k).textContent = WORDS[n];
      d.querySelector('#rs').disabled = !R.food;
    }));
    d.querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => { const t = b.dataset.tag; R.tags.has(t) ? R.tags.delete(t) : R.tags.add(t); b.classList.toggle('on'); });
    d.querySelector('#rs').onclick = async (e) => {
      F.busy(e.currentTarget, true);
      const comment = [[...R.tags].join(', '), d.querySelector('#rc').value.trim()].filter(Boolean).join('. ') || null;
      try {
        await api('POST', '/orders/' + orderId + '/rate', { food_rating: R.food, delivery_rating: R.del || null, comment });
        d.querySelector('#rb').innerHTML = '<div class="tickc"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#13A04F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2 style="text-align:center">Thanks for rating!</h2><button class="btn btn-dark block" onclick="F.closeDialog()">Done</button>';
      } catch (err) { F.busy(e.currentTarget, false); d.querySelector('#rmsg').innerHTML = '<div class="note err">' + F.esc(err.message) + '</div>'; }
    };
  }

  // ---------------- start ----------------
  (async () => {
    try {
      if (!(await loadAddresses())) {
        view.innerHTML = '<div class="card empty up" style="max-width:520px;margin:40px auto"><h2 style="color:var(--ink)">Add a delivery address</h2><p>We show restaurants that deliver to it.</p><button class="btn btn-dark" id="first">Add address</button></div>';
        F.$('#first').onclick = addAddressDialog; return;
      }
      await loadCart();
    } catch (e) { view.innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; return; }
    F.route({ home, 'r/:id': menu, checkout, 'track/:id': track, orders }, 'home');
  })();
})();
