"""AI re-ranking for Solution Matching.

Gemini is the provider. A second provider (Groq) is supported but dormant -
it activates only if GROQ_API_KEY is set. Any failure returns None, and the
caller falls back to TF-IDF.
"""
import json
import os
import time
from typing import Callable, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Best model first. The chain is for resilience, not budget.
DEFAULT_GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
]

DEFAULT_GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]


def _chain_from_env(var: str, default: List[str]) -> List[str]:
    configured = os.getenv(var, "").strip()
    if configured:
        return [m.strip() for m in configured.split(",") if m.strip()]
    return default


MODEL_CHAIN = _chain_from_env("GEMINI_MODELS", DEFAULT_GEMINI_MODELS)
GROQ_MODEL_CHAIN = _chain_from_env("GROQ_MODELS", DEFAULT_GROQ_MODELS)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", MODEL_CHAIN[0] if MODEL_CHAIN else "")

TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT", "25"))

# Wall-clock budget across every provider and model.
DEADLINE_SECONDS = int(os.getenv("AI_DEADLINE", "45"))

MAX_CANDIDATES = 20

# Retry only when the SERVER is at fault. 429 means your own quota is spent,
# so retrying makes it worse; 400 and 401 fail identically twice.
RETRYABLE_STATUSES = {500, 502, 503, 504}
RATE_LIMITED_STATUS = 429
RETRY_DELAY_SECONDS = 1.5

_CACHE: dict[str, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = int(os.getenv("GEMINI_CACHE_TTL", "900"))
CACHE_MAX_ENTRIES = 200


def is_enabled() -> bool:
    return bool(GEMINI_API_KEY or GROQ_API_KEY)


_MATCH_PROPERTIES = {
    "id": {"type": "integer"},
    "relevance": {"type": "string", "enum": ["high", "medium", "low"]},
    "reason": {"type": "string"},
}

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": _MATCH_PROPERTIES,
                "required": ["id", "relevance", "reason"],
            },
        }
    },
    "required": ["matches"],
}

# Groq's strict mode additionally requires additionalProperties: false.
_STRICT_SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": _MATCH_PROPERTIES,
                "required": ["id", "relevance", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["matches"],
    "additionalProperties": False,
}


def _candidate_line(c: dict) -> str:
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
        "written for the person who posted. Only use ids from the list above. "
        'Reply with JSON only, in the form {"matches": [...]}. '
        'If nothing is related, reply {"matches": []}.'
    )


def _cache_key(query_title: str, query_description: Optional[str], candidates: List[dict]) -> str:
    """Includes candidate ids, so the answer expires when a new problem is posted."""
    ids = ",".join(str(c["id"]) for c in sorted(candidates, key=lambda c: c["id"]))
    return f"{query_title}|{query_description or ''}|{ids}"


def _gemini_body(model: str, prompt: str) -> dict:
    return {
        "model": model,
        "input": prompt,
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": _RESPONSE_SCHEMA,
        },
    }


def _gemini_headers() -> dict:
    return {"content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY}


def _gemini_text(body: dict) -> Optional[str]:
    for step in body.get("steps", []):
        for part in step.get("content", []):
            if part.get("type") == "text" and part.get("text"):
                return part["text"]
    return None


def _groq_body(model: str, prompt: str) -> dict:
    return {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "related_problems",
                "strict": True,
                "schema": _STRICT_SCHEMA,
            },
        },
    }


def _groq_headers() -> dict:
    return {"content-type": "application/json", "authorization": f"Bearer {GROQ_API_KEY}"}


def _groq_text(body: dict) -> Optional[str]:
    for choice in body.get("choices", []):
        content = (choice.get("message") or {}).get("content")
        if content:
            return content
    return None


class _Provider:
    def __init__(self, name: str, url: str, models: List[str],
                 build_body: Callable[[str, str], dict],
                 build_headers: Callable[[], dict],
                 extract: Callable[[dict], Optional[str]]):
        self.name = name
        self.url = url
        self.models = models
        self.build_body = build_body
        self.build_headers = build_headers
        self.extract = extract


def _active_providers() -> List[_Provider]:
    providers = []
    if GEMINI_API_KEY and MODEL_CHAIN:
        providers.append(_Provider(
            "gemini", GEMINI_API_URL, MODEL_CHAIN,
            _gemini_body, _gemini_headers, _gemini_text,
        ))
    if GROQ_API_KEY and GROQ_MODEL_CHAIN:
        providers.append(_Provider(
            "groq", GROQ_API_URL, GROQ_MODEL_CHAIN,
            _groq_body, _groq_headers, _groq_text,
        ))
    return providers


def _ask_provider(provider: _Provider, prompt: str, deadline: float) -> Tuple[Optional[str], Optional[int]]:
    """Walk one provider's model chain. Returns (json_text, last_status)."""
    last_status: Optional[int] = None
    headers = provider.build_headers()

    for index, model in enumerate(provider.models):
        if time.monotonic() > deadline:
            print(f"[AI] out of time before trying {provider.name}/{model}")
            return None, last_status

        body = provider.build_body(model, prompt)
        response = None

        for attempt in (1, 2):
            remaining = max(1, int(deadline - time.monotonic()))
            try:
                response = requests.post(
                    provider.url, json=body, headers=headers,
                    timeout=min(TIMEOUT_SECONDS, remaining),
                )
            except requests.exceptions.Timeout:
                print(f"[AI] {provider.name}/{model} timed out - moving on")
                response = None
                break
            except requests.exceptions.RequestException as e:
                print(f"[AI] {provider.name}/{model} could not be reached: {e}")
                response = None
                break

            last_status = response.status_code

            if response.status_code == RATE_LIMITED_STATUS:
                print(f"[AI] {provider.name}/{model}: rate limited (429)")
                break

            if response.status_code not in RETRYABLE_STATUSES:
                if response.status_code >= 400:
                    print(f"[AI] {provider.name}/{model} failed "
                          f"{response.status_code}: {response.text[:200]}")
                break

            print(f"[AI] {provider.name}/{model} returned {response.status_code} "
                  f"(attempt {attempt}/2, server busy)")
            if attempt == 1:
                time.sleep(RETRY_DELAY_SECONDS)

        if response is not None and response.status_code < 400:
            try:
                text = provider.extract(response.json())
            except ValueError as e:
                print(f"[AI] {provider.name}/{model} sent something that is not JSON: {e}")
                text = None

            if text:
                if index > 0:
                    print(f"[AI] {provider.name}/{model} answered "
                          f"(model {index + 1} of {len(provider.models)})")
                return text, last_status

            print(f"[AI] {provider.name}/{model} answered with no usable text")

    return None, last_status


def rerank(query_title: str, query_description: Optional[str], candidates: List[dict]) -> Optional[dict]:
    """Return {problem_id: {"relevance", "reason"}}.

    None means the AI was unavailable; {} means it ran and found nothing.
    """
    if not is_enabled() or not candidates:
        return None

    key = _cache_key(query_title, query_description, candidates)
    cached = _CACHE.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        print(f"[AI] cache hit - no API call, {len(cached[1])} related")
        return cached[1]

    prompt = _build_prompt(query_title, query_description, candidates[:MAX_CANDIDATES])

    started = time.monotonic()
    deadline = started + DEADLINE_SECONDS

    text = None
    used = None
    last_status = None

    providers = _active_providers()
    for position, provider in enumerate(providers):
        if position > 0:
            print(f"[AI] {providers[position - 1].name} had nothing left - "
                  f"falling back to {provider.name}")
        text, last_status = _ask_provider(provider, prompt, deadline)
        if text:
            used = provider.name
            break

    elapsed = time.monotonic() - started

    if not text:
        if last_status == RATE_LIMITED_STATUS:
            print(f"[AI] every model is rate limited ({elapsed:.1f}s). On a paid tier this "
                  f"is usually the per-minute limit, or spent credit. Showing TF-IDF results.")
        else:
            print(f"[AI] no provider answered after {elapsed:.1f}s - showing TF-IDF results.")
        return None

    try:
        parsed = json.loads(text)
    except ValueError as e:
        print(f"[AI] {used} returned text that is not valid JSON: {e} | {text[:200]}")
        return None

    valid_ids = {c["id"] for c in candidates}
    ranked = {}
    for m in parsed.get("matches", []) or []:
        if not isinstance(m, dict):
            continue
        pid = m.get("id")
        # Only ids we actually sent - the reply is data, never trusted.
        if pid in valid_ids and m.get("relevance") in {"high", "medium", "low"}:
            ranked[pid] = {
                "relevance": m["relevance"],
                "reason": str(m.get("reason", ""))[:300],
            }

    print(f"[AI] {used}: {len(ranked)} related of {len(candidates)} candidates in {elapsed:.1f}s")
    if not ranked:
        titles = ", ".join(f'#{c["id"]} "{c["title"][:50]}"' for c in candidates[:MAX_CANDIDATES])
        print(f"[AI] nothing matched. query={query_title!r} | candidates were: {titles}")

    # Cache successes only.
    if len(_CACHE) >= CACHE_MAX_ENTRIES:
        oldest = min(_CACHE, key=lambda k: _CACHE[k][0])
        del _CACHE[oldest]
    _CACHE[key] = (time.time(), ranked)

    return ranked


def ask_json(prompt: str, gemini_schema: dict, groq_schema: dict,
             label: str = "ai_task") -> Optional[dict]:
    """Send one prompt through the provider chain and return parsed JSON.

    This is the generic half of rerank(): provider fallback, the model chain,
    retries, timeouts and the overall deadline. A second AI feature reuses it
    instead of growing a second copy that can drift out of sync with this one.

    Returns None whenever no provider produced usable JSON. Every caller must
    have a path that still works in that case - the platform has to run when
    the API does not.
    """
    providers: List[_Provider] = []

    if GEMINI_API_KEY and MODEL_CHAIN:
        providers.append(_Provider(
            "gemini", GEMINI_API_URL, MODEL_CHAIN,
            lambda model, text: {
                "model": model,
                "input": text,
                "response_format": {
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": gemini_schema,
                },
            },
            _gemini_headers, _gemini_text,
        ))

    if GROQ_API_KEY and GROQ_MODEL_CHAIN:
        providers.append(_Provider(
            "groq", GROQ_API_URL, GROQ_MODEL_CHAIN,
            lambda model, text: {
                "model": model,
                "messages": [{"role": "user", "content": text}],
                "temperature": 0,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": label, "strict": True, "schema": groq_schema},
                },
            },
            _groq_headers, _groq_text,
        ))

    if not providers:
        return None

    started = time.monotonic()
    deadline = started + DEADLINE_SECONDS

    text = None
    used = None
    last_status = None

    for position, provider in enumerate(providers):
        if position > 0:
            print(f"[AI:{label}] {providers[position - 1].name} had nothing left - "
                  f"falling back to {provider.name}")
        text, last_status = _ask_provider(provider, prompt, deadline)
        if text:
            used = provider.name
            break

    elapsed = time.monotonic() - started

    if not text:
        if last_status == RATE_LIMITED_STATUS:
            print(f"[AI:{label}] every model is rate limited ({elapsed:.1f}s)")
        else:
            print(f"[AI:{label}] no provider answered after {elapsed:.1f}s")
        return None

    try:
        parsed = json.loads(text)
    except ValueError as e:
        print(f"[AI:{label}] {used} returned text that is not valid JSON: {e} | {text[:200]}")
        return None

    if not isinstance(parsed, dict):
        print(f"[AI:{label}] {used} returned {type(parsed).__name__}, expected an object")
        return None

    print(f"[AI:{label}] {used} answered in {elapsed:.1f}s")
    return parsed
