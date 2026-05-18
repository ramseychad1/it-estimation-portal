-- Phase 10: document upload support on critical questions
-- Add document-upload flags to critical_questions
ALTER TABLE critical_questions
    ADD COLUMN document_upload_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN document_upload_required BOOLEAN NOT NULL DEFAULT FALSE;

-- One uploaded file per (item, question) pair. Binary data lives here so
-- that queries against answer text never load file payloads.
CREATE TABLE answer_attachments (
    id                        BIGSERIAL PRIMARY KEY,
    estimate_request_item_id  BIGINT       NOT NULL REFERENCES estimate_request_items(id) ON DELETE CASCADE,
    critical_question_id      BIGINT       NOT NULL REFERENCES critical_questions(id)     ON DELETE RESTRICT,
    original_filename         TEXT         NOT NULL,
    content_type              VARCHAR(100) NOT NULL,
    file_size_bytes           BIGINT       NOT NULL,
    file_data                 BYTEA        NOT NULL,
    uploaded_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    uploaded_by               BIGINT       NOT NULL REFERENCES users(id),
    UNIQUE (estimate_request_item_id, critical_question_id)
);

CREATE INDEX answer_attachments_item_idx ON answer_attachments (estimate_request_item_id);
