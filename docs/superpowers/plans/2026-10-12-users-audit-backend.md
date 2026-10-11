# User & Jejak Audit ke Backend (S10a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kelola user (suspend/aktifkan/role) di server khusus Super Admin; Activity Center & Session Log dari audit server.

**Architecture:** Migrasi 0034 (kolom user); `core/users.ts`, `core/audit-reads.ts`, `core/admin-routes.ts`. Frontend `data/users-sync.ts`, `data/audit-sync.ts`; panel user & role dialihkan; role switcher menolak user suspended.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-users-audit-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan ubah migrasi 0001–0033; jangan `git add docs` (folder milik user).
- Hak user hanya `admin.manage-users` (Super Admin); matriks RBAC server tidak diubah.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Admin biasa tidak bisa suspend/ganti role siapa pun (403) — Task 2.
2. Super Admin aktif terakhir tidak bisa di-suspend/diturunkan; tidak bisa mengubah diri sendiri — Task 2.
3. Suspend & ganti role mengakhiri sesi user itu — Task 2.
4. Seed ulang tidak membatalkan suspend/role dari API — Task 3.
5. Role switcher menolak user suspended; gate panel user memakai `admin.manage-users` — Task 4.

---

### Task 1: Migrasi 0034 — tes kolom & check → migrasi → commit.
### Task 2: API user & audit — tes `test/users-audit.test.ts` → `users.ts`, `audit-reads.ts`, `admin-routes.ts` → seluruh `bun run test` → commit.
### Task 3: Seed — status/role user yang diubah API tidak ditimpa → commit.
### Task 4: Frontend — `users-sync`, `audit-sync` (+tes), types/endpoints, layout/settings, `UsersDirectoryPanel` & `RolesPermissionsPanel` (assign), `setCurrentUser` menolak suspended, Activity Center & Session Log dari server, guard → `pnpm test`, vue-tsc, eslint → commit.
### Task 5: Dokumentasi + verifikasi — ADR-004, spec status, memory; migrate + seed; smoke; build; commit.
