import os
import sys
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import main
from Models.database import Base, engine, SessionLocal
from Models import user as user_models, problem as problem_models, solution as solution_models  # noqa: F401
from Models import comment, rating, refresh_token, report, moderation_log  # noqa: F401
from Models.moderation_log import ModerationLog
from Security.utils import hash_password
from Services import moderation as moderation_service
from Services.reputation import REMOVAL_PENALTY_POINTS, REMOVALS_BEFORE_SUSPENSION
from Security import rate_limit

for _limiter in (rate_limit.LOGIN_PER_IP, rate_limit.LOGIN_FAILURES_PER_EMAIL):
    _limiter.max_events = 10_000

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


def main_test():
    if "modtest" not in (os.getenv("DATABASE_URL") or ""):
        print("Refusing to run: DATABASE_URL must point at a database whose name "
              "contains 'modtest'. This script deletes every table.")
        sys.exit(2)

    # DROPS EVERY TABLE in DATABASE_URL. Never run this against the real database.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    admin = make_user(db, "Admin", "admin@test.local", role="admin")
    poster = make_user(db, "Poster", "poster@test.local", points=100)
    reporter = make_user(db, "Reporter", "reporter@test.local", points=20)

    client = TestClient(main.app)

    print("\nLayer 2 - keyword filter")
    login(client, "poster@test.local")

    r = client.post("/problems", json={
        "title": "Broken streetlight on Rizal St",
        "description": "It has been dark for three weeks and it is unsafe at night.",
        "category": "Public",
    })
    check("clean post is created", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")
    clean_problem_id = r.json().get("id") if r.status_code == 201 else None

    r = client.post("/problems", json={
        "title": "putangina this barangay",
        "description": "nothing works here",
        "category": "Public",
    })
    check("blocked keyword is refused", r.status_code == 422, f"-> {r.status_code}")
    if r.status_code == 422:
        d = r.json()["detail"]
        check("refusal names the term", "putangina" in (d.get("matched_terms") or []), d)
        check("keyword block is NOT acknowledgeable", d.get("acknowledgeable") is False, d)

    r = client.post("/problems", json={
        "title": "putangina this barangay",
        "description": "nothing works here",
        "category": "Public",
        "acknowledged": True,
    })
    check("acknowledged=True cannot bypass a keyword block", r.status_code == 422,
          f"-> {r.status_code}")

    r = client.post("/problems", json={
        "title": "tanga ang sistema sa kalsada namin",
        "description": "The road repair schedule keeps changing without notice.",
        "category": "Public",
    })
    check("flag-tier word publishes", r.status_code == 201, f"-> {r.status_code}")
    flagged_id = r.json().get("id") if r.status_code == 201 else None
    if flagged_id:
        db.expire_all()
        p = db.get(problem_models.Problem, flagged_id)
        check("flag-tier word marks it flagged", p.moderation_status == "flagged",
              p.moderation_status)

    print("\nLayer 1 - AI pre-post check (AI stubbed, no API calls)")
    real_check = moderation_service.check_content

    moderation_service.check_content = lambda t, x: {
        "verdict": "unclear", "reason": "Too vague.", "suggestion": "Say which street."}
    r = client.post("/problems", json={
        "title": "help", "description": "problem po", "category": "Public"})
    check("unclear is refused on the first attempt", r.status_code == 422, f"-> {r.status_code}")
    if r.status_code == 422:
        d = r.json()["detail"]
        check("unclear IS acknowledgeable", d.get("acknowledgeable") is True, d)
        check("a suggested rewrite is returned", bool(d.get("suggestion")), d)

    r = client.post("/problems", json={
        "title": "help", "description": "problem po", "category": "Public",
        "acknowledged": True})
    check("unclear publishes on the second attempt", r.status_code == 201, f"-> {r.status_code}")
    second_try_id = r.json().get("id") if r.status_code == 201 else None
    if second_try_id:
        db.expire_all()
        p = db.get(problem_models.Problem, second_try_id)
        check("second attempt is flagged for review", p.moderation_status == "flagged",
              p.moderation_status)
        check("ai_status records the verdict", p.ai_status == "unclear", p.ai_status)

    moderation_service.check_content = lambda t, x: {
        "verdict": "inappropriate", "reason": "Harassment.", "suggestion": None}
    r = client.post("/problems", json={
        "title": "about my neighbour", "description": "...", "category": "Public",
        "acknowledged": True})
    check("inappropriate cannot be acknowledged past", r.status_code == 422, f"-> {r.status_code}")

    moderation_service.check_content = lambda t, x: None
    r = client.post("/problems", json={
        "title": "Clogged canal near the school",
        "description": "Water rises fast when it rains.", "category": "Public"})
    check("AI outage does not block posting", r.status_code == 201, f"-> {r.status_code}")
    if r.status_code == 201:
        db.expire_all()
        p = db.get(problem_models.Problem, r.json()["id"])
        check("AI outage records ai_status=unchecked", p.ai_status == "unchecked", p.ai_status)

    moderation_service.check_content = real_check

    print("\nLayer 3 - community reporting")
    login(client, "reporter@test.local")

    r = client.post("/reports", json={"problem_id": clean_problem_id, "reason": "spam"})
    check("a report is accepted", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")

    r = client.post("/reports", json={"problem_id": clean_problem_id, "reason": "misleading"})
    check("the same user cannot report it twice", r.status_code == 409, f"-> {r.status_code}")

    r = client.post("/reports", json={"problem_id": clean_problem_id,
                                      "solution_id": 1, "reason": "spam"})
    check("a report with two targets is rejected", r.status_code == 422, f"-> {r.status_code}")

    r = client.post("/reports", json={"reason": "spam"})
    check("a report with no target is rejected", r.status_code == 422, f"-> {r.status_code}")

    print("\nLayer 5 - admin review")
    login(client, "poster@test.local")
    r = client.get("/admin/queue")
    check("a non-admin cannot open the queue", r.status_code == 403, f"-> {r.status_code}")

    login(client, "admin@test.local")
    r = client.get("/admin/queue")
    check("admin can open the queue", r.status_code == 200, f"-> {r.status_code}")
    queue = r.json() if r.status_code == 200 else []
    check("reported content is in the queue",
          any(i["id"] == clean_problem_id and i["target_type"] == "problem" for i in queue),
          [i["id"] for i in queue])
    check("flagged content is in the queue too",
          any(i["id"] == flagged_id for i in queue), [i["id"] for i in queue])
    check("the most-reported item sorts first",
          queue and queue[0]["report_count"] >= queue[-1]["report_count"])

    print("\nLayer 4 - reputation penalties")
    db.expire_all()
    points_before = db.get(user_models.User, poster.id).points

    r = client.patch(f"/admin/problems/{clean_problem_id}/moderate",
                     json={"action": "removed", "reason": "spam"})
    check("admin can remove content", r.status_code == 200, f"-> {r.status_code} {r.text[:150]}")

    db.expire_all()
    after = db.get(user_models.User, poster.id)
    check(f"removal costs {REMOVAL_PENALTY_POINTS} points",
          after.points == points_before + REMOVAL_PENALTY_POINTS,
          f"{points_before} -> {after.points}")

    removed = db.get(problem_models.Problem, clean_problem_id)
    check("removal is a soft delete, the row survives", removed is not None)
    check("removed content is marked, not deleted", removed.moderation_status == "removed",
          removed.moderation_status)

    log = (db.query(ModerationLog)
           .filter(ModerationLog.problem_id == clean_problem_id,
                   ModerationLog.action == "removed").first())
    check("a moderation log row was written", log is not None)
    check("the log keeps a snapshot of what was removed", bool(log and log.content_snapshot))

    r = client.get(f"/problems/{clean_problem_id}")
    check("removed content disappears from the public API", r.status_code == 404,
          f"-> {r.status_code}")

    r = client.patch(f"/admin/problems/{clean_problem_id}/moderate",
                     json={"action": "restored", "reason": "mistake"})
    db.expire_all()
    check("restoring refunds the points",
          db.get(user_models.User, poster.id).points == points_before,
          db.get(user_models.User, poster.id).points)

    print("\nLayer 4 - suspension ladder")
    login(client, "poster@test.local")
    ids = []
    for n in range(REMOVALS_BEFORE_SUSPENSION):
        rr = client.post("/problems", json={
            "title": f"Test problem {n}", "description": "A description.",
            "category": "Public"})
        ids.append(rr.json()["id"])

    login(client, "admin@test.local")
    for pid in ids:
        client.patch(f"/admin/problems/{pid}/moderate", json={"action": "removed"})

    db.expire_all()
    suspended = db.get(user_models.User, poster.id)
    check(f"{REMOVALS_BEFORE_SUSPENSION} removals suspends the account",
          suspended.is_suspended is True, suspended.is_suspended)
    check("the first suspension is 1 day",
          suspended.suspended_until is not None
          and 0 < (suspended.suspended_until - datetime.now(timezone.utc)).total_seconds() <= 86400 + 60,
          suspended.suspended_until)

    login(client, "poster@test.local")
    r = client.post("/problems", json={
        "title": "Another problem", "description": "Still here.", "category": "Public"})
    check("a suspended user cannot post", r.status_code == 403, f"-> {r.status_code}")

    r = client.get("/problems")
    check("a suspended user can still read", r.status_code == 200, f"-> {r.status_code}")

    suspended.suspended_until = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    r = client.post("/problems", json={
        "title": "Back again", "description": "The suspension has expired.",
        "category": "Public"})
    check("an expired suspension lifts itself with no job running",
          r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")

    db.close()

    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main_test()

