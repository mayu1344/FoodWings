/* =====================================================================
   RESTAURANT APP  -  see new orders -> accept -> prepare -> mark ready -> hand over to rider
   Same 4-part pattern: state, load(), render(), actions.
   ===================================================================== */
App.screens = App.screens || {};

App.screens.restaurant = (ctx) => {
  const { esc, rupees, time, dateTime, pill } = App.ui;
  const api = ctx.api;
  const S = { tab: "orders", mine: [], rid: null, cols: { PLACED: [], ACCEPTED: [], READY: [], PICKED_UP: [] }, menu: null, payouts: [] };
  const current = () => S.mine.find((r) => r.restaurant_id === S.rid);

  async function load() {
    S.mine = (await api.run("restaurant.mine")) || [];
    if (!S.rid && S.mine.length) S.rid = S.mine[0].restaurant_id;
    const r = current();
    if (!r || r.status !== "ACTIVE") return;
    const params = { restaurant_id: S.rid };
    if (S.tab === "orders") {
      const keys = Object.keys(S.cols);
      const res = await Promise.all(keys.map((st) => api.run("restaurant.orders", { params, query: { status: st } })));
      keys.forEach((k, i) => (S.cols[k] = res[i] || []));
    } else if (S.tab === "menu") {
      S.menu = await api.run("restaurants.menu", { params });
    } else {
      S.payouts = (await api.run("restaurant.payouts", { params })) || [];
    }
  }

  function card(o, action) {
    const rider = o.partner_name ? `<span class="rider">Rider: <b>${esc(o.partner_name)}</b></span>` : `<span class="rider muted">Finding a rider…</span>`;
    return `<article class="ordercard">
      <header><b>#${o.order_id}</b><span class="small muted num">${time(o.placed_at)}</span></header>
      <ul>${o.items.map((i) => `<li><b class="num">${i.qty}×</b> ${esc(i.item)}${i.addons.length ? ` <span class="muted">(${i.addons.map((a) => esc(a.name)).join(", ")})</span>` : ""}</li>`).join("")}</ul>
      ${o.special_instructions ? `<p class="note-chip">“${esc(o.special_instructions)}”</p>` : ""}
      <div class="row small" style="justify-content:space-between">${rider}<span>${o.payment_mode === "COD" ? "Cash" : "Paid online"} · <span class="money">${rupees(o.total_amount)}</span></span></div>
      ${action || ""}
    </article>`;
  }

  function board() {
    const col = (key, title, hint, action) => `
      <section class="kcol">
        <header><h3>${title}</h3><span class="count">${S.cols[key].length}</span></header>
        <p class="small muted">${hint}</p>
        ${S.cols[key].map((o) => card(o, action ? action(o) : "")).join("") || `<div class="empty">Nothing here</div>`}
      </section>`;
    return `<div class="board">
      ${col("PLACED", "New orders", "Accept to start cooking. A rider is booked automatically.",
            (o) => `<button class="btn primary block" data-action="accept" data-id="${o.order_id}">Accept order</button>`)}
      ${col("ACCEPTED", "Preparing", "Mark ready when the food is packed.",
            (o) => `<button class="btn primary block" data-action="ready" data-id="${o.order_id}">Food is ready</button>`)}
      ${col("READY", "Ready for pickup", "Hand the bag to the rider when they arrive.", null)}
      ${col("PICKED_UP", "Handed to rider", "On the way to the customer.", null)}
    </div>`;
  }

  function menu() {
    if (!S.menu) return `<div class="empty">Menu not available.</div>`;
    return `<div class="panel">${S.menu.menu.map((c) => `
      <section class="menucat"><h3>${esc(c.category)}</h3>
        ${c.items.map((i) => `<div class="dish">
          <span class="name"><span class="${i.is_veg ? "veg" : "nonveg"}"></span>${esc(i.name)} <span class="money">${rupees(i.price)}</span></span>
          <label class="switch" for="st-${i.item_id}"><input id="st-${i.item_id}" type="checkbox" data-change="stock" data-item="${i.item_id}" ${i.in_stock ? "checked" : ""}> ${i.in_stock ? "In stock" : "Sold out"}</label>
        </div>`).join("")}
      </section>`).join("")}</div>`;
  }

  function payouts() {
    const pending = S.payouts.filter((p) => p.payout_status === "PENDING").reduce((s, p) => s + Number(p.payout_amount), 0);
    return `<div class="panel stack">
      <div class="sectionhead"><h3>Payouts</h3><span class="small">Pending <span class="money">${rupees(pending)}</span></span></div>
      <div class="tablewrap"><table>
        <thead><tr><th>Order</th><th>Date</th><th>Food value</th><th>Commission</th><th>You get</th><th>Status</th></tr></thead>
        <tbody>${S.payouts.map((p) => `<tr><td>#${p.order_id}</td><td>${dateTime(p.created_at)}</td><td>${rupees(p.order_amount)}</td>
          <td>− ${rupees(p.commission)}</td><td class="money">${rupees(p.payout_amount)}</td><td>${pill(p.payout_status)}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No payouts yet.</td></tr>`}</tbody>
      </table></div></div>`;
  }

  function render() {
    const r = current();
    if (!r) return `<div class="center-card"><h2>No restaurant linked</h2><p class="muted">This account is not staff of any restaurant.</p></div>`;
    const counts = S.cols.PLACED.length;
    return `<div class="screen">
      <div class="resthead">
        <div class="stack" style="gap:2px;min-width:0">
          <span class="eyebrow">${esc(r.staff_role)}</span>
          ${S.mine.length > 1 ? `<select id="r-pick" data-change="pick">${S.mine.map((m) => `<option value="${m.restaurant_id}" ${m.restaurant_id === S.rid ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>` : `<h2>${esc(r.name)}</h2>`}
        </div>
        ${r.status === "ACTIVE" ? `<label class="switch" for="r-open"><input id="r-open" type="checkbox" data-change="open" ${r.is_open ? "checked" : ""}> ${r.is_open ? "Accepting orders" : "Closed"}</label>` : pill(r.status, "Awaiting approval")}
      </div>
      <nav class="tabs">
        <button data-action="tab" data-tab="orders" aria-pressed="${S.tab === "orders"}">Orders${counts ? ` <span class="badge">${counts}</span>` : ""}</button>
        <button data-action="tab" data-tab="menu" aria-pressed="${S.tab === "menu"}">Menu &amp; stock</button>
        <button data-action="tab" data-tab="payouts" aria-pressed="${S.tab === "payouts"}">Payouts</button>
      </nav>
      ${r.status !== "ACTIVE" ? `<div class="panel">This restaurant is waiting for approval and cannot take orders yet.</div>`
        : S.tab === "orders" ? board() : S.tab === "menu" ? menu() : payouts()}
    </div>`;
  }

  const actions = {
    tab(b) { S.tab = b.dataset.tab; ctx.refresh(true); },
    pick(sel) { S.rid = Number(sel.value); ctx.refresh(true); },
    async open(box) {
      const r = await api.run("restaurant.setOpen", { params: { restaurant_id: S.rid }, body: { is_open: box.checked } }, box.checked ? "Now accepting orders" : "Restaurant closed");
      if (!r) box.checked = !box.checked;
      ctx.refresh(true);
    },
    async accept(btn) {
      await App.ui.busy(btn, async () => {
        const r = await api.run("restaurant.accept", { params: { restaurant_id: S.rid, order_id: Number(btn.dataset.id) } });
        if (r) ctx.toast(r.offered_to_partner ? `Accepted. Rider request sent.` : "Accepted. No rider free nearby yet.");
      });
      ctx.refresh(true);
    },
    async ready(btn) {
      await App.ui.busy(btn, () => api.run("restaurant.ready", { params: { restaurant_id: S.rid, order_id: Number(btn.dataset.id) } }, "Marked ready. Waiting for the rider."));
      ctx.refresh(true);
    },
    async stock(box) {
      const r = await api.run("restaurant.updateItem", { params: { restaurant_id: S.rid, item_id: Number(box.dataset.item) }, body: { in_stock: box.checked } },
                              box.checked ? "Back in stock" : "Marked sold out");
      if (!r) box.checked = !box.checked;
      ctx.refresh(true);
    },
  };

  return { load, render, actions, poll: () => S.tab === "orders" };
};
