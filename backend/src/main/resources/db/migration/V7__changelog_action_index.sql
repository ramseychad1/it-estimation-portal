-- =========================================================================
-- V7 — change_log filter-by-action index
--
-- The Change Log viewer (Phase 4) supports filtering by ChangeAction
-- (e.g. "show me only DELETED rows"). Existing indexes cover entity-scoped
-- and actor-scoped queries; this one keeps action-filtered feed scans
-- cheap as the table grows.
--
-- Compound order is (changed_at DESC, action) so the index also serves
-- the unfiltered feed query — we never paginate by action without a date
-- order, but we do paginate by date alone, and PG can range-scan the
-- leading column.
-- =========================================================================

CREATE INDEX change_log_changed_at_action_idx
    ON change_log (changed_at DESC, action);
