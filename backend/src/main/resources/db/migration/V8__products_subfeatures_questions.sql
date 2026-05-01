-- =========================================================================
-- V8 — Solution Owner catalog: products, sub_features, critical_questions
--      + schema-only foundation for Phase 5b: estimate_templates,
--        estimate_template_lines.
--
-- Active-name uniqueness divergence from V3:
--   Products and SubFeatures use partial-unique indexes scoped to
--   active = TRUE because their lifecycle includes deactivate-then-recreate
--   workflows (e.g. retire a Product, ship a successor with the same name).
--   Teams use unconditional unique on LOWER(name) (V3) because organisational
--   teams don't churn that way. If you find this divergence surprising,
--   that's why.
--
-- Critical-question parent shape:
--   Each row has product_id XOR sub_feature_id set. CHECK constraint
--   enforces "exactly one parent." Cascade-delete on either parent purges
--   its questions; questions are not migratable (the service rejects any
--   PATCH that would change the parent FK).
--
-- Cascade-delete behaviour for change_log:
--   The application writes a single DELETED row at the parent level
--   (Product or SubFeature). Child cascades happen at the DB layer and
--   produce no per-child audit rows. This is intentional — see
--   ProductService.delete javadoc.
-- =========================================================================

-- ---- products ------------------------------------------------------------

CREATE TABLE products (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    mode        VARCHAR(16)  NOT NULL,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  BIGINT       NOT NULL,
    CONSTRAINT products_mode_chk CHECK (mode IN ('ATOMIC', 'CONTAINER'))
);

-- Active-name uniqueness only — see header comment.
CREATE UNIQUE INDEX products_name_lower_active_uq
    ON products (LOWER(name)) WHERE active = TRUE;
CREATE INDEX products_active_name_idx ON products (active, name);
-- Audit-column indexes (audit FK relaxation pattern from V6: no FK,
-- explicit index instead).
CREATE INDEX products_created_by_idx ON products (created_by);
CREATE INDEX products_updated_by_idx ON products (updated_by);

CREATE TRIGGER products_set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- sub_features --------------------------------------------------------

CREATE TABLE sub_features (
    id          BIGSERIAL    PRIMARY KEY,
    product_id  BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  BIGINT       NOT NULL
);

-- Name unique within a product, active-only — see header comment.
CREATE UNIQUE INDEX sub_features_product_name_lower_active_uq
    ON sub_features (product_id, LOWER(name)) WHERE active = TRUE;
CREATE INDEX sub_features_product_active_name_idx
    ON sub_features (product_id, active, name);
CREATE INDEX sub_features_created_by_idx ON sub_features (created_by);
CREATE INDEX sub_features_updated_by_idx ON sub_features (updated_by);

CREATE TRIGGER sub_features_set_updated_at
    BEFORE UPDATE ON sub_features
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- critical_questions --------------------------------------------------

CREATE TABLE critical_questions (
    id             BIGSERIAL    PRIMARY KEY,
    product_id     BIGINT       REFERENCES products (id) ON DELETE CASCADE,
    sub_feature_id BIGINT       REFERENCES sub_features (id) ON DELETE CASCADE,
    question_text  TEXT         NOT NULL,
    help_text      TEXT,
    required       BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order  INTEGER      NOT NULL,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     BIGINT       NOT NULL,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by     BIGINT       NOT NULL,
    -- Exactly one parent: product XOR sub-feature, never both, never neither.
    CONSTRAINT critical_questions_parent_xor_chk
        CHECK ((product_id IS NOT NULL) <> (sub_feature_id IS NOT NULL))
);

CREATE INDEX critical_questions_product_order_idx
    ON critical_questions (product_id, display_order)
    WHERE product_id IS NOT NULL;
CREATE INDEX critical_questions_sub_feature_order_idx
    ON critical_questions (sub_feature_id, display_order)
    WHERE sub_feature_id IS NOT NULL;
CREATE INDEX critical_questions_created_by_idx ON critical_questions (created_by);
CREATE INDEX critical_questions_updated_by_idx ON critical_questions (updated_by);

CREATE TRIGGER critical_questions_set_updated_at
    BEFORE UPDATE ON critical_questions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- estimate_templates (schema-only — Phase 5b builds the editor) -------
--
-- Exists in this phase so cascade-delete from a Product or SubFeature
-- correctly purges the templates that Phase 5b will populate. No service,
-- no controller, no integration tests against this table in 5a.

CREATE TABLE estimate_templates (
    id             BIGSERIAL    PRIMARY KEY,
    product_id     BIGINT       REFERENCES products (id) ON DELETE CASCADE,
    sub_feature_id BIGINT       REFERENCES sub_features (id) ON DELETE CASCADE,
    version_number INTEGER      NOT NULL,
    is_active      BOOLEAN      NOT NULL,
    change_reason  TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     BIGINT       NOT NULL,
    -- Templates are immutable per version (new save = new row); no update_*.
    CONSTRAINT estimate_templates_parent_xor_chk
        CHECK ((product_id IS NOT NULL) <> (sub_feature_id IS NOT NULL))
);

-- Exactly one active version per Product (and per SubFeature).
CREATE UNIQUE INDEX estimate_templates_active_per_product_uq
    ON estimate_templates (product_id)
    WHERE is_active = TRUE AND product_id IS NOT NULL;
CREATE UNIQUE INDEX estimate_templates_active_per_sub_feature_uq
    ON estimate_templates (sub_feature_id)
    WHERE is_active = TRUE AND sub_feature_id IS NOT NULL;
CREATE INDEX estimate_templates_created_by_idx ON estimate_templates (created_by);

-- ---- estimate_template_lines (schema-only) -------------------------------

CREATE TABLE estimate_template_lines (
    id            BIGSERIAL     PRIMARY KEY,
    template_id   BIGINT        NOT NULL REFERENCES estimate_templates (id) ON DELETE CASCADE,
    sdlc_phase_id BIGINT        NOT NULL REFERENCES sdlc_phases (id) ON DELETE RESTRICT,
    -- All hour columns nullable: per the design system, Build-phase cells
    -- with no value are treated as 0 in calculations.
    onshore_low   NUMERIC(10,2),
    onshore_med   NUMERIC(10,2),
    onshore_high  NUMERIC(10,2),
    offshore_low  NUMERIC(10,2),
    offshore_med  NUMERIC(10,2),
    offshore_high NUMERIC(10,2),
    CONSTRAINT estimate_template_lines_unique_phase_per_template
        UNIQUE (template_id, sdlc_phase_id)
);
