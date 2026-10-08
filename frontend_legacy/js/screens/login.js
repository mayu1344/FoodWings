/* =====================================================================
   FOODU SIGN IN & REGISTRATION SCREEN
   Exact Implementation of SignIn.dc.html & Register.dc.html (PDF Pages 3 & 4)
   ===================================================================== */
App.screens = App.screens || {};

App.screens.login = (ctx) => {
  const { esc, initials } = App.ui;

  const APPS = {
    customer: {
      id: "customer", name: "Customer", sub: "Order food",
      title: "Hungry? Sign in.",
      text: "Order from the best restaurants near you, pay safely and track every order live.",
      destName: "Customer App", phone: "98450 11111", img: "img/biryani.jpg", who: "Ravi Kumar"
    },
    restaurant: {
      id: "restaurant", name: "Restaurant", sub: "Kitchen Portal",
      title: "Your kitchen, live.",
      text: "Accept orders, mark food ready and see your payouts in one place.",
      destName: "Kitchen Portal", phone: "98450 22221", img: "img/restaurant-1.jpg", who: "Manjunath Gowda"
    },
    rider: {
      id: "rider", name: "Rider", sub: "Rider HUD",
      title: "Ride. Deliver. Earn.",
      text: "Go online, take nearby orders and follow the map to every door.",
      destName: "Rider HUD", phone: "98450 33331", img: "img/dineout.jpg", who: "Suresh B"
    }
  };

  const PERSONAS = {
    customer: [
      { phone: "9845011111", name: "Ravi Kumar", note: "Customer · Jayanagar" },
      { phone: "9845011112", name: "Ananya Rao", note: "Customer · Basavanagudi" }
    ],
    restaurant: [
      { phone: "9845022221", name: "Manjunath Gowda", note: "Owner · Spice Route Biryani" },
      { phone: "9845022222", name: "Lakshmi Iyer", note: "Owner · Udupi Grand Veg" }
    ],
    rider: [
      { phone: "9845033331", name: "Suresh B", note: "Rider · Bike (KA05AB1234)" },
      { phone: "9845033332", name: "Prakash Naik", note: "Rider · Scooter" }
    ]
  };

  const S = {
    app: ctx.kind || "customer",
    mode: "login", // 'login' | 'register'
    step: "phone", // 'phone' | 'otp' | 'done'
    phone: APPS[ctx.kind || "customer"].phone,
    otp: "",
    devOtp: "482917",
    sending: false,
    left: 30,
    wrong: false,
    reg: {
      name: "",
      email: "",
      address: "221, 9th Cross, Jayanagar 3rd Block",
      address_type: "Home",
      restaurant_name: "Spice Route Biryani House",
      cuisines: "Biryani, North Indian",
      vehicle_type: "BIKE",
      vehicle_no: "KA05AB1234"
    }
  };

  async function finish(data) {
    ctx.session.login(data.token, { user_id: data.user_id, name: data.name, roles: data.roles });
    ctx.toast(data.new_user ? "Account created successfully! Welcome to Foodu." : `Welcome back, ${data.name || "friend"}!`);
    ctx.go();
  }

  async function sendOtp() {
    const raw = S.phone.replace(/\D/g, "");
    if (raw.length !== 10) return ctx.toast("Please enter a valid 10-digit mobile number.", true);
    S.sending = true;
    ctx.refresh();

    const res = await ctx.api.run("auth.requestOtp", {
      body: { phone: raw, app: S.app, purpose: S.mode === "register" ? "REGISTER" : "LOGIN" }
    });
    S.sending = false;
    if (res) {
      S.devOtp = res.dev_otp || "482917";
      S.step = "otp";
      S.left = 30;
      S.otp = "";
      ctx.toast(`OTP sent: ${S.devOtp}`);
    }
    ctx.refresh();
  }

  async function verifyOtp() {
    const raw = S.phone.replace(/\D/g, "");
    const roleMap = { customer: "CUSTOMER", restaurant: "RESTAURANT_OWNER", rider: "DELIVERY_PARTNER" };
    const role = roleMap[S.app] || "CUSTOMER";

    const payload = { phone: raw, otp: S.otp || S.devOtp, role };
    if (S.mode === "register") {
      Object.assign(payload, {
        name: S.reg.name || "New Foodu User",
        email: S.reg.email || `${raw}@example.com`,
        restaurant_name: S.reg.restaurant_name,
        cuisines: S.reg.cuisines,
        vehicle_type: S.reg.vehicle_type,
        vehicle_no: S.reg.vehicle_no,
        address_line: S.reg.address
      });
    }

    const verified = await ctx.api.run(S.mode === "register" ? "auth.register" : "auth.verifyOtp", { body: payload });
    if (verified) {
      finish(verified);
    } else {
      S.wrong = true;
      ctx.refresh();
    }
  }

  return {
    async load() {},
    render() {
      const app = APPS[S.app] || APPS.customer;
      const isReg = S.mode === "register";

      return `
        <div style="min-height: 100vh; display: flex; flex-wrap: wrap; background: #F4F7F5;">
          
          <!-- Left Hero Aside Panel (Page 3 & 4 exact) -->
          <aside style="flex: 1 1 420px; color: #fff; padding: 56px; display: flex; flex-direction: column; gap: 28px; box-sizing: border-box; position: relative; overflow: hidden; background: #0F8E45; min-height: 540px;">
            <img src="${app.img}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: saturate(1.15);">
            <div style="position: absolute; inset: 0; background: linear-gradient(160deg, rgba(19,160,79,.92) 0%, rgba(15,142,69,.75) 45%, rgba(17,19,17,.55) 100%)"></div>
            
            <a href="index.html" style="position: relative; display: flex; align-items: center; gap: 12px; color: #fff; text-decoration: none">
              <span style="width: 48px; height: 48px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#13A04F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z"></path><path d="M9 7c0-2 1-3 3-3"></path><path d="M14 8c1-2 3-2 4-1"></path></svg>
              </span>
              <span style="font-weight: 800; font-size: 32px">Foodu</span>
            </a>

            <h1 style="position: relative; margin: 0; font-weight: 800; font-size: 52px; line-height: 1.05; letter-spacing: -0.02em;">
              ${isReg ? "Create your account" : app.title}
            </h1>
            <p style="position: relative; margin: 0; font-size: 18px; line-height: 1.5; max-width: 420px; color: #E7F6EC;">
              ${isReg ? "Join Foodu today to experience lightning-fast delivery and real-time live order tracking." : app.text}
            </p>

            <div style="position: relative; display: flex; flex-direction: column; gap: 12px; margin-top: auto">
              <div style="background: rgba(255,255,255,.16); backdrop-filter: blur(8px); border-radius: 18px; padding: 16px 20px; font-size: 15px; font-weight: 600;">
                No password to remember. The code is valid for 5 minutes.
              </div>
              <div style="background: rgba(255,255,255,.16); backdrop-filter: blur(8px); border-radius: 18px; padding: 16px 20px; font-size: 15px; font-weight: 600;">
                Restaurants and riders can start once our team approves them.
              </div>
            </div>
          </aside>

          <!-- Right Form Area (Card) -->
          <main style="flex: 999 1 560px; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
            <div class="card" style="width: 100%; max-width: 520px; padding: 40px; border-radius: 28px; box-shadow: 0 16px 40px rgba(17,19,17,.1); display: flex; flex-direction: column; gap: 22px;">
              
              <!-- Sign In / Register Header -->
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                  <h2 style="margin: 0; font-weight: 800; font-size: 34px">${isReg ? "Register" : "Sign in"}</h2>
                  <p style="margin: 4px 0 0; color: #5D6560; font-size: 15px">
                    ${isReg ? `Already registered? <a href="#" data-action="toggleAuthMode" style="font-weight:700;">Sign in</a>` : `New here? <a href="#" data-action="toggleAuthMode" style="font-weight:700;">Create an account</a>`}
                  </p>
                </div>
              </div>

              <!-- 3 App Switcher Tabs -->
              <fieldset style="border: 0; padding: 0; margin: 0">
                <legend style="padding: 0; margin-bottom: 10px; font-weight: 600; font-size: 15px;">Which app are you using?</legend>
                <div style="display: flex; gap: 10px">
                  ${Object.values(APPS).map(a => `
                    <button type="button" class="filter ${S.app === a.id ? "on" : ""}" data-action="switchApp" data-app="${a.id}" style="flex: 1; min-height: 64px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px;">
                      <b style="font-size: 15px">${a.name}</b>
                      <span style="font-size: 12px; font-weight: 500; opacity: 0.85;">${a.sub}</span>
                    </button>
                  `).join("")}
                </div>
              </fieldset>

              <!-- Step 1: Phone input form -->
              ${S.step === "phone" ? `
                <div style="display: flex; flex-direction: column; gap: 16px">
                  ${isReg ? `
                    <label style="display: flex; flex-direction: column; gap: 6px; font-weight: 600; font-size: 14px;">
                      Full name
                      <input type="text" placeholder="Ravi Kumar" value="${esc(S.reg.name)}" data-change="regName" style="min-height: 52px; border: 1.5px solid #D6DCD8; border-radius: 14px; padding: 0 16px; font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 600; outline: none;">
                    </label>
                  ` : ""}

                  <label style="display: flex; flex-direction: column; gap: 6px; font-weight: 600; font-size: 14px;">
                    Mobile number
                    <div style="display: flex; gap: 10px">
                      <span style="display: flex; align-items: center; width: 84px; justify-content: center; color: #5D6560; background: #fff; border: 1.5px solid #D6DCD8; border-radius: 14px; font-weight: 700; font-size: 17px;">+91</span>
                      <input type="tel" placeholder="98450 11111" value="${esc(S.phone)}" data-change="setPhone" style="flex: 1; min-height: 52px; border: 1.5px solid #D6DCD8; border-radius: 14px; padding: 0 16px; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; outline: none; letter-spacing: .06em;">
                    </div>
                  </label>

                  <button type="button" class="btn btn-dark" data-action="sendOtpAction" style="width: 100%; min-height: 54px; font-size: 17px; font-weight: 800;">
                    ${S.sending ? `<span class="spin"></span> Sending OTP…` : "Send OTP →"}
                  </button>

                  <!-- 1-Click Persona Shortcuts -->
                  <div style="margin-top: 10px; border-top: 1px solid #EEF1EF; padding-top: 14px;">
                    <span style="font-size: 13px; font-weight: 700; color: #5D6560; text-transform: uppercase; letter-spacing: .08em; display: block; margin-bottom: 8px;">
                      Sample Demo Accounts:
                    </span>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                      ${(PERSONAS[S.app] || []).map(p => `
                        <button type="button" class="btn btn-ghost" data-action="quickPersona" data-phone="${p.phone}" style="min-height: 38px; padding: 0 12px; font-size: 13px; border-radius: 10px;">
                          👤 <b>${p.name}</b> (${p.phone})
                        </button>
                      `).join("")}
                    </div>
                  </div>
                </div>
              ` : `
                <!-- Step 2: OTP Verification Boxes -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                  <span style="font-weight: 600; font-size: 15px; color: #111311">Enter the 6-digit verification code sent to +91 ${esc(S.phone)}</span>
                  
                  <div style="display: flex; gap: 10px; justify-content: space-between;">
                    <input type="text" maxlength="6" value="${esc(S.otp)}" data-change="setOtp" placeholder="${S.devOtp}" style="width: 100%; min-height: 56px; border: 2px solid #13A04F; border-radius: 14px; padding: 0 18px; font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; text-align: center; letter-spacing: 8px; outline: none; background: #F3FBF6;">
                  </div>

                  <div style="display: flex; justify-content: space-between; font-size: 14px; color: #5D6560;">
                    <span>${S.left > 0 ? `Resend code in 0:${String(S.left).padStart(2, "0")}` : "Didn't get code?"}</span>
                    <button type="button" data-action="backToPhone" style="border: 0; background: none; color: #0E7A3C; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer;">Change number</button>
                  </div>

                  <div style="background: #FFF6E5; color: #8A4B00; border-radius: 12px; padding: 12px 16px; font-size: 14px; font-weight: 700;">
                    ⚡ Test mode: your one-time code is <b>${S.devOtp}</b>
                  </div>

                  <button type="button" class="btn btn-green" data-action="verifyOtpAction" style="width: 100%; min-height: 54px; font-size: 17px; font-weight: 800;">
                    Verify &amp; continue →
                  </button>
                </div>
              `}

            </div>
          </main>

        </div>`;
    },
    actions: {
      toggleAuthMode() { S.mode = S.mode === "login" ? "register" : "login"; ctx.refresh(); },
      switchApp(btn) {
        S.app = btn.dataset.app;
        S.phone = APPS[S.app].phone;
        S.step = "phone";
        ctx.refresh();
      },
      setPhone(input) { S.phone = input.value; },
      setOtp(input) { S.otp = input.value; },
      regName(input) { S.reg.name = input.value; },
      backToPhone() { S.step = "phone"; ctx.refresh(); },
      async sendOtpAction() { await sendOtp(); },
      async verifyOtpAction() { await verifyOtp(); },
      async quickPersona(btn) {
        const phone = btn.dataset.phone;
        S.phone = phone;
        await sendOtp();
        S.otp = S.devOtp;
        await verifyOtp();
      }
    }
  };
};
