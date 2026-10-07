// Avatar frames unlocked by title. Keep MIN_POINTS in sync with FRAME_MIN_POINTS in Services/reputation.py.

export const FRAMES = [
    { key: "usbong", min: 0, tier: "Newcomer" },
    { key: "alon", min: 10, tier: "Contributor" },
    { key: "capiz", min: 30, tier: "Trusted Helper" },
    { key: "araw", min: 70, tier: "Community Expert" },
]

// Drawn in a 100 x 100 box; the avatar circle sits in the middle.
const R = 37.6

function point(r, degrees) {
    const a = ((degrees - 90) * Math.PI) / 180
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]
}

const n = (v) => v.toFixed(2)

function star(cx, cy, r) {
    let d = ""
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? r * 0.45 : r
        const a = ((i * 36 - 90) * Math.PI) / 180
        d += `${i ? "L" : "M"}${n(cx + radius * Math.cos(a))} ${n(cy + radius * Math.sin(a))}`
    }
    return d + "Z"
}

function usbong() {
    const top = 50 - R
    return `<circle cx="50" cy="50" r="${R}" fill="none" stroke="#22C55E" stroke-width="2.4"/>
        <circle cx="50" cy="50" r="${R + 2.6}" fill="none" stroke="#86EFAC" stroke-width=".8" opacity=".8"/>
        <path d="M50 ${top} L50 ${top - 6}" stroke="#15803D" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M50 ${top - 5} C45 ${top - 11} 40 ${top - 8} 41 ${top - 4} C45 ${top - 3} 48 ${top - 4} 50 ${top - 5}Z" fill="#4ADE80" stroke="#15803D" stroke-width=".9"/>
        <path d="M50 ${top - 5} C55 ${top - 12} 61 ${top - 9} 60 ${top - 4} C55 ${top - 2} 52 ${top - 4} 50 ${top - 5}Z" fill="#86EFAC" stroke="#15803D" stroke-width=".9"/>`
}

function alon(id) {
    let d = ""
    for (let i = 0; i <= 360; i += 2) {
        const [x, y] = point(R + 2.6 + 2.2 * Math.sin((i * 14 * Math.PI) / 180), i)
        d += `${i ? "L" : "M"}${n(x)} ${n(y)}`
    }
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38BDF8"/><stop offset=".5" stop-color="#0EA5E9"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs>
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="#7DD3FC" stroke-width="1.2"/>
        <g class="frame-spin"><path d="${d}Z" fill="none" stroke="url(#${id})" stroke-width="2.6" stroke-linejoin="round"/></g>`
}

function capiz(id) {
    let tiles = ""
    for (let i = 0; i < 16; i++) {
        const [x, y] = point(R + 3.4, i * 22.5)
        tiles += `<rect x="${n(x - 3.1)}" y="${n(y - 3.1)}" width="6.2" height="6.2" rx="1" transform="rotate(${i * 22.5 + 45} ${n(x)} ${n(y)})" fill="url(#${id})" stroke="#7C3AED" stroke-width=".7"/>`
    }
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#E9D5FF"/><stop offset=".75" stop-color="#C4B5FD"/><stop offset="1" stop-color="#99F6E4"/></linearGradient></defs>
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="#8B5CF6" stroke-width="1.6"/>${tiles}`
}

// The sun and three stars of the Philippine flag.
function araw() {
    let rays = ""
    for (let i = 0; i < 8; i++) {
        const a = i * 45
        const [x1, y1] = point(R + 1.5, a - 6)
        const [x2, y2] = point(R + 1.5, a + 6)
        const [tx, ty] = point(R + 11.5, a)
        const [s1x, s1y] = point(R + 1.5, a - 14)
        const [s1t, s1u] = point(R + 6.5, a - 12)
        const [s2x, s2y] = point(R + 1.5, a + 14)
        const [s2t, s2u] = point(R + 6.5, a + 12)
        rays += `<path d="M${n(x1)} ${n(y1)}L${n(tx)} ${n(ty)}L${n(x2)} ${n(y2)}Z" fill="#FCD34D" stroke="#B45309" stroke-width=".6" stroke-linejoin="round"/>
            <path d="M${n(s1x)} ${n(s1y)}L${n(s1t)} ${n(s1u)}M${n(s2x)} ${n(s2y)}L${n(s2t)} ${n(s2u)}" stroke="#F59E0B" stroke-width="1.2" stroke-linecap="round"/>`
    }
    const stars = [[-22.5, 0], [112.5, 0.7], [247.5, 1.4]].map(([deg, delay]) => {
        const [x, y] = point(R + 15, deg)
        return `<path class="frame-twinkle" style="animation-delay:${delay}s" d="${star(x, y, 4.2)}" fill="#FDE68A" stroke="#B45309" stroke-width=".5"/>`
    }).join("")
    return `<g class="frame-rays">${rays}</g>
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="#F59E0B" stroke-width="2.8"/>
        <circle cx="50" cy="50" r="${R - 1.6}" fill="none" stroke="#FDE68A" stroke-width=".8"/>${stars}`
}

const DRAW = { usbong, alon, capiz, araw }

// Markup is built only from the constants above, never from user input.
export function frameMarkup(frame, id) {
    return DRAW[frame] ? DRAW[frame](id) : ""
}

export function frameUnlocked(frame, points) {
    const f = FRAMES.find((x) => x.key === frame)
    return Boolean(f) && points >= f.min
}

export function titleFrame(points) {
    return [...FRAMES].reverse().find((f) => points >= f.min).key
}
