# Backend quotation vendor, service order & orkestrasi booking (S4b) — desain

Tanggal: 7 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-07-quotations-service-orders-backend)

Lanjutan S4a (layanan project + booking lewat API). S4b memindahkan: quotation vendor, service order (SO) otomatis +
status, payment gate booking (dihitung dari Finance), log percobaan booking, dan tanda booking duplikat.
**S5** (procurement penuh) tetap: RFQ, amandemen SO, supplier invoice / portal supplier.

## Keputusan

| Topik | Keputusan |
|---|---|
| Payment gate | **Dihitung dari Finance**, tidak disimpan; tombol "cleared" manual dihapus |
| Supplier invoice otomatis | **Dihapus** — tagihan vendor hanya lewat Finance (Utang Vendor) dari dokumen asli vendor |
| Service order | Server membuat SO otomatis saat vendor ditugaskan / quotation diterima, membatalkan SO vendor lama yang belum ditagih; status SO di server. Amandemen & RFQ = S5 |
| Duplikat booking | Cek di server saat booking dibuat; konfirmasi user menandai booking sebagai duplikat |
| Hak akses | Tulis: `project-order.manage-service.<jenis layanan>` (admin; super-admin lolos). Finance baca. Portal tidak menulis |
| Tetap lokal | RFQ, amandemen SO, supplier invoice & reviewnya, portal supplier (ADR-006), `dependsOn` orkestrasi (data tampilan), aktivitas vendor/project (log lokal; server mencatat audit) |

## Backend

### Migrasi `0023_quotations_service_orders`

Tabel baru `vendor_quotations`:
- `id text primary key` (`VQ-`), `vendor_id` FK vendors, `project_id` FK projects, `service_id` (nullable; FK komposit
  `(service_id, project_id)` → `project_services(id, project_id)`), `service_type` (5 jenis layanan)
- `amount_minor bigint not null` check `0 < x ≤ 1e15`, `notes text`
- `status text not null default 'submitted'` check ∈ `submitted, accepted, rejected`; `decision_reason text`
- `submitted_on date not null`, `decided_at timestamptz`, `decided_by` FK users
- `provenance`, `created_at`; index `(service_id)`, `(project_id)`
- Satu quotation `accepted` per layanan: unique partial index `(service_id) where status = 'accepted'`

`service_orders` — kolom baru:
- `status text not null default 'draft'` check ∈ `draft, sent, acknowledged, amended, fulfilled, cancelled`
  (`amended` disiapkan untuk S5; S4b tidak membuat transisi ke sana)
- `net_cost_minor bigint` check `0 ≤ x ≤ 1e15`, `line_items jsonb not null default '[]'` check array
- `source_quotation_id text` FK vendor_quotations, `status_reason text`
- `acknowledged_at`, `fulfilled_at timestamptz`, `updated_at timestamptz not null default now()`
- Satu SO aktif per layanan+vendor: unique partial index `(service_id, vendor_id) where status <> 'cancelled' and service_id is not null`
- Baris lama: status awal `draft` (seed mengisi nilai fixture)

`booking_refs` — kolom baru: `flagged_duplicate boolean not null default false`, `duplicate_of jsonb not null default '[]'`
(daftar `{type,id}`), `duplicate_note text`.

Tabel baru `booking_attempts`: `id text primary key` (`BAT-`), `booking_type`, `booking_id` (FK komposit ke
`booking_refs`), `outcome` check ∈ `success, failed, manual-fallback`, `note text`, `actor_user_id` FK users,
`attempted_at timestamptz not null default now()`, `provenance`; index `(booking_type, booking_id)`.

`id_sequences`: `VQ-`, `SO-`, `BAT-` dari angka terbesar yang ada (ID non-angka seperti `SO-101F` diabaikan oleh regex);
`syncIdSequences` mengenal ketiganya. Down migration membalik semuanya.

### Quotation

| Endpoint | Aturan |
|---|---|
| `GET /vendor-quotations?projectId=&serviceId=&vendorId=` | peran internal; scope project; vendor portal hanya miliknya; client 403 |
| `POST /vendor-quotations` `{ vendorId, projectId, serviceId?, serviceType, amountMinor, notes? }` | Idempotency-Key; capability jenis layanan; vendor ada & `active`/`pending`; project dalam scope; `serviceId` (bila ada) milik project & jenisnya = `serviceType`; nilai > 0 |
| `POST /vendor-quotations/:id/accept` | status harus `submitted` dan punya `serviceId` (422 kalau tidak); satu transaksi: quotation `accepted` (+ `decided_*`), quotation `submitted` lain untuk layanan yang sama → `rejected` (alasan "Quotation lain diterima"), vendor layanan diset lewat aturan ganti-vendor S4a (422 bila sudah ada invoice vendor lain), status layanan → `confirmed` bila layanan belum punya booking, SO dipastikan (lihat di bawah) dengan `net_cost_minor` = nilai quotation dan `source_quotation_id` |
| `POST /vendor-quotations/:id/reject` `{ reason? }` | status harus `submitted` |

Audit: `quotation.submitted|accepted|rejected`.

### Service order otomatis

Fungsi bersama `ensureServiceOrder(tx, serviceId, vendorId, { netCostMinor?, sourceQuotationId? })`, dipanggil dari
accept quotation **dan** dari `PATCH /project-services/:id` saat `vendorId` berubah:
- vendor baru: ada SO aktif untuk layanan+vendor → dipakai (nilai/quotation diisi bila kosong); tidak ada → SO baru
  `draft` (`SO-`, project & layanan dari service)
- vendor lama (bila berbeda): SO aktifnya yang **tidak** punya invoice vendor tidak `rejected`/`void` → `cancelled`
  (alasan "Vendor layanan diganti"); yang sudah ditagih tidak mungkin terjadi karena ganti vendor sudah ditolak S4a
- vendor dikosongkan: SO aktif vendor lama dibatalkan dengan aturan yang sama
- Audit `service_order.created|cancelled`

### Status SO

`POST /service-orders/:id/status` `{ to, reason? }` (capability jenis layanan SO):
- transisi: `draft → sent`, `sent → acknowledged`, `acknowledged → fulfilled`; `draft|sent|acknowledged → cancelled`
- `cancelled` wajib alasan; ditolak (422) bila ada invoice vendor tidak `rejected`/`void` yang menunjuk SO ini
- `acknowledged_at` / `fulfilled_at` diisi saat transisi; audit `service_order.status_changed`
- SO tanpa `service_id` (fixture lama) memakai capability `vendor.manage-vendor`

`GET /service-orders?projectId=&vendorId=&serviceId=` (internal; vendor portal hanya miliknya; client 403) dan
`GET /service-orders/:id` mengembalikan: id, vendorId, vendorName, projectId, serviceId, status, statusReason,
netCostMinor (komersial), lineItems, sourceQuotationId, acknowledgedAt, fulfilledAt, createdAt, updatedAt.
Bentuk lama (`id, vendorId, vendorName, projectId, serviceId`) tetap ada → konsumen Finance tidak berubah.

### Payment gate (dihitung)

Fungsi `paymentGateOf(q, booking)`:
- booking belum "confirmed" (status layanan hasil mapping ≠ `confirmed|changed|completed`) → `not-required`
- booking punya invoice customer sendiri yang tidak `void` → `cleared` bila status pembayaran booking (sama dengan
  `bookingFinanceSummary`) `dp_received` atau `paid`; selain itu `pending`; `basis: 'booking'`
- booking tanpa invoice sendiri → `cleared` bila status pembayaran **project** `dp_received` atau `paid`; selain itu
  `pending`; `basis: 'project'`
- booking `cancelled|refunded|no-show` → `not-required`

`GET /bookings` menambahkan `paymentGate: { status, basis }` (dihitung per daftar dengan query gabungan, bukan N+1),
`flaggedDuplicate`, `duplicateOf`, `duplicateNote`, dan `attempts[]` (terbaru dulu).

### Percobaan & duplikat booking

- `POST /bookings/:type/:id/attempts` `{ outcome, note? }` — capability jenis layanan; audit `booking.attempt_logged`.
- `POST /bookings/:type` (S4a) — sebelum insert, server mencari booking **aktif** (status bukan terminal) di layanan
  yang sama (layanan dari body atau layanan yang akan dipakai ulang). Ada → 409 `CONFLICT` dengan
  `details.conflicts: [{type,id}]` dan pesan "Sudah ada booking aktif untuk layanan ini". Body `allowDuplicate: true`
  (+ `duplicateNote?`) → booking dibuat dengan `flagged_duplicate = true`, `duplicate_of` = daftar itu.

### Seed

`extract-demo-core.ts` mengekstrak `VENDOR_QUOTATIONS` → `vendorQuotations`, melengkapi `serviceOrders` (status,
netCost, lineItems, statusReason, acknowledged/fulfilledAt) dan booking (`flaggedDuplicate`, attempt log dari
`BOOKING_ORCHESTRATION_RECORDS` → `bookingAttempts`). Quotation/attempt yang menunjuk layanan/booking yang tidak ada
di seed dilewati dengan peringatan. `seed-demo.ts` meng-upsert (baris `demo-fixture` saja) lalu `syncIdSequences`.

## Frontend

- `types/api.ts` + `endpoints.ts`: DTO & panggilan baru (quotation, SO list/status, attempts; field baru booking & SO).
- Sync: `bookings-sync.ts` diperluas (atau `procurement-sync.ts` baru) memuat quotation & SO ke `VENDOR_QUOTATIONS` /
  `SERVICE_ORDERS`, dan payment gate + attempts + duplikat ke `BOOKING_ORCHESTRATION_RECORDS` (merge per booking;
  `dependsOn` lokal dipertahankan).
- Pemanggil:
  - `submitVendorQuotation` (vendor detail) → `POST /vendor-quotations`
  - terima/tolak quotation (Project Order) → endpoint accept/reject; `assignServiceVendor` dengan nominal →
    submit + accept di server; tanpa nominal → `PATCH` vendor (SO dibuat server)
  - `updateServiceOrderStatus` (procurement SO & supplier SO) → endpoint status SO
  - `appendBookingAttempt` → endpoint attempts; `flagBookingOrchestrationDuplicate` + `findActiveBookingConflicts` →
    alur 409 + `allowDuplicate`
  - `setBookingPaymentGateStatus` dihapus; UI menampilkan badge gate dari server (dengan keterangan "dari tagihan
    booking" / "dari DP project")
- Dihapus: `ensureSupplierInvoiceForConfirmedService` dan pemanggilnya, `ensureServiceOrderForVendorAssignment` lokal,
  `syncBookingPaymentGateOnStatusChange`, mutator lokal yang tak lagi dipanggil. Halaman supplier invoice & portal tetap
  lokal (S5) tanpa pembuatan otomatis.

## Testing

- Backend `test/quotations-service-orders.test.ts`: submit (idempotensi, validasi, 401/403/404), accept (pesaing ditolak,
  vendor & status layanan, SO dibuat dengan nilai, 422 tanpa layanan / sudah diputuskan / vendor terkunci invoice),
  reject; ganti vendor lewat PATCH membuat SO baru & membatalkan SO lama tanpa invoice; status SO (transisi, alasan,
  batal ditolak bila ditagih); payment gate (tanpa tagihan → pending/project basis, DP project diterima → cleared,
  invoice booking sendiri, booking belum confirmed → not-required); attempts; duplikat (409 + allowDuplicate).
- `test/db.test.ts`: seed mengisi quotation, SO, attempts; guard "no finance records" tetap hijau.
- Frontend: tes sync (merge quotation/SO/orchestration) + alur 409 duplikat; suite penuh, vue-tsc & lint tanpa tambahan.
- Smoke API pada salinan DB; migrasi DB lokal + `db:seed:demo`.

## Deploy

Sama seperti S1–S4a: setelah push jalankan sekali `bun run db:seed:demo` di server.
