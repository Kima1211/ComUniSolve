"""Gemini API client — the AI layer of Solution Matching.

Its one job here is re-ranking: TF-IDF gathers plausible candidates cheaply,
and Gemini decides which of them are actually about the same underlying
problem, and says why.

Design rules, all deliberate:

* **Optional.** Unlike Services/email.py, a missing GEMINI_API_KEY does NOT
  raise at import. The app must run without it, falling back to TF-IDF alone.
* **Never fatal.** Any failure - no key, timeout, quota, malformed reply -
  returns None. The caller then uses the TF-IDF result it already has.
* **One call per search**, not per problem, so the free quota survives a week
  of user testing.
* Gemini's reply is treated as *data*, never as instructions.

Privacy note worth being ready for at defense: this sends problem titles and
descriptions - user-generated content - to a third-party API. Nothing
identifying is included; no names, no emails, no user ids.
"""
import json
import os
import time
from typing import List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")          # optional by design
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

# Free-tier limits are counted PER MODEL - 20 requests per day each. So a list
# of models is a list of separate daily budgets, and walking down it when one
# is exhausted is simply using the allowance you already have.
#
# Ordered cheapest-and-least-contended first: the lite model has double the
# per-minute allowance (10 rather than 5), and older models are less busy than
# whatever launched most recently.
DEFAULT_MODEL_CHAIN = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]

_configured = os.getenv("GEMINI_MODELS", "").strip()
MODEL_CHAIN = (
    [m.strip() for m in _configured.split(",") if m.strip()]
    if _configured
    else DEFAULT_MODEL_CHAIN
)

# Kept for anything still reading it, and so a single-model override works.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", MODEL_CHAIN[0])

# 8 seconds was too tight in practice: a re-rank of 20 candidates has real
# generation work to do, and the first call after an idle period is slower
# still. Tunable from .env without touching code.
TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT", "25"))
MAX_CANDIDATES = 20

# Statuses worth trying again: the SERVER is busy or briefly broken.
#
# 429 is deliberately NOT in this set. A 429 means the rate limit on YOUR key
# is exhausted - retrying spends another request from a budget that has already
# run out, making the problem worse rather than better. 401 (bad key) and 400
# (bad request) are excluded for the same reason: they fail identically twice.
RETRYABLE_STATUSES = {500, 502, 503, 504}

# Not retried, but still worth trying the other model for - limits are counted
# per model, so a second model may have budget left.
RATE_LIMITED_STATUS = 429

RETRY_DELAY_SECONDS = 1.5

# Re-ranking the same problem against the same candidates gives the same
# answer, so asking twice spends quota for nothing. A problem's detail page is
# viewed far more often than its content changes.
_CACHE: dict[str, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = int(os.getenv("GEMINI_CACHE_TTL", "900"))   # 15 minutes
CACHE_MAX_ENTRIES = 200


def is_enabled() -> bool:
    return bool(GEMINI_API_KEY)


_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "relevance": {"type": "string", "enum": ["high", "medium", "low"]},
                    "reason": {"type": "string"},
                },
                "required": ["id", "relevance", "reason"],
            },
        }
    },
    "required": ["matches"],
}


def _candidate_line(c: dict) -> str:
    """One candidate, with enough of its description to judge meaning by.

    Titles alone are thin evidence - "Street light on Rizal St." and a Tagalog
    post about a dark corner are the same problem, but you need the body text
    to be confident. Descriptions are INPUT tokens, which are cheap and fast;
    the latency problem was output tokens, so this costs almost nothing.
    """
    description = (c.get("description") or "").strip().replace("\n", " ")
    if len(description) > 300:
        description = description[:300] + "..."
    parts = [f'- id {c["id"]}: "{c["title"]}"']
    if c.get("category"):
        parts.append(f'[category: {c["category"]}]')
    if description:
        parts.append(f"| {description}")
    return " ".join(parts)


def _build_prompt(query_title: str, query_description: Optional[str], candidates: List[dict]) -> str:
    listing = "\n".join(_candidate_line(c) for c in candidates)
    return (
        "You are helping a Filipino community platform decide whether a newly written "
        "problem has already been asked before. Posts may be in English, Tagalog, or a "
        "mix of both. Treat different wording for the same real-world issue as a match "
        '(for example "street light is out", "broken lamppost", and "walang ilaw sa kanto" '
        "all describe the same problem).\n\n"
        f"NEW PROBLEM\nTitle: {query_title}\nDescription: {query_description or '(none)'}\n\n"
        f"EXISTING PROBLEMS\n{listing}\n\n"
        "Return the existing problems that describe the same underlying issue as the new "
        "one, or that are closely related to it. Be generous across languages and wording: "
        "a Tagalog post and an English post about the same real-world situation ARE a match. "
        "Use 'high' when it is clearly the same issue, 'medium' when it is the same kind of "
        "issue elsewhere, 'low' when it is only loosely related. Leave genuinely unrelated "
        "problems out of your answer entirely. Give each one a reason of at most 15 words, "
        "written for the person who posted. Only use ids from the list above."
    )


def _cache_key(query_title: str, query_description: Optional[str], candidates: List[dict]) -> str:
    """Identifies one question: this text, against exactly these candidates.

    Includes the candidate ids, so the answer is correctly discarded as soon as
    a new problem is posted - a stale match list would be worse than none.
    """
    ids = ",".join(str(c["id"]) for c in sorted(candidates, key=lambda c: c["id"]))
    return f"{query_title}|{query_description or ''}|{ids}"


def rerank(query_title: str, query_description: Optional[str], candidates: List[dict]) -> Optional[dict]:
    """Return {problem_id: {"relevance": str, "reason": str}}, or None on any failure.

    None means "the AI layer is unavailable" - the caller falls back to TF-IDF.
    An empty dict means it ran and found nothing related.
    """
    if not is_enabled() or not candidates:
        return None

    key = _cache_key(query_title, query_description, candidates)
    cached = _CACHE.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        print(f"[GEMINI] cache hit - no API call, {len(cached[1])} related")
        return cached[1]

    payload = {
        "model": GEMINI_MODEL,
        "input": _build_prompt(query_title, query_description, candidates[:MAX_CANDIDATES]),
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": _RESPONSE_SCHEMA,
        },
    }

    headers = {
        "content-type": "application/json",
        # Google's documented header for a Gemini API key. If your key is
        # rejected with 401, the other accepted form is
        # "Authorization": f"Bearer {GEMINI_API_KEY}".
        "x-goog-api-key": GEMINI_API_KEY,
    }

    started = time.monotonic()
    response = None

    # Walk the chain: each model has its own daily allowance, so an exhausted
    # one is a reason to move on rather than to give up. A 503 is retried once
    # per model because it comes back in well under a second; a 429 is not,
    # because retrying spends a budget that has already run out.
    models = MODEL_CHAIN

    for index, model in enumerate(models):
        payload["model"] = model
        for attempt in (1, 2):
            try:
                response = requests.post(
                    GEMINI_API_URL, json=payload, headers=headers, timeout=TIMEOUT_SECONDS
                )
            except requests.exceptions.Timeout:
                print(
                    f"[GEMINI] {model} timed out after {TIMEOUT_SECONDS}s with "
                    f"{len(candidates)} candidates - falling back to TF-IDF. "
                    f"Raise GEMINI_TIMEOUT in .env if this repeats."
                )
                return None
            except requests.exceptions.RequestException as e:
                print(f"[GEMINI] could not reach the API: {e}")
                return None

            if response.status_code == RATE_LIMITED_STATUS:
                # Do not retry - just move on to the next model, whose limit
                # is counted separately.
                print(f"[GEMINI] {model}: rate limit reached on your key (429)")
                break

            if response.status_code not in RETRYABLE_STATUSES:
                # Success, or a failure retrying cannot fix. Either way, say
                # what happened - moving on in silence is how a wrong model
                # name looks identical to an exhausted quota.
                if response.status_code >= 400:
                    print(f"[GEMINI] {model} failed {response.status_code}: {response.text[:200]}")
                break

            print(f"[GEMINI] {model} returned {response.status_code} (attempt {attempt}/2, server busy)")
            if attempt == 1:
                time.sleep(RETRY_DELAY_SECONDS)

        if response is not None and response.status_code < 400:
            if index > 0:
                print(f"[GEMINI] {model} answered (model {index + 1} of {len(models)})")
            break

        if index < len(models) - 1:
            print(f"[GEMINI] trying {models[index + 1]} next")

    elapsed = time.monotonic() - started

    if response is None:
        return None

    if response.status_code >= 400:
        if response.status_code == RATE_LIMITED_STATUS:
            print(
                f"[GEMINI] no model answered after {elapsed:.1f}s; the last was rate-limited. "
                f"The free tier allows 5 requests per minute and 20 per day PER MODEL - a "
                f"per-minute limit clears in a minute, a daily one tomorrow. Check the lines "
                f"above: a model that failed for a different reason is a different problem. "
                f"Showing TF-IDF results."
            )
        elif response.status_code in RETRYABLE_STATUSES:
            print(
                f"[GEMINI] every model was busy ({response.status_code}) after {elapsed:.1f}s "
                f"- showing TF-IDF results instead. This is Google's side, not yours."
            )
        else:
            print(f"[GEMINI] rejected {response.status_code}: {response.text[:300]}")
        return None

    try:
        body = response.json()
        # Documented location of the model's output. Walked defensively rather
        # than indexed blindly, so a shape change degrades instead of crashing.
        text = None
        for step in body.get("steps", []):
            for part in step.get("content", []):
                if part.get("type") == "text" and part.get("text"):
                    text = part["text"]
                    break
            if text:
                break

        if not text:
            print(f"[GEMINI] no text in response: {json.dumps(body)[:300]}")
            return None

        parsed = json.loads(text)
        valid_ids = {c["id"] for c in candidates}

        ranked = {}
        for m in parsed.get("matches", []):
            pid = m.get("id")
            # Only ids we actually sent. The model's reply is data, and data
            # from outside is never trusted to be well-behaved.
            if pid in valid_ids and m.get("relevance") in {"high", "medium", "low"}:
                ranked[pid] = {
                    "relevance": m["relevance"],
                    "reason": str(m.get("reason", ""))[:300],
                }

        print(f"[GEMINI] {len(ranked)} related of {len(candidates)} candidates in {elapsed:.1f}s")
        if not ranked:
            # A zero result is either correct or a sign the wrong things were
            # compared. Printing what was actually sent turns that from a
            # guess into something you can read.
            titles = ", ".join(f'#{c["id"]} "{c["title"][:50]}"' for c in candidates[:MAX_CANDIDATES])
            print(f"[GEMINI] nothing matched. query={query_title!r} | candidates were: {titles}")

        # Cache successes only. A failure must never be remembered, or one bad
        # minute would suppress the AI layer for the next fifteen.
        if len(_CACHE) >= CACHE_MAX_ENTRIES:
            oldest = min(_CACHE, key=lambda k: _CACHE[k][0])
            del _CACHE[oldest]
        _CACHE[key] = (time.time(), ranked)
        # An empty dict is a real answer - "the AI looked and found nothing
        # related". Only None means the AI could not be consulted at all. The
        # caller needs to tell those apart.
        return ranked

    except (ValueError, KeyError, TypeError) as e:
        print(f"[GEMINI] could not parse the response: {e}")
        return None
