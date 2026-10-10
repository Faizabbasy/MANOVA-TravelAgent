# Backend log aktivitas & entri perubahan project (S7d) — desain

Tanggal: 10 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-10-project-activities-backend)

S7d memindahkan log aktivitas project (`ACTIVITIES`) ke server: entri perubahan manual (catat, approve/reject) dan
log otomatis untuk aksi yang sudah dijalankan server. Log sistem / Activity Center (`SYSTEM_EVENTS`) tetap lokal (S10).

## Keputusan

| Topik | Keputusan |
|---|---|
| Lingkup | Entri perubahan manual + log otomatis untuk aksi server; Activity Center tetap lokal |
| Log otomatis | Ditulis server dalam transaksi aksinya, teks pesan sama dengan versi lokal |
| Aksi yang dicatat | Status booking (flight/hotel/transport/MICE, termasuk lewat pembatalan Finance); layanan ditandai `changed` manual (entri perubahan, perlu review); booking dobel disengaja (entri perubahan, perlu review); status service order (termasuk batal); project dibuat dari lead Won |
| Tidak dicatat server | Persetujuan klien MICE (tidak disimpan server), change request/insiden/pembatalan non-Finance (S8), RFQ & amend SO (S5), portal client — tetap log lokal |
| Catat perubahan | `project-order.log-change` (admin); peminta = user yang login (bukan isian body) |
| Approve/reject/review | Capability baru `project-order.review-change` (admin; super-admin lolos), disinkronkan ke `frontend/app/data/rbac.ts` |
| Entri perubahan otomatis | Bisa ditandai "sudah direview" (sebelumnya memicu tanda perlu perhatian selamanya) |
| ID lokal | Penulis lokal yang tersisa memakai prefix `ACT-L` / `CHG-L` agar tidak bentrok dengan ID server dan tidak terhapus saat sinkron |
| Baca | Seluruh peran internal; portal 403 |

## Backend

### Migrasi `0030_project_activities`

`project_activities`: `id` (`ACT-` log, `CHG-` perubahan manual), `project_id` FK not null, `message not null`,
`is_change boolean`, `reviewed boolean`, `reviewed_by` FK users, `reviewed_at`, `category` check ∈ `traveler,
itinerary, service, vendor, budget, other`, `reason`, `requested_by` FK users, `before_value`, `after_value`,
`impact_note`, `approval_status` check ∈ `pending, approved, rejected`, `approved_by` FK users, `actor_user_id` FK
users, `source_action`, `source_entity_id`, `provenance`, `created_at`; check `approval_status is null or is_change`;
index `(project_id, created_at)`. `id_sequences`: `ACT-`, `CHG-` (lanjut setelah fixture `ACT-1041`, `CHG-1034`).

### Endpoint

| Endpoint | Aturan |
|---|---|
| `GET /project-activities?projectId=` | peran internal; portal 403; urut `created_at desc, id desc` |
| `POST /projects/:id/changes` | Idempotency-Key; `project-order.log-change`; `category` valid & `reason` wajib (≤ 1000); `beforeValue`/`afterValue`/`impactNote` opsional; `requested_by` = aktor; `approval_status = pending`, `reviewed = false` |
| `POST /project-activities/:id/approve`, `/reject` | `project-order.review-change`; hanya entri `approval_status = pending` (lain 422); set status, `approved_by`, `reviewed = true`, `reviewed_by/at` |
| `POST /project-activities/:id/review` | `project-order.review-change`; hanya entri perubahan otomatis (`is_change`, tanpa approval) yang belum direview (lain 422) |

`recordProjectActivity(tx, { projectId, message, isChange, actorUserId, sourceAction, sourceEntityId })` dipanggil
dari: `setBookingStatus` (booking-status.ts), update layanan saat status berubah ke `changed` (service-writes.ts),
create booking dengan duplikat (booking-writes.ts), perubahan status & batal service order (service-orders.ts),
Won (won.ts). Pesan memakai nama aktor dari tabel `users`.

### Seed

9 entri fixture (`ACT-1011`, `ACT-1041`, `CHG-1021…1034`). Seed ulang memperbarui baris fixture yang belum
direview/di-approve lewat API (`reviewed_by is null and approved_by is null`); tidak menghapus baris API.

## Frontend

- Tipe `ProjectActivityDto`; endpoint `listProjectActivities`, `logProjectChange`, `approveProjectChange`,
  `rejectProjectChange`, `reviewProjectActivity` (namespace `core`).
- `data/activity-sync.ts`: muat `ACTIVITIES` (merge di tempat; entri `ACT-L*`/`CHG-L*` lokal dipertahankan),
  `reloadProjectActivities(api, projectId)`, fungsi tulis server-first; dipanggil layout dashboard dan reset settings.
- Setelah aksi server yang kini mencatat log (status booking, status/patch layanan, booking dobel, status service
  order, Won), frontend memuat ulang aktivitas project itu; penulisan `ACTIVITIES` lokal untuk aksi tersebut dihapus.
- Tab Riwayat Aktivitas project: catat perubahan, setujui/tolak lewat server, tombol baru "Tandai Direview" untuk
  entri perubahan otomatis (gate `project-order.review-change`). Audit Trail panel membaca `ACTIVITIES` reaktif.
- Guard `no-local-sales` melarang `createChangeEntry(`, `approveChangeEntry(`, `rejectChangeEntry(` di layar.

## Testing

- Backend (`test/project-activities.test.ts`): baca 200/403/401; catat perubahan (idempoten, validasi, finance 403,
  peminta = aktor); approve/reject sekali (kedua kali 422); review entri otomatis (kedua kali 422, entri manual 422);
  status booking & status service order menghasilkan log; booking dobel & layanan `changed` menghasilkan entri
  perubahan belum direview; Won menghasilkan log; seed (9 entri, seed ulang tidak menimpa yang di-approve).
- Frontend: tes `activity-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0030` otomatis. Setelah push: `bun run db:seed:demo` sekali.
