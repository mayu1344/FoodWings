/* =====================================================================
   gateway-sdk.js - stands in for the Razorpay / Stripe browser SDK
   ---------------------------------------------------------------------
   Card number, expiry and CVV go ONLY to the payment gateway, which
   returns a token. Our API never receives them, which is why the card
   form calls App.gatewaySdk.tokenizeCard() and NOT api.call().
   With a real gateway, replace this file with the gateway's own script.
   ===================================================================== */
(function () {
  function logExternal(name, summary) {
    // the inspector shows that a gateway call happened, but never the card data
    App.bus.emit({ app: "customer", name, op: { method: "POST" }, path: "(payment gateway, not our API)", status: "ext", ms: 0,
                   request: { note: "card details went to the gateway only, hidden here" }, response: summary, poll: false, at: new Date() });
  }

  async function post(path, body) {
    try {
      const res = await fetch(App.config.apiBase + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      return res.ok ? { ok: true, ...json } : { ok: false, message: json.detail || "Rejected by the gateway" };
    } catch (e) { return { ok: false, message: "Payment gateway unreachable" }; }
  }

  async function tokenizeCard(card) {
    const r = App.config.mode === "demo" ? App.mockServer.gatewayTokenize(card) : await post("/mock-gateway/v1/tokenize", card);
    logExternal("gateway.tokenizeCard", r.ok ? { token: r.token, network: r.network, last4: r.last4 } : { error: r.message });
    return r;
  }

  async function tokenizeUpi(vpa) {
    const r = App.config.mode === "demo" ? App.mockServer.gatewayTokenizeUpi(vpa) : await post("/mock-gateway/v1/upi/tokenize", { vpa });
    logExternal("gateway.tokenizeUpi", r.ok ? { token: r.token, vpa_masked: r.vpa_masked } : { error: r.message });
    return r;
  }

  App.gatewaySdk = { tokenizeCard, tokenizeUpi };
})();
