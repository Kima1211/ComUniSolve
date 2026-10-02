// A file, not an inline script: the CSP in vercel.json (script-src 'self') blocks inline scripts.
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
