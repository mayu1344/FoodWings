/* Rider HUD: online switch, offers, pickup, drop, earnings, KYC status.
   Hash routes: #/home  #/earnings  #/profile */
(function () {
  const ME = F.guard('rider');
  const api = F.api('rider');
  const view = F.$('#view');
  F.$('#logo').innerHTML = F.logoSvg('#fff');
  const S = { me: null, offers: [], trip: null, tripOrder: null, page: 'home' };
  const DEFAULT_LOC = { latitude: 12.9260, longitude: 77.5830 }; // Jayanagar

  function setNav(n) { S.page = n; F.$$('#bnav a').forEach((a) => a.classList.toggle('on', a.dataset.n === n)); }
  function drawTop() {
    const me = S.me, sw = F.$('#online');
    sw.classList.toggle('on', !!(me && me.is_online)); sw.setAttribute('aria-pressed', !!(me && me.is_online));
    sw.disabled = !me || me.kyc_status !== 'VERIFIED' || !!me.current_order;
    F.$('#sub').textContent = !me ? '' : me.kyc_status !== 'VERIFIED' ? (me.kyc_status === 'REJECTED' ? 'KYC rejected' : 'Waiting for KYC check') : me.current_order ? 'On a trip' : me.is_online ? 'Online · looking for orders' : 'Offline';
  }
  F.$('#online').onclick = async () => {
    const want = !S.me.is_online, b = F.$('#online');
    b.disabled = true;
    try {
      if (want) await sendLocation();
      await api('POST', '/partner/status', { is_online: want });
      S.me.is_online = want; F.toast(want ? 'You are online' : 'You are offline');
      await refresh(true);
    } catch (e) { F.toast(e.message, true); }
    drawTop();
  };
  function sendLocation(lat, lng) {
    const post = (p) => api('POST', '/partner/location', p).catch(() => null);
    if (lat != null) return post({ latitude: +Number(lat).toFixed(6), longitude: +Number(lng).toFixed(6) });
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(post(DEFAULT_LOC));
      let done = false;
      const fallback = setTimeout(() => { if (!done) { done = true; resolve(post(DEFAULT_LOC)); } }, 3000);
      navigator.geolocation.getCurrentPosition((p) => {
        if (done) return; done = true; clearTimeout(fallback);
        // outside Bengaluru? use the demo location so nearby orders still match
        const inCity = Math.abs(p.coords.latitude - 12.95) < 0.4 && Math.abs(p.coords.longitude - 77.6) < 0.4;
        resolve(post(inCity ? { latitude: +p.coords.latitude.toFixed(6), longitude: +p.coords.longitude.toFixed(6) } : DEFAULT_LOC));
      }, () => { if (!done) { done = true; clearTimeout(fallback); resolve(post(DEFAULT_LOC)); } }, { timeout: 2500 });
    });
  }

  // ---------------- data ----------------
  async function refresh(redraw) {
    let me;
    try { me = await api('GET', '/partner/me'); }
    catch (e) {
      F.poll(null); drawTop();
      view.innerHTML = '<div class="card empty up"><h2 style="color:var(--ink)">Finish your rider sign-up</h2><p>' + F.esc(e.message) + '</p><a class="btn btn-dark" href="login.html?app=rider&stay=1">Add vehicle details</a></div>';
      return;
    }
    const tripChanged = JSON.stringify(me.current_order) !== JSON.stringify(S.me && S.me.current_order);
    S.me = me; drawTop();
    if (me.kyc_status === 'VERIFIED' && me.is_online && !me.current_order) {
      const offers = await api('GET', '/partner/offers').catch(() => []);
      const changed = offers.map((o) => o.assignment_id).join() !== S.offers.map((o) => o.assignment_id).join();
      if (changed && offers.length > S.offers.length) { F.toast('New delivery request!'); }
      S.offers = offers;
      if (changed) redraw = true;
    } else S.offers = [];
    if (me.current_order && (tripChanged || !S.tripOrder)) {
      S.tripOrder = await api('GET', '/orders/' + me.current_order.order_id).catch(() => null);
      redraw = true;
    }
    if (!me.current_order) S.tripOrder = null;
    if (tripChanged) redraw = true;
    if (redraw && S.page === 'home') home();
  }

  // ---------------- home ----------------
  function home() {
    setNav('home');
    const me = S.me;
    if (!me) { view.innerHTML = '<div class="skeleton" style="height:300px"></div>'; return; }
    if (me.kyc_status !== 'VERIFIED') return pending();
    if (me.current_order) return trip();
    const on = me.is_online;
    let h = '<div class="map rmap up' + (on ? '' : ' off') + '"><div class="park" style="left:8%;top:10%;width:30%;height:26%"></div><div class="water" style="left:55%;top:62%;width:36%;height:18%"></div>' +
      (on && !S.offers.length ? '<div class="radar"></div><div class="radar b"></div><div class="radar c"></div>' : '') + '<div class="me"></div>' +
      '<div class="tag" style="left:12px;top:12px">' + (on ? (S.offers.length ? 'Request waiting' : 'Searching nearby…') : 'You are offline') + '</div></div>';
    if (!on) {
      h += '<div class="card up col" style="padding:20px;text-align:center"><h2 style="font-size:22px;font-weight:800">Ready to ride?</h2><span class="muted">Go online to get delivery requests near you.</span><button class="btn btn-green lg" id="goOn">Go online</button></div>';
    } else if (!S.offers.length) {
      h += '<div class="card up" style="padding:18px"><b>Looking for orders</b><p class="muted" style="margin:6px 0 0">Requests from restaurants near you show up here. Keep this screen open.</p></div>';
    } else {
      h += S.offers.map((o, i) => {
        const left = Math.max(0, 60 - Math.floor((Date.now() - new Date(o.offered_at).getTime()) / 1000));
        return '<div class="card sheet" style="animation-delay:' + i * 0.08 + 's"><div class="row"><div class="ring" data-ring="' + o.assignment_id + '" data-at="' + o.offered_at + '"><svg width="64" height="64"><circle cx="32" cy="32" r="28" stroke="#E4E8E5" stroke-width="6" fill="none"/><circle cx="32" cy="32" r="28" stroke="#13A04F" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="' + (176 * (1 - left / 60)) + '"/></svg><b>' + left + '</b></div>' +
          '<div class="grow col" style="gap:2px"><span class="chip" style="align-self:flex-start">New request · #' + o.order_id + '</span><b style="font-size:22px">Earn ₹35</b><span class="muted small">' + (o.payment_mode === 'COD' ? 'Collect cash ' + F.money(o.total_amount) : 'Prepaid · ' + F.money(o.total_amount)) + '</span></div></div>' +
          '<div class="col" style="gap:10px;margin:14px 0"><div class="trow"><span class="ic" style="background:var(--green-tint);color:var(--green-text)">P</span><div><b>' + F.esc(o.restaurant_name) + '</b><div class="muted small">' + F.esc(o.pickup_address) + '</div></div></div>' +
          '<div class="trow"><span class="ic" style="background:var(--ink);color:#fff">D</span><div><b>Customer</b><div class="muted small">' + F.esc(o.drop_address) + '</div></div></div></div>' +
          '<div class="row"><button class="btn btn-ghost lg grow" data-rej="' + o.assignment_id + '">Reject</button><button class="btn btn-green lg grow" data-acc="' + o.assignment_id + '">Accept</button></div></div>';
      }).join('');
    }
    view.innerHTML = h;
    const g = F.$('#goOn'); if (g) g.onclick = () => F.$('#online').click();
    F.$$('[data-acc]').forEach((b) => b.onclick = async () => { F.busy(b, true); try { await api('POST', '/partner/offers/' + b.dataset.acc + '/accept'); F.toast('Accepted · head to the restaurant'); S.offers = []; await refresh(true); } catch (e) { F.busy(b, false); F.toast(e.message, true); refresh(true); } });
    F.$$('[data-rej]').forEach((b) => b.onclick = async () => { F.busy(b, true); try { await api('POST', '/partner/offers/' + b.dataset.rej + '/reject'); F.toast('Request passed to another rider'); await refresh(true); } catch (e) { F.toast(e.message, true); refresh(true); } });
  }
  setInterval(() => F.$$('[data-ring]').forEach((r) => {
    const left = Math.max(0, 60 - Math.floor((Date.now() - new Date(r.dataset.at).getTime()) / 1000));
    r.querySelector('b').textContent = left || '!'; r.querySelectorAll('circle')[1].setAttribute('stroke-dashoffset', 176 * (1 - left / 60));
    if (!left) r.querySelectorAll('circle')[1].setAttribute('stroke', '#E09F00');
  }), 1000);

  // ---------------- trip ----------------
  function trip() {
    const c = S.me.current_order, o = S.tripOrder || {}, st = c.status, picked = st === 'PICKED_UP';
    const ready = st === 'READY';
    let h = '<div class="map rmap up" style="height:230px"><div class="park" style="left:6%;top:56%;width:26%;height:30%"></div>' +
      '<div class="seg' + (picked ? ' gone' : '') + '" style="left:20%;top:30%;width:30%;height:8px"><i></i></div><div class="seg' + (picked ? '' : ' todo') + '" style="left:50%;top:30%;width:30%;height:8px"><i></i></div>' +
      '<div class="pin" style="left:20%;top:31%">' + '<img src="' + F.restImg(c.restaurant) + '" alt=""></div><div class="ping" style="left:80%;top:31%"></div><div class="pin" style="left:80%;top:31%;background:var(--green)">⌂</div>' +
      '<div class="pin rider" style="left:' + (picked ? 62 : 20) + '%;top:31%">🛵</div><div class="tag" style="left:12px;top:12px">' + (picked ? 'Going to customer' : 'Going to restaurant') + '</div></div>';
    h += '<div class="card up" style="padding:18px"><div class="row between"><span class="chip">Order #' + c.order_id + '</span>' + F.badge(st) + '</div>' +
      '<div class="col" style="gap:12px;margin-top:14px"><div class="trow' + (picked ? '" style="opacity:.5' : '') + '"><span class="ic" style="background:var(--green-tint);color:var(--green-text)">' + (picked ? '✓' : 'P') + '</span><div class="grow"><b>' + F.esc(c.restaurant) + '</b><div class="muted small">' + F.esc(c.pickup) + '</div></div><a class="btn btn-ghost sm" target="_blank" rel="noopener" href="https://maps.google.com/?q=' + c.pickup_lat + ',' + c.pickup_lng + '">Map</a></div>' +
      '<div class="trow"><span class="ic" style="background:var(--ink);color:#fff">D</span><div class="grow"><b>' + F.esc(c.customer) + '</b><div class="muted small">' + F.esc(c.drop_address) + (c.drop_landmark ? ' · ' + F.esc(c.drop_landmark) : '') + '</div></div><a class="btn btn-ghost sm" target="_blank" rel="noopener" href="https://maps.google.com/?q=' + c.drop_lat + ',' + c.drop_lng + '">Map</a></div></div></div>';
    if (o.items) h += '<div class="card up" style="padding:18px;animation-delay:.06s"><b>Items to collect</b>' + o.items.map((i) => '<div class="row" style="gap:10px;margin-top:10px">' + F.photo(F.dishImg(i.item_name), '', 'thumb') + '<span class="grow">' + i.quantity + ' × ' + F.esc(i.item_name) + '</span></div>').join('') + (o.special_instructions ? '<div class="note warn small" style="margin-top:10px">' + F.esc(o.special_instructions) + '</div>' : '') + '</div>';
    if (!picked) {
      h += ready ? '<div class="note ok">Food is ready. Collect it and slide to confirm.</div>' : '<div class="note warn">The kitchen is still preparing. The slider unlocks when the order is ready.</div>';
      h += '<div class="slide' + (ready ? '' : ' dis') + '" id="sl"><span class="lbl">' + (ready ? 'Slide to confirm pickup' : 'Waiting for the kitchen…') + '</span><span class="knob">→</span><input type="range" min="0" max="100" value="0" aria-label="Slide to confirm pickup"' + (ready ? '' : ' disabled') + '></div>';
    } else {
      if (c.payment_mode === 'COD') h += '<div class="card up col" style="padding:18px;gap:10px"><b>Collect cash: ' + F.money(c.total_amount) + '</b><label class="field"><span>Amount received</span><input class="inp" id="cash" inputmode="decimal" placeholder="' + Number(c.total_amount) + '"></label><span class="small muted" id="cashMsg">Enter the exact amount to continue.</span></div>';
      else h += '<div class="note ok">Prepaid order. Just hand it over.</div>';
      h += '<button class="btn btn-green lg block" id="deliver"' + (c.payment_mode === 'COD' ? ' disabled' : '') + '>Mark as delivered</button>';
    }
    view.innerHTML = h;
    const sl = F.$('#sl input');
    if (sl) {
      const knob = F.$('#sl .knob');
      sl.oninput = () => { knob.style.transition = 'none'; knob.style.left = 'calc(' + sl.value + '% - ' + (sl.value * 0.57) + 'px + 5px)'; };
      sl.onchange = async () => {
        knob.style.transition = '';
        if (+sl.value < 90) { sl.value = 0; knob.style.left = '5px'; return; }
        sl.disabled = true; F.$('#sl .lbl').textContent = 'Confirming…';
        try { await api('POST', '/partner/orders/' + c.order_id + '/pickup'); sendLocation(c.pickup_lat, c.pickup_lng); F.toast('Picked up · drive safe'); await refresh(true); }
        catch (e) { F.toast(e.message, true); sl.disabled = false; sl.value = 0; knob.style.left = '5px'; F.$('#sl .lbl').textContent = 'Slide to confirm pickup'; }
      };
    }
    const cash = F.$('#cash');
    if (cash) cash.oninput = () => {
      const ok = Math.abs(Number(cash.value) - Number(c.total_amount)) < 0.01;
      F.$('#deliver').disabled = !ok; cash.classList.toggle('bad', !!cash.value && !ok);
      F.$('#cashMsg').textContent = ok ? '✓ Amount matches' : 'Enter exactly ' + F.money(c.total_amount);
    };
    const dv = F.$('#deliver');
    if (dv) dv.onclick = async () => {
      if (cash && Math.abs(Number(cash.value) - Number(c.total_amount)) >= 0.01) { F.shake(cash); return; }
      F.busy(dv, true, 'Completing…');
      try {
        await api('POST', '/partner/orders/' + c.order_id + '/deliver', { cash_collected: c.payment_mode === 'COD' });
        sendLocation(c.drop_lat, c.drop_lng);
        const d = document.createElement('div'); d.className = 'done';
        d.innerHTML = '<div class="tickc" style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;animation:pop .4s both"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" style="stroke-dasharray:40;stroke-dashoffset:40;animation:draw .5s .2s forwards"/></svg></div><h1 style="font-size:30px;font-weight:800">Delivered!</h1><div class="amt">+₹35</div><span>Added to today\'s earnings</span><button class="btn btn-dark lg">Back to trips</button>';
        document.body.appendChild(d);
        d.querySelector('button').onclick = () => d.remove();
        S.tripOrder = null; await refresh(true);
      } catch (e) { F.busy(dv, false); F.toast(e.message, true); }
    };
  }

  // ---------------- pending KYC ----------------
  function pending() {
    const st = S.me.kyc_status, rej = st === 'REJECTED';
    view.innerHTML = '<div class="card up col" style="padding:22px;gap:12px;background:' + (rej ? 'var(--err-bg)' : '#FFF8E6') + ';box-shadow:none;border:1.5px solid ' + (rej ? '#E8B4AE' : '#F3D48A') + '">' +
      '<span class="bold small" style="letter-spacing:.1em;color:' + (rej ? 'var(--err)' : 'var(--warn)') + '">KYC: ' + F.esc(st.replace('_', ' ')) + '</span><h1 style="font-size:26px;font-weight:800">' + (rej ? 'Your KYC was not approved' : 'We are checking your documents') + '</h1>' +
      '<span>' + (rej ? 'Please contact Foodu support to fix your documents.' : 'An admin verifies your licence and vehicle papers. You can go online once you are verified.') + '</span></div>' +
      '<div class="card up col" style="padding:20px;gap:12px;animation-delay:.06s"><b>Your application</b>' +
      [['Account created', 1], ['Vehicle details sent · ' + S.me.vehicle_type, 1], ['KYC check by Foodu team', rej ? 3 : 2], ['Go online and earn', 0]].map((s, i) =>
        '<div class="trow" style="align-items:center' + (s[1] ? '' : ';color:#7B847F') + '"><span class="ic" style="width:28px;height:28px;font-size:13px;background:' + (s[1] === 1 ? 'var(--green);color:#fff' : s[1] === 2 ? 'var(--amber);color:#fff;animation:glow 1.6s infinite' : s[1] === 3 ? 'var(--nonveg);color:#fff' : '#E4E8E5') + '">' + (s[1] === 1 ? '✓' : s[1] === 3 ? '✕' : i + 1) + '</span>' + s[0] + '</div>').join('') +
      '<span class="small muted">Bring your driving licence, RC and Aadhaar to the Foodu hub for verification (no upload API yet).</span><button class="btn btn-ghost" id="rl">Check status again</button></div>';
    F.$('#rl').onclick = () => refresh(true).then(() => F.toast('Status: ' + S.me.kyc_status.replace('_', ' ')));
  }

  // ---------------- earnings ----------------
  async function earnings() {
    setNav('earnings');
    view.innerHTML = '<div class="skeleton" style="height:160px"></div>';
    let e;
    try { e = await api('GET', '/partner/earnings'); } catch (err) { view.innerHTML = '<div class="card empty">' + F.esc(err.message) + '</div>'; return; }
    const today = e.deliveries.filter((d) => new Date(d.created_at).toDateString() === new Date().toDateString());
    const sum = (l) => l.reduce((a, d) => a + Number(d.base_pay) + Number(d.distance_pay) + Number(d.tip || 0), 0);
    view.innerHTML = '<div class="card up" style="padding:22px;background:var(--ink);color:#fff"><small style="letter-spacing:.1em;color:var(--green-soft);font-weight:700">TOTAL EARNINGS</small><div style="font-size:42px;font-weight:800" id="et">₹0</div><span style="color:#C9D1CC">' + e.deliveries.length + ' deliveries · today ' + F.money(sum(today)) + ' from ' + today.length + '</span></div>' +
      '<h2 style="font-size:20px;font-weight:800;margin-top:6px">Trips</h2>' +
      (e.deliveries.length ? e.deliveries.map((d, i) => {
        const t = Number(d.base_pay) + Number(d.distance_pay) + Number(d.tip || 0);
        return '<button type="button" class="card up" data-trip style="padding:16px;border:0;text-align:left;animation-delay:' + i * 0.04 + 's;width:100%"><div class="row between"><b>Order #' + d.order_id + '</b><b style="color:var(--green-text)">+' + F.money(t) + '</b></div><span class="muted small">' + F.when(d.created_at) + '</span>' +
          '<div class="ebar hide"><i style="width:' + (d.base_pay / t * 100) + '%;background:var(--green)"></i><i style="width:' + (d.distance_pay / t * 100) + '%;background:var(--ink)"></i><i style="width:' + ((d.tip || 0) / t * 100) + '%;background:var(--amber)"></i></div>' +
          '<div class="small muted hide" style="margin-top:6px">Base ' + F.money(d.base_pay) + ' · Distance ' + F.money(d.distance_pay) + ' · Tip ' + F.money(d.tip || 0) + '</div></button>';
      }).join('') : '<div class="card empty">No trips yet. Go online to start earning.</div>');
    F.countUp(F.$('#et'), e.total);
    F.$$('[data-trip]').forEach((b) => b.onclick = () => b.querySelectorAll('.hide, .shown').forEach((x) => { x.classList.toggle('hide'); x.classList.toggle('shown'); }));
  }

  // ---------------- profile ----------------
  function profile() {
    setNav('profile');
    const me = S.me || {};
    view.innerHTML = '<div class="card up col" style="padding:22px;align-items:center;text-align:center;gap:8px"><span class="avatar" style="width:72px;height:72px;font-size:26px">' + F.initials(ME.name) + '</span><h2 style="font-size:24px;font-weight:800">' + F.esc(ME.name) + '</h2>' +
      '<span class="rating">★ ' + Number(me.rating || 0).toFixed(1) + '</span></div>' +
      '<div class="card up col" style="padding:20px;gap:10px;animation-delay:.06s">' + [['Vehicle', me.vehicle_type], ['KYC', (me.kyc_status || '').replace('_', ' ')], ['Status', me.is_online ? 'Online' : 'Offline'], ['Last location', me.location ? Number(me.location.latitude).toFixed(4) + ', ' + Number(me.location.longitude).toFixed(4) : 'Not shared yet']]
        .map((x) => '<div class="row between"><span class="muted">' + x[0] + '</span><b>' + F.esc(x[1] || '-') + '</b></div>').join('') + '</div>' +
      '<button class="btn btn-ghost lg" id="loc">Share my location now</button><button class="btn btn-red lg" id="out">Sign out</button>';
    F.$('#loc').onclick = async (e) => { F.busy(e.currentTarget, true); await sendLocation(); F.busy(e.currentTarget, false); F.toast('Location shared'); refresh(); };
    F.$('#out').onclick = () => F.logout('rider');
  }

  F.route({ home: () => { setNav('home'); home(); }, earnings, profile }, 'home');
  refresh(true);
  setInterval(() => { if (S.page === 'home') refresh(false); }, 4000);
})();
