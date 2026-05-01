-- =========================================================================
-- V1 — initial schema
--
-- Phase 1 only ships the auth tables. Domain tables (teams, phases, rates,
-- products, sub_features, estimate_templates, estimates, change_log, etc.)
-- arrive in Phase 2+ as additional V<n>__*.sql migrations.
-- =========================================================================

-- ---- users ---------------------------------------------------------------
CREATE TABLE users (
    id             BIGSERIAL    PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_lower_uq ON users (LOWER(email));

-- ---- roles ---------------------------------------------------------------
-- Fixed IDs so application code can reference them without lookup churn.
CREATE TABLE roles (
    id     SMALLINT     PRIMARY KEY,
    name   VARCHAR(64)  NOT NULL UNIQUE
);

-- ---- user_roles (many-to-many) -------------------------------------------
CREATE TABLE user_roles (
    user_id  BIGINT   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id  SMALLINT NOT NULL REFERENCES roles (id),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX user_roles_role_idx ON user_roles (role_id);

-- ---- updated_at trigger --------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
