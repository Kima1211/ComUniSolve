import os
import re
import unicodedata
from dataclasses import dataclass, field

_WORDLIST_PATH = os.path.join(os.path.dirname(__file__), "wordlist.txt")

_cache = {"mtime": None, "block": [], "flag": []}


@dataclass
class KeywordResult:
    blocked: list[str] = field(default_factory=list)
    flagged: list[str] = field(default_factory=list)

    @property
    def is_blocked(self) -> bool:
        return bool(self.blocked)

    @property
    def is_flagged(self) -> bool:
        return bool(self.flagged)


def normalize(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _collapse_runs(text: str) -> str:
    return re.sub(r"(.)\1{2,}", r"\1", text)


def _join_spaced_letters(text: str) -> str:
    tokens = text.split()
    out: list[str] = []
    run: list[str] = []
    for token in tokens:
        if len(token) == 1:
            run.append(token)
            continue
        if len(run) >= 3:
            out.append("".join(run))
        else:
            out.extend(run)
        run = []
        out.append(token)
    if len(run) >= 3:
        out.append("".join(run))
    else:
        out.extend(run)
    return " ".join(out)


def _load() -> tuple[list[str], list[str]]:
    try:
        mtime = os.path.getmtime(_WORDLIST_PATH)
    except OSError:
        return [], []

    if _cache["mtime"] == mtime:
        return _cache["block"], _cache["flag"]

    block: list[str] = []
    flag: list[str] = []
    current = None
    with open(_WORDLIST_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower() == "[block]":
                current = block
                continue
            if line.lower() == "[flag]":
                current = flag
                continue
            if current is None:
                continue
            term = normalize(line)
            if term:
                current.append(term)

    _cache.update({"mtime": mtime, "block": block, "flag": flag})
    return block, flag


def _matches(haystack: str, terms: list[str]) -> list[str]:
    found = []
    for term in terms:
        if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", haystack):
            found.append(term)
    return found


def check_text(*parts: str) -> KeywordResult:
    block_terms, flag_terms = _load()
    if not block_terms and not flag_terms:
        return KeywordResult()

    haystack = normalize(" ".join(p for p in parts if p))
    variants = {haystack, _collapse_runs(haystack), _join_spaced_letters(haystack)}

    blocked = _first_match(variants, block_terms)
    flagged = _first_match(variants, flag_terms)

    return KeywordResult(blocked=blocked, flagged=flagged)


def _first_match(variants: set[str], terms: list[str]) -> list[str]:
    for variant in variants:
        found = _matches(variant, terms)
        if found:
            return found
    return []

