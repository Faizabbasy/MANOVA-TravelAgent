# Log Aktivitas & Perubahan ke Backend (S7d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ACTIVITIES` dimiliki server: entri perubahan manual + log otomatis aksi server.

**Architecture:** Migrasi 0030 `project_activities`; modul `core/activities.ts` (list, `recordProjectActivity`, catat/approve/reject/review) + `core/activity-routes.ts`; hook di modul booking/layanan/service order/Won. Frontend `data/activity-sync.ts`, penulis lokal untuk aksi server dihapus, sisanya prefix `ACT-L`/`CHG-L`.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-project-activities-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; tanpa lockfile baru. Jangan ubah migrasi 0001–0029.
- Pesan Indonesia; 400 validasi, 422 aturan, 404 tidak ada; `recordAudit` dalam transaksi yang sama.
- `frontend/app/data/rbac.ts` dan `backend/src/auth/rbac.ts` tetap sinkron.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Pembatalan booking lewat Finance (memanggil `setBookingStatus`) juga menghasilkan log, tanpa melanggar transaksi Finance — Task 3.
2. Sinkron tidak menghapus entri lokal `ACT-L*`/`CHG-L*` (change request/insiden lokal) — Task 4.
3. Approve/reject entri yang sudah diputuskan → 422, bukan menimpa — Task 2.
4. Entri perubahan otomatis bisa ditandai direview → tanda "perlu perhatian" hilang — Task 2 & 5.
5. Hitungan audit/baris di tes lama (booking, service order, Won, Finance cancel) tetap hijau setelah hook — Task 3.

---

### Task 1: Migrasi 0030 + prefix ID
- [ ] Tes `project activities exist after 0030` di `db.test.ts` (insert log OK, `approval_status` tanpa `is_change` ditolak, kategori tak dikenal ditolak, prefix ada) → merah → migrasi up/down + `ids.ts` (`ACT-`, `CHG-`) → hijau → commit `feat(core): tabel project_activities (S7d)`.

### Task 2: API aktivitas + entri perubahan
- [ ] Tes `test/project-activities.test.ts`: baca 200/403/401; `POST /projects/:id/changes` idempoten, validasi (kategori, alasan kosong), finance 403, project tidak ada 404, `requestedBy` = aktor; approve lalu approve lagi 422; reject; review entri manual 422; review entri otomatis (dibuat langsung via `recordProjectActivity` di tes? — tidak: dibuat lewat aksi Task 3; di Task 2 cukup 404 untuk ID tak ada).
- [ ] `core/activities.ts` (`listActivities`, `recordProjectActivity`, `logChange`, `decideChange`, `markReviewed`), `core/activity-routes.ts`, capability `project-order.review-change` di backend & frontend rbac, registrasi di `app.ts`.
- [ ] Hijau + typecheck; commit `feat(core): API log aktivitas & entri perubahan project (S7d)`.

### Task 3: Log otomatis dari aksi server
- [ ] Tes di `project-activities.test.ts`: ubah status booking → log "status diubah"; buat booking dobel (allowDuplicate) → entri perubahan belum direview, lalu `review` → reviewed, review lagi 422; PATCH layanan ke `changed` → entri perubahan; status service order → log; Won → log "dibuat dari Lead".
- [ ] Hook `recordProjectActivity` di booking-status.ts, service-writes.ts, booking-writes.ts, service-orders.ts, won.ts.
- [ ] Hijau + seluruh `bun run test`; commit `feat(core): server mencatat log aktivitas project (S7d)`.

### Task 4: Seed demo
- [ ] Tes seed: 9 entri; approve `CHG-1023` lewat SQL (`approved_by`), seed ulang tidak menimpa → merah → extract + seed → hijau → commit `feat(core): seed log aktivitas demo (S7d)`.

### Task 5: Frontend
- [ ] Tes `activity-sync.test.ts` (mapping, merge mempertahankan `ACT-L`, approve ditolak tidak mengubah lokal, reload proyek) → merah → `activity-sync.ts`, types, endpoints, wiring layout/settings → hijau.
- [ ] Guard ditambah `createChangeEntry(`, `approveChangeEntry(`, `rejectChangeEntry(` → merah → project page memakai server (catat/setujui/tolak/tandai direview).
- [ ] Hapus penulisan `ACTIVITIES` lokal untuk aksi server (updateServiceStatus changed, update*BookingStatus ×4, flagBookingOrchestrationDuplicate, updateServiceOrderStatus untuk order server, applyLeadWon); sync helper terkait memanggil `reloadProjectActivities`; penulis lokal sisanya prefix `ACT-L`/`CHG-L`; AuditTrailPanel reaktif.
- [ ] `pnpm test`, vue-tsc, eslint; commit `feat(frontend): log aktivitas & perubahan dari server (S7d)`.

### Task 6: Dokumentasi + verifikasi
- ADR-004 S7d, spec status, memory; migrate + seed lokal; smoke API; `pnpm build`; commit `docs: catatan S7d di ADR-004`.
