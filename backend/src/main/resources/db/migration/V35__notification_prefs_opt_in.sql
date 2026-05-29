-- Flip all existing users to opt-out; they must enable notifications manually.
UPDATE users SET notifications_enabled = FALSE;

-- Update column default so new accounts also start opted out.
ALTER TABLE users ALTER COLUMN notifications_enabled SET DEFAULT FALSE;
