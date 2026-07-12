-- =========================================================================
-- V38 — SDLC phase benchmarks + estimator reset
--
-- Introduces the dev-hours benchmark estimator model (from the "SDLC
-- Estimator" workbook):
--   * per-phase benchmark distribution (low / target / high %) + a default
--     offshore split, and a single "dev anchor" phase whose target % is the
--     divisor that back-solves total project hours from development hours.
--   * a global default contingency %.
--
-- It also RESETS all estimate data and the phase set: the previous SDLC
-- phases predate the benchmark taxonomy, and every existing request /
-- template is test data (confirmed). This wipe runs in ALL environments,
-- production included.
--
-- System bootstrap, not a user action — no change_log rows.
-- =========================================================================

-- ---- 1. benchmark columns on sdlc_phases --------------------------------
-- Percentages are stored as fractions (0.35 = 35%). low/target/high are
-- nullable so a phase can exist without a benchmark; default_offshore_pct
-- and is_dev_anchor always have a value.
ALTER TABLE sdlc_phases
    ADD COLUMN benchmark_low_pct    NUMERIC(6,4),
    ADD COLUMN benchmark_target_pct NUMERIC(6,4),
    ADD COLUMN benchmark_high_pct   NUMERIC(6,4),
    ADD COLUMN default_offshore_pct NUMERIC(6,4) NOT NULL DEFAULT 0,
    ADD COLUMN is_dev_anchor        BOOLEAN      NOT NULL DEFAULT FALSE;

-- ---- 2. wipe estimate data + phases -------------------------------------
-- Children first is unnecessary with CASCADE, but the explicit list documents
-- the blast radius. RESTART IDENTITY so the reseeded phases get ids 1..8.
TRUNCATE TABLE
    estimate_request_question_answers,
    answer_attachments,
    estimate_request_phase_lines,
    estimate_request_program_types,
    estimate_request_items,
    estimate_requests,
    estimate_template_lines,
    estimate_templates,
    sdlc_phases
    RESTART IDENTITY CASCADE;

-- ---- 3. reseed the 8 benchmark phases -----------------------------------
-- Values mirror the workbook's "Mapping (reference only)" table; targets sum
-- to 100%. Note UAT/RC targets sit above their own high bound — faithful to
-- the source; the range is a guardrail, not a hard bound. Design & Develop is
-- the dev anchor. Seeded as system phases (deactivate, don't delete).
INSERT INTO sdlc_phases
    (name, description, display_order, active, is_system,
     benchmark_low_pct, benchmark_target_pct, benchmark_high_pct,
     default_offshore_pct, is_dev_anchor, created_by, updated_by)
VALUES
    ('Requirements',       '1.3 High-level & detailed requirements',         1, TRUE, TRUE, 0.16, 0.15, 0.24, 0, FALSE, 1, 1),
    ('Design & Develop',   '2.1a Design and development (dev-hours anchor)', 2, TRUE, TRUE, 0.30, 0.35, 0.40, 0, TRUE,  1, 1),
    ('Test - Dev Test',    '2.1b-1 Unit, integration, functional testing',   3, TRUE, TRUE, 0.09, 0.10, 0.13, 0, FALSE, 1, 1),
    ('Test - UAT',         '2.1b-2 User acceptance testing',                 4, TRUE, TRUE, 0.05, 0.10, 0.07, 0, FALSE, 1, 1),
    ('Test - RC',          '2.1b-3 Regulatory & compliance testing',         5, TRUE, TRUE, 0.04, 0.10, 0.06, 0, FALSE, 1, 1),
    ('Deploy',             '2.1c Release & deployment',                      6, TRUE, TRUE, 0.03, 0.05, 0.07, 0, FALSE, 1, 1),
    ('Transition to Run',  '3.2 Transition to run / support',                7, TRUE, TRUE, 0.02, 0.05, 0.05, 0, FALSE, 1, 1),
    ('Project Management', '5.1 PM & cadence (umbrella activity)',           8, TRUE, TRUE, 0.12, 0.10, 0.17, 0, FALSE, 1, 1);

-- ---- 4. global default contingency % (fraction) -------------------------
INSERT INTO app_settings (key, value, updated_at)
VALUES ('default_contingency_pct', '0.10', NOW())
ON CONFLICT (key) DO NOTHING;
