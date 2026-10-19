# Portal client — tiket support & feedback perjalanan di server (S12c-2) — desain

Tanggal: 19 Oktober 2026 · Branch: `production` · Status: disetujui (eksekusi native)

Tiket support (beserta balasan, konfirmasi, buka ulang, rating) dan feedback perjalanan pindah dari mock lokal ke server,
dan staf mendapat inbox tiket serta panel feedback yang menulis ke server.

## Keputusan pengguna

1. **Penanganan tiket**: tiket terkait project ditugaskan ke owner project; tanpa project masuk antrean (belum
   ditugaskan). Admin bisa menugaskan ulang. Tiket kategori billing juga memberi tahu Finance. Inbox staf baru untuk Admin
   (capability baru `support.manage-ticket`; Super Admin lolos).
2. **Catatan internal**: staf bisa membalas ke client atau menulis catatan internal yang tidak terlihat client.
3. **Feedback** hanya untuk project yang sudah berangkat (`ongoing-trip`) atau selesai (`completed`). Staf CRM
   (`crm.manage-follow-up`) menandai diterima / perlu tindak lanjut (dengan catatan) / ditutup.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Skema (migrasi 0041) | `support_tickets` (`TCK-`): party, project (opsional), kategori (9), prioritas (low/medium/high/urgent), status (open/assigned/in-progress/waiting-for-client/resolved/closed/reopened), subjek, deskripsi, nama lampiran, pembuat, `assigned_to`, catatan & waktu & oleh penyelesaian, rating 1–5 + catatan rating, `reopen_count`, `closed_at`. `support_ticket_replies` (`TCKR-`): tiket, penulis, pesan, nama lampiran, `is_internal`. `project_feedback` (`FBK-`, satu per project): party, status (draft/submitted/acknowledged/follow-up-required/closed), 11 skor aspek 1–5, `overall_experience` 1–5, `recommendation_score` 0–10, komentar, saran, persetujuan testimoni, dikirim/diterima oleh & kapan, catatan tindak lanjut |
| SLA | Dihitung dari prioritas (urgent 1, high 2, medium 3, low 5 hari) — tidak disimpan |
| Client — tiket | `GET /client/support-tickets` (+ balasan non-internal; tanpa id staf internal selain nama penanggung jawab); `POST /client/support-tickets` (Idempotency-Key; project milik party bila diisi) → `assigned` ke owner project atau `open`; notifikasi penanggung jawab / semua Admin bila antrean; billing → Finance; aktivitas project bila ada project. `POST …/:id/replies` (waiting-for-client → in-progress; notif penanggung jawab), `…/confirm` (resolved → closed), `…/reopen { reason }` (resolved/closed → reopened, `reopen_count`+1, alasan jadi balasan, notif), `…/rate { rating, note? }` (resolved/closed) |
| Staf — tiket | `support.manage-ticket`: `GET /support-tickets?status=&assignedTo=&partyId=` & `/:id` (semua balasan), `POST /:id/assign { userId }` (user internal aktif; open/reopened → assigned), `/:id/status { to: in-progress \| waiting-for-client }`, `/:id/replies { message, internal? }` (balasan publik memberi tahu client), `/:id/resolve { note }` (→ resolved; notif client), `/:id/close` (resolved → closed). Transisi tidak valid → 422 |
| Client — feedback | `GET /client/feedback` (feedback project party); `PUT /client/projects/:id/feedback` (simpan draft; project milik party, `ongoing-trip`/`completed`, status draft/belum ada); `POST /client/projects/:id/feedback/submit` (wajib `overallExperience` & `recommendationScore`; → submitted; aktivitas project + notif owner) |
| Staf — feedback | `GET /feedback?status=` (role yang bisa lihat CRM); `POST /feedback/:id/acknowledge` (submitted → acknowledged), `/follow-up { note }` (submitted/acknowledged → follow-up-required), `/close { note? }` (→ closed) — `crm.manage-follow-up` |
| Frontend client | Sync `clientSupport` (tiket + balasan + feedback party) di plan client; panel & detail tiket, halaman feedback lewat server (server-first); feedback dikunci bila project belum berangkat |
| Frontend staf | Halaman baru `/support` (inbox: filter status/penanggung jawab, SLA terlewati) dan `/support/[id]` (detail, tugaskan, status, balas/catatan internal, selesaikan, tutup); menu internal untuk pemegang `support.manage-ticket`. `FeedbackPanel` CRM memuat dari server dan aksinya menulis ke server |

## Testing

- Backend: penugasan otomatis (owner / antrean), notifikasi (penanggung jawab, Admin, Finance untuk billing, client untuk
  balasan publik & penyelesaian), catatan internal tak terlihat client, transisi status (client & staf) dan 422, party
  lain 404, role tanpa capability 403, rating/reopen; feedback (status project, draft → submit, validasi skor, satu per
  project, aksi staf); migrasi lewat `db.test`.
- Frontend: mapper & sync, guard mutator lokal, `pnpm test`, vue-tsc ≤ 1987, eslint, build.

## Deploy

Migrasi 0041. Capability baru `support.manage-ticket` (Admin) di kedua matriks RBAC. Data demo tiket/feedback lokal tidak
di-seed (fixture lama punya party yang salah); bisa ditambahkan nanti.
