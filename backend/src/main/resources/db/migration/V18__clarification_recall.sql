-- Phase 10: Clarification Needed + Recall
-- Adds the SO's clarification note to per-item rows.
-- Status values NEEDS_CLARIFICATION and RECALLED are handled as enum string literals
-- in the Java layer — no DB enum change required.

ALTER TABLE estimate_request_items
    ADD COLUMN clarification_note TEXT;
