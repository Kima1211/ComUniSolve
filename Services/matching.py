"""Solution Matching — finding problems that have already been solved.

The idea: when someone posts "our street light is broken", the community may
have answered that exact question three months ago. Rather than making them
wait for a new answer, surface the old one.

How it works, in plain terms:

1. **TF-IDF** turns each problem's text into a list of numbers. TF (term
   frequency) counts how often a word appears in one problem; IDF (inverse
   document frequency) reduces the weight of words that appear in *every*
   problem. So "the" and "problem" count for almost nothing, while "barangay"
   or "tubig" carry real signal. Every problem becomes a point in space.

2. **Cosine similarity** measures the angle between two of those points. Two
   problems using the same distinctive words point in nearly the same
   direction, giving a score near 1.0; unrelated ones sit near 0.0. Angle
   rather than distance matters, so a long problem and a short one about the
   same topic still match.

Both run locally through scikit-learn. No API key, no network call, and every
number is explainable — which is why this, not the Gemini API, is the core of
the feature. Gemini is an enhancement layer on top, not a dependency.
"""
from typing import List, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Below this score, a "match" is noise. Tuned by hand against real posts:
# 0.10 lets loosely related community problems through, while filtering pairs
# that merely share common words.
SIMILARITY_THRESHOLD = 0.10

MAX_MATCHES = 5


def _problem_text(title: str, description: str | None, category: str | None = None) -> str:
    """Everything worth matching on, as one string.

    The title is repeated because it is the most concentrated description of a
    problem - counting it twice raises the weight of its words without needing
    a separate weighting step.
    """
    parts = [title or "", title or "", description or "", category or ""]
    return " ".join(parts).strip()


def find_similar(
    query_title: str,
    query_description: str | None,
    candidates: List[dict],
    threshold: float = SIMILARITY_THRESHOLD,
    limit: int = MAX_MATCHES,
) -> List[Tuple[int, float]]:
    """Return [(candidate_id, score), ...], most similar first.

    `candidates` is a list of dicts with id/title/description/category.
    """
    query = _problem_text(query_title, query_description)
    if not query.strip() or not candidates:
        return []

    corpus = [query] + [
        _problem_text(c.get("title"), c.get("description"), c.get("category"))
        for c in candidates
    ]

    # stop_words="english" drops "the", "and", "is"... Note the honest
    # limitation for this project: there is no Tagalog stop-word list here, so
    # Tagalog filler words ("ang", "ng", "sa") are not removed by name. IDF
    # still reduces their weight automatically, because they appear in most
    # posts - which is the mechanism doing the real work either way.
    vectorizer = TfidfVectorizer(
        stop_words="english",
        lowercase=True,
        ngram_range=(1, 2),   # single words and adjacent pairs ("street light")
        min_df=1,
    )

    try:
        matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        # Raised when every word was filtered out as a stop word.
        return []

    # Row 0 is the query; compare it against every other row at once.
    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    ranked = [
        (candidates[i]["id"], float(score))
        for i, score in enumerate(scores)
        if score >= threshold
    ]
    ranked.sort(key=lambda pair: pair[1], reverse=True)
    return ranked[:limit]


# How many candidates to hand to the AI layer. Larger than MAX_MATCHES on
# purpose: the point of the pool is to include problems TF-IDF scored near
# zero, because those are exactly the paraphrased and Tagalog posts that
# word-overlap cannot see but Gemini can.
CANDIDATE_POOL = 20


def build_candidate_pool(
    query_title: str,
    query_description: str | None,
    candidates: List[dict],
    limit: int = CANDIDATE_POOL,
) -> List[Tuple[int, float]]:
    """Top `limit` candidates by TF-IDF score, threshold ignored.

    find_similar() answers "which of these are similar enough to show?".
    This answers "which are worth a second opinion?" - a different question,
    which is why the threshold does not apply.
    """
    return find_similar(
        query_title,
        query_description,
        candidates,
        threshold=0.0,
        limit=limit,
    )
