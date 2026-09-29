# MANOVA backend

Elysia API on Bun. PostgreSQL is the system of record; local development and tests run on embedded
PostgreSQL (PGlite) so nothing needs to be installed. Decisions and trade-offs live in
`docs/manova-finance-implementation/adr/`.

## Quick start

```bash
bun install
cp .env.example .env   # sets APP_ENV=development (the demo seed requires it explicitly)
bun run db:seed:demo   # optional: demo references + one login per role (refused in production / on real data)
bun run dev            # applies pending migrations, then serves http://localhost:3000 with --watch
```

Three roles are active: super-admin, admin (everything except Finance) and finance (ADR-006). The login page
signs in with one click through `POST /api/v1/auth/demo-login` (dev/demo only). Password login also works with
the fixture emails (e.g. `budi.santoso@manova.id` = finance) and password `manova-demo` (`DEMO_PASSWORD`).
Client/vendor portal logins are refused unless `PORTAL_LOGIN=true`.

Copy `.env.example` to `.env` to change settings. To use a PostgreSQL server instead of PGlite:
`DATABASE_URL=postgres://user:pass@localhost:5432/manova`.

## Scripts

| Script | What it does |
|---|---|
| `bun run dev` / `bun run start` | Serve the API (dev watches files). Refuses to start on pending or drifted migrations. |
| `bun test` | Test suite on in-memory PGlite. `TEST_DATABASE_URL=postgres://…` runs it on PostgreSQL (one throwaway schema per file). |
| `bun run typecheck` / `bun run check` | `tsc --noEmit` / typecheck + tests |
| `bun run db:migrate [--to N]` | Apply pending migrations |
| `bun run db:rollback [--steps N \| --to N]` | Revert migrations (production requires `--confirm-backup <file>`) |
| `bun run db:status` | Applied / pending / drift |
| `bun run db:seed:demo` | Idempotent demo seed from `src/db/seeds/demo-core.json` |
| `bun run db:backup [--out dir]` | `pg_dump` (Postgres) or data-dir tarball (PGlite) + `.sha256` |
| `bun run db:restore <file> --target <url>` | Verify checksum, restore into an **empty** database |
| `bun run db:rehearse [--source url --restore url]` | fresh → up → seed → down → up → finance demo → backup → restore → compare counts and a money fingerprint |
| `bun run db:seed:finance-demo` | Demo accounts, invoices and cash (after `db:seed:demo`; once; refused in production / on real data) |
| `bun scripts/perf-baseline.ts [scale]` | Builds a throwaway database at volume through the API and times the Finance reads |
| `bun run seed:extract` | Regenerate the demo seed from `frontend/app/data` fixtures |

## Layout

```text
migrations/                 NNNN_name.up.sql + .down.sql (plain SQL, checksummed)
src/index.ts                boot: config → db → schema check → HTTP
src/app.ts                  composition: request id, security headers, CORS/CSRF, error envelope, routes
src/config/env.ts           env validation (fails fast, lists every problem)
src/db/                     driver adapter, migrator, seed, backup/restore, rehearsal
src/http/                   error + success envelopes, pagination, client info
src/auth/                   sessions, password hashing, login throttle, server RBAC, auth routes
src/modules/health/         /health (liveness), /api/v1/health (readiness)
src/modules/core/           Party/Project/Vendor/ServiceOrder/Booking reference reads + row scope
src/shared/                 money (bigint minor units), business dates, audit trail
test/                       bun:test suites (unit, persistence, HTTP)
scripts/                    db CLI, demo-seed extractor
```

## API

Full release notes, deployment, rollback and curl examples: `docs/manova-finance-implementation/15-RELEASE-AND-CUTOVER.md`.

All responses: `{ data, meta: { requestId } }` or `{ error: { code, message, fieldErrors? }, meta: { requestId } }`.

| Endpoint | Notes |
|---|---|
| `GET /health`, `GET /api/v1/health` | liveness / readiness (503 when DB unreachable or schema not current) |
| `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | HttpOnly session cookie; `me` returns server-computed permissions |
| `POST /api/v1/auth/demo-login` | One-click demo sign-in by `userId`; demo-fixture accounts only; 404 when `DEMO_LOGIN` is off (always in production) |
| `GET /api/v1/projects`, `GET /api/v1/projects/:id` | scoped per role; portal roles get a reduced DTO |
| `GET /api/v1/parties[/:id]`, `GET /api/v1/vendors[/:id]` | internal lists; portals read only their own record |
| `GET /api/v1/service-orders/:id`, `GET /api/v1/bookings/:type/:id` | typed references (`flight`, `hotel`, `transport`, `mice`) |
| `GET /api/v1/finance/cash-position` | verified cash per account and company total (unavailable, not zero, until openings are verified) |
| `GET/POST /api/v1/finance/accounts`, `GET/PATCH /api/v1/finance/accounts/:id` | bank accounts (full number only for account managers) |
| `POST /api/v1/finance/accounts/:id/opening`, `POST …/opening/verify` | opening balance: finance submits, a different super-admin verifies |
| `GET /api/v1/finance/accounts/:id/ledger` | period ledger: opening, rows with running balance, closing |
| `GET /api/v1/finance/statement` | posted movements with filters, operational totals (internal transfers excluded) |
| `POST /api/v1/finance/transactions`, `POST …/transactions/:id/reverse` | other income / expense; reversal (Idempotency-Key required) |
| `POST /api/v1/finance/transfers`, `POST …/transfers/:id/reverse`, `GET …/transfers/:id` | transfer + fee between own accounts (Idempotency-Key required) |
| `GET/POST /api/v1/finance/billing-schedule`, `PATCH …/:id`, `POST …/:id/cancel` | planned DP / progress / final billing per project or booking |
| `GET/POST /api/v1/finance/customer-invoices`, `PATCH/DELETE …/:id` (draft), `POST …/:id/issue`, `…/void`, `…/dispute`, `PATCH …/:id/expectation` | customer invoices; issuing freezes them and moves no money |
| `POST /api/v1/finance/credit-notes`, `POST …/:id/void` | reduce what a customer owes (never below zero) |
| `GET /api/v1/finance/receivables` | open / overdue / paid worklist with totals |
| `POST /api/v1/finance/receipts`, `POST …/receipts/:id/allocations` | money in from a customer, partial allocation, remainder = advance (Idempotency-Key required) |
| `GET /api/v1/finance/advances` | customer advances / vendor deposits not yet allocated |
| `POST /api/v1/finance/vendor-invoices`, `PATCH …/:id`, `POST …/:id/review`, `…/void`, `PATCH …/:id/expectation`, `GET …/:id` | vendor invoices: record → review → approve/reject |
| `GET /api/v1/finance/payables` | approved payables (outstanding / overdue / paid) and the review queue |
| `POST /api/v1/finance/vendor-payments`, `POST …/vendor-payments/:id/allocations` | money out to a vendor, partial, remainder = deposit (Idempotency-Key required) |
| `GET /api/v1/{projects,bookings/:type,vendors,parties}/:id/finance-summary` | finance context: full for Finance/Super Admin, payment status without amounts for Admin |
| `GET/POST /api/v1/finance/transfer-fee-rules`, `PATCH …/:id`, `GET /api/v1/finance/transfer-fee-quote` | fee per transfer direction (fixed or %, min/max, period); one active rule per direction and day; an empty fee on a transfer applies it |
| `GET/POST /api/v1/finance/policies`, `PATCH/DELETE …/:id` (draft), `POST …/:id/publish`, `…/deactivate`, `…/new-version` | cancellation policies with tiers; published versions are frozen |
| `GET/PUT /api/v1/finance/cancellation-policy/:subjectType/:subjectId` | policy assigned to a project or booking (snapshot) |
| `POST /api/v1/finance/cancellations/preview`, `POST /api/v1/finance/cancellations` | H-x preview and cancellation case (Admin: status and percentages only) |
| `GET /api/v1/finance/refunds[/:id]`, `POST …/:id/approve`, `…/reject`, `…/settlements` | refund cases; money moves only at settlement (Idempotency-Key required) |
| `GET /api/v1/finance/cash-flow` | projection 30d/3m/6m/12m from verified cash + open AR/AP/refunds, per company, account or project |
| `GET /api/v1/finance/overview`, `GET /api/v1/finance/reports/monthly` | app dashboard and Reports figures (Admin: payment status only) |

Every Finance route answers 401 (no session) or 403 (no finance access) **before** the body is validated
(`src/modules/finance/access.ts`); handlers then check the exact capability.

Out-of-scope records return 404, exactly like missing ones.
