-- Per-client pricing overrides: one optional row per client.
-- Resolution precedence (per field): client override → category override → global default.
-- The pricing MODEL still comes from the category; this table only supplies the
-- numeric params (same shape as client_pricing_defaults and category_pricing_overrides).
CREATE TABLE client_pricing_overrides (
    id                   BIGSERIAL    PRIMARY KEY,
    client_id            BIGINT       NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    tm_multiplier        NUMERIC(12, 4),
    tm_target_margin_pct NUMERIC(5,  2),
    mat_billable_rate    NUMERIC(12, 2),
    mat_discount_pct     NUMERIC(5,  2),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by           BIGINT       REFERENCES users(id)
);

CREATE TRIGGER client_pricing_overrides_set_updated_at
    BEFORE UPDATE ON client_pricing_overrides
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
