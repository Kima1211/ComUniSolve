-- ComUniSolve — moderation schema (Layers 1-5)
-- Run once against the comunisolve database:
--     psql -U postgres -d comunisolve -f migrations/2026_09_21_moderation.sql
-- or paste into pgAdmin's Query Tool.
--
-- There is no Alembic on this project, so schema changes are manual. This file
-- exists so the change is reviewable and repeatable rather than typed once into
-- a console and forgotten. It is safe to run twice: every statement checks
-- whether its object already exists.
--
-- Everything runs inside one transaction. If any statement fails, nothing is
-- applied — the database is never left half-migrated.

BEGIN;

-- ---------------------------------------------------------------------------
-- PROBLEMS and SOLUTIONS: the two moderation state columns
--
--   ai_status          what Layer 1 concluded about this content
--   moderation_status  where this content currently stands
--
-- These are separate on purpose. "The AI thought this was unclear" and "an
-- admin removed this" are different facts, and collapsing them into one column
-- would make it impossible to tell an AI opinion from a human decision.
-- ---------------------------------------------------------------------------

ALTER TABLE problems
    ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible';

ALTER TABLE solutions
    ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible';

-- ---------------------------------------------------------------------------
-- USERS: suspension state
--
-- Kept separate from the existing is_active column. is_active means "this
-- account is switched on"; is_suspended means "an admin took action against
-- this person". Same effect at the door, completely different reasons, and
-- only one of them should show the user a moderation message.
-- ---------------------------------------------------------------------------

-- suspended_until is the column the code actually reads. NULL while suspended
-- means a permanent ban; a future timestamp means it lifts on its own.
--
-- Nothing runs on a timer to clear these. Suspensions expire the moment the
-- user next tries to do something, exactly like refresh tokens and email
-- verification tokens already do in this codebase.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- ---------------------------------------------------------------------------
-- REPORTS (Layer 3)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reports (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    problem_id  INTEGER          REFERENCES problems(id)  ON DELETE CASCADE,
    solution_id INTEGER          REFERENCES solutions(id) ON DELETE CASCADE,
    reason      VARCHAR(20) NOT NULL,
    details     TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_reports_user_id     ON reports(user_id);
CREATE INDEX IF NOT EXISTS ix_reports_problem_id  ON reports(problem_id);
CREATE INDEX IF NOT EXISTS ix_reports_solution_id ON reports(solution_id);
CREATE INDEX IF NOT EXISTS ix_reports_status      ON reports(status);

-- ---------------------------------------------------------------------------
-- MODERATION_LOGS (Layer 5)
--
-- admin_id and the target FKs are ON DELETE SET NULL rather than CASCADE: an
-- audit trail that deletes itself when the admin account is removed is not an
-- audit trail. content_snapshot is what keeps a log row readable after the
-- content it refers to is gone.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS moderation_logs (
    id               SERIAL PRIMARY KEY,
    admin_id         INTEGER     REFERENCES users(id)     ON DELETE SET NULL,
    target_type      VARCHAR(20) NOT NULL,
    problem_id       INTEGER     REFERENCES problems(id)  ON DELETE SET NULL,
    solution_id      INTEGER     REFERENCES solutions(id) ON DELETE SET NULL,
    target_user_id   INTEGER     REFERENCES users(id)     ON DELETE SET NULL,
    action           VARCHAR(20) NOT NULL,
    reason           TEXT,
    content_snapshot TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_moderation_logs_admin_id       ON moderation_logs(admin_id);
CREATE INDEX IF NOT EXISTS ix_moderation_logs_problem_id     ON moderation_logs(problem_id);
CREATE INDEX IF NOT EXISTS ix_moderation_logs_solution_id    ON moderation_logs(solution_id);
CREATE INDEX IF NOT EXISTS ix_moderation_logs_target_user_id ON moderation_logs(target_user_id);

-- ---------------------------------------------------------------------------
-- CONSTRAINTS
--
-- ADD CONSTRAINT has no IF NOT EXISTS, so each one is wrapped in a block that
-- swallows only the "already there" error. Any other failure still aborts the
-- whole transaction.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    BEGIN
        ALTER TABLE problems ADD CONSTRAINT valid_problem_ai_status
            CHECK (ai_status IN ('unchecked', 'ok', 'unclear', 'inappropriate'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE problems ADD CONSTRAINT valid_problem_moderation_status
            CHECK (moderation_status IN ('visible', 'flagged', 'removed'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE solutions ADD CONSTRAINT valid_solution_ai_status
            CHECK (ai_status IN ('unchecked', 'ok', 'unclear', 'inappropriate'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE solutions ADD CONSTRAINT valid_solution_moderation_status
            CHECK (moderation_status IN ('visible', 'flagged', 'removed'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- Exactly one target per report: a problem or a solution, never both,
    -- never neither.
    BEGIN
        ALTER TABLE reports ADD CONSTRAINT report_targets_exactly_one
            CHECK ((problem_id IS NULL) <> (solution_id IS NULL));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE reports ADD CONSTRAINT valid_report_reason
            CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misleading', 'other'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE reports ADD CONSTRAINT valid_report_status
            CHECK (status IN ('pending', 'actioned', 'dismissed'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- One report per user per item. Postgres treats NULLs as distinct in a
    -- unique constraint, so each of these only applies to rows where that
    -- column is actually set — the NULL side never collides with itself.
    --
    -- These two catch duplicate_table as well as duplicate_object: a UNIQUE
    -- constraint is backed by an index, an index is a relation, and re-adding
    -- one raises "relation already exists" rather than "object already exists".
    -- The CHECK constraints above have no index, so they only raise the latter.
    BEGIN
        ALTER TABLE reports ADD CONSTRAINT one_report_per_user_per_problem
            UNIQUE (user_id, problem_id);
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END;

    BEGIN
        ALTER TABLE reports ADD CONSTRAINT one_report_per_user_per_solution
            UNIQUE (user_id, solution_id);
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END;

    BEGIN
        ALTER TABLE moderation_logs ADD CONSTRAINT valid_moderation_action
            CHECK (action IN ('approved', 'removed', 'restored', 'dismissed', 'suspended', 'unsuspended'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER TABLE moderation_logs ADD CONSTRAINT valid_moderation_target_type
            CHECK (target_type IN ('problem', 'solution', 'user'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — run these after the migration and read the output.
-- Applying a migration without checking it landed is how code and database
-- drift apart.
-- ---------------------------------------------------------------------------

-- Expect 4 rows: ai_status, moderation_status on both tables.
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE (table_name = 'problems' OR table_name = 'solutions')
  AND column_name IN ('ai_status', 'moderation_status')
ORDER BY table_name, column_name;

-- Expect 4 rows, and every existing user should read is_suspended = false.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('is_suspended', 'suspended_at', 'suspended_until', 'suspension_reason')
ORDER BY column_name;

SELECT is_suspended, count(*) FROM users GROUP BY is_suspended;

-- Expect both tables present.
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('reports', 'moderation_logs')
ORDER BY table_name;
