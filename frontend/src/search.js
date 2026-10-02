import en from "./i18n/en"
import tl from "./i18n/tl"
import { SECTORS } from "./categories"

// Every word must appear (any order); case and accents are ignored and small typos forgiven.

export function normalize(text) {
    return (text || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
}

export function queryWords(q) {
    return normalize(q).split(/\s+/).filter(Boolean)
}

// Edit distance, counting a swap of two neighbouring letters as one change.
export function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1
    let beforePrev = null
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
        const cur = [i]
        let rowMin = i
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            // Two neighbouring letters swapped ("ahs" vs "ash") counts as one change.
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d = Math.min(d, beforePrev[j - 2] + 1)
            }
            cur[j] = d
            if (d < rowMin) rowMin = d
        }
        if (rowMin > max) return max + 1
        beforePrev = prev
        prev = cur
    }
    return prev[b.length]
}

// How many typos a word may have. Short words must be exact, or "ng"/"sa" would match everything.
function allowedTypos(word) {
    if (word.length <= 3) return 0
    if (word.length <= 7) return 1
    return 2
}

// Category and sector names in both languages, so "edukasyon" finds "education".
const cache = new WeakMap()
function indexOf(problem) {
    let entry = cache.get(problem)
    if (!entry) {
        const cat = `category.${problem.category}`
        const sector = SECTORS.find((s) => s.categories.includes(problem.category))
        const sec = sector ? `sector.${sector.name}` : ""
        const text = normalize([problem.title, problem.description, en[cat], tl[cat], en[sec], tl[sec]].join(" "))
        entry = { text, tokens: [...new Set(text.split(/[^a-z0-9]+/).filter(Boolean))] }
        cache.set(problem, entry)
    }
    return entry
}

function wordFound(word, { text, tokens }) {
    if (text.includes(word)) return true
    const max = allowedTypos(word)
    if (max === 0) return false
    return tokens.some((token) => {
        if (editDistance(word, token, max) <= max) return true
        // A misspelled start of a longer word ("scholr" -> "scholarship"), 5+ letters only.
        if (word.length >= 5 && token.length > word.length) {
            for (const len of [word.length - 1, word.length, word.length + 1]) {
                if (editDistance(word, token.slice(0, len), max) <= max) return true
            }
        }
        return false
    })
}

export function searchProblems(problems, q) {
    const words = queryWords(q)
    if (words.length === 0) return { results: problems, closest: [] }

    const results = problems.filter((p) => words.every((w) => wordFound(w, indexOf(p))))
    if (results.length > 0) return { results, closest: [] }

    const meaningful = words.filter((w) => w.length >= 3)
    const needed = Math.ceil(meaningful.length / 2)
    if (meaningful.length < 2) return { results, closest: [] } // one word: nothing "partly" matches

    const closest = problems
        .map((p, order) => ({ p, order, found: meaningful.filter((w) => wordFound(w, indexOf(p))).length }))
        .filter((x) => x.found >= needed)
        .sort((a, b) => b.found - a.found || a.order - b.order) // most words first, then newest
        .map((x) => x.p)
    return { results, closest }
}
