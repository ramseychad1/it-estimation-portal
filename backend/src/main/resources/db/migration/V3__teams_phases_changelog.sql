-- =========================================================================
-- V3 — teams + sdlc_phases + change_log
--
-- All entity primary keys in this system use BIGSERIAL (BIGINT). All FKs
-- to users.id and the change_log.entity_id column are BIGINT for the same
-- reason — one ID type across the schema, no joins that need casting.
--
-- sdlc_phases.display_order is UNIQUE DEFERRABLE INITIALLY IMMEDIATE so
-- the reorder endpoint *could* rewrite display_order = 1..N inside a single
-- transaction without tripping the constraint. The actual reorder strategy
-- the service uses is a high-offset park (move all affected rows to
-- 10000 + N temporarily, then write the final 1..N) so the same logic also
-- works against H2 in tests, which doesn't honour DEFERRABLE the same way.
-- =========================================================================

-- ---- teams ---------------------------------------------------------------
CREATE TABLE teams (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX teams_name_lower_uq ON teams (LOWER(name));
CREATE INDEX teams_active_idx ON teams (active);

CREATE TRIGGER teams_set_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- sdlc_phases ---------------------------------------------------------
CREATE TABLE sdlc_phases (
    id            BIGSERIAL    PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    display_order INTEGER      NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    is_system     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT sdlc_phases_display_order_uq UNIQUE (display_order)
        DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX sdlc_phases_name_lower_uq ON sdlc_phases (LOWER(name));
CREATE INDEX sdlc_phases_active_idx ON sdlc_phases (active);
CREATE INDEX sdlc_phases_display_order_idx ON sdlc_phases (display_order);

CREATE TRIGGER sdlc_phases_set_updated_at
    BEFORE UPDATE ON sdlc_phases
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- change_log ----------------------------------------------------------
-- One row per field changed per save (CREATED / DELETED rows have field_name NULL).
CREATE TABLE change_log (
    id          BIGSERIAL    PRIMARY KEY,
    entity_type VARCHAR(64)  NOT NULL,
    entity_id   BIGINT       NOT NULL,
    action      VARCHAR(32)  NOT NULL,
    field_name  VARCHAR(128),
    old_value   TEXT,
    new_value   TEXT,
    changed_by  BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    source      VARCHAR(32)  NOT NULL DEFAULT 'WEB',
    notes       TEXT
);

CREATE INDEX change_log_entity_idx
    ON change_log (entity_type, entity_id, changed_at DESC);
CREATE INDEX change_log_actor_idx
    ON change_log (changed_by, changed_at DESC);
CREATE INDEX change_log_changed_at_idx
    ON change_log (changed_at DESC);
