# Inventory ke Backend (S11a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aset, maintenance dan peminjaman aset disimpan di server; tutup project ditolak selama aset project belum kembali.

**Architecture:** Migrasi 0036 (`assets`, `asset_maintenance`, `asset_checkouts`); `core/inventory.ts`, `core/inventory-routes.ts`; gate di `closeProject`; seed dari fixture. Frontend `data/inventory-sync.ts`; halaman Inventory server-first + dialog pinjam & jadwalkan maintenance.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-inventory-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan ubah migrasi 0001–0035; jangan `git add docs` (folder milik user) — stage path eksplisit.
- Hak tulis hanya `inventory.manage-asset`; matriks RBAC server tidak diubah.
- Uang sebagai bigint minor di SQL dan desimal string di wire.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Satu aset tidak bisa dipinjam dua kali bersamaan (juga saat request paralel) — Task 1/2.
2. Status `in-use` tidak bisa di-set/dilepas manual selama peminjaman terbuka — Task 2.
3. Tutup project ditolak selama ada peminjaman terbuka project itu — Task 2.
4. Status `overdue` konsisten antara server dan UI (dihitung dari tanggal) — Task 2/4.
5. Gagal simpan di UI tidak mengubah data lokal — Task 4.

---

### Task 1: Migrasi 0036 — tes tabel/check/index unik di `db.test.ts` → migrasi up/down → commit.
### Task 2: API + gate — tes `test/inventory.test.ts` → `inventory.ts`, `inventory-routes.ts`, `ids.ts`, `closeProject`, label audit → seluruh `bun run test` + typecheck → commit.
### Task 3: Seed — extract aset/maintenance/peminjaman ke `demo-core.json`, upsert di `seed-demo.ts` (guard `changed_by_api_at`), allow-list uang + tes → commit.
### Task 4: Frontend — types/endpoints, `inventory-sync` (+tes), layout/settings, halaman Inventory server-first + dialog pinjam & maintenance, guard → `pnpm test`, vue-tsc, eslint → commit.
### Task 5: Dokumentasi + verifikasi — ADR-004, spec status, memory; migrate + seed; smoke; build; commit.
