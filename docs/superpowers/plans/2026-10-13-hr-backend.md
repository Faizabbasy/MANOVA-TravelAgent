# HR ke Backend (S11c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Data HR di server; angka gaji/komisi/insentif hanya untuk Finance & Super Admin; payroll draft → approved → paid tanpa posting ledger.

**Architecture:** Migrasi 0038 (6 tabel HR); `hr.manage-payroll` dipindah ke Finance; `core/hr.ts`, `core/hr-routes.ts` (komisi dihitung dari project); seed dari fixture. Frontend `data/hr-sync.ts`; halaman HR menyembunyikan angka & tab uang tanpa capability, aksi lewat server.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-hr-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan ubah migrasi 0001–0037; jangan `git add docs` (folder milik user) — stage path eksplisit.
- Matriks RBAC frontend (`app/data/rbac.ts`) dan backend (`src/auth/rbac.ts`) tetap sinkron.
- Uang: bigint minor di SQL, desimal string di wire; Admin tidak pernah menerima angka uang HR.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Admin tidak menerima angka gaji/komisi/insentif dari endpoint mana pun (termasuk Activity Center) — Task 2/3.
2. Admin tidak bisa mengubah gaji lewat create/patch karyawan; Finance tidak bisa mengubah field non-uang — Task 2.
3. Baris payroll hanya berubah saat run draft; status berurutan; satu run per periode (juga paralel) — Task 3.
4. Komisi turunan cocok dengan aturan frontend (owner → karyawan, nilai kontrak × tarif, status dari project) — Task 3.
5. Seed ulang tidak menimpa perubahan API — Task 4.

---

### Task 1: Migrasi 0038 — tes tabel/check/unik di `db.test.ts` → migrasi up/down → commit.
### Task 2: RBAC + karyawan/absensi/review — tes `test/hr.test.ts` (bagian karyawan) → pindah `hr.manage-payroll` ke Finance (backend + frontend + tes RBAC), `hr.ts` (karyawan, absensi, review), routes, ids, label audit → seluruh `bun run test` + typecheck → commit.
### Task 3: Payroll, komisi, insentif — tes `test/hr.test.ts` (bagian payroll) → `hr.ts` + routes → seluruh `bun run test` + typecheck → commit.
### Task 4: Seed — extract karyawan, absensi, payroll, review; upsert di `seed-demo.ts` (guard `changed_by_api_at`), allow-list uang + tes → commit.
### Task 5: Frontend — types/endpoints, `hr-sync` (+tes), layout/settings, halaman HR (gating angka & tab, Buat Payroll, aksi server-first), guard → `pnpm test`, vue-tsc, eslint → commit.
### Task 6: Dokumentasi + verifikasi — ADR-004, spec status, memory; migrate + seed; smoke; build; commit.
