-- =========================================================================
-- V10 — Requester workflow: estimate requests + per-phase line snapshots
--      + question/answer snapshots.
--
-- The Requester picks a Product (and Sub-feature for CONTAINER products),
-- answers the Critical Questions, and submits. Submission COPIES the active
-- estimate template's hour rows AND the question text into request-owned
-- tables — this is the audit. Future template/question edits don't affect
-- already-submitted requests; the snapshot is the truth.
--
-- State machine:
--   DRAFT → SUBMITTED → IN_REVIEW → APPROVED
--                                  → REJECTED
--   Phase 6a only exercises DRAFT → SUBMITTED. The IN_REVIEW / APPROVED /
--   REJECTED transitions land in Phase 6b's Reviewer surface; the data
--   model supports them today.
--
-- Audit-FK relaxation: requester_id and reviewer_id have no FK to users.
-- Same pattern as change_log.changed_by / created_by columns elsewhere.
-- Indexes added explicitly so audit-shaped queries stay fast.
--
-- Sub-feature ↔ product invariant ("if sub_feature_id is set, it must
-- belong to product_id") is NOT a DB CHECK — Postgres can't easily express
-- the join-condition assertion. Enforced at the service layer in
-- EstimateRequestService.createDraft and re-checked at submit.
-- =========================================================================

-- ---- estimate_requests ---------------------------------------------------

CREATE TABLE estimate_requests (
    id              BIGSERIAL    PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    product_id      BIGINT       NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    sub_feature_id  BIGINT       REFERENCES sub_features (id) ON DELETE RESTRICT,
    template_id     BIGINT       REFERENCES estimate_templates (id) ON DELETE RESTRICT,
    complexity      VARCHAR(8),
    status          VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',
    requester_id    BIGINT       NOT NULL,
    reviewer_id     BIGINT,
    justification   TEXT,
    submitted_at    TIMESTAMPTZ,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT estimate_requests_status_chk
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED')),
    CONSTRAINT estimate_requests_complexity_chk
        CHECK (complexity IS NULL OR complexity IN ('LOW', 'MED', 'HIGH'))
);

-- "My requests" lookup — caller's own rows, optionally filtered by status.
CREATE INDEX estimate_requests_requester_status_idx
    ON estimate_requests (requester_id, status);
-- SO review queue (Phase 6b): submitted-first ordering for in-take.
CREATE INDEX estimate_requests_status_submitted_idx
    ON estimate_requests (status, submitted_at DESC);
-- Audit-shaped lookups (who reviewed which requests).
CREATE INDEX estimate_requests_reviewer_idx ON estimate_requests (reviewer_id);

CREATE TRIGGER estimate_requests_set_updated_at
    BEFORE UPDATE ON estimate_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- estimate_request_phase_lines ----------------------------------------
--
-- Snapshot of estimate_template_lines at submission time. Six hour cells
-- are NOT NULL (mirrors V9 on the source rows). Override columns let the
-- Reviewer (Phase 6b) tweak per-row without rewriting the snapshot.
--
-- sdlc_phase_name_snapshot + sdlc_phase_display_order_snapshot let the
-- detail view render correctly even after a phase is renamed or reordered
-- post-submission.

CREATE TABLE estimate_request_phase_lines (
    id                                BIGSERIAL    PRIMARY KEY,
    estimate_request_id               BIGINT       NOT NULL REFERENCES estimate_requests (id) ON DELETE CASCADE,
    sdlc_phase_id                     BIGINT       NOT NULL REFERENCES sdlc_phases (id) ON DELETE RESTRICT,
    sdlc_phase_name_snapshot          VARCHAR(255) NOT NULL,
    sdlc_phase_display_order_snapshot INTEGER      NOT NULL,
    onshore_low                       NUMERIC(10,2) NOT NULL,
    onshore_med                       NUMERIC(10,2) NOT NULL,
    onshore_high                      NUMERIC(10,2) NOT NULL,
    offshore_low                      NUMERIC(10,2) NOT NULL,
    offshore_med                      NUMERIC(10,2) NOT NULL,
    offshore_high                     NUMERIC(10,2) NOT NULL,
    onshore_override                  NUMERIC(10,2),
    offshore_override                 NUMERIC(10,2),
    CONSTRAINT estimate_request_phase_lines_unique
        UNIQUE (estimate_request_id, sdlc_phase_id)
);

CREATE INDEX estimate_request_phase_lines_request_idx
    ON estimate_request_phase_lines (estimate_request_id);

-- ---- estimate_request_question_answers -----------------------------------
--
-- Snapshot of (question_text, answer_text) pairs at submission time.
-- question_text_snapshot freezes the wording as the requester saw it;
-- editing the original question post-submission doesn't rewrite history.

CREATE TABLE estimate_request_question_answers (
    id                  BIGSERIAL PRIMARY KEY,
    estimate_request_id BIGINT    NOT NULL REFERENCES estimate_requests (id) ON DELETE CASCADE,
    critical_question_id BIGINT   NOT NULL REFERENCES critical_questions (id) ON DELETE RESTRICT,
    question_text_snapshot TEXT   NOT NULL,
    answer_text         TEXT      NOT NULL,
    CONSTRAINT estimate_request_question_answers_unique
        UNIQUE (estimate_request_id, critical_question_id)
);

CREATE INDEX estimate_request_question_answers_request_idx
    ON estimate_request_question_answers (estimate_request_id);
