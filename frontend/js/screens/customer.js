/* =====================================================================
   CUSTOMER APP  -  browse -> add to cart -> checkout -> pay -> track -> receive -> rate
   Same 4-part pattern as every screen: state, load(), render(), actions.
   ===================================================================== */
App.screens = App.screens || {};

App.screens.customer = (ctx) => {
  const { esc, rupees, time, dateTime, pill } = App.ui;
  const api = ctx.api;
  const S = { view: "home", addresses: [], addressId: null, restaurants: [], rid: null, menu: null, cart: null,
              orders: [], orderId: null, order: null, searchQuery: "", activeCategory: "ALL" };
  const FINAL = ["DELIVERED", "CANCELLED"];

  const cartCount = () => (S.cart?.items || []).reduce((n, l) => n + l.quantity, 0);
  const restName = (rid) => S.restaurants.find((r) => r.restaurant_id === rid)?.name || S.menu?.restaurant?.name || "";

  // ---------------- load ----------------
  async function load() {
    if (!S.addresses.length) {
      S.addresses = (await api.run("addresses.list")) || [];
      S.addressId = (S.addresses.find((a) => a.is_default) || S.addresses[0])?.address_id ?? null;
    }
    if (S.view === "home") {
      S.restaurants = S.addressId ? (await api.run("restaurants.list", { query: { address_id: S.addressId } })) || [] : [];
      S.cart = await api.run("cart.get");
    } else if (S.view === "menu") {
      [S.menu, S.cart] = await Promise.all([api.run("restaurants.menu", { params: { restaurant_id: S.rid } }), api.run("cart.get")]);
    } else if (S.view === "cart") {
      S.cart = await api.run("cart.get");
      if (S.cart?.restaurant_id && !restName(S.cart.restaurant_id))
        S.restaurants = (await api.run("restaurants.list", { query: { address_id: S.addressId } })) || [];
    } else if (S.view === "orders") {
      S.orders = (await api.run("orders.mine")) || [];
    } else if (S.view === "track") {
      S.order = await api.run("orders.get", { params: { order_id: S.orderId } });
    }
  }

  // ---------------- render ----------------
  function nav() {
    const tab = S.view === "menu" ? "home" : S.view === "track" ? "orders" : S.view;
    const n = cartCount();
    return `<nav class="bottomnav">
      <button data-action="go" data-view="home" aria-pressed="${tab === "home"}"><span>🍔</span> Restaurants</button>
      <button data-action="go" data-view="cart" aria-pressed="${tab === "cart"}"><span>🛒</span> Cart${n ? ` <span class="badge">${n}</span>` : ""}</button>
      <button data-action="go" data-view="orders" aria-pressed="${tab === "orders"}"><span>📦</span> My orders</button>
    </nav>`;
  }

  function viewHome() {
    const q = (S.searchQuery || "").toLowerCase();
    const cat = S.activeCategory || "ALL";

    let filtered = S.restaurants.filter((r) => {
      const matchQ = !q || r.name.toLowerCase().includes(q) || (r.cuisines || "").toLowerCase().includes(q);
      const matchCat = cat === "ALL" || (r.cuisines || "").toLowerCase().includes(cat.toLowerCase());
      return matchQ && matchCat;
    });

    const categories = [
      { id: "ALL", label: "✨ All" },
      { id: "Biryani", label: "🍗 Biryani" },
      { id: "South Indian", label: "🥘 South Indian" },
      { id: "Pizza", label: "🍕 Pizza" },
      { id: "Beverages", label: "☕ Beverages" },
      { id: "Fast Food", label: "🍔 Fast Food" }
    ];

    return `
      <!-- Delivery Address Bar -->
      <div class="address-header-card">
        <div class="addr-icon">📍</div>
        <div class="addr-select-wrap">
          <span class="addr-label">DELIVER TO</span>
          <select id="c-addr" data-change="address" class="addr-dropdown">
            ${S.addresses.map((a) => `<option value="${a.address_id}" ${a.address_id === S.addressId ? "selected" : ""}>${esc(a.label)} — ${esc(a.address_line)}</option>`).join("")}
          </select>
        </div>
      </div>

      <!-- Live Search Bar -->
      <div class="search-box-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" placeholder="Search restaurants or cuisines (Biryani, Pizza...)" value="${esc(S.searchQuery)}" data-change="searchFilter" autofocus>
        ${S.searchQuery ? `<button type="button" class="clear-search-btn" data-action="clearSearch">✕</button>` : ""}
      </div>

      <!-- Quick Category Chips -->
      <div class="category-scroll-bar">
        ${categories.map(c => `
          <button type="button" class="cat-chip ${cat === c.id ? 'active' : ''}" data-action="selectCat" data-cat="${c.id}">
            ${c.label}
          </button>
        `).join("")}
      </div>

      <!-- Special Promo Banner -->
      <div class="promo-banner">
        <div class="promo-content">
          <span class="promo-tag">⚡ SPECIAL OFFER</span>
          <b>Get 50% OFF up to ₹100</b>
          <span class="small muted">Use coupon code <b>WELCOME50</b> at checkout</span>
        </div>
        <span class="promo-badge-icon">🎉</span>
      </div>

      <!-- Section Title -->
      <div class="sectionhead" style="margin-top:6px;">
        <h2>Open Near You</h2>
        <span class="small muted num"><b>${filtered.length}</b> restaurants found</span>
      </div>

      <!-- Restaurant Cards List -->
      <div class="stack" style="gap:12px">
        ${filtered.map((r) => `
          <button class="restcard" data-action="open-rest" data-rid="${r.restaurant_id}">
            <div class="restimg-box">
              <span class="restimg" aria-hidden="true">${esc(r.name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>
              <span class="rest-offer-tag">50% OFF</span>
            </div>
            <div class="rest-info stack" style="gap:4px;min-width:0;flex:1;">
              <div class="row" style="justify-content:space-between;align-items:flex-start;">
                <b class="rest-name">${esc(r.name)}</b>
                <span class="rating">★ ${r.avg_rating}</span>
              </div>
              <span class="small muted rest-cuisines">${esc(r.cuisines)}</span>
              <div class="rest-meta-row">
                <span class="meta-pill">⏱️ ${r.eta_mins} min</span>
                <span class="meta-pill">📍 ${r.distance_km} km</span>
                <span class="meta-pill">🛵 ₹30 Delivery</span>
              </div>
            </div>
          </button>`).join("") || `<div class="empty">No restaurants match your search criteria.</div>`}
      </div>`;
  }

  function viewMenu() {
    if (!S.menu) return `<div class="empty">Menu not available.</div>`;
    const n = cartCount();
    const rest = S.menu.restaurant;

    return `
      <!-- Restaurant Header Banner -->
      <div class="menu-hero-card stack" style="gap:8px;">
        <button class="linkbtn small back-link" data-action="go" data-view="home">← All restaurants</button>
        <div class="row" style="justify-content:space-between;align-items:flex-start;">
          <div>
            <h2 class="menu-rest-name">${esc(rest.name)}</h2>
            <span class="small muted">Fresh ingredients · Hygienic kitchen · Instant prep</span>
          </div>
          <span class="rating big">★ 4.6</span>
        </div>
        <div class="row small muted" style="gap:12px;">
          <span>⏱️ 20-25 mins</span>
          <span>📍 2.4 km</span>
          <span class="good font-weight-700">● Open for orders</span>
        </div>
      </div>

      <!-- Menu Categories -->
      ${S.menu.menu.map((c) => `
        <section class="menucat">
          <div class="cat-header">
            <h3>${esc(c.category)}</h3>
            <span class="small muted">${c.items.length} dishes</span>
          </div>
          ${c.items.map((i) => `
            <div class="dish-card ${i.in_stock ? "" : "soldout"}">
              <div class="dish-details stack" style="gap:4px;min-width:0;flex:1;">
                <span class="name">
                  <span class="${i.is_veg ? "veg" : "nonveg"}" title="${i.is_veg ? "Veg" : "Non-veg"}"></span>
                  <b>${esc(i.name)}</b>
                </span>
                <span class="money dish-price">${rupees(i.price)}</span>
                <span class="small muted dish-desc">${esc(i.description || "")}</span>
              </div>

              <div class="dish-action-col">
                ${i.in_stock ? `
                  <button class="btn small add-dish-btn" data-action="add" data-item="${i.item_id}">
                    <span>ADD +</span>
                  </button>
                ` : `<span class="pill bad">Sold out</span>`}
              </div>

              ${i.addons.length && i.in_stock ? `
                <div class="addons">
                  <span class="small muted" style="width:100%;font-weight:700;">Customizable Add-ons:</span>
                  ${i.addons.map((a) => `
                    <label class="addon-chip">
                      <input type="checkbox" name="addon-${i.item_id}" value="${a.addon_id}">
                      <span>${esc(a.name)}</span>
                      <b>${a.price ? "+" + rupees(a.price) : "(free)"}</b>
                    </label>`).join("")}
                </div>` : ""}
            </div>`).join("")}
        </section>`).join("")}

      <!-- Floating Sticky Cart Bar -->
      ${n && S.cart.restaurant_id === S.rid ? `
        <button class="cartbar floating-cart" data-action="go" data-view="cart">
          <div class="cartbar-left">
            <span class="cartbar-count">${n} ITEM${n > 1 ? "S" : ""}</span>
            <span class="cartbar-total">${rupees(S.cart.item_total)}</span>
          </div>
          <div class="cartbar-right">
            <b>View Cart →</b>
          </div>
        </button>` : ""}`;
  }

  function viewCart() {
    const c = S.cart || { items: [] };
    if (!c.items.length) return `<div class="center-card stack">
      <div class="empty-cart-icon" style="font-size:48px;">🛒</div>
      <h2>Your cart is empty</h2>
      <p class="muted">Explore delicious food from restaurants near you and add items to your cart.</p>
      <button class="btn primary glow-btn" data-action="go" data-view="home" style="margin-top:12px;">Browse Restaurants</button>
    </div>`;

    const est = { delivery: 30, platform: 5, tax: Math.round(c.item_total * 5) / 100 };
    return `
      <div class="stack" style="gap:4px">
        <span class="eyebrow">Checkout</span>
        <h2>${esc(restName(c.restaurant_id))}</h2>
      </div>

      <div class="panel stack cart-items-panel">
        <span class="box-title">Order Summary</span>
        ${c.items.map((l) => `
          <div class="cartline">
            <div class="stack" style="gap:2px;min-width:0;flex:1;">
              <b>${esc(l.name)}</b>
              ${l.selected_addons.length ? `<span class="small muted">+ ${l.selected_addons.length} custom add-on${l.selected_addons.length > 1 ? "s" : ""}</span>` : ""}
            </div>
            <span class="qty-stepper">
              <button data-action="qty" data-id="${l.cart_item_id}" data-d="-1" aria-label="One less">−</button>
              <b class="num">${l.quantity}</b>
              <button data-action="qty" data-id="${l.cart_item_id}" data-d="1" aria-label="One more">+</button>
            </span>
            <span class="money">${rupees(l.line_total)}</span>
          </div>`).join("")}
      </div>

      <form class="stack" data-action="place" style="gap:16px;">
        <!-- Deliver To Selector -->
        <div class="panel stack">
          <span class="box-title">📍 Delivery Address</span>
          <label class="field" for="c-addr2">
            <select id="c-addr2" name="address">
              ${S.addresses.map((a) => `<option value="${a.address_id}" ${a.address_id === S.addressId ? "selected" : ""}>${esc(a.label)} · ${esc(a.address_line)}</option>`).join("")}
            </select>
          </label>
        </div>

        <!-- Coupon Card -->
        <div class="panel stack">
          <span class="box-title">🏷️ Apply Coupon</span>
          <div class="row" style="gap:8px;">
            <input id="c-coupon" name="coupon" type="text" placeholder="e.g. WELCOME50" style="flex:1;text-transform:uppercase;font-weight:700;">
          </div>
          <div class="coupon-chips-row">
            <button type="button" class="coupon-pill" data-action="applyCoupon" data-code="WELCOME50">✨ WELCOME50 (50% OFF)</button>
            <button type="button" class="coupon-pill" data-action="applyCoupon" data-code="FLAT75">⚡ FLAT75 (₹75 OFF)</button>
          </div>
        </div>

        <!-- Payment Mode Selector -->
        <div class="panel stack">
          <span class="box-title">💳 Payment Method</span>
          <div class="paymodes-grid">
            <label class="paymode-card">
              <input type="radio" name="mode" value="CARD" checked>
              <div class="paymode-content">
                <span class="pay-icon">💳</span>
                <b>Credit / Debit Card</b>
                <span class="small muted">Visa, Mastercard, RuPay</span>
              </div>
            </label>
            <label class="paymode-card">
              <input type="radio" name="mode" value="UPI">
              <div class="paymode-content">
                <span class="pay-icon">📱</span>
                <b>UPI Instant Pay</b>
                <span class="small muted">GPay, PhonePe, Paytm</span>
              </div>
            </label>
            <label class="paymode-card">
              <input type="radio" name="mode" value="COD">
              <div class="paymode-content">
                <span class="pay-icon">💵</span>
                <b>Cash on Delivery</b>
                <span class="small muted">Pay cash upon delivery</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Special Instructions -->
        <label class="field" for="c-note">Note for Restaurant / Rider
          <input id="c-note" name="note" type="text" placeholder="e.g. Leave at door, extra spicy, no cutlery">
        </label>

        <!-- Itemized Bill -->
        <div class="panel stack bill">
          <span class="box-title">Bill Details</span>
          <div class="billrow"><span>Item Total</span><span>${rupees(c.item_total)}</span></div>
          <div class="billrow muted"><span>Delivery Partner Fee</span><span>${rupees(est.delivery)}</span></div>
          <div class="billrow muted"><span>Platform Convenience Fee</span><span>${rupees(est.platform)}</span></div>
          <div class="billrow muted"><span>Restaurant GST &amp; Taxes (5%)</span><span>${rupees(est.tax)}</span></div>
          <div class="billrow total"><span>To Pay</span><span>${rupees(c.item_total + est.delivery + est.platform + est.tax)}</span></div>
          <span class="small muted" style="text-align:center;margin-top:4px;">🔒 100% Secure &amp; Encrypted Payment</span>
        </div>

        <button class="btn primary block big glow-btn" type="submit">Place Order →</button>
      </form>`;
  }

  function viewOrders() {
    return `<h2>My orders</h2>
      <div class="stack" style="gap:8px">
        ${S.orders.map((o) => `
          <button class="ordrow" data-action="track" data-id="${o.order_id}">
            <span class="row" style="justify-content:space-between"><b>${esc(o.restaurant)}</b>${pill(o.status)}</span>
            <span class="small muted num">#${o.order_id} · ${rupees(o.total_amount)} · ${o.payment_mode} · ${dateTime(o.placed_at)}</span>
          </button>`).join("") || `<div class="empty">No orders yet.</div>`}
      </div>`;
  }

  function progress(status) {
    const steps = [["PLACED", "Placed"], ["ACCEPTED", "Preparing"], ["READY", "Ready"], ["PICKED_UP", "On the way"], ["DELIVERED", "Delivered"]];
    const order = ["PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED"];
    const at = order.indexOf(status === "PREPARING" ? "ACCEPTED" : status);
    return `<ol class="steps">${steps.map(([k, label]) => {
      const i = order.indexOf(k);
      return `<li class="${at >= i && at >= 0 ? "done" : ""} ${at === i ? "now" : ""}">${label}</li>`;
    }).join("")}</ol>`;
  }

  function headline(o) {
    const rider = o.partner_name ? esc(o.partner_name) : "A delivery partner";
    return {
      PAYMENT_PENDING: "Complete the payment to place your order.",
      PAYMENT_FAILED: "Payment did not go through. Try again with another card or UPI ID.",
      PLACED: "Waiting for the restaurant to accept your order.",
      ACCEPTED: `The kitchen is preparing your food.${o.partner_name ? ` ${rider} will pick it up.` : ""}`,
      PREPARING: "The kitchen is preparing your food.",
      READY: `Your food is packed. ${rider} is collecting it.`,
      PICKED_UP: `${rider} is on the way with your order.`,
      DELIVERED: "Delivered. Enjoy your meal!",
      CANCELLED: "This order was cancelled.",
    }[o.status] || "";
  }

  // live map: restaurant, your address, and the rider once one is assigned
  function trackMap(o) {
    const M = App.maps, rider = o.partner_location;
    const points = [{ key: "restaurant", lat: o.restaurant_lat, lng: o.restaurant_lng, label: o.restaurant_name },
                    { key: "home", lat: o.drop_lat, lng: o.drop_lng, label: "You" }];
    if (rider) points.push({ key: "rider", lat: rider.latitude, lng: rider.longitude, label: o.partner_name || "Rider" });
    const picked = o.status === "PICKED_UP";
    const legs = picked && rider ? [{ from: "rider", to: "home", active: true }]
               : [{ from: "restaurant", to: "home", active: false }, ...(rider ? [{ from: "rider", to: "restaurant", active: true }] : [])];
    const eta = picked && rider ? M.etaMin({ lat: Number(rider.latitude), lng: Number(rider.longitude) }, { lat: Number(o.drop_lat), lng: Number(o.drop_lng) }) : null;
    return `${M.placeholder("track-" + o.order_id, { points, legs })}
      ${eta ? `<p class="small"><b>Arriving in about ${eta} min</b> · rider location updated ${time(rider.updated_at)}</p>` : ""}`;
  }

  function viewTrack() {
    const o = S.order;
    if (!o) return `<div class="empty">Order not found.</div>`;
    const cod = o.payment_mode === "COD";
    return `
      <button class="linkbtn small" data-action="go" data-view="orders">← My orders</button>
      <div class="trackhead ${o.status === "DELIVERED" ? "delivered" : ""}">
        <span class="eyebrow">Order #${o.order_id} · ${esc(o.restaurant_name)}</span>
        <h2>${headline(o)}</h2>
        ${!["PAYMENT_PENDING", "PAYMENT_FAILED", "CANCELLED"].includes(o.status) ? progress(o.status) : pill(o.status)}
        ${["ACCEPTED", "PREPARING", "READY", "PICKED_UP"].includes(o.status) ? trackMap(o) : ""}
        ${cod && !FINAL.includes(o.status) ? `<p class="small">Keep <b>${rupees(o.total_amount)}</b> cash ready for the rider.</p>` : ""}
      </div>
      <div class="row">
        ${["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(o.status) && o.payment ? `<button class="btn primary" data-action="repay">Pay now</button>` : ""}
        ${["PAYMENT_PENDING", "PAYMENT_FAILED", "PLACED"].includes(o.status) ? `<button class="btn danger" data-action="cancel">Cancel order</button>` : ""}
        ${o.status === "DELIVERED" ? `<button class="btn primary" data-action="rate">Rate this order</button>` : ""}
      </div>
      <div class="panel stack bill">
        <h3>Bill</h3>
        ${o.items.map((i) => `<div class="billrow small"><span>${esc(i.item_name)} × ${i.quantity}${i.addons.length ? ` <span class="muted">+ ${i.addons.map((a) => esc(a.name)).join(", ")}</span>` : ""}</span><span>${rupees(i.line_total)}</span></div>`).join("")}
        <div class="billrow small muted"><span>Delivery fee</span><span>${rupees(o.delivery_fee)}</span></div>
        <div class="billrow small muted"><span>Platform fee</span><span>${rupees(o.platform_fee)}</span></div>
        <div class="billrow small muted"><span>Taxes</span><span>${rupees(o.taxes)}</span></div>
        ${Number(o.discount) ? `<div class="billrow small good"><span>Coupon discount</span><span>− ${rupees(o.discount)}</span></div>` : ""}
        <div class="billrow total"><span>Total</span><span>${rupees(o.total_amount)}</span></div>
        ${o.payment ? `<div class="billrow small"><span>Payment</span><span>${pill(o.payment.status)} ${o.payment.card_last4 ? `<span class="mono">${esc(o.payment.card_network)} •••• ${esc(o.payment.card_last4)}</span>` : esc(o.payment.method_type)}</span></div>` : ""}
      </div>
      <details class="panel"><summary class="small"><b>Status history</b></summary>
        <ol class="timeline">${o.timeline.map((t) => `<li><span>${pill(t.status)}${t.note ? ` <span class="muted small">${esc(t.note)}</span>` : ""}</span><span class="muted small num">${time(t.changed_at)}</span></li>`).join("")}</ol>
      </details>`;
  }

  function render() {
    const body = { home: viewHome, menu: viewMenu, cart: viewCart, orders: viewOrders, track: viewTrack }[S.view]();
    return `<div class="screen">${body}</div>${nav()}`;
  }

  // ---------------- payment (card/UPI go to the GATEWAY; our API only sees a token) ----------------
  async function payModal(checkout, mode) {
    const methods = ((await api.run("paymentMethods.list")) || []).filter((m) => m.method_type === mode);
    const isCard = mode === "CARD";
    ctx.modal(`
      <div class="sectionhead"><h3>Pay ${rupees(checkout.bill.total)}</h3><span class="small muted">Order #${checkout.order_id}</span></div>
      <form class="stack" data-modal-submit="pay">
        ${methods.map((m, i) => `<label class="row small"><input type="radio" name="pm" value="${m.method_id}" ${i === 0 ? "checked" : ""}>
          <span class="mono">${m.card_last4 ? `${esc(m.card_network)} •••• ${esc(m.card_last4)}` : esc(m.upi_vpa_masked)}</span> <span class="muted">saved</span></label>`).join("")}
        <label class="row small"><input type="radio" name="pm" value="new" ${methods.length ? "" : "checked"}> New ${isCard ? "card" : "UPI ID"}</label>
        <div class="gateway">
          <div class="gwhead"><span>MockPay secure checkout</span><span class="small">payment gateway</span></div>
          <p class="note">This box belongs to the payment gateway. Card number and CVV go to the gateway, never to FoodWings. FoodWings only gets a token and the last 4 digits.</p>
          ${isCard ? `
            <label class="field" for="g-cc">Card number<input id="g-cc" name="cc" type="text" inputmode="numeric" autocomplete="off" placeholder="4111 1111 1111 1111"></label>
            <div class="row">
              <label class="field" for="g-exp" style="flex:1">Expiry MM/YY<input id="g-exp" name="exp" type="text" autocomplete="off" placeholder="12/30"></label>
              <label class="field" for="g-cvv" style="flex:1">CVV<input id="g-cvv" name="cvv" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="•••"></label>
            </div>
            <label class="row small"><input type="checkbox" name="save" checked> Save card as a token for next time</label>
            <div class="row small"><span class="muted">Test cards:</span>
              <button type="button" class="linkbtn" data-modal="ok">4111… pays</button>
              <button type="button" class="linkbtn" data-modal="bad">4000…0002 declines</button></div>` : `
            <label class="field" for="g-vpa">UPI ID<input id="g-vpa" name="vpa" type="text" autocomplete="off" placeholder="ravi@okaxis"></label>
            <p class="small muted">A UPI ID starting with "fail" is declined.</p>`}
        </div>
        <p class="small errtext" id="payerror" hidden></p>
        <button class="btn primary block big" type="submit">Pay ${rupees(checkout.bill.total)}</button>
        <div class="row" style="justify-content:space-between">
          <button type="button" class="linkbtn small" data-modal="later">Pay later</button>
          <button type="button" class="linkbtn small" data-modal="cvvtest">Test: send a CVV to our API</button>
        </div>
      </form>`, {
      ok(b, w) { w.querySelector("#g-cc").value = "4111 1111 1111 1111"; w.querySelector("#g-exp").value = "12/30"; w.querySelector("#g-cvv").value = "123"; w.querySelector("[name=pm][value=new]").checked = true; },
      bad(b, w) { w.querySelector("#g-cc").value = "4000 0000 0000 0002"; w.querySelector("#g-exp").value = "12/30"; w.querySelector("#g-cvv").value = "123"; w.querySelector("[name=pm][value=new]").checked = true; },
      later() { ctx.closeModal(); track(checkout.order_id); },
      async cvvtest() {
        const r = await api.call("payments.pay", { params: { payment_id: checkout.payment_id }, body: { gateway_token: "tok_x12345", cvv: "123" } });
        ctx.toast(`API refused it: ${r.error?.code}, "${(r.error?.details || []).map((d) => d.field + " " + d.error).join(", ")}". The CVV was not stored or echoed.`, true, "CVV blocked");
      },
      async pay(f, w) {
        const err = w.querySelector("#payerror");
        err.hidden = true;
        await App.ui.busy(f.querySelector("[type=submit]"), async () => {
          let body;
          const choice = f.querySelector("[name=pm]:checked")?.value || "new";
          if (choice !== "new") body = { saved_method_id: Number(choice) };
          else if (isCard) {
            const [mm, yy] = f.exp.value.split("/").map((x) => Number(x.trim()));
            const tok = await App.gatewaySdk.tokenizeCard({ card_number: f.cc.value, expiry_month: mm, expiry_year: yy < 100 ? 2000 + yy : yy, cvv: f.cvv.value });
            f.cc.value = ""; f.cvv.value = "";               // wipe card data from the page straight away
            if (!tok.ok) { err.textContent = tok.message; err.hidden = false; return; }
            body = { gateway_token: tok.token, save_method: f.save.checked, card_network: tok.network, card_last4: tok.last4,
                     card_expiry_month: tok.expiry_month, card_expiry_year: tok.expiry_year };
          } else {
            const tok = await App.gatewaySdk.tokenizeUpi(f.vpa.value.trim());
            if (!tok.ok) { err.textContent = tok.message; err.hidden = false; return; }
            body = { gateway_token: tok.token };
          }
          const r = await api.call("payments.pay", { params: { payment_id: checkout.payment_id }, body });
          if (!r.success) { err.textContent = `${r.error.message}. Try another ${isCard ? "card" : "UPI ID"}.`; err.hidden = false; return; }
          ctx.closeModal();
          ctx.toast(`Paid with ${r.data.receipt}. Order placed!`);
          track(r.data.order_id);
        });
      },
    });
  }

  function track(orderId) { Object.assign(S, { view: "track", orderId }); ctx.refresh(true); }

  // ---------------- actions ----------------
  const actions = {
    go(btn) { S.view = btn.dataset.view; ctx.refresh(true); },
    address(sel) { S.addressId = Number(sel.value); ctx.refresh(true); },
    "open-rest"(btn) { Object.assign(S, { view: "menu", rid: Number(btn.dataset.rid) }); ctx.refresh(true); },
    track(btn) { track(Number(btn.dataset.id)); },

    searchFilter(input) {
      S.searchQuery = input.value;
      ctx.refresh();
    },
    clearSearch() {
      S.searchQuery = "";
      ctx.refresh();
    },
    selectCat(btn) {
      S.activeCategory = btn.dataset.cat;
      ctx.refresh();
    },
    applyCoupon(btn) {
      const code = btn.dataset.code;
      const inp = ctx.root.querySelector("#c-coupon");
      if (inp) {
        inp.value = code;
        ctx.toast(`Coupon code ${code} applied!`);
      }
    },

    async add(btn) {
      const id = Number(btn.dataset.item);
      const addon_ids = [...ctx.root.querySelectorAll(`input[name="addon-${id}"]:checked`)].map((c) => Number(c.value)).sort((a, b) => a - b);
      const line = S.cart?.items.find((l) => l.item_id === id && JSON.stringify(l.selected_addons) === JSON.stringify(addon_ids));
      const body = { item_id: id, quantity: (line?.quantity || 0) + 1, addon_ids };
      const r = await api.call("cart.addItem", { body });
      if (!r.success && r.error.code === "CONFLICT" && /another restaurant/.test(r.error.message)) {
        return ctx.modal(`<h3>Start a new cart?</h3><p>Your cart has dishes from another restaurant. Adding this dish removes them.</p>
          <div class="row"><button class="btn primary" data-modal="yes">Start new cart</button><button class="btn" data-modal="no">Keep my cart</button></div>`, {
          async yes() { ctx.closeModal(); const d = await api.run("cart.addItem", { body: { ...body, quantity: 1, replace_cart: true } }, "Added to cart"); if (d) { S.cart = d; ctx.refresh(); } },
          no() { ctx.closeModal(); },
        });
      }
      if (!r.success) return ctx.toast(r.error.message, true, r.error.code);
      S.cart = r.data; ctx.toast("Added to cart"); ctx.refresh();
    },
    async qty(btn) {
      const line = S.cart.items.find((l) => l.cart_item_id === Number(btn.dataset.id));
      const q = line.quantity + Number(btn.dataset.d);
      const d = q < 1 ? await api.run("cart.removeItem", { params: { cart_item_id: line.cart_item_id } })
                      : await api.run("cart.addItem", { body: { item_id: line.item_id, quantity: q, addon_ids: line.selected_addons } });
      if (d) { S.cart = d; ctx.refresh(); }
    },

    async place(form) {
      const mode = form.mode.value;
      S.addressId = Number(form.address.value);
      const res = await api.run("orders.checkout", { body: {
        address_id: S.addressId, payment_mode: mode, coupon_code: form.coupon.value.trim() || null,
        special_instructions: form.note.value.trim() || null,
        idempotency_key: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()) } });
      if (!res) return;
      S.cart = { items: [], item_total: 0 };
      if (res.order_status === "PLACED") { ctx.toast(`Order #${res.order_id} placed. Pay cash on delivery.`); return track(res.order_id); }
      payModal(res, mode);
    },

    repay() { const o = S.order; payModal({ order_id: o.order_id, payment_id: o.payment.payment_id, bill: { total: o.total_amount } }, o.payment.method_type); },
    cancel() {
      const o = S.order;
      ctx.modal(`<h3>Cancel order #${o.order_id}?</h3><p>If you paid online, the full amount is refunded automatically.</p>
        <div class="row"><button class="btn danger" data-modal="yes">Cancel order</button><button class="btn" data-modal="no">Keep it</button></div>`, {
        async yes() {
          ctx.closeModal();
          const r = await api.run("orders.cancel", { params: { order_id: o.order_id }, body: { reason: "Changed my mind" } });
          if (r) { ctx.toast(r.refund ? `Cancelled. ${rupees(r.refund.amount)} refunded.` : "Order cancelled"); ctx.refresh(true); }
        },
        no() { ctx.closeModal(); },
      });
    },
    rate() {
      const o = S.order;
      const stars = (id) => `<select id="${id}" name="${id}">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select>`;
      ctx.modal(`<h3>How was order #${o.order_id}?</h3>
        <form class="stack" data-modal-submit="send">
          <label class="field" for="r-food">Food${stars("r-food")}</label>
          <label class="field" for="r-del">Delivery${stars("r-del")}</label>
          <label class="field" for="r-c">Comment<input id="r-c" name="c" type="text" placeholder="Hot and tasty"></label>
          <button class="btn primary" type="submit">Send rating</button>
        </form>`, {
        async send(f) {
          const r = await api.run("orders.rate", { params: { order_id: o.order_id },
            body: { food_rating: Number(f["r-food"].value), delivery_rating: Number(f["r-del"].value), comment: f.c.value || null } }, "Thanks for rating!");
          if (r) ctx.closeModal();
        },
      });
    },
  };

  return {
    load, render, actions,
    poll: () => S.view === "orders" || (S.view === "track" && S.order && !FINAL.includes(S.order.status)),
  };
};
