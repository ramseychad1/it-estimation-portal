-- =========================================================================
-- V4 — seed the seven system SDLC phases
--
-- These rows are created with is_system = TRUE. They cannot be deleted
-- (only deactivated) and their display order is mutable but constrained
-- to be unique across the table. Created/updated by the seeded admin user
-- (id = 1).
--
-- This is a system bootstrap, not a user action — no change_log rows.
-- =========================================================================

INSERT INTO sdlc_phases (name, description, display_order, active, is_system, created_by, updated_by)
VALUES
    ('Analysis',    'Requirements gathering, business analysis, scoping',     1, TRUE, TRUE, 1, 1),
    ('Design',      'Solution and technical design',                          2, TRUE, TRUE, 1, 1),
    ('Development', 'Coding, unit testing, code review',                      3, TRUE, TRUE, 1, 1),
    ('Testing',     'QA functional and integration testing',                  4, TRUE, TRUE, 1, 1),
    ('UAT',         'User acceptance testing with business stakeholders',     5, TRUE, TRUE, 1, 1),
    ('Deploy',      'Release management and deployment',                      6, TRUE, TRUE, 1, 1),
    ('Hypercare',   'Post-deployment monitoring and support window',          7, TRUE, TRUE, 1, 1);
