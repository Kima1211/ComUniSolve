-- ComUniSolve — password reset columns
-- Run once against EVERY database the app uses (local and Neon):
--     psql -U postgres -d comunisolve -f migrations/2026_09_24_password_reset.sql
-- or paste into pgAdmin's Query Tool / Neon's SQL Editor.
--
-- Run it BEFORE deploying the code that uses these columns. SQLAlchemy selects
-- every mapped column on each users query, so new code against an old table
-- fails on login, not just on password reset.
--
-- Same pattern as email verification: only the SHA-256 hash of the token is
-- stored, never the token itself, and the expiry makes old links useless.
-- Safe to run twice.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

COMMIT;

-- Verification: expect 2 rows.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('password_reset_token_hash', 'password_reset_expires_at')
ORDER BY column_name;
