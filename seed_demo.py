import sys

from Models.database import SessionLocal
from Models import user as user_model, problem as problem_model, solution as solution_model
from Security.utils import hash_password

DEMO_DOMAIN = "@demo.comunisolve"

USERS = [
    ("Maria Santos", "maria" + DEMO_DOMAIN, 8),
    ("Ben Cruz", "ben" + DEMO_DOMAIN, 20),
    ("Lita Reyes", "lita" + DEMO_DOMAIN, 66),
    ("Nena Lim", "nena" + DEMO_DOMAIN, 92),
]

PROBLEMS = [
    (
        "Street light on Rizal St. has been out for weeks",
        "The lamp near the corner has been dark since the start of the month. It is hard to "
        "walk home safely after the evening shift, especially for the students coming back "
        "from review classes.",
        "Public", 0,
        [
            ("File a report at the barangay hall and ask for the ticket number. They forward "
             "it to the city electrical office every Monday. Mine was fixed in nine days once "
             "I had the ticket number to follow up with.", 2, True),
            ("You can also message the city's Facebook page. Slower, but it works if you "
             "cannot get to the hall during office hours.", 1, False),
        ],
    ),
    (
        "Mababa ang presyon ng tubig tuwing hapon",
        "Simula bandang alas-dos ng hapon, halos walang lumalabas na tubig sa gripo. "
        "Ganoon din daw sa mga kapitbahay namin sa parehong kalye.",
        "Household", 1,
        [
            ("Tumawag kayo sa water district at i-report ang address. Kapag marami kayong "
             "nag-report sa parehong kalye, mas mabilis nila inaasikaso. Nag-improve sa amin "
             "pagkatapos ng dalawang linggo.", 3, True),
        ],
    ),
    (
        "Looking for a weekend tutor for Grade 8 math",
        "My daughter is struggling with algebra and I cannot help her with it myself. Is "
        "anyone available near the plaza on Saturdays? We can pay the usual rate.",
        "School", 0,
        [
            ("Try asking at the high school - some of the senior students tutor on weekends "
             "for pocket money, and they are good with algebra because they just finished it.", 2, False),
        ],
    ),
    (
        "Garbage has not been collected on our street for two weeks",
        "The truck used to come every Tuesday and Friday. It has not come at all this month "
        "and the pile at the corner is starting to smell.",
        "Public", 1,
        [
            ("There was a change in the collection route. The barangay posted the new schedule "
             "on their bulletin board - ours moved to Wednesday and Saturday.", 3, False),
        ],
    ),
    (
        "What documents do I need for a barangay clearance?",
        "I need one for a job application next week and I do not want to make two trips. "
        "What should I bring with me?",
        "Public", 2,
        [
            ("Bring a valid ID, proof that you live here such as a utility bill, and the fee - "
             "it was 50 pesos when I got mine last month. Go early, before 9am, or the queue "
             "gets long.", 1, True),
        ],
    ),
    (
        "Paano mag-apply ng permit para sa maliit na sari-sari store?",
        "Balak kong magbukas ng maliit na tindahan sa harap ng bahay namin. Hindi ko alam "
        "kung saan magsisimula o magkano ang babayaran.",
        "Livelihood", 3, [],
    ),
    (
        "When is the next fogging schedule for dengue?",
        "There have been three cases in our purok this month. Does anyone know when the "
        "health center does the fogging, or how we request it?",
        "Health", 0, [],
    ),
    (
        "Our street floods whenever it rains hard",
        "The water reaches the doorstep within an hour of heavy rain. The drainage at the end "
        "of the street looks blocked but nobody seems to be clearing it.",
        "Public", 1, [],
    ),
    (
        "Tutdu-e daw ako if-else ha C++",
        "Diri ko maintindihan an if-else ha C++. Ano an kaibahan han if ngan else if? "
        "May exam kami ha Biyernes.",
        "School", 0,
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
        "School", 1, [],
    ),
]


def main():
    db = SessionLocal()
    try:
        users = []
        created_users = 0
        for name, email, points in USERS:
            existing = db.query(user_model.User).filter(user_model.User.email == email).first()
            if existing:
                users.append(existing)
                continue
            u = user_model.User(
                name=name,
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

