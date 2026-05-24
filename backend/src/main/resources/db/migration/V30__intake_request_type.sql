-- V30: Generic intake request workflow
-- request_type distinguishes requester-scoped (CATALOG) from SO-scoped (INTAKE) requests.
-- item_type distinguishes the auto-created requirements carrier (CONTEXT) from normal
-- estimation items (SCOPE). CONTEXT items are auto-approved at submit time and are excluded
-- from the approval gate that controls pricing-review eligibility.

ALTER TABLE estimate_requests
    ADD COLUMN request_type VARCHAR(20) NOT NULL DEFAULT 'CATALOG';

ALTER TABLE estimate_request_items
    ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'SCOPE';

COMMENT ON COLUMN estimate_requests.request_type IS
    'CATALOG = requester selected products; INTAKE = SO-scoped free-form request';

COMMENT ON COLUMN estimate_request_items.item_type IS
    'SCOPE = normal estimation item; CONTEXT = intake requirements carrier, auto-approved at submit';
