/* =====================================================================
   map.js - the map shown to riders (and on the customer's tracking screen)
   ---------------------------------------------------------------------
   Screens put a placeholder in their HTML:
       App.maps.placeholder("rider-job", { points: [...], legs: [...] })
   and the shell calls App.maps.hydrate(root) after every render.

   Two ways to draw it:
     1. Leaflet + OpenStreetMap tiles  (real streets; used when Leaflet is loaded)
     2. A built-in schematic street map (no internet needed; used in the demo bundle)
   Both get the same points, so the screens don't care which one is used.

   points: [{ key: "rider" | "restaurant" | "home", lat, lng, label }]
   legs:   [{ from: "rider", to: "restaurant", active: true }]   active = the leg to ride now
   For turn-by-turn driving the rider taps "Navigate", which opens Google Maps.
   ===================================================================== */
(function () {
  const esc = (s) => App.ui.esc(s);
  const cache = {};                       // Leaflet maps survive re-renders (no flicker, no tile reload)

  // ---------- distance helpers (also used by the screens) ----------
  function km(a, b) {
    const R = 6371, t = Math.PI / 180;
    const x = Math.sin((b.lat - a.lat) * t / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin((b.lng - a.lng) * t / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const roadKm = (a, b) => km(a, b) * 1.3;                         // streets are never a straight line
  const etaMin = (a, b) => Math.max(1, Math.round(roadKm(a, b) / 18 * 60));   // ~18 km/h on a bike in city traffic
  const navUrl = (from, to) => `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ""}&destination=${to.lat},${to.lng}&travelmode=driving`;

  // an L-shaped path that follows the street grid: go along the street, then turn
  function streetPath(a, b) { return [a, { lat: a.lat, lng: b.lng }, b]; }

  function placeholder(id, spec) {
    return `<div class="map" id="map-${esc(id)}" data-map="${esc(JSON.stringify(spec))}"></div>`;
  }

  function useLeaflet() { return typeof window.L !== "undefined" && !App.config.lockMode && App.config.mapTiles !== false; }

  function hydrate(root) {
    root.querySelectorAll("[data-map]").forEach((el) => {
      const spec = JSON.parse(el.dataset.map);
      spec.points = spec.points.filter((p) => p.lat != null && p.lng != null).map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }));
      if (!spec.points.length) { el.innerHTML = `<div class="empty">No location yet</div>`; return; }
      if (useLeaflet()) leaflet(el, spec); else schematic(el, spec);
    });
  }

  // ======================= 1. Leaflet + OpenStreetMap =======================
  const PIN = {
    rider: '<span class="pin rider"><span>R</span></span>',
    restaurant: '<span class="pin restaurant"><span>K</span></span>',
    home: '<span class="pin home"><span>H</span></span>',
  };
  function leaflet(el, spec) {
    const id = el.id;
    let entry = cache[id];
    if (!entry) {
      const div = document.createElement("div");
      div.className = "map-inner";
      div.style.position = "absolute";           // set before Leaflet looks at it, or it forces "relative" (0 px tall)
      el.appendChild(div);                       // and attach it first so Leaflet can measure it
      const map = L.map(div, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      entry = cache[id] = { div, map, layer: L.layerGroup().addTo(map), fitted: "" };
    }
    if (entry.div.parentNode !== el) {          // the screen re-rendered: move the existing map into the new spot
      el.appendChild(entry.div);
      setTimeout(() => entry.map.invalidateSize(), 0);
    }
    const { map, layer } = entry;
    layer.clearLayers();
    const byKey = Object.fromEntries(spec.points.map((p) => [p.key, p]));
    (spec.legs || []).forEach((leg) => {
      const a = byKey[leg.from], b = byKey[leg.to];
      if (!a || !b) return;
      const line = streetPath(a, b).map((p) => [p.lat, p.lng]);
      if (leg.active) {                                  // black casing + brand-yellow route, like the app's buttons
        L.polyline(line, { color: "#111111", weight: 10, opacity: 0.9 }).addTo(layer);
        L.polyline(line, { color: "#ffd60a", weight: 6, opacity: 1 }).addTo(layer);
      } else {
        L.polyline(line, { color: "#62625c", weight: 4, opacity: 0.55, dashArray: "6 8" }).addTo(layer);
      }
    });
    spec.points.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "pinwrap", html: PIN[p.key] || PIN.home, iconSize: [30, 30], iconAnchor: [15, 30] }) })
        .bindTooltip(esc(p.label || p.key), { direction: "top", offset: [0, -28] }).addTo(layer);
    });
    const sig = spec.points.map((p) => p.key).join();       // refit only when the set of points changes
    if (entry.fitted !== sig) {
      entry.fitted = sig;
      setTimeout(() => { map.invalidateSize(); map.fitBounds(L.latLngBounds(spec.points.map((p) => [p.lat, p.lng])).pad(0.35), { maxZoom: 16 }); }, 0);
    }
  }

  // ======================= 2. built-in schematic map =======================
  function schematic(el, spec) {
    const W = Math.max(260, el.clientWidth || 360), H = Math.max(160, el.clientHeight || 220);
    const pts = spec.points;
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, kx = Math.cos(midLat * Math.PI / 180);
    let spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.004) * 1.6;
    let spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.004) * 1.6;
    const s = Math.min(W / (spanLng * kx), H / spanLat);        // pixels per degree of latitude
    const cLat = midLat, cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const X = (lng) => W / 2 + (lng - cLng) * kx * s;
    const Y = (lat) => H / 2 - (lat - cLat) * s;
    const lng0 = cLng - W / 2 / (kx * s), lng1 = cLng + W / 2 / (kx * s);
    const lat0 = cLat - H / 2 / s, lat1 = cLat + H / 2 / s;

    // streets every ~250 m, main roads every ~1 km, parks in a few blocks (same layout every time)
    const step = 0.0025, parts = [];
    const hash = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
    for (let i = Math.floor(lng0 / step); i * step <= lng1; i++) for (let j = Math.floor(lat0 / step); j * step <= lat1; j++) {
      const h = hash(i, j);
      if (h > 0.86) parts.push(`<rect class="m-park" x="${X(i * step) + 3}" y="${Y((j + 1) * step) + 3}" width="${step * kx * s - 6}" height="${step * s - 6}" rx="4"/>`);
      else if (h < 0.05) parts.push(`<rect class="m-water" x="${X(i * step) + 3}" y="${Y((j + 1) * step) + 3}" width="${step * kx * s - 6}" height="${step * s - 6}" rx="10"/>`);
    }
    for (let i = Math.floor(lng0 / step); i * step <= lng1; i++) {
      const major = i % 4 === 0;
      parts.push(`<line class="${major ? "m-major" : "m-road"}" x1="${X(i * step)}" y1="0" x2="${X(i * step)}" y2="${H}"/>`);
    }
    for (let j = Math.floor(lat0 / step); j * step <= lat1; j++) {
      const major = j % 4 === 0;
      parts.push(`<line class="${major ? "m-major" : "m-road"}" x1="0" y1="${Y(j * step)}" x2="${W}" y2="${Y(j * step)}"/>`);
    }

    const byKey = Object.fromEntries(pts.map((p) => [p.key, p]));
    const routes = (spec.legs || []).map((leg) => {
      const a = byKey[leg.from], b = byKey[leg.to];
      if (!a || !b) return "";
      const d = streetPath(a, b).map((p, i) => `${i ? "L" : "M"}${X(p.lng).toFixed(1)} ${Y(p.lat).toFixed(1)}`).join(" ");
      return leg.active
        ? `<path class="m-route-case" d="${d}"/><path class="m-route" d="${d}"/>`
        : `<path class="m-route-idle" d="${d}"/>`;
    }).join("");

    const marker = (p) => {
      const x = X(p.lng), y = Y(p.lat), letter = { rider: "R", restaurant: "K", home: "H" }[p.key] || "•";
      // labels sit on the side with more room; riders' labels go the other way so they don't cover the pins
      const right = p.key === "rider" ? x < W * 0.45 : x < W * 0.6;
      const text = String(p.label || "").length > 22 ? String(p.label).slice(0, 21) + "…" : String(p.label || "");
      const label = `<text class="m-label" x="${right ? x + 16 : x - 16}" y="${p.key === "rider" ? y + 22 : y - 14}" text-anchor="${right ? "start" : "end"}">${esc(text)}</text>`;
      if (p.key === "rider") return `<g class="m-rider"><circle class="m-pulse" cx="${x}" cy="${y}" r="16"/><circle class="m-dot" cx="${x}" cy="${y}" r="9"/><text class="m-letter" x="${x}" y="${y + 3.5}">${letter}</text>${label}</g>`;
      return `<g class="m-pin m-${p.key}"><path d="M${x} ${y} l-10 -14 a12 12 0 1 1 20 0 z"/><text class="m-letter" x="${x}" y="${y - 17}">${letter}</text>${label}</g>`;
    };

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="Map: ${esc(pts.map((p) => p.label || p.key).join(", "))}">
      <rect class="m-land" x="0" y="0" width="${W}" height="${H}"/>${parts.join("")}${routes}${pts.filter((p) => p.key !== "rider").map(marker).join("")}${pts.filter((p) => p.key === "rider").map(marker).join("")}
      <text class="m-note" x="${W - 8}" y="${H - 8}">schematic map · real streets with Leaflet</text></svg>`;
  }

  App.maps = { placeholder, hydrate, km, roadKm, etaMin, navUrl, streetPath };
})();
