# CLAUDE.md — backend

Elysia API running on Bun. Entry point: `src/index.ts`, listens on port 3000.

## Commands

```bash
bun install        # install deps
bun run dev        # start with --watch
```

## Notes

- Use `bun` only (lockfile: `bun.lock`). Do not use npm/pnpm here.
- Early scaffold: structure (routes, DB, auth) not decided yet — propose it before building large features.
