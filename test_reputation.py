import json
import os
import sys

from fastapi.testclient import TestClient

import main
from Models.database import Base, engine, SessionLocal
from Models import user as user_models
from Models.rating import Rating
from Security.utils import hash_password
from Security import rate_limit
from Services import gemini

for _limiter in (rate_limit.LOGIN_PER_IP, rate_limit.LOGIN_FAILURES_PER_EMAIL):
    _limiter.max_events = 10_000

# Never call the real Gemini API: answer every AI request with a fixed reply and count the calls.
GEMINI_CALLS = 0


def fake_ask_gemini(prompt, schema, deadline):
    global GEMINI_CALLS
    GEMINI_CALLS += 1
    fields = schema.get("properties", {})
    if "verdict" in fields:
        return json.dumps({"verdict": "ok", "reason": "", "suggestion": ""}), 200
    if "suggestion" in fields:
        return json.dumps({"suggestion": "Fake AI suggestion."}), 200
    return json.dumps({"matches": []}), 200


gemini._ask_gemini = fake_ask_gemini
gemini.GEMINI_API_KEY = gemini.GEMINI_API_KEY or "test-key"

PASSED = 0
FAILED = 0


def check(label, condition, detail=""):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  PASS  {label}")
    else:
        FAILED += 1
        print(f"  FAIL  {label} {detail}")


def make_user(db, name, email, role="client", points=0):
    u = user_models.User(
        name=name, email=email, password=hash_password("password123"),
        role=role, points=points, is_verified=True, is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def login(client, email):
    r = client.post("/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"


def client_for(email):
    client = TestClient(main.app)
    login(client, email)
    return client


def points(db, u):
    db.expire_all()
    return db.get(user_models.User, u.id).points


def main_test():
    if "modtest" not in (os.getenv("DATABASE_URL") or ""):
        print("Refusing to run: DATABASE_URL must point at a database whose name "
              "contains 'modtest'. This script deletes every table.")
        sys.exit(2)

    # DROPS EVERY TABLE in DATABASE_URL. Never run this against the real database.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    ana = make_user(db, "Ana", "ana@test.local", points=20)
    ben = make_user(db, "Ben", "ben@test.local")
    make_user(db, "Admin", "admin@test.local", role="admin")
    as_ana, as_ben, as_admin = client_for("ana@test.local"), client_for("ben@test.local"), client_for("admin@test.local")

    def step(label, ben_expected, ana_expected):
        got = (points(db, ben), points(db, ana))
        check(f"{label}: Ben {ben_expected}, Ana {ana_expected}", got == (ben_expected, ana_expected), f"-> Ben {got[0]}, Ana {got[1]}")

    print("\nAccepting solutions moves points exactly once")
    r = as_ana.post("/problems", json={
        "title": "Someone texted me that I won a GCash raffle",
        "description": "They asked for my OTP to claim the prize. I never joined any raffle.",
        "category": "Other", "acknowledged": True,
    })
    assert r.status_code == 201, r.text
    problem_id = r.json()["id"]

    r = as_ben.post("/solutions", json={
        "problem_id": problem_id, "acknowledged": True,
        "solution_text": "It is a scam. Never share your OTP and report the number to GCash.",
    })
    assert r.status_code == 201, r.text
    ben_solution = r.json()["id"]
    step("0. Ben posts a solution", 2, 20)

    r = as_ana.patch(f"/solutions/{ben_solution}/accept")
    check("1. accepting Ben's solution works", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    step("1. Ana accepts Ben's solution", 12, 20)

    r = as_ana.patch(f"/solutions/{ben_solution}/accept")
    check("2. repeating the accept is a harmless 200", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    check("2. ...that still reports accepted / resolved",
          r.json() == {"status": "accepted", "problem_status": "resolved"}, f"-> {r.text[:120]}")
    step("2. Ana sends the same accept again", 12, 20)

    r = as_ana.post(f"/solutions/{ben_solution}/rate", json={"score": 5})
    check("Ana rates Ben's accepted solution 5 stars", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    as_ana.patch(f"/solutions/{ben_solution}/accept")
    db.expire_all()
    check("repeating the accept keeps the rating",
          db.query(Rating).filter(Rating.solution_id == ben_solution).count() == 1)

    r = as_ana.post("/solutions", json={
        "problem_id": problem_id, "acknowledged": True,
        "solution_text": "I called GCash myself and they blocked the number.",
    })
    assert r.status_code == 201, r.text
    ana_solution = r.json()["id"]
    r = as_ana.patch(f"/solutions/{ana_solution}/accept")
    check("3. accepting her own solution works", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    step("3. Ana switches to her own solution", 2, 20)

    as_ana.patch(f"/solutions/{ben_solution}/accept")
    step("4. Ana switches back to Ben's solution", 12, 20)

    r = as_ana.patch(f"/solutions/{ben_solution}/unaccept")
    check("5. un-accepting works", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    step("5. Ana un-accepts Ben's solution", 2, 20)

    print("\nA removed solution can't be accepted")
    r = as_admin.patch(f"/admin/solutions/{ben_solution}/moderate", json={"action": "removed", "reason": "test"})
    check("the admin removes Ben's solution", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    r = as_ana.patch(f"/solutions/{ben_solution}/accept")
    check("accepting the removed solution returns 404 not_found",
          r.status_code == 404 and r.json()["detail"]["code"] == "not_found", f"-> {r.status_code} {r.text[:120]}")

    db.close()
    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main_test()
