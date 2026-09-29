# CLAUDE.md

Guidance for Claude Code when working in this monorepo. Each package has its own `CLAUDE.md` with package-specific details — read it when working inside that folder.

## Layout

```
frontend/   Nuxt 4 + Vue 3 dashboard (pnpm)      → see frontend/CLAUDE.md
backend/    Elysia API on Bun (bun)              → see backend/CLAUDE.md
docs/       Business flow & architecture notes (Markdown)
```

One git repository at the root. A feature that touches both API and UI goes in **one commit / one PR**.

## Commands (run from root)

```bash
npm run install:all     # install frontend (pnpm) + backend (bun)
npm run dev             # run frontend (:8080) and backend (:3000) together
npm run dev:frontend    # frontend only
npm run dev:backend     # backend only
npm run lint            # frontend eslint
npm run typecheck       # frontend vue-tsc
npm run test            # frontend vitest
npm run typecheck:backend   # backend tsc
npm run test:backend        # backend bun test (PGlite; TEST_DATABASE_URL for PostgreSQL)
npm run db:migrate          # apply backend migrations (also run by backend dev)
npm run db:seed:demo        # demo references + logins (needs backend/.env with APP_ENV=development; never in production)
npm run db:seed:finance-demo  # demo accounts, invoices and cash (after db:seed:demo; runs once; rows marked demo-fixture)
```

The frontend reaches the backend through the Nuxt proxy at `/api/v1/**` (`frontend/app/composables/useApi.ts`).
Finance implementation program, ADRs and phase reports: `docs/manova-finance-implementation/`.
Roles: only super-admin, admin (everything except Finance) and finance are active; client/vendor portals are
hidden (ADR-006). Keep frontend `app/data/rbac.ts` and backend `src/auth/rbac.ts` in sync.

## Rules

- Package managers are fixed per package: **pnpm** in `frontend/`, **bun** in `backend/`. Never mix them or add another lockfile.
- Frontend runs on port 8080, backend on port 3000.
- When changing an API response shape, update every frontend consumer in the same change.
- Do not commit `.env` files; commit `.env.example` instead.
