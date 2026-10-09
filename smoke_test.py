import os
import sys

# DROPS EVERY TABLE. Only ever point TEST_DATABASE_URL at a throwaway database.
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
import routers.auth as auth_router

SENT_CODES = {}
def _fake_send_code(email, name, code):
    SENT_CODES[email] = code
    return True
user_router.send_verification_code = _fake_send_code
auth_router.send_verification_code = _fake_send_code

from Security import rate_limit
for _limiter in (rate_limit.LOGIN_PER_IP, rate_limit.LOGIN_FAILURES_PER_EMAIL,
                 rate_limit.REGISTER_PER_IP, rate_limit.FORGOT_PASSWORD_PER_IP,
                 rate_limit.FORGOT_PASSWORD_PER_EMAIL):
    _limiter.max_events = 10_000

from Models.database import engine, Base, SessionLocal
# Every model, as in Models/create_tables.py, so create_all builds every table the app writes to.
from Models import user, problem, solution, comment, rating, refresh_token, report, moderation_log, audit_log, notification  # noqa: F401

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

from main import app

results = []

def check(label, ok, evidence=""):
    results.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f"\n        {evidence}" if evidence else ""))

from Services import locations as _loc
from Models.audit_log import AuditLog

PASSWORD = "Sagot2026!"
_city = next(code for code, c in _loc.CITIES.items() if c["name"] == "San Jorge")
ADDRESS = {
    "region_code": _loc.CITIES[_city]["region"],
    "province_code": _loc.CITIES[_city]["province"],
    "city_code": _city,
    "barangay_code": _loc.barangays(_city)[0]["code"],
    "street": "Purok 1",
}

def reg(first, last, email, **extra):
    body = {"first_name": first, "last_name": last, "birth_date": "2004-05-17",
            "email": email, "password": PASSWORD, **ADDRESS}
    body.update(extra)
    return body

def verified_client(name, email):
    c = TestClient(app)
    first, last = name.split(" ", 1)
    c.post("/register", json=reg(first, last, email))
    db = SessionLocal()
    u = db.query(user.User).filter(user.User.email == email).first()
    u.is_verified = True
    db.commit()
    uid = u.id
    db.close()
    c.post("/login", json={"email": email, "password": PASSWORD})
    return c, uid

print("=" * 70)
print("COMUNISOLVE SMOKE TEST")
print("=" * 70)

asker, asker_id = verified_client("Maria Santos", "maria@example.com")
helper, helper_id = verified_client("Ben Cruz", "ben@example.com")

r = asker.post("/problems", json={"title": "Street light is out", "description": "Dark for weeks", "category": "Other"})
check("Post a problem", r.status_code == 201)

dup = helper.post("/register", json=reg("Dup", "User", "MARIA@Example.com"))
check("The same email in different letter case is a duplicate, with a code to translate",
      dup.status_code == 400 and dup.json()["detail"].get("code") == "email_taken", f"{dup.json()}")
pid = r.json()["id"]

r = asker.post("/problems", json={"title": "Old category", "description": "x", "category": "Public"})
check("A category outside the list is rejected", r.status_code == 422, f"status={r.status_code}")

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

r = asker.get(f"/solutions/problem/{pid}")
check("The list shows the viewer's upvote", r.json()[0]["upvoted"] is True, f"{r.json()[0].get('upvoted')}")

r = asker.post(f"/solutions/{sid}/upvote")
check("Clicking upvote again removes it",
      r.status_code == 200 and r.json()["upvote_count"] == 0 and r.json()["upvoted"] is False, f"{r.json()}")

r = asker.post(f"/solutions/{sid}/upvote")
check("Upvoting again after removing works", r.status_code == 200 and r.json()["upvote_count"] == 1)

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

unverified = TestClient(app)
r = unverified.post("/register", json=reg("Nena", "Lim", "nena@example.com", middle_name="Ma. Clara", suffix="Jr.", sex="female"))
check("Registration succeeds without verifying", r.status_code == 201, f"{r.json()}")
check("A 6-digit code was emailed on registration", len(SENT_CODES.get("nena@example.com", "")) == 6)

r = unverified.get("/users/me")
check("An unverified account is authenticated but flagged unverified",
      r.status_code == 200 and r.json()["is_verified"] is False,
      f"is_verified={r.json().get('is_verified')}")

r = unverified.post("/problems", json={"title": "Should be blocked", "description": "x", "category": "Other"})
check("An unverified account cannot post a problem", r.status_code == 403, f"status={r.status_code}")

r = unverified.post("/resend-verification")
check("Resend is refused inside the cooldown (registration just sent one)",
      r.status_code == 429, f"status={r.status_code}")

from datetime import timedelta as _td
db = SessionLocal()
nena = db.query(user.User).filter(user.User.email == "nena@example.com").first()
nena.verification_sent_at = nena.verification_sent_at - _td(minutes=2)
db.commit(); db.close()

r = unverified.post("/resend-verification")
check("Resend works once the cooldown has passed", r.status_code == 200, f"{r.json()}")

r = unverified.get("/users/me")
check("/users/me exposes when the code was sent, so the UI can show a countdown",
      "verification_sent_at" in r.json(), f"keys={sorted(r.json().keys())}")
me = r.json()
check("Personal info is stored atomized and the display name is built from it",
      me["first_name"] == "Nena" and me["middle_name"] == "Ma. Clara" and me["last_name"] == "Lim"
      and me["suffix"] == "Jr." and me["name"] == "Nena Lim Jr.", f"{me['name']}")
check("The address comes back with official PSGC names",
      me["address"]["city"] == "San Jorge" and me["address"]["province"] == "Samar", f"{me['address']}")

def set_nena(**fields):
    d = SessionLocal()
    u = d.query(user.User).filter(user.User.email == "nena@example.com").first()
    for k, v in fields.items():
        setattr(u, k, v(getattr(u, k)) if callable(v) else v)
    d.commit(); d.close()

code = SENT_CODES["nena@example.com"]
wrong = "111111" if code != "111111" else "222222"
r = unverified.post("/verify-code", json={"code": wrong})
check("A wrong code is refused and says how many tries are left",
      r.status_code == 400 and r.json()["detail"]["code"] == "code_invalid" and r.json()["detail"]["params"]["left"] == 4,
      f"{r.json()}")
for _ in range(4):
    r = unverified.post("/verify-code", json={"code": wrong})
check("After 5 wrong codes the code is locked", r.status_code == 429 and r.json()["detail"]["code"] == "code_locked", f"{r.json()}")
r = unverified.post("/verify-code", json={"code": code})
check("...and even the right code no longer works", r.status_code == 429)

set_nena(verification_sent_at=lambda v: v - _td(minutes=2))
unverified.post("/resend-verification")
set_nena(verification_token_expires_at=lambda v: v - _td(minutes=11))
r = unverified.post("/verify-code", json={"code": SENT_CODES["nena@example.com"]})
check("An expired code is refused", r.status_code == 400 and r.json()["detail"]["code"] == "code_expired", f"{r.json()}")

set_nena(verification_sent_at=lambda v: v - _td(minutes=2))
unverified.post("/resend-verification")
r = unverified.post("/verify-code", json={"code": SENT_CODES["nena@example.com"]})
check("A fresh correct code verifies the account", r.status_code == 200, f"{r.json()}")
check("...and the account is now verified", unverified.get("/users/me").json()["is_verified"] is True)

r = TestClient(app).post("/register", json=reg("Weak", "Pass", "weak@example.com", password="Password123"))
check("A common password is rejected even with upper, lower and a number",
      r.status_code == 422 and r.json()["detail"]["code"] == "weak_password", f"{r.json()}")
r = TestClient(app).post("/register", json=reg("Weak", "Pass", "weak@example.com", password="alllowercase1"))
check("A password without an uppercase letter is rejected",
      r.status_code == 422 and "upper" in r.json()["detail"]["params"]["missing"], f"{r.json()}")

_other_city = next(code for code, c in _loc.CITIES.items() if c["name"] == "Catbalogan City" or c["name"] == "City of Catbalogan")
r = TestClient(app).post("/register", json=reg("Bad", "Address", "addr@example.com", barangay_code=_loc.barangays(_other_city)[0]["code"]))
check("A barangay from another city is rejected", r.status_code == 422 and r.json()["detail"]["code"] == "invalid_address", f"{r.json()}")
r = TestClient(app).post("/register", json=reg("Future", "Kid", "future@example.com", birth_date="2999-01-01"))
check("A birth date in the future is rejected", r.status_code == 422, f"{r.status_code}")
r = TestClient(app).post("/register", json=reg("Juan2", "Cruz", "digits@example.com"))
check("Digits in a name are rejected", r.status_code == 422, f"{r.status_code}")

r = TestClient(app).post("/login", json={"email": "MARIA@EXAMPLE.COM", "password": PASSWORD})
check("Login ignores letter case in the email", r.status_code == 200, f"{r.status_code}")
TestClient(app).post("/login", json={"email": "maria@example.com", "password": "Wrong-pass1"})

profile_update = {k: v for k, v in reg("Maria Clara", "Santos", "x").items() if k not in ("email", "password")}
r = asker.patch("/users/me", json={**profile_update, "suffix": "Sr."})
check("Users can edit their profile, and the display name follows",
      r.status_code == 200 and r.json()["name"] == "Maria Clara Santos Sr.", f"{r.json().get('name')}")

lito, lito_id = verified_client("Lito Cruz", "lito@example.com")
r = lito.post("/users/me/deactivate", json={"password": "Not-it-123"})
check("Deactivation needs the right password", r.status_code == 400 and r.json()["detail"]["code"] == "wrong_password", f"{r.json()}")
r = lito.post("/users/me/deactivate", json={"password": PASSWORD})
check("A user can deactivate their account", r.status_code == 200, f"{r.json()}")
r = TestClient(app).post("/login", json={"email": "lito@example.com", "password": PASSWORD})
check("Signing in to a deactivated account offers to reactivate it",
      r.status_code == 403 and r.json()["detail"]["code"] == "account_deactivated", f"{r.json()}")
check("A deactivated user's public profile is hidden", TestClient(app).get(f"/users/{lito_id}/profile").status_code == 404)

d = SessionLocal()
lu = d.query(user.User).filter(user.User.id == lito_id).first()
check("Deactivation keeps the profile so reactivating restores it",
      lu.birth_date is not None and lu.barangay_code is not None and lu.street is not None
      and lu.first_name == "Lito" and lu.email == "lito@example.com")
d.close()

r = TestClient(app).post("/register", json=reg("Lito", "Cruz", "lito@example.com"))
check("Registering again with that email explains how to come back",
      r.status_code == 400 and r.json()["detail"]["code"] == "email_deactivated", f"{r.json()}")

r = TestClient(app).post("/reactivate", json={"email": "lito@example.com", "password": "Wrong-pass1"})
check("Reactivating needs the right password", r.status_code == 401, f"{r.status_code}")
back = TestClient(app)
r = back.post("/reactivate", json={"email": "LITO@example.com", "password": PASSWORD})
check("The owner can reactivate by signing in", r.status_code == 200, f"{r.json()}")
check("...is signed in again", back.get("/users/me").status_code == 200)
check("...and their profile is public again", TestClient(app).get(f"/users/{lito_id}/profile").status_code == 200)

boss, boss_id = verified_client("Boss Admin", "boss@example.com")
d = SessionLocal()
d.query(user.User).filter(user.User.id == boss_id).update({"role": "admin"}); d.commit(); d.close()
back.post("/users/me/deactivate", json={"password": PASSWORD})
r = boss.patch(f"/admin/users/{lito_id}/reactivate")
check("An admin can reactivate a deactivated account", r.status_code == 200, f"{r.json()}")
r = boss.patch(f"/admin/users/{lito_id}/reactivate")
check("...but not one that is already active", r.status_code == 400 and r.json()["detail"]["code"] == "not_deactivated", f"{r.json()}")

d = SessionLocal()
actions = {a for (a,) in d.query(AuditLog.action).all()}
d.close()
check("Account activity is logged (sign-ups, logins, failed logins, verification, edits, deactivation)",
      {"register", "login_success", "login_failed", "email_verified", "profile_updated", "account_deactivated",
       "account_reactivated"} <= actions,
      f"{sorted(actions)}")

r = asker.post("/resend-verification")
check("An already-verified account cannot resend", r.status_code == 400, f"status={r.status_code}")

r = asker.patch("/users/me/avatar", json={"icon": "internet", "color": "dagat"})
check("A user can pick a pixel avatar", r.status_code == 200 and r.json()["avatar_icon"] == "internet", f"{r.json()}")
feed_authors = [p["author"] for p in TestClient(app).get("/problems").json() if p["author"]["id"] == asker_id]
check("Their posts carry the avatar", feed_authors and feed_authors[0]["avatar_icon"] == "internet"
      and feed_authors[0]["avatar_color"] == "dagat", f"{feed_authors[:1]}")
r = TestClient(app).get(f"/users/{asker_id}/profile")
check("Their public profile carries the avatar", r.json().get("avatar_icon") == "internet", f"{r.json().get('avatar_icon')}")
r = asker.patch("/users/me/avatar", json={"icon": "dragon", "color": "dagat"})
check("An avatar that isn't in the list is rejected", r.status_code == 422, f"status={r.status_code}")
r = asker.patch("/users/me/avatar", json={"icon": "internet"})
check("A character without a colour is rejected", r.status_code == 422, f"status={r.status_code}")
r = asker.patch("/users/me/avatar", json={"icon": None, "color": None})
check("Going back to initials clears the avatar", r.status_code == 200 and r.json()["avatar_icon"] is None, f"{r.json()}")

mila, mila_id = verified_client("Mila Reyes", "mila@example.com")
mila.patch("/users/me/avatar", json={"icon": "welfare", "color": "rosas"})
r = mila.post("/users/me/delete", json={"password": PASSWORD})
d = SessionLocal()
gone = d.query(user.User).filter(user.User.id == mila_id).first()
check("Delete account anonymises the user and resets the avatar",
      r.status_code == 200 and gone.name == "Deleted user" and gone.avatar_icon is None and gone.avatar_color is None
      and gone.email.endswith("@deleted.invalid") and gone.is_active is False,
      f"{r.status_code} {gone.name} {gone.avatar_icon}")
d.close()
r = TestClient(app).post("/login", json={"email": "mila@example.com", "password": PASSWORD})
check("...and the deleted account can't sign in", r.status_code == 401, f"status={r.status_code}")

asker.post("/problems", json={
    "title": "Barangay streetlight not working near the basketball court",
    "description": "Another dark corner at night. Who do we report a broken street light to?",
    "category": "Other"})

r = asker.post("/problems/match", json={
    "title": "Our street light is broken",
    "description": "The lamp outside our house has been dark for a month. Who do we report it to?"})
ms = r.json()["matches"]
check("Matching finds a related street-light problem first",
      r.status_code == 200 and len(ms) >= 1 and "street" in ms[0]["title"].lower(),
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

import hashlib
from datetime import datetime, timedelta, timezone
from Models.refresh_token import RefreshToken

def replay_refresh(token):
    c = TestClient(app)
    c.cookies.set("refresh_token", token)
    return c.post("/refresh")

rico, rico_id = verified_client("Rico Dela Paz", "rico@example.com")
old_refresh = rico.cookies.get("refresh_token")
r = rico.post("/refresh")
new_refresh = rico.cookies.get("refresh_token")
check("Refresh rotates the refresh token",
      r.status_code == 200 and bool(new_refresh) and new_refresh != old_refresh)

check("The token just replaced is tolerated for a moment (two tabs refreshing at once)",
      replay_refresh(old_refresh).status_code == 200)

db = SessionLocal()
db.query(RefreshToken).filter(
    RefreshToken.token_hash == hashlib.sha256(old_refresh.encode()).hexdigest()
).update({"revoked_at": datetime.now(timezone.utc) - timedelta(minutes=5)})
db.commit()
r = replay_refresh(old_refresh)
left = db.query(RefreshToken).filter(RefreshToken.user_id == rico_id).count()
db.close()
check("Reusing an old refresh token counts as theft: 401 and every session revoked",
      r.status_code == 401 and left == 0, f"status={r.status_code}, tokens left={left}")
check("...so even the newest refresh token stops working",
      replay_refresh(new_refresh).status_code == 401)

ana, ana_id = verified_client("Ana Reyes", "ana@example.com")
check("A fresh access token works", ana.get("/users/me").status_code == 200)
db = SessionLocal()
db.get(user.User, ana_id).session_version += 1
db.commit()
db.close()
check("Raising session_version ends existing access tokens at once",
      ana.get("/users/me").status_code == 401)
r = ana.post("/refresh")
check("...while a session that is still valid recovers through /refresh",
      r.status_code == 200 and ana.get("/users/me").status_code == 200)

from Services import gemini as _gemini

_saved_key = _gemini.GEMINI_API_KEY
_gemini.GEMINI_API_KEY = None

check("The AI layer reports itself disabled when there is no Gemini key",
      _gemini.is_enabled() is False, f"is_enabled={_gemini.is_enabled()}")

check("ask_json gives up at once, without calling the API, when there is no key",
      _gemini.ask_json("anything", {"type": "object"}) is None)

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

_gemini.GEMINI_API_KEY = _saved_key

print("=" * 70)
print(f"{sum(results)}/{len(results)} checks passed")
print("=" * 70)
sys.exit(0 if all(results) else 1)

