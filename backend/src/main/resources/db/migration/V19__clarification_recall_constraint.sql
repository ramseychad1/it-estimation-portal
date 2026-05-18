-- V19: Extend the status CHECK constraint on estimate_request_items to allow
-- the two new statuses added in V18 (NEEDS_CLARIFICATION, RECALLED).
-- V18 added the clarification_note column but did not update this constraint,
-- causing a constraint violation (500) when the service attempted to persist
-- those statuses for the first time.

ALTER TABLE estimate_request_items
    DROP CONSTRAINT IF EXISTS estimate_request_items_status_chk;

ALTER TABLE estimate_request_items
    ADD CONSTRAINT estimate_request_items_status_chk
        CHECK (status IN (
            'DRAFT',
            'SUBMITTED',
            'IN_REVIEW',
            'APPROVED',
            'REJECTED',
            'NEEDS_CLARIFICATION',
            'RECALLED'
        ));
