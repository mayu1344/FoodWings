/* =====================================================================
   FOODU RIDER HUD  -  Exact Implementation of UI_DESIGN_SPEC.md
   Screens: RiderHome (Offer), RiderPickup (Step 1), RiderDrop (Step 2), RiderEarnings
   ===================================================================== */
App.screens = App.screens || {};

App.screens.rider = (ctx) => {
  const { esc, rupees, dateTime, pill } = App.ui;
  const api = ctx.api;
  const S = {
    view: "home", // 'home' | 'pickup' | 'drop' | 'earnings'
    online: true,
    hasOffer: true,
    secs: 18,
    orderId: 9005,
    earnings: { today: 90, trips: 2, paid: 55, pending: 35 }
  };

  async function load() {}

  // ---------------- VIEW 1: Rider Home & Offer (Exact Design) ----------------
  function viewHome() {
    return `
      <div style="width: 100%; height: 844px; display: flex; flex-direction: column; overflow: hidden; background: #F4F7F5; position: relative;">
        
        <!-- Top Green Rider Header -->
        <header style="background: #13A04F; color: #fff; padding: 18px 18px 16px; display: flex; flex-direction: column; gap: 14px; z-index: 2">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="display: flex; flex-direction: column">
              <b style="font-size: 22px">Foodu</b>
              <span style="font-size: 11px; letter-spacing: .14em; color: #DFF7E8; font-weight: 700;">RIDER HUD</span>
            </span>
            <button type="button" data-action="go" data-view="earnings" style="color: #fff; font-weight: 700; font-size: 15px; background: rgba(255,255,255,.18); padding: 8px 14px; border-radius: 999px; border: 0; cursor: pointer;">
              Today ₹55
            </button>
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-between; background: #111311; border-radius: 999px; padding: 6px 6px 6px 18px">
            <span style="display: flex; flex-direction: column">
              <b style="font-size: 16px">${S.online ? "You are online" : "You are offline"}</b>
              <span style="font-size: 12px; color: #9FE0B8">${S.online ? "Bike · KA05AB1234" : "Go online to receive orders"}</span>
            </span>
            <button type="button" class="switch ${S.online ? "on" : ""}" data-action="toggleOnline"><span></span></button>
          </div>
        </header>

        <!-- Simulated Map with Radar and Pins -->
        <section style="flex: 1; position: relative; background-color: #E9EFEB; background-image: linear-gradient(#DCE4DF 3px, transparent 3px), linear-gradient(90deg, #DCE4DF 3px, transparent 3px), linear-gradient(#E2E9E4 1px, transparent 1px), linear-gradient(90deg, #E2E9E4 1px, transparent 1px); background-size: 120px 120px, 120px 120px, 30px 30px, 30px 30px;">
          
          ${S.online ? `
            <div style="position: absolute; left: 50%; top: 44%; width: 220px; height: 220px; border-radius: 50%; border: 2px solid #13A04F; background: rgba(19,160,79,.08); transform: translate(-50%, -50%);"></div>
          ` : ""}

          <!-- Me Pin (Rider) -->
          <div style="position: absolute; left: 50%; top: 44%; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; background: #111311; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 10px rgba(17,19,17,.15);">
            🛵
          </div>

          <!-- Restaurant Pin -->
          ${S.hasOffer ? `
            <div style="position: absolute; left: 28%; top: 28%; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,.25);">
              <img src="img/biryani.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          ` : ""}

          <!-- Map Note Badge -->
          <div style="position: absolute; left: 16px; top: 16px; background: #fff; border-radius: 12px; padding: 8px 14px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,.12)">
            ${S.online ? "Jayanagar · busy area" : "Offline · 0 nearby orders"}
          </div>
        </section>

        <!-- New Order Offer Sheet -->
        ${S.hasOffer && S.online ? `
          <section class="card sheet" style="margin: -130px 12px 12px; position: relative; padding: 20px; display: flex; flex-direction: column; gap: 14px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 10;">
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span style="font-size: 12px; font-weight: 800; letter-spacing: .1em; color: #0E7A3C">NEW ORDER OFFER</span>
              <span style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #7A4B00">
                <span style="width: 16px; height: 16px; border: 2px solid #E09F00; border-top-color: transparent; border-radius: 50%; display: inline-block;"></span>
                18 s
              </span>
            </div>

            <div style="display: flex; gap: 12px; align-items: center">
              <span style="width: 56px; height: 56px; border-radius: 14px; overflow: hidden; flex: none">
                <img src="img/biryani.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover">
              </span>
              <div style="display: flex; flex-direction: column; gap: 4px; flex: 1">
                <b style="font-size: 16px">Spice Route Biryani House</b>
                <span style="font-size: 13px; color: #5D6560">Pickup 0.6 km · drop 0.5 km further</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end">
                <b style="font-size: 26px">₹35</b>
                <span style="font-size: 12px; color: #5D6560">est. pay</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
              <button type="button" class="btn btn-ghost" data-action="rejectOffer">Reject</button>
              <button type="button" class="btn btn-green" data-action="acceptOffer">Accept</button>
            </div>
          </section>
        ` : ""}

      </div>`;
  }

  // ---------------- VIEW 2: Rider Step 1 Pickup (Exact Design) ----------------
  function viewPickup() {
    return `
      <div style="width: 100%; height: 844px; display: flex; flex-direction: column; overflow: hidden; background: #F4F7F5; position: relative;">
        
        <!-- Step 1 Header -->
        <header style="background: #13A04F; color: #fff; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 2">
          <div>
            <div style="font-size: 12px; font-weight: 800; letter-spacing: .08em; color: #DFF7E8;">STEP 1 OF 2</div>
            <h2 style="margin: 2px 0 0; font-size: 22px; font-weight: 800;">Go to the restaurant</h2>
          </div>
          <button type="button" class="btn btn-dark" style="min-height: 40px; padding: 0 18px; font-size: 14px;" data-action="go" data-view="drop">
            Arrived
          </button>
        </header>

        <!-- Route Map -->
        <section style="flex: 1; position: relative; background-color: #E9EFEB; background-image: linear-gradient(#DCE4DF 3px, transparent 3px), linear-gradient(90deg, #DCE4DF 3px, transparent 3px), linear-gradient(#E2E9E4 1px, transparent 1px), linear-gradient(90deg, #E2E9E4 1px, transparent 1px); background-size: 120px 120px, 120px 120px, 30px 30px, 30px 30px;">
          
          <svg style="position: absolute; inset: 0; width: 100%; height: 100%;">
            <path d="M 120 230 L 120 380" fill="none" stroke="#111311" stroke-width="8" stroke-linecap="round"/>
            <path d="M 120 230 L 120 380" fill="none" stroke="#FFD60A" stroke-width="5" stroke-linecap="round"/>
            <path d="M 120 230 L 280 230" fill="none" stroke="#5D6560" stroke-width="4" stroke-dasharray="6,6"/>
          </svg>

          <!-- Rider Pin -->
          <div style="position: absolute; top: 210px; left: 100px; width: 40px; height: 40px; border-radius: 50%; background: #111311; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 10px rgba(17,19,17,.15);">
            🛵
          </div>

          <!-- Restaurant Pin -->
          <div style="position: absolute; top: 210px; left: 260px; width: 40px; height: 40px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px;">
            H
          </div>

          <div style="position: absolute; left: 16px; top: 16px; background: #fff; border-radius: 12px; padding: 8px 14px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,.12)">
            You are at the restaurant
          </div>
        </section>

        <!-- Bottom Sheet with Order Details & Slide to Pickup -->
        <section class="card sheet" style="margin: -160px 12px 12px; position: relative; padding: 20px; display: flex; flex-direction: column; gap: 14px; border-radius: 28px; z-index: 10;">
          
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div>
              <b style="font-size: 18px; display: block;">Spice Route Biryani House</b>
              <span style="font-size: 13px; color: #5D6560">12, 11th Main, Jayanagar 4th Block</span>
            </div>
            <button type="button" class="btn btn-dark" style="min-height: 40px; padding: 0 16px; font-size: 14px;">Navigate</button>
          </div>

          <div style="background: #F4F7F5; padding: 14px; border-radius: 16px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center">
              <b style="font-size: 15px">Order #9005</b>
              <span style="background: #E7F6EC; color: #0E7A3C; font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 6px;">FOOD READY</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center">
              <span class="photo" style="width: 38px; height: 38px; border-radius: 10px; flex: none"><img src="img/biryani.jpg" alt=""></span>
              <span style="font-size: 14px; font-weight: 600;">1 × Chicken Dum Biryani + Extra Raita</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center">
              <span class="photo" style="width: 38px; height: 38px; border-radius: 10px; flex: none"><img src="img/desserts.jpg" alt=""></span>
              <span style="font-size: 14px; font-weight: 600;">1 × Gulab Jamun (2 pcs)</span>
            </div>
          </div>

          <span style="font-size: 13px; color: #5D6560; font-weight: 600;">Paid online · nothing to collect</span>

          <button type="button" class="btn btn-green" data-action="go" data-view="drop" style="width: 100%; min-height: 54px; font-size: 17px; font-weight: 800; gap: 12px;">
            <span style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center;">➔</span>
            Slide to confirm pickup
          </button>

        </section>

      </div>`;
  }

  // ---------------- VIEW 3: Rider Step 2 Drop (Exact Design) ----------------
  function viewDrop() {
    return `
      <div style="width: 100%; height: 844px; display: flex; flex-direction: column; overflow: hidden; background: #F4F7F5; position: relative;">
        
        <!-- Step 2 Header -->
        <header style="background: #13A04F; color: #fff; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 2">
          <div>
            <div style="font-size: 12px; font-weight: 800; letter-spacing: .08em; color: #DFF7E8;">STEP 2 OF 2</div>
            <h2 style="margin: 2px 0 0; font-size: 22px; font-weight: 800;">Deliver to the customer</h2>
          </div>
          <button type="button" class="btn btn-dark" style="min-height: 40px; padding: 0 18px; font-size: 14px;" data-action="deliverOrder">
            Arrived
          </button>
        </header>

        <!-- Route Map to Customer -->
        <section style="flex: 1; position: relative; background-color: #E9EFEB; background-image: linear-gradient(#DCE4DF 3px, transparent 3px), linear-gradient(90deg, #DCE4DF 3px, transparent 3px), linear-gradient(#E2E9E4 1px, transparent 1px), linear-gradient(90deg, #E2E9E4 1px, transparent 1px); background-size: 120px 120px, 120px 120px, 30px 30px, 30px 30px;">
          
          <svg style="position: absolute; inset: 0; width: 100%; height: 100%;">
            <path d="M 120 180 L 280 180 L 280 340" fill="none" stroke="#111311" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 120 180 L 280 180 L 280 340" fill="none" stroke="#FFD60A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>

          <!-- Restaurant Pin -->
          <div style="position: absolute; top: 160px; left: 100px; width: 40px; height: 40px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,.25);">
            <img src="img/biryani.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover;">
          </div>

          <!-- Rider Pin -->
          <div style="position: absolute; top: 320px; left: 260px; width: 40px; height: 40px; border-radius: 50%; background: #111311; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 10px rgba(17,19,17,.15);">
            🛵
          </div>
        </section>

        <!-- Bottom Sheet with Customer Info & Complete Delivery -->
        <section class="card sheet" style="margin: -140px 12px 12px; position: relative; padding: 20px; display: flex; flex-direction: column; gap: 14px; border-radius: 28px; z-index: 10;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start">
            <div>
              <b style="font-size: 18px; display: block;">Ravi K. · Home</b>
              <span style="font-size: 13px; color: #5D6560; display: block; margin-top: 2px;">221, 9th Cross, Jayanagar 3rd Block</span>
              <span style="font-size: 13px; color: #5D6560; font-weight: 600;">Landmark: Near Cool Joint</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-ghost" style="min-height: 40px; padding: 0 14px; font-size: 14px;" onclick="App.ui.toast && App.ui.toast('Calling customer Ravi K...');">Call</button>
              <button type="button" class="btn btn-dark" style="min-height: 40px; padding: 0 14px; font-size: 14px;">Navigate</button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #F4F7F5; border-radius: 16px;">
            <span style="font-size: 14px; font-weight: 700;">Paid online · nothing to collect</span>
            <span style="width: 20px; height: 20px; border-radius: 50%; background: #13A04F; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px;">✓</span>
          </div>

          <button type="button" class="btn btn-green" data-action="deliverOrder" style="width: 100%; min-height: 54px; font-size: 17px; font-weight: 800;">
            Mark as delivered
          </button>

        </section>

      </div>`;
  }

  // ---------------- VIEW 4: Rider Earnings (Exact Design) ----------------
  function viewEarnings() {
    return `
      <div style="width: 100%; height: 844px; display: flex; flex-direction: column; overflow: hidden; background: #F4F7F5; position: relative;">
        
        <!-- Header -->
        <header style="background: #13A04F; color: #fff; padding: 24px 20px 20px; display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 12px; font-weight: 800; letter-spacing: .12em; color: #DFF7E8;">TODAY'S EARNINGS</span>
          <b style="font-size: 44px; font-weight: 900; line-height: 1;">₹90</b>
          <span style="font-size: 14px; color: #DFF7E8; font-weight: 600;">2 trips · Suresh B · ★ 4.7</span>
        </header>

        <main style="flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;">
          
          <!-- Stat cards -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="card" style="padding: 16px;">
              <span style="font-size: 12px; font-weight: 800; color: #5D6560;">PAID</span>
              <b style="font-size: 24px; display: block; margin-top: 4px;">₹55</b>
            </div>
            <div class="card" style="padding: 16px;">
              <span style="font-size: 12px; font-weight: 800; color: #5D6560;">PENDING</span>
              <b style="font-size: 24px; display: block; margin-top: 4px;">₹35</b>
            </div>
          </div>

          <!-- Trip History -->
          <div class="card" style="padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #EEF1EF; padding-bottom: 12px;">
              <div style="display: flex; gap: 10px; align-items: center;">
                <span class="photo" style="width: 44px; height: 44px; border-radius: 12px; flex: none;"><img src="img/biryani.jpg" alt=""></span>
                <div>
                  <b style="font-size: 15px">#9005 · Spice Route</b>
                  <div style="font-size: 13px; color: #5D6560">Tap for breakdown</div>
                </div>
              </div>
              <div style="text-align: right;">
                <b style="font-size: 17px">₹35</b>
                <span style="background: #FFF4D6; color: #7A4B00; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: block; margin-top: 2px;">PENDING</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; gap: 10px; align-items: center;">
                <span class="photo" style="width: 44px; height: 44px; border-radius: 12px; flex: none;"><img src="img/desserts.jpg" alt=""></span>
                <div>
                  <b style="font-size: 15px">#9001 · Spice Route</b>
                  <div style="font-size: 13px; color: #5D6560">Tap for breakdown</div>
                </div>
              </div>
              <div style="text-align: right;">
                <b style="font-size: 17px">₹55</b>
                <span style="background: #E7F6EC; color: #0E7A3C; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: block; margin-top: 2px;">PAID</span>
              </div>
            </div>

            <div style="background: #F4F7F5; border-radius: 12px; padding: 10px 14px; font-size: 12px; font-weight: 700; color: #5D6560; display: flex; justify-content: space-between;">
              <span>● Base ₹25</span><span>● Distance ₹10</span><span>● Tip ₹20</span>
            </div>
          </div>

          <p style="font-size: 13px; color: #5D6560; line-height: 1.4; padding: 0 4px;">
            Each trip pays a base amount plus a distance amount. Tips from customers go fully to you.
          </p>
        </main>

        <!-- Bottom Tabs -->
        <nav style="background: #fff; border-top: 1px solid #D6DCD8; display: flex; justify-content: space-around; padding: 10px 0;">
          <button type="button" data-action="go" data-view="home" style="display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: none; font-size: 12px; font-weight: 700; color: #5D6560; cursor: pointer;">
            <span style="font-size: 18px;">🏠</span> Home
          </button>
          <button type="button" data-action="go" data-view="earnings" style="display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: none; font-size: 12px; font-weight: 800; color: #13A04F; cursor: pointer;">
            <span style="font-size: 18px;">💵</span> Earnings
          </button>
          <button type="button" onclick="App.ui.toast && App.ui.toast('Rider profile: Suresh B');" style="display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: none; font-size: 12px; font-weight: 700; color: #5D6560; cursor: pointer;">
            <span style="font-size: 18px;">👤</span> Profile
          </button>
        </nav>

      </div>`;
  }

  function render() {
    return { home: viewHome, pickup: viewPickup, drop: viewDrop, earnings: viewEarnings }[S.view]();
  }

  const actions = {
    go(btn) { S.view = btn.dataset.view; ctx.refresh(); },
    toggleOnline() { S.online = !S.online; ctx.toast(S.online ? "You are now ONLINE" : "You are now OFFLINE"); ctx.refresh(); },
    rejectOffer() { S.hasOffer = false; ctx.toast("Offer rejected"); ctx.refresh(); },
    acceptOffer() { S.view = "pickup"; ctx.toast("Offer accepted! Ride to the restaurant."); ctx.refresh(); },
    deliverOrder() {
      S.view = "earnings";
      ctx.toast("Order delivered! ₹35 added to earnings.");
      ctx.refresh();
    }
  };

  return { load, render, actions };
};
