// Apply the saved Light/Dark choice before the page is drawn, so dark mode never flashes white.
// It is a separate file, not inline in index.html, because the site's Content-Security-Policy
// (vercel.json, script-src 'self') blocks inline scripts. main.jsx loads too late for this.
(function () {
  try {
    var choice = localStorage.getItem("comunisolve-theme");
    if (choice !== "light" && choice !== "dark") return;
    document.documentElement.dataset.theme = choice;
    var bar = { light: "#FFFFFF", dark: "#15181E" }[choice];
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute("content", bar); });
  } catch {
    // Storage blocked (private mode): follow the phone's setting.
  }
})();
