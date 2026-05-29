ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE user_notification_preferences (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type   VARCHAR(100) NOT NULL,
    enabled             BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_notification_type UNIQUE (user_id, notification_type)
);

CREATE INDEX idx_user_notif_prefs_user ON user_notification_preferences(user_id);
