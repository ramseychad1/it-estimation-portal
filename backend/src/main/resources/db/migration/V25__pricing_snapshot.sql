-- V25: Snapshot effective pricing config on item approval.
--
-- When an SO approves an estimate item, the current effective pricing
-- config (category override merged with global defaults) is captured here.
-- Subsequent changes to client_pricing_defaults or category_pricing_overrides
-- do not retroactively alter approved estimates.

ALTER TABLE estimate_request_items
    ADD COLUMN approved_pricing_model        VARCHAR(20),
    ADD COLUMN approved_tm_multiplier        NUMERIC(12, 4),
    ADD COLUMN approved_tm_target_margin_pct NUMERIC(5,  2),
    ADD COLUMN approved_mat_billable_rate    NUMERIC(12, 2),
    ADD COLUMN approved_mat_discount_pct     NUMERIC(5,  2);
