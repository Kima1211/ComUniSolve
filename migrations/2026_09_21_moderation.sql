BEGIN;

ALTER TABLE problems
    ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible';

ALTER TABLE solutions
    ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

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

SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE (table_name = 'problems' OR table_name = 'solutions')
  AND column_name IN ('ai_status', 'moderation_status')
ORDER BY table_name, column_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('is_suspended', 'suspended_at', 'suspended_until', 'suspension_reason')
ORDER BY column_name;

SELECT is_suspended, count(*) FROM users GROUP BY is_suspended;

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('reports', 'moderation_logs')
ORDER BY table_name;
