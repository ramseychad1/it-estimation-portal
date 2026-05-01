-- H2 schema for tests. Mirrors the Postgres Flyway migrations but uses portable
-- syntax (PRIMARY KEY declared at the table level so H2 accepts column defaults).
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

CREATE TABLE users (
    id             UUID         NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pk PRIMARY KEY (id),
    CONSTRAINT users_email_uq UNIQUE (email)
);

CREATE TABLE roles (
    id     SMALLINT     NOT NULL,
    name   VARCHAR(64)  NOT NULL UNIQUE,
    CONSTRAINT roles_pk PRIMARY KEY (id)
);

CREATE TABLE user_roles (
    user_id  UUID     NOT NULL,
    role_id  SMALLINT NOT NULL,
    CONSTRAINT user_roles_pk PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT user_roles_role_fk FOREIGN KEY (role_id) REFERENCES roles (id)
);
