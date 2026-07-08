-- SEC-1: admin-initiated password reset via a single-use, time-limited link.
-- Kept in its own table rather than reusing invitation_tokens so the invite
-- resend/revoke queries ("the active token for this user") can never pick up
-- a reset token. Same column shape as invitation_tokens; SecureRandom token.
CREATE TABLE password_reset_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    token       VARCHAR(64)  NOT NULL UNIQUE,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);
