-- Phase 8: Wire Teams — user_teams join table + team_id FK on products

-- Users can belong to zero or more teams.
CREATE TABLE user_teams (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, team_id)
);
CREATE INDEX idx_user_teams_team_id ON user_teams(team_id);

-- Products belong to exactly one team (nullable for existing rows; enforced at service layer on create).
ALTER TABLE products
    ADD COLUMN team_id BIGINT REFERENCES teams(id) ON DELETE RESTRICT;
CREATE INDEX idx_products_team_id ON products(team_id);
