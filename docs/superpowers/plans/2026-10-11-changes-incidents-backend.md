# Change Request, Insiden & Pembatalan ke Backend (S8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change request, insiden, dan pembatalan non-Finance dimiliki server; gate workflow ditegakkan server.

**Architecture:** Migrasi 0031; modul `core/change-requests.ts`, `core/incidents.ts`, hook no-show/refunded di `booking-writes.ts`, gate di `project-workflow.ts`; routes `core/change-routes.ts`. Frontend `data/changes-sync.ts`; layar `/changes*` dan dialog booking dialihkan.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-changes-incidents-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; tanpa lockfile baru; jangan ubah migrasi 0001–0030.
- 400 validasi, 422 aturan, 404 tidak ada; audit + log aktivitas dalam transaksi yang sama; uang string minor di wire.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Membuat CR membuat tepat satu `CHG-` dan memutuskan CR memutuskan `CHG-` itu (bukan entri lain) — Task 2.
2. Gate `→ in-progress` / `→ completed` menolak dengan pesan jelas; tes workflow lama tetap hijau (fixture tanpa insiden/CR terbuka) — Task 4.
3. `penaltyMinor` ditolak untuk status selain no-show/refunded; pembatalan `cancelled` tidak membuat `CNX-` — Task 4.
4. Sinkron tidak menghapus CR klien lokal (`CR-L…`) — Task 6.
5. Seed ulang tidak menimpa CR/insiden yang diubah API — Task 5.

---

### Task 1: Migrasi 0031 + prefix
- [ ] Tes `changes, incidents and cancellations exist after 0031` (insert valid; status/source/severity/outcome tak dikenal ditolak; prefix) → merah → migrasi up/down + ids.ts → hijau → commit.

### Task 2: API change request
- [ ] Tes `test/changes-incidents.test.ts` describe `change requests`: baca/403/401; buat idempoten (membuat `CHG-` pending dengan `activityId`), validasi, finance 403, project 404; review → approve (CHG ikut approved) → implement; reject tanpa alasan 400; transisi salah 422.
- [ ] `core/change-requests.ts`, `core/change-routes.ts`, `app.ts`; hijau; commit.

### Task 3: API insiden
- [ ] Tes describe `incidents`: buat (validasi tingkat/PIC/booking project lain), status (transisi salah 422, `resolved` lewat status 400), eskalasi (target wajib), komunikasi, resolve (catatan wajib), log aktivitas tercatat.
- [ ] `core/incidents.ts` + routes; hijau; commit.

### Task 4: No-show/refunded + gate workflow
- [ ] Tes: transport no-show dengan `penaltyMinor` → `GET /booking-cancellations` berisi `CNX-` (penalty, outcome); `penaltyMinor` pada status lain 400; gate in-progress dengan insiden open 422; gate completed dengan CR submitted 422.
- [ ] Hook di `changeBookingStatus` + route; gate di `transition`; seluruh `bun run test` hijau; commit.

### Task 5: Seed
- [ ] Tes seed (7 CR, 4 insiden, 3 pembatalan; seed ulang menjaga perubahan API) → extract + seed → hijau → commit.

### Task 6: Frontend
- [ ] Tes `changes-sync.test.ts` → `changes-sync.ts` + types/endpoints + layout/settings.
- [ ] Guard → layar `/changes`, `/changes/[id]`, `/changes/incidents/[id]`, dialog no-show/refunded (ticketing/accommodation/transportation) + hapus `createCancellationRecord` di jalur Finance.
- [ ] `pnpm test`, vue-tsc, eslint; commit.

### Task 7: Dokumentasi + verifikasi
- ADR-004 S8, spec status, memory; migrate + seed lokal; smoke; `pnpm build`; commit.
