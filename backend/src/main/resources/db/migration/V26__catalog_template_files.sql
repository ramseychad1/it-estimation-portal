-- V26: per-product and per-sub-feature template file attachments.
-- SOs upload a single downloadable template that requesters use when filling
-- out their estimation request. One file per product / sub-feature (UNIQUE FK).
-- Binary data is isolated here so catalog queries never drag file payloads.

CREATE TABLE product_template_files (
    id                BIGSERIAL    PRIMARY KEY,
    product_id        BIGINT       NOT NULL UNIQUE REFERENCES products (id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    content_type      VARCHAR(100) NOT NULL,
    file_size_bytes   BIGINT       NOT NULL,
    file_data         BYTEA        NOT NULL,
    uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    uploaded_by       BIGINT       NOT NULL
);

CREATE INDEX product_template_files_product_idx ON product_template_files (product_id);

CREATE TABLE subfeature_template_files (
    id                  BIGSERIAL    PRIMARY KEY,
    sub_feature_id      BIGINT       NOT NULL UNIQUE REFERENCES sub_features (id) ON DELETE CASCADE,
    original_filename   VARCHAR(255) NOT NULL,
    content_type        VARCHAR(100) NOT NULL,
    file_size_bytes     BIGINT       NOT NULL,
    file_data           BYTEA        NOT NULL,
    uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    uploaded_by         BIGINT       NOT NULL
);

CREATE INDEX subfeature_template_files_sf_idx ON subfeature_template_files (sub_feature_id);
