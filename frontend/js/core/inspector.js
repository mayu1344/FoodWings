/* inspector.js - lists every API call from all apps, with its uniform response. */
(function () {
  App.mountInspector = function (el, opts = {}) {
    const calls = [];
    let hidePolls = true;
    el.classList.add("inspector");
    el.dataset.open = opts.open ? "true" : "false";
    el.innerHTML = `
      <div class="insp-head">
        <button class="insp-title" data-insp="toggle" aria-expanded="${!!opts.open}"><b>API inspector</b> <span class="muted small">every call returns <span class="mono">{ success, data, error, meta }</span></span></button>
        <div class="row small">
          <label class="row" style="gap:4px"><input type="checkbox" data-insp="polls" checked> Hide auto-refresh</label>
          <button class="btn small" data-insp="clear">Clear</button>
        </div>
      </div>
      <div class="insp-list"></div>`;
    const list = el.querySelector(".insp-list");
    const appLabel = { customer: "Customer", restaurant: "Restaurant", rider: "Rider" };

    function render() {
      const { esc, prettyJson } = App.ui;
      const rows = calls.filter((c) => !(hidePolls && c.poll)).slice(0, 80);
      list.innerHTML = rows.map((c) => {
        const cls = c.status === "ext" ? "ext" : "s" + String(c.status || 0)[0];
        return `<details class="call">
          <summary><span class="status ${cls}">${c.status === "ext" ? "EXT" : c.status || "ERR"}</span>
            <span class="apptag" data-kind="${c.app}">${appLabel[c.app] || c.app}</span>
            <span class="op">${esc(c.name)}</span><span class="muted small num">${c.ms} ms</span>
            <span class="path">${esc(c.op.method)} ${esc(c.path)}</span></summary>
          <div class="call-body">
            <div><div class="lbl">Request body</div><pre class="json">${prettyJson(c.request ?? null)}</pre></div>
            <div><div class="lbl">Response</div><pre class="json">${prettyJson(c.response)}</pre></div>
          </div>
        </details>`;
      }).join("") || `<div class="empty" style="margin:12px">Calls from all three apps appear here.</div>`;
    }

    App.bus.on((entry) => { calls.unshift(entry); if (calls.length > 300) calls.pop(); render(); });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-insp]");
      if (!b) return;
      if (b.dataset.insp === "toggle") { const open = el.dataset.open !== "true"; el.dataset.open = String(open); b.setAttribute("aria-expanded", open); }
      if (b.dataset.insp === "clear") { calls.length = 0; render(); }
    });
    el.addEventListener("change", (e) => { if (e.target.dataset.insp === "polls") { hidePolls = e.target.checked; render(); } });
    render();
  };
})();
