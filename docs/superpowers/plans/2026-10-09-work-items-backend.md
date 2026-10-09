# Task & Milestone ke Backend (S7c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Task project (`TASKS`) dan milestone (`PROJECT_MILESTONES`) dimiliki server; layar internal menulis lewat API.

**Architecture:** Migrasi 0029 (`project_tasks`, `project_milestones` dengan deliverable jsonb). Modul backend
`core/tasks.ts`, `core/milestones.ts`, satu file routes `core/work-item-routes.ts` mengikuti pola S7b
(`itinerary.ts`/`itinerary-routes.ts`). `createProject` membuat 8 milestone default. Frontend `data/work-items-sync.ts`
server-first; layar dialihkan; guard diperluas.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vue 3 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-work-items-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/` (jalankan dari folder itu); jangan tambah lockfile.
- Uang: `bigint` minor di SQL, string desimal di wire (`budgetMinor`).
- Tulis: `project-order.manage-operations`; baca: peran internal, portal 403.
- Pesan Indonesia; validasi 400, aturan bisnis 422 (`AppError(422,'RULE_VIOLATION')`), tidak ada 404.
- Jangan ubah migrasi 0001–0028. vue-tsc ≤ 1983 (baseline); eslint per file tidak naik vs HEAD.

## Review Focus

1. Drag task ke kolom lain lalu server menolak → kolom board kembali ke posisi semula (bukan tertinggal di kolom baru) — Task 5 (resync board di cabang gagal).
2. `dependsOnTaskId` menunjuk task project lain atau dirinya sendiri → 400 — Task 2.
3. `replace` dengan satu item tidak valid → tidak ada milestone yang terhapus (atomik) — Task 3.
4. Project baru dengan tanggal berangkat dekat → milestone default tidak di masa lalu (clamp ke hari ini) — Task 3.
5. Seed ulang tidak menimpa task/milestone yang diubah API — Task 4.

---

### Task 1: Migrasi 0029 + ID prefix

**Files:** Create `backend/migrations/0029_work_items.{up,down}.sql`; Modify `backend/src/shared/ids.ts` (`'TSK-'`, `'PMS-'`); Test `backend/test/db.test.ts`.

- [ ] Tes gagal `work items exist after 0029`: insert task tanpa project OK; task `is_blocked=true` tanpa alasan ditolak; status `archived` ditolak; milestone `budget_minor` negatif ditolak; `deliverables` bukan array ditolak; prefix `TSK-`,`PMS-` ada.
- [ ] Migrasi sesuai spec (kolom, check, index, `id_sequences`); down membalik.
- [ ] Tes lulus; commit `feat(core): tabel project_tasks & project_milestones (S7c)`.

### Task 2: API task

**Files:** Create `backend/src/modules/core/tasks.ts`, `backend/src/modules/core/work-item-routes.ts`, `backend/test/work-items.test.ts`; Modify `backend/src/app.ts`.

**Produces:** `listTasks(db, {id?, projectId?})` → `TaskView {id, projectId, title, status, dueAt, isMilestone, dependsOnTaskId, assignedTo, isBlocked, blockedReason}`;
`createTask`, `updateTask`, `blockTask(tx, actor, id, reason, requestId)`, `unblockTask`; routes `GET/POST /tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/block|unblock`.

- [ ] Tes gagal (`describe('tasks')`): baca finance 200, portal 403, anon 401; create idempoten (project & tanpa project); validasi: judul kosong, status tak dikenal, tanggal salah, `dependsOnTaskId` project lain, project tidak ada (400 `projectId`), user tidak ada → 400; finance tulis 403; PATCH status/assignee/null mengosongkan; PATCH `projectId` → 400; PATCH `dependsOnTaskId` = diri sendiri → 400; block tanpa alasan 400, block 2× 422, unblock belum terblokir 422; ID tidak ada 404.
- [ ] Implementasi pola `itinerary.ts` (cleanTask, lockTask `for update`, audit `task.created|updated|blocked|unblocked`).
- [ ] Tes lulus + `bun run typecheck`; commit `feat(core): API task project (S7c)`.

### Task 3: API milestone + milestone default project baru

**Files:** Create `backend/src/modules/core/milestones.ts`; Modify `work-item-routes.ts`, `project-writes.ts` (`createProject` memanggil `createDefaultMilestones(tx, id, start, end, today)`), `backend/test/work-items.test.ts`.

**Produces:** `listMilestones(db, {id?, projectId?})` → `MilestoneView {id, projectId, stepKey, name, plannedDate, actualDate, ownerId, status, note, budgetMinor, deliverables}`;
`createMilestone`, `updateMilestone`, `completeMilestone(tx, actor, id, today, requestId)`, `addDeliverable`, `setDeliverableDone`, `removeDeliverable`, `replaceMilestones(tx, actor, projectId, items, requestId)`, `createDefaultMilestones(tx, projectId, startDate, endDate, today)`.

- [ ] Tes gagal (`describe('milestones')`): baca 200/403; create idempoten + validasi (nama/tanggal wajib, budget negatif, owner tidak ada) + finance 403 + project tidak ada 404; PATCH note '' → null; PATCH plannedDate pada project status `confirmed` → 422, pada project `draft` OK; complete → status completed + actualDate hari ini, complete 2× → 422; deliverable tambah (ID `PMD-<ms>-<n>`), centang, hapus, deliverable tidak ada 404; replace mengganti seluruh milestone project; replace dengan item tanpa nama → 400 dan milestone lama utuh; `POST /projects` membuat 8 milestone default urut, tidak ada `plannedDate` < hari ini.
- [ ] Implementasi; `createDefaultMilestones` porting `seedDefaultProjectMilestones` (offset −60/−45/−40/−30/−14 dari berangkat, berangkat, pulang, +5 dari pulang; clamp ≥ today), `step_key` sesuai frontend.
- [ ] Tes lulus + seluruh `bun run test` (tes project lain mungkin menghitung audit/baris — sesuaikan dengan Ruling); commit `feat(core): API milestone & milestone default project baru (S7c)`.

### Task 4: Seed demo task & milestone

**Files:** Modify `backend/scripts/extract-demo-core.ts`, `backend/src/db/seeds/demo-core.json` (`bun run seed:extract`), `backend/src/db/seed-demo.ts`, `backend/test/db.test.ts` (seed test + allow-list `budgetMinor`).

- [ ] Tes gagal: seed → 16 task, 32 milestone; ubah TSK-1011 & PMS-101-1 dengan `changed_by_api_at`, seed ulang → perubahan bertahan.
- [ ] Extract (`dueAt`→`dueOn`, `budgetIdr`→`budgetMinor` string, deliverables apa adanya) + upsert seed (task setelah users/projects; `depends_on` diisi di loop kedua).
- [ ] Tes lulus + `bun run test`; commit `feat(core): seed task & milestone demo (S7c)`.

### Task 5: Frontend sync + layar + guard

**Files:** Modify `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`; Create `frontend/app/data/work-items-sync.ts` (+ `.test.ts`); Modify `layouts/dashboard.vue`, `pages/settings.vue`, `data/projects-sync.ts` (`registerNewServerProject` tidak lagi memanggil `seedDefaultProjectMilestones`; pemanggil memuat ulang milestone project), `pages/project-orders/[id]/index.vue`, `components/operations/TasksPanel.vue`, `components/operations/MilestonesPanel.vue`, `no-local-sales.test.ts`.

**Produces:** `taskFromServer`, `milestoneFromServer`, `mergeServerWorkItems(tasks, milestones)`, `loadServerWorkItems(api)`, `reloadProjectMilestones(api, projectId)`, `createTaskOnServer`, `updateTaskOnServer`, `blockTaskOnServer`, `unblockTaskOnServer`, `createMilestoneOnServer`, `updateMilestoneOnServer`, `completeMilestoneOnServer`, `addDeliverableOnServer`, `setDeliverableDoneOnServer`, `removeDeliverableOnServer`, `replaceMilestonesOnServer`, `useWorkItemsSync()`.

- [ ] Tes gagal `work-items-sync.test.ts`: mapping (null→undefined, `budgetMinor`→`budgetIdr`), merge menjaga identitas & membuang yang hilang, create task memicu notifikasi penugasan lokal, update ditolak tidak mengubah lokal, replace mengganti milestone project saja.
- [ ] Implementasi sync + types/endpoints + wiring layout/settings; guard ditambah daftar spec → merah di layar; rewire layar (helper `workItemAction` pola `itineraryAction`; drag gagal → resync board).
- [ ] `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD; commit `feat(frontend): task & milestone dari server (S7c)`.

### Task 6: Dokumentasi + verifikasi akhir

- ADR-004 catatan S7c, spec status "diimplementasikan", memory progress; migrate + seed DB lokal; smoke test API (port 3100); `pnpm build`.
- Commit `docs: catatan S7c task & milestone di ADR-004`.
