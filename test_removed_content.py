import os
import sys

from fastapi.testclient import TestClient

import test_reputation as t
from Models.database import Base, engine, SessionLocal


def is_not_found(r):
    return r.status_code == 404 and (r.json().get("detail") or {}).get("code") == "not_found"


def main_test():
    if "modtest" not in (os.getenv("DATABASE_URL") or ""):
        print("Refusing to run: DATABASE_URL must point at a database whose name "
              "contains 'modtest'. This script deletes every table.")
        sys.exit(2)

    # DROPS EVERY TABLE in DATABASE_URL. Never run this against the real database.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    for name, email, role in (("Ana", "ana@test.local", "client"), ("Ben", "ben@test.local", "client"),
                              ("Cara", "cara@test.local", "client"), ("Admin", "admin@test.local", "admin")):
        t.make_user(db, name, email, role=role)
    as_ana, as_ben = t.client_for("ana@test.local"), t.client_for("ben@test.local")
    as_cara, as_admin = t.client_for("cara@test.local"), t.client_for("admin@test.local")
    guest = TestClient(t.main.app)

    def post_problem(title):
        r = as_ana.post("/problems", json={"title": title, "description": "Details about " + title.lower() + ".",
                                           "category": "Other", "acknowledged": True})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    removed_problem = post_problem("The school WiFi password stopped working")
    answered_problem = post_problem("My laptop is very slow after the Windows update")
    deleted_problem = post_problem("The printer in the library shows an error")

    r = as_ben.post("/solutions", json={"problem_id": answered_problem, "acknowledged": True,
                                        "solution_text": "Turn off startup apps in Task Manager, then restart."})
    assert r.status_code == 201, r.text
    removed_solution = r.json()["id"]
    assert as_ana.patch(f"/solutions/{removed_solution}/accept").status_code == 200

    r = as_admin.patch(f"/admin/problems/{removed_problem}/moderate", json={"action": "removed", "reason": "test"})
    assert r.status_code == 200, r.text
    r = as_admin.patch(f"/admin/solutions/{removed_solution}/moderate", json={"action": "removed", "reason": "test"})
    assert r.status_code == 200, r.text
    assert as_ana.delete(f"/problems/{deleted_problem}").status_code == 200

    print("\nActions on content an admin removed return 404 not_found")
    r = as_ben.post("/solutions", json={"problem_id": removed_problem, "acknowledged": True,
                                        "solution_text": "Ask the IT office to reset it."})
    t.check("POST /solutions to a removed problem", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")

    r = as_cara.post(f"/solutions/{removed_solution}/upvote")
    t.check("POST /solutions/{id}/upvote on a removed solution", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")

    r = as_ana.post(f"/solutions/{removed_solution}/rate", json={"score": 5})
    t.check("POST /solutions/{id}/rate on a removed solution", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")

    r = as_cara.post(f"/comment/{removed_solution}", json={"content": "Did this work for you?"})
    t.check("POST /comment/{solution_id} on a removed solution", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")

    for who, client in (("a guest", guest), ("a signed-in user", as_cara)):
        for path in ("similar", "similar/ai"):
            r = client.get(f"/problems/{removed_problem}/{path}")
            t.check(f"GET /problems/{{id}}/{path} of a removed problem ({who})", is_not_found(r),
                    f"-> {r.status_code} {r.text[:120]}")
            r = client.get(f"/problems/{deleted_problem}/{path}")
            t.check(f"GET /problems/{{id}}/{path} of a deleted problem ({who})", is_not_found(r),
                    f"-> {r.status_code} {r.text[:120]}")

    print("\nActions on solutions whose problem is removed or deleted return 404 not_found")

    def post_solution(client, problem_id, text):
        r = client.post("/solutions", json={"problem_id": problem_id, "solution_text": text, "acknowledged": True})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    for state in ("removed", "deleted"):
        gone_problem = post_problem(f"The canteen card reader is broken ({state})")
        accepted = post_solution(as_ben, gone_problem, "Ask the canteen staff to reset the reader.")
        other = post_solution(as_cara, gone_problem, "Use cash until it is fixed.")
        assert as_ana.patch(f"/solutions/{accepted}/accept").status_code == 200
        if state == "removed":
            r = as_admin.patch(f"/admin/problems/{gone_problem}/moderate", json={"action": "removed", "reason": "test"})
        else:
            r = as_ana.delete(f"/problems/{gone_problem}")
        assert r.status_code == 200, r.text

        r = as_cara.post(f"/solutions/{accepted}/upvote")
        t.check(f"upvote a solution of a {state} problem", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")
        r = as_ana.post(f"/solutions/{accepted}/rate", json={"score": 5})
        t.check(f"rate a solution of a {state} problem", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")
        r = as_cara.post(f"/comment/{accepted}", json={"content": "Did this work?"})
        t.check(f"comment on a solution of a {state} problem", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")
        r = as_ana.patch(f"/solutions/{other}/accept")
        t.check(f"accept a solution of a {state} problem", is_not_found(r), f"-> {r.status_code} {r.text[:120]}")

    print("\nVisible content still works")
    r = guest.get(f"/problems/{answered_problem}/similar")
    t.check("GET /similar of a visible problem still answers 200", r.status_code == 200, f"-> {r.status_code}")

    db.close()
    print(f"\n{t.PASSED} passed, {t.FAILED} failed")
    sys.exit(1 if t.FAILED else 0)


if __name__ == "__main__":
    main_test()
