# IT Estimation Portal

Internal tool used by HealthCare Development Group, Inc. to produce work estimates for pre-defined products, features, and enhancements. Solution Owners maintain a versioned catalog; Estimators and Requesters consume it. Full audit trail on every change.

This repo currently contains **Phase 0 scaffolding only** — Postgres in Docker, an empty Spring Boot 3 backend, and an empty React + Vite + TS + Tailwind frontend. Auth, the app shell, and feature screens arrive in Phase 1+.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Spring Boot 3.3, Java 21, Maven |
| Database | PostgreSQL 16 (Docker) |
| Migrations | Flyway |
| Auth | Spring Security, form login + session cookies (Phase 1) |
| State | TanStack React Query + React Context |
| Tests | JUnit 5 + Spring Boot Test (backend) · Vitest + React Testing Library (frontend) |

No GraphQL, no JWT, no Redux, no Next.js, no UI component libraries beyond Tailwind primitives. The brand color discipline is documented in [`docs/COLOR_USAGE.md`](docs/COLOR_USAGE.md) — read it before building any UI.

---

## Prerequisites

- Java 21 (Homebrew: `brew install openjdk@21`)
- Node 20+ and npm
- Docker Desktop (or any Docker engine + Compose v2)

The backend uses the Maven Wrapper (`./mvnw`) — no local Maven install needed.

---

## One-command startup (three terminals)

```bash
# Terminal 1 — Postgres
docker compose -f docker/docker-compose.yml up -d

# Terminal 2 — backend (port 8080)
cd backend && ./mvnw spring-boot:run

# Terminal 3 — frontend (port 5173)
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The placeholder page renders the JSON returned by `GET /api/health`, which confirms the full stack is wired together.

---

## Running tests

```bash
# Backend
cd backend && ./mvnw test

# Frontend
cd frontend && npm test
```

---

## Resetting the database

The Postgres data volume is named `estimator_pgdata`. To wipe everything and start fresh:

```bash
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d
```

The next backend startup will re-run all Flyway migrations against a clean database.

---

## Dev credentials

The Postgres instance ships with `estimator` / `estimator` for ease of local development. **These are dev-only.** Production must use injected secrets — never commit real credentials.

Phase 1 adds a seeded admin user (`admin@local` / `ChangeMe123!`) that must also be replaced before any non-local environment.

---

## Repository layout

```
backend/                      Spring Boot project (Maven)
  src/main/java/com/acme/estimator/
    EstimatorApplication.java
    health/HealthController.java
    security/SecurityConfig.java
  src/main/resources/
    application.yml
    db/migration/             Flyway SQL migrations (Phase 1+)
  pom.xml
frontend/                     React + Vite + TS + Tailwind
  src/
    components/               Reusable UI (Phase 1+)
    pages/                    Route-level screens (Phase 1+)
    lib/api.ts                Typed fetch wrapper, talks to /api/*
    styles/tokens.css         Design tokens — single source of truth
    styles/index.css          Tailwind entry + base styles
    App.tsx                   Phase 0 placeholder; replaced in Phase 1
  tailwind.config.js
  vite.config.ts
docker/
  docker-compose.yml          Postgres only — backend & frontend run on host
docs/
  COLOR_USAGE.md              Brand color discipline (hard rule)
```

---

## Where the design tokens come from

`frontend/src/styles/tokens.css` is a verbatim port of `colors_and_type.css` from the Claude Design handoff bundle. The Tailwind config in `frontend/tailwind.config.js` mirrors those colors so both raw CSS (`var(--color-cardinal-red)`) and Tailwind utilities (`text-cardinal-red`) work. Do not duplicate or fork the palette — update `tokens.css` if a token genuinely needs to change.
