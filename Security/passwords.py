import re

# Keep in sync with frontend/src/validation.js.
MIN_LENGTH = 8

COMMON_PASSWORDS = {
    "password", "passw0rd", "p@ssw0rd", "p@ssword", "password1", "password12", "password123",
    "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "11111111", "000000",
    "00000000", "123123", "123123123", "654321", "987654321", "qwerty", "qwerty123", "qwertyuiop",
    "asdfghjkl", "zxcvbnm", "1qaz2wsx", "q1w2e3r4", "abc123", "abc12345", "abcd1234", "iloveyou",
    "iloveu", "admin", "admin123", "administrator", "welcome", "welcome1", "welcome123", "letmein",
    "monkey", "dragon", "sunshine", "princess", "football", "baseball", "superman", "starwars",
    "master", "trustno1", "changeme", "secret", "mahalkita", "philippines", "pilipinas",
    "comunisolve", "comunisolve1", "comunisolve123",
}

COMMON_WORDS = {"password", "passw0rd", "p@ssw0rd", "qwerty", "iloveyou", "welcome", "admin",
                "letmein", "abc", "abcd", "mahalkita", "comunisolve"}

def is_predictable(password: str) -> bool:
    lower = password.lower()
    if lower in COMMON_PASSWORDS:
        return True
    if re.sub(r"[\d\W_]+$", "", lower) in COMMON_WORDS:
        return True
    if len(set(lower)) <= 2:
        return True
    return lower in "abcdefghijklmnopqrstuvwxyz" or lower in "01234567890" or lower in "09876543210"

def password_problems(password: str) -> list[str]:
    problems = []
    if len(password) < MIN_LENGTH:
        problems.append("length")
    if not re.search(r"[a-z]", password):
        problems.append("lower")
    if not re.search(r"[A-Z]", password):
        problems.append("upper")
    if not re.search(r"\d", password):
        problems.append("number")
    if is_predictable(password):
        problems.append("common")
    return problems
