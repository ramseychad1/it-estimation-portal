-- =========================================================================
-- V41 — Sonexus V7 catalog refresh: full catalog wipe + SDLC phase reset
--
-- The Product/SubFeature/Template catalog (built from the old FY25 Orlando
-- LOE spreadsheet) is being fully replaced with a catalog derived from the
-- Sonexus Estimation Catalog Baseline V7 workbook. That workbook uses a
-- 10-phase SDLC taxonomy (Analysis / Configuration / Development / Testing /
-- UAT / Deployment / Release Management / Hypercare / Monitoring / Admin
-- Activity) that doesn't match the current 8 "benchmark estimator" phases
-- seeded in V38, so this migration retires those phases along with the
-- catalog they estimate against.
--
-- Same wipe pattern as V38 (TRUNCATE ... RESTART IDENTITY CASCADE, run in
-- ALL environments including production), extended to also cover
-- products/sub_features/critical_questions/template files, which V38 didn't
-- touch.
--
-- This intentionally leaves the "Build from Dev Hours" benchmark estimator
-- unconfigured on the new phases (benchmark_*_pct NULL, is_dev_anchor
-- FALSE) — no source data exists yet to re-derive those percentages for the
-- new taxonomy. Confirmed acceptable; revisit when that data exists.
--
-- System bootstrap, not a user action — no change_log rows.
-- =========================================================================

-- ---- 1. wipe catalog + estimate data + phases ---------------------------
TRUNCATE TABLE
    answer_attachments,
    estimate_request_question_answers,
    estimate_request_phase_lines,
    estimate_request_program_types,
    estimate_request_items,
    estimate_requests,
    estimate_template_lines,
    estimate_templates,
    product_template_files,
    subfeature_template_files,
    critical_questions,
    sub_features,
    products,
    sdlc_phases
    RESTART IDENTITY CASCADE;

-- ---- 2. reseed the 10 Sonexus V7 SDLC phases -----------------------------
-- Order matches the "Shore Mix by BRT & Phase" tab's column order. Seeded
-- as system phases (deactivate, don't delete) with no benchmark data — see
-- header note.
INSERT INTO sdlc_phases
    (name, description, display_order, active, is_system,
     benchmark_low_pct, benchmark_mid_pct, benchmark_high_pct,
     default_offshore_pct, is_dev_anchor, created_by, updated_by)
VALUES
    ('Analysis',            'Requirements and solution analysis',        1,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Configuration',       'System/application configuration',          2,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Development',         'Custom development / build',                3,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Testing',             'Functional / integration testing',          4,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('UAT',                 'User acceptance testing',                   5,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Deployment',          'Release deployment',                        6,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Release Management',  'Release coordination and management',       7,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Hypercare',           'Post-go-live hypercare support',             8,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Monitoring',          'Post-implementation monitoring',             9,  TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1),
    ('Admin Activity',      'Administrative / project overhead activity', 10, TRUE, TRUE, NULL, NULL, NULL, 0, FALSE, 1, 1);
