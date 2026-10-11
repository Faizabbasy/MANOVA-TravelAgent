# Backend dokumen & pesan (S9) — desain

Tanggal: 12 Oktober 2026 · Branch: `production` · Status: disetujui (opsi rekomendasi, eksekusi native)

S9 memindahkan metadata dokumen (`DOCUMENT_RECORDS`) dan pesan (`MESSAGE_RECORDS`) ke server untuk alur internal.
Notifikasi menjadi tahap terpisah (S9b). Tidak ada penyimpanan file: aplikasi hanya mencatat metadata (nama file
diketik / dipilih), sama seperti sekarang.

## Keputusan

| Topik | Keputusan |
|---|---|
| Lingkup | Dokumen (unggah metadata di `/documents` & tab Dokumen project) + pesan (`/documents` tab Pesan, "Kirim Pesan" & Diskusi project) |
| File | Metadata saja; tidak ada upload/storage (sama dengan sekarang) |
| Hak tulis dokumen | Capability baru `document.manage` (admin; super-admin lolos), disinkronkan ke `frontend/app/data/rbac.ts` |
| Hak kirim pesan | Seluruh peran internal (layar Diskusi sekarang tanpa gate); pengirim = aktor; portal 403 |
| Baca | Seluruh peran internal; portal 403 |
| Mention | Server menyimpan `mentions` (user internal yang ada); notifikasi mention tetap mock lokal setelah server sukses (notifikasi = S9b) |
| ID | Server melanjutkan fixture: `DOC-C020…`, `MSG-012…`; penulis lokal portal klien memakai `DOC-L…` / `MSG-L…` dan sinkron mempertahankannya |
| Tetap lokal | Portal klien (unggah/ganti versi dokumen klien, komentar dokumen, read/unread pesan), dokumen legacy `DOCUMENTS` (6, hanya dibaca), notifikasi (S9b) |

## Backend

### Migrasi `0032_documents_messages`

- `documents`: `id` (`DOC-C`), `entity_type` ∈ 14 jenis (`project, party, vendor, traveler, quotation, flight, hotel,
  transport, mice, invoice, change-request, incident, travel-request, approval`), `entity_id`, `project_id` FK projects
  (nullable), `name` (wajib), `category` (wajib), `version int ≥ 1 default 1`, `access_level` ∈ internal/client/supplier,
  `source_type` ∈ uploaded/generated, `preview_route`, `uploaded_by` FK users, `uploaded_on date`, `generated_on date`,
  `expires_on date`, `supersedes_id` FK documents, `verified boolean`, `verified_by` FK users, `verified_on date`,
  `provenance`, `created_at`; index `(project_id)`, `(entity_type, entity_id)`.
- `messages`: `id` (`MSG-`), `entity_type`, `entity_id`, `project_id` FK (nullable), `channel` ∈
  internal-note/client-message/supplier-message, `sender_id` FK users, `body` (wajib), `mentions jsonb` (array id user),
  `delivery_status` ∈ queued/sent/delivered/failed, `delivery_channel` ∈ email/whatsapp (null untuk internal-note),
  `attachment_name`, `read_by jsonb` (array), `sent_at timestamptz`, `provenance`, `created_at`; index `(project_id)`.
- `id_sequences`: `DOC-C`, `MSG-`.

### Endpoint

| Endpoint | Aturan |
|---|---|
| `GET /documents?projectId=` | peran internal; portal 403; urut terbaru |
| `POST /documents` | Idempotency-Key; `document.manage`; `name`, `category`, `entityType`, `entityId`, `accessLevel` wajib; `projectId` (harus ada); `expiresOn` `YYYY-MM-DD`; versi 1, `source_type = uploaded`, `uploaded_by` = aktor |
| `GET /messages?projectId=` | peran internal; portal 403; urut `sent_at` |
| `POST /messages` | Idempotency-Key; aktor internal; `channel`, `entityType`, `entityId`, `body` wajib; `mentions` user yang ada; `deliveryChannel` email/whatsapp (default email, kosong untuk internal-note); status `sent` (internal-note) / `delivered` (lainnya, simulasi); `read_by` = [pengirim] |

Pesan ke klien/supplier dicatat juga di log aktivitas project (S7d) bila ada `projectId`.

### Seed

19 dokumen (`DOC-C001…019`) dan 11 pesan (`MSG-001…011`) fixture; seed ulang tidak menimpa baris API.

## Frontend

- Tipe & endpoint (`core`); `data/documents-sync.ts` memuat `DOCUMENT_RECORDS`, `MESSAGE_RECORDS` (merge di tempat,
  baris `DOC-L`/`MSG-L` dipertahankan), fungsi tulis server-first; layout & reset settings.
- `/documents` (unggah dokumen, kirim pesan), project page (unggah dokumen, Kirim Pesan, Diskusi) memakai server;
  mention → notifikasi lokal setelah sukses.
- `createDocument`/`sendMessage` lokal hanya untuk portal (prefix `DOC-L`/`MSG-L`); guard melarang `createDocument(`,
  `sendMessage(` di layar internal.

## Testing

- Backend (`test/documents-messages.test.ts`): baca 200/403/401; dokumen (idempoten, validasi, finance 403, project
  tidak ada 400); pesan (idempoten, validasi channel/mention, finance boleh kirim, pengirim = aktor, status per channel,
  log aktivitas untuk pesan klien); seed.
- Frontend: tes `documents-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0032` otomatis. Setelah push: `bun run db:seed:demo` sekali.
