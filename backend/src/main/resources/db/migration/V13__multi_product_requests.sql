-- =========================================================================
-- V13 — Multi-product estimate requests.
--
-- Phase 9a transforms estimate_requests from single-product to
-- multi-product. All per-product state (product_id, sub_feature_id,
-- template_id, complexity, status, reviewer_id, justification,
-- submitted_at, reviewed_at, approved_blended_rate_id) moves out of
-- estimate_requests and into a new estimate_request_items child table.
--
-- estimate_request_phase_lines and estimate_request_question_answers
-- both re-FK to estimate_request_item_id (instead of estimate_request_id).
--
-- Migration steps:
--   1. Create estimate_request_items
--   2. Populate items from existing estimate_requests (1-to-1 backfill)
--   3. Add estimate_request_item_id FK to estimate_request_phase_lines,
--      populate from the backfilled items, make NOT NULL, drop old column
--   4. Same for estimate_request_question_answers
--   5. Drop moved columns from estimate_requests
-- =========================================================================

-- =========================================================================
-- Step 1: create estimate_request_items
-- =========================================================================

CREATE TABLE estimate_request_items (
    id                        BIGSERIAL PRIMARY KEY,
    estimate_request_id       BIGINT NOT NULL REFERENCES estimate_requests(id) ON DELETE CASCADE,
    product_id                BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    sub_feature_id            BIGINT REFERENCES sub_features(id) ON DELETE RESTRICT,
    template_id               BIGINT REFERENCES estimate_templates(id) ON DELETE RESTRICT,
    status                    VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    complexity                VARCHAR(8),
    reviewer_id               BIGINT,
    justification             TEXT,
    submitted_at              TIMESTAMPTZ,
    reviewed_at               TIMESTAMPTZ,
    approved_blended_rate_id  BIGINT REFERENCES blended_rates(id) ON DELETE RESTRICT,
    display_order             INTEGER NOT NULL DEFAULT 0,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT estimate_request_items_status_chk
        CHECK (status IN ('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED')),
    CONSTRAINT estimate_request_items_complexity_chk
        CHECK (complexity IS NULL OR complexity IN ('LOW','MED','HIGH'))
);

-- Partial unique indexes for (estimate_request_id, product_id, sub_feature_id):
-- NULLs are not equal in Postgres UNIQUE so we use two partial indexes.
CREATE UNIQUE INDEX uq_request_item_atomic
    ON estimate_request_items (estimate_request_id, product_id)
    WHERE sub_feature_id IS NULL;

CREATE UNIQUE INDEX uq_request_item_subfeature
    ON estimate_request_items (estimate_request_id, product_id, sub_feature_id)
    WHERE sub_feature_id IS NOT NULL;

CREATE INDEX estimate_request_items_request_idx
    ON estimate_request_items (estimate_request_id);

CREATE INDEX estimate_request_items_product_idx
    ON estimate_request_items (product_id);

CREATE INDEX estimate_request_items_status_idx
    ON estimate_request_items (status);

CREATE INDEX estimate_request_items_reviewer_idx
    ON estimate_request_items (reviewer_id)
    WHERE reviewer_id IS NOT NULL;

CREATE TRIGGER estimate_request_items_set_updated_at
    BEFORE UPDATE ON estimate_request_items
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- Step 2: Migrate existing data — one item per existing estimate_request
-- =========================================================================

INSERT INTO estimate_request_items (
    estimate_request_id,
    product_id,
    sub_feature_id,
    template_id,
    status,
    complexity,
    reviewer_id,
    justification,
    submitted_at,
    reviewed_at,
    approved_blended_rate_id,
    display_order,
    created_at,
    updated_at
)
SELECT
    id,
    product_id,
    sub_feature_id,
    template_id,
    status,
    complexity,
    reviewer_id,
    justification,
    submitted_at,
    reviewed_at,
    approved_blended_rate_id,
    0,
    created_at,
    updated_at
FROM estimate_requests;

-- =========================================================================
-- Step 3: Re-FK estimate_request_phase_lines to estimate_request_item_id
-- =========================================================================

-- Add the new FK column (nullable first for populate)
ALTER TABLE estimate_request_phase_lines
    ADD COLUMN estimate_request_item_id BIGINT;

-- Populate from the backfilled items table (1-to-1: item.estimate_request_id = line.estimate_request_id)
UPDATE estimate_request_phase_lines l
SET estimate_request_item_id = i.id
FROM estimate_request_items i
WHERE i.estimate_request_id = l.estimate_request_id;

-- Make NOT NULL now that all rows are populated
ALTER TABLE estimate_request_phase_lines
    ALTER COLUMN estimate_request_item_id SET NOT NULL;

-- Add FK constraint
ALTER TABLE estimate_request_phase_lines
    ADD CONSTRAINT estimate_request_phase_lines_item_fk
        FOREIGN KEY (estimate_request_item_id)
        REFERENCES estimate_request_items(id) ON DELETE CASCADE;

-- Drop old unique constraint and index that referenced estimate_request_id
ALTER TABLE estimate_request_phase_lines
    DROP CONSTRAINT IF EXISTS estimate_request_phase_lines_unique;

DROP INDEX IF EXISTS estimate_request_phase_lines_request_idx;

-- Drop old column
ALTER TABLE estimate_request_phase_lines
    DROP COLUMN estimate_request_id;

-- Recreate unique constraint and index using new column
ALTER TABLE estimate_request_phase_lines
    ADD CONSTRAINT estimate_request_phase_lines_unique
        UNIQUE (estimate_request_item_id, sdlc_phase_id);

CREATE INDEX estimate_request_phase_lines_item_idx
    ON estimate_request_phase_lines (estimate_request_item_id);

-- =========================================================================
-- Step 4: Re-FK estimate_request_question_answers to estimate_request_item_id
-- =========================================================================

-- Add the new FK column (nullable first for populate)
ALTER TABLE estimate_request_question_answers
    ADD COLUMN estimate_request_item_id BIGINT;

-- Populate from backfilled items table
UPDATE estimate_request_question_answers a
SET estimate_request_item_id = i.id
FROM estimate_request_items i
WHERE i.estimate_request_id = a.estimate_request_id;

-- Make NOT NULL
ALTER TABLE estimate_request_question_answers
    ALTER COLUMN estimate_request_item_id SET NOT NULL;

-- Add FK constraint
ALTER TABLE estimate_request_question_answers
    ADD CONSTRAINT estimate_request_question_answers_item_fk
        FOREIGN KEY (estimate_request_item_id)
        REFERENCES estimate_request_items(id) ON DELETE CASCADE;

-- Drop old unique constraint and index referencing estimate_request_id
ALTER TABLE estimate_request_question_answers
    DROP CONSTRAINT IF EXISTS estimate_request_question_answers_unique;

DROP INDEX IF EXISTS estimate_request_question_answers_request_idx;

-- Drop old column
ALTER TABLE estimate_request_question_answers
    DROP COLUMN estimate_request_id;

-- Recreate unique constraint and index using new column
ALTER TABLE estimate_request_question_answers
    ADD CONSTRAINT estimate_request_question_answers_unique
        UNIQUE (estimate_request_item_id, critical_question_id);

CREATE INDEX estimate_request_question_answers_item_idx
    ON estimate_request_question_answers (estimate_request_item_id);

-- =========================================================================
-- Step 5: Drop moved columns from estimate_requests
-- =========================================================================

-- Drop old indexes before dropping columns
DROP INDEX IF EXISTS estimate_requests_requester_status_idx;
DROP INDEX IF EXISTS estimate_requests_status_submitted_idx;
DROP INDEX IF EXISTS estimate_requests_reviewer_idx;
DROP INDEX IF EXISTS estimate_requests_approved_rate_idx;

-- Drop check constraints before dropping columns
ALTER TABLE estimate_requests
    DROP CONSTRAINT IF EXISTS estimate_requests_status_chk;

ALTER TABLE estimate_requests
    DROP CONSTRAINT IF EXISTS estimate_requests_complexity_chk;

-- Drop the moved columns
ALTER TABLE estimate_requests
    DROP COLUMN IF EXISTS product_id,
    DROP COLUMN IF EXISTS sub_feature_id,
    DROP COLUMN IF EXISTS template_id,
    DROP COLUMN IF EXISTS complexity,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS reviewer_id,
    DROP COLUMN IF EXISTS justification,
    DROP COLUMN IF EXISTS submitted_at,
    DROP COLUMN IF EXISTS reviewed_at,
    DROP COLUMN IF EXISTS approved_blended_rate_id;

-- Simple requester index on the now-slimmer table
CREATE INDEX estimate_requests_requester_idx ON estimate_requests(requester_id);
