# IT Estimation Portal

Internal tool used by HealthCare Development Group, Inc. to produce work estimates for pre-defined products, features, and enhancements. Solution Owners maintain a versioned catalog of Products, Sub-features, Critical Questions, and Estimate Templates; Admins configure Teams, SDLC Phases, blended rates, and users; Requesters submit estimate requests against the catalog and Solution Owners review, override, and approve them. Every mutation lands in a full audit trail.

**Status:** Phases 0 through 9 shipped. Authentication, full admin surface (Teams, SDLC Phases, Blended Rates, Users & Roles, Invitations, Change Log), the Solution Owner catalog (Products, Sub-features, Critical Questions, Estimate Templates with grid + paste + version-on-save + per-row Total Hrs/$ + Grand Total footer), the Requester workflow (multi-step new request supporting multiple product line items per request, My Requests list, detail page with per-item status), the Reviewer workflow (review queue, per-item review screen with complexity + per-cell overrides + autosave + approve/reject/revise-and-resubmit, admin send-back), the role-aware Dashboard, the Phase 7.5 admin-implies-everything authorization model, Team Workload reporting, and the Phase 9 multi-product estimate request model (each request holds N product line items, each with its own independent review lifecycle) are all live. Only `/catalog/template-history` remains a placeholder, intentionally.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Spring Boot 3.3, Java 21, Maven (wrapper) |
| Database | PostgreSQL 16 (Docker); H2 in PostgreSQL mode for backend tests |
| Migrations | Flyway (V1–V14) |
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
- **Blended Rates** — immutable per version (each save = new row); audit trail via change-log CREATED chain; Phase 6b opens GET to Solution Owners (mutations stay Admin-only via per-method `@PreAuthorize`)
- **Users & Roles** — full CRUD, multi-role assignment, last-admin protection, two-step delete with typed-name confirmation, CSV export, ColumnsToggle
- **Invitations** — token-based invite flow; admin invite, revoke, resend; public `/invite/:token` accept page
- **Change Log** (Phase 4) — read-only audit feed with date-grouped entries, audit grouping (2s window), filters (entity type, action, actor, date range, search), CSV export, three-hop href resolver. Phase 6b adds 6 new `ChangeAction` enum values (SUBMITTED, REVIEW_STARTED, REVIEW_RELEASED, APPROVED, REJECTED, SENT_BACK) with a split-verb formatter for SENT_BACK.

**Solution Owner catalog (Phase 5a)**
- **Products** — atomic vs. container mode, locked at creation, three-layer protection (DB CHECK + JPA `updatable=false` + service rejection)
- **Sub-features** — only allowed on container products, name-unique within parent
- **Critical Questions** — attached to either Product or Sub-feature (XOR), drag-to-reorder, required/optional, blocked from container products that have active sub-features
- **Cross-catalog Questions browser** — search, parent-type filter, edit drawer on row click (no separate detail page)
- **Cascade-delete contract** — deleting a parent purges all children with a single DELETED row at the parent (no per-child audit noise)

**Estimate Template editor (Phase 5b + Phase 8)**
- One row per active SDLC phase, six hour cells per row (Onshore L/M/H × Offshore L/M/H)
- Each row shows Total Hours and Total $ columns driven by the current blended rate; Grand Total hours row + Estimate Total $ footer row
- Version-on-save semantics — every save creates a new immutable template row, flips previous to inactive
- Keyboard navigation (Tab/Shift-Tab native, Enter → next row, arrow-at-edge → neighbor cell, Esc → revert)
- Spreadsheet TSV paste (Excel / Sheets / Numbers) — anchored at focused cell, fans right + down, drops out-of-range silently
- Inactive-phase rows persist as historical data with greyed-out treatment, still editable
- SDLC phase activation guard surfaces a non-destructive `InfoModal` ("Cannot activate phase — N templates would be affected")

**Requester workflow (Phase 6a)**
- **Multi-step new request flow** at `/requests/new?step=N&id={id}` — pick product/sub-feature → answer required Critical Questions → review snapshot → submit
- **My Requests list** at `/requests` with status filter and date column; `Stepper` shared component drives the multi-step header
- **Detail page** at `/requests/:id` — Draft and Submitted views with snapshotted phase lines + answers; Approved/Rejected views populated in 6b
- **Snapshot-on-submit semantics** — at submit, template hour values + phase name+order + question text are COPIED into `estimate_request_phase_lines` + `estimate_request_question_answers` and frozen; later catalog edits don't mutate historic requests
- **`/api/estimates/my/*` endpoints** — all `@PreAuthorize("hasRole('REQUESTER')")` with strict ownership-404 (not 403) for non-owners — privacy posture: never leak request existence

**Reviewer workflow (Phase 6b)**
- **Review queue** at `/review` (Solution Owner only) — Submitted + In Review requests with mineOnly toggle, product filter, status scope
- **Review screen** at `/review/:id` covering all four state variants:
  - **Submitted** — Start review CTA; shows snapshot read-only with race-condition guard (409 → refetch surfacing claimed-by message)
  - **In Review** — interactive with `ComplexitySelector` (Low/Med/High), per-cell hour `overrides` overlaid on snapshot, `JustificationField` autosave (debounced, per-field settle-gate to avoid stale PUTs)
  - **Approved / Rejected** — read-only, snapshot + chosen complexity + override pills + cost summary. Approved view collapses to just the two chosen complexity columns (ONS/OFF) with Total Hrs and Total $ per row, Grand Total + Estimate Total $ footer.
  - **Claimed-by-other-SO** — read-only with reviewer name in the banner
- **HoursGrid discriminated-union `mode` prop** (`template-editor` | `reviewer`) — single grid component serves both Phase 5b and Phase 6b without forking
- **Approve / Reject** snapshot the current blended rate via `findCurrentAsOf(LocalDate.now())` into `approved_blended_rate_id` (V11)
- **Admin send-back** at `/api/estimates/admin/{id}/send-back` (Admin only) — clears overrides + resets to Submitted; documented review-state-vs-snapshot distinction
- **24 new backend integration tests** + **16 new frontend tests** covering all four state variants and the race-condition path

**Dashboard (Phase 7)**
- **Single shared `/dashboard`** for every role — content adapts by role, not the route
- **Three sections** top to bottom:
  - **Stat cards** — `myDrafts` + `myRecentActivity` (everyone), `awaitingReview` + `myActiveReviews` (Solution Owner only), `pendingInvitations` + `totalActiveUsers` (Admin only). Cards filter out at the API level — frontend renders what it gets.
  - **Activity feed** — paginated permission-filtered slice of `change_log`, with an `All activity` / `Just mine` toggle. Reuses Phase 4's `DescriptionFormatter` + `EntityHrefResolver`. Visibility rules: Admin sees all, SO sees catalog + estimate-request rows + own auth events, Requester sees own request rows + own actions.
  - **Quick links** — role-gated tile grid (Requester / SO / Admin tiles).
- **No new tables** — composes data from `change_log`, `estimate_requests`, `users` via small count-method additions and an `ActivityFeedSpecifications` factory.
- **Refresh contract** — manual `Refresh` button invalidates the `['dashboard']` query prefix; React Query's `refetchOnWindowFocus` handles "user came back to the tab" automatically. No polling, no SSE.
- **17 new backend integration tests** + **9 new frontend tests** covering role-driven card visibility, permission-filtered feed, and quick-link role gating

**Admin privilege model (Phase 7.5)**
- **Admin role implies every other role** for authorization purposes — at the `@PreAuthorize` and service-layer ownership-check layer, NOT a data-write augmentation. `user_roles` data stays as-is; the implication answers "does this actor have permission to do X." Admin can view any estimate request, claim/release/approve/reject any review, browse the catalog. Same URL for everyone — no `/admin/estimates/:id` parallel route.
- **Carve-out: Admin cannot EDIT-AS-USER on someone else's private workspace.** Admin can VIEW any Draft, but PATCH / submit / discard / saveDraftAnswers stay strictly owner-only (404 otherwise — keeps the privacy posture from Phase 6a). Admin can submit their OWN drafts.
- **Carve-out: Admin override on in-flight reviews.** Admin can release / approve / reject a review claimed by another SO without having to claim it first. Audit row attributes the action to the Admin actor; reviewer_id stays as the original SO so we don't lose the SO who was on the hook.
- **Last-admin protection unchanged.** Operates on actual Admin role count, not effective permissions. The only Admin still cannot demote themselves.
- **Frontend**: new `lib/permissions.ts` (`hasPermission` + `isAdmin`) is the canonical access check. `lib/auth.tsx`'s `hasRole()` delegates so existing call sites get the implication for free. New `RoleGuard` component wraps protected-by-role routes — signed-in but lacking permission renders an in-place no-access panel (preserves the URL). `RoleCheckboxList` now auto-checks and locks the other role boxes when Admin is selected, with an "Admin role includes all permissions." tooltip and "(included with Admin)" italic annotation.
- **8 new backend `AdminPrivilegeTest` cases** + **12 new frontend tests** (7 permissions + 5 RoleCheckboxList) + AppShell tests updated for the new Catalog gate

**Team wiring & reporting (Phase 8)**
- **V12 migration** — `user_teams` join table (users can belong to zero or more teams); `team_id` FK added to `products` (products belong to exactly one team; nullable for existing rows, enforced on create)
- **Products now show team** — team badge visible on the product list and product detail; team filter available on the review queue
- **Users assignable to teams** — team multi-select in the Invite User modal and Edit User drawer; team membership shown in the user list
- **Team Workload report** at `/reports/team-workload` (SO + Admin gated) — summary DataTable: team name, member count, approved-estimate count, total approved hours, and estimated total cost. Row click drills into `/reports/team-workload/:teamId` showing the individual approved estimates for that team.
- `ReportingService` + `ReportingController` (`/api/reports/team-workload`, `/api/reports/team-workload/{teamId}`) — `@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")`
- New navigation section "Reports" in sidebar (SO + Admin visible)
- **Deploy artifacts added** — `Dockerfile.backend` and `Dockerfile.frontend` at repo root; `frontend/nginx.conf.template` for environment-variable-driven nginx config in production; `SeedPasswordOverrideRunner` reads `ADMIN_PASSWORD` / `ESTIMATOR_PASSWORD` env vars at startup and bcrypt-overwrites the seeded dev credentials so production can inject real secrets without re-seeding

**Multi-product requests & per-item review (Phase 9)**
- **V13 migration** — `estimate_request_items` child table: each estimate request now holds N product line items. Per-product state (product, sub-feature, template, complexity, status, reviewer, overrides, approvals) moves from `estimate_requests` to `estimate_request_items`. `estimate_request_phase_lines` and `estimate_request_question_answers` both re-FK to `estimate_request_item_id`.
- **V14 migration** — adds `rejection_reason`, `revision_count`, and `original_product_id` to items for the revise-and-resubmit flow.
- **Multi-item request creation** — Requester can add multiple product/sub-feature line items in a single request; each item gets its own question-answer snapshot and phase-line snapshot on submit.
- **Per-item review lifecycle** — each item is independently `DRAFT → SUBMITTED → IN_REVIEW → APPROVED | REJECTED`. The overall request aggregates item statuses.
- **Approver revise-and-resubmit flow** — SO rejects an item with a reason (`rejection_reason`); the Requester can revise the item (swap product/sub-feature, update answers) and resubmit it; `revision_count` increments per revision; `original_product_id` preserves the audit trail if the product changes.
- **`EstimateRequestItem` entity** is now the core per-product unit of work. New DTOs: `EstimateRequestItemDto`, `CreateItemRequest`, `ApproveItemRequest`, `RejectItemRequest`, `ReviseAndResubmitRequest`.
- **Frontend rework** — `NewEstimateRequestPage`, `EstimateDetailPage`, `ReviewQueuePage`, and `ReviewScreenPage` all significantly updated for the multi-item model.
- **New backend tests** — `EstimateRequestItemReviewTest` + `EstimateRequestRevisionTest` cover the full per-item lifecycle and the revision flow end-to-end.

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
| `admin@local` | `ChangeMe123!` | Admin | Full-access flows (admin pages, catalog, templates, send-back) |
| `estimator@local` | `ChangeMe123!` | Solution Owner + Estimator | Catalog + template editing without admin; verify 403 on admin pages; review queue + review screen |

These are dev-only credentials. Production must use injected secrets and rotated passwords.

---

## Running tests

```bash
# Backend
cd backend && ./mvnw test

# Frontend
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

Next backend startup re-runs all Flyway migrations (V1 through V14) against a clean database.

---

## Repository layout

```
backend/                      Spring Boot project (Maven)
  src/main/java/com/acme/estimator/
    audit/                    AuditService, ChangeLogEntry, ChangeAction
    audit/read/               Phase 4 change-log read service + name resolvers
    auth/                     User, Role, AuthController, SecurityConfig, AppUserDetails,
                              SeedPasswordOverrideRunner (Phase 8 prod-credential override)
    catalog/products/         Products + DTOs + service + controller
    catalog/subfeatures/      Sub-features
    catalog/questions/        Critical Questions
    catalog/templates/        Estimate templates (Phase 5b) + activation guard
    common/                   ApiException, ErrorResponse, GlobalExceptionHandler, PageResponse
    dashboard/                Phase 7: DashboardService + DashboardController +
                              ActivityFeedSpecifications (per-role visibility predicate)
    estimates/                Phase 6a/6b/9: EstimateRequest + EstimateRequestItem aggregates +
                              service + MyEstimateController (Requester) +
                              EstimateReviewController (SO) + EstimateAdminController (Admin)
    health/                   /api/health
    phases/                   SDLC phases + activation guard interface
    rates/                    Blended rates
    reporting/                Phase 8: ReportingService + ReportingController
                              (/api/reports/team-workload)
    teams/                    Teams
    users/                    User admin, invitations
  src/main/resources/
    application.yml
    db/migration/             V1–V14 SQL migrations
  src/test/...                JUnit + Spring Boot Test
  .settings/                  IDE-local Eclipse JDT prefs (gitignored) — silences
                              JDT null-analysis noise; keeps real-bug catchers on;
                              forces -parameters generation in IDE incremental compile

frontend/                     React + Vite + TS + Tailwind
  src/
    components/               Shared UI (DataTable, Drawer, ConfirmModal, InfoModal,
                              ListToolbar, KebabMenu, StatusBadge, Toggle,
                              FilterDropdown, Toast, DragHandle, EntityHeader,
                              EmptyState, CountPill, ColumnsToggle, RoleBadge,
                              CopyToClipboardButton, UserCell, UserAvatar, BrandMark,
                              SearchInput, FormField, Stepper, ComplexitySelector,
                              JustificationField, DashboardCards (StatCard +
                              QuickLinkTile), RoleGuard, inputs, buttons, ...)
    components/data-table/    DataTable
    components/hours/         Phase 5b/6b grid (HoursCell, HoursRow, HoursGrid,
                              ReadOnlyCell, columns) — discriminated-union mode prop;
                              Phase 8 adds Total Hrs/$ per row + Grand Total footer
    pages/                    Route-level pages
      LoginPage / AcceptInvitePage / DashboardPage / MyRequestsPage /
      NewEstimateRequestPage / EstimateDetailPage / ReviewQueuePage /
      ReviewScreenPage / TeamWorkloadPage / TeamWorkloadDetailPage / placeholders
    pages/admin/              Real admin pages (Teams, SdlcPhases, BlendedRates,
                              Users, ChangeLog, Products, QuestionsBrowser, ...)
    pages/admin/products/     Product detail + SubFeature detail + drawers + modals
                              + TemplateEditorCard + QuestionRow
    lib/api/                  Typed fetch wrappers per resource (estimates, reviews,
                              reporting, ...)
    lib/queries/              React Query hooks per resource
    lib/parseTsv.ts           TSV parser for the grid paste handler
    lib/userDisplay.ts        Async user-name lookup (cached forever per id)
    lib/estimateMath.ts       Phase 6b cost helpers (displayedRow, totalCostForLines, ...)
    lib/useUnsavedChangesGuard.ts  beforeunload prompt while form is dirty
    lib/permissions.ts        Phase 7.5: hasPermission + isAdmin (canonical access check)
    styles/tokens.css         Design tokens (verbatim from handoff bundle)
  src/test/...                Vitest + RTL

docker/
  docker-compose.yml          Postgres only — backend & frontend run on host

docs/
  COLOR_USAGE.md              Brand-color discipline (hard rule)
  IT Estimation Portal Design System.pdf  Original design system reference

Dockerfile.backend            Phase 8: production Docker image for Spring Boot backend
Dockerfile.frontend           Phase 8: production Docker image (nginx) for React frontend
frontend/nginx.conf.template  nginx config template with env-var substitution for API proxy

start_backend.sh              Helper: docker up + ./mvnw spring-boot:run
start_frontend.sh             Helper: npm install (if needed) + npm run dev

CLAUDE.md                     Project notes for Claude Code (session context)
```

---

## Where the design tokens come from

`frontend/src/styles/tokens.css` is a verbatim port of `colors_and_type.css` from the Claude Design handoff bundle. The Tailwind config in `frontend/tailwind.config.js` mirrors those colors so both raw CSS (`var(--color-cardinal-red)`) and Tailwind utilities (`text-cardinal-red`) work. Do not duplicate or fork the palette — update `tokens.css` if a token genuinely needs to change. Phases 5a, 5b, 6a, and 6b shipped without a Claude Design handoff — they used the existing pages as the visual source of truth, with new shared components called out explicitly in their phase prompts.

---

## Carry-overs into future phases

Tracked in [`CLAUDE.md`](CLAUDE.md) under "Carry-overs into future phases." Each item has a TODO somewhere in the codebase pointing back to context. Notable ones: the `User` constructor visibility blocker (auth-package factory needed); the per-cell server-error mapping in the template editor + new-request flow + reviewer override grid; the Approved view falls back to current blended rate because the DTO doesn't yet carry the snapshot rate body; the `EmptyState` retrofit on pages still using inline empty states; dashboard stat cards are display-only (not click-through); Phase 9 multi-product requests introduce a new carry-over where partial-approval state (some items approved, some still in review) is not yet visualized distinctly at the request-list level.
