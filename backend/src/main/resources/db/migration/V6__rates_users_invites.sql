-- =========================================================================
-- V6 — blended_rates + users invitation columns + invitation_tokens
--
-- Audit-FK relaxation: hard-deleting users (Phase 3 deliverable) requires
-- that audit-style columns hold the user id even after the user row is
-- gone. We drop the FK constraints on those columns so DELETE on users
-- doesn't trip RESTRICT, and add explicit indexes to compensate for the
-- index that the FK used to provide implicitly. The future Change Log
-- viewer will want these for "show me everything user X did" lookups.
--
-- Kept as RESTRICT (small populations, undeletable-creator is acceptable):
--   blended_rates.created_by       (rates are immutable + rare)
--   users.invited_by               (invitee count is small)
-- =========================================================================

-- ---- audit FK relaxation (drop FKs, keep columns + add indexes) -----------

ALTER TABLE change_log DROP CONSTRAINT change_log_changed_by_fkey;
CREATE INDEX change_log_changed_by_idx ON change_log (changed_by);

ALTER TABLE teams DROP CONSTRAINT teams_created_by_fkey;
ALTER TABLE teams DROP CONSTRAINT teams_updated_by_fkey;
CREATE INDEX teams_created_by_idx ON teams (created_by);
CREATE INDEX teams_updated_by_idx ON teams (updated_by);

ALTER TABLE sdlc_phases DROP CONSTRAINT sdlc_phases_created_by_fkey;
ALTER TABLE sdlc_phases DROP CONSTRAINT sdlc_phases_updated_by_fkey;
CREATE INDEX sdlc_phases_created_by_idx ON sdlc_phases (created_by);
CREATE INDEX sdlc_phases_updated_by_idx ON sdlc_phases (updated_by);

-- ---- users: invitation columns ------------------------------------------

ALTER TABLE users ADD COLUMN invitation_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (invitation_status IN ('ACTIVE', 'PENDING_INVITE', 'INACTIVE'));

ALTER TABLE users ADD COLUMN invited_by             BIGINT REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN invited_at             TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN invitation_expires_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN invitation_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN last_active_at         TIMESTAMPTZ;

-- Backfill: existing users land as ACTIVE / INACTIVE based on their `active` flag.
UPDATE users SET invitation_status = 'ACTIVE'   WHERE active = TRUE;
UPDATE users SET invitation_status = 'INACTIVE' WHERE active = FALSE;

CREATE INDEX users_invitation_status_idx ON users (invitation_status);

-- ---- invitation_tokens ---------------------------------------------------

CREATE TABLE invitation_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    token       VARCHAR(64)  NOT NULL UNIQUE,
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ
);

-- "Find the active token for a user" — used to revoke before re-issuing.
CREATE INDEX invitation_tokens_active_per_user_idx
    ON invitation_tokens (user_id, used_at, revoked_at);

-- ---- blended_rates -------------------------------------------------------
--
-- Rate rows are IMMUTABLE from the application. There is no UPDATE or
-- DELETE path; the service exposes only a create-new-row method, and the
-- controller has no PATCH or DELETE endpoint. Every change is a new row
-- with a new effective_date.
--
-- "Current rate" = MAX(effective_date) WHERE effective_date <= today,
-- ties broken by latest created_at.
-- =========================================================================

CREATE TABLE blended_rates (
    id              BIGSERIAL      PRIMARY KEY,
    onshore_rate    NUMERIC(10,2)  NOT NULL CHECK (onshore_rate > 0),
    offshore_rate   NUMERIC(10,2)  NOT NULL CHECK (offshore_rate > 0),
    effective_date  DATE           NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      BIGINT         NOT NULL REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX blended_rates_effective_date_idx
    ON blended_rates (effective_date DESC, created_at DESC);
