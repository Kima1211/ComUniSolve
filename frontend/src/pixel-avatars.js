// Pixel avatars a user can pick instead of initials. Keep the keys in sync with
// AVATAR_ICONS / AVATAR_COLORS in Models/user.py.

export const AVATAR_COLORS = {
    amber: "#F59E0B",
    terracotta: "#C2410C",
    ube: "#6D28D9",
    teal: "#0F766E",
    dagat: "#0369A1",
    dahon: "#4D7C0F",
    rosas: "#BE185D",
    kape: "#78350F",
}

const SKIN = { light: "#EDC29A", tan: "#D9A066", morena: "#C68642", deep: "#9C6436" }

// One letter per colour in the sprite rows; "s" is the skin, "S" its shadow, "." is empty.
const PALETTE = {
    k: "#1C2230", h: "#1F1A17", d: "#4A3121", w: "#FFFFFF", c: "#FFF8EC", y: "#FCD34D", Y: "#F59E0B",
    r: "#9A3B2A", R: "#DC2626", o: "#F97316", b: "#93C5FD", B: "#2563EB", n: "#1E3A8A", g: "#D1D5DB",
    G: "#4B5563", e: "#C8A165", E: "#9C7A45", p: "#F9A8D4", l: "#4ADE80", v: "#A78BFA", P: "#F4A0A0",
}

// 16 x 16 pixels each, one character per problem category.
export const AVATAR_SPRITES = {
    enrollment: {
        category: "Enrollment & Requirements",
        skin: "tan",
        rows: [
            "................",
            ".....hhhhhh.....",
            "....hhhhhhhh....",
            "...hhhhhhhhhh...",
            "...hhhssssshh...",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....wgwSSwgw....",
            "..gwwwwnnwcccg..",
            ".gwwwwwnEeeeeEw.",
            "gwwwwwwneEeeEeww",
            "wwwwwwwweeEEeeww",
            "wwwwwwwweeeeeeww",
        ],
    },
    scholarship: {
        category: "Tuition & Scholarships",
        skin: "morena",
        rows: [
            "................",
            "....kkkkkkkk....",
            "..kkkkkkkkkkkk..",
            "....GGGGGGGG.Y..",
            "...dssssssssdY..",
            "..dssskssksssd..",
            "..ddPssssssPdd..",
            "..ddsssrrsssdd..",
            "..dd.ssssss.dd..",
            "..dd..SSSS..dd..",
            "..kkkkkwwkkkkk..",
            ".kkkkkkwwkkkkkk.",
            "kkkkkkkkkkkkkkkk",
            "kkkkkkkYYkkkkkkk",
            "kkkkkkkYYkkkkkkk",
            "kkkkkkkkkkkkkkkk",
        ],
    },
    learning: {
        category: "Learning & Academics",
        skin: "light",
        rows: [
            "......hhhh......",
            "......hhhh......",
            "....hhhhhhhh....",
            "...hhhhhhhhhh...",
            "...hhsssssshh...",
            "...sGGGssGGGs...",
            "...sbkbGGbkbs...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....bbbbbbbb....",
            "..bbbbbbbbbbbb..",
            ".bbccccGGccccbb.",
            "bbbcggcGGcggcbbb",
            "bbbccccGGccccbbb",
        ],
    },
    facilities: {
        category: "School Facilities & Access",
        skin: "deep",
        rows: [
            "................",
            "......yyyy......",
            "....yyyyYyyy....",
            "...yyyyyYyyyy...",
            "..yyyyyyyyyyyy..",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....oooooooo....",
            "..oooooooooooo..",
            ".ooooooGGoooooo.",
            "cccccccccccccccc",
            "oooooooGGooooooo",
            "oooooooooooooooo",
        ],
    },
    supplies: {
        category: "School Supplies & Costs",
        skin: "tan",
        rows: [
            "................",
            ".....dddddd.....",
            "....dddddddd.dd.",
            "...dddddddddddd.",
            "...dssssssssddd.",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....wRwwwwRw....",
            "..wwwRwkkwRwww..",
            ".wwwwRwwwwRwwww.",
            "wwwwwRwwwwRwwwww",
            "wwwwwRwwwwRwwwww",
            "wwwwwRwwwwRwwwww",
        ],
    },
    welfare: {
        category: "Student Welfare & Safety",
        skin: "light",
        rows: [
            "......wwww......",
            ".....wwRRww.....",
            "....hhhhhhhh....",
            "...hhhhhhhhhh...",
            "..hhsssssssshhh.",
            "..hssskssksssh..",
            "..hhPssssssPhh..",
            "..hhsssrrssshh..",
            "..hh.ssssss.hh..",
            "..hh..SSSS..hh..",
            "..hhwwwwwwwwhh..",
            "..wwwwwkkwwwww..",
            ".wwwwwwwwwRwRww.",
            "wwwwwwwwwwRRRwww",
            "wwwwwwwwwwwRwwww",
            "wwwwwwwwwwwwwwww",
        ],
    },
    devices: {
        category: "Devices & Repair",
        skin: "morena",
        rows: [
            "................",
            ".....hhhhhh.....",
            "....hhhhhhhh....",
            "...hhhhhhhhhh...",
            "...hssssssssh...",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....BBBBBBBB....",
            "..BBBBBkkBBBBB..",
            "kkkkBBBBBBBYBBB.",
            "kbbkBBBBBBGkGBBB",
            "kbbkBBBBBBGGGBBB",
            "kkkkBBBBBBBBBBBB",
        ],
    },
    internet: {
        category: "Internet & Connectivity",
        skin: "deep",
        rows: [
            "................",
            ".....kkkkkk.....",
            "....khhhhhhk....",
            "...khhhhhhhhk...",
            "..kksssssssskkk.",
            "..kksskssksskk..",
            "..kkPssssssPkk..",
            "...ksssrrsss....",
            "....kssssss.....",
            "......SSSS......",
            "....gggggggg....",
            "..gggggggggggg..",
            ".gggBBBBBBBBggg.",
            "ggggBggggggBgggg",
            "ggggggBBBBgggggg",
            "gggggggBBggggggg",
        ],
    },
    accounts: {
        category: "Accounts & Passwords",
        skin: "light",
        rows: [
            "................",
            "....dddddd......",
            "...dddddddddd...",
            "...ddddddddddd..",
            "...dssssssssd...",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....GYGGGGYG....",
            "..GGGGYGGYGGGG..",
            ".GGGGGGYYGGGGGG.",
            "GGGGGGwwwwGGGGGG",
            "GGGGGGwYkwGGGGGG",
            "GGGGGGwwwwGGGGGG",
        ],
    },
    apps: {
        category: "Online Services & Apps",
        skin: "tan",
        rows: [
            "................",
            ".....hhhhhh.....",
            "....hhhhhhhh....",
            "...hhhhhhhhhh...",
            "...hhhsssssshh..",
            "..hssskssksssh..",
            "..hhPssssssPhh..",
            "..hhsssrrssshh..",
            "..hh.ssssss.hh..",
            "..hh..SSSS..hh..",
            "....pppppppp....",
            "..pppppppppkkkk.",
            ".ppppppppppkBYk.",
            "pppppppppppklvk.",
            "pppppppppppkwwk.",
            "pppppppppppkkkk.",
        ],
    },
    office: {
        category: "Software & Office Tools",
        skin: "morena",
        rows: [
            "................",
            "....hhhhhhh.....",
            "...hhhhhhhhhh...",
            "...hhhhhhhhhh...",
            "...hssssssssh...",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....wwwkkwww....",
            "..wwwwwRRwwwww..",
            ".wwwwwwRRwwwwww.",
            "wwwwwwwRRwwwwwww",
            "gggggggggggggggg",
            "gggggggwwggggggg",
        ],
    },
    safety: {
        category: "Online Safety & Scams",
        skin: "deep",
        rows: [
            "................",
            ".....nnnnnn.....",
            "....nnnYYnnn....",
            "...nnnnnnnnnn...",
            "..kkkkkkkkkkkk..",
            "...ssskssksss...",
            "....PssssssP....",
            "....sssrrsss....",
            ".....ssssss.....",
            "......SSSS......",
            "....nnnnnnnn....",
            "..nnnnnwwnnnnn..",
            ".nnnnnnnnnnYYnn.",
            "nnnnnnnnnnnYYnnn",
            "nnnnnnnnnnnnnnnn",
            "nnnnnnnnnnnnnnnn",
        ],
    },
}

function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16)
    const channel = (x) => Math.max(0, Math.min(255, Math.round(x * factor)))
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((x) => channel(x).toString(16).padStart(2, "0")).join("")
}

const cache = {}

// Turns a sprite into a list of coloured squares, once per character.
export function spritePixels(icon) {
    if (cache[icon]) return cache[icon]
    const sprite = AVATAR_SPRITES[icon]
    if (!sprite) return null
    const skin = SKIN[sprite.skin]
    const colours = { ...PALETTE, s: skin, S: shade(skin, 0.86) }
    const pixels = []
    sprite.rows.forEach((row, y) => {
        ;[...row].forEach((letter, x) => {
            if (colours[letter]) pixels.push({ x, y, fill: colours[letter] })
        })
    })
    cache[icon] = pixels
    return pixels
}

export function hasPixelAvatar(person) {
    return Boolean(person && AVATAR_SPRITES[person.avatar_icon] && AVATAR_COLORS[person.avatar_color])
}
