/* =====================================================================
   Login & Registration Screen - Unified across Customer, Restaurant & Rider apps
   Allows existing users to log in with OTP or 1-click personas,
   and new users to register with custom role & database profile creation.
   ===================================================================== */
App.screens = App.screens || {};

App.screens.login = (ctx) => {
  const PERSONAS = {
    customer: [
      { phone: "9845011111", name: "Ravi Kumar", note: "Jayanagar · saved VISA card" },
      { phone: "9845011112", name: "Ananya Rao", note: "Basavanagudi · dosa already in cart" },
      { phone: "9845011114", name: "Sneha Patil", note: "Jayanagar 4th T Block" },
    ],
    restaurant: [
      { phone: "9845022221", name: "Manjunath Gowda", note: "Owner · Spice Route Biryani House" },
      { phone: "9845022222", name: "Lakshmi Iyer", note: "Owner · Udupi Grand Veg" },
      { phone: "9845022223", name: "Arjun Shetty", note: "Owner · Slice Street Pizza" },
    ],
    rider: [
      { phone: "9845033331", name: "Suresh B", note: "Bike · online near Jayanagar" },
      { phone: "9845033332", name: "Prakash Naik", note: "Scooter · online near Basavanagudi" },
      { phone: "9845033334", name: "Imran Khan", note: "KYC still pending" },
    ],
  }[ctx.kind] || [];

  const HEAD = {
    customer: ["Hungry?", "Log in with your phone or create a new account to order delicious food."],
    restaurant: ["Kitchen Partner Portal", "Log in to manage orders or register your restaurant to start selling."],
    rider: ["Delivery Partner HUD", "Log in to accept deliveries or register as a partner to start earning."],
  }[ctx.kind] || ["Welcome", "Log in or register to continue."];

  const defaultRole = ctx.kind === "restaurant" ? "RESTAURANT_OWNER"
                    : ctx.kind === "rider" ? "DELIVERY_PARTNER" : "CUSTOMER";

  const state = {
    mode: "login", // 'login' | 'register'
    step: "form",  // 'form' | 'otp'
    phone: "",
    devOtp: "",
    reg: {
      name: "",
      email: "",
      role: defaultRole,
      restaurant_name: "",
      restaurant_address: "",
      cuisines: "",
      vehicle_type: "BIKE",
      vehicle_no: "",
      address_line: "",
    }
  };

  async function finish(data) {
    ctx.session.login(data.token, { user_id: data.user_id, name: data.name, roles: data.roles });
    ctx.toast(data.new_user ? "Account created successfully! Welcome to FoodWings." : `Welcome back, ${data.name || "friend"}!`);
    Object.assign(state, { mode: "login", step: "form", phone: "", devOtp: "" });
    ctx.go();
  }

  async function previewLogin({ phone, role, mode, extra = {} }) {
    const response = await ctx.api.run("auth.requestOtp", {
      body: { phone, app: ctx.kind, purpose: mode === "register" ? "REGISTER" : "LOGIN" },
    });
    if (!response) return;

    const payload = { phone, otp: response.dev_otp || "000000", role };
    Object.assign(payload, extra);

    const verified = await ctx.api.run("auth.verifyOtp", { body: payload });
    if (verified) finish(verified);
  }

  return {
    async load() {},
    render() {
      const { esc, initials } = App.ui;
      const isReg = state.mode === "register";

      return `<div class="login stack" style="gap:16px">
        <div class="stack" style="gap:4px">
          <h1>${HEAD[0]}</h1>
          <p class="muted">${HEAD[1]}</p>
        </div>

        <div class="auth-tabs" style="display:flex;background:rgba(255,255,255,0.06);padding:4px;border-radius:12px;gap:4px;border:1px solid rgba(255,255,255,0.08);">
          <button type="button" class="btn small ${!isReg ? 'primary' : ''}" style="flex:1;text-align:center;border-radius:8px;padding:8px;" data-action="setMode" data-mode="login">
            <b>Log In</b>
          </button>
          <button type="button" class="btn small ${isReg ? 'primary' : ''}" style="flex:1;text-align:center;border-radius:8px;padding:8px;" data-action="setMode" data-mode="register">
            <b>Register / Sign Up</b>
          </button>
        </div>

        ${state.step === "otp" ? `
          <form class="stack" data-action="verify" style="gap:12px">
            <div class="notice" style="background:rgba(255,214,10,0.1);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,214,10,0.2);">
              <p class="small">OTP sent to <b>${esc(state.phone)}</b> · <button type="button" class="linkbtn" data-action="back" style="color:var(--yellow);font-weight:700;">Change number</button></p>
            </div>
            <label class="field" for="${ctx.kind}-otp">6-Digit Verification OTP
              <input id="${ctx.kind}-otp" name="otp" class="otpbox" type="text" inputmode="numeric" maxlength="6" value="${esc(state.devOtp)}" required autofocus></label>
            ${state.devOtp ? `<p class="small muted">⚡ Test mode: OTP <b>${esc(state.devOtp)}</b> is filled for you.</p>` : ""}
            <button class="btn primary block" type="submit" style="padding:12px;font-size:1rem;">Verify &amp; Continue →</button>
          </form>
        ` : !isReg ? `
          <form class="stack" data-action="requestLogin" style="gap:12px">
            <label class="field" for="${ctx.kind}-phone">Mobile Number
              <input id="${ctx.kind}-phone" name="phone" type="tel" inputmode="numeric" placeholder="98450 11111" value="${esc(state.phone)}" required></label>
            <button class="btn primary block" type="submit" style="padding:12px;font-size:1rem;">Send OTP →</button>
            <p class="small muted" style="text-align:center;">Don't have an account? <button type="button" class="linkbtn" data-action="setMode" data-mode="register" style="color:var(--yellow);font-weight:700;">Register here</button></p>
          </form>

          <div class="stack" style="gap:8px;margin-top:8px;">
            <span class="eyebrow">Or 1-Tap Quick Sample Login</span>
            ${PERSONAS.map((p) => `
              <button class="persona" data-action="persona" data-phone="${p.phone}">
                <span class="avatar">${esc(initials(p.name))}</span>
                <span><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.note)}</span></span>
              </button>`).join("")}
          </div>
        ` : `
          <form class="stack" data-action="requestRegister" style="gap:12px">
            <label class="field" for="${ctx.kind}-reg-name">Full Name *
              <input id="${ctx.kind}-reg-name" name="name" type="text" placeholder="e.g. Ramesh Kumar" value="${esc(state.reg.name)}" required></label>

            <label class="field" for="${ctx.kind}-reg-phone">Mobile Number *
              <input id="${ctx.kind}-reg-phone" name="phone" type="tel" inputmode="numeric" placeholder="98450 99999" value="${esc(state.phone)}" required></label>

            <label class="field" for="${ctx.kind}-reg-email">Email Address (Optional)
              <input id="${ctx.kind}-reg-email" name="email" type="email" placeholder="ramesh@example.com" value="${esc(state.reg.email)}"></label>

            <label class="field" for="${ctx.kind}-reg-role">Registering As *
              <select id="${ctx.kind}-reg-role" name="role" data-change="changeRole">
                <option value="CUSTOMER" ${state.reg.role === "CUSTOMER" ? "selected" : ""}>Customer (Order Food)</option>
                <option value="RESTAURANT_OWNER" ${state.reg.role === "RESTAURANT_OWNER" ? "selected" : ""}>Restaurant Partner (Kitchen / Owner)</option>
                <option value="DELIVERY_PARTNER" ${state.reg.role === "DELIVERY_PARTNER" ? "selected" : ""}>Delivery Partner (Rider)</option>
              </select>
            </label>

            ${state.reg.role === "RESTAURANT_OWNER" ? `
              <div class="stack" style="gap:10px;background:rgba(255,214,10,0.06);padding:12px;border-radius:10px;border:1px solid rgba(255,214,10,0.15);">
                <span class="eyebrow" style="color:var(--yellow);">Restaurant Profile</span>
                <label class="field" for="${ctx.kind}-reg-rname">Restaurant Name *
                  <input id="${ctx.kind}-reg-rname" name="restaurant_name" type="text" placeholder="e.g. Royal Biryani &amp; Tandoor" value="${esc(state.reg.restaurant_name)}" required></label>
                <label class="field" for="${ctx.kind}-reg-cuisines">Cuisines / Specialties *
                  <input id="${ctx.kind}-reg-cuisines" name="cuisines" type="text" placeholder="e.g. North Indian, Biryani, Mughlai" value="${esc(state.reg.cuisines)}" required></label>
                <label class="field" for="${ctx.kind}-reg-raddr">Restaurant Address *
                  <input id="${ctx.kind}-reg-raddr" name="restaurant_address" type="text" placeholder="e.g. 55, 100 Feet Road, Indiranagar, Bengaluru" value="${esc(state.reg.restaurant_address)}" required></label>
              </div>
            ` : state.reg.role === "DELIVERY_PARTNER" ? `
              <div class="stack" style="gap:10px;background:rgba(255,214,10,0.06);padding:12px;border-radius:10px;border:1px solid rgba(255,214,10,0.15);">
                <span class="eyebrow" style="color:var(--yellow);">Rider Vehicle Details</span>
                <label class="field" for="${ctx.kind}-reg-vtype">Vehicle Type *
                  <select id="${ctx.kind}-reg-vtype" name="vehicle_type">
                    <option value="BIKE" ${state.reg.vehicle_type === "BIKE" ? "selected" : ""}>Motorcycle / Bike</option>
                    <option value="SCOOTER" ${state.reg.vehicle_type === "SCOOTER" ? "selected" : ""}>Scooter / Activa</option>
                    <option value="EV" ${state.reg.vehicle_type === "EV" ? "selected" : ""}>Electric Vehicle (EV)</option>
                    <option value="CYCLE" ${state.reg.vehicle_type === "CYCLE" ? "selected" : ""}>Bicycle</option>
                  </select>
                </label>
                <label class="field" for="${ctx.kind}-reg-vno">Vehicle Registration No.
                  <input id="${ctx.kind}-reg-vno" name="vehicle_no" type="text" placeholder="e.g. KA05AB9999" value="${esc(state.reg.vehicle_no)}"></label>
              </div>
            ` : `
              <div class="stack" style="gap:10px;background:rgba(255,255,255,0.03);padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
                <span class="eyebrow">Delivery Address</span>
                <label class="field" for="${ctx.kind}-reg-addr">Home / Work Address
                  <input id="${ctx.kind}-reg-addr" name="address_line" type="text" placeholder="e.g. 12, 5th Cross, Koramangala, Bengaluru" value="${esc(state.reg.address_line)}"></label>
              </div>
            `}

            <button class="btn primary block" type="submit" style="padding:12px;font-size:1rem;">Register &amp; Send OTP →</button>
            <p class="small muted" style="text-align:center;">Already registered? <button type="button" class="linkbtn" data-action="setMode" data-mode="login" style="color:var(--yellow);font-weight:700;">Log in here</button></p>
          </form>
        `}
      </div>`;
    },
    actions: {
      setMode(btn) {
        state.mode = btn.dataset.mode;
        state.step = "form";
        state.devOtp = "";
        ctx.refresh();
      },
      changeRole(sel) {
        state.reg.role = sel.value;
        ctx.refresh();
      },
      back() {
        state.step = "form";
        state.devOtp = "";
        ctx.refresh();
      },
      async requestLogin(form) {
        const phone = form.phone.value.replace(/\s+/g, "");
        state.phone = phone;
        await previewLogin({ phone, role: defaultRole, mode: "login" });
      },
      async requestRegister(form) {
        const phone = form.phone.value.replace(/\s+/g, "");
        const name = form.name.value.trim();
        const email = form.email?.value.trim() || null;
        const role = form.role.value;
        const restaurant_name = form.restaurant_name?.value.trim() || null;
        const cuisines = form.cuisines?.value.trim() || null;
        const restaurant_address = form.restaurant_address?.value.trim() || null;
        const vehicle_type = form.vehicle_type?.value || null;
        const vehicle_no = form.vehicle_no?.value.trim() || null;
        const address_line = form.address_line?.value.trim() || null;

        state.phone = phone;
        state.reg = { name, email, role, restaurant_name, cuisines, restaurant_address, vehicle_type, vehicle_no, address_line };

        await previewLogin({
          phone,
          role,
          mode: "register",
          extra: {
            name,
            email,
            restaurant_name,
            restaurant_address,
            cuisines,
            vehicle_type,
            vehicle_no,
            address_line,
          },
        });
      },
      async verify(form) {
        const payload = {
          phone: state.phone,
          otp: form.otp.value.trim(),
          role: state.reg.role || defaultRole,
        };
        if (state.mode === "register") {
          payload.name = state.reg.name;
          payload.email = state.reg.email;
          payload.role = state.reg.role;
          payload.restaurant_name = state.reg.restaurant_name;
          payload.restaurant_address = state.reg.restaurant_address;
          payload.cuisines = state.reg.cuisines;
          payload.vehicle_type = state.reg.vehicle_type;
          payload.vehicle_no = state.reg.vehicle_no;
        }
        const d = await ctx.api.run("auth.verifyOtp", { body: payload });
        if (d) finish(d);
      },
      async persona(btn) {
        const phone = btn.dataset.phone;
        await previewLogin({ phone, role: defaultRole, mode: "login" });
      },
    },
  };
};
