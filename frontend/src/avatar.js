// Pick a stable colour for a user from their name, so the same person always has the same avatar.
// Charcoal, slate and deep amber-brown tones to match the "Amber" theme.
// Bright amber is left out (it is the button and "Solved" colour). Each tone is dark enough
// for white initials (WCAG AA, 4.5:1 or more: lowest is 7.1:1).
const TONES = {
    charcoal: "bg-[#374151]",
    slate:    "bg-[#4B5563]",
    bronze:   "bg-[#92400E]",
    umber:    "bg-[#78350F]",
}
const PALETTE = Object.keys(TONES)

function hash(text) {
    let h = 0
    for (let i = 0; i < text.length; i++) {
        h = (h * 31 + text.charCodeAt(i)) | 0
    }
    return Math.abs(h)
}

export function colorFor(name) {
    return PALETTE[hash(name || "?") % PALETTE.length]
}

// "Juana Ma. Clara Dela Cruz" -> "JC". One word -> "J".
export function initialsFor(name) {
    const parts = (name || "?").trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function avatarClass(tone, size = "md") {
    const sizes = {
        xs: "h-5 w-5 text-[9px]",
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-base",
    }
    return `inline-flex items-center justify-center rounded-full font-semibold text-white ${sizes[size]} ${TONES[tone] || TONES.charcoal}`
}
