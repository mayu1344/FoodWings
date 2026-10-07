/* =====================================================================
   mock-server.js - DEMO MODE BACKEND (runs inside the browser)
   ---------------------------------------------------------------------
   Answers every operation in operations.js with the SAME data shapes and
   the SAME envelope as the FastAPI server, using the seed data from
   db/03_seed.sql. Lets you click through the whole app with no server.
   Delete this file (and set mode "live") when you only use the real API.
   ===================================================================== */
(function () {
  const STORE_KEY = "foodwings.demo.db.v1";
  const DELIVERY_FEE = 30, PLATFORM_FEE = 5, TAX_PCT = 5;
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const now = () => new Date().toISOString();
  const r2 = (n) => Math.round(n * 100) / 100;

  // ---------------- seed (mirrors db/03_seed.sql) ----------------
  function seed() {
    return {
      seq: { user: 1000, address: 100, cart: 10, cart_item: 100, order: 9004, payment: 6004, assignment: 10, history: 100, earning: 10, payout: 10, refund: 1, method: 10, rating: 10 },
      users: [
        { user_id: 101, phone: "9845011111", name: "Ravi Kumar", email: "ravi@example.com", roles: ["CUSTOMER"] },
        { user_id: 102, phone: "9845011112", name: "Ananya Rao", email: "ananya@example.com", roles: ["CUSTOMER"] },
        { user_id: 103, phone: "9845011113", name: "Mohammed Irfan", email: "irfan@example.com", roles: ["CUSTOMER"] },
        { user_id: 104, phone: "9845011114", name: "Sneha Patil", email: "sneha@example.com", roles: ["CUSTOMER"] },
        { user_id: 105, phone: "9845011115", name: "Kiran Desai", email: "kiran@example.com", roles: ["CUSTOMER", "DELIVERY_PARTNER"] },
        { user_id: 201, phone: "9845022221", name: "Manjunath Gowda", email: null, roles: ["RESTAURANT_OWNER"] },
        { user_id: 202, phone: "9845022222", name: "Lakshmi Iyer", email: null, roles: ["RESTAURANT_OWNER"] },
        { user_id: 203, phone: "9845022223", name: "Arjun Shetty", email: null, roles: ["RESTAURANT_OWNER"] },
        { user_id: 204, phone: "9845022224", name: "Deepa N", email: null, roles: ["RESTAURANT_STAFF"] },
        { user_id: 205, phone: "9845022225", name: "Shivanand Hiremath", email: null, roles: ["RESTAURANT_OWNER"] },
        { user_id: 301, phone: "9845033331", name: "Suresh B", email: null, roles: ["DELIVERY_PARTNER"] },
        { user_id: 302, phone: "9845033332", name: "Prakash Naik", email: null, roles: ["DELIVERY_PARTNER"] },
        { user_id: 303, phone: "9845033333", name: "Venkatesh R", email: null, roles: ["DELIVERY_PARTNER"] },
        { user_id: 304, phone: "9845033334", name: "Imran Khan", email: null, roles: ["DELIVERY_PARTNER"] },
        { user_id: 401, phone: "9845044441", name: "Ops Admin", email: null, roles: ["ADMIN"] },
      ],
      restaurants: [
        { restaurant_id: 1, name: "Spice Route Biryani House", address_line: "12, 11th Main, Jayanagar 4th Block", city: "Bengaluru", latitude: 12.9254, longitude: 77.5838, cuisines: "Biryani, Andhra, North Indian", status: "ACTIVE", is_open: true, avg_rating: 4.4, rating_count: 1250, avg_prep_mins: 20, commission_pct: 18 },
        { restaurant_id: 2, name: "Udupi Grand Veg", address_line: "45, Bull Temple Road, Basavanagudi", city: "Bengaluru", latitude: 12.9421, longitude: 77.5753, cuisines: "South Indian, Beverages", status: "ACTIVE", is_open: true, avg_rating: 4.6, rating_count: 3400, avg_prep_mins: 12, commission_pct: 15 },
        { restaurant_id: 3, name: "Slice Street Pizza", address_line: "80 Feet Road, Koramangala 4th Block", city: "Bengaluru", latitude: 12.9352, longitude: 77.6245, cuisines: "Pizza, Italian, Fast Food", status: "ACTIVE", is_open: true, avg_rating: 4.1, rating_count: 860, avg_prep_mins: 25, commission_pct: 20 },
        { restaurant_id: 4, name: "Nandini Tiffin Centre", address_line: "3rd Cross, JP Nagar 2nd Phase", city: "Bengaluru", latitude: 12.9108, longitude: 77.5859, cuisines: "South Indian", status: "PENDING", is_open: false, avg_rating: 0, rating_count: 0, avg_prep_mins: 15, commission_pct: 15 },
      ],
      staff: [{ restaurant_id: 1, user_id: 201, staff_role: "OWNER" }, { restaurant_id: 1, user_id: 204, staff_role: "MANAGER" },
              { restaurant_id: 2, user_id: 202, staff_role: "OWNER" }, { restaurant_id: 3, user_id: 203, staff_role: "OWNER" },
              { restaurant_id: 4, user_id: 205, staff_role: "OWNER" }],
      categories: [
        { category_id: 11, restaurant_id: 1, name: "Biryani", sort_order: 1 }, { category_id: 12, restaurant_id: 1, name: "Starters", sort_order: 2 },
        { category_id: 13, restaurant_id: 1, name: "Desserts", sort_order: 3 }, { category_id: 21, restaurant_id: 2, name: "South Indian", sort_order: 1 },
        { category_id: 22, restaurant_id: 2, name: "Beverages", sort_order: 2 }, { category_id: 31, restaurant_id: 3, name: "Pizzas", sort_order: 1 },
        { category_id: 32, restaurant_id: 3, name: "Sides", sort_order: 2 }, { category_id: 41, restaurant_id: 4, name: "Breakfast", sort_order: 1 },
      ],
      items: [
        { item_id: 501, restaurant_id: 1, category_id: 11, name: "Chicken Dum Biryani", description: "Slow-cooked basmati with tender chicken", price: 320, is_veg: false, in_stock: true },
        { item_id: 502, restaurant_id: 1, category_id: 11, name: "Mutton Biryani", description: "Hyderabadi style mutton biryani", price: 420, is_veg: false, in_stock: true },
        { item_id: 503, restaurant_id: 1, category_id: 11, name: "Veg Biryani", description: "Mixed vegetables and basmati rice", price: 240, is_veg: true, in_stock: true },
        { item_id: 504, restaurant_id: 1, category_id: 12, name: "Chicken 65", description: "Spicy deep-fried chicken", price: 260, is_veg: false, in_stock: true },
        { item_id: 505, restaurant_id: 1, category_id: 12, name: "Paneer 65", description: "Spicy fried paneer cubes", price: 230, is_veg: true, in_stock: false },
        { item_id: 506, restaurant_id: 1, category_id: 13, name: "Gulab Jamun (2 pcs)", description: "Warm and soft", price: 90, is_veg: true, in_stock: true },
        { item_id: 511, restaurant_id: 2, category_id: 21, name: "Masala Dosa", description: "Crispy dosa with potato masala", price: 110, is_veg: true, in_stock: true },
        { item_id: 512, restaurant_id: 2, category_id: 21, name: "Idli Vada", description: "2 idli + 1 vada with chutney & sambar", price: 80, is_veg: true, in_stock: true },
        { item_id: 513, restaurant_id: 2, category_id: 21, name: "Rava Idli", description: "Served with sagu", price: 90, is_veg: true, in_stock: true },
        { item_id: 514, restaurant_id: 2, category_id: 22, name: "Filter Coffee", description: "Strong South Indian coffee", price: 40, is_veg: true, in_stock: true },
        { item_id: 521, restaurant_id: 3, category_id: 31, name: "Margherita Pizza (Medium)", description: "Classic cheese and tomato", price: 299, is_veg: true, in_stock: true },
        { item_id: 522, restaurant_id: 3, category_id: 31, name: "Farmhouse Pizza (Medium)", description: "Onion, capsicum, mushroom, tomato", price: 399, is_veg: true, in_stock: true },
        { item_id: 523, restaurant_id: 3, category_id: 31, name: "Chicken Tikka Pizza (Medium)", description: "Tandoori chicken tikka topping", price: 449, is_veg: false, in_stock: true },
        { item_id: 524, restaurant_id: 3, category_id: 32, name: "Garlic Bread", description: "With cheese dip", price: 149, is_veg: true, in_stock: true },
        { item_id: 531, restaurant_id: 4, category_id: 41, name: "Set Dosa", description: "3 soft dosas", price: 70, is_veg: true, in_stock: true },
      ],
      addons: [
        { addon_id: 801, item_id: 501, name: "Extra Raita", price: 30, in_stock: true }, { addon_id: 802, item_id: 501, name: "Extra Chicken Piece", price: 90, in_stock: true },
        { addon_id: 803, item_id: 511, name: "Extra Chutney", price: 0, in_stock: true }, { addon_id: 804, item_id: 521, name: "Extra Cheese", price: 60, in_stock: true },
        { addon_id: 805, item_id: 522, name: "Extra Cheese", price: 60, in_stock: true },
      ],
      addresses: [
        { address_id: 11, user_id: 101, label: "Home", address_line: "221, 9th Cross, Jayanagar 3rd Block", landmark: "Near Cool Joint", city: "Bengaluru", latitude: 12.9293, longitude: 77.5821, is_default: true },
        { address_id: 12, user_id: 101, label: "Work", address_line: "Prestige Tech Park, Koramangala", landmark: "Gate 2", city: "Bengaluru", latitude: 12.9369, longitude: 77.6266, is_default: false },
        { address_id: 13, user_id: 102, label: "Home", address_line: "14, Gandhi Bazaar Main Road, Basavanagudi", landmark: null, city: "Bengaluru", latitude: 12.945, longitude: 77.5735, is_default: true },
        { address_id: 14, user_id: 103, label: "Home", address_line: "56, 5th Block, Koramangala", landmark: "Opp. Forum Mall", city: "Bengaluru", latitude: 12.934, longitude: 77.618, is_default: true },
        { address_id: 15, user_id: 104, label: "Home", address_line: "90, 30th Cross, Jayanagar 4th T Block", landmark: null, city: "Bengaluru", latitude: 12.921, longitude: 77.587, is_default: true },
        { address_id: 16, user_id: 105, label: "Home", address_line: "7, JP Nagar 3rd Phase", landmark: null, city: "Bengaluru", latitude: 12.908, longitude: 77.59, is_default: true },
      ],
      coupons: [
        { coupon_id: 1, code: "WELCOME50", discount_type: "PERCENT", discount_value: 50, min_order_value: 149, max_discount: 100, active: true },
        { coupon_id: 2, code: "FLAT75", discount_type: "FLAT", discount_value: 75, min_order_value: 299, max_discount: null, active: true },
        { coupon_id: 3, code: "DIWALI20", discount_type: "PERCENT", discount_value: 20, min_order_value: 199, max_discount: 80, active: false },
      ],
      carts: [{ cart_id: 1, user_id: 102, restaurant_id: 2 }],
      cart_items: [{ cart_item_id: 1, cart_id: 1, item_id: 511, quantity: 2, selected_addons: [803] }, { cart_item_id: 2, cart_id: 1, item_id: 514, quantity: 2, selected_addons: [] }],
      partners: [
        { partner_id: 301, vehicle_type: "BIKE", city: "Bengaluru", kyc_status: "VERIFIED", is_online: true, current_order_id: null, rating: 4.7 },
        { partner_id: 302, vehicle_type: "SCOOTER", city: "Bengaluru", kyc_status: "VERIFIED", is_online: true, current_order_id: null, rating: 4.5 },
        { partner_id: 303, vehicle_type: "EV", city: "Bengaluru", kyc_status: "VERIFIED", is_online: false, current_order_id: null, rating: 4.8 },
        { partner_id: 304, vehicle_type: "BIKE", city: "Bengaluru", kyc_status: "PENDING_KYC", is_online: false, current_order_id: null, rating: 0 },
        { partner_id: 105, vehicle_type: "BIKE", city: "Bengaluru", kyc_status: "VERIFIED", is_online: false, current_order_id: null, rating: 4.6 },
      ],
      locations: { 301: { latitude: 12.9268, longitude: 77.585, updated_at: now() }, 302: { latitude: 12.9405, longitude: 77.578, updated_at: now() },
                   303: { latitude: 12.915, longitude: 77.6, updated_at: now() }, 105: { latitude: 12.9081, longitude: 77.5901, updated_at: now() } },
      methods: [
        { method_id: 1, user_id: 101, method_type: "CARD", gateway_token: "tok_mock_7f3a9c1e2b4d", card_network: "VISA", card_last4: "1111", card_expiry_month: 12, card_expiry_year: 2029, upi_vpa_masked: null, is_default: true },
        { method_id: 2, user_id: 101, method_type: "UPI", gateway_token: "tok_mock_upi_51ac0e9d", card_network: null, card_last4: null, card_expiry_month: null, card_expiry_year: null, upi_vpa_masked: "ra****@okaxis", is_default: false },
        { method_id: 3, user_id: 102, method_type: "CARD", gateway_token: "tok_mock_88d1e0f4a6c2", card_network: "MASTERCARD", card_last4: "4444", card_expiry_month: 8, card_expiry_year: 2028, upi_vpa_masked: null, is_default: true },
      ],
      vault: {   // the gateway's side: token -> card facts (never a CVV, never a full number)
        tok_mock_7f3a9c1e2b4d: { type: "CARD", network: "VISA", last4: "1111", decline: false },
        tok_mock_88d1e0f4a6c2: { type: "CARD", network: "MASTERCARD", last4: "4444", decline: false },
        tok_mock_upi_51ac0e9d: { type: "UPI", vpa_masked: "ra****@okaxis", decline: false },
      },
      orders: [
        { order_id: 9001, customer_id: 101, restaurant_id: 1, partner_id: 301, address_id: 11, coupon_id: null, item_total: 440, delivery_fee: 30, platform_fee: 5, taxes: 22, discount: 0, total_amount: 497, payment_mode: "CARD", status: "DELIVERED", special_instructions: null, placed_at: ago(26 * 60), delivered_at: ago(25 * 60) },
        { order_id: 9002, customer_id: 102, restaurant_id: 2, partner_id: 302, address_id: 13, coupon_id: null, item_total: 300, delivery_fee: 25, platform_fee: 5, taxes: 15, discount: 0, total_amount: 345, payment_mode: "COD", status: "DELIVERED", special_instructions: null, placed_at: ago(72 * 60), delivered_at: ago(72 * 60 - 28) },
        { order_id: 9003, customer_id: 103, restaurant_id: 3, partner_id: null, address_id: 14, coupon_id: 2, item_total: 449, delivery_fee: 40, platform_fee: 5, taxes: 22.45, discount: 75, total_amount: 441.45, payment_mode: "UPI", status: "PAYMENT_FAILED", special_instructions: null, placed_at: ago(300), delivered_at: null },
        { order_id: 9004, customer_id: 104, restaurant_id: 1, partner_id: null, address_id: 15, coupon_id: 1, item_total: 680, delivery_fee: 30, platform_fee: 5, taxes: 34, discount: 100, total_amount: 649, payment_mode: "UPI", status: "PLACED", special_instructions: "Less spicy please", placed_at: ago(3), delivered_at: null },
      ],
      order_items: [
        { order_id: 9001, item_id: 501, item_name: "Chicken Dum Biryani", quantity: 1, price_at_order: 320, addons: [{ addon_id: 801, name: "Extra Raita", price: 30 }], line_total: 350 },
        { order_id: 9001, item_id: 506, item_name: "Gulab Jamun (2 pcs)", quantity: 1, price_at_order: 90, addons: [], line_total: 90 },
        { order_id: 9002, item_id: 511, item_name: "Masala Dosa", quantity: 2, price_at_order: 110, addons: [], line_total: 220 },
        { order_id: 9002, item_id: 514, item_name: "Filter Coffee", quantity: 2, price_at_order: 40, addons: [], line_total: 80 },
        { order_id: 9003, item_id: 523, item_name: "Chicken Tikka Pizza (Medium)", quantity: 1, price_at_order: 449, addons: [], line_total: 449 },
        { order_id: 9004, item_id: 502, item_name: "Mutton Biryani", quantity: 1, price_at_order: 420, addons: [], line_total: 420 },
        { order_id: 9004, item_id: 504, item_name: "Chicken 65", quantity: 1, price_at_order: 260, addons: [], line_total: 260 },
      ],
      history: [
        { order_id: 9001, status: "PAYMENT_PENDING", changed_by: 101, note: null, changed_at: ago(26 * 60) },
        { order_id: 9001, status: "PLACED", changed_by: null, note: "payment captured", changed_at: ago(26 * 60 - 1) },
        { order_id: 9001, status: "ACCEPTED", changed_by: 201, note: null, changed_at: ago(26 * 60 - 2) },
        { order_id: 9001, status: "READY", changed_by: 204, note: null, changed_at: ago(26 * 60 - 20) },
        { order_id: 9001, status: "PICKED_UP", changed_by: 301, note: null, changed_at: ago(26 * 60 - 22) },
        { order_id: 9001, status: "DELIVERED", changed_by: 301, note: null, changed_at: ago(25 * 60) },
        { order_id: 9002, status: "PLACED", changed_by: 102, note: null, changed_at: ago(72 * 60) },
        { order_id: 9002, status: "DELIVERED", changed_by: 302, note: null, changed_at: ago(72 * 60 - 28) },
        { order_id: 9003, status: "PAYMENT_PENDING", changed_by: 103, note: null, changed_at: ago(300) },
        { order_id: 9003, status: "PAYMENT_FAILED", changed_by: null, note: "UPI_DECLINED", changed_at: ago(297) },
        { order_id: 9004, status: "PAYMENT_PENDING", changed_by: 104, note: null, changed_at: ago(4) },
        { order_id: 9004, status: "PLACED", changed_by: null, note: "payment captured", changed_at: ago(3) },
      ],
      payments: [
        { payment_id: 6001, order_id: 9001, user_id: 101, method_type: "CARD", status: "CAPTURED", amount: 497, card_network: "VISA", card_last4: "1111", gateway_order_ref: "mock_order_9001", gateway_payment_ref: "mock_pay_9001", idempotency_key: "idem-9001-1" },
        { payment_id: 6002, order_id: 9002, user_id: 102, method_type: "COD", status: "COD_COLLECTED", amount: 345, card_network: null, card_last4: null, idempotency_key: "idem-9002-1" },
        { payment_id: 6003, order_id: 9003, user_id: 103, method_type: "UPI", status: "FAILED", amount: 441.45, card_network: null, card_last4: null, gateway_order_ref: "mock_order_9003", idempotency_key: "idem-9003-1" },
        { payment_id: 6004, order_id: 9004, user_id: 104, method_type: "UPI", status: "CAPTURED", amount: 649, card_network: null, card_last4: null, gateway_order_ref: "mock_order_9004", gateway_payment_ref: "mock_pay_9004", idempotency_key: "idem-9004-1" },
      ],
      assignments: [
        { assignment_id: 1, order_id: 9001, partner_id: 302, status: "REJECTED" }, { assignment_id: 2, order_id: 9001, partner_id: 301, status: "ACCEPTED" },
        { assignment_id: 3, order_id: 9002, partner_id: 302, status: "ACCEPTED" },
      ],
      earnings: [
        { earning_id: 1, partner_id: 301, order_id: 9001, base_pay: 25, distance_pay: 10, tip: 20, payout_status: "PAID", created_at: ago(25 * 60) },
        { earning_id: 2, partner_id: 302, order_id: 9002, base_pay: 25, distance_pay: 5, tip: 0, payout_status: "PENDING", created_at: ago(72 * 60) },
      ],
      payouts: [
        { payout_id: 1, restaurant_id: 1, order_id: 9001, order_amount: 440, commission: 79.2, payout_amount: 360.8, payout_status: "PAID", created_at: ago(25 * 60) },
        { payout_id: 2, restaurant_id: 2, order_id: 9002, order_amount: 300, commission: 45, payout_amount: 255, payout_status: "PENDING", created_at: ago(72 * 60) },
      ],
      ratings: [{ order_id: 9001, user_id: 101, food_rating: 5, delivery_rating: 4, comment: "Biryani was hot and tasty!" }, { order_id: 9002, user_id: 102, food_rating: 5, delivery_rating: 5, comment: null }],
      gw_orders: {},
      otps: {},
    };
  }

  let db;
  function loadDb() {
    try { db = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { db = null; }
    if (!db) db = seed();
    if (!db.otps) db.otps = {};
  }
  function saveDb() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }
  function resetDb() { db = seed(); saveDb(); }
  loadDb();

  // ---------------- helpers that mirror the server ----------------
  class ApiError extends Error { constructor(status, message, details = null) { super(message); this.status = status; this.details = details; } }
  const fail = (status, message, details) => { throw new ApiError(status, message, details); };
  const next = (k) => ++db.seq[k];
  const user = (id) => db.users.find((u) => u.user_id === id);
  const CODES = { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 402: "PAYMENT_FAILED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR", 429: "TOO_MANY_REQUESTS", 500: "SERVER_ERROR" };

  function makeToken(u) { return "demo." + btoa(JSON.stringify({ uid: u.user_id, roles: u.roles })); }
  function readToken(token) {
    if (!token) return null;
    try { const p = JSON.parse(atob(token.split(".")[1])); return { user_id: p.uid, roles: p.roles }; } catch (e) { return null; }
  }
  function authorize(op, token) {
    if (op.auth === false) return readToken(token);
    const me = readToken(token);
    if (!me) fail(401, "Missing token");
    if (typeof op.auth === "string") {
      const allowed = op.auth.split("|");
      if (!allowed.some((r) => me.roles.includes(r))) fail(403, `This action needs one of these roles: ${allowed.join(", ")}`);
    }
    return me;
  }
  function onlyFields(body, allowed) {   // like Pydantic extra="forbid" - and never echoes values
    const extra = Object.keys(body || {}).filter((k) => !allowed.includes(k));
    if (extra.length) fail(422, "Some fields are missing or invalid", extra.map((f) => ({ field: f, error: "field not allowed" })));
  }
  const ALLOWED = { PAYMENT_PENDING: ["PLACED", "PAYMENT_FAILED", "CANCELLED"], PAYMENT_FAILED: ["PLACED", "CANCELLED"], PLACED: ["ACCEPTED", "CANCELLED"],
                    ACCEPTED: ["PREPARING", "READY", "CANCELLED"], PREPARING: ["READY"], READY: ["PICKED_UP"], PICKED_UP: ["DELIVERED"] };
  function changeStatus(orderId, status, by, note = null) {
    const o = db.orders.find((x) => x.order_id === orderId) || fail(404, "Order not found");
    if (!(ALLOWED[o.status] || []).includes(status)) fail(409, `Cannot move order from ${o.status} to ${status}`);
    o.status = status;
    if (status === "DELIVERED") o.delivered_at = now();
    db.history.push({ order_id: orderId, status, changed_by: by, note, changed_at: now() });
    return o;
  }
  function km(a, b) {
    const R = 6371, t = Math.PI / 180;
    const x = Math.sin((b.latitude - a.latitude) * t / 2) ** 2 + Math.cos(a.latitude * t) * Math.cos(b.latitude * t) * Math.sin((b.longitude - a.longitude) * t / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function offerNearest(orderId) {
    const o = db.orders.find((x) => x.order_id === orderId);
    const r = db.restaurants.find((x) => x.restaurant_id === o.restaurant_id);
    const free = db.partners.filter((p) => p.is_online && p.kyc_status === "VERIFIED" && !p.current_order_id && p.partner_id !== o.customer_id
      && db.locations[p.partner_id]
      && !db.assignments.some((a) => a.order_id === orderId && a.partner_id === p.partner_id)
      && !db.assignments.some((a) => a.partner_id === p.partner_id && a.status === "OFFERED"));
    free.sort((a, b) => km(db.locations[a.partner_id], r) - km(db.locations[b.partner_id], r));
    if (!free.length) return null;
    const a = { assignment_id: next("assignment"), order_id: orderId, partner_id: free[0].partner_id, status: "OFFERED" };
    db.assignments.push(a);
    return a;
  }
  function cartView(uid) {
    const cart = db.carts.find((c) => c.user_id === uid);
    if (!cart) return { cart_id: null, restaurant_id: null, items: [], item_total: 0 };
    const items = db.cart_items.filter((ci) => ci.cart_id === cart.cart_id).map((ci) => {
      const it = db.items.find((i) => i.item_id === ci.item_id);
      const addonSum = ci.selected_addons.reduce((s, id) => s + db.addons.find((a) => a.addon_id === id).price, 0);
      return { cart_item_id: ci.cart_item_id, item_id: ci.item_id, name: it.name, price: it.price, quantity: ci.quantity,
               selected_addons: ci.selected_addons, in_stock: it.in_stock, line_total: ci.quantity * (it.price + addonSum) };
    });
    return { cart_id: cart.cart_id, restaurant_id: cart.restaurant_id, items, item_total: items.reduce((s, i) => s + i.line_total, 0) };
  }
  const isStaff = (rid, uid) => db.staff.some((s) => s.restaurant_id === rid && s.user_id === uid);
  const staffOrFail = (rid, uid) => isStaff(rid, uid) || fail(403, "You are not staff of this restaurant");
  const num = (v) => Number(v);

  // ---------------- one handler per operation ----------------
  const H = {
    "auth.requestOtp"({ body }) {
      if (!/^\+?[0-9]{10,14}$/.test(body?.phone || "")) fail(422, "Some fields are missing or invalid", [{ field: "phone", error: "String should match pattern" }]);
      const otp = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
      db.otps[body.phone] = { otp, attempts: 0, expires: Date.now() + 300000 };
      return { message: "OTP sent", expires_in_seconds: 300, dev_otp: otp };
    },
    "auth.verifyOtp"({ body }) {
      const rec = db.otps[body.phone];
      if (!rec || rec.expires < Date.now()) fail(400, "OTP expired, request a new one");
      if (rec.attempts >= 5) fail(429, "Too many attempts");
      if (rec.otp !== body.otp) { rec.attempts++; fail(400, "Wrong OTP"); }
      delete db.otps[body.phone];
      let u = db.users.find((x) => x.phone === body.phone), isNew = false;
      const targetRole = body.role || "CUSTOMER";
      if (!u) {
        u = { user_id: next("user"), phone: body.phone, name: body.name || "New User", email: body.email || null, roles: [targetRole] };
        if (targetRole !== "CUSTOMER") u.roles.push("CUSTOMER");
        db.users.push(u);
        isNew = true;
      } else {
        if (body.name) u.name = body.name;
        if (body.email) u.email = body.email;
        if (!u.roles.includes(targetRole)) u.roles.push(targetRole);
      }

      if (targetRole === "RESTAURANT_OWNER" && !db.staff.some(s => s.user_id === u.user_id)) {
        const rid = db.restaurants.length + 1;
        const rName = body.restaurant_name || `${u.name}'s Kitchen`;
        db.restaurants.push({
          restaurant_id: rid, name: rName, address_line: body.restaurant_address || "12th Main Road, Indiranagar",
          city: body.city || "Bengaluru", latitude: 12.935, longitude: 77.585, cuisines: body.cuisines || "Multi-Cuisine",
          status: "ACTIVE", is_open: true, avg_rating: 4.5, rating_count: 10, avg_prep_mins: 20, commission_pct: 15
        });
        db.staff.push({ restaurant_id: rid, user_id: u.user_id, staff_role: "OWNER" });
        const catId = db.categories.length + 1;
        db.categories.push({ category_id: catId, restaurant_id: rid, name: "Main Course", sort_order: 1 });
        db.items.push({ item_id: db.items.length + 500, restaurant_id: rid, category_id: catId, name: "Chef Special Meal", description: "Freshly prepared meal", price: 249, is_veg: true, in_stock: true });
      }

      if (targetRole === "DELIVERY_PARTNER" && !db.partners.some(p => p.partner_id === u.user_id)) {
        db.partners.push({
          partner_id: u.user_id, vehicle_type: body.vehicle_type || "BIKE", vehicle_no: body.vehicle_no || "KA05XY9999",
          licence_no: body.licence_no || "KA0520240099999", city: body.city || "Bengaluru", kyc_status: "VERIFIED", is_online: true, rating: 4.8
        });
        db.locations[u.user_id] = { latitude: 12.934, longitude: 77.585 };
      }

      if (targetRole === "CUSTOMER" && !db.addresses.some(a => a.user_id === u.user_id)) {
        db.addresses.push({
          address_id: next("address"), user_id: u.user_id, label: "Home",
          address_line: "24, 7th Cross, Koramangala", landmark: "Near Park", city: "Bengaluru",
          latitude: 12.935, longitude: 77.62, is_default: true
        });
      }

      return { token: makeToken(u), user_id: u.user_id, name: u.name, roles: u.roles, new_user: isNew };
    },
    "auth.me"({ me }) { const u = user(me.user_id); return { user_id: u.user_id, name: u.name, phone: u.phone, email: u.email, roles: u.roles }; },

    "restaurants.list"({ me, query }) {
      const a = db.addresses.find((x) => x.address_id === num(query.address_id) && x.user_id === me.user_id) || fail(404, "Address not found");
      return db.restaurants.filter((r) => r.status === "ACTIVE" && r.is_open && r.city === a.city)
        .map((r) => ({ r, d: km(a, r) })).filter((x) => x.d <= 7).sort((x, y) => x.d - y.d)
        .map(({ r, d }) => ({ restaurant_id: r.restaurant_id, name: r.name, cuisines: r.cuisines, avg_rating: r.avg_rating, avg_prep_mins: r.avg_prep_mins,
                             distance_km: r2(d), eta_mins: Math.round(r.avg_prep_mins + d * 4 + 5) }));
    },
    "restaurants.menu"({ params }) {
      const r = db.restaurants.find((x) => x.restaurant_id === num(params.restaurant_id));
      if (!r || r.status !== "ACTIVE") fail(404, "Restaurant not found");
      const menu = db.categories.filter((c) => c.restaurant_id === r.restaurant_id).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({
        category: c.name,
        items: db.items.filter((i) => i.category_id === c.category_id).sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({
          item_id: i.item_id, name: i.name, description: i.description, price: i.price, is_veg: i.is_veg, in_stock: i.in_stock,
          addons: db.addons.filter((a) => a.item_id === i.item_id && a.in_stock).map(({ addon_id, name, price }) => ({ addon_id, name, price })),
        })),
      }));
      return { restaurant: { restaurant_id: r.restaurant_id, name: r.name, is_open: r.is_open, status: r.status }, menu };
    },
    "addresses.list"({ me }) { return db.addresses.filter((a) => a.user_id === me.user_id).sort((a, b) => b.is_default - a.is_default); },
    "addresses.add"({ me, body }) {
      onlyFields(body, ["label", "address_line", "landmark", "city", "latitude", "longitude", "is_default"]);
      if (!body.address_line || !body.city) fail(422, "Some fields are missing or invalid", [{ field: "address_line", error: "Field required" }]);
      if (body.is_default) db.addresses.filter((a) => a.user_id === me.user_id).forEach((a) => (a.is_default = false));
      const a = { address_id: next("address"), user_id: me.user_id, label: body.label || "Home", address_line: body.address_line, landmark: body.landmark || null,
                  city: body.city, latitude: num(body.latitude), longitude: num(body.longitude), is_default: !!body.is_default };
      db.addresses.push(a);
      return a;
    },
    "cart.get"({ me }) { return cartView(me.user_id); },
    "cart.addItem"({ me, body }) {
      onlyFields(body, ["item_id", "quantity", "addon_ids", "replace_cart"]);
      const it = db.items.find((i) => i.item_id === num(body.item_id));
      const r = it && db.restaurants.find((x) => x.restaurant_id === it.restaurant_id);
      if (!it || r.status !== "ACTIVE") fail(404, "Item not found");
      if (!it.in_stock) fail(409, "Item is sold out");
      const addons = [...new Set(body.addon_ids || [])].sort((a, b) => a - b);
      if (addons.some((id) => !db.addons.some((a) => a.addon_id === id && a.item_id === it.item_id))) fail(400, "Invalid add-on for this item");
      let cart = db.carts.find((c) => c.user_id === me.user_id);
      if (cart && cart.restaurant_id && cart.restaurant_id !== it.restaurant_id && db.cart_items.some((ci) => ci.cart_id === cart.cart_id)) {
        if (!body.replace_cart) fail(409, "Cart has items from another restaurant. Send replace_cart=true to start a new cart.");
        db.cart_items = db.cart_items.filter((ci) => ci.cart_id !== cart.cart_id);
      }
      if (!cart) { cart = { cart_id: next("cart"), user_id: me.user_id, restaurant_id: it.restaurant_id }; db.carts.push(cart); }
      cart.restaurant_id = it.restaurant_id;
      const same = db.cart_items.find((ci) => ci.cart_id === cart.cart_id && ci.item_id === it.item_id && JSON.stringify(ci.selected_addons) === JSON.stringify(addons));
      if (same) same.quantity = num(body.quantity);
      else db.cart_items.push({ cart_item_id: next("cart_item"), cart_id: cart.cart_id, item_id: it.item_id, quantity: num(body.quantity), selected_addons: addons });
      return cartView(me.user_id);
    },
    "cart.removeItem"({ me, params }) {
      const cart = db.carts.find((c) => c.user_id === me.user_id);
      if (cart) db.cart_items = db.cart_items.filter((ci) => !(ci.cart_id === cart.cart_id && ci.cart_item_id === num(params.cart_item_id)));
      return cartView(me.user_id);
    },
    "paymentMethods.list"({ me }) {
      return db.methods.filter((m) => m.user_id === me.user_id).map(({ gateway_token, user_id, ...safe }) => safe);
    },
    "orders.checkout"({ me, body }) {
      onlyFields(body, ["address_id", "payment_mode", "coupon_code", "special_instructions", "idempotency_key"]);
      const dup = db.payments.find((p) => p.idempotency_key === body.idempotency_key);
      if (dup) { const o = db.orders.find((x) => x.order_id === dup.order_id); return { order_id: dup.order_id, payment_id: dup.payment_id, order_status: o.status, amount: dup.amount, duplicate: true }; }
      const addr = db.addresses.find((a) => a.address_id === num(body.address_id) && a.user_id === me.user_id) || fail(404, "Address not found");
      const cv = cartView(me.user_id);
      if (!cv.items.length) fail(400, "Cart is empty");
      const r = db.restaurants.find((x) => x.restaurant_id === cv.restaurant_id);
      if (r.status !== "ACTIVE" || !r.is_open) fail(409, "Restaurant is closed right now");
      const sold = cv.items.filter((i) => !i.in_stock).map((i) => i.name);
      if (sold.length) fail(409, "Sold out: " + sold.join(", "));
      let coupon = null, discount = 0;
      if (body.coupon_code) {
        coupon = db.coupons.find((c) => c.code === body.coupon_code.toUpperCase() && c.active) || fail(400, "Coupon is invalid or expired");
        if (cv.item_total < coupon.min_order_value) fail(400, `Coupon needs a minimum order of Rs ${coupon.min_order_value}`);
        discount = coupon.discount_type === "FLAT" ? coupon.discount_value : Math.min(cv.item_total * coupon.discount_value / 100, coupon.max_discount ?? Infinity);
        discount = r2(Math.min(discount, cv.item_total));
      }
      const taxes = r2(cv.item_total * TAX_PCT / 100);
      const total = r2(cv.item_total + DELIVERY_FEE + PLATFORM_FEE + taxes - discount);
      const cod = body.payment_mode === "COD";
      const o = { order_id: next("order"), customer_id: me.user_id, restaurant_id: r.restaurant_id, partner_id: null, address_id: addr.address_id,
                  coupon_id: coupon?.coupon_id ?? null, item_total: cv.item_total, delivery_fee: DELIVERY_FEE, platform_fee: PLATFORM_FEE, taxes, discount,
                  total_amount: total, payment_mode: body.payment_mode, status: cod ? "PLACED" : "PAYMENT_PENDING",
                  special_instructions: body.special_instructions || null, placed_at: now(), delivered_at: null };
      db.orders.push(o);
      cv.items.forEach((i) => db.order_items.push({ order_id: o.order_id, item_id: i.item_id, item_name: i.name, quantity: i.quantity, price_at_order: i.price,
        addons: i.selected_addons.map((id) => { const a = db.addons.find((x) => x.addon_id === id); return { addon_id: id, name: a.name, price: a.price }; }), line_total: i.line_total }));
      db.history.push({ order_id: o.order_id, status: o.status, changed_by: me.user_id, note: null, changed_at: now() });
      const gwRef = cod ? null : "mock_order_" + Math.random().toString(16).slice(2, 14);
      if (gwRef) db.gw_orders[gwRef] = { amount: total };
      const p = { payment_id: next("payment"), order_id: o.order_id, user_id: me.user_id, method_type: body.payment_mode, amount: total,
                  status: cod ? "COD_PENDING" : "CREATED", card_network: null, card_last4: null, gateway_order_ref: gwRef, idempotency_key: body.idempotency_key };
      db.payments.push(p);
      if (cod) db.cart_items = db.cart_items.filter((ci) => ci.cart_id !== cv.cart_id);
      return { order_id: o.order_id, payment_id: p.payment_id, order_status: o.status,
               bill: { item_total: cv.item_total, delivery_fee: DELIVERY_FEE, platform_fee: PLATFORM_FEE, taxes, discount, total },
               gateway_order_ref: gwRef,
               next_step: cod ? "COD: wait for restaurant" : `Collect card/UPI in the gateway SDK, then POST /payments/${p.payment_id}/pay with the token` };
    },
    "payments.pay"({ me, params, body }) {
      onlyFields(body, ["saved_method_id", "gateway_token", "save_method", "card_network", "card_last4", "card_expiry_month", "card_expiry_year"]);
      if (!body.saved_method_id && !body.gateway_token) fail(400, "Send saved_method_id or gateway_token");
      const p = db.payments.find((x) => x.payment_id === num(params.payment_id) && x.user_id === me.user_id) || fail(404, "Payment not found");
      const o = db.orders.find((x) => x.order_id === p.order_id);
      if (p.status === "CAPTURED") return { payment_id: p.payment_id, status: "CAPTURED", order_id: o.order_id, duplicate: true };
      if (!["CREATED", "FAILED"].includes(p.status) || !["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(o.status)) fail(409, `Payment is ${p.status}, order is ${o.status}`);
      let token = body.gateway_token, savedId = body.saved_method_id || null;
      if (savedId) token = (db.methods.find((m) => m.method_id === num(savedId) && m.user_id === me.user_id) || fail(404, "Saved method not found")).gateway_token;
      const v = db.vault[token];
      if (!v || v.decline) {
        p.status = "FAILED";
        if (o.status === "PAYMENT_PENDING") changeStatus(o.order_id, "PAYMENT_FAILED", null, v ? "CARD_DECLINED" : "INVALID_TOKEN");
        fail(402, v ? "Declined by issuer" : "Unknown payment token", { payment_id: p.payment_id, status: "FAILED", reason: v ? "Declined by issuer" : "Unknown payment token",
                                                                    hint: "You can retry with another card/UPI on the same payment_id" });
      }
      if (v.type === "CARD") { p.card_network = v.network; p.card_last4 = v.last4; }
      if (body.save_method && body.gateway_token && v.type === "CARD" && !db.methods.some((m) => m.gateway_token === token)) {
        savedId = next("method");
        db.methods.push({ method_id: savedId, user_id: me.user_id, method_type: "CARD", gateway_token: token, card_network: v.network, card_last4: v.last4,
                          card_expiry_month: body.card_expiry_month || null, card_expiry_year: body.card_expiry_year || null, upi_vpa_masked: null, is_default: false });
      }
      p.status = "CAPTURED"; p.gateway_payment_ref = "mock_pay_" + Math.random().toString(16).slice(2, 14); p.saved_method_id = savedId;
      changeStatus(o.order_id, "PLACED", null, "payment captured");
      const cart = db.carts.find((c) => c.user_id === me.user_id);
      if (cart) db.cart_items = db.cart_items.filter((ci) => ci.cart_id !== cart.cart_id);
      return { payment_id: p.payment_id, status: "CAPTURED", order_id: o.order_id, receipt: p.card_last4 ? `${p.card_network} **** ${p.card_last4}` : p.method_type };
    },
    "orders.get"({ me, params }) {
      const o = db.orders.find((x) => x.order_id === num(params.order_id));
      if (!o || !(o.customer_id === me.user_id || o.partner_id === me.user_id || me.roles.includes("ADMIN") || isStaff(o.restaurant_id, me.user_id))) fail(404, "Order not found");
      const r = db.restaurants.find((x) => x.restaurant_id === o.restaurant_id);
      const pay = [...db.payments].reverse().find((p) => p.order_id === o.order_id);
      const drop = db.addresses.find((x) => x.address_id === o.address_id);
      return { ...o, restaurant_name: r.name, partner_name: o.partner_id ? user(o.partner_id).name : null,
               restaurant_lat: r.latitude, restaurant_lng: r.longitude, drop_address: drop.address_line, drop_lat: drop.latitude, drop_lng: drop.longitude,
               items: db.order_items.filter((i) => i.order_id === o.order_id).map(({ item_name, quantity, price_at_order, addons, line_total }) => ({ item_name, quantity, price_at_order, addons, line_total })),
               timeline: db.history.filter((h) => h.order_id === o.order_id).map(({ status, changed_at, note }) => ({ status, changed_at, note })),
               payment: pay ? { payment_id: pay.payment_id, method_type: pay.method_type, status: pay.status, amount: pay.amount, card_network: pay.card_network, card_last4: pay.card_last4 } : null,
               partner_location: o.partner_id && ["ACCEPTED", "PREPARING", "READY", "PICKED_UP"].includes(o.status) ? db.locations[o.partner_id] || null : null };
    },
    "orders.mine"({ me }) {
      return db.orders.filter((o) => o.customer_id === me.user_id).sort((a, b) => b.placed_at.localeCompare(a.placed_at)).map((o) => ({
        order_id: o.order_id, restaurant: db.restaurants.find((r) => r.restaurant_id === o.restaurant_id).name, total_amount: o.total_amount,
        status: o.status, payment_mode: o.payment_mode, placed_at: o.placed_at }));
    },
    "orders.cancel"({ me, params, body }) {
      const o = db.orders.find((x) => x.order_id === num(params.order_id) && x.customer_id === me.user_id) || fail(404, "Order not found");
      if (!["PAYMENT_PENDING", "PAYMENT_FAILED", "PLACED"].includes(o.status)) fail(409, "Order can no longer be cancelled");
      changeStatus(o.order_id, "CANCELLED", me.user_id, body?.reason || "Changed my mind");
      const p = [...db.payments].reverse().find((x) => x.order_id === o.order_id);
      let refund = null;
      if (p && p.status === "CAPTURED") { p.status = "REFUNDED"; refund = { refund_id: next("refund"), amount: p.amount, status: "PROCESSED" }; }
      return { order_id: o.order_id, status: "CANCELLED", refund };
    },
    "orders.rate"({ me, params, body }) {
      const o = db.orders.find((x) => x.order_id === num(params.order_id) && x.customer_id === me.user_id);
      if (!o || o.status !== "DELIVERED") fail(409, "You can rate only delivered orders");
      if (db.ratings.some((r) => r.order_id === o.order_id)) fail(409, "Already rated");
      db.ratings.push({ order_id: o.order_id, user_id: me.user_id, food_rating: body.food_rating, delivery_rating: body.delivery_rating, comment: body.comment || null });
      const r = db.restaurants.find((x) => x.restaurant_id === o.restaurant_id);
      r.avg_rating = Math.round(((r.avg_rating * r.rating_count + body.food_rating) / (r.rating_count + 1)) * 10) / 10; r.rating_count++;
      return { message: "Thanks for rating!" };
    },

    "restaurant.mine"({ me }) {
      return db.staff.filter((s) => s.user_id === me.user_id).map((s) => {
        const r = db.restaurants.find((x) => x.restaurant_id === s.restaurant_id);
        return { restaurant_id: r.restaurant_id, name: r.name, status: r.status, is_open: r.is_open, avg_rating: r.avg_rating, staff_role: s.staff_role };
      });
    },
    "restaurant.orders"({ me, params, query }) {
      const rid = num(params.restaurant_id); staffOrFail(rid, me.user_id);
      const status = (query.status || "PLACED").toUpperCase();
      return db.orders.filter((o) => o.restaurant_id === rid && o.status === status).sort((a, b) => a.placed_at.localeCompare(b.placed_at)).map((o) => ({
        order_id: o.order_id, status: o.status, total_amount: o.total_amount, payment_mode: o.payment_mode, special_instructions: o.special_instructions, placed_at: o.placed_at,
        partner_id: o.partner_id, partner_name: o.partner_id ? user(o.partner_id).name : null,
        items: db.order_items.filter((i) => i.order_id === o.order_id).map((i) => ({ item: i.item_name, qty: i.quantity, addons: i.addons })) }));
    },
    "restaurant.accept"({ me, params }) {
      const rid = num(params.restaurant_id), oid = num(params.order_id); staffOrFail(rid, me.user_id);
      const o = db.orders.find((x) => x.order_id === oid);
      if (!o || o.restaurant_id !== rid) fail(404, "Order not found");
      changeStatus(oid, "ACCEPTED", me.user_id);
      const offer = offerNearest(oid);
      return { order_id: oid, status: "ACCEPTED", offered_to_partner: offer ? offer.partner_id : null };
    },
    "restaurant.ready"({ me, params }) {
      const rid = num(params.restaurant_id), oid = num(params.order_id); staffOrFail(rid, me.user_id);
      const o = db.orders.find((x) => x.order_id === oid);
      if (!o || o.restaurant_id !== rid) fail(404, "Order not found");
      changeStatus(oid, "READY", me.user_id);
      return { order_id: oid, status: "READY" };
    },
    "restaurant.updateItem"({ me, params, body }) {
      const rid = num(params.restaurant_id); staffOrFail(rid, me.user_id);
      onlyFields(body, ["in_stock", "price"]);
      const it = db.items.find((i) => i.item_id === num(params.item_id) && i.restaurant_id === rid) || fail(404, "Item not found");
      if (body.in_stock !== undefined && body.in_stock !== null) it.in_stock = !!body.in_stock;
      if (body.price) it.price = num(body.price);
      return { item_id: it.item_id, name: it.name, price: it.price, in_stock: it.in_stock };
    },
    "restaurant.setOpen"({ me, params, body }) {
      const rid = num(params.restaurant_id); staffOrFail(rid, me.user_id);
      const r = db.restaurants.find((x) => x.restaurant_id === rid);
      if (r.status !== "ACTIVE") return { error: "Restaurant is not ACTIVE yet" };
      r.is_open = !!body.is_open;
      return { restaurant_id: rid, is_open: r.is_open };
    },
    "restaurant.payouts"({ me, params }) {
      const rid = num(params.restaurant_id); staffOrFail(rid, me.user_id);
      return db.payouts.filter((p) => p.restaurant_id === rid).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    "partner.me"({ me }) {
      const p = db.partners.find((x) => x.partner_id === me.user_id) || fail(404, "Not registered as a partner");
      let current = null;
      if (p.current_order_id) {
        const o = db.orders.find((x) => x.order_id === p.current_order_id);
        const r = db.restaurants.find((x) => x.restaurant_id === o.restaurant_id);
        const a = db.addresses.find((x) => x.address_id === o.address_id);
        current = { order_id: o.order_id, status: o.status, total_amount: o.total_amount, payment_mode: o.payment_mode, restaurant: r.name,
                    pickup: r.address_line, pickup_lat: r.latitude, pickup_lng: r.longitude,
                    drop_address: a.address_line, drop_landmark: a.landmark, drop_lat: a.latitude, drop_lng: a.longitude, customer: user(o.customer_id).name };
      }
      return { partner_id: p.partner_id, vehicle_type: p.vehicle_type, kyc_status: p.kyc_status, is_online: p.is_online, rating: p.rating,
               location: db.locations[p.partner_id] || null, current_order: current };
    },
    "partner.setOnline"({ me, body }) {
      const p = db.partners.find((x) => x.partner_id === me.user_id) || fail(404, "Not registered as a partner");
      if (body.is_online && p.kyc_status !== "VERIFIED") fail(403, "KYC not verified yet");
      p.is_online = !!body.is_online;
      return { is_online: p.is_online };
    },
    "partner.location"({ me, body }) {
      db.locations[me.user_id] = { latitude: num(body.latitude), longitude: num(body.longitude), updated_at: now() };
      return { ok: true };
    },
    "partner.offers"({ me }) {
      return db.assignments.filter((a) => a.partner_id === me.user_id && a.status === "OFFERED").map((a) => {
        const o = db.orders.find((x) => x.order_id === a.order_id), r = db.restaurants.find((x) => x.restaurant_id === o.restaurant_id);
        const d = db.addresses.find((x) => x.address_id === o.address_id);
        return { assignment_id: a.assignment_id, order_id: o.order_id, restaurant: r.name, pickup: r.address_line, pickup_lat: r.latitude, pickup_lng: r.longitude,
                 drop_address: d.address_line, drop_lat: d.latitude, drop_lng: d.longitude, total_amount: o.total_amount, payment_mode: o.payment_mode };
      });
    },
    "partner.acceptOffer"({ me, params }) {
      const a = db.assignments.find((x) => x.assignment_id === num(params.assignment_id) && x.partner_id === me.user_id);
      if (!a || a.status !== "OFFERED") fail(409, "Offer not available");
      const p = db.partners.find((x) => x.partner_id === me.user_id);
      if (p.current_order_id) fail(409, "Finish your current order first");
      a.status = "ACCEPTED";
      const o = db.orders.find((x) => x.order_id === a.order_id);
      if (!o.partner_id) o.partner_id = me.user_id;
      p.current_order_id = o.order_id;
      return { order_id: o.order_id, message: "Head to the restaurant" };
    },
    "partner.rejectOffer"({ me, params }) {
      const a = db.assignments.find((x) => x.assignment_id === num(params.assignment_id) && x.partner_id === me.user_id && x.status === "OFFERED") || fail(409, "Offer not available");
      a.status = "REJECTED";
      const nxt = offerNearest(a.order_id);
      return { rejected: true, re_offered_to: nxt ? nxt.partner_id : null };
    },
    "partner.pickup"({ me, params }) {
      const o = db.orders.find((x) => x.order_id === num(params.order_id));
      if (!o || o.partner_id !== me.user_id) fail(404, "Not your order");
      changeStatus(o.order_id, "PICKED_UP", me.user_id);
      return { order_id: o.order_id, status: "PICKED_UP" };
    },
    "partner.deliver"({ me, params, body }) {
      onlyFields(body, ["cash_collected"]);
      const o = db.orders.find((x) => x.order_id === num(params.order_id));
      if (!o || o.partner_id !== me.user_id) fail(404, "Not your order");
      if (o.payment_mode === "COD" && !(body && body.cash_collected)) fail(409, `Collect Rs ${o.total_amount} cash from the customer first`);
      changeStatus(o.order_id, "DELIVERED", me.user_id);
      db.partners.find((x) => x.partner_id === me.user_id).current_order_id = null;
      db.earnings.push({ earning_id: next("earning"), partner_id: me.user_id, order_id: o.order_id, base_pay: 25, distance_pay: 10, tip: 0, payout_status: "PENDING", created_at: now() });
      const r = db.restaurants.find((x) => x.restaurant_id === o.restaurant_id), commission = r2(o.item_total * r.commission_pct / 100);
      db.payouts.push({ payout_id: next("payout"), restaurant_id: r.restaurant_id, order_id: o.order_id, order_amount: o.item_total, commission, payout_amount: r2(o.item_total - commission), payout_status: "PENDING", created_at: now() });
      if (o.payment_mode === "COD") { const p = db.payments.find((x) => x.order_id === o.order_id && x.status === "COD_PENDING"); if (p) p.status = "COD_COLLECTED"; }
      return { order_id: o.order_id, status: "DELIVERED" };
    },
    "partner.earnings"({ me }) {
      const rows = db.earnings.filter((e) => e.partner_id === me.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { total: r2(rows.reduce((s, e) => s + e.base_pay + e.distance_pay + e.tip, 0)), deliveries: rows };
    },

    "admin.approveRestaurant"({ params }) {
      const r = db.restaurants.find((x) => x.restaurant_id === num(params.restaurant_id) && x.status === "PENDING") || fail(409, "Restaurant not found or not pending");
      r.status = "ACTIVE";
      return { restaurant_id: r.restaurant_id, name: r.name, status: r.status };
    },
    "admin.verifyPartner"({ params }) {
      const p = db.partners.find((x) => x.partner_id === num(params.partner_id)) || fail(404, "Partner not found");
      p.kyc_status = "VERIFIED";
      return { partner_id: p.partner_id, kyc_status: p.kyc_status };
    },
  };

  // ---------------- the "server": same envelope as api/app/envelope.py ----------------
  let reqCounter = 0;
  async function handle(name, req) {
    await new Promise((r) => setTimeout(r, App.config.demoLatencyMs));
    const meta = { request_id: "demo" + (++reqCounter).toString(16).padStart(6, "0"), timestamp: new Date().toISOString().slice(0, 19) + "Z", operation: name };
    loadDb();                                                  // pick up writes made by the other apps/tabs
    const snapshot = JSON.stringify(db);                       // "transaction": roll back on error
    try {
      const op = App.operations[name];
      const me = authorize(op, req.token);
      const data = H[name]({ ...req, me });
      saveDb();
      const created = req.method === "POST" && /add|checkout|rate/.test(name.split(".")[1]);
      return { success: true, data: JSON.parse(JSON.stringify(data)), error: null, meta, __status: created ? 201 : 200 };
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) saveDb();   // a decline is a real result: keep FAILED (server commits it too)
      else db = JSON.parse(snapshot);
      if (e instanceof ApiError) {
        return { success: false, data: null, error: { code: CODES[e.status] || "ERROR", message: e.message, details: e.details }, meta, __status: e.status };
      }
      console.error(e);
      return { success: false, data: null, error: { code: "SERVER_ERROR", message: "Something went wrong on our side. Please try again.", details: null }, meta, __status: 500 };
    }
  }

  // ---------------- the "payment gateway" side (used by gateway-sdk.js) ----------------
  function luhn(n) { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; }
  function gatewayTokenize(card) {
    const number = String(card.card_number || "").replace(/[\s-]/g, "");
    const cvv = String(card.cvv || "");
    if (!/^\d{13,19}$/.test(number) || !luhn(number)) return { ok: false, message: "Invalid card number" };
    if (!/^\d{3,4}$/.test(cvv)) return { ok: false, message: "Invalid CVV" };
    const exp = new Date(card.expiry_year, card.expiry_month - 1, 1), m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0);
    if (!(card.expiry_month >= 1 && card.expiry_month <= 12) || exp < m) return { ok: false, message: "Card expired" };
    const network = number[0] === "4" ? "VISA" : /^5[1-5]/.test(number) ? "MASTERCARD" : /^3[47]/.test(number) ? "AMEX" : /^(60|65|81|82)/.test(number) ? "RUPAY" : "OTHER";
    const token = "tok_mock_" + Math.random().toString(16).slice(2, 14);
    db.vault[token] = { type: "CARD", network, last4: number.slice(-4), decline: number === "4000000000000002" };   // CVV is NOT kept
    saveDb();
    return { ok: true, token, network, last4: number.slice(-4), expiry_month: card.expiry_month, expiry_year: card.expiry_year };
  }
  function gatewayTokenizeUpi(vpa) {
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(vpa || "")) return { ok: false, message: "Invalid UPI ID" };
    const [name, bank] = vpa.split("@");
    const token = "tok_mock_upi_" + Math.random().toString(16).slice(2, 10);
    db.vault[token] = { type: "UPI", vpa_masked: name.slice(0, 2) + "****@" + bank, decline: name.startsWith("fail") };
    saveDb();
    return { ok: true, token, vpa_masked: db.vault[token].vpa_masked };
  }

  App.mockServer = { handle, resetDb, gatewayTokenize, gatewayTokenizeUpi };
})();
