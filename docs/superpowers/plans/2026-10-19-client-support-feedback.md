# Tiket support & feedback perjalanan (S12c-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tiket support dan feedback perjalanan client tersimpan di server; staf menangani tiket di inbox baru dan meninjau feedback di panel CRM yang menulis ke server.

**Architecture:** Migrasi 0041 (`support_tickets`, `support_ticket_replies`, `project_feedback`). Backend `core/support-tickets.ts` + `core/feedback.ts`, rute client di `client-write-routes.ts`, rute staf di `core/support-routes.ts`. Capability baru `support.manage-ticket` (Admin). Frontend: sync `clientSupport`, layar portal server-first, halaman staf `/support`, `FeedbackPanel` lewat server.

**Tech Stack:** Bun + Elysia + PGlite (backend), Nuxt 4 + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-10-19-client-support-feedback-design.md`

## Global Constraints

- Migrasi `0041_support_tickets_feedback.{up,down}.sql`; prefix `TCK-`, `TCKR-`, `FBK-` di `shared/ids.ts` SOURCES.
- `support.manage-ticket` → `['admin']` di `backend/src/auth/rbac.ts` **dan** `frontend/app/data/rbac.ts` (+ katalog capability bila ada, pola `marketing.manage-content` S11b).
- Client hanya melihat balasan `is_internal = false`; DTO client tanpa `is_internal` row.
- Notifikasi: staf via `notifyInternal`, client via `notify`; tidak pernah ke pelaku.
- Feedback hanya untuk project `ongoing-trip`/`completed` milik party; satu feedback per project.
- Commit tiap task, stage path eksplisit; trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verifikasi: `bun test <file> --timeout 30000`, typecheck, `pnpm test`, vue-tsc ≤ 1987, eslint vs HEAD, build.

## Review Focus

1. Catatan internal staf tidak pernah muncul di `GET /client/support-tickets` (Task 2 test).
2. Client membuat tiket dengan `projectId` milik party lain → 404 (Task 1).
3. Feedback untuk project `planning` → 422; submit tanpa skor wajib → 400 (Task 3).
4. Tiket tanpa project → semua Admin aktif diberi tahu, bukan nol orang (Task 1).
5. Rating di luar 1–5 → 400; reopen tanpa alasan → 400 (Task 1).

---

### Task 1: Migrasi 0041 + capability + tiket dari sisi client
**Files:** migrasi 0041, `shared/ids.ts`, `auth/rbac.ts` + `frontend/app/data/rbac.ts` (+ `rbac.test`/katalog bila ada), `core/support-tickets.ts`, `client-write-routes.ts`; test `backend/test/support-tickets.test.ts`.
**Produces:** `listSupportTickets(db, filter)`, `listTicketReplies(db, ticketId, { includeInternal })`, `clientCreateTicket`, `clientReplyTicket`, `clientConfirmTicket`, `clientReopenTicket`, `clientRateTicket`, view `clientSupportTicket`.
- [ ] Tes gagal: create dengan project (assigned ke owner, notif owner, aktivitas project), tanpa project (open, semua admin aktif diberi notif), billing (Finance diberi notif), project party lain 404, validasi (subjek/deskripsi kosong, kategori/prioritas tak dikenal 400), replay key; list client hanya tiket party + balasan non-internal; reply (waiting-for-client → in-progress); confirm hanya dari resolved; reopen butuh alasan & dari resolved/closed; rate 1–5 dari resolved/closed; role lain 403.
- [ ] FAIL → implementasi → PASS (+ `db.test`, typecheck). Commit `feat(core): tiket support dari portal client — penugasan ke owner project / antrean, balasan, konfirmasi, buka ulang, rating; migrasi 0041 (S12c-2)`.

### Task 2: Inbox staf tiket
**Files:** `core/support-routes.ts` (prefix `/api/v1`), `app.ts`; test tambahan.
**Produces:** `staffAssignTicket`, `staffSetTicketStatus`, `staffReplyTicket` (internal flag), `staffResolveTicket`, `staffCloseTicket`; rute `/support-tickets*`.
- [ ] Tes gagal: list/detail (admin 200 dengan balasan internal; finance/client 403); assign ke user internal (user portal → 400); status in-progress/waiting-for-client; balasan publik → client diberi notif & terlihat di `/client/...`; catatan internal → tak terlihat client & tanpa notif client; resolve butuh catatan → client diberi notif; close dari resolved; transisi salah 422.
- [ ] FAIL → implementasi → PASS. Commit `feat(core): inbox staf tiket support — tugaskan, status, balasan & catatan internal, selesaikan, tutup (S12c-2)`.

### Task 3: Feedback perjalanan
**Files:** `core/feedback.ts`, rute client & staf; test `backend/test/project-feedback.test.ts`.
**Produces:** `listFeedback(db, filter)`, `saveFeedbackDraft`, `submitFeedback`, `acknowledgeFeedback`, `flagFeedbackFollowUp`, `closeFeedback`.
- [ ] Tes gagal: draft untuk project party berstatus ongoing-trip/completed (planning → 422, party lain 404), skor di luar rentang 400, submit wajib overall & NPS, setelah submit tidak bisa diubah 422, owner diberi notif + aktivitas project; staf acknowledge/follow-up (catatan wajib)/close; role tanpa `crm.manage-follow-up` 403; list staf memuat feedback.
- [ ] FAIL → implementasi → PASS. Commit `feat(core): feedback perjalanan client di server + tinjauan staf CRM (S12c-2)`.

### Task 4: Frontend — tipe, endpoint, sync client
**Files:** `types/api.ts`, `lib/api/endpoints.ts`, `data/support-sync.ts` (+test), `data/sync-plan.ts` (+test: client + `clientSupport`), `layouts/dashboard.vue`, `data/client-portal-writes.ts` (+test).
- [ ] Tes gagal: mapper tiket/balasan/feedback server → lokal (`clientPartyId`, status, rating, SLA tetap dihitung lokal), merge mengganti data party client saja; fungsi tulis client meng-upsert hasil server.
- [ ] Implementasi → PASS → commit `feat(frontend): tipe & sync tiket support dan feedback client (S12c-2)`.

### Task 5: Frontend — portal client
**Files:** `components/client/SupportListPanel.vue`, `pages/client/support/[id]/index.vue`, `pages/client/feedback/[projectId]/index.vue`, guard.
- [ ] Guard gagal: FORBIDDEN `createSupportTicket(`, `replySupportTicket(`, `confirmSupportTicketResolution(`, `reopenSupportTicket(`, `rateSupportTicketResolution(`, `saveFeedbackDraft(`, `submitFeedback(`.
- [ ] Implementasi server-first (save gate); feedback terkunci + pesan bila project belum berangkat → PASS → commit `feat(frontend): tiket support & feedback di portal client lewat server (S12c-2)`.

### Task 6: Frontend — staf
**Files:** `pages/support/index.vue`, `pages/support/[id].vue`, `constants/navigation.ts`, `components/crm/FeedbackPanel.vue`, helper `lib/support.ts` (+test: label status/SLA, aksi staf per status).
- [ ] Tes helper gagal → implementasi halaman inbox & detail (muat sendiri dari server), menu untuk `support.manage-ticket`, FeedbackPanel memuat `GET /feedback` dan aksi ke server → PASS → commit `feat(frontend): inbox tiket support staf & panel feedback CRM lewat server (S12c-2)`.

### Task 7: Dokumentasi + verifikasi
- [ ] Smoke (salinan DB dev → migrasi 41): client buat tiket PRJ-201 → admin lihat di inbox, balas publik + catatan internal → client lihat hanya balasan publik → resolve → client rate; feedback untuk project PTY-005 berstatus completed/ongoing-trip.
- [ ] Suite penuh, `pnpm test`, vue-tsc, build. ADR-004/ADR-006 + status spec; commit docs.
