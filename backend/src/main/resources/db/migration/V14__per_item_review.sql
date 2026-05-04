-- Phase 9b: per-item review fields on estimate_request_items.
-- The core review columns (status, complexity, reviewer_id, justification,
-- submitted_at, reviewed_at, approved_blended_rate_id) already exist from V13.
-- This migration adds the three fields needed for the rejection/revision flow.

ALTER TABLE estimate_request_items
    ADD COLUMN rejection_reason TEXT,
    ADD COLUMN revision_count   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN original_product_id BIGINT REFERENCES products(id) ON DELETE RESTRICT;

COMMENT ON COLUMN estimate_request_items.rejection_reason IS
    'SO''s explanation when rejecting an item. Cleared when requester revises and resubmits.';

COMMENT ON COLUMN estimate_request_items.revision_count IS
    'Incremented each time the requester revises this item. Useful for audit display.';

COMMENT ON COLUMN estimate_request_items.original_product_id IS
    'Set to the original product_id on the first product swap during revision. '
    'Null until a swap occurs; unchanged on subsequent swaps (preserves the original trail).';
