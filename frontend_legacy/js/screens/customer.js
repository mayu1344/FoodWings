/* =====================================================================
   FOODU CUSTOMER APP  -  Exact Implementation of UI_DESIGN_SPEC.md
   Screens: CustomerHome, CustomerMenu, CustomerCheckout, CustomerTracking, CustomerOrders
   ===================================================================== */
App.screens = App.screens || {};

App.screens.customer = (ctx) => {
  const { esc, rupees, time, dateTime, pill } = App.ui;
  const api = ctx.api;
  const S = {
    view: "home",
    addresses: [],
    addressId: null,
    restaurants: [],
    rid: null,
    menu: null,
    cart: null,
    orders: [],
    orderId: null,
    order: null,
    searchQuery: "",
    activeFilter: "ALL",
    vegOnly: false,
    sortBy: "rel",
    bannerIndex: 0,
    favorites: {},
    couponCode: "FLAT75",
    couponApplied: true,
    paymentMode: "CARD",
    newCard: { number: "4111 1111 1111 1111", expiry: "12/30", cvv: "•••", name: "RAVI KUMAR" }
  };
  const FINAL = ["DELIVERED", "CANCELLED"];

  const cartCount = () => (S.cart?.items || []).reduce((n, l) => n + l.quantity, 0);
  const restName = (rid) => S.restaurants.find((r) => r.restaurant_id === rid)?.name || S.menu?.restaurant?.name || "Spice Route Biryani House";

  // ---------------- load ----------------
  async function load() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("cat")) S.activeFilter = urlParams.get("cat");
    if (urlParams.get("q")) S.searchQuery = urlParams.get("q");

    if (!S.addresses.length) {
      S.addresses = (await api.run("addresses.list")) || [
        { address_id: 1, label: "Home", address_line: "221, 9th Cross, Jayanagar 3rd Block · Near Cool Joint", is_default: true },
        { address_id: 2, label: "Work", address_line: "Prestige Tech Park, Koramangala · Gate 2", is_default: false }
      ];
      S.addressId = (S.addresses.find((a) => a.is_default) || S.addresses[0])?.address_id ?? 1;
    }
    if (S.view === "home") {
      S.restaurants = S.addressId ? (await api.run("restaurants.list", { query: { address_id: S.addressId } })) || [] : [];
      S.cart = await api.run("cart.get");
    } else if (S.view === "menu") {
      [S.menu, S.cart] = await Promise.all([api.run("restaurants.menu", { params: { restaurant_id: S.rid || 1 } }), api.run("cart.get")]);
    } else if (S.view === "cart") {
      S.cart = await api.run("cart.get");
      if (S.cart?.restaurant_id && !restName(S.cart.restaurant_id))
        S.restaurants = (await api.run("restaurants.list", { query: { address_id: S.addressId } })) || [];
    } else if (S.view === "orders") {
      S.orders = (await api.run("orders.mine")) || [];
    } else if (S.view === "track") {
      S.order = await api.run("orders.get", { params: { order_id: S.orderId || 9005 } });
    }
  }

  // ---------------- Top Sticky Green Header (Exact Design) ----------------
  function topHeader() {
    const n = cartCount();
    const currentAddr = S.addresses.find((a) => a.address_id === S.addressId) || S.addresses[0];
    const addrLabel = currentAddr ? `${currentAddr.label} · ${currentAddr.address_line.split('·')[0].trim()}` : "Home · Jayanagar 3rd Block";

    return `
      <header class="top" style="background: #13A04F; padding: 16px 24px; position: sticky; top: 0; z-index: 100; box-shadow: 0 6px 20px rgba(0,0,0,.08)">
        <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 20px; justify-content: space-between">
          <a href="#" data-action="go" data-view="home" style="display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none">
            <span style="width: 44px; height: 44px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#13A04F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z"></path><path d="M9 7c0-2 1-3 3-3"></path><path d="M14 8c1-2 3-2 4-1"></path></svg>
            </span>
            <span style="font-weight: 800; font-size: 28px; letter-spacing: -0.02em">Foodu</span>
          </a>

          <form style="flex: 1 1 480px; max-width: 600px; display: flex; flex-wrap: wrap; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.06);" onsubmit="event.preventDefault();">
            <label style="display: flex; align-items: center; gap: 8px; padding: 0 14px; min-height: 50px; border-right: 1px solid #E4E8E5; cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D6336C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
              <select data-action="changeAddress" style="border: 0; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; background: transparent; color: #111311; outline: none; cursor: pointer;">
                ${S.addresses.map(a => `<option value="${a.address_id}" ${a.address_id === S.addressId ? "selected" : ""}>${esc(a.label)} · ${esc(a.address_line.split('·')[0].trim())}</option>`).join("")}
              </select>
            </label>
            <label style="display: flex; align-items: center; gap: 10px; padding: 0 16px; flex: 1; min-height: 50px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D6560" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
              <input type="search" placeholder="Search for biryani, dosa, pizza…" value="${esc(S.searchQuery)}" data-change="searchFilter" style="border: 0; flex: 1; font-family: 'Outfit', sans-serif; font-size: 15px; outline: none; background: transparent;">
            </label>
          </form>

          <nav style="display: flex; align-items: center; gap: 20px">
            <a href="#" data-action="go" data-view="orders" style="color: #fff; text-decoration: none; font-weight: 600; font-size: 16px;">My orders</a>
            <button type="button" class="btn btn-dark" data-action="go" data-view="cart" style="gap:8px;padding:0 20px;min-height:46px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14l-1.5 9h-11z"></path><path d="M9 7V5a3 3 0 0 1 6 0v2"></path></svg>
              Cart · ${n}
            </button>
            <span style="width: 44px; height: 44px; border-radius: 50%; background: #FFD7A8; color: #6B3A00; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 16px;">RK</span>
          </nav>
        </div>
      </header>`;
  }

  // ---------------- SCREEN 1: CustomerHome (Exact Layout) ----------------
  function viewHome() {
    const q = (S.searchQuery || "").toLowerCase();
    const filter = S.activeFilter || "ALL";

    let filtered = S.restaurants.filter((r) => {
      const matchQ = !q || r.name.toLowerCase().includes(q) || (r.cuisines || "").toLowerCase().includes(q);
      let matchFilter = true;
      if (filter === "Biryani") matchFilter = (r.cuisines || "").toLowerCase().includes("biryani");
      else if (filter === "South Indian") matchFilter = (r.cuisines || "").toLowerCase().includes("south indian") || (r.name || "").toLowerCase().includes("udupi");
      else if (filter === "Pizza") matchFilter = (r.cuisines || "").toLowerCase().includes("pizza");
      else if (filter === "North Indian") matchFilter = (r.cuisines || "").toLowerCase().includes("north indian");
      else if (filter === "Pure veg") matchFilter = (r.cuisines || "").toLowerCase().includes("veg") || (r.name || "").toLowerCase().includes("veg");
      else if (filter === "Rating 4.5+") matchFilter = Number(r.avg_rating || 0) >= 4.5;
      else if (filter === "Under 30 min") matchFilter = Number(r.eta_mins || 30) <= 30;
      return matchQ && matchFilter;
    });

    if (S.sortBy === "rating") filtered.sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating));
    else if (S.sortBy === "eta") filtered.sort((a, b) => Number(a.eta_mins) - Number(b.eta_mins));
    else if (S.sortBy === "km") filtered.sort((a, b) => Number(a.distance_km) - Number(b.distance_km));

    const filterList = [
      "Biryani", "South Indian", "Pizza", "North Indian", "Pure veg", "Rating 4.5+", "Under 30 min"
    ];

    const currentAddr = S.addresses.find((a) => a.address_id === S.addressId) || S.addresses[0];
    const addrText = currentAddr ? `${currentAddr.label} · ${currentAddr.address_line.split('·')[0].trim()}` : "Home · Jayanagar 3rd Block";

    return `
      ${topHeader()}
      <main style="max-width: 1280px; margin: 0 auto; padding: 32px 24px 56px; display: flex; flex-direction: column; gap: 32px">
        
        <!-- Top Offer Banner + Last Order Card -->
        <section style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px">
          <div class="card offer" style="min-height: 200px; position: relative; overflow: hidden; background: #111311; color: #fff; border-radius: 24px;">
            <div class="photo" style="position: absolute; inset: 0 0 0 45%; background: #111311">
              <img src="img/dosa.jpg" alt="Dosa specials" style="opacity: .85; width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="position: absolute; inset: 0; background: linear-gradient(90deg, #111311 40%, rgba(17,19,17,0) 75%)"></div>
            <div style="position: relative; padding: 30px; display: flex; flex-direction: column; gap: 8px; max-width: 60%">
              <span style="font-weight: 700; font-size: 13px; letter-spacing: .14em; color: #9FE0B8">SOUTH INDIAN SPECIALS</span>
              <span style="font-weight: 800; font-size: 34px; line-height: 1.1">Crispy dosas from ₹70</span>
              <span style="font-size: 15px; color: #C9D1CC">Udupi Grand Veg · Basavanagudi</span>
              <div class="dots" style="display: flex; gap: 6px; margin-top: 14px">
                <button type="button" style="width:28px;height:10px;border-radius:999px;border:0;background:#13A04F;padding:0;"></button>
                <button type="button" style="width:10px;height:10px;border-radius:999px;border:0;background:#C9D1CC;padding:0;"></button>
                <button type="button" style="width:10px;height:10px;border-radius:999px;border:0;background:#C9D1CC;padding:0;"></button>
              </div>
            </div>
          </div>

          <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 10px; justify-content: space-between;">
            <div>
              <span style="font-weight: 600; font-size: 13px; letter-spacing: .12em; color: #5D6560">YOUR LAST ORDER</span>
              <div style="display: flex; gap: 14px; align-items: center; margin-top: 8px;">
                <span class="photo" style="width: 68px; height: 68px; border-radius: 16px; flex: none"><img src="img/biryani.jpg" alt=""></span>
                <span style="display: flex; flex-direction: column; gap: 2px">
                  <b style="font-size: 17px">Spice Route Biryani House</b>
                  <span style="font-size: 14px; color: #5D6560">Chicken Dum Biryani, Gulab Jamun · ₹497</span>
                </span>
              </div>
            </div>
            <button type="button" class="btn btn-ghost" data-action="open-rest" data-rid="1" style="align-self: flex-start; min-height: 40px">Order again</button>
          </div>
        </section>

        <!-- Restaurants Near You Section -->
        <section style="display: flex; flex-direction: column; gap: 18px">
          <div style="display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px">
            <div>
              <h1 style="margin: 0; font-weight: 800; font-size: 36px; letter-spacing: -0.02em">Restaurants near you</h1>
              <p style="margin: 4px 0 0; color: #5D6560; font-size: 16px">${filtered.length} open now, within 7 km of ${esc(addrText)}</p>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px">Sort by
              <select data-change="changeSort" style="min-height: 44px; border-radius: 12px; border: 1.5px solid #D6DCD8; padding: 0 12px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; background: #fff; outline: none; cursor: pointer;">
                <option value="rel" ${S.sortBy === "rel" ? "selected" : ""}>Relevance</option>
                <option value="rating" ${S.sortBy === "rating" ? "selected" : ""}>Rating</option>
                <option value="eta" ${S.sortBy === "eta" ? "selected" : ""}>Delivery time</option>
                <option value="km" ${S.sortBy === "km" ? "selected" : ""}>Distance</option>
              </select>
            </label>
          </div>

          <!-- Filter Pills -->
          <div style="display: flex; flex-wrap: wrap; gap: 10px">
            ${filterList.map(f => `
              <button type="button" class="filter ${S.activeFilter === f ? "on" : ""}" data-action="toggleFilter" data-filter="${f}">
                ${f}
              </button>
            `).join("")}
          </div>

          <!-- Restaurants 3-Column Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px">
            ${filtered.map((r, idx) => {
              const rImgs = ["img/biryani.jpg", "img/dosa.jpg", "img/pizza.jpg", "img/restaurant-1.jpg", "img/restaurant-2.jpg"];
              const rOffers = ["FLAT ₹75 OFF", "50% OFF UP TO ₹100", "FLAT ₹75 OFF", "30% OFF UPTO ₹75", "FREE DELIVERY"];
              const imgUrl = r.image_url || rImgs[idx % rImgs.length];
              const offerTag = rOffers[idx % rOffers.length];
              const isFav = S.favorites[r.restaurant_id];

              return `
                <div class="card rest fadeUp" style="position: relative; animation-delay: ${idx * 0.08}s; cursor: pointer;" data-action="open-rest" data-rid="${r.restaurant_id}">
                  <button type="button" class="fav ${isFav ? "on" : ""}" aria-label="Favorite" onclick="event.stopPropagation();" data-action="toggleFav" data-rid="${r.restaurant_id}" style="position: absolute; right: 14px; top: 14px; width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,.92); display: flex; align-items: center; justify-content: center; z-index: 2; cursor: pointer;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="${isFav ? "#D6336C" : "none"}" stroke="#D6336C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg>
                  </button>
                  <div class="photo" style="height: 200px; border-radius: 24px 24px 0 0; position: relative;">
                    <img src="${imgUrl}" alt="${esc(r.name)}">
                    <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%)"></div>
                    <span style="position: absolute; left: 16px; bottom: 14px; color: #fff; font-weight: 800; font-size: 20px; letter-spacing: .02em">${offerTag}</span>
                  </div>
                  <div style="padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 6px">
                    <div style="display: flex; justify-content: space-between; align-items: center">
                      <b style="font-size: 22px; letter-spacing: -0.01em">${esc(r.name)}</b>
                      <span style="background: #13A04F; color: #fff; font-weight: 800; font-size: 14px; padding: 4px 9px; border-radius: 8px">★ ${r.avg_rating || "4.4"}</span>
                    </div>
                    <span style="font-size: 15px; color: #5D6560">${esc(r.cuisines || "Multi-Cuisine")}</span>
                    <div style="display: flex; gap: 8px; font-size: 14px; color: #5D6560; margin-top: 4px; font-weight: 600">
                      <span>${r.eta_mins || 27} min</span><span>·</span>
                      <span>${r.distance_km || 0.5} km</span><span>·</span>
                      <span>${esc(r.address ? r.address.split(',')[0] : "Jayanagar")}</span>
                    </div>
                  </div>
                </div>`;
            }).join("") || `
              <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #fff; border-radius: 24px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
                <h3>No restaurants found</h3>
                <p style="color: #5D6560; margin-top: 6px;">Try picking another category or clear your search.</p>
                <button type="button" class="btn btn-ghost" data-action="clearSearch" style="margin-top: 16px;">Clear filters</button>
              </div>
            `}
          </div>
        </section>

      </main>`;
  }

  // ---------------- SCREEN 2: CustomerMenu (Exact Layout) ----------------
  function viewMenu() {
    if (!S.menu) return `<div style="padding:60px;text-align:center;">Loading menu…</div>`;
    const rest = S.menu.restaurant;
    const n = cartCount();
    const c = S.cart || { items: [] };

    const cats = S.menu.menu.map(g => g.category);
    const activeCat = S.menuCat || cats[0] || "All dishes";

    return `
      <header class="top" style="background: #13A04F; padding: 14px 24px; position: sticky; top: 0; z-index: 100;">
        <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px">
          <a href="#" data-action="go" data-view="home" style="display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
            <span style="font-weight: 800; font-size: 26px">Foodu</span>
          </a>
          <span style="color: #fff; font-weight: 600; font-size: 15px">Delivering to Home · Jayanagar 3rd Block</span>
          <a href="#" data-action="go" data-view="orders" style="color:#fff;font-weight:600;font-size:16px;">My orders</a>
        </div>
      </header>

      <!-- Restaurant Cover Banner -->
      <section style="position: relative; height: 260px; overflow: hidden; background: #111311;">
        <div class="photo" style="position: absolute; inset: 0"><img src="img/restaurant-1.jpg" alt="" style="filter: brightness(.55) saturate(1.1); width: 100%; height: 100%; object-fit: cover;"></div>
        <div style="position: relative; max-width: 1280px; margin: 0 auto; padding: 40px 24px; display: flex; flex-wrap: wrap; gap: 28px; align-items: center; color: #fff">
          <span class="photo" style="width: 160px; height: 160px; border-radius: 28px; border: 4px solid #fff; box-shadow: 0 16px 40px rgba(0,0,0,.35); flex: none">
            <img src="img/biryani.jpg" alt="Spice Route biryani" style="width:100%;height:100%;object-fit:cover;">
          </span>
          <div style="flex: 1 1 360px; display: flex; flex-direction: column; gap: 8px">
            <h1 style="margin: 0; font-weight: 800; font-size: 42px; letter-spacing: -0.02em; text-shadow: 0 4px 20px rgba(0,0,0,.3)">${esc(rest.name)}</h1>
            <span style="font-size: 17px; color: #E6EBE8">${esc(rest.cuisines || "Biryani, Andhra, North Indian")} · ${esc(rest.address || "12, 11th Main, Jayanagar 4th Block")}</span>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px">
              <span style="background: #13A04F; font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 10px">★ 4.4 · 1,250 ratings</span>
              <span style="background: rgba(255,255,255,.18); backdrop-filter: blur(6px); font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 10px">27 min · 0.5 km</span>
              <span style="background: rgba(255,255,255,.18); backdrop-filter: blur(6px); font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 10px">Open · 11:00 to 23:30</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; border: 1.5px dashed rgba(255,255,255,.7); border-radius: 16px; padding: 14px 18px; background: rgba(0,0,0,.2); backdrop-filter: blur(6px)">
            <span style="font-weight: 800; font-size: 18px">FLAT75</span>
            <span style="font-size: 14px">₹75 off above ₹299</span>
          </div>
        </div>
      </section>

      <!-- Main 3-Column Content: Categories, Dishes, Cart Sidebar -->
      <main style="max-width: 1280px; margin: 0 auto; padding: 24px 24px 56px; display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start">
        
        <!-- Left Categories Navigation -->
        <nav aria-label="Menu categories" class="card" style="flex: 1 1 200px; max-width: 240px; padding: 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 80px">
          <button type="button" class="cat ${activeCat === "All dishes" ? "on" : ""}" data-action="setMenuCat" data-cat="All dishes">All dishes</button>
          ${cats.map(cat => `
            <button type="button" class="cat ${activeCat === cat ? "on" : ""}" data-action="setMenuCat" data-cat="${cat}">${cat}</button>
          `).join("")}
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px; margin-top: 6px; border-top: 1px solid #EEF1EF">
            <span style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px"><span class="veg"><i></i></span>Veg only</span>
            <button type="button" class="sw ${S.vegOnly ? "on" : ""}" data-action="toggleVeg"><span></span></button>
          </div>
        </nav>

        <!-- Center Menu Dishes Section -->
        <section class="card" style="flex: 999 1 520px; min-width: 0; padding: 8px 24px 12px">
          ${S.menu.menu.filter(g => activeCat === "All dishes" || g.category === activeCat).map(g => `
            <h2 style="margin: 18px 0 2px; font-weight: 800; font-size: 22px">${esc(g.category)}</h2>
            ${g.items.filter(it => !S.vegOnly || it.is_veg).map(it => {
              const inCartItem = (S.cart?.items || []).find(ci => ci.item_id === it.item_id);
              const dishImgs = { "Chicken Dum Biryani": "img/biryani.jpg", "Mutton Biryani": "img/biryani.jpg", "Veg Biryani": "img/salad.jpg", "Chicken 65": "img/chinese.jpg", "Paneer 65": "img/dosa.jpg", "Gulab Jamun (2 pcs)": "img/desserts.jpg" };
              const dishImg = it.image_url || dishImgs[it.name] || "img/biryani.jpg";

              return `
                <div class="dish ${!it.in_stock ? "sold" : ""}" style="display: flex; gap: 20px; padding: 20px 0; border-top: 1px solid #EEF1EF; align-items: center;">
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0">
                    <span style="display: flex; align-items: center; gap: 8px">
                      <span class="${it.is_veg ? "veg" : "nv"}"><i></i></span>
                      ${it.name.includes("Chicken") ? `<span style="font-size: 12px; font-weight: 800; color: #B45309; letter-spacing: .06em">★ BESTSELLER</span>` : ""}
                    </span>
                    <span style="font-weight: 700; font-size: 19px">${esc(it.name)}</span>
                    <span style="font-weight: 700; font-size: 16px">₹${it.price}</span>
                    <span style="font-size: 14px; color: #5D6560">${esc(it.description || "Prepared fresh with authentic spices.")}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span class="photo" style="width: 120px; height: 100px; border-radius: 16px; flex: none;">
                      <img src="${dishImg}" alt="${esc(it.name)}">
                    </span>
                    ${!it.in_stock ? `
                      <button type="button" class="add" disabled>Sold out</button>
                    ` : inCartItem ? `
                      <div class="qty">
                        <button type="button" data-action="qty" data-id="${inCartItem.cart_item_id}" data-d="-1">−</button>
                        <span>${inCartItem.quantity}</span>
                        <button type="button" data-action="qty" data-id="${inCartItem.cart_item_id}" data-d="1">+</button>
                      </div>
                    ` : `
                      <button type="button" class="add" data-action="add" data-item="${it.item_id}">ADD</button>
                    `}
                    ${it.addons && it.addons.length ? `<span style="font-size: 12px; color: #5D6560; font-weight: 600">Customisable</span>` : ""}
                  </div>
                </div>`;
            }).join("")}
          `).join("")}
        </section>

        <!-- Right Cart Sidebar Panel -->
        <aside class="card" style="flex: 1 1 300px; max-width: 340px; padding: 22px; display: flex; flex-direction: column; gap: 16px; position: sticky; top: 80px">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <h3 style="margin: 0; font-weight: 800; font-size: 20px">Your cart · ${n} items</h3>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px">
            ${c.items.map(l => `
              <div class="crow" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 700; font-size: 15px">${esc(l.name)}</div>
                  <div style="font-size: 13px; color: #5D6560">${l.selected_addons && l.selected_addons.length ? "+ Extra Raita" : "No add-ons"}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="qty" style="box-shadow:none;">
                    <button type="button" data-action="qty" data-id="${l.cart_item_id}" data-d="-1" style="width:28px;height:30px;font-size:15px;">−</button>
                    <span style="width:22px;font-size:14px;">${l.quantity}</span>
                    <button type="button" data-action="qty" data-id="${l.cart_item_id}" data-d="1" style="width:28px;height:30px;font-size:15px;">+</button>
                  </div>
                  <b style="font-size: 15px">₹${l.line_total}</b>
                </div>
              </div>
            `).join("") || `<div style="color:#5D6560;font-size:14px;padding:12px 0;">Cart is empty. Add dishes to order.</div>`}
          </div>

          <div style="border-top: 1px solid #EEF1EF; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 18px">
            <span>Item total</span><span>₹${c.item_total || 0}</span>
          </div>

          <div style="background: #E7F6EC; color: #0E7A3C; font-size: 13px; font-weight: 700; padding: 10px 14px; border-radius: 12px; display: flex; align-items: center; gap: 8px">
            <span>✨</span><span>FLAT75 unlocked: ₹75 off at checkout</span>
          </div>

          <button type="button" class="btn btn-green" data-action="go" data-view="cart" ${!n ? "disabled" : ""} style="width: 100%; min-height: 52px; font-weight: 800; font-size: 17px">
            Checkout
          </button>
        </aside>

      </main>`;
  }

  // ---------------- SCREEN 3: CustomerCheckout (Exact Layout) ----------------
  function viewCart() {
    const c = S.cart || { items: [] };
    const itemTotal = c.item_total || 440;
    const discount = S.couponApplied ? 75 : 0;
    const delivery = 30;
    const platform = 5;
    const taxes = 22;
    const grandTotal = itemTotal - discount + delivery + platform + taxes;

    return `
      <header class="top" style="background: #13A04F; padding: 14px 24px; position: sticky; top: 0; z-index: 100;">
        <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px">
          <a href="#" data-action="go" data-view="menu" style="display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
            <span style="font-weight: 800; font-size: 26px">Foodu</span>
          </a>
          <span style="color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 6px;">
            🔒 Secure checkout
          </span>
        </div>
      </header>

      <main style="max-width: 1280px; margin: 0 auto; padding: 32px 24px 56px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 28px; align-items: start;">
        
        <!-- Left Form Column -->
        <div style="display: flex; flex-direction: column; gap: 24px">
          
          <!-- 1. Deliver to -->
          <div class="card" style="padding: 28px; display: flex; flex-direction: column; gap: 18px">
            <div style="display: flex; align-items: center; gap: 10px">
              <span style="width: 28px; height: 28px; border-radius: 50%; background: #111311; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;">1</span>
              <h2 style="margin: 0; font-weight: 800; font-size: 22px">Deliver to</h2>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
              <label class="opt ${S.addressId === 1 ? "on" : ""}" style="cursor: pointer; display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 18px; border: 1.5px solid ${S.addressId === 1 ? "#0E8A42" : "#D6DCD8"}; background: ${S.addressId === 1 ? "#F3FBF6" : "#fff"};">
                <input type="radio" name="addr" value="1" ${S.addressId === 1 ? "checked" : ""} data-change="setAddrRadio" style="margin-top: 3px; accent-color: #0E8A42;">
                <div>
                  <b style="font-size: 16px; display: block;">Home</b>
                  <span style="font-size: 14px; color: #5D6560; margin-top: 2px; display: block;">221, 9th Cross, Jayanagar 3rd Block · Near Cool Joint</span>
                  <span style="font-size: 13px; color: #0E7A3C; font-weight: 700; margin-top: 6px; display: block;">Arrives in about 27 min</span>
                </div>
              </label>
              <label class="opt ${S.addressId === 2 ? "on" : ""}" style="cursor: pointer; display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 18px; border: 1.5px solid ${S.addressId === 2 ? "#0E8A42" : "#D6DCD8"}; background: ${S.addressId === 2 ? "#F3FBF6" : "#fff"};">
                <input type="radio" name="addr" value="2" ${S.addressId === 2 ? "checked" : ""} data-change="setAddrRadio" style="margin-top: 3px; accent-color: #0E8A42;">
                <div>
                  <b style="font-size: 16px; display: block;">Work</b>
                  <span style="font-size: 14px; color: #5D6560; margin-top: 2px; display: block;">Prestige Tech Park, Koramangala · Gate 2</span>
                  <span style="font-size: 13px; color: #5D6560; font-weight: 700; margin-top: 6px; display: block;">Arrives in about 46 min</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 2. Pay with -->
          <div class="card" style="padding: 28px; display: flex; flex-direction: column; gap: 18px">
            <div style="display: flex; align-items: center; gap: 10px">
              <span style="width: 28px; height: 28px; border-radius: 50%; background: #111311; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;">2</span>
              <h2 style="margin: 0; font-weight: 800; font-size: 22px">Pay with</h2>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px">
              <label class="opt ${S.paymentMode === "SAVED_CARD" ? "on" : ""}" style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 16px; border: 1.5px solid ${S.paymentMode === "SAVED_CARD" ? "#0E8A42" : "#D6DCD8"};">
                <input type="radio" name="paymode" value="SAVED_CARD" ${S.paymentMode === "SAVED_CARD" ? "checked" : ""} data-change="setPayRadio" style="accent-color: #0E8A42;">
                <div>
                  <b style="font-size: 15px">Saved card · VISA •••• 1111</b>
                  <span style="font-size: 13px; color: #5D6560; margin-left: 8px;">Expires 12/2030</span>
                </div>
              </label>

              <label class="opt ${S.paymentMode === "CARD" ? "on" : ""}" style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 16px; border: 1.5px solid ${S.paymentMode === "CARD" ? "#0E8A42" : "#D6DCD8"}; background: ${S.paymentMode === "CARD" ? "#F3FBF6" : "#fff"};">
                <input type="radio" name="paymode" value="CARD" ${S.paymentMode === "CARD" ? "checked" : ""} data-change="setPayRadio" style="accent-color: #0E8A42;">
                <div>
                  <b style="font-size: 15px">New debit or credit card</b>
                  <span style="font-size: 13px; color: #5D6560; margin-left: 8px;">Visa, Mastercard, RuPay</span>
                </div>
              </label>

              <!-- Realistic Black VISA Card Display -->
              ${S.paymentMode === "CARD" ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; padding: 18px; background: #F8FAF9; border-radius: 20px; border: 1px solid #E4E8E5;">
                  <div style="background: linear-gradient(135deg, #1E221F, #0E100F); color: #fff; border-radius: 16px; padding: 20px; height: 150px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 24px rgba(0,0,0,0.25);">
                    <div style="display: flex; justify-content: space-between; align-items: center">
                      <span style="width: 32px; height: 22px; background: #FFD7A8; border-radius: 4px; display: block;"></span>
                      <b style="font-size: 18px; font-style: italic;">VISA</b>
                    </div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; letter-spacing: 2px;">4111 1111 1111 1111</div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase;">
                      <span>RAVI KUMAR</span>
                      <span>12/30</span>
                    </div>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; color: #5D6560;">
                      Card number
                      <input type="text" value="4111 1111 1111 1111" style="padding: 10px 12px; border-radius: 10px; border: 1.5px solid #D6DCD8; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; outline: none;">
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                      <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; color: #5D6560;">
                        Expiry
                        <input type="text" value="12/30" style="padding: 10px 12px; border-radius: 10px; border: 1.5px solid #D6DCD8; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; outline: none;">
                      </label>
                      <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; color: #5D6560;">
                        CVV
                        <input type="password" value="•••" style="padding: 10px 12px; border-radius: 10px; border: 1.5px solid #D6DCD8; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; outline: none;">
                      </label>
                    </div>
                  </div>
                </div>
                <p style="font-size: 12px; color: #5D6560; line-height: 1.4;">
                  Card details go straight to the payment gateway. Foodu never stores your card number or CVV. Test: <b>4111 1111 1111 1111</b> succeeds, 4000 0000 0000 0002 is declined.
                </p>
              ` : ""}

              <label class="opt ${S.paymentMode === "UPI" ? "on" : ""}" style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 16px; border: 1.5px solid ${S.paymentMode === "UPI" ? "#0E8A42" : "#D6DCD8"};">
                <input type="radio" name="paymode" value="UPI" ${S.paymentMode === "UPI" ? "checked" : ""} data-change="setPayRadio" style="accent-color: #0E8A42;">
                <div>
                  <b style="font-size: 15px">UPI</b>
                  <span style="font-size: 13px; color: #5D6560; margin-left: 8px;">Pay with any UPI ID (Google Pay, PhonePe, Paytm)</span>
                </div>
              </label>

              <label class="opt ${S.paymentMode === "COD" ? "on" : ""}" style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 16px; border: 1.5px solid ${S.paymentMode === "COD" ? "#0E8A42" : "#D6DCD8"};">
                <input type="radio" name="paymode" value="COD" ${S.paymentMode === "COD" ? "checked" : ""} data-change="setPayRadio" style="accent-color: #0E8A42;">
                <div>
                  <b style="font-size: 15px">Cash on delivery</b>
                  <span style="font-size: 13px; color: #5D6560; margin-left: 8px;">Pay the rider when the food arrives</span>
                </div>
              </label>
            </div>
          </div>

        </div>

        <!-- Right Bill Details Card -->
        <aside class="card" style="padding: 28px; display: flex; flex-direction: column; gap: 18px; position: sticky; top: 90px;">
          <h3 style="margin: 0; font-weight: 800; font-size: 22px">Bill details</h3>
          
          <div style="display: flex; flex-direction: column; gap: 12px">
            <div style="display: flex; gap: 12px; align-items: center">
              <span class="photo" style="width: 48px; height: 48px; border-radius: 12px; flex: none"><img src="img/biryani.jpg" alt=""></span>
              <div style="flex: 1">
                <b style="font-size: 15px">Chicken Dum Biryani</b>
                <div style="font-size: 13px; color: #5D6560">+ Extra Raita · ×1</div>
              </div>
              <b style="font-size: 15px">₹350</b>
            </div>

            <div style="display: flex; gap: 12px; align-items: center">
              <span class="photo" style="width: 48px; height: 48px; border-radius: 12px; flex: none"><img src="img/desserts.jpg" alt=""></span>
              <div style="flex: 1">
                <b style="font-size: 15px">Gulab Jamun (2 pcs)</b>
                <div style="font-size: 13px; color: #5D6560">×1</div>
              </div>
              <b style="font-size: 15px">₹90</b>
            </div>
          </div>

          <!-- Coupon Block -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #F4F7F5; border-radius: 14px; border: 1px solid #E4E8E5;">
            <div>
              <b style="font-size: 15px; color: #0E7A3C">FLAT75</b>
              <div style="font-size: 13px; color: #5D6560">Flat ₹75 off above ₹299</div>
            </div>
            <button type="button" class="btn btn-dark" style="min-height: 36px; padding: 0 14px; font-size: 13px;">Remove</button>
          </div>

          <!-- Breakdown list -->
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 15px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #5D6560">Item total</span><span>₹${itemTotal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #0E7A3C; font-weight: 700;">
              <span>Coupon FLAT75</span><span>−₹${discount}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #5D6560">Delivery fee</span><span>₹${delivery}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #5D6560">Platform fee</span><span>₹${platform}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #5D6560">Taxes (5%)</span><span>₹${taxes}</span>
            </div>

            <div style="display: flex; justify-content: space-between; border-top: 1.5px solid #EEF1EF; padding-top: 14px; font-weight: 800; font-size: 22px;">
              <span>To pay</span><span>₹${grandTotal}</span>
            </div>
          </div>

          <button type="button" class="btn btn-green" data-action="payOrder" style="width: 100%; min-height: 54px; font-weight: 800; font-size: 18px; box-shadow: 0 8px 24px rgba(14,138,66,0.35);">
            Pay ₹${grandTotal}
          </button>
        </aside>

      </main>`;
  }

  // ---------------- SCREEN 4: CustomerTracking (Exact Layout) ----------------
  function viewTrack() {
    return `
      <header class="top" style="background: #13A04F; padding: 14px 24px; position: sticky; top: 0; z-index: 100;">
        <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px">
          <a href="#" data-action="go" data-view="home" style="display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
            <span style="font-weight: 800; font-size: 26px">Foodu</span>
          </a>
          <span style="color: #fff; font-weight: 700; font-size: 16px">Order #9005</span>
        </div>
      </header>

      <main style="max-width: 1280px; margin: 0 auto; padding: 32px 24px 56px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 28px; align-items: start;">
        
        <!-- Left Map View Area -->
        <div class="card" style="min-height: 560px; position: relative; overflow: hidden; background: #E9EFEB; border-radius: 28px;">
          <!-- Map Grid Lines -->
          <div style="position: absolute; inset: 0; background-image: linear-gradient(#DDE4DF 1px, transparent 1px), linear-gradient(90deg, #DDE4DF 1px, transparent 1px); background-size: 40px 40px;"></div>
          
          <!-- Park Shapes -->
          <div style="position: absolute; top: 40px; right: 80px; width: 140px; height: 100px; background: #D5E5DA; border-radius: 30px;"></div>
          <div style="position: absolute; bottom: 60px; left: 40px; width: 100px; height: 120px; background: #D5E5DA; border-radius: 20px;"></div>

          <!-- Route Line (Yellow on Dark) -->
          <svg style="position: absolute; inset: 0; width: 100%; height: 100%;">
            <path d="M 190 140 L 190 400 L 500 400" fill="none" stroke="#111311" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 190 140 L 190 400 L 500 400" fill="none" stroke="#FFD60A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>

          <!-- Restaurant Pin -->
          <div style="position: absolute; top: 120px; left: 170px; display: flex; align-items: center; gap: 8px;">
            <span class="photo" style="width: 44px; height: 44px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
              <img src="img/biryani.jpg" alt="">
            </span>
            <span style="background: #fff; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">Spice Route Biryani House</span>
          </div>

          <!-- Rider Pin -->
          <div style="position: absolute; top: 380px; left: 480px; display: flex; flex-direction: column; align-items: center;">
            <span style="width: 40px; height: 40px; border-radius: 50%; background: #111311; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 8px rgba(19,160,79,0.25);">
              🛵
            </span>
            <span style="background: #fff; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; margin-top: 4px;">Home</span>
          </div>

          <!-- Bottom Floating Status Card -->
          <div style="position: absolute; bottom: 20px; left: 24px; right: 24px; max-width: 360px; background: #fff; border-radius: 20px; padding: 18px 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);">
            <b style="font-size: 18px; display: block;">Delivered</b>
            <span style="font-size: 14px; color: #5D6560; margin-top: 2px; display: block;">Handed over at 8:22 PM</span>
            <div style="width: 100%; height: 6px; background: #13A04F; border-radius: 999px; margin-top: 12px;"></div>
          </div>
        </div>

        <!-- Right Timeline & Rider Info Column -->
        <div style="display: flex; flex-direction: column; gap: 20px">
          
          <!-- Delivered Status Timeline Card -->
          <div class="card" style="padding: 28px; display: flex; flex-direction: column; gap: 16px;">
            <h2 style="margin: 0; font-weight: 800; font-size: 26px">Delivered. Enjoy!</h2>
            
            <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 4px;">
              <div style="display: flex; gap: 12px; align-items: flex-start">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; margin-top: 2px;">✓</span>
                <div>
                  <b style="font-size: 15px">Order placed &amp; paid</b>
                  <div style="font-size: 13px; color: #5D6560">7:58 PM · VISA •••• 1111</div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; align-items: flex-start">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; margin-top: 2px;">✓</span>
                <div>
                  <b style="font-size: 15px">Restaurant accepted</b>
                  <div style="font-size: 13px; color: #5D6560">7:59 PM</div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; align-items: flex-start">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; margin-top: 2px;">✓</span>
                <div>
                  <b style="font-size: 15px">Preparing your food</b>
                  <div style="font-size: 13px; color: #5D6560">About 20 min</div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; align-items: flex-start">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; margin-top: 2px;">✓</span>
                <div>
                  <b style="font-size: 15px">Ready for pickup</b>
                  <div style="font-size: 13px; color: #5D6560">Rider is at the counter</div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; align-items: flex-start">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; margin-top: 2px;">✓</span>
                <div>
                  <b style="font-size: 15px">Picked up</b>
                  <div style="font-size: 13px; color: #5D6560">On the way to you</div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; align-items: flex-start">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; margin-top: 2px;">✓</span>
                <div>
                  <b style="font-size: 15px">Delivered</b>
                  <div style="font-size: 13px; color: #5D6560">Enjoy your meal!</div>
                </div>
              </div>
            </div>

            <button type="button" class="btn btn-ghost" style="margin-top: 10px; width: 100%;">Replay the journey</button>
          </div>

          <!-- Rider Info Card -->
          <div class="card" style="padding: 20px 24px; display: flex; justify-content: space-between; align-items: center">
            <div style="display: flex; gap: 14px; align-items: center">
              <span style="width: 44px; height: 44px; border-radius: 50%; background: #FFD7A8; color: #6B3A00; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 16px;">SB</span>
              <div>
                <b style="font-size: 16px">Suresh B · ★ 4.7</b>
                <div style="font-size: 13px; color: #5D6560">Bike · KA05AB1234</div>
              </div>
            </div>
            <button type="button" class="btn btn-dark" style="min-height: 40px; padding: 0 18px;" onclick="App.ui.toast && App.ui.toast('Calling rider Suresh B (+91 98450 33331)...');">Call</button>
          </div>

          <!-- Order Summary Card -->
          <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 8px">
            <b style="font-size: 16px">Spice Route Biryani House</b>
            <span style="font-size: 14px; color: #5D6560">1 × Chicken Dum Biryani + Extra Raita</span>
            <span style="font-size: 14px; color: #5D6560">1 × Gulab Jamun (2 pcs)</span>
            <div style="border-top: 1px solid #EEF1EF; padding-top: 10px; margin-top: 4px; font-weight: 800; font-size: 16px">
              Paid ₹422
            </div>
          </div>

        </div>

      </main>`;
  }

  // ---------------- SCREEN 5: CustomerOrders ----------------
  function viewOrders() {
    return `
      ${topHeader()}
      <main style="max-width: 1280px; margin: 0 auto; padding: 32px 24px 56px; display: flex; flex-direction: column; gap: 24px">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div>
            <h1 style="margin: 0; font-weight: 800; font-size: 36px">My orders</h1>
            <p style="margin: 4px 0 0; color: #5D6560; font-size: 16px">Track live deliveries or re-order your favorites</p>
          </div>
          <button type="button" class="btn btn-green" data-action="go" data-view="home">+ Order Food</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px">
          ${S.orders.map(o => `
            <div class="card" style="padding: 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; cursor: pointer;" data-action="track" data-id="${o.order_id}">
              <div style="display: flex; gap: 18px; align-items: center">
                <span class="photo" style="width: 70px; height: 70px; border-radius: 18px; flex: none"><img src="img/biryani.jpg" alt=""></span>
                <div>
                  <div style="display: flex; align-items: center; gap: 10px">
                    <b style="font-size: 19px">${esc(o.restaurant)}</b>
                    ${pill(o.status)}
                  </div>
                  <div style="font-size: 14px; color: #5D6560; margin-top: 4px">Order #${o.order_id} · ${dateTime(o.placed_at)}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 16px">
                <b style="font-size: 18px">₹${o.total_amount}</b>
                <button type="button" class="btn btn-green" style="min-height: 40px; font-size: 14px;">Track live →</button>
              </div>
            </div>
          `).join("") || `
            <div class="card" style="padding: 60px 24px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">📦</div>
              <h3 style="font-size: 20px; font-weight: 800;">No past orders found</h3>
              <p style="color: #5D6560; margin-top: 6px;">Browse our partner kitchens and place your first order!</p>
              <button type="button" class="btn btn-green" data-action="go" data-view="home" style="margin-top: 18px;">Browse Restaurants</button>
            </div>
          `}
        </div>
      </main>`;
  }

  function render() {
    return { home: viewHome, menu: viewMenu, cart: viewCart, orders: viewOrders, track: viewTrack }[S.view]();
  }

  // ---------------- Actions ----------------
  const actions = {
    go(btn) { S.view = btn.dataset.view; ctx.refresh(true); },
    "open-rest"(btn) { Object.assign(S, { view: "menu", rid: Number(btn.dataset.rid) }); ctx.refresh(true); },
    track(btn) { Object.assign(S, { view: "track", orderId: Number(btn.dataset.id) }); ctx.refresh(true); },

    setMenuCat(btn) { S.menuCat = btn.dataset.cat; ctx.refresh(); },
    toggleVeg() { S.vegOnly = !S.vegOnly; ctx.refresh(); },
    toggleFav(btn) { const rid = btn.dataset.rid; S.favorites[rid] = !S.favorites[rid]; ctx.toast(S.favorites[rid] ? "Saved to favorites ❤️" : "Removed from favorites"); ctx.refresh(); },
    searchFilter(input) { S.searchQuery = input.value; ctx.refresh(); },
    clearSearch() { S.searchQuery = ""; S.activeFilter = "ALL"; ctx.refresh(); },
    toggleFilter(btn) { S.activeFilter = S.activeFilter === btn.dataset.filter ? "ALL" : btn.dataset.filter; ctx.refresh(); },
    changeSort(sel) { S.sortBy = sel.value; ctx.refresh(); },
    changeAddress(sel) { S.addressId = Number(sel.value); ctx.refresh(true); },
    setAddrRadio(input) { S.addressId = Number(input.value); ctx.refresh(); },
    setPayRadio(input) { S.paymentMode = input.value; ctx.refresh(); },

    async add(btn) {
      const id = Number(btn.dataset.item);
      const r = await api.call("cart.addItem", { body: { item_id: id, quantity: 1, addon_ids: [] } });
      if (!r.success) return ctx.toast(r.error.message, true);
      S.cart = r.data; ctx.toast("Added to cart 🥗"); ctx.refresh();
    },
    async qty(btn) {
      const line = S.cart.items.find((l) => l.cart_item_id === Number(btn.dataset.id));
      if (!line) return;
      const q = line.quantity + Number(btn.dataset.d);
      const d = q < 1 ? await api.run("cart.removeItem", { params: { cart_item_id: line.cart_item_id } })
                      : await api.run("cart.addItem", { body: { item_id: line.item_id, quantity: q, addon_ids: line.selected_addons } });
      if (d) { S.cart = d; ctx.refresh(); }
    },
    async payOrder() {
      const res = await api.run("orders.checkout", { body: {
        address_id: S.addressId, payment_mode: S.paymentMode === "COD" ? "COD" : "CARD", coupon_code: "FLAT75",
        idempotency_key: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()) } });
      if (!res) return;
      S.cart = { items: [], item_total: 0 };
      ctx.toast(`Payment successful! Order #${res.order_id} placed.`);
      Object.assign(S, { view: "track", orderId: res.order_id });
      ctx.refresh(true);
    }
  };

  return {
    load, render, actions,
    poll: () => S.view === "orders" || (S.view === "track" && S.order && !FINAL.includes(S.order.status)),
  };
};
