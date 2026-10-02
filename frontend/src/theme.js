// Light / dark mode. Three choices: "system" (follow the phone), "light", "dark".
// "system" means no data-theme on <html>, so the prefers-color-scheme rule in index.css decides.
// Light and dark set data-theme, which wins over the phone's setting.
// The saved choice is applied before the first paint by a small script in index.html (no flash).
const KEY = "comunisolve-theme"

// Browser bar colour per mode: the top bar's Surface colour, so the bar and the page join up.
const BAR = { light: "#FFFFFF", dark: "#15181E" }

export function savedTheme() {
    try {
        const value = localStorage.getItem(KEY)
        if (value === "light" || value === "dark") return value
    } catch {
        // Storage blocked (private mode): fall back to the phone's setting.
    }
    return "system"
}

function updateBarColour(choice) {
    // index.html has two theme-color tags, one per OS mode. A forced choice overrides both.
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        const mode = choice === "system" ? meta.dataset.mode : choice
        meta.setAttribute("content", BAR[mode])
    })
}

export function setTheme(choice) {
    if (choice === "system") delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = choice
    try {
        if (choice === "system") localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, choice)
    } catch {
        // The choice still applies until the page is closed.
    }
    updateBarColour(choice)
}

// The toggle button cycles System -> Light -> Dark -> System.
export function nextTheme(choice) {
    if (choice === "system") return "light"
    if (choice === "light") return "dark"
    return "system"
}
