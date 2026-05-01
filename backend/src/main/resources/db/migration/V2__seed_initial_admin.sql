-- =========================================================================
-- V2 — seed roles + initial admin user
--
-- DEV ONLY. The admin password is "ChangeMe123!" — must be replaced before
-- any non-local environment. The email and hash here are not secrets in the
-- usual sense, but anyone who can read this file can sign in to a local DB.
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
    '00000000-0000-0000-0000-000000000001',
    'admin@local',
    '$2y$10$fU4GJlNxfwhhqwF4SyvHEeUCykO6hmKpDFweyNALpxnDi6WWeR8AW',
    'Local',
    'Admin',
    TRUE
);

INSERT INTO user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000001', 1);
