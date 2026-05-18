-- Allow multiple attachments per (item, question) pair.
-- The one-file-per-question UNIQUE constraint is replaced by individual
-- deletes via the primary key (id) on the frontend.
ALTER TABLE answer_attachments
    DROP CONSTRAINT answer_attachments_estimate_request_item_id_critical_questi_key;
