# ComUniSolve

ComUniSolve is a community problem-solution platform for Filipino students, parents and teachers, built as a
BSIT capstone at NwSSU – San Jorge. Users post a problem, see similar problems that were already solved, and
answer each other's problems. AI (Google Gemini) checks posts before they go up and judges which problems are
similar; keyword similarity (TF-IDF) is the backup when the AI is unavailable. It also has reputation points,
five-layer moderation, an admin dashboard, and English/Tagalog.

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy 2, PostgreSQL (psycopg2), JWT login with rotating refresh tokens,
  bcrypt + pepper password hashing, scikit-learn (TF-IDF), Gemini API, Brevo (email), Cloudinary (images).
- **Frontend:** React 19, Vite, React Router 7, Tailwind CSS v4, installable as a PWA. It lives in `frontend/`.

## Local setup (Windows Command Prompt)

You need Python 3.12 or newer, Node.js, and a local PostgreSQL server with an empty database (for example `comunisolve`).

Backend, from the repo root:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Open `.env` and fill in the values. The ones marked REQUIRED must be set or the backend will not start.

```bat
python -m Models.create_tables
uvicorn main:app --reload
```

The API runs at http://localhost:8000 (docs at http://localhost:8000/docs).
`python -m Models.create_tables` builds every table on an empty database.

Frontend, in a second Command Prompt:

```bat
cd frontend
npm install
npm run dev
```

The site runs at http://localhost:5173. It calls the backend at http://localhost:8000 unless
`frontend/.env` sets `VITE_API_URL` (see `frontend/.env.example`).

## Running the tests safely

`smoke_test.py`, `test_moderation.py`, `test_reputation.py`, `test_ai_access.py`, `test_removed_content.py` and
`test_create_tables.py` **delete every table** in the database they use. Only ever run them against a throwaway
database whose name contains `modtest`, for example `comunisolve_modtest`. They refuse to run otherwise.
Never point them at your real database.

```bat
set DATABASE_URL=postgresql://postgres:your-password@localhost:5432/comunisolve_modtest
set TEST_DATABASE_URL=%DATABASE_URL%
python smoke_test.py
python test_moderation.py
python test_reputation.py
python test_ai_access.py
python test_removed_content.py
python test_create_tables.py
```

Run `smoke_test.py` first, on an empty database: it only drops the tables it knows about, so tables left by the
other tests can block it. The `set` lines only last until you close that Command Prompt.

`test_reputation.py`, `test_ai_access.py` and `test_removed_content.py` replace Gemini with a fake, so they never
call the real API. `test_moderation.py` and `smoke_test.py` may call the real Gemini API if `GEMINI_API_KEY` is set.

`test_matching.py` is different: it is read-only, uses the demo data on your normal local database
(`python seed_demo.py`), and calls the real Gemini API.

## How production is wired

`frontend/vercel.json` says:

- **Vercel** serves the built frontend. Every path that is not a file goes to `/index.html`, so React Router
  handles it.
- Requests to `/api/...` are forwarded to the backend at `https://comunisolve-api.onrender.com/...` (the `/api`
  prefix is removed). The production frontend calls `/api` because `frontend/.env.production` sets
  `VITE_API_URL=/api`.
- `/sw.js` (the service worker) is sent with `Cache-Control: no-cache`, so installed apps pick up new versions.
- Every response gets security headers, including a Content-Security-Policy that only allows scripts from the
  site itself.

The backend on Render reads its settings from environment variables (see `.env.example`), including
`DATABASE_URL` for the PostgreSQL database. In production, set `COOKIE_SECURE=true` and `SHOW_API_DOCS=false`.

## Known limitations

- **AI limit per user:** each signed-in user gets 30 AI requests per 10 minutes (matching and AI suggestions),
  counted per request even when the answer comes from the cache. After that the app switches to keyword
  matching and shows "The AI check isn't available right now". Guests always get keyword matching.
- **Expired session on a problem page:** if a signed-in user's 15-minute access token has just expired, the
  related-problems panel treats them as a guest for that one page load (keyword results). The next request
  renews the session.
- **Comments of a removed solution:** the app hides them with the solution, but calling
  `GET /solutions/{id}/comments` directly still returns them.
- **Rate limits live in memory:** login, registration and AI limits are counted inside the running backend, so
  they are only exact while the backend runs as one process, and they reset when it restarts.
