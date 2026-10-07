/* page.js - wires the page around the apps: demo/live switch, reset, and the app picker on small screens. */
(function () {
  function sessionsReset() {
    try { Object.keys(localStorage).filter((k) => k.startsWith("foodwings.session.")).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
  }
  App.initPage = function () {
    document.querySelectorAll("[data-page=mode]").forEach((b) => {
      b.dataset.mode = App.config.mode;
      b.textContent = App.config.mode === "demo" ? "Demo data" : "Live API";
      if (App.config.lockMode) b.disabled = true;
    });
    document.querySelectorAll("[data-page=reset]").forEach((b) => { b.hidden = App.config.mode !== "demo"; });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-page]");
      if (!b) return;
      if (b.dataset.page === "mode" && !App.config.lockMode) {
        try { localStorage.setItem("foodwings.mode", App.config.mode === "demo" ? "live" : "demo"); } catch (err) { /* ignore */ }
        location.reload();
      }
      if (b.dataset.page === "reset") { App.mockServer.resetDb(); sessionsReset(); location.reload(); }
      if (b.dataset.page === "pick") {
        const app = b.dataset.app;
        const stage = document.querySelector(".stage");
        if (stage) {
          stage.classList.toggle("stage-single", app !== "all");
        }
        document.querySelectorAll(".device").forEach((d) => {
          if (app === "all") {
            d.classList.add("active");
            d.style.display = "";
          } else {
            const isMatch = d.dataset.app === app;
            d.classList.toggle("active", isMatch);
            d.style.display = isMatch ? "flex" : "none";
          }
        });
        document.querySelectorAll("[data-page=pick]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      }
    });
  };
})();
