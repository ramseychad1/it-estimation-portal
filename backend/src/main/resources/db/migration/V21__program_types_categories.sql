-- V21: Program Types and Categories for estimate request classification.
--
-- program_types: multi-select (1+) per request. Configurable by Admin.
-- categories: single required selection per request. Configurable by Admin.
-- estimate_request_program_types: join table (M:M between requests and program types).
-- category_id FK added to estimate_requests (NOT NULL after backfill).
--
-- Backfill: all existing requests get "Test Program" and "Test Category"
-- so the NOT NULL constraint can be applied cleanly.

-- ---- program_types -------------------------------------------------------
CREATE TABLE program_types (
    id            BIGSERIAL    PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    display_order INTEGER      NOT NULL DEFAULT 0,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX program_types_name_lower_uq ON program_types (LOWER(name));
CREATE INDEX program_types_active_idx ON program_types (active);
CREATE INDEX program_types_order_idx  ON program_types (display_order, name);

CREATE TRIGGER program_types_set_updated_at
    BEFORE UPDATE ON program_types
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- categories ----------------------------------------------------------
CREATE TABLE categories (
    id            BIGSERIAL    PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    display_order INTEGER      NOT NULL DEFAULT 0,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX categories_name_lower_uq ON categories (LOWER(name));
CREATE INDEX categories_active_idx ON categories (active);
CREATE INDEX categories_order_idx  ON categories (display_order, name);

CREATE TRIGGER categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---- estimate_request_program_types join ---------------------------------
CREATE TABLE estimate_request_program_types (
    request_id      BIGINT NOT NULL REFERENCES estimate_requests (id) ON DELETE CASCADE,
    program_type_id BIGINT NOT NULL REFERENCES program_types     (id) ON DELETE RESTRICT,
    PRIMARY KEY (request_id, program_type_id)
);

CREATE INDEX erpt_program_type_idx ON estimate_request_program_types (program_type_id);

-- ---- category FK on estimate_requests ------------------------------------
ALTER TABLE estimate_requests
    ADD COLUMN category_id BIGINT REFERENCES categories (id) ON DELETE RESTRICT;

-- ---- seed program_types --------------------------------------------------
INSERT INTO program_types (name, display_order) VALUES
    ('APS Only',      1),
    ('SHPS Only',     2),
    ('APS+SHPS',      3),
    ('APS+SHPS+3PL',  4),
    ('Test Program',  5);

-- ---- seed categories -----------------------------------------------------
INSERT INTO categories (name, display_order) VALUES
    ('RFP',                        1),
    ('Implementation',             2),
    ('Statement of Work (COGS)',   3),
    ('Enhancement',                4),
    ('Product',                    5),
    ('IT Support',                 6),
    ('Test Category',              7);

-- ---- backfill existing requests ------------------------------------------
INSERT INTO estimate_request_program_types (request_id, program_type_id)
SELECT er.id, pt.id
FROM   estimate_requests er
CROSS  JOIN program_types pt
WHERE  pt.name = 'Test Program';

UPDATE estimate_requests
SET    category_id = (SELECT id FROM categories WHERE name = 'Test Category')
WHERE  category_id IS NULL;

-- ---- enforce NOT NULL after backfill is complete -------------------------
ALTER TABLE estimate_requests ALTER COLUMN category_id SET NOT NULL;
