/* =====================================================================
   RIDER (DELIVERY PARTNER) APP
   go online -> accept offer -> ride to restaurant (map) -> pick up
   -> ride to customer (map) -> collect cash (if COD) -> delivered -> earnings
   Same 4-part pattern: state, load(), render(), actions.
   ===================================================================== */
App.screens = App.screens || {};

App.screens.rider = (ctx) => {
  const { esc, rupees, dateTime, pill } = App.ui;
  const M = App.maps;
  const api = ctx.api;
  const S = { tab: "home", me: null, offers: [], earnings: null, cash: false, driving: false };

  async function load() {
    S.me = await api.run("partner.me");
    if (!S.me) return;
    if (S.tab === "home") S.offers = (await api.run("partner.offers")) || [];
    else S.earnings = await api.run("partner.earnings");
  }

  const P = (lat, lng) => ({ lat: Number(lat), lng: Number(lng) });
  const riderPos = () => S.me.location ? P(S.me.location.latitude, S.me.location.longitude) : null;

  // the point the rider is riding to right now
  function target(c) {
    return c.status === "PICKED_UP"
      ? { ...P(c.drop_lat, c.drop_lng), name: c.customer, what: "customer" }
      : { ...P(c.pickup_lat, c.pickup_lng), name: c.restaurant, what: "restaurant" };
  }

  function jobMap(c) {
    const me = riderPos();
    const stage2 = c.status === "PICKED_UP";
    const points = [
      { key: "restaurant", lat: c.pickup_lat, lng: c.pickup_lng, label: c.restaurant },
      { key: "home", lat: c.drop_lat, lng: c.drop_lng, label: c.customer },
    ];
    if (me) points.push({ key: "rider", lat: me.lat, lng: me.lng, label: "You" });
    const legs = stage2
      ? [{ from: me ? "rider" : "restaurant", to: "home", active: true }]
      : [{ from: "rider", to: "restaurant", active: true }, { from: "restaurant", to: "home", active: false }];
    return M.placeholder("rider-job", { points, legs });
  }

  function navBar(c) {
    const t = target(c), me = riderPos();
    const dist = me ? M.roadKm(me, t) : null;
    const here = dist !== null && dist < 0.06;
    return `<div class="navbar">
      <div class="stack" style="gap:0;min-width:0">
        <span class="eyebrow">${t.what === "restaurant" ? "Ride to restaurant" : "Ride to customer"}</span>
        <b>${here ? `You have arrived at ${esc(t.name)}` : dist !== null ? `${dist.toFixed(1)} km · about ${M.etaMin(me, t)} min` : esc(t.name)}</b>
      </div>
      <div class="row">
        <button class="btn small" data-action="drive" ${S.driving || here ? "disabled" : ""}>${S.driving ? "Riding…" : "Simulate ride"}</button>
        <a class="btn small primary" href="${M.navUrl(me, t)}" target="_blank" rel="noopener">Navigate</a>
      </div>
    </div>`;
  }

  function job(c) {
    const cod = c.payment_mode === "COD";
    const stage = c.status === "PICKED_UP" ? 2 : 1;   // 1 = going to restaurant, 2 = going to customer
    const waiting = ["ACCEPTED", "PREPARING", "PLACED"].includes(c.status);
    return `<section class="jobcard">
      <div class="row" style="justify-content:space-between"><span class="eyebrow">Current delivery · #${c.order_id}</span>${pill(c.status)}</div>
      ${jobMap(c)}
      ${navBar(c)}
      <ol class="route">
        <li class="${stage === 1 ? "now" : "done"}">
          <span class="eyebrow">1 · Pick up from</span><b>${esc(c.restaurant)}</b><span class="small muted">${esc(c.pickup)}</span>
          ${stage === 1 ? (waiting
            ? `<p class="small wait">The kitchen is still preparing this order. Head there now.</p><button class="btn block" disabled>Picked up</button>`
            : `<p class="small">Food is packed. Collect the bag and confirm.</p><button class="btn primary block big" data-action="pickup" data-id="${c.order_id}">Picked up</button>`) : ""}
        </li>
        <li class="${stage === 2 ? "now" : ""}">
          <span class="eyebrow">2 · Deliver to</span><b>${esc(c.customer)}</b>
          <span class="small muted">${esc(c.drop_address)}${c.drop_landmark ? ` · ${esc(c.drop_landmark)}` : ""}</span>
          ${stage === 2 ? `
            <form class="stack" data-action="deliver" data-id="${c.order_id}" data-cod="${cod}">
              ${cod ? `<div class="cashbox"><span>Collect cash</span><b class="money">${rupees(c.total_amount)}</b>
                       <label class="row small"><input type="checkbox" name="cash" data-change="cash" ${S.cash ? "checked" : ""}> I have collected ${rupees(c.total_amount)} from the customer</label></div>`
                    : `<p class="small">Prepaid order. Nothing to collect.</p>`}
              <button class="btn primary block big" type="submit">Mark delivered</button>
            </form>` : ""}
        </li>
      </ol>
    </section>`;
  }

  function offerCard(o) {
    const me = riderPos(), pick = P(o.pickup_lat, o.pickup_lng), drop = P(o.drop_lat, o.drop_lng);
    const points = [{ key: "restaurant", lat: o.pickup_lat, lng: o.pickup_lng, label: o.restaurant },
                    { key: "home", lat: o.drop_lat, lng: o.drop_lng, label: "Customer" }];
    if (me) points.push({ key: "rider", lat: me.lat, lng: me.lng, label: "You" });
    return `<article class="offer">
      <div class="row" style="justify-content:space-between"><b>${esc(o.restaurant)}</b><span class="money">${rupees(o.total_amount)}</span></div>
      ${M.placeholder("offer-" + o.assignment_id, { points, legs: [{ from: "rider", to: "restaurant", active: true }, { from: "restaurant", to: "home", active: false }] })}
      <div class="tripfacts small">
        ${me ? `<span><b>${M.roadKm(me, pick).toFixed(1)} km</b> to pickup</span>` : ""}
        <span><b>${M.roadKm(pick, drop).toFixed(1)} km</b> delivery trip</span>
        <span>${o.payment_mode === "COD" ? `Cash · collect ${rupees(o.total_amount)}` : "Prepaid"}</span>
      </div>
      <div class="small"><span class="muted">Pick up</span> ${esc(o.pickup)}</div>
      <div class="small"><span class="muted">Drop</span> ${esc(o.drop_address)}</div>
      <div class="row"><button class="btn primary" data-action="accept" data-id="${o.assignment_id}">Accept</button>
        <button class="btn" data-action="reject" data-id="${o.assignment_id}">Skip</button></div>
    </article>`;
  }

  function home() {
    const me = S.me;
    return `
      <div class="onlinebar ${me.is_online ? "on" : ""}">
        <div class="stack" style="gap:2px"><b>${me.is_online ? "You are online" : "You are offline"}</b>
          <span class="small">${me.is_online ? "New delivery requests will appear below." : "Go online to receive delivery requests."}</span></div>
        <label class="switch" for="rd-online"><input id="rd-online" type="checkbox" data-change="online" ${me.is_online ? "checked" : ""}><span class="sr">Online</span></label>
      </div>
      ${me.kyc_status !== "VERIFIED" ? `<div class="panel small">${pill(me.kyc_status)} Your documents are being checked. You can go online once KYC is verified.</div>` : ""}
      ${me.current_order ? job(me.current_order) : `
        <div class="stack" style="gap:8px">
          <h3>Delivery requests ${S.offers.length ? `<span class="badge">${S.offers.length}</span>` : ""}</h3>
          ${S.offers.map(offerCard).join("") || `<div class="empty">${me.is_online ? "No requests right now. They appear here when a restaurant nearby accepts an order." : "You are offline."}</div>`}
        </div>`}`;
  }

  function earnings() {
    const e = S.earnings || { total: 0, deliveries: [] };
    return `
      <div class="earnhead"><span class="eyebrow">Total earned</span><b class="money big">${rupees(e.total)}</b><span class="small muted">${e.deliveries.length} deliveries</span></div>
      <div class="stack" style="gap:8px">
        ${e.deliveries.map((d) => `<div class="ordrow static">
          <span class="row" style="justify-content:space-between"><b>Order #${d.order_id}</b><span class="money">${rupees(Number(d.base_pay) + Number(d.distance_pay) + Number(d.tip))}</span></span>
          <span class="small muted">${dateTime(d.created_at)} · base ${rupees(d.base_pay)} + distance ${rupees(d.distance_pay)}${Number(d.tip) ? ` + tip ${rupees(d.tip)}` : ""} · ${d.payout_status === "PAID" ? "paid out" : "payout pending"}</span>
        </div>`).join("") || `<div class="empty">No deliveries yet.</div>`}
      </div>`;
  }

  function render() {
    if (!S.me) return `<div class="center-card"><h2>Not a delivery partner</h2></div>`;
    return `<div class="screen">${S.tab === "home" ? home() : earnings()}</div>
      <nav class="bottomnav">
        <button data-action="tab" data-tab="home" aria-pressed="${S.tab === "home"}">Deliveries</button>
        <button data-action="tab" data-tab="earnings" aria-pressed="${S.tab === "earnings"}">Earnings</button>
      </nav>`;
  }

  const actions = {
    tab(b) { S.tab = b.dataset.tab; ctx.refresh(true); },
    cash(box) { S.cash = box.checked; },
    async online(box) {
      const r = await api.run("partner.setOnline", { body: { is_online: box.checked } }, box.checked ? "You are online" : "You are offline");
      if (!r) box.checked = !box.checked;
      ctx.refresh(true);
    },
    async accept(btn) {
      await App.ui.busy(btn, () => api.run("partner.acceptOffer", { params: { assignment_id: Number(btn.dataset.id) } }, "Accepted. Ride to the restaurant."));
      ctx.refresh(true);
    },
    async reject(btn) {
      const r = await api.run("partner.rejectOffer", { params: { assignment_id: Number(btn.dataset.id) } });
      if (r) ctx.toast(r.re_offered_to ? "Skipped. Sent to another rider." : "Skipped.");
      ctx.refresh(true);
    },
    async pickup(btn) {
      await App.ui.busy(btn, () => api.run("partner.pickup", { params: { order_id: Number(btn.dataset.id) } }, "Picked up. Ride to the customer."));
      S.cash = false;
      ctx.refresh(true);
    },

    // Demo helper: moves the rider along the streets to the next stop, sending a GPS
    // point every step exactly like the phone would (partner.location -> partner_locations).
    async drive() {
      const c = S.me?.current_order;
      if (!c || S.driving) return;
      const t = target(c);
      const start = riderPos() || P(c.pickup_lat, c.pickup_lng);
      const path = M.streetPath(start, t);
      const seg = [M.km(path[0], path[1]), M.km(path[1], path[2])], total = seg[0] + seg[1] || 1;
      const STEPS = 14;
      S.driving = true; ctx.refresh();
      api.polling = true;                                      // GPS pings are hidden in the inspector by default
      try {
        for (let i = 1; i <= STEPS; i++) {
          let d = (i / STEPS) * total, a = path[0], b = path[1];
          if (d > seg[0]) { d -= seg[0]; a = path[1]; b = path[2]; }
          const len = M.km(a, b) || 1, f = Math.min(1, d / len);
          const pos = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
          await api.call("partner.location", { body: { latitude: Number(pos.lat.toFixed(6)), longitude: Number(pos.lng.toFixed(6)) } });
          S.me.location = { latitude: pos.lat, longitude: pos.lng, updated_at: new Date().toISOString() };
          ctx.refresh();
          await new Promise((r) => setTimeout(r, 380));
        }
      } finally { api.polling = false; S.driving = false; }
      ctx.toast(t.what === "restaurant" ? `You have reached ${t.name}` : `You are at ${t.name}'s door`);
      ctx.refresh(true);
    },

    async deliver(form) {
      const cod = form.dataset.cod === "true";
      if (cod && !form.cash.checked) return ctx.toast("Tick the box after you collect the cash.", true, "Cash not confirmed");
      const r = await api.run("partner.deliver", { params: { order_id: Number(form.dataset.id) }, body: { cash_collected: cod } },
                              cod ? "Delivered and cash collected. Earnings added." : "Delivered. Earnings added.");
      if (r) { S.cash = false; ctx.refresh(true); }
    },
  };

  return { load, render, actions, poll: () => S.tab === "home" && !S.driving };
};
