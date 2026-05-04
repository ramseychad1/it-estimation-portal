-- Phase 10: add optional go-live date to estimate requests.
-- Nullable — null means the requester doesn't yet know the target date.
ALTER TABLE estimate_requests ADD COLUMN go_live_date DATE;
