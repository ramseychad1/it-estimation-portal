#!/usr/bin/env bash
# Start the backend dev stack: Postgres (Docker) + Spring Boot.
# Run from the project root in its own terminal.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Bring up Postgres if it's not already running. Idempotent.
docker compose -f docker/docker-compose.yml up -d

# Wait for the DB to accept connections before Spring Boot tries to connect,
# otherwise Flyway can race the container's startup the first time.
echo "Waiting for Postgres to be ready..."
until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U estimator -d estimator_dev >/dev/null 2>&1; do
    sleep 0.5
done
echo "Postgres ready."

cd backend
exec ./mvnw spring-boot:run
