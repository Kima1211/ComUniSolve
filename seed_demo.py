import os
import sys

from Models.database import SessionLocal
from Models import user as user_model, problem as problem_model, solution as solution_model
from datetime import date

from Security.utils import hash_password
from Services import locations

_CITY = next(code for code, c in locations.CITIES.items() if c["name"] == "San Jorge")
DEMO_ADDRESS = {
    "region_code": locations.CITIES[_CITY]["region"],
    "province_code": locations.CITIES[_CITY]["province"],
    "city_code": _CITY,
    "barangay_code": locations.barangays(_CITY)[0]["code"],
}

DEMO_DOMAIN = "@demo.comunisolve"

USERS = [
    ("Maria Santos", "maria" + DEMO_DOMAIN, 8),
    ("Ben Cruz", "ben" + DEMO_DOMAIN, 20),
    ("Lita Reyes", "lita" + DEMO_DOMAIN, 66),
    ("Nena Lim", "nena" + DEMO_DOMAIN, 92),
]

PROBLEMS = [
    (
        "Hindi maibigay ng dating school ang Form 137 ko",
        "Lilipat ako ng school ngayong semester pero sabi ng dati kong school, matagal pa daw "
        "bago nila maibigay ang Form 137. Baka hindi ako makapag-enroll sa tamang oras.",
        "Enrollment & Requirements", 0,
        [
            ("Hindi mo na kailangang ikaw ang kumuha. Mag-enroll ka gamit ang report card mo "
             "(Form 138), tapos ang bagong school mismo ang magre-request ng Form 137 sa dati "
             "mong school. Ganyan ang ginawa sa akin at natanggap ako agad.", 2, True),
        ],
    ),
    (
        "How do I apply for a CHED scholarship?",
        "I am an incoming first-year student and my family cannot afford the full tuition. "
        "Where do I get the form and what documents do they usually ask for?",
        "Tuition & Scholarships", 1, [],
    ),
    (
        "Tutdu-e daw ako if-else ha C++",
        "Diri ko maintindihan an if-else ha C++. Ano an kaibahan han if ngan else if? "
        "May exam kami ha Biyernes.",
        "Learning & Academics", 0,
        [
            ("Isipin mo na parang checkpoint. Ang if ang unang tanong - kapag totoo, doon "
             "papasok at hindi na titingnan ang iba. Ang else if ay susunod na tanong lang "
             "kapag mali ang una. Ang else naman ay kapag walang tumama sa lahat.", 2, True),
        ],
    ),
    (
        "How do I use if-else statements in C++?",
        "We just started conditionals in our programming subject and I keep getting the "
        "logic wrong when there is more than one condition to check.",
        "Learning & Academics", 1, [],
    ),
    (
        "No working electric fans in our classroom",
        "Three of the four fans in Room 204 have been broken since August. It gets very hot "
        "in the afternoon and it is hard to focus during long classes.",
        "School Facilities & Access", 3,
        [
            ("Ask your class officers to write a short letter to the building custodian with "
             "the room number and how many fans are broken. A written request gets logged, a "
             "verbal one gets forgotten. Ours were replaced within two weeks.", 2, False),
        ],
    ),
    (
        "Walang pambili ng bond paper at ink para sa mga project",
        "Ang daming kailangang i-print ngayong buwan. Mahal ang printing sa labas at wala "
        "kaming printer sa bahay.",
        "School Supplies & Costs", 1, [],
    ),
    (
        "My classmate is being bullied in our group chat",
        "Some classmates keep posting edited photos of her and making fun of her. She does "
        "not want to tell the teacher because she is afraid it will get worse.",
        "Student Welfare & Safety", 2,
        [
            ("Take screenshots before the messages are deleted, then go with her to the "
             "guidance office. They handle this confidentially, and she does not have to face "
             "the others alone.", 3, True),
        ],
    ),
    (
        "Laptop became very slow after a Windows update",
        "It takes almost five minutes to start and the browser freezes when I open Google "
        "Classroom. It was fine before the update last week.",
        "Devices & Repair", 0,
        [
            ("Open Task Manager (Ctrl+Shift+Esc), go to the Startup tab and disable the apps "
             "you do not need. Also check that the disk has at least 10 GB free - Windows "
             "updates slow everything down when the drive is almost full.", 3, True),
        ],
    ),
    (
        "Walang signal sa bahay, hindi maka-attend ng online class",
        "Isang bar lang ang signal sa loob ng bahay at palaging nawawala ang tawag sa Google "
        "Meet. Sa labas lang may signal.",
        "Internet & Connectivity", 1,
        [
            ("Subukan mong ilagay ang phone malapit sa bintana at gawing hotspot para sa laptop. "
             "I-off din ang video kapag hindi kailangan, mas kaunti ang data na kailangan.", 0, False),
        ],
    ),
    (
        "Na-hack ang Facebook account ko, paano ma-recover?",
        "Napalitan ang password at email ng account ko. May nagme-message na sa mga kaibigan "
        "ko at humihingi ng pera.",
        "Accounts & Passwords", 3,
        [
            ("Pumunta ka sa facebook.com/hacked mula sa ibang device at sundan ang steps. "
             "Habang inaayos, mag-post ang kaibigan mo o i-message ang mga contact mo na huwag "
             "magpadala ng pera. Kapag na-recover, i-on agad ang two-factor authentication.", 2, True),
        ],
    ),
    (
        "How do I get my ePhilID?",
        "I registered for the national ID last year but the card has not arrived. I need a "
        "valid ID for my scholarship application.",
        "Online Services & Apps", 2, [],
    ),
    (
        "Paano gumawa ng automatic table of contents sa Word?",
        "Mano-mano kong tina-type ang table of contents ng thesis namin at nagugulo tuwing "
        "may nadadagdag na page.",
        "Software & Office Tools", 0,
        [
            ("Gamitin mo ang Heading 1 at Heading 2 styles sa mga chapter title, tapos pumunta "
             "sa References > Table of Contents. Kapag may binago ka, i-right click lang ang "
             "table at piliin ang Update Field.", 1, True),
        ],
    ),
    (
        "May nag-text na nanalo daw ako sa GCash raffle",
        "Pinapa-send sa akin ang OTP para ma-claim daw ang premyo. Hindi naman ako sumali "
        "sa kahit anong raffle.",
        "Online Safety & Scams", 1,
        [
            ("Scam iyan. Huwag mong ibibigay ang OTP o MPIN mo kahit kanino - hindi iyan "
             "hinihingi ng GCash. I-block ang number at i-report sa GCash Help Center.", 3, True),
        ],
    ),
]

def main():
    # Neon is for real users only (decided 2026-10-01); seed a local database instead.
    if "neon.tech" in os.getenv("DATABASE_URL", ""):
        print("Refusing to seed: DATABASE_URL points to Neon.")
        sys.exit(1)

    db = SessionLocal()
    try:
        users = []
        created_users = 0
        for name, email, points in USERS:
            existing = db.query(user_model.User).filter(user_model.User.email == email).first()
            if existing:
                users.append(existing)
                continue
            first, last = name.split(" ", 1)
            u = user_model.User(
                name=name,
                first_name=first,
                last_name=last,
                birth_date=date(2003, 6, 15),
                **DEMO_ADDRESS,
                email=email,
                password=hash_password("demopassword123"),
                is_verified=True,
                points=points,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            users.append(u)
            created_users += 1

        created_problems = 0
        created_solutions = 0
        for title, description, category, author_idx, sols in PROBLEMS:
            if db.query(problem_model.Problem).filter(problem_model.Problem.title == title).first():
                continue

            p = problem_model.Problem(
                user_id=users[author_idx].id,
                title=title,
                description=description,
                category=category,
            )
            db.add(p)
            db.commit()
            db.refresh(p)
            created_problems += 1

            for text, sol_author_idx, accepted in sols:
                s = solution_model.Solution(
                    user_id=users[sol_author_idx].id,
                    problem_id=p.id,
                    solution_text=text,
                    status="accepted" if accepted else "pending",
                    upvote_count=7 if accepted else 2,
                )
                db.add(s)
                created_solutions += 1
                if accepted:
                    p.status = "resolved"
            db.commit()

        print(f"Created {created_users} users, {created_problems} problems, {created_solutions} solutions.")
        print(f"Demo accounts log in with password: demopassword123")
        print(f"Total problems now in the database: {db.query(problem_model.Problem).count()}")
    except Exception as e:
        db.rollback()
        print(f"Failed, nothing was changed: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()

