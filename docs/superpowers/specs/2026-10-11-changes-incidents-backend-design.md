# Backend change request, insiden & pembatalan non-Finance (S8) — desain

Tanggal: 11 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-11-changes-incidents-backend)

S8 memindahkan alur internal change request, insiden, dan catatan pembatalan non-Finance ke server, dan server
menegakkan gate workflow yang bergantung pada keduanya. Alur portal klien (draft, cek ketersediaan, estimasi biaya,
persetujuan klien, komentar, lampiran) tetap lokal (ADR-006).

## Keputusan

| Topik | Keputusan |
|---|---|
| Change request | Server; alur internal `submitted → under-review → approved/rejected → implemented`; membuat entri perubahan `CHG-` di log aktivitas (S7d) dalam transaksi yang sama, keputusan CR ikut memutuskan entri itu |
| Insiden | Server; buat, ubah status, eskalasi (target user wajib), catatan komunikasi, resolve (catatan wajib); setiap langkah tercatat di log aktivitas |
| Pembatalan `cancelled` | Tidak lagi membuat catatan lokal — Finance (`refunds`, S5) sudah menyimpannya; layar menampilkan kasus Finance |
| No-show / refunded | `POST /bookings/:type/:id/status` menerima `penaltyMinor` opsional; status `no-show`/`refunded` menyimpan catatan `CNX-` + log aktivitas dalam transaksi yang sama |
| Fixture pembatalan | `CNX-001…003` diseed sebagai riwayat dengan hasil `cancelled` (sebelum ada Finance) |
| Gate workflow | Server menolak (422) `→ in-progress` bila ada insiden `open`/`escalated`, dan `→ completed` bila ada CR `submitted`/`under-review` |
| Hak | Buat CR/insiden & langkah insiden: `project-order.log-change`; review/setujui/tolak CR: `project-order.review-change`; tandai CR diimplementasikan: `log-change`; baca: peran internal, portal 403 |
| Uang | `commercialImpactMinor`, `penaltyMinor`: bigint minor, string di wire; terlihat peran internal (sama seperti nominal vendor itinerary) |

## Backend

### Migrasi `0031_changes_incidents`

- `change_requests`: `id` (`CR-`), `project_id` FK, `source` ∈ client/internal/supplier, `requested_by` FK users,
  `affected_entities jsonb` (array `{entityType, entityId}`), `before_summary`, `after_summary` (wajib),
  `operational_impact`, `commercial_impact_minor bigint ≥ 0`, `financial_impact_note`, `timeline_impact_note`,
  `status` ∈ submitted/under-review/approved/rejected/implemented, `decided_by`, `decided_at`, `rejection_reason`,
  `implemented_at`, `activity_id` FK project_activities, `changed_by_api_at`, `provenance`, `created_at`, `updated_at`.
- `incidents`: `id` (`INC-`), `project_id` FK, `booking_type`, `booking_id`, `title`, `description`, `severity` ∈
  low/medium/high/critical, `owner_id` FK users, `status` ∈ open/investigating/escalated/resolved/closed,
  `escalated_to` FK users, `communication_log jsonb` (array `{id, at, from, message}`), `resolution_note`,
  `resolved_at`, `changed_by_api_at`, `provenance`, `created_at`, `updated_at`.
- `booking_cancellations`: `id` (`CNX-`), `project_id` FK, `booking_type`, `booking_id`, `outcome` ∈
  cancelled/no-show/refunded, `reason`, `penalty_minor bigint ≥ 0`, `refund_eligible boolean`, `cancelled_by` FK users,
  `cancelled_on date`, `provenance`, `created_at`.
- `id_sequences`: `CR-`, `INC-`, `CNX-`.

### Endpoint

| Endpoint | Aturan |
|---|---|
| `GET /change-requests?projectId=`, `GET /incidents?projectId=`, `GET /booking-cancellations?projectId=` | peran internal; portal 403 |
| `POST /projects/:id/change-requests` | Idempotency-Key; `log-change`; `source`, `beforeSummary`, `afterSummary` wajib; `commercialImpactMinor` string ≥ 0; membuat `CHG-` (kategori dari body, default `other`) |
| `POST /change-requests/:id/review` | `review-change`; hanya dari `submitted` |
| `POST /change-requests/:id/approve`, `/reject { reason }` | `review-change`; dari `submitted`/`under-review`; reject wajib alasan; entri `CHG-` yang masih pending ikut diputuskan |
| `POST /change-requests/:id/implement` | `log-change`; hanya dari `approved` |
| `POST /projects/:id/incidents` | Idempotency-Key; `log-change`; judul, deskripsi, tingkat, PIC wajib; booking opsional (harus booking project itu) |
| `POST /incidents/:id/status { to }` | `log-change`; peta transisi: open→investigating/escalated/resolved, investigating→escalated/resolved, escalated→investigating/resolved, resolved→closed; `resolved` lewat endpoint resolve |
| `POST /incidents/:id/escalate { to, note? }` | user tujuan wajib; status → escalated; catatan masuk log komunikasi |
| `POST /incidents/:id/communications { message }` | pesan wajib; pengirim = aktor |
| `POST /incidents/:id/resolve { note }` | catatan wajib; status → resolved, `resolved_at` |
| `POST /bookings/:type/:id/status` | + `penaltyMinor` (opsional, hanya untuk `no-show`/`refunded`); simpan `CNX-` |

Setiap tulis: perubahan + `recordAudit` satu transaksi; log aktivitas project (`ACT-`) untuk CR dibuat/diputuskan/
diimplementasikan, insiden dibuat/status/eskalasi/resolve, dan no-show/refunded.

### Seed

7 CR (`CR-001…007`, status alur klien dipetakan ke status internal terdekat; `activity_id` ke `CHG-` fixture), 4 insiden,
3 catatan pembatalan. Seed ulang hanya menyentuh baris fixture yang belum diubah API.

## Frontend

- Tipe & endpoint (`core`); `data/changes-sync.ts` memuat `CHANGE_REQUESTS`, `INCIDENTS`, `CANCELLATION_RECORDS`
  (merge di tempat; CR klien lokal `CR-L…` dipertahankan) dan fungsi tulis server-first; layout & reset settings.
- `/changes` (buat CR & insiden), `/changes/[id]` (review/setujui/tolak/implementasi), `/changes/incidents/[id]`
  (status/eskalasi/komunikasi/resolve) memakai server. Dialog no-show/refunded di halaman booking mengirim
  `penaltyMinor`; pembatalan Finance tidak lagi membuat catatan lokal.
- Gate workflow lokal tetap ditampilkan dari data yang kini tersinkron server.
- Guard melarang `createChangeRequest(`, `approveChangeRequest(`, `rejectChangeRequest(`, `markChangeRequestUnderReview(`,
  `markChangeRequestImplemented(`, `createIncident(`, `updateIncidentStatus(`, `escalateIncident(`,
  `appendIncidentCommunication(`, `resolveIncident(`, `createCancellationRecord(` di layar (portal dikecualikan).

## Testing

- Backend (`test/changes-incidents.test.ts`): CRUD + validasi + 401/403/404; CR membuat `CHG-` dan keputusan CR
  memutuskannya; transisi salah 422; insiden transisi/eskalasi/komunikasi/resolve; no-show dengan denda menyimpan `CNX-`;
  gate workflow in-progress/completed 422; seed.
- Frontend: tes `changes-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0031` otomatis. Setelah push: `bun run db:seed:demo` sekali.
