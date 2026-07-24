-- =========================================================================
-- V42 — Dedicated system product for Generic Intake Requests
--
-- The V41 Sonexus V7 catalog reset (TRUNCATE ... RESTART IDENTITY) wiped the
-- products table and reseeded only the 9 real Sonexus products (ids 1-9) via
-- the manual sonexus_catalog_v7.sql seed. The INTAKE_SYSTEM_PRODUCT_ID env
-- var used by EstimateRequestService.createDraft() to carry Generic Intake
-- Requests still pointed at the old catalog's id (17), which no longer
-- exists — every intake submission has been failing with a 400 since the
-- reset.
--
-- Fix: seed a dedicated placeholder product (not one of the 9 real ones —
-- attaching intake to a real product would misroute every generic intake
-- request into that product's Solution Owner queue). Explicit id=10 so the
-- Railway INTAKE_SYSTEM_PRODUCT_ID var can be set to a known value without a
-- round-trip query after deploy.
--
-- This product intentionally has no team and no sub-features. It is NOT
-- hidden from the normal product picker (no such flag exists yet — see
-- CLAUDE.md carry-overs) and will appear as a selectable, dead-end entry
-- there until that's addressed. Accepted tradeoff for now.
-- =========================================================================

INSERT INTO products (id, name, description, mode, active, team_id, created_by, updated_by)
VALUES (
    10,
    'Generic Non-Catalog Request',
    'System placeholder product used to carry Generic Intake Requests before a Solution Owner scopes them onto real products. Not a real catalog product — do not use for normal estimates.',
    'ATOMIC',
    TRUE,
    NULL,
    1,
    1
);

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
