-- Pricing model classification for each category
ALTER TABLE categories ADD COLUMN pricing_model VARCHAR(20);

-- Global defaults for both pricing models (singleton: always id = 1)
CREATE TABLE client_pricing_defaults (
    id                   BIGSERIAL    PRIMARY KEY,
    tm_multiplier        NUMERIC(12, 4),
    tm_target_margin_pct NUMERIC(5,  2),
    mat_billable_rate    NUMERIC(12, 2),
    mat_discount_pct     NUMERIC(5,  2),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by           BIGINT       REFERENCES users(id)
);

INSERT INTO client_pricing_defaults (id) VALUES (1);

CREATE TRIGGER client_pricing_defaults_set_updated_at
    BEFORE UPDATE ON client_pricing_defaults
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Per-category overrides: one optional row per category
CREATE TABLE category_pricing_overrides (
    id                   BIGSERIAL    PRIMARY KEY,
    category_id          BIGINT       NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
    tm_multiplier        NUMERIC(12, 4),
    tm_target_margin_pct NUMERIC(5,  2),
    mat_billable_rate    NUMERIC(12, 2),
    mat_discount_pct     NUMERIC(5,  2),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by           BIGINT       REFERENCES users(id)
);

CREATE TRIGGER category_pricing_overrides_set_updated_at
    BEFORE UPDATE ON category_pricing_overrides
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
