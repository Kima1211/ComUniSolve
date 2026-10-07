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
    # Ben starts at 40 so these checks never cross a title; titles are tested on their own below.
    ben = make_user(db, "Ben", "ben@test.local")
    ben.points = 40
    db.commit()
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

    print("\nNo repeated notifications")
    p2 = post_problem(as_ana, "Projector in Room 5 shows no signal")
    s2 = post_solution(as_ben, p2)
    post_solution(as_ben, p2)
    lines = [n for n in bell(as_ana)["items"] if n["problem_id"] == p2]
    check("Ben answering twice gives Ana one line", len(lines) == 1, f"-> {len(lines)}")

    for i in range(3):
        r = as_ana.post(f"/comment/{s2}", json={"content": f"Follow-up question number {i + 1}"})
        assert r.status_code == 200, r.text
    lines = [n for n in bell(as_ben)["items"] if n["type"] == "new_comment" and n["solution_id"] == s2]
    check("Ana commenting 3 times gives Ben one line", len(lines) == 1, f"-> {len(lines)}")

    def accepted_lines():
        return [n for n in bell(as_ben)["items"] if n["type"] == "solution_accepted" and n["solution_id"] == s2]

    as_ana.patch(f"/solutions/{s2}/accept")
    as_ana.patch(f"/solutions/{s2}/unaccept")
    check("Un-accepting before Ben reads it removes the 'accepted' line", accepted_lines() == [])
    as_ana.patch(f"/solutions/{s2}/accept")
    check("Accepting again gives exactly one line", len(accepted_lines()) == 1)
    as_ben.post(f"/notifications/{accepted_lines()[0]['id']}/read")
    as_ana.patch(f"/solutions/{s2}/unaccept")
    as_ana.patch(f"/solutions/{s2}/accept")
    lines = accepted_lines()
    check("After Ben read it, toggling accept adds no new line", len(lines) == 1 and lines[0]["read"], f"-> {lines}")

    print("\nClearing")
    r = as_ben.delete("/notifications")
    got = bell(as_ben)
    check("Clear all empties Ben's list", r.status_code == 200 and got["items"] == [] and got["unread"] == 0, f"-> {got}")
    check("...and leaves Ana's alone", len(bell(as_ana)["items"]) > 0)

    print("\nAdmin overview counts what is on the site")
    boss = make_user(db, "Boss", "boss@test.local")
    boss.role = "admin"
    db.commit()
    as_boss = client_for("boss@test.local")
    before = as_boss.get("/admin/overview").json()

    gone = post_problem(as_ana, "Old question I no longer need")
    as_ana.delete(f"/problems/{gone}")
    bad = post_problem(as_ana, "A post the admin will remove")
    as_boss.patch(f"/admin/problems/{bad}/moderate", json={"action": "removed_no_penalty", "reason": "test"})
    keep = post_problem(as_ana, "Printer in the library is jammed")
    as_ana.patch(f"/solutions/{post_solution(as_ben, keep)}/accept")
    orphan_parent = post_problem(as_ana, "Laptop fan is loud")
    post_solution(as_ben, orphan_parent)
    as_ana.delete(f"/problems/{orphan_parent}")
    after = as_boss.get("/admin/overview").json()

    def grew(key):
        return after[key] - before[key]
    check("Only the problem still up adds to 'Problems on the site'", grew("total_problems") == 1, f"-> +{grew('total_problems')}")
    check("Deleted problems are counted separately", grew("deleted_problems") == 2, f"-> +{grew('deleted_problems')}")
    check("Removed problems are counted separately", grew("removed_problems") == 1, f"-> +{grew('removed_problems')}")
    check("Matching health counts the newly solved problem once", grew("solved_problems") == 1, f"-> +{grew('solved_problems')}")
    check("An answer on a deleted problem isn't 'on the site' (only the printer answer is)",
          grew("total_solutions") == 1 and grew("hidden_solutions") == 1,
          f"-> +{grew('total_solutions')} live, +{grew('hidden_solutions')} hidden")

    make_user(db, "Cara", "cara@test.local")
    as_cara = client_for("cara@test.local")
    as_cara.post("/users/me/deactivate", json={"password": "password123"})
    week = as_boss.get("/admin/overview").json()["active_this_week"]
    check("'Used the app this week' counts Ana, Ben and Boss, not the deactivated Cara", week == 3, f"-> {week}")

    rows = as_boss.get("/admin/users", params={"search": "ana@test.local"}).json()["users"]
    live_for_ana = sum(1 for p in TestClient(main.app).get("/problems").json() if p["author"]["name"] == "Ana")
    check("Users tab counts Ana's live problems only", rows and rows[0]["problem_count"] == live_for_ana,
          f"-> {rows[0]['problem_count'] if rows else None} vs {live_for_ana} in the feed")

    print("\nAvatar frames and title notifications")
    make_user(db, "Dina", "dina@test.local")
    as_dina = client_for("dina@test.local")
    me = as_dina.get("/users/me").json()
    check("A Newcomer shows the Usbong frame automatically",
          me["avatar_frame"] == "auto" and me["shown_frame"] == "usbong", f"-> {me['avatar_frame']} / {me['shown_frame']}")
    r = as_dina.patch("/users/me/frame", json={"frame": "capiz"})
    check("A locked frame can't be picked", r.status_code == 400 and r.json()["detail"]["code"] == "frame_locked",
          f"-> {r.status_code} {r.text[:120]}")

    dina_problem = post_problem(as_ana, "Laptop battery drains in an hour")
    dina_answer = post_solution(as_dina, dina_problem)
    as_ana.patch(f"/solutions/{dina_answer}/accept")
    tiers = [n for n in bell(as_dina)["items"] if n["type"].startswith("tier_")]
    check("Reaching Contributor sends one title notification", [n["type"] for n in tiers] == ["tier_contributor"],
          f"-> {[n['type'] for n in tiers]}")
    me = as_dina.get("/users/me").json()
    check("...and the Alon frame now shows automatically", me["shown_frame"] == "alon", f"-> {me['shown_frame']}")

    as_ana.patch(f"/solutions/{dina_answer}/unaccept")
    as_ana.patch(f"/solutions/{dina_answer}/accept")
    tiers = [n for n in bell(as_dina)["items"] if n["type"].startswith("tier_")]
    check("Dropping back and climbing again doesn't repeat it", len(tiers) == 1, f"-> {len(tiers)}")

    r = as_dina.patch("/users/me/frame", json={"frame": "usbong"})
    check("A lower unlocked frame can be picked", r.status_code == 200 and r.json()["shown_frame"] == "usbong", f"-> {r.text[:120]}")
    r = as_dina.patch("/users/me/frame", json={"frame": "none"})
    check("'No frame' hides it", r.status_code == 200 and r.json()["shown_frame"] is None, f"-> {r.text[:120]}")
    as_dina.patch("/users/me/frame", json={"frame": "auto"})
    authors = [p["author"] for p in TestClient(main.app).get("/problems").json() if p["author"]["name"] == "Ana"]
    check("Authors on posts carry their frame", authors and authors[0]["shown_frame"] in ("usbong", "alon", "capiz", "araw"),
          f"-> {authors[:1]}")

    print("\nGuests")
    check("A guest can't read notifications (401)", TestClient(main.app).get("/notifications").status_code == 401)

    db.close()
    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main_test()
