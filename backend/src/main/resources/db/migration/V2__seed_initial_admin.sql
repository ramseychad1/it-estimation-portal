-- =========================================================================
-- V2 — seed roles + initial admin user
--
-- DEV ONLY. The admin password is "ChangeMe123!" — must be replaced before
-- any non-local environment.
--
-- Pinned ID: admin user gets id = 1 so application code can reference it
-- without a lookup. We bump the BIGSERIAL sequence past 1 at the end so
-- subsequent INSERTs (like the V5 estimator user) don't collide.
-- =========================================================================

INSERT INTO roles (id, name) VALUES
    (1, 'Admin'),
    (2, 'Solution Owner'),
    (3, 'Estimator'),
    (4, 'Requester');

-- BCrypt cost-10 hash of "ChangeMe123!". Spring Security's BCryptPasswordEncoder
-- accepts the $2y$ prefix as well as $2a$ / $2b$.
INSERT INTO users (id, email, password_hash, first_name, last_name, active)
VALUES (
    1,
    'admin@local',
    '$2y$10$fU4GJlNxfwhhqwF4SyvHEeUCykO6hmKpDFweyNALpxnDi6WWeR8AW',
    'Local',
    'Admin',
    TRUE
);

INSERT INTO user_roles (user_id, role_id) VALUES (1, 1);

-- Move the BIGSERIAL sequence to 2 so the next inserted user doesn't collide
-- with the pinned admin id.
SELECT setval(pg_get_serial_sequence('users', 'id'), 1, TRUE);
