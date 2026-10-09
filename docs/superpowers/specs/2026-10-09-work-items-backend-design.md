# Backend item kerja project: task & milestone (S7c) — desain

Tanggal: 9 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-09-work-items-backend)

S7c memindahkan **task** (`TASKS`) dan **milestone** (`PROJECT_MILESTONES`, termasuk checklist deliverable) ke
server. Log aktivitas & entri perubahan (`ACTIVITIES`, `SYSTEM_EVENTS`) menyusul di S7d.

## Keputusan

| Topik | Keputusan |
|---|---|
| Lingkup | Task + milestone (deliverable, template, milestone default project baru) |
| Hak tulis | `project-order.manage-operations` (admin; super-admin lolos) — sama dengan gate layar sekarang |
| Hak baca | Seluruh peran internal; portal 403 |
| Milestone default project baru | Dibuat server di `createProject` (dipakai `POST /projects` dan Won lead), satu transaksi |
| Template milestone | Tetap data master lokal; frontend menghitung daftar, server mengganti seluruh milestone project |
| Tanggal rencana milestone | Ditolak (422) bila status project bukan `draft`/`planning` (tahap Drafting) — aturan yang sama dengan kunci di layar |
| Hapus | Task tidak punya hapus (layar juga tidak); milestone hanya terganti lewat template |
| Notifikasi penugasan | Tetap mock lokal, dipicu frontend setelah server sukses |
| Tetap lokal | Risiko (tanpa layar), catatan project & shift notes (layar hanya membaca), template milestone, log aktivitas (S7d) |

## Backend

### Migrasi `0029_work_items`

- `project_tasks`: `id` (`TSK-`), `project_id` FK projects **nullable** (tugas umum dari `/tasks`), `title not null`
  (≠ ''), `status` check ∈ `not-started, in-progress, pending-confirmation, done, overdue` default `not-started`,
  `due_on date`, `is_milestone boolean default false`, `depends_on` FK project_tasks, `assigned_to` FK users,
  `is_blocked boolean default false`, `blocked_reason`, check `is_blocked = (blocked_reason is not null)`,
  `changed_by_api_at`, `provenance`, `created_at`, `updated_at`; index `(project_id)`.
- `project_milestones`: `id` (`PMS-`), `project_id` FK not null, `step_key` check ∈ langkah workflow
  (`drafting, confirmed, start, departure, on-progress, done`), `name not null`, `planned_on date not null`,
  `actual_on date`, `owner_id` FK users, `status` check ∈ `not-started, in-progress, completed, delayed, cancelled`,
  `note`, `budget_minor bigint ≥ 0`, `deliverables jsonb not null default '[]'` (array `{id,label,done}`),
  `changed_by_api_at`, `provenance`, `created_at`, `updated_at`; index `(project_id, planned_on)`.
- `id_sequences`: `TSK-`, `PMS-`. Fixture `PMS-101-1` tidak cocok pola angka, jadi ID baru mulai `PMS-001` tanpa bentrok.

### Task

| Endpoint | Aturan |
|---|---|
| `GET /tasks?projectId=` | peran internal; portal 403; urut `due_on nulls last, id` |
| `POST /tasks` | Idempotency-Key; `title` wajib; `projectId` opsional (project harus ada); `status` valid; `dueAt` `YYYY-MM-DD`; `dependsOnTaskId` task project yang sama (bukan diri sendiri); `assignedTo` user yang ada |
| `PATCH /tasks/:id` | `title`, `status`, `dueAt`, `isMilestone`, `dependsOnTaskId`, `assignedTo` (null mengosongkan); `projectId`/blokir tidak lewat PATCH |
| `POST /tasks/:id/block { reason }` | alasan wajib; sudah terblokir → 422 |
| `POST /tasks/:id/unblock` | kosongkan blokir; belum terblokir → 422 |

### Milestone

| Endpoint | Aturan |
|---|---|
| `GET /milestones?projectId=` | peran internal; urut `planned_on, id` |
| `POST /projects/:id/milestones` | Idempotency-Key; `name` + `plannedDate` wajib; `ownerId` user; `budgetMinor` string ≥ 0; `note`; status awal `not-started` |
| `PATCH /milestones/:id` | `name`, `note` (kosong = hapus), `ownerId`, `budgetMinor`, `plannedDate` (422 bila project lewat Drafting) |
| `POST /milestones/:id/complete` | `actual_on` = hari ini (tanggal bisnis), `status = completed`; sudah selesai/batal → 422 |
| `POST /milestones/:id/deliverables { label }` | label wajib; ID `PMD-<milestoneId>-<n>` (n = terbesar + 1) |
| `PATCH /milestones/:id/deliverables/:deliverableId { done }` | boolean; tidak ada → 404 |
| `DELETE /milestones/:id/deliverables/:deliverableId` | tidak ada → 404 |
| `POST /projects/:id/milestones/replace { milestones: [{ name, plannedDate, stepKey? }] }` | ganti SELURUH milestone project dalam satu transaksi (template); minimal 1 item, tiap item divalidasi |

Respons milestone/task = bentuk GET. Semua tulis: perubahan + `recordAudit` satu transaksi, `changed_by_api_at = now()`.

```ts
TaskDto { id, projectId: string|null, title, status, dueAt: string|null, isMilestone: boolean,
  dependsOnTaskId: string|null, assignedTo: string|null, isBlocked: boolean, blockedReason: string|null }
MilestoneDto { id, projectId, stepKey: string|null, name, plannedDate, actualDate: string|null, ownerId: string|null,
  status, note: string|null, budgetMinor: string|null, deliverables: { id, label, done }[] }
```

### Milestone default project baru

`createProject` (setelah insert project) membuat 8 milestone default dengan aturan `seedDefaultProjectMilestones`
frontend: SPK/Handover (−60 hari dari berangkat), Finalisasi Itinerary (−45), Invoice DP Terbit (−40), Konfirmasi
Vendor & Booking (−30), Dokumen Traveler Lengkap (−14), Keberangkatan (hari berangkat), Trip Selesai (hari pulang),
Laporan Akhir & Review Klien (+5 dari pulang); tanggal sebelum hari ini (tanggal bisnis) di-clamp ke hari ini.

### Seed

16 task dan 192 milestone fixture (32 literal + riwayat PRJ-301…340) lewat `extract-demo-core.ts`. Seed ulang memperbarui baris fixture yang
`changed_by_api_at` kosong; tidak menyentuh yang sudah diubah API. Project demo tidak mendapat milestone default
tambahan (hanya `createProject` lewat API yang membuatnya).

## Frontend

- Tipe `TaskDto`, `TaskInput`, `MilestoneDto`, `MilestoneInput` di `types/api.ts`; endpoint namespace `core`.
- `data/work-items-sync.ts`: muat `TASKS` dan `PROJECT_MILESTONES` (merge di tempat; `dueOn`→`dueAt`,
  `budgetMinor`→`budgetIdr`); `useWorkItemsSync()` di `layouts/dashboard.vue` (peran internal) dan reset
  `settings.vue`; fungsi tulis server-first untuk seluruh aksi di atas. Setelah buat project (`registerNewServerProject`)
  milestone project itu dimuat ulang dari server; `seedDefaultProjectMilestones` lokal tidak dipanggil lagi.
- Dialihkan ke server: tab Task, Milestone & Timeline Tracking `pages/project-orders/[id]/index.vue` (tambah/ubah
  task, ubah status termasuk drag, blokir/buka blokir, tambah milestone, tanggal rencana, catatan, tandai selesai,
  deliverable, terapkan template), `components/operations/TasksPanel.vue`, `components/operations/MilestonesPanel.vue`.
  Gagal simpan: toast alasan, form tetap terbuka, data lokal tidak berubah; tombol nonaktif selama menyimpan.
- Guard `no-local-sales` melarang `createProjectTask(`, `updateProjectTask(`, `toggleTaskBlocked(`,
  `createProjectMilestone(`, `setMilestoneActualDate(`, `updateMilestonePlannedDate(`, `updateMilestoneNote(`,
  `applyMilestoneTemplate(`, `addMilestoneDeliverable(`, `toggleMilestoneDeliverable(`, `removeMilestoneDeliverable(`,
  `updateMilestoneBudget(`, `seedDefaultProjectMilestones(` di pages/components/composables/layouts.

## Testing

- Backend (`test/work-items.test.ts`): CRUD + validasi (judul wajib, status, tanggal, prasyarat project lain/diri
  sendiri, user tidak ada, nominal negatif) + 401/403/404; blokir tanpa alasan → 400, blokir dua kali → 422; tanggal
  rencana setelah Drafting → 422; complete dua kali → 422; deliverable tambah/centang/hapus; replace mengganti seluruh
  milestone project atomik; `POST /projects` membuat 8 milestone default; seed ulang tidak menimpa perubahan;
  migrasi 0029 di `db.test.ts`.
- Frontend: tes `work-items-sync`, guard, `pnpm test`, vue-tsc ≤ baseline, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0029` otomatis. Setelah push: `bun run db:seed:demo` sekali (task & milestone demo).
