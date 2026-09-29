# CLAUDE.md — backend

Elysia API on Bun, PostgreSQL via `postgres.js`, embedded PostgreSQL (PGlite) for local dev/tests. Entry point
`src/index.ts`, port 3000. Architecture decisions: `docs/manova-finance-implementation/adr/` (read ADR-001–004
before changing API conventions, the database layer, auth or core references).

## Commands

```bash
bun install
bun run dev              # migrate + serve with --watch
bun test                 # PGlite in-memory; TEST_DATABASE_URL=postgres://… for PostgreSQL
bun run typecheck
bun run db:migrate | db:rollback | db:status | db:seed:demo | db:seed:finance-demo | db:backup | db:restore | db:rehearse
```

## Rules

- Use `bun` only (lockfile `bun.lock`). Do not use npm/pnpm here.
- Schema changes = a new `migrations/NNNN_name.up.sql` + `.down.sql` pair. Never edit an applied migration
  (checksum drift blocks startup).
- Money is `bigint` minor units in SQL and a decimal string (`amountMinor`) on the wire; never `number`/float.
  Use `src/shared/money.ts`.
- Write JSON parameters as `$n::text::jsonb` with `JSON.stringify(...)` (keeps postgres.js and PGlite identical).
- Every read/write resolves the actor with `auth.requireActor` / `requireCapability` and applies row scope from
  `src/modules/core/scope.ts`. Never accept role, user, party or vendor IDs from the request body as authority.
  Out-of-scope records return 404.
- Throw `AppError` / `errors.*` from `src/http/errors.ts`; the app renders the envelope. Messages are plain
  Indonesian for end users.
- Audit state changes with `recordAudit` inside the same transaction as the change.
- New endpoints need tests for success, validation, 401, 403/404-by-scope. Run the suite on PGlite and, when
  touching SQL, on PostgreSQL too.
- When an API response shape changes, update `frontend/app/types/api.ts` and `frontend/app/lib/api/endpoints.ts`
  in the same change.
