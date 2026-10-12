# Master Data & Profil Organisasi ke Backend (S10b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 16 kategori master data dan profil organisasi disimpan di server (Admin/Super Admin menulis, peran internal membaca).

**Architecture:** Migrasi 0035 (`master_data_records` generik + `organization_profile` singleton); `core/master-data.ts` (skema per kategori + validasi), `core/master-data-routes.ts`; seed dari fixture. Frontend `data/master-data-sync.ts`; halaman Master Data dan panel profil server-first.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-master-data-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan ubah migrasi 0001–0034; jangan `git add docs` (folder milik user) — stage path eksplisit.
- Hak tulis hanya `admin.manage-master-data`; matriks RBAC server tidak diubah.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Finance (tanpa `admin.manage-master-data`) tidak bisa menulis master data/profil (403); portal tidak bisa membaca — Task 2.
2. Field tak dikenal / tipe salah / kode duplikat ditolak, `data` jsonb tidak bisa disusupi kunci lain — Task 2.
3. PATCH sebagian tidak menghapus field lain dan tetap memvalidasi record utuh — Task 2.
4. Seed ulang tidak menimpa master data/profil yang diubah API — Task 3.
5. Gagal simpan di UI tidak mengubah data lokal (server-first) — Task 4.

---

### Task 1: Migrasi 0035 — tes tabel & check di `db.test.ts` → migrasi up/down → commit.
### Task 2: API — tes `test/master-data.test.ts` → `master-data.ts`, `master-data-routes.ts`, `ids.ts`, label audit → seluruh `bun run test` + typecheck → commit.
### Task 3: Seed — extract 16 kategori + profil ke `demo-core.json`, upsert di `seed-demo.ts` (guard `changed_by_api_at`) + tes → commit.
### Task 4: Frontend — types/endpoints, `master-data-sync` (+tes), layout/settings, `master-data.vue` & `OrganizationProfilePanel` server-first, guard → `pnpm test`, vue-tsc, eslint → commit.
### Task 5: Dokumentasi + verifikasi — ADR-004, spec status, memory; migrate + seed; smoke; build; commit.
