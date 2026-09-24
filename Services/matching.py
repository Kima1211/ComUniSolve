from typing import List, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SIMILARITY_THRESHOLD = 0.10

MAX_MATCHES = 5


def _problem_text(title: str, description: str | None, category: str | None = None) -> str:
    parts = [title or "", title or "", description or "", category or ""]
    return " ".join(parts).strip()


def find_similar(
    query_title: str,
    query_description: str | None,
    candidates: List[dict],
    threshold: float = SIMILARITY_THRESHOLD,
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
        stop_words="english",
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


CANDIDATE_POOL = 20


def build_candidate_pool(
    query_title: str,
    query_description: str | None,
    candidates: List[dict],
    limit: int = CANDIDATE_POOL,
) -> List[Tuple[int, float]]:
    return find_similar(
        query_title,
        query_description,
        candidates,
        threshold=0.0,
        limit=limit,
    )

