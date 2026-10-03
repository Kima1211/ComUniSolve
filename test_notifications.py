import json
import os
import sys

from fastapi.testclient import TestClient

import main
from Models.database import Base, engine, SessionLocal
from Models import user as user_models
from Security.utils import hash_password
from Security import rate_limit
from Services import gemini

for _limiter in (rate_limit.LOGIN_PER_IP, rate_limit.LOGIN_FAILURES_PER_EMAIL):
    _limiter.max_events = 10_000


# Never call the real Gemini API: every moderation check says "ok".
def fake_ask_gemini(prompt, schema, deadline):
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


def make_user(db, name, email):
    u = user_models.User(
        name=name, email=email, password=hash_password("password123"),
        role="client", points=0, is_verified=True, is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def client_for(email):
    client = TestClient(main.app)
    r = client.post("/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return client


def bell(client):
    r = client.get("/notifications")
    assert r.status_code == 200, r.text
    return r.json()


def post_problem(client, title):
    r = client.post("/problems", json={
        "title": title,
        "description": "The Wi-Fi in our classroom drops every few minutes during online quizzes.",
        "category": "Other", "acknowledged": True,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def post_solution(client, problem_id):
    r = client.post("/solutions", json={
        "problem_id": problem_id, "acknowledged": True,
        "solution_text": "Restart the router and move it away from the metal cabinet.",
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def main_test():
    if "modtest" not in (os.getenv("DATABASE_URL") or ""):
        print("Refusing to run: DATABASE_URL must point at a database whose name "
              "contains 'modtest'. This script deletes every table.")
        sys.exit(2)

    # DROPS EVERY TABLE in DATABASE_URL. Never run this against the real database.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    make_user(db, "Ana", "ana@test.local")
    make_user(db, "Ben", "ben@test.local")
    as_ana, as_ben = client_for("ana@test.local"), client_for("ben@test.local")

    print("\nThe three events reach the right person")
    problem_id = post_problem(as_ana, "Classroom Wi-Fi keeps dropping")
    ben_solution = post_solution(as_ben, problem_id)
    got = bell(as_ana)
    first = got["items"][0] if got["items"] else {}
    check("Ben answers Ana's problem: Ana has 1 unread", got["unread"] == 1, f"-> {got}")
    check("...of type new_solution, from Ben, with the problem title",
          first.get("type") == "new_solution" and first.get("actor_name") == "Ben"
          and first.get("problem_title") == "Classroom Wi-Fi keeps dropping", f"-> {first}")
    check("Ben gets nothing for his own answer", bell(as_ben)["unread"] == 0)

    r = as_ana.post(f"/comment/{ben_solution}", json={"content": "Thanks, which cabinet do you mean?"})
    assert r.status_code == 200, r.text
    got = bell(as_ben)
    check("Ana comments on Ben's solution: Ben gets new_comment",
          got["unread"] == 1 and got["items"][0]["type"] == "new_comment", f"-> {got}")

    as_ben.post(f"/comment/{ben_solution}", json={"content": "The grey one near the door."})
    check("Ben commenting on his own solution notifies nobody new", bell(as_ben)["unread"] == 1)

    as_ana.patch(f"/solutions/{ben_solution}/accept")
    got = bell(as_ben)
    check("Ana accepts Ben's solution: Ben gets solution_accepted",
          got["unread"] == 2 and got["items"][0]["type"] == "solution_accepted", f"-> {got}")
    as_ana.patch(f"/solutions/{ben_solution}/accept")
    check("A repeated accept sends no second notification", bell(as_ben)["unread"] == 2)

    print("\nSelf-actions are never notified")
    own_problem = post_problem(as_ana, "My laptop charger sparks")
    own_solution = post_solution(as_ana, own_problem)
    as_ana.patch(f"/solutions/{own_solution}/accept")
    check("Answering and accepting on your own problem notifies nobody", bell(as_ana)["unread"] == 1)

    print("\nReading")
    note_id = bell(as_ben)["items"][0]["id"]
    r = as_ana.post(f"/notifications/{note_id}/read")
    check("Ana can't mark Ben's notification as read (404)", r.status_code == 404, f"-> {r.status_code}")
    r = as_ben.post(f"/notifications/{note_id}/read")
    check("Ben marks one as read: 1 unread left", r.status_code == 200 and r.json()["unread"] == 1, f"-> {r.text}")
    check("...and the list shows it as read", bell(as_ben)["items"][0]["read"] is True)
    r = as_ben.post("/notifications/read-all")
    check("Mark all as read: 0 unread", r.status_code == 200 and bell(as_ben)["unread"] == 0, f"-> {r.text}")

    print("\nHidden when the problem is gone")
    r = as_ana.delete(f"/problems/{problem_id}")
    assert r.status_code == 200, r.text
    check("Ana deletes the problem: Ben's notifications about it disappear", bell(as_ben)["items"] == [],
          f"-> {bell(as_ben)}")

    print("\nGuests")
    check("A guest can't read notifications (401)", TestClient(main.app).get("/notifications").status_code == 401)

    db.close()
    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main_test()
