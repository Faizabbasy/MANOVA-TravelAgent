# Portal Client Baca Data Server (S12a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal client bisa login di dev/staging dan membaca peserta, itinerary, change request, insiden, pembatalan, dokumen, pesan dan notifikasi miliknya dari server.

**Architecture:** `PORTAL_LOGIN` default non-production + `GET /auth/options`; `core/client-scope.ts` (scope + penyaring); filter `partyId` di fungsi list yang ada; frontend menampilkan akun portal bila server mengizinkan dan memuat sync terkait untuk client.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-client-portal-reads-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; tanpa migrasi baru; jangan `git add docs` (folder milik user) — stage path eksplisit.
- Client tidak pernah menerima data project party lain, item itinerary tersembunyi, biaya vendor, catatan internal insiden, dokumen/pesan internal.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Tidak ada kebocoran lintas party di daftar maupun detail (404) — Task 2.
2. Field internal benar-benar disaring (itinerary vendor/biaya, insiden internal, dokumen/pesan internal) — Task 2.
3. Production menolak `PORTAL_LOGIN=true`; staging/dev mengizinkan — Task 1.
4. Internal tetap melihat semua data seperti sebelumnya — Task 2.
5. Akun portal hanya muncul di frontend saat server mengizinkan — Task 3.

---

### Task 1: Aktivasi portal — tes config & `GET /auth/options` & login client → `env.ts`, `auth/routes.ts` → seluruh `bun run test` (tes lama yang mengandalkan portal mati disesuaikan) → commit.
### Task 2: Bacaan client — tes `test/client-portal.test.ts` → `client-scope.ts`, filter di fungsi list, route → seluruh `bun run test` + typecheck → commit.
### Task 3: Frontend — opsi portal (endpoint, `isRoleSelectable`), akun demo, layout memuat sync untuk client (+tes) → `pnpm test`, vue-tsc, eslint → commit.
### Task 4: Dokumentasi + verifikasi — ADR-006/ADR-004, spec status, memory; smoke (login client, data hanya miliknya); build; commit.
