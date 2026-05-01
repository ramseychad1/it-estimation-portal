-- =========================================================================
-- V9 — estimate_template_lines: hour columns NOT NULL
--
-- V8 (Phase 5a) created the six hour columns (onshore/offshore × low/med/high)
-- as nullable. Phase 5b decision #1 supersedes that: every cell is required
-- and Solution Owners enter explicit zeros where work doesn't apply, so the
-- audit trail never has phantom-zero ambiguity.
--
-- No backfill needed: templates haven't been writable until this phase, so
-- estimate_template_lines is empty in every environment. Defensive UPDATE
-- coalesces to 0 anyway in case any test fixture or hand-loaded row exists.
-- =========================================================================

UPDATE estimate_template_lines SET
    onshore_low   = COALESCE(onshore_low,   0),
    onshore_med   = COALESCE(onshore_med,   0),
    onshore_high  = COALESCE(onshore_high,  0),
    offshore_low  = COALESCE(offshore_low,  0),
    offshore_med  = COALESCE(offshore_med,  0),
    offshore_high = COALESCE(offshore_high, 0);

ALTER TABLE estimate_template_lines ALTER COLUMN onshore_low   SET NOT NULL;
ALTER TABLE estimate_template_lines ALTER COLUMN onshore_med   SET NOT NULL;
ALTER TABLE estimate_template_lines ALTER COLUMN onshore_high  SET NOT NULL;
ALTER TABLE estimate_template_lines ALTER COLUMN offshore_low  SET NOT NULL;
ALTER TABLE estimate_template_lines ALTER COLUMN offshore_med  SET NOT NULL;
ALTER TABLE estimate_template_lines ALTER COLUMN offshore_high SET NOT NULL;
