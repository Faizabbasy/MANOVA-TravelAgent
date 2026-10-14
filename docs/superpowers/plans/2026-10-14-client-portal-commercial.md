# Portal Client — Quotation, Reservasi & Tagihan (S12a-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal client membaca quotation terkirim, reservasi (tanpa harga) dan tagihannya dari server dengan DTO whitelist; kebocoran field internal S12a ditutup.

**Architecture:** `core/client-commerce.ts` + `client-commerce-routes.ts` (`/client/*`, hanya role client); penyaring tambahan di `client-scope.ts` untuk route S12a; frontend `data/client-commerce-sync.ts` + panel portal memakai data server.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-client-portal-commercial-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; tanpa migrasi; jangan `git add docs` (folder milik user) — stage path eksplisit.
- DTO client dibangun dari whitelist; tidak pernah mengirim biaya/margin/net cost/vendor/rekening/ID staf internal.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Tidak ada field internal di DTO client (dicek per kunci, termasuk di dalam `details`) — Task 2/3/4.
2. Quotation yang belum dikirim (draft/submitted/revisi belum dikirim ulang) tidak muncul — Task 2.
3. Invoice di-scope ke party yang ditagih; draft tidak muncul; party lain tidak muncul — Task 4.
4. Reservasi tanpa uang sama sekali — Task 3.
5. Data lokal portal tidak rusak saat data server dimuat (mapper khusus, bukan `bookingFromServer`) — Task 5.

---

### Task 1: Pembersihan S12a — tes → penyaring client untuk dokumen, traveler, pembatalan, pesan, change request → commit.
### Task 2: `GET /client/quotations` — tes → implementasi → commit.
### Task 3: `GET /client/reservations` — tes → implementasi (whitelist `details` per tipe) → commit.
### Task 4: `GET /client/invoices` (+ detail) — tes → implementasi (scope party ditagih, ringkasan) → seluruh `bun run test` + typecheck → commit.
### Task 5: Frontend — types/endpoints, `client-commerce-sync` (+tes mapper), sync plan client, panel quotation/reservasi/tagihan memakai data server → `pnpm test`, vue-tsc, eslint → commit.
### Task 6: Dokumentasi + verifikasi — ADR-004/ADR-007, spec status, memory; smoke; build; commit.
