-- =========================================================================
-- V5 — seed a non-admin development user
--
-- DEV ONLY. Same BCrypt hash as admin@local for convenience; both passwords
-- are "ChangeMe123!". This user holds two roles (Solution Owner + Estimator)
-- so we can smoke-test:
--   * 403 from /api/admin/* (no Admin role)
--   * eventual access to /catalog/* once Phase 5 ships SO screens
--
-- README documents this user. Replace before any non-local environment.
-- =========================================================================

INSERT INTO users (id, email, password_hash, first_name, last_name, active)
VALUES (
    2,
    'estimator@local',
    '$2y$10$fU4GJlNxfwhhqwF4SyvHEeUCykO6hmKpDFweyNALpxnDi6WWeR8AW',
    'Local',
    'Estimator',
    TRUE
);

INSERT INTO user_roles (user_id, role_id) VALUES
    (2, 2),  -- Solution Owner
    (2, 3);  -- Estimator

-- Bump the sequence past the highest pinned id so future SERIAL inserts
-- don't collide.
SELECT setval(pg_get_serial_sequence('users', 'id'), 2, TRUE);
