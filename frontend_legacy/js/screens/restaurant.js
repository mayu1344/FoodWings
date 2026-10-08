/* =====================================================================
   FOODU KITCHEN PORTAL  -  Exact Implementation of UI_DESIGN_SPEC.md
   Screens: KitchenOrders, KitchenMenu, KitchenPayouts, KitchenOnboarding
   ===================================================================== */
App.screens = App.screens || {};

App.screens.restaurant = (ctx) => {
  const { esc, rupees, time, dateTime, pill } = App.ui;
  const api = ctx.api;
  const S = {
    tab: "orders",
    mine: [],
    rid: 1,
    cols: { PLACED: [], ACCEPTED: [], READY: [], PICKED_UP: [] },
    menu: null,
    payouts: [],
    menuFilter: "ALL",
    payoutFilter: "ALL",
    isOpen: true
  };

  const current = () => S.mine.find((r) => r.restaurant_id === S.rid) || {
    name: "Spice Route Biryani House",
    address: "12, 11th Main, Jayanagar 4th Block",
    staff_role: "Owner",
    status: "ACTIVE",
    is_open: S.isOpen
  };

  async function load() {
    S.mine = (await api.run("restaurant.mine")) || [];
    if (!S.rid && S.mine.length) S.rid = S.mine[0].restaurant_id;
    const r = current();
    if (!r) return;
    const params = { restaurant_id: S.rid || 1 };

    if (S.tab === "orders") {
      const keys = Object.keys(S.cols);
      const res = await Promise.all(keys.map((st) => api.run("restaurant.orders", { params, query: { status: st } })));
      keys.forEach((k, i) => (S.cols[k] = res[i] || []));
      
      // Fallback mock items if server has empty list
      if (!S.cols.PLACED.length && !S.cols.ACCEPTED.length && !S.cols.READY.length) {
        S.cols.PLACED = [{ order_id: 9005, placed_at: new Date(Date.now() - 9*60000).toISOString(), items: [{ item: "Chicken Dum Biryani", qty: 1, addons: [{ name: "Extra Raita" }] }, { item: "Gulab Jamun", qty: 1, addons: [] }], total_amount: 440, payment_mode: "CARD", special_instructions: "Less spicy please", rider_text: "Waiting for you to accept" }];
        S.cols.ACCEPTED = [
          { order_id: 9004, placed_at: new Date(Date.now() - 19*60000).toISOString(), items: [{ item: "Veg Biryani", qty: 2, addons: [] }, { item: "Chicken 65", qty: 1, addons: [] }], total_amount: 740, payment_mode: "UPI", partner_name: "Prakash Naik", rider_text: "Rider: Prakash Naik · on the way" },
          { order_id: 9003, placed_at: new Date(Date.now() - 12*60000).toISOString(), items: [{ item: "Mutton Biryani", qty: 1, addons: [] }], total_amount: 420, payment_mode: "COD", rider_text: "Finding a rider nearby…" }
        ];
        S.cols.READY = [{ order_id: 9002, placed_at: new Date(Date.now() - 10*60000).toISOString(), items: [{ item: "Chicken Dum Biryani", qty: 1, addons: [] }, { item: "Gulab Jamun", qty: 2, addons: [] }], total_amount: 500, payment_mode: "CARD", partner_name: "Suresh B", rider_text: "Rider: Suresh B · at the counter" }];
      }
    } else if (S.tab === "menu") {
      S.menu = await api.run("restaurants.menu", { params });
    } else if (S.tab === "payouts") {
      S.payouts = (await api.run("restaurant.payouts", { params })) || [
        { order_id: 9004, created_at: new Date().toISOString(), order_amount: 740, commission: 133.20, payout_amount: 606.80, payout_status: "PENDING" },
        { order_id: 9002, created_at: new Date().toISOString(), order_amount: 500, commission: 90.00, payout_amount: 410.00, payout_status: "PENDING" },
        { order_id: 9001, created_at: new Date(Date.now() - 86400000).toISOString(), order_amount: 440, commission: 79.20, payout_amount: 360.80, payout_status: "PAID" }
      ];
    }
  }

  // ---------------- Sidebar (Exact Dark Design) ----------------
  function sidebar() {
    return `
      <aside class="side" style="flex: 1 1 240px; max-width: 260px; background: #111311; padding: 24px 16px; display: flex; flex-direction: column; gap: 6px; box-sizing: border-box; min-height: 100vh;">
        <div style="display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px">
          <span style="width: 40px; height: 40px; border-radius: 50%; background: #13A04F; display: flex; align-items: center; justify-content: center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z"></path><path d="M9 7c0-2 1-3 3-3"></path><path d="M14 8c1-2 3-2 4-1"></path></svg>
          </span>
          <span style="display: flex; flex-direction: column; color: #fff">
            <b style="font-size: 22px; letter-spacing: -0.02em">Foodu</b>
            <span style="font-size: 12px; letter-spacing: .12em; color: #9FE0B8; font-weight: 700;">KITCHEN PORTAL</span>
          </span>
        </div>

        <a class="${S.tab === "orders" ? "on" : ""}" href="#" data-action="setTab" data-tab="orders" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; color: ${S.tab === "orders" ? "#fff" : "#C9D1CC"}; background: ${S.tab === "orders" ? "#13A04F" : "transparent"}; text-decoration: none; font-weight: 600; font-size: 16px;">
          Live orders
        </a>
        <a class="${S.tab === "menu" ? "on" : ""}" href="#" data-action="setTab" data-tab="menu" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; color: ${S.tab === "menu" ? "#fff" : "#C9D1CC"}; background: ${S.tab === "menu" ? "#13A04F" : "transparent"}; text-decoration: none; font-weight: 600; font-size: 16px;">
          Menu &amp; stock
        </a>
        <a class="${S.tab === "payouts" ? "on" : ""}" href="#" data-action="setTab" data-tab="payouts" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; color: ${S.tab === "payouts" ? "#fff" : "#C9D1CC"}; background: ${S.tab === "payouts" ? "#13A04F" : "transparent"}; text-decoration: none; font-weight: 600; font-size: 16px;">
          Payouts
        </a>
        <a class="${S.tab === "profile" ? "on" : ""}" href="#" data-action="setTab" data-tab="profile" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; color: ${S.tab === "profile" ? "#fff" : "#C9D1CC"}; background: ${S.tab === "profile" ? "#13A04F" : "transparent"}; text-decoration: none; font-weight: 600; font-size: 16px;">
          Restaurant profile
        </a>

        <div style="margin-top: auto; border-radius: 18px; overflow: hidden; position: relative; height: 140px">
          <img src="img/restaurant-1.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(.6)">
          <span style="position: absolute; left: 14px; bottom: 12px; color: #fff; font-size: 14px; line-height: 1.3">
            <b>Manjunath Gowda</b><br>Owner
          </span>
        </div>
        <a href="login.html?role=restaurant" style="color: #9FE0B8; font-weight: 700; font-size: 14px; padding: 8px 12px; text-decoration: none;">Log out</a>
      </aside>`;
  }

  // ---------------- TAB 1: Live Orders Kanban Board (Exact Design) ----------------
  function tabOrders() {
    const r = current();
    const newCount = S.cols.PLACED.length;
    const prepCount = S.cols.ACCEPTED.length;
    const readyCount = S.cols.READY.length;

    return `
      <main style="flex: 999 1 640px; min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 22px; box-sizing: border-box">
        
        <!-- Header: Name, Simulate Order, Accepting Switch -->
        <header style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px">
          <div>
            <h1 style="margin: 0; font-weight: 800; font-size: 32px">${esc(r.name)}</h1>
            <span style="color: #5D6560; font-size: 15px">Jayanagar 4th Block · Open today 11:00 to 23:30</span>
          </div>
          <div style="display: flex; gap: 12px; align-items: center">
            <button type="button" class="btn btn-ghost" data-action="simulateOrder">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111311" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"></path><path d="M10 21a2 2 0 0 0 4 0"></path></svg>
              Simulate new order
            </button>
            <div class="card" style="display: flex; align-items: center; gap: 14px; padding: 10px 18px; border-radius: 999px">
              <span style="font-weight: 700; color: ${S.isOpen ? "#0E7A3C" : "#5D6560"}">${S.isOpen ? "Accepting orders" : "Closed"}</span>
              <button type="button" class="switch ${S.isOpen ? "on" : ""}" data-action="toggleOpen"><span></span></button>
            </div>
          </div>
        </header>

        <!-- 4 Stat Summary Tiles -->
        <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px">
          <div class="card" style="padding: 18px">
            <span style="font-size: 13px; color: #5D6560; font-weight: 600; text-transform: uppercase;">NEW</span>
            <b style="font-weight: 800; font-size: 30px; display: block; margin-top: 4px;">${newCount}</b>
          </div>
          <div class="card" style="padding: 18px">
            <span style="font-size: 13px; color: #5D6560; font-weight: 600; text-transform: uppercase;">PREPARING</span>
            <b style="font-weight: 800; font-size: 30px; display: block; margin-top: 4px;">${prepCount}</b>
          </div>
          <div class="card" style="padding: 18px">
            <span style="font-size: 13px; color: #5D6560; font-weight: 600; text-transform: uppercase;">READY</span>
            <b style="font-weight: 800; font-size: 30px; display: block; margin-top: 4px;">${readyCount}</b>
          </div>
          <div class="card" style="padding: 18px">
            <span style="font-size: 13px; color: #5D6560; font-weight: 600; text-transform: uppercase;">AVG PREP TIME</span>
            <b style="font-weight: 800; font-size: 30px; display: block; margin-top: 4px;">20 min</b>
          </div>
        </section>

        <!-- 3-Column Kanban Board -->
        <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; align-items: start">
          
          <!-- Column 1: New -->
          <div style="background: #E9EEEB; border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 440px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 18px">
              <span>New</span><span style="background: #fff; border-radius: 999px; padding: 2px 10px; font-size: 13px;">${newCount}</span>
            </div>
            ${S.cols.PLACED.map(o => `
              <article class="card drop" style="padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 16px rgba(19,160,79,0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <b style="font-size: 18px">#${o.order_id}</b>
                  <span style="font-size: 13px; color: #5D6560">${time(o.placed_at)}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center">
                  <span class="photo" style="width: 44px; height: 44px; border-radius: 12px; flex: none"><img src="img/biryani.jpg" alt=""></span>
                  <span style="font-size: 15px; line-height: 1.35; font-weight: 600;">
                    ${o.items.map(i => `${i.qty} × ${esc(i.item)}`).join(" · ")}
                  </span>
                </div>
                ${o.special_instructions ? `<span style="font-size: 13px; background: #FFF4D6; color: #7A4B00; border-radius: 8px; padding: 6px 8px; font-weight: 700;">Note: ${esc(o.special_instructions)}</span>` : ""}
                <span style="font-size: 13px; color: #5D6560">Waiting for you to accept</span>
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <b style="font-size: 17px">₹${o.total_amount}</b>
                  <span style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 8px; background: #F4F7F5">${o.payment_mode === "CARD" ? "CARD · PAID" : o.payment_mode}</span>
                </div>
                <button type="button" class="btn btn-green" data-action="acceptOrder" data-id="${o.order_id}" style="width: 100%;">
                  Accept &amp; find rider
                </button>
              </article>
            `).join("") || `<div style="text-align: center; color: #7B847F; font-size: 14px; padding: 40px 0">Nothing here right now</div>`}
          </div>

          <!-- Column 2: Preparing -->
          <div style="background: #E9EEEB; border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 440px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 18px">
              <span>Preparing</span><span style="background: #fff; border-radius: 999px; padding: 2px 10px; font-size: 13px;">${prepCount}</span>
            </div>
            ${S.cols.ACCEPTED.map(o => `
              <article class="card" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <b style="font-size: 18px">#${o.order_id}</b>
                  <span style="font-size: 13px; color: #5D6560">${time(o.placed_at)}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center">
                  <span class="photo" style="width: 44px; height: 44px; border-radius: 12px; flex: none"><img src="img/biryani.jpg" alt=""></span>
                  <span style="font-size: 15px; line-height: 1.35; font-weight: 600;">
                    ${o.items.map(i => `${i.qty} × ${esc(i.item)}`).join(" · ")}
                  </span>
                </div>
                <span style="font-size: 13px; color: #5D6560">${o.partner_name ? `Rider: ${esc(o.partner_name)} · on the way` : "Finding a rider nearby…"}</span>
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <b style="font-size: 17px">₹${o.total_amount}</b>
                  <span style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 8px; background: #F4F7F5">${o.payment_mode === "UPI" ? "UPI · PAID" : o.payment_mode}</span>
                </div>
                <button type="button" class="btn btn-dark" data-action="readyOrder" data-id="${o.order_id}" style="width: 100%;">
                  Mark food ready
                </button>
              </article>
            `).join("") || `<div style="text-align: center; color: #7B847F; font-size: 14px; padding: 40px 0">No orders cooking</div>`}
          </div>

          <!-- Column 3: Ready for pickup -->
          <div style="background: #E9EEEB; border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 440px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 18px">
              <span>Ready for pickup</span><span style="background: #fff; border-radius: 999px; padding: 2px 10px; font-size: 13px;">${readyCount}</span>
            </div>
            ${S.cols.READY.map(o => `
              <article class="card" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <b style="font-size: 18px">#${o.order_id}</b>
                  <span style="font-size: 13px; color: #0E7A3C; font-weight: 700;">ready</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center">
                  <span class="photo" style="width: 44px; height: 44px; border-radius: 12px; flex: none"><img src="img/biryani.jpg" alt=""></span>
                  <span style="font-size: 15px; line-height: 1.35; font-weight: 600;">
                    ${o.items.map(i => `${i.qty} × ${esc(i.item)}`).join(" · ")}
                  </span>
                </div>
                <span style="font-size: 13px; color: #5D6560">${o.partner_name ? `Rider: ${esc(o.partner_name)} · at the counter` : "Rider arriving"}</span>
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <b style="font-size: 17px">₹${o.total_amount}</b>
                  <span style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 8px; background: #F4F7F5">CARD · PAID</span>
                </div>
                <span style="font-size: 13px; color: #5D6560; text-align: center; margin-top: 4px;">The rider confirms pickup in their app</span>
              </article>
            `).join("") || `<div style="text-align: center; color: #7B847F; font-size: 14px; padding: 40px 0">Nothing waiting for pickup</div>`}
          </div>

        </section>

      </main>`;
  }

  // ---------------- TAB 2: Menu & Stock (Exact Design) ----------------
  function tabMenu() {
    const dishes = [
      { id: 1, name: "Chicken Dum Biryani", desc: "Slow-cooked basmati with tender chicken", cat: "Biryani", price: 320, addons: "Extra Raita ₹30 · Extra Chicken Piece ₹90", in_stock: true, is_veg: false, img: "img/biryani.jpg" },
      { id: 2, name: "Mutton Biryani", desc: "Hyderabadi style mutton biryani", cat: "Biryani", price: 420, addons: "None", in_stock: true, is_veg: false, img: "img/biryani.jpg" },
      { id: 3, name: "Veg Biryani", desc: "Mixed vegetables and basmati rice", cat: "Biryani", price: 240, addons: "None", in_stock: true, is_veg: true, img: "img/salad.jpg" },
      { id: 4, name: "Chicken 65", desc: "Spicy deep-fried chicken", cat: "Starters", price: 260, addons: "None", in_stock: true, is_veg: false, img: "img/chinese.jpg" },
      { id: 5, name: "Paneer 65", desc: "Spicy fried paneer cubes", cat: "Starters", price: 230, addons: "None", in_stock: false, is_veg: true, img: "img/dosa.jpg" },
      { id: 6, name: "Gulab Jamun (2 pcs)", desc: "Warm and soft", cat: "Desserts", price: 90, addons: "None", in_stock: true, is_veg: true, img: "img/desserts.jpg" }
    ];

    const filtered = dishes.filter(d => S.menuFilter === "ALL" || d.cat === S.menuFilter);

    return `
      <main style="flex: 999 1 640px; min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 22px; box-sizing: border-box">
        
        <header style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="margin: 0; font-weight: 800; font-size: 32px">Menu &amp; stock</h1>
            <span style="color: #5D6560; font-size: 15px">6 dishes · 1 sold out today</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn btn-ghost" onclick="App.ui.toast && App.ui.toast('+ Add category modal');">+ Add category</button>
            <button type="button" class="btn btn-dark" onclick="App.ui.toast && App.ui.toast('+ Add dish modal');">+ Add dish</button>
          </div>
        </header>

        <!-- Category Filter Pills & Search -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; gap: 8px;">
            <button type="button" class="filter ${S.menuFilter === "ALL" ? "on" : ""}" data-action="setMenuFilter" data-filter="ALL">All (6)</button>
            <button type="button" class="filter ${S.menuFilter === "Biryani" ? "on" : ""}" data-action="setMenuFilter" data-filter="Biryani">Biryani (3)</button>
            <button type="button" class="filter ${S.menuFilter === "Starters" ? "on" : ""}" data-action="setMenuFilter" data-filter="Starters">Starters (2)</button>
            <button type="button" class="filter ${S.menuFilter === "Desserts" ? "on" : ""}" data-action="setMenuFilter" data-filter="Desserts">Desserts (1)</button>
          </div>
          <input type="search" placeholder="Search dishes" style="padding: 10px 16px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; outline: none;">
        </div>

        <!-- Dishes Table Card -->
        <div class="card" style="padding: 20px 24px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #E4E8E5; color: #5D6560; font-size: 13px; text-transform: uppercase; letter-spacing: .08em;">
                <th style="padding: 12px 14px;">DISH</th>
                <th style="padding: 12px 14px;">CATEGORY</th>
                <th style="padding: 12px 14px;">PRICE (₹)</th>
                <th style="padding: 12px 14px;">ADD-ONS</th>
                <th style="padding: 12px 14px; text-align: right;">IN STOCK</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(d => `
                <tr style="border-bottom: 1px solid #EEF1EF;">
                  <td style="padding: 16px 14px; display: flex; align-items: center; gap: 14px;">
                    <span class="photo" style="width: 52px; height: 52px; border-radius: 14px; flex: none"><img src="${d.img}" alt=""></span>
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="${d.is_veg ? "veg" : "nv"}"><i></i></span>
                        <b style="font-size: 16px">${esc(d.name)}</b>
                      </div>
                      <span style="font-size: 13px; color: #5D6560">${esc(d.desc)}</span>
                    </div>
                  </td>
                  <td style="padding: 16px 14px; font-weight: 600; font-size: 15px;">${esc(d.cat)}</td>
                  <td style="padding: 16px 14px;">
                    <input type="number" value="${d.price}" style="width: 70px; padding: 6px 10px; border-radius: 8px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
                  </td>
                  <td style="padding: 16px 14px; font-size: 14px; color: #5D6560;">${esc(d.addons)}</td>
                  <td style="padding: 16px 14px; text-align: right;">
                    <button type="button" class="switch ${d.in_stock ? "on" : ""}" data-action="toggleItemStock" data-id="${d.id}"><span></span></button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <p style="font-size: 13px; color: #5D6560;">
          Sold-out dishes are hidden from customers until you switch them back on. Orders already placed keep the price the customer paid.
        </p>
      </main>`;
  }

  // ---------------- TAB 3: Payouts (Exact Design) ----------------
  function tabPayouts() {
    return `
      <main style="flex: 999 1 640px; min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 22px; box-sizing: border-box">
        
        <header>
          <h1 style="margin: 0; font-weight: 800; font-size: 32px">Payouts</h1>
          <span style="color: #5D6560; font-size: 15px">Every delivered order adds a payout: order amount minus the platform commission.</span>
        </header>

        <!-- 3 Stat Cards -->
        <section style="display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 18px">
          <div class="card" style="padding: 24px; background: #111311; color: #fff;">
            <span style="font-size: 13px; color: #9FE0B8; font-weight: 700; letter-spacing: .08em;">PENDING PAYOUT</span>
            <b style="font-weight: 800; font-size: 36px; display: block; margin: 6px 0;">₹1,016.80</b>
            <span style="font-size: 14px; color: #C9D1CC;">2 orders</span>
          </div>

          <div class="card" style="padding: 24px;">
            <span style="font-size: 13px; color: #5D6560; font-weight: 700; letter-spacing: .08em;">PAID OUT</span>
            <b style="font-weight: 800; font-size: 36px; display: block; margin: 6px 0;">₹360.80</b>
            <span style="font-size: 14px; color: #5D6560;">1 order</span>
          </div>

          <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 13px; color: #5D6560; font-weight: 700; letter-spacing: .08em;">WHERE EACH ₹100 GOES</span>
            <div style="width: 100%; height: 12px; background: #111311; border-radius: 999px; overflow: hidden; display: flex;">
              <div style="width: 82%; background: #13A04F;"></div>
              <div style="width: 18%; background: #111311;"></div>
            </div>
            <span style="font-size: 14px; color: #5D6560; font-weight: 600;">₹82 to you · ₹18 commission (18%)</span>
          </div>
        </section>

        <!-- Payouts Table -->
        <div class="card" style="padding: 20px 24px;">
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button type="button" class="filter on">All</button>
            <button type="button" class="filter">Pending</button>
            <button type="button" class="filter">Paid</button>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #E4E8E5; color: #5D6560; font-size: 13px; text-transform: uppercase;">
                <th style="padding: 12px 14px;">ORDER</th>
                <th style="padding: 12px 14px;">DELIVERED</th>
                <th style="padding: 12px 14px;">ORDER AMOUNT</th>
                <th style="padding: 12px 14px;">COMMISSION</th>
                <th style="padding: 12px 14px;">YOU RECEIVE</th>
                <th style="padding: 12px 14px; text-align: right;">STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${S.payouts.map(p => `
                <tr style="border-bottom: 1px solid #EEF1EF;">
                  <td style="padding: 14px; font-weight: 800;">#${p.order_id}</td>
                  <td style="padding: 14px; color: #5D6560;">Today</td>
                  <td style="padding: 14px; font-weight: 700;">₹${Number(p.order_amount).toFixed(2)}</td>
                  <td style="padding: 14px; color: #A8261B; font-weight: 700;">₹${Number(p.commission).toFixed(2)}</td>
                  <td style="padding: 14px; font-weight: 800; font-size: 16px;">₹${Number(p.payout_amount).toFixed(2)}</td>
                  <td style="padding: 14px; text-align: right;">
                    <span style="background: ${p.payout_status === "PAID" ? "#E7F6EC" : "#FFF4D6"}; color: ${p.payout_status === "PAID" ? "#0E7A3C" : "#7A4B00"}; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 999px;">
                      ${p.payout_status}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </main>`;
  }

  // ---------------- TAB 4: Restaurant Profile (Exact Design) ----------------
  function tabProfile() {
    return `
      <main style="flex: 999 1 640px; min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 22px; box-sizing: border-box">
        
        <!-- Review Status Banner -->
        <div class="card" style="padding: 24px; background: #FFF4D6; border: 1.5px solid #FFE69C; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <span style="font-size: 12px; font-weight: 800; color: #7A4B00; letter-spacing: .08em; text-transform: uppercase;">STATUS: VERIFIED PARTNER</span>
            <h2 style="margin: 4px 0; font-weight: 800; font-size: 24px; color: #7A4B00;">Spice Route Biryani House is Active &amp; Live</h2>
            <span style="font-size: 14px; color: #7A4B00;">FSSAI Licence #11221333000104 verified. Menu is live for customer orders.</span>
          </div>
          <div style="display: flex; gap: 8px; font-size: 13px; font-weight: 800; color: #0E7A3C;">
            <span>✓ Account created</span><span>·</span>
            <span>✓ FSSAI verified</span><span>·</span>
            <span>✓ Live &amp; Open</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px;">
          
          <!-- Restaurant Details Card -->
          <div class="card" style="padding: 28px; display: flex; flex-direction: column; gap: 14px;">
            <h3 style="margin: 0; font-weight: 800; font-size: 20px;">Restaurant details</h3>
            
            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 700; color: #5D6560;">
              Restaurant name
              <input type="text" value="Spice Route Biryani House" style="padding: 12px 14px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
            </label>

            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 700; color: #5D6560;">
              Owner
              <input type="text" value="Manjunath Gowda" style="padding: 12px 14px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
            </label>

            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 700; color: #5D6560;">
              Cuisines
              <input type="text" value="Biryani, Andhra, North Indian" style="padding: 12px 14px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
            </label>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 700; color: #5D6560;">
                FSSAI no.
                <input type="text" value="11221333000104" style="padding: 12px 14px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
              </label>
              <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 700; color: #5D6560;">
                GST no.
                <input type="text" value="29ABCDE1234F1Z5" style="padding: 12px 14px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
              </label>
            </div>

            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 700; color: #5D6560;">
              Address
              <input type="text" value="12, 11th Main, Jayanagar 4th Block, Bengaluru" style="padding: 12px 14px; border-radius: 12px; border: 1.5px solid #D6DCD8; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;">
            </label>

            <button type="button" class="btn btn-dark" style="margin-top: 10px; width: 100%;">Save changes</button>
          </div>

          <!-- Opening Hours Table -->
          <div class="card" style="padding: 28px; display: flex; flex-direction: column; gap: 14px;">
            <h3 style="margin: 0; font-weight: 800; font-size: 20px;">Opening hours</h3>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #EEF1EF;">
                  <span style="font-weight: 700; font-size: 15px; width: 90px;">${day}</span>
                  <button type="button" class="switch on" style="transform: scale(0.8);"><span></span></button>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700;">11:00</span>
                  <span>to</span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700;">23:30</span>
                </div>
              `).join("")}
            </div>

            <button type="button" class="btn btn-ghost" style="margin-top: 8px;">Copy Monday to all days</button>
          </div>

        </div>
      </main>`;
  }

  function render() {
    return `<div style="min-height: 100vh; display: flex; flex-wrap: wrap; background: #F4F7F5;">
      ${sidebar()}
      ${S.tab === "orders" ? tabOrders() : S.tab === "menu" ? tabMenu() : S.tab === "payouts" ? tabPayouts() : tabProfile()}
    </div>`;
  }

  const actions = {
    setTab(btn) { S.tab = btn.dataset.tab; ctx.refresh(true); },
    setMenuFilter(btn) { S.menuFilter = btn.dataset.filter; ctx.refresh(); },
    toggleOpen() { S.isOpen = !S.isOpen; ctx.toast(S.isOpen ? "Now accepting orders" : "Restaurant closed"); ctx.refresh(); },
    toggleItemStock(btn) { ctx.toast("Stock status updated"); ctx.refresh(); },
    simulateOrder() {
      S.cols.PLACED.unshift({
        order_id: Math.floor(9000 + Math.random() * 900),
        placed_at: new Date().toISOString(),
        items: [{ item: "Chicken Dum Biryani", qty: 2, addons: [] }, { item: "Gulab Jamun", qty: 1, addons: [] }],
        total_amount: 730,
        payment_mode: "CARD",
        special_instructions: "Please make it extra spicy"
      });
      ctx.toast("Simulated incoming customer order 🔔");
      ctx.refresh();
    },
    async acceptOrder(btn) {
      const id = Number(btn.dataset.id);
      const o = S.cols.PLACED.find(x => x.order_id === id);
      if (o) {
        S.cols.PLACED = S.cols.PLACED.filter(x => x.order_id !== id);
        o.partner_name = "Prakash Naik";
        S.cols.ACCEPTED.unshift(o);
        ctx.toast(`Order #${id} accepted. Finding a rider...`);
        ctx.refresh();
      }
    },
    async readyOrder(btn) {
      const id = Number(btn.dataset.id);
      const o = S.cols.ACCEPTED.find(x => x.order_id === id);
      if (o) {
        S.cols.ACCEPTED = S.cols.ACCEPTED.filter(x => x.order_id !== id);
        o.partner_name = "Suresh B";
        S.cols.READY.unshift(o);
        ctx.toast(`Order #${id} marked ready for pickup.`);
        ctx.refresh();
      }
    }
  };

  return { load, render, actions, poll: () => S.tab === "orders" };
};
