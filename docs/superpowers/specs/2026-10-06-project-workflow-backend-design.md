# Backend alur Project Order & tim (S3b) — desain

Tanggal: 6 Oktober 2026 · Branch: `production` · Status: diimplementasikan

Lanjutan S0+S3a (header project) dan S1 (customer). Layanan project + vendor **tidak** di tahap ini — pindah
bersama Booking (S4), karena layanan dibuat oleh booking yang masih lokal.

## Keputusan

| Topik | Keputusan |
|---|---|
| Cakupan | Status & alur Project Order (handover, transisi, ready, tutup finance, tutup project, batal/on-hold) + tim |
| Gate | Server menegakkan yang datanya di server: peta transisi, alasan wajib (on-hold/batal), hak akses, handover sebelum planning, DP ditagih+diterima sebelum Ready, hambatan Finance dihitung server sebelum tutup finance, status `completed` + finance tertutup + catatan akhir sebelum tutup project. Gate berbasis data lokal (traveler, itinerary, insiden, change request, booking, aset, dokumen, tanggal acuan demo) tetap dicek UI |
| Pembatalan | Kasus pembatalan level project yang dicatat Finance langsung mengubah status project → `cancelled` di transaksi yang sama (bila transisi sah) |
| Aktivitas | `ACTIVITIES` tetap log lokal; server mencatat audit |
| Bug lama | Step "Done" tidak bisa diselesaikan dari UI (catatan akhir tak pernah dikirim) — diperbaiki dengan dialog tutup project |
| Tetap lokal | Layanan + vendor (S4), milestone, traveler, itinerary, insiden, change request, aktivitas, checklist closure selain finance |

## Backend

### Migrasi `0020_project_workflow`

Kolom baru di `projects`: `handover_accepted_at timestamptz`, `handover_accepted_by` (FK users),
`handover_returned_at timestamptz`, `handover_return_reason text`, `ready_at timestamptz`,
`finance_settled_at timestamptz`, `finance_settled_by` (FK users), `closed_at timestamptz`, `closed_by` (FK users),
`final_note text`, `client_feedback text`. Seed demo mengisi dari fixture (`handoverAcceptedAt/By`, `readyAt`,
`closedAt/By`, `closureChecklist.financeSettled/finalNote/clientFeedback`).

### Endpoint

Peta transisi (sama dengan `PROJECT_STATUS_TRANSITIONS` frontend):
draft → planning/on-hold/cancelled; planning → confirmed/on-hold/cancelled; confirmed → in-progress/on-hold/cancelled;
in-progress → ongoing-trip/completed/on-hold/cancelled; ongoing-trip → completed/on-hold/cancelled;
on-hold → planning/confirmed/in-progress/cancelled; completed, cancelled → (tidak ada).

| Endpoint | Capability | Aturan |
|---|---|---|
| `POST /projects/:id/handover/accept` | `project-order.accept-handover` | status `draft`, belum diterima → isi accepted_at/by |
| `POST /projects/:id/handover/return` `{ reason }` | `project-order.accept-handover` | status `draft`, belum diterima, alasan wajib |
| `POST /projects/:id/transition` `{ to, reason? }` | ke `cancelled`: `project-order.request-cancellation`; lainnya: `project-order.advance-step` | transisi sah; alasan wajib untuk on-hold/cancelled; ke `planning` dari `draft` butuh handover diterima; ke `confirmed`/`in-progress` dari status manapun tetap menghormati peta |
| `POST /projects/:id/ready` | `project-order.advance-step` | status `confirmed`, belum ready; invoice DP terbit **dan** sudah dibayar sebagian/penuh (fakta Finance server, sama dengan `dpInvoiced`/`dpReceived`) |
| `POST /projects/:id/finance-close` | `project-order.close` | hambatan Finance dihitung server (lihat bawah) harus kosong; isi finance_settled_at/by |
| `POST /projects/:id/close` `{ finalNote, clientFeedback? }` | `project-order.close` | status `completed`, finance sudah ditutup, belum ditutup, `finalNote` wajib |
| `PUT /projects/:id/members/:userId`, `DELETE …` | `project-order.accept-handover` | user internal aktif; owner tidak bisa dihapus |

Semua: 404 bila di luar scope, 422 `RULE_VIOLATION` dengan pesan Bahasa Indonesia untuk aturan bisnis, audit
`project.handover_accepted`, `project.handover_returned`, `project.status_changed` (before/after/reason),
`project.ready`, `project.finance_closed`, `project.closed`, `project.member_added/removed`. Respons = view
project internal (field alur ditambahkan: `handoverAcceptedAt/By`, `handoverReturnedAt`, `handoverReturnReason`,
`readyAt`, `financeSettledAt/By`, `closedAt/By`, `finalNote`, `clientFeedback` — tanggal sebagai ISO string).

**Hambatan Finance (server)** — fungsi `projectFinanceBlockers(db, projectId)` di `summaries.ts`, sama dengan
daftar panel Finance frontend: invoice terbit dengan sisa tagihan; draft invoice; rencana tagihan belum ditagih;
nilai kontrak belum seluruhnya ditagih; invoice vendor menunggu review; utang vendor belum dibayar; kasus refund
terbuka.

**Pembatalan:** `createCancellation` (refunds.ts), untuk subjek `project`, setelah kasus tercatat: bila status
saat ini mengizinkan `cancelled`, ubah status + audit `project.status_changed` (reason = alasan pembatalan).

## Frontend

- `projects-sync.ts`: status, field alur (`handoverAcceptedAt/By`, `handoverReturnedAt/Reason`, `readyAt`,
  `closedAt/By`, `closureChecklist.financeSettled/finalNote/clientFeedback`) dan `teamUserIds` diambil dari server
  untuk project yang sudah ada juga (test lama yang mempertahankan status lokal dibalik). Flag closure lain
  (`servicesCompleted`, `documentsComplete`, `unresolvedIssuesHandled`, `feedbackCollected`) tetap lokal.
- Mutator server baru di `projects-sync.ts`: `acceptHandoverOnServer`, `transitionProjectOnServer`,
  `markReadyOnServer`, `closeFinanceOnServer`, `closeProjectOnServer`, `addTeamMemberOnServer`,
  `removeTeamMemberOnServer` — masing-masing memanggil API lalu `upsertServerProject`.
- `advanceProjectOrder` menjadi async (`advanceProjectOrderOnServer`): evaluasi gate lokal dulu (blocker lokal →
  tidak memanggil server), lalu memanggil endpoint sesuai step (transition / ready / close). Pesan error server
  ditampilkan apa adanya.
- Halaman Project Detail: terima handover, tutup finance, tim, maju step memakai mutator server; step "Done"
  membuka dialog catatan akhir + feedback klien; setelah `FinanceCancellationDialog` sukses → muat ulang project
  dari server (tidak lagi `updateProjectStatus` lokal).
- Mutator lokal yang tidak dipakai lagi dihapus bila tak punya pemanggil (cek dengan grep **dan**
  `vue-tsc -p .nuxt/tsconfig.app.json` difilter file yang disentuh).

## Test

- **Backend** `test/project-workflow.test.ts`: tiap endpoint sukses + 401/403/404; transisi tidak sah 422; alasan
  wajib; planning tanpa handover 422; ready tanpa DP 422 lalu sukses setelah DP terbit + dibayar; finance-close
  dengan hambatan 422 (pesan menyebut hambatan) lalu sukses; close tanpa finance/catatan 422; anggota tim
  tambah/hapus, owner tak bisa dihapus; pembatalan project lewat Finance mengubah status; audit tercatat.
- **Frontend**: sinkron mengambil status/tim dari server (dibalik); `advanceProjectOrderOnServer` dengan API
  tiruan (gate lokal memblokir tanpa memanggil server; step confirmed memanggil ready; step done butuh catatan).
- Test lama yang memakai mutator lokal disesuaikan.

## Di luar lingkup

Layanan + vendor (S4), UI on-hold/kembalikan handover (endpoint ada, UI belum), row scope per anggota tim,
log aktivitas di server.
