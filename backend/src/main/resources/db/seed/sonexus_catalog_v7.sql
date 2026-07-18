-- =========================================================================
-- Sonexus V7 catalog seed — Products, SubFeatures, Estimate Templates
--
-- Generated from Sonexus_Estimation_Catalog_Baseline_V7.xlsx
-- ('Production Baseline Catalog' + 'Shore Mix by BRT & Phase' tabs).
-- Run manually via psql after V41__sonexus_phase_and_catalog_reset.sql has
-- been applied. Idempotent — safe to re-run.
-- =========================================================================

DO $$
DECLARE
  v_admin_id BIGINT := 1;
  v_team_id BIGINT;
  v_product_id BIGINT;
  v_sub_feature_id BIGINT;
  v_template_id BIGINT;
  v_phase_id BIGINT;
BEGIN

  -- ---- new teams ---------------------------------------------------------
  INSERT INTO teams (name, description, active, created_by, updated_by)
  SELECT 'CS Configuration', 'Sonexus V7 catalog team', true, v_admin_id, v_admin_id
  WHERE NOT EXISTS (SELECT 1 FROM teams WHERE LOWER(name) = LOWER('CS Configuration'));

  INSERT INTO teams (name, description, active, created_by, updated_by)
  SELECT 'ConnectSource', 'Sonexus V7 catalog team', true, v_admin_id, v_admin_id
  WHERE NOT EXISTS (SELECT 1 FROM teams WHERE LOWER(name) = LOWER('ConnectSource'));

  INSERT INTO teams (name, description, active, created_by, updated_by)
  SELECT 'Patient Connections', 'Sonexus V7 catalog team', true, v_admin_id, v_admin_id
  WHERE NOT EXISTS (SELECT 1 FROM teams WHERE LOWER(name) = LOWER('Patient Connections'));

  -- =========================================================================
  -- Container: CRM & Workflow  (Team: ConnectSource)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('ConnectSource');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('CRM & Workflow', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('CRM & Workflow');

  -- SubFeature: Add / Update Field, LOV, or Picklist
  -- Small=19  Med=28  Large=96.125 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Add / Update Field, LOV, or Picklist', 'Add or change a field, list of values, picklist, metadata value, label, or selectable option.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Add / Update Field, LOV, or Picklist');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.73, 4.02, 13.81, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.72, 1.06, 3.65, 0.07, 0.11, 0.37);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.17, 6.15, 21.11, 2.24, 3.3, 11.32);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.89, 4.26, 14.64, 1.38, 2.03, 6.97);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.74, 2.56, 8.8, 0.46, 0.67, 2.3);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.53, 2.25, 7.72, 0.3, 0.44, 1.5);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.03, 0.04, 0.13, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.69, 1.01, 3.47, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.07, 0.1, 0.34, 0.0, 0.0, 0.0);

  -- SubFeature: Business Rule / Validation Change
  -- Small=30  Med=76  Large=130 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Business Rule / Validation Change', 'Add or modify validation, automation, eligibility logic, case behavior, or rule-based processing.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Business Rule / Validation Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.92, 9.93, 16.98, 0.41, 1.04, 1.78);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.39, 0.99, 1.69, 0.11, 0.29, 0.49);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.03, 7.67, 13.12, 8.93, 22.61, 38.68);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.6, 4.05, 6.93, 5.47, 13.87, 23.72);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.86, 2.19, 3.74, 2.69, 6.81, 11.65);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.66, 1.68, 2.88, 1.32, 3.33, 5.7);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.07, 0.18, 0.31, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.29, 0.49, 0.23, 0.57, 0.98);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.21, 0.52, 0.89, 0.0, 0.0, 0.0);

  -- SubFeature: Copay / Savings Support Change
  -- Small=37.25  Med=83.75  Large=212.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Copay / Savings Support Change', 'Add or modify copay, savings card, PayTrax, or related affordability support workflow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Copay / Savings Support Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.63, 10.42, 26.41, 0.1, 0.23, 0.57);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.26, 2.83, 7.16, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.42, 16.68, 42.26, 5.91, 13.29, 33.67);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.14, 11.56, 29.29, 3.36, 7.56, 19.15);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.08, 6.92, 17.53, 1.64, 3.7, 9.37);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.94, 4.37, 11.07, 1.0, 2.24, 5.68);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.19, 0.43, 1.08, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.99, 2.22, 5.62, 0.04, 0.09, 0.23);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.55, 1.24, 3.15, 0.0, 0.0, 0.0);

  -- SubFeature: Eligibility / Program Rule Change
  -- Small=16.375  Med=33.25  Large=42.375 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Eligibility / Program Rule Change', 'Change program rules such as eligibility, missing information handling, enrollment criteria, or determination logic.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Eligibility / Program Rule Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.37, 2.79, 3.55, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.29, 0.58, 0.74, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.19, 2.41, 3.07, 4.45, 9.04, 11.52);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.1, 4.26, 5.42, 2.34, 4.74, 6.05);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.89, 1.81, 2.3, 1.34, 2.71, 3.46);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.74, 1.51, 1.92, 0.74, 1.51, 1.92);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.15, 0.3, 0.38, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.32, 0.64, 0.82, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.47, 0.96, 1.22, 0.0, 0.0, 0.0);

  -- SubFeature: Modify Existing Workflow
  -- Small=11.75  Med=80  Large=102.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Modify Existing Workflow', 'Change an existing business workflow, process step, case handling path, or operational flow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Modify Existing Workflow');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.08, 7.37, 9.44, 0.06, 0.42, 0.54);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.23, 1.57, 2.01, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.05, 7.12, 9.13, 3.71, 25.24, 32.34);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.61, 4.16, 5.33, 1.86, 12.69, 16.26);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.54, 3.7, 4.74, 1.2, 8.18, 10.48);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.4, 2.75, 3.52, 0.49, 3.35, 4.29);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.09, 0.6, 0.77, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.14, 0.99, 1.26, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.27, 1.85, 2.37, 0.0, 0.0, 0.0);

  -- SubFeature: New Case Type / Service Flow
  -- Small=69.625  Med=107.75  Large=972.75 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New Case Type / Service Flow', 'Create a new case type, workflow, service flow, or major operational path in CRM.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New Case Type / Service Flow');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    9.93, 15.36, 138.69, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.18, 3.37, 30.44, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    24.71, 38.25, 345.28, 0.67, 1.04, 9.37);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    15.19, 23.5, 212.19, 0.67, 1.04, 9.37);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.69, 7.26, 65.57, 0.45, 0.69, 6.24);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.51, 11.62, 104.86, 0.17, 0.26, 2.34);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.17, 1.56, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.46, 3.8, 34.35, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.89, 1.38, 12.49, 0.0, 0.0, 0.0);

  -- SubFeature: Queue, Role, or Operational Setup
  -- Small=22  Med=84  Large=120 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Queue, Role, or Operational Setup', 'Set up or change operational queues, routing ownership, user roles, access, or support setup tied to program operations.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Queue, Role, or Operational Setup');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.24, 12.36, 17.66, 0.1, 0.38, 0.55);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.03, 3.92, 5.6, 0.3, 1.15, 1.64);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.83, 18.45, 26.36, 3.18, 12.14, 17.35);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.24, 12.36, 17.66, 2.88, 11.0, 15.71);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.55, 2.1, 3.01, 0.85, 3.25, 4.64);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.53, 2.01, 2.87, 0.53, 2.01, 2.87);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.05, 0.19, 0.27, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.45, 1.72, 2.46, 0.1, 0.38, 0.55);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.15, 0.57, 0.82, 0.0, 0.0, 0.0);

  -- SubFeature: FRM Communities Change
  -- Small=53.25  Med=101  Large=299.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'FRM Communities Change', 'Add or modify FRM Communities capability, access, reporting, or workflow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('FRM Communities Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.5, 10.43, 30.93, 0.16, 0.3, 0.88);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.73, 3.28, 9.73, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.58, 20.06, 59.5, 14.26, 27.04, 80.18);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.38, 6.41, 19.01, 7.4, 14.03, 41.61);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.7, 3.23, 9.59, 4.28, 8.11, 24.06);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.11, 2.11, 6.24, 1.49, 2.82, 8.37);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.01, 0.02, 0.07, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.76, 1.44, 4.26, 0.16, 0.3, 0.88);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.74, 1.41, 4.19, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Communications  (Team: Patient Connections)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('Patient Connections');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Communications', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Communications');

  -- SubFeature: Add New Letter / Document Template
  -- Small=19.25  Med=25  Large=44.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Add New Letter / Document Template', 'Create a new client-approved letter, fax template, email template, document, or communication artifact.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Add New Letter / Document Template');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.47, 3.2, 5.7, 0.19, 0.25, 0.45);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.67, 2.17, 3.86, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.24, 2.91, 5.18, 3.74, 4.85, 8.64);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.84, 2.39, 4.25, 2.29, 2.97, 5.28);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.3, 0.39, 0.7, 1.78, 2.31, 4.12);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.38, 1.8, 3.2, 0.52, 0.68, 1.21);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.15, 0.2, 0.35, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.22, 0.29, 0.51, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.46, 0.59, 1.05, 0.0, 0.0, 0.0);

  -- SubFeature: Fax Blast
  -- Small=61.75  Med=82  Large=128.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Fax Blast', 'Send a client-approved communication to a targeted provider or patient population using fax-blast style processing.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Fax Blast');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.62, 8.79, 13.74, 0.2, 0.26, 0.41);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.36, 1.81, 2.83, 0.07, 0.09, 0.14);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.3, 11.02, 17.23, 20.26, 26.9, 42.07);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.14, 4.17, 6.52, 9.5, 12.62, 19.73);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.39, 1.85, 2.89, 4.41, 5.85, 9.16);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.66, 3.53, 5.52, 1.89, 2.51, 3.93);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.36, 0.48, 0.74, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.57, 0.76, 1.18, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.04, 1.39, 2.17, 0.0, 0.0, 0.0);

  -- SubFeature: Mailroom / Physical Mailing Setup
  -- Small=107  Med=107  Large=107 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Mailroom / Physical Mailing Setup', 'Support physical mail workflows, mailing inserts, or mailroom-specific communication needs.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Mailroom / Physical Mailing Setup');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.0, 13.0, 13.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.0, 13.0, 13.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.0, 8.0, 8.0, 40.0, 40.0, 40.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 20.0, 20.0, 20.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.0, 8.0, 8.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.0, 1.0, 1.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.0, 1.0, 1.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.0, 3.0, 3.0, 0.0, 0.0, 0.0);

  -- SubFeature: Update Existing Letter / Document Template
  -- Small=13  Med=22  Large=103 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Update Existing Letter / Document Template', 'Update approved content, phone/fax numbers, branding, variables, or language in an existing communication artifact.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Update Existing Letter / Document Template');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.43, 2.42, 11.32, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.46, 0.78, 3.64, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.87, 1.48, 6.91, 3.14, 5.31, 24.88);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.23, 2.09, 9.77, 2.19, 3.7, 17.34);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.49, 0.83, 3.9, 0.95, 1.6, 7.49);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.76, 1.28, 6.01, 0.57, 0.97, 4.52);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.18, 0.3, 1.42, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.22, 0.37, 1.72, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.51, 0.87, 4.08, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Data Exchange & Integration  (Team: Data Hub)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('Data Hub');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Data Exchange & Integration', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Data Exchange & Integration');

  -- SubFeature: API Mapping / Message Change
  -- Small=151.5  Med=232  Large=337.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'API Mapping / Message Change', 'Modify an existing API message, payload, mapping, status code, or integration behavior.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('API Mapping / Message Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    16.63, 25.47, 37.05, 0.4, 0.62, 0.9);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.69, 2.59, 3.76, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    36.44, 55.81, 81.18, 21.52, 32.95, 47.94);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    22.46, 34.4, 50.04, 13.39, 20.51, 29.84);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    17.38, 26.61, 38.71, 6.23, 9.55, 13.89);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.8, 11.95, 17.38, 2.78, 4.25, 6.18);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.32, 0.49, 0.72, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.14, 4.8, 6.99, 0.32, 0.49, 0.72);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.99, 1.51, 2.2, 0.0, 0.0, 0.0);

  -- SubFeature: CAPII / S3 Integration
  -- Small=86.75  Med=128  Large=566.75 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'CAPII / S3 Integration', 'Create or modify CAPII/S3 file or integration capability.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('CAPII / S3 Integration');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.81, 13.0, 57.56, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.6, 0.89, 3.94, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    21.63, 31.91, 141.28, 8.93, 13.18, 58.37);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    16.68, 24.61, 108.97, 4.96, 7.32, 32.43);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.61, 20.09, 88.94, 2.55, 3.77, 16.68);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.33, 4.92, 21.77, 1.99, 2.93, 12.97);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.04, 0.05, 0.23, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.09, 3.09, 13.66, 1.42, 2.09, 9.26);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.16, 0.69, 0.0, 0.0, 0.0);

  -- SubFeature: Kafka Integration
  -- Small=288.2  Med=379.75  Large=554.625 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Kafka Integration', 'Create or modify Kafka integration patterns or related message exchange.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Kafka Integration');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    33.81, 44.55, 65.06, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.18, 1.55, 2.27, 2.69, 3.55, 5.18);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    88.62, 116.76, 170.54, 35.41, 46.65, 68.14);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    33.3, 43.88, 64.09, 32.3, 42.55, 62.15);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    25.34, 33.39, 48.77, 12.11, 15.96, 23.31);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.72, 14.13, 20.63, 6.28, 8.27, 12.08);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.44, 7.17, 10.47, 0.9, 1.18, 1.73);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.15, 0.22, 0.0, 0.0, 0.0);

  -- SubFeature: Modify Existing Data Feed
  -- Small=56  Med=116.5  Large=279.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Modify Existing Data Feed', 'Add, remove, or change fields, mappings, formats, statuses, or logic in an existing data feed.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Modify Existing Data Feed');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.17, 12.84, 30.77, 0.29, 0.6, 1.45);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.11, 2.31, 5.54, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.54, 24.01, 57.54, 7.81, 16.26, 38.97);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.57, 15.75, 37.76, 5.91, 12.3, 29.48);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.11, 12.7, 30.45, 3.39, 7.05, 16.9);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.23, 4.65, 11.14, 1.88, 3.92, 9.39);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.23, 0.54, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.31, 2.73, 6.54, 0.1, 0.21, 0.51);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.45, 0.94, 2.27, 0.0, 0.0, 0.0);

  -- SubFeature: New API / Integration
  -- Small=73.25  Med=196  Large=555 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New API / Integration', 'Create a new API, real-time integration, near-real-time integration, scheduled API, or external system connection.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New API / Integration');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.67, 17.85, 50.55, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.69, 7.19, 20.35, 0.99, 2.65, 7.51);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    21.28, 56.93, 161.21, 11.49, 30.73, 87.02);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.91, 15.81, 44.76, 7.15, 19.12, 54.15);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.37, 14.37, 40.69, 1.49, 3.98, 11.27);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.69, 7.19, 20.35, 3.02, 8.07, 22.85);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.04, 0.11, 0.31, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.61, 4.31, 12.21, 1.65, 4.42, 12.52);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.22, 3.26, 9.23, 0.0, 0.0, 0.0);

  -- SubFeature: New Data Feed
  -- Small=53  Med=53  Large=53 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New Data Feed', 'Create a new inbound or outbound file-based exchange, including source/target mapping and delivery setup.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New Data Feed');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.5, 3.5, 3.5, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.5, 7.5, 7.5, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.0, 4.0, 4.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.0, 12.0, 12.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.0, 8.0, 8.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.0, 8.0, 8.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.0, 2.0, 2.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.0, 2.0, 2.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.0, 6.0, 6.0, 0.0, 0.0, 0.0);

  -- SubFeature: ORTF / Open Refill Transfer File Change
  -- Small=26.5  Med=37  Large=353.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'ORTF / Open Refill Transfer File Change', 'Create or modify ORTF-related refill transfer file functionality.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('ORTF / Open Refill Transfer File Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.7, 5.17, 49.38, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.18, 0.26, 2.44, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    18.84, 26.3, 251.31, 0.44, 0.61, 5.87);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.02, 2.81, 26.89, 0.22, 0.31, 2.93);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.07, 0.1, 0.98, 0.44, 0.61, 5.87);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.44, 0.61, 5.87, 0.15, 0.2, 1.96);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: SFTP Setup / Secure File Transfer
  -- Small=27.25  Med=381  Large=1082 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'SFTP Setup / Secure File Transfer', 'Create or modify secure file transfer connectivity, delivery destination, encryption, or file delivery setup.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('SFTP Setup / Secure File Transfer');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.42, 61.76, 175.39, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.95, 13.25, 37.64, 0.03, 0.46, 1.29);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    9.46, 132.26, 375.61, 2.19, 30.67, 87.09);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.35, 46.78, 132.86, 2.15, 30.11, 85.51);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.26, 17.68, 50.22, 1.16, 16.23, 46.09);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.88, 12.33, 35.01, 0.37, 5.13, 14.56);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.03, 0.37, 1.05, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.69, 9.64, 27.37, 0.18, 2.51, 7.12);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.13, 1.82, 5.18, 0.0, 0.0, 0.0);

  -- SubFeature: Program Transition / Migration
  -- Small=277  Med=520.5  Large=1979.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Program Transition / Migration', 'Move a program, service, data set, or workflow from one operating model or system to another.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Program Transition / Migration');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    40.59, 76.27, 290.02, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.08, 22.7, 86.32, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    47.09, 88.49, 336.48, 48.97, 92.02, 349.9);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    28.75, 54.03, 205.44, 31.78, 59.72, 227.09);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.05, 24.51, 93.21, 25.05, 47.07, 178.98);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.62, 25.6, 97.34, 4.43, 8.32, 31.65);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.22, 0.42, 1.6, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.53, 12.27, 46.67, 2.47, 4.64, 17.63);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.37, 4.45, 16.92, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Digital Experiences  (Team: Full Stack Portals)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('Full Stack Portals');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Digital Experiences', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Digital Experiences');

  -- SubFeature: Patient Portal Change
  -- Small=114.875  Med=173.75  Large=244.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Patient Portal Change', 'Add or modify patient-facing portal capability, display logic, workflow, or configurable messaging.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Patient Portal Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    18.26, 27.61, 38.81, 0.85, 1.28, 1.8);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.21, 0.32, 0.45, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    24.23, 36.65, 51.53, 20.42, 30.89, 43.43);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.43, 17.29, 24.3, 20.42, 30.89, 43.43);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.56, 8.4, 11.81, 7.46, 11.28, 15.86);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.23, 6.4, 9.0, 1.8, 2.72, 3.83);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: Pharmacy Portal / Refill Portal Change
  -- Small=57  Med=76  Large=154 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Pharmacy Portal / Refill Portal Change', 'Add or modify pharmacy portal, refill portal, refill automation, or patient refill experience.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Pharmacy Portal / Refill Portal Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.73, 11.64, 23.59, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.24, 10.98, 22.25, 12.52, 16.69, 33.83);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.93, 7.91, 16.02, 4.61, 6.15, 12.46);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.37, 15.16, 30.71, 0.99, 1.32, 2.67);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.64, 3.51, 7.12, 0.66, 0.88, 1.78);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.32, 1.76, 3.56, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: Product Ordering Portal Change
  -- Small=134.25  Med=181.3  Large=375.625 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Product Ordering Portal Change', 'Add or modify product ordering portal capability.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Product Ordering Portal Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    32.08, 43.33, 89.77, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.75, 15.86, 32.87, 34.78, 46.97, 97.31);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.97, 10.76, 22.29, 23.44, 31.66, 65.59);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.29, 7.14, 14.79, 6.15, 8.31, 17.22);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.62, 6.24, 12.92, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.17, 11.04, 22.86, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: Provider Portal / CP360 Change
  -- Small=1005.15  Med=1681.35  Large=2609.75 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Provider Portal / CP360 Change', 'Add or modify provider-facing portal capability, display logic, forms, or workflow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Provider Portal / CP360 Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    203.39, 340.22, 528.08, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.14, 3.59, 5.57, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    88.15, 147.45, 228.86, 259.5, 434.08, 673.76);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    70.93, 118.64, 184.15, 205.31, 343.42, 533.05);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    31.55, 52.78, 81.92, 104.14, 174.2, 270.39);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    32.18, 53.83, 83.55, 3.12, 5.22, 8.1);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.52, 0.87, 1.35, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.78, 1.3, 2.02, 2.08, 3.48, 5.4);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.36, 2.28, 3.54, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Patient Access & Enrollment  (Team: Full Stack Portals)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('Full Stack Portals');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Patient Access & Enrollment', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Patient Access & Enrollment');

  -- SubFeature: Benefit Source / eBV / ePA Change
  -- Small=72.25  Med=190  Large=407.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Benefit Source / eBV / ePA Change', 'Add or modify eBV/ePA, Benefit Source, coverage, or prior authorization related support capability.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Benefit Source / eBV / ePA Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.95, 20.92, 44.86, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.15, 8.28, 17.75, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    14.13, 37.15, 79.67, 8.66, 22.78, 48.86);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.98, 23.63, 50.67, 7.71, 20.29, 43.51);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.78, 12.58, 26.97, 5.94, 15.62, 33.51);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.42, 11.62, 24.92, 1.61, 4.23, 9.08);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.06, 0.15, 0.32, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.51, 9.22, 19.78, 0.77, 2.02, 4.32);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.58, 1.52, 3.27, 0.0, 0.0, 0.0);

  -- SubFeature: DEP - HCP and Patient Enrollment
  -- Small=43.2  Med=230  Large=463 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'DEP - HCP and Patient Enrollment', 'Implement or modify DEP workflows involving HCP enrollment and patient completion/consent.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('DEP - HCP and Patient Enrollment');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.2, 33.01, 66.45, 0.17, 0.91, 1.83);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.22, 6.48, 13.05, 0.11, 0.57, 1.14);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.15, 38.09, 76.68, 8.65, 46.03, 92.66);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.06, 21.64, 43.56, 6.49, 34.57, 69.59);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.27, 12.07, 24.29, 3.46, 18.4, 37.04);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.84, 9.82, 19.77, 0.62, 3.29, 6.63);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.02, 0.09, 0.17, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.7, 3.75, 7.55, 0.12, 0.62, 1.26);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.12, 0.66, 1.33, 0.0, 0.0, 0.0);

  -- SubFeature: DEP - Patient Consent Only
  -- Small=518  Med=518  Large=518 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'DEP - Patient Consent Only', 'Implement or modify DEP flow focused on patient consent-only workflow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('DEP - Patient Consent Only');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    150.0, 150.0, 150.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    32.5, 32.5, 32.5, 97.5, 97.5, 97.5);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    40.5, 40.5, 40.5, 137.5, 137.5, 137.5);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.0, 10.0, 10.0, 38.0, 38.0, 38.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.0, 12.0, 12.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: DEP Add-On / Label / Auth / Cookie / Pendo
  -- Small=146  Med=146  Large=227 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'DEP Add-On / Label / Auth / Cookie / Pendo', 'Add or modify DEP-specific supporting components such as labels, extra authorization, cookie banner, Pendo, or CS support.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('DEP Add-On / Label / Auth / Cookie / Pendo');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    20.81, 20.81, 32.35, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.13, 8.13, 12.64, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    32.23, 32.23, 50.11, 16.65, 16.65, 25.88);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.38, 13.38, 20.8, 22.21, 22.21, 34.54);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.8, 6.8, 10.57, 12.94, 12.94, 20.13);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.24, 6.24, 9.71, 1.5, 1.5, 2.33);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.1, 0.1, 0.15, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.78, 2.78, 4.33, 0.48, 0.48, 0.75);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.74, 1.74, 2.71, 0.0, 0.0, 0.0);

  -- SubFeature: eConsent Change
  -- Small=15.5  Med=21.75  Large=66.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'eConsent Change', 'Add or modify patient eConsent capabilities, consent capture, or consent-enabled workflows.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('eConsent Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.43, 3.41, 10.42, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.05, 0.07, 0.2, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.89, 2.66, 8.12, 3.88, 5.45, 16.65);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.36, 1.9, 5.82, 2.84, 3.99, 12.18);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.72, 1.01, 3.08, 1.35, 1.89, 5.79);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.83, 1.16, 3.55, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.03, 0.04, 0.14, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.03, 0.04, 0.14, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.09, 0.13, 0.41, 0.0, 0.0, 0.0);

  -- SubFeature: eRx Setup / Change
  -- Small=101.5  Med=188.5  Large=305.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'eRx Setup / Change', 'Add or modify eRx setup, NDC configuration, implied consent behavior, or eRx-driven workflow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('eRx Setup / Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.85, 22.0, 35.63, 0.5, 0.94, 1.52);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.86, 3.46, 5.6, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    21.18, 39.33, 63.69, 17.42, 32.35, 52.38);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.17, 22.61, 36.61, 9.79, 18.18, 29.44);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    9.29, 17.26, 27.94, 6.06, 11.25, 18.21);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.55, 8.45, 13.69, 2.66, 4.95, 8.01);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.05, 0.1, 0.16, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.21, 4.11, 6.66, 1.22, 2.27, 3.68);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.67, 1.25, 2.03, 0.0, 0.0, 0.0);

  -- SubFeature: MEP Change
  -- Small=86.5  Med=128  Large=164.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'MEP Change', 'Add or modify Multi Enrollment Portal capability or enrollment flow.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('MEP Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.64, 15.74, 20.23, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.21, 12.15, 15.61, 23.24, 34.4, 44.2);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.59, 9.75, 12.54, 19.77, 29.26, 37.61);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.41, 5.05, 6.49, 11.16, 16.51, 21.22);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.47, 5.13, 6.6, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Patient Messaging  (Team: Patient Connections)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('Patient Connections');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Patient Messaging', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Patient Messaging');

  -- SubFeature: Consent / Authorization Messaging
  -- Small=3656.6  Med=3656.6  Large=3656.6 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Consent / Authorization Messaging', 'Support consent, authorization, or patient action messaging tied to enrollment or access workflows.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Consent / Authorization Messaging');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    471.8, 471.8, 471.8, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    130.0, 130.0, 130.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    293.0, 293.0, 293.0, 975.0, 975.0, 975.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    274.0, 274.0, 274.0, 906.0, 906.0, 906.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    131.5, 131.5, 131.5, 362.5, 362.5, 362.5);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    104.8, 104.8, 104.8, 8.0, 8.0, 8.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: Patient Email Messaging Change
  -- Small=37  Med=80  Large=90.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Patient Email Messaging Change', 'Add or modify patient-facing email content, triggers, or communication behavior.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Patient Email Messaging Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.96, 6.39, 7.23, 0.94, 2.03, 2.3);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.4, 0.87, 0.99, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.22, 6.97, 7.89, 9.34, 20.19, 22.84);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.72, 5.88, 6.66, 4.74, 10.24, 11.58);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.64, 10.02, 11.34, 3.56, 7.7, 8.71);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.37, 0.8, 0.9, 3.63, 7.84, 8.87);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.03, 0.07, 0.08, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.29, 0.62, 0.7, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.17, 0.36, 0.41, 0.0, 0.0, 0.0);

  -- SubFeature: Patient SMS Messaging Change
  -- Small=128  Med=167  Large=244.75 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Patient SMS Messaging Change', 'Add or modify patient-facing SMS content, triggers, or communication behavior.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Patient SMS Messaging Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.02, 13.08, 19.17, 1.66, 2.16, 3.17);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.83, 1.08, 1.58, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    19.39, 25.29, 37.07, 42.75, 55.77, 81.74);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.07, 4.0, 5.86, 15.91, 20.75, 30.42);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.47, 7.13, 10.46, 15.33, 20.0, 29.31);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.58, 0.76, 1.11, 9.61, 12.54, 18.38);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.08, 0.11, 0.16, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.83, 1.08, 1.58, 2.15, 2.81, 4.12);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.33, 0.43, 0.63, 0.0, 0.0, 0.0);

  -- SubFeature: Pharmacy Texting Change
  -- Small=80  Med=158  Large=257 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Pharmacy Texting Change', 'Add or modify pharmacy texting content, categories, or messaging behavior.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Pharmacy Texting Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.62, 17.02, 27.69, 0.4, 0.79, 1.29);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.2, 0.4, 0.64, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.75, 27.16, 44.18, 13.84, 27.33, 44.46);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.51, 14.83, 24.12, 11.19, 22.1, 35.94);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.97, 13.77, 22.4, 9.2, 18.17, 29.55);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.66, 3.28, 5.33, 4.58, 9.04, 14.7);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.23, 0.37, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.38, 2.73, 4.44, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.59, 1.17, 1.9, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Program Lifecycle  (Team: CS Configuration)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('CS Configuration');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Program Lifecycle', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Program Lifecycle');

  -- SubFeature: Client CRM Transition
  -- Small=48  Med=56  Large=152 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Client CRM Transition', 'Transition functionality, data, reporting, or access from Sonexus-managed CRM workflows to a client or alternate CRM model.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Client CRM Transition');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.16, 4.85, 13.18, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.21, 1.41, 3.82, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.89, 3.38, 9.17, 10.13, 11.82, 32.08);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.01, 12.84, 34.85, 6.21, 7.25, 19.67);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.6, 0.7, 1.91, 3.14, 3.66, 9.93);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.95, 3.45, 9.36, 1.09, 1.27, 3.44);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.72, 0.84, 2.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.39, 1.62, 4.39, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.5, 2.92, 7.92, 0.0, 0.0, 0.0);

  -- SubFeature: New Product / NDC Setup
  -- Small=26  Med=71.5  Large=191.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New Product / NDC Setup', 'Add a new product, NDC, indication, or product-family setup that impacts program configuration and downstream logic.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New Product / NDC Setup');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.46, 9.51, 25.45, 0.11, 0.3, 0.82);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.05, 2.88, 7.71, 0.04, 0.11, 0.29);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.8, 10.45, 27.94, 3.25, 8.94, 23.91);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.23, 8.88, 23.75, 3.65, 10.04, 26.86);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.04, 5.62, 15.04, 2.19, 6.02, 16.09);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.33, 3.66, 9.8, 0.53, 1.45, 3.88);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.13, 0.36, 0.96, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.7, 1.93, 5.15, 0.02, 0.06, 0.17);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.47, 1.29, 3.44, 0.0, 0.0, 0.0);

  -- SubFeature: New Program / Service Launch
  -- Small=39  Med=40  Large=129.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New Program / Service Launch', 'Launch a new client program or materially new service package requiring multiple technology components.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New Program / Service Launch');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.23, 2.29, 7.41, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.1, 2.15, 6.98, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.46, 4.58, 14.82, 3.15, 3.23, 10.46);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.34, 12.66, 40.99, 2.1, 2.15, 6.98);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.88, 8.08, 26.16, 1.05, 1.08, 3.49);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.49, 2.56, 8.28, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.13, 0.13, 0.44, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.66, 0.67, 2.18, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.39, 0.4, 1.31, 0.0, 0.0, 0.0);

  -- SubFeature: Program Decommission / Sunset
  -- Small=94.25  Med=192  Large=362.45 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Program Decommission / Sunset', 'Retire an existing program, service, channel, or technology component while preserving required reporting or support needs.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Program Decommission / Sunset');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    11.34, 23.11, 43.63, 0.45, 0.92, 1.73);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.22, 10.64, 20.09, 0.6, 1.22, 2.3);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    18.87, 38.45, 72.59, 11.14, 22.69, 42.83);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.63, 21.65, 40.88, 9.13, 18.59, 35.09);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.13, 14.53, 27.42, 4.54, 9.26, 17.48);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.96, 14.17, 26.75, 3.02, 6.15, 11.62);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.62, 1.27, 2.4, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.0, 4.08, 7.71, 0.52, 1.07, 2.02);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.06, 4.2, 7.92, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Reporting & Analytics  (Team: OSP and DWH)
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('OSP and DWH');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Reporting & Analytics', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Reporting & Analytics');

  -- SubFeature: Data Warehouse / ETL Change
  -- Small=64.25  Med=99.5  Large=111.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Data Warehouse / ETL Change', 'Modify data sync, ETL, warehouse logic, transformations, or data availability for reporting.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Data Warehouse / ETL Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.09, 18.72, 20.98, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.4, 0.62, 0.69, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.0, 20.14, 22.57, 13.0, 20.14, 22.57);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.02, 6.23, 6.98, 9.81, 15.19, 17.03);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.21, 4.97, 5.57, 5.34, 8.27, 9.26);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.96, 3.04, 3.41, 0.67, 1.03, 1.15);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.13, 0.21, 0.23, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.2, 0.31, 0.35, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.42, 0.64, 0.72, 0.0, 0.0, 0.0);

  -- SubFeature: Modify Existing Report / Dashboard
  -- Small=79  Med=119  Large=221 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Modify Existing Report / Dashboard', 'Change fields, calculations, filters, metrics, visuals, or delivery logic in an existing report/dashboard.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Modify Existing Report / Dashboard');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.89, 11.88, 22.07, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.16, 0.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    24.83, 37.4, 69.45, 10.1, 15.21, 28.25);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.05, 4.6, 8.53, 10.52, 15.85, 29.43);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.68, 2.54, 4.71, 13.04, 19.65, 36.49);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.21, 3.33, 6.18, 5.05, 7.61, 14.13);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.16, 0.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.11, 0.16, 0.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.32, 0.48, 0.88, 0.0, 0.0, 0.0);

  -- SubFeature: New Report / Dashboard
  -- Small=87  Med=88  Large=926 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New Report / Dashboard', 'Create a new report, dashboard, extract, KPI view, or analytics output.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New Report / Dashboard');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    13.67, 13.82, 145.47, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.01, 3.04, 32.03, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    22.07, 22.32, 234.87, 6.6, 6.68, 70.24);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    15.48, 15.65, 164.73, 2.66, 2.69, 28.34);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    8.38, 8.48, 89.2, 1.72, 1.74, 18.36);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.42, 7.51, 79.02, 0.75, 0.76, 7.98);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.07, 0.08, 0.8, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.42, 4.48, 47.09, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.74, 0.75, 7.88, 0.0, 0.0, 0.0);

  -- SubFeature: OSP Enhancement
  -- Small=88  Med=163  Large=782.25 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'OSP Enhancement', 'Add or modify One Source Portal reporting, views, dashboards, or portal analytics.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('OSP Enhancement');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    10.59, 19.61, 94.13, 0.1, 0.18, 0.88);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.31, 7.98, 38.31, 0.34, 0.63, 3.01);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    23.24, 43.05, 206.58, 6.76, 12.52, 60.08);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    12.81, 23.72, 113.84, 6.19, 11.46, 55.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    7.26, 13.46, 64.58, 4.01, 7.43, 35.65);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.42, 10.05, 48.21, 1.03, 1.92, 9.19);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.09, 0.17, 0.8, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.14, 7.68, 36.83, 0.74, 1.36, 6.54);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.97, 1.8, 8.62, 0.0, 0.0, 0.0);

  -- SubFeature: Speech Analytics Change
  -- Small=20.5  Med=52  Large=302.125 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Speech Analytics Change', 'Create or modify speech analytics reporting or related analysis outputs.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Speech Analytics Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.2, 8.12, 47.17, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.83, 4.64, 26.93, 0.45, 1.15, 6.7);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.81, 7.13, 41.45, 3.66, 9.3, 54.01);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.75, 1.9, 11.02, 2.15, 5.45, 31.68);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.38, 0.97, 5.65, 1.41, 3.57, 20.72);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.97, 2.45, 14.23, 0.91, 2.31, 13.4);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.04, 0.1, 0.56, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.67, 1.71, 9.91, 0.61, 1.54, 8.93);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.66, 1.68, 9.77, 0.0, 0.0, 0.0);

  -- SubFeature: SSRS Report Change
  -- Small=2260  Med=2260  Large=2260 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'SSRS Report Change', 'Create or modify an SSRS report or related report output.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('SSRS Report Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    342.0, 342.0, 342.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    57.0, 57.0, 57.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    456.0, 456.0, 456.0, 270.0, 270.0, 270.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    387.5, 387.5, 387.5, 221.0, 221.0, 221.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    213.7, 213.7, 213.7, 113.3, 113.3, 113.3);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    103.0, 103.0, 103.0, 40.0, 40.0, 40.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.0, 2.0, 2.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    29.0, 29.0, 29.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    19.0, 19.0, 19.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    6.5, 6.5, 6.5, 0.0, 0.0, 0.0);

  -- =========================================================================
  -- Container: Telephony & Faxing  (Team: Telecomm (EIT))
  -- =========================================================================
  SELECT id INTO v_team_id FROM teams WHERE LOWER(name) = LOWER('Telecomm (EIT)');

  INSERT INTO products (name, description, mode, active, team_id, created_by, updated_by)
  VALUES ('Telephony & Faxing', NULL, 'CONTAINER', true, v_team_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_product_id FROM products WHERE LOWER(name) = LOWER('Telephony & Faxing');

  -- SubFeature: Genesys Queue / Skill Change
  -- Small=8.25  Med=9.5  Large=10.75 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'Genesys Queue / Skill Change', 'Add or modify Genesys skills, queues, call handling, or agent routing setup.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('Genesys Queue / Skill Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.87, 1.0, 1.13, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    4.34, 5.0, 5.66, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.43, 0.5, 0.57, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.87, 1.0, 1.13, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.3, 1.5, 1.7, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.43, 0.5, 0.57, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: IVR Call Flow / Routing Change
  -- Small=12  Med=25  Large=86.625 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'IVR Call Flow / Routing Change', 'Modify call tree, routing, queue path, skills, or IVR behavior.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('IVR Call Flow / Routing Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.83, 3.82, 13.23, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.99, 2.07, 7.16, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.39, 4.98, 17.27, 1.39, 2.9, 10.05);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.34, 2.79, 9.68, 0.99, 2.07, 7.16);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.66, 1.38, 4.77, 0.63, 1.32, 4.58);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.82, 1.7, 5.9, 0.16, 0.33, 1.13);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.04, 0.09, 0.31, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.55, 1.15, 3.99, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.19, 0.4, 1.4, 0.0, 0.0, 0.0);

  -- SubFeature: IVR Recording Change
  -- Small=15  Med=17  Large=18.5 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'IVR Recording Change', 'Update IVR recordings, verbiage, prompts, or audio content.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('IVR Recording Change');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.73, 3.09, 3.36, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.45, 0.52, 0.56, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    3.41, 3.86, 4.2, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.91, 1.03, 1.12, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    2.05, 2.32, 2.52, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    5.0, 5.67, 6.17, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.45, 0.52, 0.56, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  -- SubFeature: New / Transfer Phone Number or TFN
  -- Small=5.875  Med=7  Large=8.75 hrs (blended)
  INSERT INTO sub_features (product_id, name, description, active, created_by, updated_by)
  VALUES (v_product_id, 'New / Transfer Phone Number or TFN', 'Set up, transfer ownership, or modify toll-free / local number usage.', true, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sub_feature_id FROM sub_features
    WHERE product_id = v_product_id AND LOWER(name) = LOWER('New / Transfer Phone Number or TFN');

  INSERT INTO estimate_templates (sub_feature_id, version_number, is_active, created_by)
  VALUES (v_sub_feature_id, 1, true, v_admin_id);
  v_template_id := currval('estimate_templates_id_seq');

  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Analysis');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.87, 1.03, 1.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Configuration');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.58, 0.69, 0.86, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Development');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    1.16, 1.38, 1.72, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Testing');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.87, 1.03, 1.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('UAT');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.87, 1.03, 1.29, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Deployment');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.77, 0.92, 1.15, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Release Management');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Hypercare');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.77, 0.92, 1.15, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Monitoring');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  SELECT id INTO v_phase_id FROM sdlc_phases WHERE LOWER(name) = LOWER('Admin Activity');
  INSERT INTO estimate_template_lines (template_id, sdlc_phase_id,
    onshore_low, onshore_med, onshore_high, offshore_low, offshore_med, offshore_high)
  VALUES (v_template_id, v_phase_id,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

END $$;
