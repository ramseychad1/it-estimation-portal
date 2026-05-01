-- Test seed: roles + the same admin user used in dev (BCrypt hash of "ChangeMe123!").
INSERT INTO roles (id, name) VALUES (1, 'Admin'), (2, 'Solution Owner'), (3, 'Estimator'), (4, 'Requester');

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
