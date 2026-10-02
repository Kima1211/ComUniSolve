// Keep in sync with Schemas/user.py (names, birth date) and Security/passwords.py (passwords).

export const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"]
export const MIN_AGE = 13
export const NO_PROVINCE = "none"

const NAME = /^\p{L}+(?:[ .'-]+\p{L}+)*\.?$/u
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COMMON_PASSWORDS = new Set([
    "password", "passw0rd", "p@ssw0rd", "p@ssword", "password1", "password12", "password123",
    "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "11111111", "000000",
    "00000000", "123123", "123123123", "654321", "987654321", "qwerty", "qwerty123", "qwertyuiop",
    "asdfghjkl", "zxcvbnm", "1qaz2wsx", "q1w2e3r4", "abc123", "abc12345", "abcd1234", "iloveyou",
    "iloveu", "admin", "admin123", "administrator", "welcome", "welcome1", "welcome123", "letmein",
    "monkey", "dragon", "sunshine", "princess", "football", "baseball", "superman", "starwars",
    "master", "trustno1", "changeme", "secret", "mahalkita", "philippines", "pilipinas",
    "comunisolve", "comunisolve1", "comunisolve123",
])
const COMMON_WORDS = new Set(["password", "passw0rd", "p@ssw0rd", "qwerty", "iloveyou", "welcome", "admin",
    "letmein", "abc", "abcd", "mahalkita", "comunisolve"])

export function cleanText(value) {
    return (value || "").trim().replace(/\s+/g, " ")
}

export function nameError(value, required) {
    const v = cleanText(value)
    if (!v) return required ? "validation.required" : null
    return NAME.test(v) ? null : "validation.name"
}

export function emailError(value) {
    const v = (value || "").trim()
    if (!v) return "validation.required"
    return EMAIL.test(v) ? null : "validation.email"
}

function ageOn(birth, today) {
    const before = today.getMonth() < birth.getMonth()
        || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    return today.getFullYear() - birth.getFullYear() - (before ? 1 : 0)
}

export function birthDateError(value) {
    if (!value) return "validation.required"
    const birth = new Date(`${value}T00:00:00`)
    if (Number.isNaN(birth.getTime()) || birth.getFullYear() < 1900) return "validation.date"
    const today = new Date()
    if (birth > today) return "validation.futureDate"
    if (ageOn(birth, today) < MIN_AGE) return "validation.tooYoung"
    return null
}

function isPredictable(password) {
    const lower = password.toLowerCase()
    if (COMMON_PASSWORDS.has(lower)) return true
    if (COMMON_WORDS.has(lower.replace(/[\d\W_]+$/, ""))) return true
    if (new Set(lower).size <= 2) return true
    return "abcdefghijklmnopqrstuvwxyz".includes(lower) || "01234567890".includes(lower) || "09876543210".includes(lower)
}

export function passwordChecks(password) {
    return {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /\d/.test(password),
        common: password.length > 0 && !isPredictable(password),
    }
}

export function passwordOk(password) {
    return Object.values(passwordChecks(password)).every(Boolean)
}

export const EMPTY_PERSON = { first_name: "", middle_name: "", last_name: "", suffix: "", birth_date: "", sex: "" }
export const EMPTY_ADDRESS = { region_code: "", province_code: "", city_code: "", barangay_code: "", street: "" }

export function personErrors(p) {
    const errors = {
        first_name: nameError(p.first_name, true),
        middle_name: nameError(p.middle_name, false),
        last_name: nameError(p.last_name, true),
        birth_date: birthDateError(p.birth_date),
    }
    return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

export function addressErrors(a) {
    const errors = {}
    for (const field of ["region_code", "province_code", "city_code", "barangay_code"]) {
        if (!a[field]) errors[field] = "validation.choose"
    }
    if (cleanText(a.street).length > 255) errors.street = "validation.tooLong"
    return errors
}

// The shape the API expects: blanks become null, NO_PROVINCE becomes a missing province.
export function personPayload(p) {
    return {
        first_name: cleanText(p.first_name),
        middle_name: cleanText(p.middle_name) || null,
        last_name: cleanText(p.last_name),
        suffix: p.suffix || null,
        birth_date: p.birth_date,
        sex: p.sex || null,
    }
}

export function addressPayload(a) {
    return {
        region_code: a.region_code,
        province_code: a.province_code && a.province_code !== NO_PROVINCE ? a.province_code : null,
        city_code: a.city_code,
        barangay_code: a.barangay_code,
        street: cleanText(a.street) || null,
    }
}

export function personFromUser(u) {
    return {
        first_name: u.first_name || "", middle_name: u.middle_name || "", last_name: u.last_name || "",
        suffix: u.suffix || "", birth_date: u.birth_date || "", sex: u.sex || "",
    }
}

export function addressFromUser(u) {
    return {
        region_code: u.region_code || "",
        province_code: u.region_code ? (u.province_code || NO_PROVINCE) : "",
        city_code: u.city_code || "",
        barangay_code: u.barangay_code || "",
        street: u.street || "",
    }
}
