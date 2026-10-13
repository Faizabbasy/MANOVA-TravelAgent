# Konten Marketing ke Backend (S11b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jadwal konten dan pengembangan konten disimpan di server; hanya pemegang `marketing.manage-content` yang mengubah.

**Architecture:** Migrasi 0037 (`content_schedule`, `content_development`); `core/marketing.ts`, `core/marketing-routes.ts`; capability baru di kedua matriks RBAC; seed dari fixture. Frontend `data/marketing-sync.ts`; halaman Marketing server-first + dialog tambah.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-marketing-content-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan ubah migrasi 0001–0036; jangan `git add docs` (folder milik user) — stage path eksplisit.
- Matriks RBAC frontend (`app/data/rbac.ts`) dan backend (`src/auth/rbac.ts`) tetap sinkron.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Finance (Marketing VIEW) tidak bisa membuat/mengubah konten di server maupun di UI — Task 2/4.
2. PIC konten hanya user internal aktif — Task 2.
3. Seed ulang tidak menimpa perubahan API — Task 3.
4. Gagal simpan di UI mengembalikan select ke nilai tersimpan — Task 4.
5. Field tak dikenal / enum salah ditolak — Task 2.

---

### Task 1: Migrasi 0037 — tes tabel/check di `db.test.ts` → migrasi up/down → commit.
### Task 2: API + capability — tes `test/marketing.test.ts` → `marketing.ts`, `marketing-routes.ts`, `ids.ts`, `rbac.ts` (backend + frontend + katalog), label audit → seluruh `bun run test` + typecheck → commit.
### Task 3: Seed — extract jadwal & pengembangan konten, upsert di `seed-demo.ts` (guard `changed_by_api_at`) + tes → commit.
### Task 4: Frontend — types/endpoints, `marketing-sync` (+tes), layout/settings, halaman Marketing (dialog tambah, select dikunci, server-first), guard → `pnpm test`, vue-tsc, eslint → commit.
### Task 5: Dokumentasi + verifikasi — ADR-004, spec status, memory; migrate + seed; smoke; build; commit.
