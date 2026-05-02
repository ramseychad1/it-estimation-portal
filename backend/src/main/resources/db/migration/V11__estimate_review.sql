-- =========================================================================
-- V11 — Reviewer workflow: approval-time blended-rate snapshot + ChangeAction
--      enum value backfill for the estimate-request state machine.
--
-- Schema delta (one column on estimate_requests):
--   approved_blended_rate_id — captures which blended_rates row was
--   effective at the moment the SO approved. Total cost is computed
--   client-side; the snapshot here lets the cost banner say "this
--   estimate uses blended rates effective {date}" and stay accurate
--   even after future rate updates. NULL while In Review or Rejected;
--   populated only on the IN_REVIEW → APPROVED transition.
--
-- Backfill of change_log:
--   Phase 6a wrote the SUBMITTED transition as a CREATED row with notes
--   "Submitted (template snapshot vN)" because the SUBMITTED action enum
--   didn't exist yet. Now that ChangeAction.SUBMITTED is real (V11
--   companion change in Java), promote those rows in place. The notes
--   field is cleared because the request's own template_id captures the
--   same information — keeping the notes string would be redundant
--   audit noise once the action verb does the work.
--
--   Only the CREATED rows whose notes match the precise pattern get
--   promoted. The original CREATED rows for Draft creation (no notes)
--   stay as-is — Draft creation correctly remains a CREATED action.
-- =========================================================================

ALTER TABLE estimate_requests
    ADD COLUMN approved_blended_rate_id BIGINT
        REFERENCES blended_rates (id) ON DELETE RESTRICT;

CREATE INDEX estimate_requests_approved_rate_idx
    ON estimate_requests (approved_blended_rate_id)
    WHERE approved_blended_rate_id IS NOT NULL;

UPDATE change_log
SET action = 'SUBMITTED',
    notes = NULL
WHERE entity_type = 'EstimateRequest'
  AND action = 'CREATED'
  AND notes LIKE 'Submitted (template snapshot v%';
