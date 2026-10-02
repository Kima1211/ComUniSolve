// "system" = no data-theme on <html>, so prefers-color-scheme decides. theme-init.js applies the saved choice before paint.
const KEY = "comunisolve-theme"

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

export function nextTheme(choice) {
    if (choice === "system") return "light"
    if (choice === "light") return "dark"
    return "system"
}
