-- Test seed: roles + the admin user used in dev (BCrypt hash of "ChangeMe123!").
INSERT INTO roles (id, name) VALUES (1, 'Admin'), (2, 'Solution Owner'), (3, 'Estimator'), (4, 'Requester');

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

-- Estimator + Solution Owner test user (mirrors the V5 dev seed).
INSERT INTO users (id, email, password_hash, first_name, last_name, active)
VALUES (
    2,
    'estimator@local',
    '$2y$10$fU4GJlNxfwhhqwF4SyvHEeUCykO6hmKpDFweyNALpxnDi6WWeR8AW',
    'Local',
    'Estimator',
    TRUE
);

INSERT INTO user_roles (user_id, role_id) VALUES (2, 2), (2, 3);
