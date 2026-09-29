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
| `bun run db:rehearse [--source url --restore url]` | fresh → up → seed → down → up → backup → restore → compare |
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

## API (Phase 1)

All responses: `{ data, meta: { requestId } }` or `{ error: { code, message, fieldErrors? }, meta: { requestId } }`.

| Endpoint | Notes |
|---|---|
| `GET /health`, `GET /api/v1/health` | liveness / readiness (503 when DB unreachable or schema not current) |
| `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | HttpOnly session cookie; `me` returns server-computed permissions |
| `POST /api/v1/auth/demo-login` | One-click demo sign-in by `userId`; demo-fixture accounts only; 404 when `DEMO_LOGIN` is off (always in production) |
| `GET /api/v1/projects`, `GET /api/v1/projects/:id` | scoped per role; portal roles get a reduced DTO |
| `GET /api/v1/parties[/:id]`, `GET /api/v1/vendors[/:id]` | internal lists; portals read only their own record |
| `GET /api/v1/service-orders/:id`, `GET /api/v1/bookings/:type/:id` | typed references (`flight`, `hotel`, `transport`, `mice`) |

Out-of-scope records return 404, exactly like missing ones.
