BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

COMMIT;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('password_reset_token_hash', 'password_reset_expires_at')
ORDER BY column_name;
