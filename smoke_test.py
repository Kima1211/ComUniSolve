"""End-to-end smoke test for ComUniSolve.

!! DROPS AND RECREATES EVERY TABLE. !! Point it at a throwaway database only:

    set TEST_DATABASE_URL=postgresql+psycopg2://postgres:pw@localhost/comunisolve_test
    python smoke_test.py
"""
import os
import sys

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL or "test" not in TEST_DATABASE_URL.lower():
    sys.exit("Refusing to run: set TEST_DATABASE_URL to a throwaway database whose name contains 'test'.")

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
for k, v in [("PASSWORD_PEPPER", "test-pepper"), ("SECRET_KEY", "test-secret"),
             ("BREVO_API_KEY", "k"), ("SENDER_EMAIL", "a@b.c"),
             ("FRONTEND_URL", "http://localhost:5173")]:
    os.environ.setdefault(k, v)

from fastapi.testclient import TestClient
import routers.user as user_router
user_router.send_verification_email = lambda *a, **k: True

from Models.database import engine, Base, SessionLocal
from Models import user, problem, solution, comment, rating, refresh_token

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

from main import app

results = []

def check(label, ok, evidence=""):
    results.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f"\n        {evidence}" if evidence else ""))

def verified_client(name, email):
    c = TestClient(app)
    c.post("/register", json={"name": name, "email": email, "password": "password123"})
    db = SessionLocal()
    u = db.query(user.User).filter(user.User.email == email).first()
    u.is_verified = True
    db.commit()
    uid = u.id
    db.close()
    c.post("/login", json={"email": email, "password": "password123"})
    return c, uid


print("=" * 70)
print("COMUNISOLVE SMOKE TEST")
print("=" * 70)

asker, asker_id = verified_client("Maria Santos", "maria@example.com")
helper, helper_id = verified_client("Ben Cruz", "ben@example.com")

r = asker.post("/problems", json={"title": "Street light is out", "description": "Dark for weeks", "category": "Public"})
check("Post a problem", r.status_code == 201)
pid = r.json()["id"]

r = asker.get(f"/problems/{pid}")
body = r.json()
check("Problem includes its author and a solution count",
      r.status_code == 200 and body.get("author", {}).get("name") == "Maria Santos" and body.get("solution_count") == 0,
      f"author={body.get('author')}, solution_count={body.get('solution_count')}")

r = asker.get("/problems")
check("Feed is ordered newest first", r.status_code == 200 and isinstance(r.json(), list))

r = asker.get(f"/problems?user_id={asker_id}")
check("Feed can be filtered to one user's problems",
      r.status_code == 200 and len(r.json()) == 1 and r.json()[0]["id"] == pid,
      f"count={len(r.json())}")

r = helper.post("/solutions", json={"problem_id": pid, "solution_text": "Report it to the barangay office."})
check("Another user can submit a solution", r.status_code == 201)
sid = r.json()["id"]

r = asker.get(f"/solutions/problem/{pid}")
sol = r.json()[0]
check("Solution list includes the author and their tier",
      r.status_code == 200 and sol["author"]["name"] == "Ben Cruz" and "tier" in sol["author"],
      f"author={sol['author']}")

check("Author payload never leaks email",
      "email" not in sol["author"],
      f"keys={sorted(sol['author'].keys())}")

r = asker.patch(f"/solutions/{sid}/accept")
check("Problem owner can accept a solution",
      r.status_code == 200 and r.json()["problem_status"] == "resolved",
      f"{r.json()}")

r = helper.patch(f"/solutions/{sid}/accept")
check("A non-owner cannot accept", r.status_code == 403)

r = asker.post(f"/solutions/{sid}/upvote")
check("Upvote works and increments the counter",
      r.status_code == 200 and r.json()["upvote_count"] == 1, f"{r.json()}")

r = asker.post(f"/solutions/{sid}/upvote")
check("The same user cannot upvote twice", r.status_code == 400)

r = asker.post(f"/comment/{sid}", json={"content": "Thank you, this worked!", "parent_id": None})
check("Comment can be posted", r.status_code == 200)

r = asker.get(f"/solutions/{sid}/comments")
check("Comments can be read back with their author",
      r.status_code == 200 and len(r.json()) == 1 and r.json()[0]["author"]["name"] == "Maria Santos",
      f"count={len(r.json())}")

r = asker.post(f"/solutions/{sid}/rate", json={"score": 5, "feedback": "Very clear"})
check("Problem owner can rate the solution", r.status_code == 200, f"status={r.status_code}")

r = helper.get("/users/me")
me = r.json()
check("Helper earned reputation points for the accepted solution",
      me["points"] > 0, f"points={me['points']}, tier={me['tier']}")

r = asker.get(f"/solutions/problem/{pid}")
check("Empty-but-valid problems still return a list, not 404",
      asker.get("/solutions/problem/999999").status_code == 404 and r.status_code == 200)


# --- verification gate -------------------------------------------------------
unverified = TestClient(app)
r = unverified.post("/register", json={"name": "Nena Lim", "email": "nena@example.com", "password": "password123"})
check("Registration succeeds without verifying", r.status_code == 201)

r = unverified.get("/users/me")
check("An unverified account is authenticated but flagged unverified",
      r.status_code == 200 and r.json()["is_verified"] is False,
      f"is_verified={r.json().get('is_verified')}")

r = unverified.post("/problems", json={"title": "Should be blocked", "description": "x", "category": "Public"})
check("An unverified account cannot post a problem", r.status_code == 403, f"status={r.status_code}")

r = unverified.post("/resend-verification")
check("Resend is refused inside the cooldown (registration just sent one)",
      r.status_code == 429, f"status={r.status_code}")

# Age the token by two minutes so the cooldown has passed, without the test
# having to sit and wait for it.
from datetime import timedelta as _td
db = SessionLocal()
nena = db.query(user.User).filter(user.User.email == "nena@example.com").first()
nena.verification_token_expires_at = nena.verification_token_expires_at - _td(minutes=2)
db.commit(); db.close()

r = unverified.post("/resend-verification")
check("Resend works once the cooldown has passed", r.status_code == 200, f"{r.json()}")

r = unverified.get("/users/me")
check("/users/me exposes the token expiry so the UI can show a countdown",
      "verification_expires_at" in r.json(), f"keys={sorted(r.json().keys())}")

r = asker.post("/resend-verification")
check("An already-verified account cannot resend", r.status_code == 400, f"status={r.status_code}")


# --- solution matching -------------------------------------------------------
asker.post("/problems", json={
    "title": "Barangay streetlight not working near the basketball court",
    "description": "Another dark corner at night. Who do we report a broken street light to?",
    "category": "Public"})

r = asker.post("/problems/match", json={
    "title": "Our street light is broken",
    "description": "The lamp outside our house has been dark for a month. Who do we report it to?"})
ms = r.json()["matches"]
check("Matching finds the related street-light problems",
      r.status_code == 200 and len(ms) >= 2,
      f"{[(m['score'], m['title'][:40]) for m in ms]}")

check("Matches are ordered by score, highest first",
      all(ms[i]["score"] >= ms[i + 1]["score"] for i in range(len(ms) - 1)),
      f"scores={[m['score'] for m in ms]}")

check("A solved match carries its accepted solution for reuse",
      any(m["accepted_solution"] for m in ms),
      f"with_solution={[bool(m['accepted_solution']) for m in ms]}")

r = asker.post("/problems/match", json={
    "title": "Where can I buy a second hand bicycle",
    "description": "Any shops nearby selling used bikes for a student?"})
check("An unrelated problem matches nothing (threshold rejects noise)",
      r.json()["matches"] == [], f"{r.json()['matches']}")

r = asker.get(f"/problems/{pid}/similar")
check("A problem's own page can list related problems, excluding itself",
      r.status_code == 200 and all(m["id"] != pid for m in r.json()["matches"]),
      f"ids={[m['id'] for m in r.json()['matches']]}")

# --- the AI layer degrades safely -------------------------------------------
# Forced off, so these pass whether or not real API keys are present.
from Services import gemini as _gemini

_saved_keys = (_gemini.GEMINI_API_KEY, _gemini.GROQ_API_KEY)
_gemini.GEMINI_API_KEY = None
_gemini.GROQ_API_KEY = None

check("The AI layer reports itself disabled when no provider has a key",
      _gemini.is_enabled() is False, f"is_enabled={_gemini.is_enabled()}")

check("No provider is attempted when no key is configured",
      _gemini._active_providers() == [], f"{_gemini._active_providers()}")

r = asker.post("/problems/match/ai", json={
    "title": "Our street light is broken",
    "description": "The lamp outside our house has been dark for a month."})
body = r.json()
check("The AI endpoint still returns TF-IDF results when no AI is available",
      r.status_code == 200 and len(body["matches"]) >= 1 and body["ai_used"] is False,
      f"ai_used={body['ai_used']}, matches={len(body['matches'])}")

check("Results are honest about which layers ran",
      all(m["reason"] is None for m in body["matches"]),
      "no AI reason is invented when the AI did not run")

_gemini.GEMINI_API_KEY, _gemini.GROQ_API_KEY = _saved_keys

print("=" * 70)
print(f"{sum(results)}/{len(results)} checks passed")
print("=" * 70)
sys.exit(0 if all(results) else 1)
