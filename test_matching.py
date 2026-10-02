"""Matching test: typed titles -> which existing problems come back.

Read-only: it never writes to the database. It uses the problems already there (the demo
data on the local database), finds them by part of their title, and skips any case whose
problems don't exist on the database you point it at.

Two modes, the same as the real app:
  AI mode      Gemini judges which problems are similar (what users normally see).
  Backup mode  Gemini switched off; only keyword similarity (TF-IDF) with its strict cut-off.

Pass rule:
  - every "should find" problem appears in AI mode;
  - no "must not find" problem appears in either mode.
Backup mode can't match across languages, so it only has to avoid wrong results.

Run:  python test_matching.py
"""
import sys

import main  # noqa: F401  (loads every model, like the running app)
from Models.database import SessionLocal
from Models.problem import Problem
from Services import gemini
import routers.matching as matching_router

# (typed title, should find, must NOT find). Problems are named by part of their title.
CASES = [
    ("How to use if-else in C++",
     ["Tutdu-e daw ako if-else", "How do I use if-else"], ["GCash raffle"]),
    ("Bumagal ang laptop ko pagkatapos ng Windows update",
     ["Laptop became very slow"], ["Walang signal sa bahay"]),
    ("Someone hacked my Facebook",
     ["Na-hack ang Facebook"], ["Tutdu-e daw ako if-else"]),
    ("Scam text says I won a GCash prize",
     ["GCash raffle"], ["Tutdu-e daw ako if-else", "bullied in our group chat"]),
    ("Paano mag-apply sa CHED scholarship",
     ["CHED scholarship"], ["bond paper"]),
    ("Sirang electric fan sa classroom",
     ["electric fans"], ["Laptop became very slow"]),
    ("Paano gumawa ng table of contents",
     ["table of contents"], ["bullied in our group chat"]),
    ("Hindi ko makuha ang PIN sa GCash",
     ["makarawat akon pin"], ["Tutdu-e daw ako if-else"]),
]

# The problem page: an existing post (title AND description) is the query, so filler words like
# "daw", "ako", "sa", "ang" are everywhere. This is where unrelated suggestions showed up.
# (existing problem, should find, must NOT find)
PAGE_CASES = [
    ("GCash raffle", [], ["Tutdu-e daw ako if-else", "Form 137", "Walang signal sa bahay", "bond paper"]),
    ("Walang signal sa bahay", [], ["GCash raffle", "Form 137", "bond paper"]),
    ("bond paper", [], ["Form 137", "Walang signal sa bahay", "GCash raffle"]),
    ("Tutdu-e daw ako if-else", ["How do I use if-else"], ["GCash raffle", "Form 137"]),
    ("Na-hack ang Facebook", [], ["Walang signal sa bahay", "bond paper", "Form 137"]),
]

PASSED = FAILED = SKIPPED = 0


def check(label, ok, detail=""):
    global PASSED, FAILED
    if ok:
        PASSED += 1
        print(f"  PASS  {label}")
    else:
        FAILED += 1
        print(f"  FAIL  {label}  {detail}")


def run(title, db, description=None, exclude_id=None):
    # Works with the old (results, ai_used) and the new (results, ai_used, backup) return value.
    out = matching_router._build_matches(title, description, db, exclude_id=exclude_id, use_ai=True)
    return out[0], out[1]


def main_test():
    global SKIPPED
    db = SessionLocal()
    problems = db.query(Problem).filter(Problem.deleted_at.is_(None), Problem.moderation_status != "removed").all()

    def find(part):
        return next((p for p in problems if part.lower() in p.title.lower()), None)

    real_is_enabled = gemini.is_enabled
    for mode in ("AI", "Backup"):
        print(f"\n=== {mode} mode ===")
        if mode == "AI" and not real_is_enabled():
            print("  (Gemini is not configured: AI mode skipped)")
            SKIPPED += len(CASES)
            continue
        gemini.is_enabled = real_is_enabled if mode == "AI" else (lambda: False)
        try:
            page = []
            for source, should, must_not in PAGE_CASES:
                q = find(source)
                if q is not None:
                    page.append((f"[problem page] {q.title[:45]}", should, must_not, q))
            for title, should, must_not, *query in [(t, s, m) for t, s, m in CASES] + page:
                q = query[0] if query else None
                wanted = [find(s) for s in should]
                banned = [find(s) for s in must_not]
                if not all(wanted):
                    print(f"  SKIP  {title!r}: expected problem not on this database")
                    SKIPPED += 1
                    continue
                if q is not None:
                    results, ai_used = run(q.title, db, q.description, exclude_id=q.id)
                else:
                    results, ai_used = run(title, db)
                got = {m.id: m for m in results}
                shown = ", ".join(f'#{m.id} {m.title[:30]!r} {m.relevance or round(m.score, 2)}' for m in results) or "(nothing)"
                print(f"\n  {title!r} -> {shown}")
                if mode == "AI":
                    if not ai_used:
                        print("  SKIP  Gemini did not answer (quota or network): AI result not checked")
                        SKIPPED += 1
                        continue
                    for p in wanted:
                        check(f"finds #{p.id} {p.title[:40]!r}", p.id in got)
                for p in banned:
                    if p is not None:
                        check(f"does not show #{p.id} {p.title[:40]!r}", p.id not in got)
        finally:
            gemini.is_enabled = real_is_enabled

    print(f"\n{PASSED} passed, {FAILED} failed, {SKIPPED} skipped")
    return FAILED == 0


if __name__ == "__main__":
    sys.exit(0 if main_test() else 1)
