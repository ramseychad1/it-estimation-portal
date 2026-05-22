-- V27 — Revenue & Pricing Review workflow
--
-- 1. Global application settings (key/value, Admin-managed).
-- 2. Pricing-review state columns on estimate_requests.
-- 3. Revenue Manager item-level pricing-model override columns on estimate_request_items.

-- ── Global settings ──────────────────────────────────────────────────────────

CREATE TABLE app_settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      VARCHAR(500) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by BIGINT REFERENCES users(id)
);

-- Default: revenue review is off until an Admin enables it.
INSERT INTO app_settings (key, value, updated_at)
VALUES ('revenue_review_enabled', 'false', NOW());

-- ── Pricing review state on estimate_requests ─────────────────────────────────
--
-- pricingReviewStatus lifecycle:
--   NULL           — feature disabled, or request not yet fully approved
--   PENDING        — all items approved, waiting for RM to claim
--   IN_REVIEW      — RM has claimed the request
--   APPROVED       — RM approved; derived status returns to "APPROVED"

ALTER TABLE estimate_requests
    ADD COLUMN pricing_review_status  VARCHAR(20),
    ADD COLUMN rm_reviewer_id         BIGINT REFERENCES users(id),
    ADD COLUMN rm_discount_pct        NUMERIC(5,2),
    ADD COLUMN rm_notes               TEXT,
    ADD COLUMN rm_reviewed_at         TIMESTAMP WITH TIME ZONE;

-- ── RM per-item pricing-model overrides ───────────────────────────────────────
--
-- Non-null values replace the corresponding approved_* columns when computing
-- client price on the approved estimate. The Revenue Manager edits these during
-- their review; they are cleared if an Admin sends an item back.

ALTER TABLE estimate_request_items
    ADD COLUMN rm_pricing_model           VARCHAR(20),
    ADD COLUMN rm_tm_multiplier           NUMERIC(12,4),
    ADD COLUMN rm_tm_target_margin_pct    NUMERIC(5,2),
    ADD COLUMN rm_mat_billable_rate       NUMERIC(12,2),
    ADD COLUMN rm_mat_discount_pct        NUMERIC(5,2);
