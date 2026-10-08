/* Admin: approve / reject new restaurants and verify / reject rider KYC. */
(function () {
  const ME = F.guard('admin');
  const api = F.api('admin');
  const view = F.$('#view'), side = F.$('#side');
  let tab = 'restaurants', data = { restaurants: [], partners: [] };
  const DOCS = ['LICENCE', 'RC', 'ID_PROOF', 'PHOTO'];

  function drawSide() {
    side.innerHTML = '<div class="head"><span class="logo" style="background:var(--green)">' + F.logoSvg('#fff') + '</span><span><b>Foodu</b><small>ADMIN</small></span></div>' +
      '<button class="nav' + (tab === 'restaurants' ? ' on' : '') + '" data-tab="restaurants">Restaurants <span class="cnt">' + data.restaurants.length + '</span></button>' +
      '<button class="nav' + (tab === 'partners' ? ' on' : '') + '" data-tab="partners">Riders (KYC) <span class="cnt">' + data.partners.length + '</span></button>' +
      '<div class="spacer"></div><button class="nav" id="out">Sign out · ' + F.esc(ME.name || '') + '</button>';
    F.$$('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
    F.$('#out').onclick = () => F.logout('admin');
  }

  async function load() {
    try { data = await api('GET', '/admin/pending'); }
    catch (e) { view.innerHTML = '<div class="card empty">' + F.esc(e.message) + '</div>'; return; }
    draw();
  }

  function draw() {
    drawSide();
    const list = data[tab];
    let h = '<div class="row between wrapf" style="margin-bottom:20px"><div><h1 style="font-size:32px;font-weight:800">Approvals</h1><span class="muted">' + (tab === 'restaurants' ? 'New restaurants waiting to go live.' : 'Riders waiting for KYC verification.') + '</span></div><button class="btn btn-ghost" id="rl">Refresh</button></div>' +
      '<div class="row" style="gap:10px;margin-bottom:18px"><button class="pill' + (tab === 'restaurants' ? ' on' : '') + '" data-t="restaurants">Restaurants · ' + data.restaurants.length + '</button><button class="pill' + (tab === 'partners' ? ' on' : '') + '" data-t="partners">Riders · ' + data.partners.length + '</button></div>';
    if (!list.length) {
      h += '<div class="card empty up" style="max-width:520px"><div class="tickc" style="width:80px;height:80px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;animation:pop .4s both"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#13A04F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2 style="color:var(--ink)">All caught up</h2>Nothing is waiting for review.</div>';
    } else if (tab === 'restaurants') {
      h += '<div class="agrid">' + list.map((r, i) => '<article class="card acard" style="animation-delay:' + i * 0.06 + 's" data-card="' + r.restaurant_id + '">' + F.photo(F.restImg(r.cuisines + ' ' + r.name, r.restaurant_id), r.name) +
        '<div class="b"><div class="row between"><h3 style="font-size:20px;font-weight:800">' + F.esc(r.name) + '</h3><span class="badge b-warn">Pending</span></div>' +
        '<div class="kv"><span>Cuisines</span><b>' + F.esc(r.cuisines || '-') + '</b><span>Address</span><b>' + F.esc(r.address_line) + ', ' + F.esc(r.city) + '</b><span>FSSAI</span><b>' + F.esc(r.fssai_no) + (/^[0-9]{14}$/.test(r.fssai_no) ? ' ✓' : ' ⚠') + '</b><span>GST</span><b>' + F.esc(r.gst_no || 'Not added') + '</b>' +
        '<span>Owner</span><b>' + F.esc(r.owner_name || '-') + ' · ' + F.esc(r.owner_phone || '') + '</b><span>Applied</span><b>' + F.ago(r.created_at) + '</b></div>' +
        '<div class="row"><button class="btn btn-red grow" data-rr="' + r.restaurant_id + '">Reject</button><button class="btn btn-green grow" data-ra="' + r.restaurant_id + '">Approve</button></div></div></article>').join('') + '</div>';
    } else {
      h += '<div class="agrid">' + list.map((p, i) => {
        const docs = p.documents || [];
        const chips = DOCS.map((d) => { const x = docs.find((y) => y.doc_type === d); return '<span class="doc ' + (x ? 'b-green' : 'b-warn') + '">' + (x ? '✓ ' : '! ') + d.replace('_', ' ') + '</span>'; }).join(' ');
        const missing = DOCS.filter((d) => !docs.some((y) => y.doc_type === d)).length;
        return '<article class="card acard" style="animation-delay:' + i * 0.06 + 's" data-card="' + p.partner_id + '"><div class="b"><div class="row"><span class="avatar" style="width:54px;height:54px;font-size:20px;background:var(--ink);color:#fff">' + F.initials(p.name) + '</span><div class="grow"><h3 style="font-size:20px;font-weight:800">' + F.esc(p.name) + '</h3><span class="muted small">' + F.esc(p.phone) + ' · ' + F.esc(p.city) + '</span></div><span class="badge b-warn">KYC</span></div>' +
          '<div class="kv"><span>Vehicle</span><b>' + F.esc(p.vehicle_type) + ' · ' + F.esc(p.vehicle_no) + '</b><span>Licence</span><b>' + F.esc(p.licence_no) + '</b><span>Joined</span><b>' + F.ago(p.joined_at) + '</b></div>' +
          '<div class="row wrapf" style="gap:6px">' + chips + '</div>' + (missing ? '<div class="note warn small">' + missing + ' document(s) not uploaded. Check them in person before verifying.</div>' : '') +
          '<div class="row"><button class="btn btn-red grow" data-pr="' + p.partner_id + '">Reject</button><button class="btn btn-green grow" data-pa="' + p.partner_id + '">Verify KYC</button></div></div></article>';
      }).join('') + '</div>';
    }
    view.innerHTML = h;
    F.$('#rl').onclick = load;
    F.$$('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; draw(); });
    const act = (sel, path, ok, label, color) => F.$$(sel).forEach((b) => b.onclick = async () => {
      const id = b.getAttribute(sel.slice(1, -1));
      F.busy(b, true);
      try {
        await api('POST', path(id));
        const card = F.$('[data-card="' + id + '"]');
        card.insertAdjacentHTML('beforeend', '<div class="stamp" style="color:' + color + ';border-color:' + color + '">' + label + '</div>');
        F.toast(ok);
        setTimeout(() => card.classList.add('out'), 700);
        setTimeout(load, 1200);
      } catch (e) { F.busy(b, false); F.toast(e.message, true); }
    });
    act('[data-ra]', (id) => '/admin/restaurants/' + id + '/approve', 'Restaurant approved · it can now take orders', 'APPROVED', '#0E8A42');
    act('[data-rr]', (id) => '/admin/restaurants/' + id + '/reject', 'Restaurant rejected', 'REJECTED', '#A8261B');
    act('[data-pa]', (id) => '/admin/partners/' + id + '/verify', 'Rider verified · they can go online', 'VERIFIED', '#0E8A42');
    act('[data-pr]', (id) => '/admin/partners/' + id + '/reject', 'Rider rejected', 'REJECTED', '#A8261B');
  }

  view.innerHTML = '<div class="skeleton" style="height:240px"></div>';
  load();
})();
