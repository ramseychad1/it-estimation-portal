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

-- H2 IDENTITY columns don't bump their sequence when an INSERT provides the
-- id explicitly, so subsequent JPA save() calls would collide on id=1. Push
-- the sequence past the highest seeded id.
ALTER TABLE users ALTER COLUMN id RESTART WITH 3;

-- V21: seed program_types and categories so integration tests can reference them.
INSERT INTO program_types (id, name, display_order) VALUES
    (1, 'APS Only',     1),
    (2, 'SHPS Only',    2),
    (3, 'APS+SHPS',     3),
    (4, 'APS+SHPS+3PL', 4),
    (5, 'Test Program', 5);
ALTER TABLE program_types ALTER COLUMN id RESTART WITH 6;

INSERT INTO categories (id, name, display_order) VALUES
    (1, 'RFP',                       1),
    (2, 'Implementation',            2),
    (3, 'Statement of Work (COGS)',  3),
    (4, 'Enhancement',               4),
    (5, 'Product',                   5),
    (6, 'IT Support',                6),
    (7, 'Test Category',             7);
ALTER TABLE categories ALTER COLUMN id RESTART WITH 8;

-- V22: seed clients and programs so integration tests can reference them.
INSERT INTO clients (id, name, point_of_contact, active) VALUES
    (1, 'Test Client', 'Test Contact', true),
    (2, 'Acme Corp',   'Jane Doe',     true);
ALTER TABLE clients ALTER COLUMN id RESTART WITH 3;

INSERT INTO programs (id, client_id, name, active) VALUES
    (1, 1, 'Test Program',   true),
    (2, 1, 'Test Program B', true),
    (3, 2, 'Acme Program',   true);
ALTER TABLE programs ALTER COLUMN id RESTART WITH 4;
