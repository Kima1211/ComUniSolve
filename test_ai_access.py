import os
import sys

from fastapi.testclient import TestClient

import test_reputation as t
from Models.database import Base, engine, SessionLocal
from Models.problem import Problem


def gemini_calls_during(action):
    before = t.GEMINI_CALLS
    result = action()
    return result, t.GEMINI_CALLS - before


def main_test():
    if "modtest" not in (os.getenv("DATABASE_URL") or ""):
        print("Refusing to run: DATABASE_URL must point at a database whose name "
              "contains 'modtest'. This script deletes every table.")
        sys.exit(2)

    # DROPS EVERY TABLE in DATABASE_URL. Never run this against the real database.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    t.make_user(db, "Ana", "ana@test.local")
    as_ana = t.client_for("ana@test.local")
    guest = TestClient(t.main.app)

    def post_problem(title, description):
        r = as_ana.post("/problems", json={"title": title, "description": description,
                                           "category": "Other", "acknowledged": True})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    first = post_problem("My laptop is very slow after the Windows update",
                         "It takes five minutes to start and the fan is always loud.")
    second = post_problem("Laptop became slow after updating Windows",
                          "Everything lags since the last update, even the browser.")

    print("\nGuests get the keyword results, never Gemini")
    r = guest.post("/problems/match/ai", json={"title": "Laptop slow after update", "description": ""})
    t.check("a guest calling POST /problems/match/ai gets 401", r.status_code == 401, f"-> {r.status_code}")

    r, calls = gemini_calls_during(lambda: guest.get(f"/problems/{first}/similar/ai"))
    t.check("a guest calling /similar/ai gets 200", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    t.check("...with ai_used False and backup False",
            r.json().get("ai_used") is False and r.json().get("backup") is False, f"-> {r.text[:160]}")
    t.check("...and Gemini was called 0 times", calls == 0, f"-> {calls} calls")

    r, calls = gemini_calls_during(lambda: guest.get(f"/problems/{first}/ai-suggestion"))
    t.check("a guest asking for a new AI suggestion gets 'unavailable'",
            r.status_code == 200 and r.json().get("status") == "unavailable", f"-> {r.status_code} {r.text[:120]}")
    t.check("...and Gemini was called 0 times", calls == 0, f"-> {calls} calls")

    db.query(Problem).filter(Problem.id == second).update({"ai_suggestion": "Stored suggestion text."})
    db.commit()
    r, calls = gemini_calls_during(lambda: guest.get(f"/problems/{second}/ai-suggestion"))
    t.check("a guest sees a suggestion that is already stored",
            r.json() == {"status": "shown", "suggestion": "Stored suggestion text."}, f"-> {r.text[:120]}")
    t.check("...without any Gemini call", calls == 0, f"-> {calls} calls")

    print("\nSigned-in users get the AI, up to 30 calls per 10 minutes")
    used_ai = 0
    for i in range(30):
        r, calls = gemini_calls_during(lambda: as_ana.post(
            "/problems/match/ai", json={"title": f"Laptop slow after update number {i}", "description": ""}))
        used_ai += 1 if (r.status_code == 200 and r.json().get("ai_used") and calls > 0) else 0
    t.check("calls 1-30 use the AI", used_ai == 30, f"-> {used_ai} of 30")

    r, calls = gemini_calls_during(lambda: as_ana.post(
        "/problems/match/ai", json={"title": "Laptop slow after update number 31", "description": ""}))
    t.check("the 31st call still answers 200", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
    t.check("...with keyword results marked backup", r.json().get("backup") is True and r.json().get("ai_used") is False,
            f"-> {r.text[:160]}")
    t.check("...and Gemini is not called", calls == 0, f"-> {calls} calls")

    r, calls = gemini_calls_during(lambda: as_ana.get(f"/problems/{first}/similar/ai"))
    t.check("over the limit, /similar/ai also falls back to backup", r.status_code == 200 and r.json().get("backup") is True,
            f"-> {r.status_code} {r.text[:160]}")
    t.check("...without calling Gemini", calls == 0, f"-> {calls} calls")

    db.close()
    print(f"\n{t.PASSED} passed, {t.FAILED} failed")
    sys.exit(1 if t.FAILED else 0)


if __name__ == "__main__":
    main_test()
