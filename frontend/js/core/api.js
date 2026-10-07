/* =====================================================================
   api.js - sessions + ONE function for every operation
   ---------------------------------------------------------------------
   Each app (customer / restaurant / rider) gets its own session and its
   own api object, but they all talk to the SAME backend and database.

     const res = await api.call("cart.addItem", { params, query, body });

   ALWAYS resolves with the uniform envelope (never throws):
     { success: true,  data: {...}, error: null, meta: {...} }
     { success: false, data: null,  error: { code, message, details }, meta: {...} }

   api.run(...) = call + show the error toast + return data (or null).
   App.bus lets the API inspector (and the other apps) see every call.
   ===================================================================== */
(function () {
  // ---------- event bus: every call is announced here ----------
  const listeners = [];
  App.bus = { on: (fn) => listeners.push(fn), emit: (entry) => listeners.forEach((fn) => fn(entry)) };

  // ---------- one login per app ----------
  App.createSession = function (kind) {
    const key = () => `foodwings.session.${App.config.mode}.${kind}`;
    let state = null;
    const save = () => { try { state ? localStorage.setItem(key(), JSON.stringify(state)) : localStorage.removeItem(key()); } catch (e) { /* storage blocked */ } };
    const load = () => { try { state = JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { state = null; } };
    load();
    return {
      load, token: () => state?.token || null, user: () => state?.user || null,
      has: (role) => (state?.user?.roles || []).includes(role),
      login(token, user) { state = { token, user }; save(); },
      logout() { state = null; save(); },
    };
  };

  function envelopeError(code, message, operation) {
    return { success: false, data: null, error: { code, message, details: null },
             meta: { request_id: null, timestamp: new Date().toISOString(), operation } };
  }

  App.createApi = function (session, appKind, hooks = {}) {
    const self = { polling: false };

    self.call = async function (name, req = {}) {
      const op = App.operations[name];
      if (!op) return envelopeError("UNKNOWN_OPERATION", `No operation called ${name}`, name);
      let path;
      try {
        path = op.path.replace(/\{(\w+)\}/g, (_, k) => {
          if (req.params?.[k] === undefined) throw new Error(`Missing path param "${k}"`);
          return encodeURIComponent(req.params[k]);
        });
      } catch (e) { return envelopeError("BAD_REQUEST", e.message, name); }
      const qs = req.query ? "?" + new URLSearchParams(Object.entries(req.query).filter(([, v]) => v != null)).toString() : "";
      const token = session.token();
      const t0 = performance.now();
      let status = 0, envelope;

      if (App.config.mode === "demo") {
        envelope = await App.mockServer.handle(name, { method: op.method, path, params: req.params || {}, query: req.query || {}, body: req.body, token });
        status = envelope.__status; delete envelope.__status;
      } else {
        try {
          const res = await fetch(App.config.apiBase + path + qs, {
            method: op.method,
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
            body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
          });
          status = res.status;
          const json = await res.json().catch(() => null);
          if (json === null) {
            envelope = envelopeError("BAD_RESPONSE", "Server sent something that is not JSON", name);
          } else if (typeof json === "object" && json !== null && "success" in json) {
            envelope = json;
          } else if (res.ok) {
            envelope = {
              success: true,
              data: json,
              error: null,
              meta: { request_id: res.headers.get("X-Request-ID"), timestamp: new Date().toISOString(), operation: name }
            };
          } else {
            const errMsg = typeof json.detail === "string"
              ? json.detail
              : (Array.isArray(json.detail) ? json.detail.map(d => d.msg || d.error || JSON.stringify(d)).join(", ") : (json.message || "Request failed"));
            envelope = {
              success: false,
              data: null,
              error: {
                code: json.code || (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : "ERROR"),
                message: errMsg,
                details: json.problems || json.detail || null
              },
              meta: { request_id: res.headers.get("X-Request-ID"), timestamp: new Date().toISOString(), operation: name }
            };
          }
        } catch (e) {
          envelope = envelopeError("NETWORK_ERROR", `Cannot reach the API at ${App.config.apiBase}. Is uvicorn running? Or switch to demo data.`, name);
        }
      }
      if (status === 401 && token) hooks.onUnauthorized?.();
      App.bus.emit({ app: appKind, name, op, path: path + qs, status, ms: Math.round(performance.now() - t0),
                     request: req.body, response: envelope, poll: self.polling, at: new Date() });
      return envelope;
    };

    self.run = async function (name, req, successMessage) {
      const res = await self.call(name, req);
      if (!res.success) { hooks.onError?.(res.error.message, res.error.code); return null; }
      if (successMessage) hooks.onSuccess?.(successMessage);
      return res.data;
    };
    return self;
  };
})();
