# IT Estimation Portal

Internal tool used by HealthCare Development Group, Inc. to produce work estimates for pre-defined products, features, and enhancements. Solution Owners maintain a versioned catalog of Products, Sub-features, Critical Questions, and Estimate Templates; Admins configure Teams, SDLC Phases, blended rates, and users; Estimators and Requesters (Phase 6+) consume the catalog. Every mutation lands in a full audit trail.

**Status:** Phases 0 through 5b shipped. Authentication, full admin surface (Teams, SDLC Phases, Blended Rates, Users & Roles, Invitations, Change Log), the Solution Owner catalog (Products, Sub-features, Critical Questions, cross-catalog Questions browser), and the Estimate Template editor with grid + paste + version-on-save are all live. `/dashboard` and `/requests` are intentional Phase 6+ placeholders.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Spring Boot 3.3, Java 21, Maven (wrapper) |
| Database | PostgreSQL 16 (Docker); H2 in PostgreSQL mode for backend tests |
| Migrations | Flyway (V1–V9 today) |
| Auth | Spring Security, form login + session cookies, CSRF via cookie+header |
| State | TanStack React Query + React Context |
| Drag-and-drop | @dnd-kit (reorder lists in SDLC Phases + Critical Questions) |
| Tests | JUnit 5 + Spring Boot Test (backend) · Vitest + React Testing Library (frontend) |

No GraphQL, no JWT, no Redux, no Next.js, no UI component libraries beyond Tailwind primitives. The brand-color discipline is documented in [`docs/COLOR_USAGE.md`](docs/COLOR_USAGE.md) — read it before building any UI.

---

## What's built

**Authentication & app shell (Phase 1)** — BCrypt password hashing, session cookies, CSRF protection, login page, app shell with sidebar + top bar + user menu, route guards, role-aware nav.

**Admin surface (Phases 2 & 3)**
- **Teams** — full CRUD with active/inactive, bulk operations, history, CSV export
- **SDLC Phases** — same surface as Teams, plus a system-phase protection rule and Phase 5b's activation guard (blocks activation when active estimate templates exist)
- **Blended Rates** — immutable per version (each save = new row); audit trail via change-log CREATED chain
- **Users & Roles** — full CRUD, multi-role assignment, last-admin protection, two-step delete with typed-name confirmation, CSV export, ColumnsToggle
- **Invitations** — token-based invite flow; admin invite, revoke, resend; public `/invite/:token` accept page
- **Change Log** (Phase 4) — read-only audit feed with date-grouped entries, audit grouping (2s window), filters (entity type, action, actor, date range, search), CSV export, three-hop href resolver

**Solution Owner catalog (Phase 5a)**
- **Products** — atomic vs. container mode, locked at creation, three-layer protection (DB CHECK + JPA `updatable=false` + service rejection)
- **Sub-features** — only allowed on container products, name-unique within parent
- **Critical Questions** — attached to either Product or Sub-feature (XOR), drag-to-reorder, required/optional, blocked from container products that have active sub-features
- **Cross-catalog Questions browser** — search, parent-type filter, edit drawer on row click (no separate detail page)
- **Cascade-delete contract** — deleting a parent purges all children with a single DELETED row at the parent (no per-child audit noise)

**Estimate Template editor (Phase 5b)**
- One row per active SDLC phase, six hour cells per row (Onshore L/M/H × Offshore L/M/H), grand-total row
- Version-on-save semantics — every save creates a new immutable template row, flips previous to inactive
- Keyboard navigation (Tab/Shift-Tab native, Enter → next row, arrow-at-edge → neighbor cell, Esc → revert)
- Spreadsheet TSV paste (Excel / Sheets / Numbers) — anchored at focused cell, fans right + down, drops out-of-range silently
- Inactive-phase rows persist as historical data with greyed-out treatment, still editable
- SDLC phase activation guard surfaces a non-destructive `InfoModal` ("Cannot activate phase — N templates would be affected")

---

## Prerequisites

- Java 21 (Homebrew: `brew install openjdk@21`)
- Node 20+ and npm
- Docker Desktop (or any Docker engine + Compose v2)

The backend uses the Maven Wrapper (`./mvnw`) — no local Maven install needed.

---

## Run locally

Two helper scripts live at the repo root:

```bash
# Terminal 1 — Postgres + backend on :8080
./start_backend.sh

# Terminal 2 — Vite dev server on :5173
./start_frontend.sh
```

Or run the parts manually:

```bash
docker compose -f docker/docker-compose.yml up -d   # Postgres
cd backend && ./mvnw spring-boot:run                # backend on :8080
cd frontend && npm install && npm run dev           # frontend on :5173
```

Open [http://localhost:5173](http://localhost:5173). Log in with one of the seeded users below.

---

## Seeded users (dev only)

| Email | Password | Roles | Use for |
| --- | --- | --- | --- |
| `admin@local` | `ChangeMe123!` | Admin | Full-access flows (admin pages, catalog, templates) |
| `estimator@local` | `ChangeMe123!` | Solution Owner + Estimator | Catalog + template editing without admin; verify 403 on admin pages |

These are dev-only credentials. Production must use injected secrets and rotated passwords.

---

## Running tests

```bash
# Backend — currently 176 tests
cd backend && ./mvnw test

# Frontend — currently 123 tests
cd frontend && npm test -- --run

# Frontend type-check only
cd frontend && npx tsc --noEmit

# Frontend production build
cd frontend && npm run build
```

The frontend smoke test (`src/App.smoke.test.tsx`) mounts every authenticated route with a stubbed fetch mock and asserts no thrown errors. Add new routes to its sweep when they ship.

---

## Resetting the database

The Postgres data volume is named `estimator_pgdata`.

```bash
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d
```

Next backend startup re-runs all Flyway migrations (V1 through V9 currently) against a clean database.

---

## Repository layout

```
backend/                      Spring Boot project (Maven)
  src/main/java/com/acme/estimator/
    audit/                    AuditService, ChangeLogEntry, ChangeAction
    audit/read/               Phase 4 change-log read service + name resolvers
    auth/                     User, Role, AuthController, SecurityConfig, AppUserDetails
    catalog/products/         Products + DTOs + service + controller
    catalog/subfeatures/      Sub-features
    catalog/questions/        Critical Questions
    catalog/templates/        Estimate templates (Phase 5b) + activation guard
    common/                   ApiException, ErrorResponse, GlobalExceptionHandler, PageResponse
    health/                   /api/health
    phases/                   SDLC phases + activation guard interface
    rates/                    Blended rates
    teams/                    Teams
    users/                    User admin, invitations
  src/main/resources/
    application.yml
    db/migration/             V1–V9 SQL migrations
  src/test/...                JUnit + Spring Boot Test (176 tests)

frontend/                     React + Vite + TS + Tailwind
  src/
    components/               Shared UI (DataTable, Drawer, ConfirmModal, InfoModal,
                              ListToolbar, KebabMenu, StatusBadge, Toggle,
                              FilterDropdown, Toast, DragHandle, EntityHeader,
                              EmptyState, CountPill, ColumnsToggle, RoleBadge,
                              CopyToClipboardButton, UserCell, UserAvatar, BrandMark,
                              SearchInput, FormField, inputs, buttons, ...)
    components/data-table/    DataTable
    components/hours/         Phase 5b grid (HoursCell, HoursRow, HoursGrid, columns)
    pages/                    Route-level pages
    pages/admin/              Real admin pages (Teams, SdlcPhases, BlendedRates,
                              Users, ChangeLog, Products, QuestionsBrowser, ...)
    pages/admin/products/     Product detail + SubFeature detail + drawers + modals
                              + TemplateEditorCard + QuestionRow
    pages/AcceptInvitePage    Public invite-accept page
    lib/api/                  Typed fetch wrappers per resource
    lib/queries/              React Query hooks per resource
    lib/parseTsv.ts           TSV parser for the grid paste handler
    lib/userDisplay.ts        Async user-name lookup (cached forever per id)
    lib/useUnsavedChangesGuard.ts  beforeunload prompt while form is dirty
    styles/tokens.css         Design tokens (verbatim from handoff bundle)
  src/test/...                Vitest + RTL (123 tests)

docker/
  docker-compose.yml          Postgres only — backend & frontend run on host

docs/
  COLOR_USAGE.md              Brand-color discipline (hard rule)
  IT Estimation Portal Design System.pdf  Original design system reference

start_backend.sh              Helper: docker up + ./mvnw spring-boot:run
start_frontend.sh             Helper: npm install (if needed) + npm run dev

CLAUDE.md                     Project notes for Claude Code (session context)
```

---

## Where the design tokens come from

`frontend/src/styles/tokens.css` is a verbatim port of `colors_and_type.css` from the Claude Design handoff bundle. The Tailwind config in `frontend/tailwind.config.js` mirrors those colors so both raw CSS (`var(--color-cardinal-red)`) and Tailwind utilities (`text-cardinal-red`) work. Do not duplicate or fork the palette — update `tokens.css` if a token genuinely needs to change. Phases 5a and 5b shipped without a Claude Design handoff — they used the existing admin pages as the visual source of truth, with new shared components called out explicitly in their phase prompts.

---

## Carry-overs into Phase 6+

Tracked in [`CLAUDE.md`](CLAUDE.md) under "Carry-overs into future phases." Each item has a TODO somewhere in the codebase pointing back to context. Notable ones: the `User` constructor visibility blocker (auth-package factory needed), the per-cell server-error mapping in the template editor (server-side improvement to include `sdlcPhaseId` in the structured error), and the `EmptyState` retrofit on the four pages still using inline empty states.
