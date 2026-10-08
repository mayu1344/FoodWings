/* Sign in + register for all four apps.
   Flow: phone -> OTP -> /auth/login or /auth/register -> (details step: address / restaurant / rider) -> open the app */
(function () {
  F.$('#logo').innerHTML = F.logoSvg('#fff');
  const api = F.api(null);

  const APPS = {
    customer: { label: 'Customer', sub: 'Order food', page: 'customer.html', img: 'north-indian', title: 'Hungry? Your favourite food is a few taps away.', text: 'Order from kitchens near you and track the rider live.' },
    restaurant: { label: 'Restaurant', sub: 'Kitchen Portal', page: 'restaurant.html', img: 'restaurant-1', title: 'Grow your kitchen with Foodu.', text: 'Take orders, manage stock and see payouts in one place.' },
    rider: { label: 'Rider', sub: 'Rider HUD', page: 'rider.html', img: 'dineout', title: 'Ride when you want. Earn on every trip.', text: 'Go online, accept nearby orders and get paid per delivery.' },
    admin: { label: 'Admin', sub: 'Approvals', page: 'admin.html', img: 'grocery-shelf', title: 'Keep the platform safe.', text: 'Check new restaurants and riders before they go live.' }
  };
  const AREAS = [
    { name: 'Jayanagar', lat: 12.9293, lng: 77.5821 }, { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Basavanagudi', lat: 12.9421, lng: 77.5753 }, { name: 'JP Nagar', lat: 12.9108, lng: 77.5859 }
  ];
  const CUISINES = ['North Indian', 'South Indian', 'Biryani', 'Chinese', 'Pizza', 'Desserts', 'Beverages', 'Fast Food'];
  const VEHICLES = [['BIKE', 'Bike'], ['SCOOTER', 'Scooter'], ['EV', 'Electric'], ['CYCLE', 'Cycle']];

  const S = {
    app: APPS[F.param('app')] ? F.param('app') : 'customer',
    mode: F.param('mode') === 'register' ? 'register' : 'signin',
    step: 'phone', phone: '', name: '', email: '', otp: '', devOtp: '', resend: 0, tries: 5,
    session: null, nextStep: null,
    d: { label: 'Home', area: 0, line: '', landmark: '', rname: '', cuisines: [], fssai: '', gst: '', vehicle: 'BIKE', vno: '', lic: '' }
  };
  if (S.app === 'admin') S.mode = 'signin';
  let timer = null;

  const pic = F.$('#pic'), form = F.$('#form');

  function drawPic() {
    const a = APPS[S.app];
    pic.innerHTML = '<img src="' + F.img(a.img) + '" alt="">' +
      '<span class="chip fade" style="align-self:flex-start;background:rgba(255,255,255,.18);color:#fff;margin-bottom:12px">' + a.sub + '</span>' +
      '<h2 class="fade">' + a.title + '</h2><p class="fade" style="font-size:17px;color:#DDF3E5;margin:10px 0 0">' + a.text + '</p>';
  }

  function appPicker() {
    return '<div class="apps" role="radiogroup" aria-label="Choose app">' + Object.keys(APPS).map((k) =>
      '<button type="button" role="radio" aria-checked="' + (S.app === k) + '" data-app="' + k + '" class="' + (S.app === k ? 'on' : '') + '">' + APPS[k].label + '<small>' + APPS[k].sub + '</small></button>').join('') + '</div>';
  }
  function modeTabs() {
    if (S.app === 'admin') return '';
    return '<div class="mode"><button type="button" data-mode="signin" class="' + (S.mode === 'signin' ? 'on' : '') + '">Sign in</button><button type="button" data-mode="register" class="' + (S.mode === 'register' ? 'on' : '') + '">Create account</button></div>';
  }

  function render() {
    drawPic();
    let h = '';
    if (S.step === 'phone' || S.step === 'otp') {
      h += appPicker() + modeTabs();
      h += '<div class="fade col" style="gap:14px">';
      h += '<h1 style="font-size:30px;font-weight:800">' + (S.mode === 'signin' ? 'Welcome back' : 'Create your ' + APPS[S.app].label.toLowerCase() + ' account') + '</h1>';
      if (S.mode === 'register') {
        h += '<label class="field"><span>Your name</span><input class="inp" id="name" value="' + F.esc(S.name) + '" autocomplete="name" placeholder="Full name"></label>' +
             '<label class="field"><span>Email (optional)</span><input class="inp" id="email" type="email" value="' + F.esc(S.email) + '" autocomplete="email" placeholder="you@example.com"></label>';
      }
      h += '<label class="field"><span>Mobile number</span><div class="row"><span class="inp" style="width:auto;display:flex;align-items:center;background:#F4F7F5">+91</span>' +
           '<input class="inp grow" id="phone" inputmode="numeric" maxlength="10" value="' + F.esc(S.phone) + '" placeholder="10 digit number" autocomplete="tel-national"' + (S.step === 'otp' ? ' disabled' : '') + '></div></label>';
      if (S.step === 'phone') {
        h += '<button class="btn btn-dark lg" id="send" type="button">Send OTP</button>';
      } else {
        h += '<div class="field"><span>Enter the 6-digit OTP sent to +91 ' + F.esc(S.phone) + ' · <a href="#" id="chg">Change</a></span>' +
             '<div class="otp" id="otp"><input id="otpin" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="OTP">' + '<span></span>'.repeat(6) + '</div></div>';
        if (S.devOtp) h += '<div class="note ok">Dev mode OTP: <b>' + S.devOtp + '</b> · <a href="#" id="fill">fill it</a></div>';
        h += '<div id="msg"></div>';
        h += '<div class="row wrapf"><button class="btn btn-dark lg grow" id="verify" type="button">' + (S.mode === 'signin' ? 'Sign in' : 'Create account') + '</button>' +
             '<button class="btn btn-ghost lg" id="resend" type="button"></button></div>';
      }
      h += '</div>';
    } else if (S.step === 'details') {
      h += detailsForm();
    } else if (S.step === 'done') {
      h += '<div class="col fade" style="align-items:center;text-align:center;margin:auto;gap:16px">' +
           '<div class="tick"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#13A04F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
           '<h1 style="font-size:30px;font-weight:800">' + F.esc(S.doneTitle || 'You are in!') + '</h1><p class="muted" style="margin:0;font-size:17px">' + F.esc(S.doneText || '') + '</p>' +
           '<a class="btn btn-dark lg" href="' + APPS[S.app].page + '">Open ' + APPS[S.app].sub + '</a></div>';
    }
    form.innerHTML = h;
    bind();
  }

  function detailsForm() {
    const d = S.d;
    const areaPills = '<div class="pills">' + AREAS.map((a, i) => '<button type="button" class="pill g ' + (d.area === i ? 'on' : '') + '" data-area="' + i + '">' + a.name + '</button>').join('') + '</div>';
    let h = '<div class="col fade" style="gap:14px"><span class="chip" style="align-self:flex-start">Step 2 of 2</span>';
    if (S.app === 'customer') {
      h += '<h1 style="font-size:28px;font-weight:800">Where should we deliver?</h1>' +
        '<div class="pills">' + ['Home', 'Work', 'Other'].map((l) => '<button type="button" class="pill ' + (d.label === l ? 'on' : '') + '" data-label="' + l + '">' + l + '</button>').join('') + '</div>' +
        '<div class="field"><span>Area (Bengaluru)</span>' + areaPills + '</div>' +
        '<label class="field"><span>House / flat, street</span><input class="inp" id="line" value="' + F.esc(d.line) + '" placeholder="221, 9th Cross"></label>' +
        '<label class="field"><span>Landmark (optional)</span><input class="inp" id="landmark" value="' + F.esc(d.landmark) + '" placeholder="Near the park"></label>' +
        '<div id="msg"></div><button class="btn btn-dark lg" id="save" type="button">Save address and start ordering</button>';
    } else if (S.app === 'restaurant') {
      h += '<h1 style="font-size:28px;font-weight:800">Tell us about your restaurant</h1>' +
        '<label class="field"><span>Restaurant name</span><input class="inp" id="rname" value="' + F.esc(d.rname) + '" placeholder="e.g. Nandini Tiffin Centre"></label>' +
        '<div class="field"><span>Cuisines</span><div class="pills">' + CUISINES.map((c) => '<button type="button" class="pill g ' + (d.cuisines.includes(c) ? 'on' : '') + '" data-cuisine="' + c + '">' + c + '</button>').join('') + '</div></div>' +
        '<div class="field"><span>Area (Bengaluru)</span>' + areaPills + '</div>' +
        '<label class="field"><span>Street address</span><input class="inp" id="line" value="' + F.esc(d.line) + '" placeholder="3rd Cross, JP Nagar 2nd Phase"></label>' +
        '<div class="grid2"><label class="field"><span>FSSAI licence no.</span><input class="inp" id="fssai" inputmode="numeric" maxlength="14" value="' + F.esc(d.fssai) + '" placeholder="14 digits"><small id="fsmsg" class="small muted">14 digits on your food licence</small></label>' +
        '<label class="field"><span>GST no. (optional)</span><input class="inp" id="gst" maxlength="15" value="' + F.esc(d.gst) + '" placeholder="29ABCDE1234F1Z5"></label></div>' +
        '<div id="msg"></div><button class="btn btn-dark lg" id="save" type="button">Send for approval</button>';
    } else {
      const cyc = d.vehicle === 'CYCLE';
      h += '<h1 style="font-size:28px;font-weight:800">Your vehicle details</h1>' +
        '<div class="field"><span>Vehicle</span><div class="pills">' + VEHICLES.map((v) => '<button type="button" class="pill g ' + (d.vehicle === v[0] ? 'on' : '') + '" data-vehicle="' + v[0] + '">' + v[1] + '</button>').join('') + '</div></div>' +
        '<div class="grid2' + (cyc ? ' hide' : '') + '" id="vbox"><label class="field"><span>Vehicle number</span><input class="inp" id="vno" value="' + F.esc(d.vno) + '" placeholder="KA05AB1234"></label>' +
        '<label class="field"><span>Driving licence no.</span><input class="inp" id="lic" value="' + F.esc(d.lic) + '" placeholder="KA0520190001234"></label></div>' +
        (cyc ? '<div class="note ok">No licence needed for a cycle.</div>' : '') +
        '<div class="note warn">After you submit, our team checks your documents (KYC). You can go online once you are verified.</div>' +
        '<div id="msg"></div><button class="btn btn-dark lg" id="save" type="button">Submit for verification</button>';
    }
    return h + '</div>';
  }

  function msg(text, kind) { const m = F.$('#msg'); if (m) m.innerHTML = text ? '<div class="note ' + (kind || 'err') + ' fade">' + F.esc(text) + '</div>' : ''; }

  function drawOtp() {
    const box = F.$('#otp'); if (!box) return;
    F.$$('span', box).forEach((s, i) => { s.textContent = S.otp[i] || ''; s.classList.toggle('cur', i === Math.min(S.otp.length, 5) && document.activeElement === F.$('#otpin')); });
    const v = F.$('#verify'); if (v) v.disabled = S.otp.length !== 6;
  }
  function drawResend() {
    const r = F.$('#resend'); if (!r) return;
    r.disabled = S.resend > 0;
    r.textContent = S.resend > 0 ? 'Resend in ' + S.resend + 's' : 'Resend OTP';
  }

  async function sendOtp(btn) {
    if (!/^[6-9][0-9]{9}$/.test(S.phone)) { F.shake(F.$('#phone')); F.toast('Enter a valid 10 digit mobile number', true); return; }
    if (S.mode === 'register' && S.name.trim().length < 2) { F.shake(F.$('#name')); F.toast('Please enter your name', true); return; }
    F.busy(btn, true, 'Sending…');
    try {
      const r = await api('POST', '/auth/otp/request', { phone: S.phone, app: S.app, purpose: S.mode === 'signin' ? 'LOGIN' : 'REGISTER' });
      S.devOtp = r.dev_otp || ''; S.otp = ''; S.tries = 5; S.step = 'otp'; S.resend = 30;
      clearInterval(timer);
      timer = setInterval(() => { S.resend = Math.max(0, S.resend - 1); drawResend(); if (!S.resend) clearInterval(timer); }, 1000);
      render();
      F.$('#otpin').focus();
      F.toast('OTP sent');
    } catch (e) { F.busy(btn, false); F.toast(e.message, true); }
  }

  async function verify(btn) {
    F.busy(btn, true, S.mode === 'signin' ? 'Signing in…' : 'Creating…');
    msg('');
    try {
      let r;
      if (S.mode === 'signin') r = await api('POST', '/auth/login', { phone: S.phone, otp: S.otp, app: S.app });
      else r = await api('POST', '/auth/register', { phone: S.phone, otp: S.otp, app: S.app, name: S.name.trim(), email: S.email.trim() || null });
      S.session = { token: r.token, user_id: r.user_id, name: r.name, roles: r.roles, app: S.app };
      F.saveSession(S.app, S.session);
      afterAuth(r.next_step);
    } catch (e) {
      F.busy(btn, false);
      if (e.code === 'USER_NOT_FOUND') {
        S.mode = 'register'; S.step = 'phone'; render(); msg('No account for this number yet. Add your name and create one.', 'warn'); return;
      }
      if (e.code === 'ROLE_MISSING' && S.app !== 'admin') {
        S.mode = 'register'; S.step = 'phone'; render(); msg('This number is not registered for the ' + APPS[S.app].label + ' app yet. Create it here (same number is fine).', 'warn'); return;
      }
      if (e.status === 409 && /Already registered/i.test(e.message)) { S.mode = 'signin'; S.step = 'phone'; render(); msg(e.message, 'warn'); return; }
      if (/Wrong OTP/i.test(e.message)) {
        S.tries -= 1; S.otp = ''; F.$('#otpin').value = ''; drawOtp(); F.shake(F.$('#otp'));
        msg('Wrong OTP. ' + Math.max(0, S.tries) + ' tries left.'); return;
      }
      if (/expired|No OTP/i.test(e.message)) { msg(e.message + ' Tap "Resend OTP".'); return; }
      msg(e.message);
    }
  }

  function afterAuth(next) {
    S.nextStep = next;
    if (next === 'ADD_ADDRESS' || next === 'RESTAURANT_DETAILS' || next === 'RIDER_DETAILS') { S.step = 'details'; render(); return; }
    if (next === 'REJECTED') { S.step = 'done'; S.doneTitle = 'Your application was not approved'; S.doneText = 'Please contact Foodu support for details.'; render(); return; }
    if (next === 'WAIT_FOR_APPROVAL') { S.step = 'done'; S.doneTitle = 'Waiting for approval'; S.doneText = 'Our team is checking your details. You can look around meanwhile.'; render(); return; }
    location.href = APPS[S.app].page;
  }

  async function saveDetails(btn) {
    const d = S.d, area = AREAS[d.area], authed = F.api(S.app);
    msg('');
    try {
      if (S.app === 'customer') {
        if (d.line.trim().length < 3) { F.shake(F.$('#line')); msg('Please enter your house and street'); return; }
        F.busy(btn, true, 'Saving…');
        await authed('POST', '/me/addresses', { label: d.label, address_line: d.line.trim() + ', ' + area.name, landmark: d.landmark.trim() || null, city: 'Bengaluru', latitude: area.lat, longitude: area.lng, is_default: true });
        location.href = 'customer.html';
        return;
      }
      if (S.app === 'restaurant') {
        if (d.rname.trim().length < 2) { F.shake(F.$('#rname')); msg('Please enter the restaurant name'); return; }
        if (!/^[0-9]{14}$/.test(d.fssai)) { F.shake(F.$('#fssai')); msg('FSSAI number must be exactly 14 digits'); return; }
        if (d.line.trim().length < 3) { F.shake(F.$('#line')); msg('Please enter the street address'); return; }
        F.busy(btn, true, 'Sending…');
        const r = await authed('POST', '/restaurants/onboard', { name: d.rname.trim(), address_line: d.line.trim() + ', ' + area.name, city: 'Bengaluru', latitude: area.lat, longitude: area.lng, cuisines: d.cuisines.join(', ') || null, fssai_no: d.fssai, gst_no: d.gst.trim() || null });
        F.saveSession('restaurant', { ...S.session, token: r.token, roles: r.roles });
        S.step = 'done'; S.doneTitle = r.name + ' is under review'; S.doneText = 'We check your FSSAI licence and details. Orders start once you are approved.'; render();
        return;
      }
      const cyc = d.vehicle === 'CYCLE';
      if (!cyc && (d.vno.trim().length < 4 || d.lic.trim().length < 6)) { F.shake(F.$('#vbox')); msg('Enter your vehicle number and licence number'); return; }
      F.busy(btn, true, 'Submitting…');
      const r = await authed('POST', '/partners/onboard', { vehicle_type: d.vehicle, vehicle_no: cyc ? 'CYCLE' : d.vno.trim().toUpperCase(), licence_no: cyc ? 'NA' : d.lic.trim().toUpperCase(), city: 'Bengaluru' });
      F.saveSession('rider', { ...S.session, token: r.token, roles: r.roles });
      S.step = 'done'; S.doneTitle = 'Sent for verification'; S.doneText = 'An admin will verify your KYC. Then you can go online and take orders.'; render();
    } catch (e) { F.busy(btn, false); msg(e.message); }
  }

  function bind() {
    F.$$('[data-app]').forEach((b) => b.onclick = () => { S.app = b.dataset.app; if (S.app === 'admin') S.mode = 'signin'; S.step = 'phone'; history.replaceState(null, '', '?app=' + S.app); render(); });
    F.$$('[data-mode]').forEach((b) => b.onclick = () => { S.mode = b.dataset.mode; S.step = 'phone'; render(); });
    const ph = F.$('#phone');
    if (ph) {
      ph.oninput = () => { ph.value = ph.value.replace(/\D/g, '').slice(0, 10); S.phone = ph.value; const s = F.$('#send'); if (s) s.disabled = S.phone.length !== 10; };
      ph.onkeydown = (e) => { if (e.key === 'Enter') sendOtp(F.$('#send')); };
      const s = F.$('#send'); if (s) { s.disabled = S.phone.length !== 10; s.onclick = () => sendOtp(s); }
    }
    const nm = F.$('#name'); if (nm) nm.oninput = () => { S.name = nm.value; };
    const em = F.$('#email'); if (em) em.oninput = () => { S.email = em.value; };
    const oi = F.$('#otpin');
    if (oi) {
      oi.oninput = () => { oi.value = oi.value.replace(/\D/g, '').slice(0, 6); S.otp = oi.value; drawOtp(); if (S.otp.length === 6) verify(F.$('#verify')); };
      oi.onfocus = drawOtp; oi.onblur = drawOtp;
      F.$('#chg').onclick = (e) => { e.preventDefault(); S.step = 'phone'; render(); };
      const f = F.$('#fill'); if (f) f.onclick = (e) => { e.preventDefault(); oi.value = S.devOtp; oi.oninput(); };
      F.$('#verify').onclick = () => verify(F.$('#verify'));
      F.$('#resend').onclick = () => sendOtp(F.$('#resend'));
      drawOtp(); drawResend();
    }
    // details step
    F.$$('[data-area]').forEach((b) => b.onclick = () => { S.d.area = +b.dataset.area; F.$$('[data-area]').forEach((x) => x.classList.toggle('on', x === b)); });
    F.$$('[data-label]').forEach((b) => b.onclick = () => { S.d.label = b.dataset.label; F.$$('[data-label]').forEach((x) => x.classList.toggle('on', x === b)); });
    F.$$('[data-cuisine]').forEach((b) => b.onclick = () => { const c = b.dataset.cuisine, l = S.d.cuisines; const i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); b.classList.toggle('on', i < 0); });
    F.$$('[data-vehicle]').forEach((b) => b.onclick = () => { S.d.vehicle = b.dataset.vehicle; render(); });
    ['line', 'landmark', 'rname', 'gst', 'vno', 'lic'].forEach((k) => { const el = F.$('#' + k); if (el) el.oninput = () => { S.d[k] = el.value; }; });
    const fs = F.$('#fssai');
    if (fs) fs.oninput = () => {
      fs.value = fs.value.replace(/\D/g, '').slice(0, 14); S.d.fssai = fs.value;
      const ok = fs.value.length === 14, m = F.$('#fsmsg');
      m.textContent = ok ? '✓ Looks right' : (14 - fs.value.length) + ' more digits';
      m.style.color = ok ? 'var(--green-text)' : 'var(--muted)';
      fs.classList.toggle('bad', !ok && fs.value.length > 0);
    };
    const sv = F.$('#save'); if (sv) sv.onclick = () => saveDetails(sv);
  }

  // Already signed in to this app? go straight there.
  const existing = F.session(S.app);
  if (existing && existing.token && !F.param('mode') && F.param('stay') !== '1') {
    F.api(S.app)('GET', '/auth/me').then(() => { location.href = APPS[S.app].page; }).catch(() => {});
  }
  render();
})();
