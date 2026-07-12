-- =========================================================================
-- V39 — rename benchmark_target_pct → benchmark_mid_pct; drop the global
-- contingency setting.
--
-- V38 shipped the middle distribution column as "target" and seeded a global
-- default contingency. Both changed after review:
--   * "Target" was a misleading label — it's the phase's mid-point share of
--     the project, so the column (and UI) is now "Mid".
--   * Contingency is no longer a stored global; it's a per-estimate input in
--     the estimator builder (default 10%).
--
-- V38 is already applied in every environment, so this is an additive delta
-- rather than an edit to V38 (which would break Flyway's checksum).
-- =========================================================================

ALTER TABLE sdlc_phases RENAME COLUMN benchmark_target_pct TO benchmark_mid_pct;

DELETE FROM app_settings WHERE key = 'default_contingency_pct';
