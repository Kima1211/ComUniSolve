from typing import List, Tuple

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# TF-IDF builds the list of problems the AI reads, and is the backup when the AI is down.
# 0.20: the worst unrelated pair scored 0.046, good matches 0.11-0.61 (test_matching.py).
BACKUP_THRESHOLD = 0.20

MAX_MATCHES = 5

# Up to this many problems the AI reads them all; above it, a keyword shortlist plus the newest posts.
SEND_ALL_UP_TO = 50
SHORTLIST_SIZE = 20
NEWEST_EXTRA = 5

# Filler words say nothing about what the problem is. The Filipino list needs a native-speaker check.
TAGALOG_FILLER = {
    "ang", "ng", "nang", "sa", "si", "ni", "kay", "mga", "na", "at", "o", "ay", "ako", "ko", "akin", "akong",
    "kong", "ikaw", "ka", "mo", "iyo", "siya", "sya", "niya", "nya", "kami", "tayo", "kayo", "sila", "nila",
    "namin", "natin", "ninyo", "nyo", "kanila", "ito", "iyan", "iyon", "yan", "yun", "yung", "ung", "dito",
    "diyan", "doon", "daw", "raw", "po", "opo", "ho", "din", "rin", "lang", "lamang", "naman", "pa", "pala",
    "ba", "kasi", "kaya", "para", "pero", "dahil", "kung", "kapag", "pag", "mag", "nag", "ma", "maka", "may",
    "mayroon", "meron", "wala", "walang", "hindi", "di", "oo", "sana", "talaga", "nga", "eh", "ano", "paano",
    "bakit", "saan", "kailan", "sino", "alin", "lahat", "isang", "isa", "ngayon", "tapos", "pati", "ganun",
    "ganito", "gusto", "parang", "pwede", "puwede", "sobrang",
}
WARAY_FILLER = {
    "an", "han", "hin", "ha", "ngan", "nga", "akon", "imo", "nimo", "iya", "hiya", "kita", "kamo", "hira",
    "nira", "ira", "amon", "aton", "ini", "iton", "adto", "didto", "diri", "dire", "dinhi", "gin", "la",
    "liwat", "gihapon", "gihap", "kun", "waray", "man", "unta", "kunta", "gud", "gad", "ngani", "yana",
    "ngay", "kada", "tanan", "mao", "it", "usa", "paonan", "hain", "hino", "sano", "lugod", "nala",
}
BISAYA_FILLER = {
    "ug", "og", "nako", "imong", "kini", "kana", "kadto", "dili", "naa", "adunay", "unsa", "ngano", "asa",
    "unsaon", "gyud", "jud", "sad", "pud", "usab", "kaayo", "kon",
}
FILLER_WORDS = sorted(set(ENGLISH_STOP_WORDS) | TAGALOG_FILLER | WARAY_FILLER | BISAYA_FILLER)

def _problem_text(title: str, description: str | None, category: str | None = None) -> str:
    parts = [title or "", title or "", description or "", category or ""]
    return " ".join(parts).strip()

def find_similar(
    query_title: str,
    query_description: str | None,
    candidates: List[dict],
    threshold: float = BACKUP_THRESHOLD,
    limit: int = MAX_MATCHES,
) -> List[Tuple[int, float]]:
    query = _problem_text(query_title, query_description)
    if not query.strip() or not candidates:
        return []

    corpus = [query] + [
        _problem_text(c.get("title"), c.get("description"), c.get("category"))
        for c in candidates
    ]

    vectorizer = TfidfVectorizer(
        stop_words=FILLER_WORDS,
        lowercase=True,
        ngram_range=(1, 2),
        min_df=1,
    )

    try:
        matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        return []

    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    ranked = [
        (candidates[i]["id"], float(score))
        for i, score in enumerate(scores)
        if score >= threshold
    ]
    ranked.sort(key=lambda pair: pair[1], reverse=True)
    return ranked[:limit]

def build_candidate_pool(
    query_title: str,
    query_description: str | None,
    candidates: List[dict],
) -> List[Tuple[int, float]]:
    """Which existing problems the AI reads, each with its keyword score (used to break ties)."""
    scores = dict(find_similar(query_title, query_description, candidates, threshold=0.0, limit=len(candidates)))
    if len(candidates) <= SEND_ALL_UP_TO:
        return [(c["id"], scores.get(c["id"], 0.0)) for c in candidates]

    best = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:SHORTLIST_SIZE]
    chosen = dict(best)
    # Ids grow with time, so the highest ids are the newest posts.
    for c in sorted(candidates, key=lambda c: c["id"], reverse=True):
        if len(chosen) >= SHORTLIST_SIZE + NEWEST_EXTRA:
            break
        chosen.setdefault(c["id"], scores.get(c["id"], 0.0))
    return list(chosen.items())
