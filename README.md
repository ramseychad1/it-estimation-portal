# IT Estimation Portal

Internal tool used by HealthCare Development Group, Inc. to produce work estimates for pre-defined products, features, and enhancements. Solution Owners maintain a versioned catalog of Products, Sub-features, Critical Questions, and Estimate Templates; Admins configure Teams, SDLC Phases, blended rates, clients/programs, and users; Requesters submit multi-product estimate requests against the catalog; Solution Owners review, override, and approve each line item; and (when enabled) a Revenue Manager reviews pricing on fully-approved estimates. Every mutation lands in a full audit trail.

**Status:** In production. All core workflows are live — authentication, the full admin surface, the Solution Owner catalog and template editor, the multi-product Requester workflow, the per-item Reviewer workflow, the role-aware Dashboard, Team Workload reporting, the optional Revenue & Pricing Review workflow, and email notifications (SMTP / Resend / Gmail OAuth). The app deploys to Railway (backend, frontend/nginx, and Postgres as separate services).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Spring Boot 3.3, Java 21, Maven (wrapper) |
| Database | PostgreSQL 16 (Docker); H2 in PostgreSQL mode for backend tests |
| Migrations | Flyway (V1–V37) |
| Auth | Spring Security, form login + session cookies, CSRF via cookie + header |
| State | TanStack React Query + React Context (no global client store) |
| Email | Spring Mail — SMTP, Resend, or Gmail OAuth (admin-configurable) |
| Uploads | Multipart, stored in Postgres; Tika magic-byte content verification |
| Tests | JUnit 5 + Spring Boot Test (backend) · Vitest + React Testing Library (frontend) |

No GraphQL, no JWT, no Redux, no Next.js, no UI component libraries beyond Tailwind primitives. Brand-color discipline is documented in [`docs/COLOR_USAGE.md`](docs/COLOR_USAGE.md) — read it before building any UI.

**Roles:** Admin · Solution Owner · Estimator · Requester · Revenue Manager. Admin implies every other role at the authorization layer (not a data-write augmentation).

---

## What the system does

### Authentication & shell
BCrypt password hashing, session cookies, CSRF protection, login throttling (lockout after repeated failures), and a token-link password-reset flow (admin issues a copy/paste `/reset/:token` link — no plaintext passwords). App shell with role-aware sidebar, top bar with global search, user menu, and route guards that render an in-place no-access panel rather than redirecting.

### Admin surface
- **Teams**, **SDLC Phases**, **Program Types**, **Categories**, **Clients**, **Programs** — CRUD with active/inactive, history, and (where relevant) CSV export.
- **Blended Rates** — immutable per version; each save writes a new row and flips the previous to inactive. Read is open to Solution Owners; mutations stay Admin-only.
- **Client Pricing** — per-client pricing defaults and category overrides feeding the pricing model.
- **Users & Roles** — CRUD, multi-role assignment, team membership, last-admin protection, two-step delete with typed-name confirmation, CSV export.
- **Invitations** — token-based invite / revoke / resend; public `/invite/:token` accept page.
- **Change Log** — read-only audit feed, date-grouped with 2s audit-grouping window, filters (entity, action, actor, date), search, CSV export, and clickable entity links.
- **Global Settings** — enable/disable the Revenue & Pricing Review feature and email notifications; configure the email provider (SMTP / Resend / Gmail OAuth). Secret values are write-only and masked on read.

### Solution Owner catalog
- **Products** — atomic vs. container mode, locked at creation, each belonging to one Team.
- **Sub-features** — container products only, name-unique within parent.
- **Critical Questions** — attached to a Product or Sub-feature (XOR), drag-to-reorder, required/optional, with **typed answers** (long/short text, yes-no, single-select, number) plus optional document upload. A cross-catalog Questions browser supports search and inline editing.
- **Estimate Template editor** — one row per active SDLC phase × six hour cells (Onshore/Offshore L/M/H), with per-row Total Hrs/$ and Grand Total footer driven by the current blended rate. Version-on-save (each save = a new immutable template), full keyboard navigation, and spreadsheet TSV paste.

### Requester workflow
- **New request wizard** (`/requests/new`) — choose a **Catalog** or **Generic intake** request, set client/program/category/go-live-date, add one or more product line items, answer each item's Critical Questions with the matching typed input, then review and submit. Answers autosave; the review step explains anything still blocking submission.
- **Snapshot-on-submit** — template hours, phase name+order, and question text are copied and frozen per item at submit; later catalog edits never mutate historic requests.
- **My Requests** (`/requests`) list + **detail** (`/requests/:id`) with per-item status and a revise-and-resubmit path for rejected items.
- All `/api/estimates/my/*` endpoints are owner-scoped with an ownership-404 posture (non-owners get 404, never a 403 that would leak existence).

### Reviewer workflow (per-item)
- **Review queue** (`/review`, Solution Owner + Admin) with mine-only / intake-only toggles, product and team filters, and per-item question-answered counts.
- **Review screen** (`/review/:id`) — each item reviewed independently through `SUBMITTED → IN_REVIEW → APPROVED | REJECTED`. Pick a complexity (a compact per-complexity preview shows before picking; the grid then collapses to the chosen Onshore/Offshore pair, expandable to compare), apply per-cell overrides, and decide from a sticky bar showing hours, internal cost, client price, and margin. Approve snapshots the current blended rate. A sticky item rail navigates multi-item requests.
- **Admin controls** — send an approved item back for re-review, or **take over** a review claimed by another SO (preserving their in-progress state); both are audited.

### Revenue & Pricing Review (optional, feature-flagged)
When enabled in Global Settings, fully-approved estimates flow to a Revenue Manager at `/pricing-review` to set the pricing model and client price before the estimate is final.

### Dashboard & reporting
- **Dashboard** (`/dashboard`) — one shared route; role-driven stat cards (actionable ones emphasized), a permission-filtered activity feed with a "Just mine" toggle and Load-more, and role-gated quick links.
- **Team Workload** (`/reports/team-workload`, SO + Admin) — per-team item counts and approved hours/cost, aggregated from per-item state, with a per-team drill-down.

### Notifications
Email on key workflow events via the configured provider. Email is optional; the app runs fully without it (invitation and reset links can always be handed over by copy/paste).

---

## Prerequisites

- Java 21 (`brew install openjdk@21`)
- Node 20+ and npm
- Docker Desktop (or any Docker engine + Compose v2)

The backend uses the Maven Wrapper (`./mvnw`) — no local Maven install needed.

---

## Run locally

Helper scripts at the repo root:

```bash
./start_backend.sh    # Postgres (Docker) + backend on :8080
./start_frontend.sh   # Vite dev server on :5173
```

Or manually:

```bash
docker compose -f docker/docker-compose.yml up -d   # Postgres
cd backend && ./mvnw spring-boot:run                # backend on :8080
cd frontend && npm install && npm run dev           # frontend on :5173
```

Open [http://localhost:5173](http://localhost:5173) and log in with a seeded user. Vite proxies `/api/*` to the backend, so the session cookie and CSRF round-trip work same-origin.

### Seeded users (dev only)

| Email | Password | Roles |
| --- | --- | --- |
| `admin@local` | `ChangeMe123!` | Admin |
| `estimator@local` | `ChangeMe123!` | Solution Owner + Estimator |

Dev-only credentials. In production, `SeedPasswordOverrideRunner` reads the `ADMIN_INITIAL_PASSWORD` / `ESTIMATOR_INITIAL_PASSWORD` env vars at startup and BCrypt-overwrites these seeds so real secrets are never committed.

---

## Tests

```bash
cd backend  && ./mvnw test              # backend (JUnit + Spring Boot Test, H2)
cd frontend && npm test -- --run        # frontend (Vitest + RTL)
cd frontend && npm run lint             # type-check (tsc --noEmit)
cd frontend && npm run build            # production build
```

The frontend smoke test (`src/App.smoke.test.tsx`) mounts every authenticated route against a stubbed fetch and asserts no errors — add new routes to its sweep when they ship.

> **Backend tests run against the hand-maintained `backend/src/test/resources/schema.sql`, not Flyway.** Every new migration must be mirrored there (with a matching `DROP` at the top of the file), or the whole suite goes red.

---

## Resetting the database

```bash
docker compose -f docker/docker-compose.yml down -v   # drops the estimator_pgdata volume
docker compose -f docker/docker-compose.yml up -d
```

The next backend start re-runs all Flyway migrations (V1–V37) against a clean database.

---

## Repository layout

```
backend/  src/main/java/com/acme/estimator/
  audit/        AuditService, ChangeLogEntry, ChangeAction, read-side + name resolvers
  auth/         User, roles, AuthController, login throttle, password reset, invitations
  security/     SecurityConfig — session cookies, CSRF, CORS, method security
  common/       ApiException, GlobalExceptionHandler, PageResponse, PageLimits
  catalog/      products / subfeatures / questions / templates
  estimates/    EstimateRequest + EstimateRequestItem aggregates, per-item review,
                document uploads (Tika-verified), reviewer + admin controllers
  clients/ programs/ clientpricing/   client, program, and pricing reference data
  rates/        immutable blended-rate versions
  phases/       SDLC phases + template-activation guard
  teams/        teams + user_teams membership
  users/        user admin, invitations, password-reset tokens
  dashboard/    role-driven stat cards + permission-filtered activity feed
  reporting/    team-workload aggregation
  notifications/ email service + provider adapters (SMTP / Resend / Gmail)
  settings/     app settings (feature flags + email config), Gmail OAuth callback
  src/main/resources/db/migration/   V1–V37 Flyway SQL
  src/test/resources/schema.sql      H2 mirror of the schema (keep in sync with migrations)

frontend/  src/
  components/         shared UI (DataTable, Drawer, modals, StatusBadge, hours grid,
                      TypedAnswerInput, AnswerValue, ComplexitySelector, RoleGuard, ...)
  pages/              route-level pages (login, reset, dashboard, requests, review,
                      pricing-review, reports, profile)
  pages/admin/        admin pages + catalog product/sub-feature detail + drawers
  lib/api/            typed fetch wrappers per resource
  lib/queries/        React Query hooks per resource
  lib/permissions.ts  hasPermission + isAdmin (canonical access check)
  lib/activityLabels.ts  shared ChangeAction → human label mapping
  styles/tokens.css   design tokens (mirrored in tailwind.config.js)

docker/docker-compose.yml   Postgres only (backend + frontend run on host in dev)
docs/COLOR_USAGE.md         brand-color discipline (hard rule)
Dockerfile.backend / Dockerfile.frontend   production images
frontend/nginx.conf.template               prod nginx (API proxy + security headers)
start_backend.sh / start_frontend.sh       local dev helpers
```

---

## Design tokens

`frontend/src/styles/tokens.css` is the single source of truth for color, type, spacing, radius, and shadow; `frontend/tailwind.config.js` mirrors the colors so both raw CSS (`var(--color-accent)`) and Tailwind utilities (`text-accent`) work. Never hard-code hex values in components — update the tokens if one genuinely needs to change.
