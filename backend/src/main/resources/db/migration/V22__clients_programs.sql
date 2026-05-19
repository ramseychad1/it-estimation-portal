-- V22: clients + programs tables; add client_id / program_id FKs to estimate_requests.

CREATE TABLE clients (
    id               BIGSERIAL    PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    point_of_contact VARCHAR(255) NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX clients_name_uq ON clients (lower(name)) WHERE active = TRUE;

CREATE TABLE programs (
    id         BIGSERIAL    PRIMARY KEY,
    client_id  BIGINT       NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
    name       VARCHAR(255) NOT NULL,
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Name unique per client (active only)
CREATE UNIQUE INDEX programs_name_per_client_uq ON programs (client_id, lower(name)) WHERE active = TRUE;

ALTER TABLE estimate_requests
    ADD COLUMN client_id  BIGINT REFERENCES clients  (id) ON DELETE RESTRICT,
    ADD COLUMN program_id BIGINT REFERENCES programs (id) ON DELETE RESTRICT;
