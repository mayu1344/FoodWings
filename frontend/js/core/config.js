/* =====================================================================
   config.js - the ONLY file you edit to point the app somewhere else.
   ---------------------------------------------------------------------
   mode "demo" : no server needed. js/mock-server.js answers every call
                 in the browser, with the same seed data as db/03_seed.sql
                 and the SAME response format as the real API.
   mode "live" : calls the FastAPI backend at apiBase.

   Default: opened as a file (double-click index.html) -> demo
            served by the API at http://localhost:8000/app/ -> live
   You can switch at any time with the DEMO/LIVE badge in the top bar.
   ===================================================================== */
window.App = window.App || {};

App.config = {
  appName: "FoodWings",
  apiBase: location.protocol.startsWith("http") && location.port === "8000"
    ? location.origin                 // served by FastAPI itself
    : "http://localhost:8000",        // e.g. python -m http.server 5500 or file://
  mode: "live",                       // Default to live backend and PostgreSQL DB
  demoLatencyMs: 220,                 // makes demo calls feel like a network
  pollMs: 4000,                       // how often order screens refresh (live mode / other tabs)
};

// remembered choice of mode (per browser); every storage call is wrapped in try/catch
try {
  const saved = localStorage.getItem("foodwings.mode");
  if (saved === "demo" || saved === "live") App.config.mode = saved;
} catch (e) { /* storage blocked: keep default */ }
