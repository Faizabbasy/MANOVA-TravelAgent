# Notifikasi ke Backend (S9b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifikasi internal dibuat server di transaksi aksinya dan dibaca per user.

**Architecture:** Migrasi 0033; modul `core/notifications.ts` (`notify`, list/read/read-all/remove) + `core/notification-routes.ts`; hook di `documents.ts`, `tasks.ts`, `incidents.ts`. Frontend `data/notifications-sync.ts`; lonceng & `/documents` dialihkan; `pushNotification` lokal tersisa hanya portal (`NOT-L`).

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-notifications-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; tanpa lockfile baru; jangan ubah migrasi 0001–0032; jangan `git add docs` (folder milik user).
- 400/404/401; audit dalam transaksi; vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. User tidak bisa membaca/mengubah notifikasi user lain (404) — Task 2.
2. Aktor tidak menotifikasi dirinya sendiri (mention diri / menugaskan diri) — Task 2.
3. Sinkron mempertahankan `NOT-L` portal dan hanya memuat milik user yang login — Task 4.
4. Notifikasi baru terlihat oleh penerima setelah lonceng dibuka (tanpa reload) — Task 4.
5. Tes lama task/insiden/pesan tetap hijau setelah hook — Task 2.

---

### Task 1: Migrasi 0033 + prefix — tes `notifications exist after 0033` → migrasi → commit.
### Task 2: API + hook — tes `test/notifications.test.ts` → `notifications.ts`, routes, hook mention/penugasan/eskalasi, mention hanya user internal → seluruh `bun run test` → commit.
### Task 3: Seed — 17 notifikasi; seed ulang menjaga baris API → commit.
### Task 4: Frontend — `notifications-sync.ts` (+tes), types/endpoints, layout/settings, lonceng (reload saat dibuka) & `/documents`, hapus `pushNotification` lokal yang kini server, prefix `NOT-L`, guard → `pnpm test`, vue-tsc, eslint → commit.
### Task 5: Dokumentasi + verifikasi — ADR-004, spec status, memory; migrate + seed; smoke; build; commit.
