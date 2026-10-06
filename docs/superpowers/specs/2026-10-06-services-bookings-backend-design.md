# Backend layanan project & booking (S4a) — desain

Tanggal: 6 Oktober 2026 · Branch: `production` · Status: disetujui per bagian di chat, menunggu review spec

Lanjutan S3b (alur project) dan S2 (vendor). S4 dipecah: **S4a** = layanan project + booking 4 jenis (tahap ini);
**S4b** = quotation vendor, service order otomatis, payment gate & attempt log booking; **S5** = procurement penuh.

## Keputusan

| Topik | Keputusan |
|---|---|
| Cakupan | Layanan project (buat, label, status manual, budget, referensi, vendor) + booking flight/hotel/transport/MICE (buat, ubah detail & harga, ubah status) |
| Penyimpanan booking | Perluas tabel `booking_refs` yang sudah ada (semua FK Finance tetap), kolom inti + `details` JSONB untuk detail per jenis |
| Batal booking | `cancelled`/`refunded` ditolak (422) bila booking sudah punya transaksi Finance → arahkan ke pembatalan Finance; pembatalan lewat Finance untuk booking mengubah status booking jadi `cancelled` |
| Ganti vendor | Ditolak (422) bila ada invoice vendor aktif pada booking atau service order layanan itu |
| Hak akses | Tulis: `project-order.manage-service.<jenis>` (admin; super-admin lolos). Baca: peran internal; portal tetap mengikuti scope yang ada |
| Aktivitas | Log aktivitas project tetap lokal (belum ada tabel server); server mencatat audit |
| Tetap lokal | Quotation vendor, service order & supplier invoice otomatis (S4b/S5), payment gate & attempt log orchestration, flag duplikat (S4b), traveler (S7) |

## Backend

### Migrasi `0022_services_bookings`

`project_services` — kolom baru:
- `label text not null` — baris lama diisi nama jenis (`Flight`, `Hotel`, `Transportation`, `MICE`, `Additional`); seed menimpa dengan label fixture
- `status text not null default 'not-started'` check ∈ `not-started, sourcing, quoted, pending-confirmation,
  confirmed, changed, completed, cancelled`
- `booking_reference text`, `budget_minor bigint` check `0 ≤ x ≤ 1e15`
- `updated_at timestamptz not null default now()`

`booking_refs` — kolom baru:
- `status text not null` — baris lama diisi status awal (`requested`, MICE `planning`); seed menimpa dengan status fixture; check per jenis (peta di bawah)
- `net_cost_minor bigint` check `0 ≤ x ≤ 1e15` (dan check yang sama ditambah ke `sell_amount_minor` bila belum ada)
- `reference text` (PNR flight, nomor konfirmasi hotel; transport/MICE opsional)
- `status_reason text`
- `details jsonb not null default '{}'` check `jsonb_typeof(details) = 'object'`
- `created_at`, `updated_at timestamptz not null default now()`

`id_sequences`: baris `SVC-`, `FLT-`, `HTL-`, `TRN-`, `MICE-` dari nomor terbesar yang ada. `syncIdSequences` diperluas
supaya sumber boleh berupa (tabel, kolom id, filter) — booking memakai `booking_id` dengan filter `booking_type`.
Down migration membalik semuanya.

### Status booking

Transisi (sama dengan `*_TRANSITIONS` di `frontend/app/data/index.ts`):

- **flight**: requested → hold/confirmed/cancelled; hold → confirmed/cancelled; confirmed → issued/cancelled;
  issued → reissued/cancelled; reissued → cancelled; cancelled → refunded; refunded → –
- **hotel**: requested → quoted/cancelled; quoted → confirmed/cancelled; confirmed → amended/completed/cancelled/no-show;
  amended → completed/cancelled/no-show; completed, cancelled, no-show → –
- **transport**: requested → quoted/cancelled; quoted → assigned/cancelled; assigned → confirmed/cancelled;
  confirmed → completed/cancelled/no-show; completed, cancelled, no-show → –
- **mice**: planning → confirmed/cancelled; confirmed → in-progress/cancelled; in-progress → completed/cancelled;
  completed, cancelled → –

Status awal booking baru: `requested` (MICE: `planning`). Alasan wajib untuk `cancelled` dan `refunded`.

Status layanan mengikuti booking (mapping yang sudah dipakai frontend, `map*StatusToServiceStatus`):
- flight: confirmed/issued → confirmed; reissued → changed; cancelled/refunded → cancelled; lainnya → pending-confirmation
- hotel: confirmed → confirmed; completed → completed; amended → changed; cancelled/no-show → cancelled;
  quoted → quoted; lainnya → pending-confirmation
- transport: confirmed → confirmed; completed → completed; cancelled/no-show → cancelled; quoted → quoted;
  lainnya → pending-confirmation
- mice: confirmed/in-progress → confirmed; completed → completed; cancelled → cancelled; lainnya → pending-confirmation

Server menerjemahkan `transport` (booking/Finance) ↔ `transportation` (layanan) di satu helper.

### Harga & tanggal turunan

Sama dengan aturan `scripts/extract-demo-core.ts` sekarang, satu fungsi dipakai server dan extract:
- flight/hotel/transport: `sellAmountMinor`, `netCostMinor` dikirim eksplisit (string rupiah, opsional sampai harga final)
- MICE: harga jual = jumlah `sellPriceIdr` baris BOQ di `details.boqItems`; net = jumlah `netCostIdr` (null bila tak ada
  baris berharga) — dihitung server, tidak diterima dari body
- `departure_date` dihitung server dari `details`: flight = segmen `departureAt` paling awal; hotel = `checkInDate`;
  transport = leg `scheduledAt` paling awal; MICE = sesi `startAt` paling awal (tanggal lokal, 10 karakter pertama)

### `details` per jenis

Objek JSON milik UI; server hanya memeriksa: harus object, ukuran ≤ 64 KB, dan field yang dipakai server bertipe benar
(array `segments`/`legs`/`sessions`/`boqItems` bila ada; tanggal string `YYYY-MM-DD…`; harga BOQ bilangan bulat ≥ 0).
Field inti (id, projectId, serviceId, status, harga, referensi, alasan) tidak disimpan di `details` — dibuang bila
dikirim.

| Jenis | Isi `details` (contoh) |
|---|---|
| flight | `options`, `segments`, `travelerIds`, `ticketingDeadline`, `fareRules`, `hasScheduleChange`, `scheduleChangeNote` |
| hotel | `options`, `hotelName`, kamar, `checkInDate`, `checkOutDate`, `mealPlan`, catatan |
| transport | `options`, `legs`, kendaraan, pengemudi, catatan |
| mice | `sessions`, `participantCategories`, `boqItems`, `staffAssignments`, `checklist`, `deliverables`, `approvalStatus` dan field approval |

(Daftar persis diambil dari tipe `frontend/app/types/{ticketing,accommodation,transportation,mice}.ts` saat plan.)

### Endpoint

| Endpoint | Capability | Aturan |
|---|---|---|
| `GET /project-services?projectId=` | baca internal | scope project; vendor hanya layanannya; client 403 |
| `POST /projects/:id/services` `{ type, label, vendorId?, budgetMinor?, bookingReference? }` | `manage-service.<type>` | Idempotency-Key; project ada & dalam scope; vendor ada & aktif-atau-pending; ID `SVC-` |
| `PATCH /project-services/:id` `{ label?, status?, budgetMinor?, bookingReference?, vendorId? }` | `manage-service.<type>` | `type`/`projectId`/`id` tak bisa diubah; `status` manual hanya untuk layanan tanpa booking (yang punya booking mengikuti booking); ganti/hapus vendor ditolak bila ada invoice vendor tidak `rejected`/`void` yang menunjuk booking layanan ini atau service order layanan ini |
| `GET /bookings?projectId=&type=` | baca internal | scope seperti `getBookingRef`; harga hanya untuk yang boleh lihat komersial; `netCostMinor` hanya peran internal non-portal |
| `POST /bookings/:type` `{ projectId, serviceId?, label?, reference?, sellAmountMinor?, netCostMinor?, details }` | `manage-service.<jenis layanan>` | Idempotency-Key; bila `serviceId` kosong: pakai ulang layanan jenis sama di project itu yang tanpa booking, tanpa `booking_reference` dan status `not-started`, selain itu buat layanan baru (`label` dari body atau default per jenis); `serviceId` harus milik project & jenis yang sama; status awal; status layanan ikut mapping |
| `PATCH /bookings/:type/:id` `{ details?, sellAmountMinor?, netCostMinor?, reference? }` | `manage-service.<jenis>` | jenis/project/layanan tak bisa diubah; harga jual tidak boleh di bawah total invoice customer `issued` neto booking ini (422); booking `cancelled`/`refunded` tidak bisa diedit |
| `POST /bookings/:type/:id/status` `{ to, reason? }` | `manage-service.<jenis>` | transisi sah; alasan wajib cancelled/refunded; **cancelled/refunded ditolak bila booking punya invoice customer tidak `void`, invoice vendor tidak `rejected`/`void`, transaksi kas, item jadwal tagih `planned`, atau kasus pembatalan aktif** — pesan: "Booking ini sudah punya transaksi Finance — ajukan pembatalan lewat Finance."; layanan ikut mapping di transaksi yang sama |

Semua tulis: `recordAudit` di transaksi yang sama (`service.created|updated`, `booking.created|updated|status_changed`),
respons = bentuk GET. Create tanpa Idempotency-Key → 400.

### Hook Finance

`refunds.createCancellation` untuk subjek booking: bila transisi ke `cancelled` sah, set status booking `cancelled`
(+ status layanan) di transaksi yang sama, audit `booking.status_changed` (pola hook project S3b).
`rejectRefund` untuk subjek booking: kembalikan status sebelumnya dari audit (pola S3b).

### Seed

`extract-demo-core.ts` mengekstrak `label`, `status`, `bookingReference`, `budgetIdr` layanan, serta `status`,
`reference` (PNR/nomor konfirmasi), `statusReason`, `netCostMinor`, `details` booking. `seed-demo.ts` meng-upsert
kolom baru (baris `demo-fixture` saja) lalu `syncIdSequences`. Layanan PRJ-3xx dari year-demo ikut mendapat label
& status dari fixture `projects-history`.

## Frontend

- `app/types/api.ts` + `lib/api/endpoints.ts`: DTO & panggilan baru (services, bookings).
- `app/data/bookings-sync.ts` (pola `*-sync.ts`): muat layanan + booking setelah `session.ensure()`, merge ke
  `PROJECT_SERVICES`, `FLIGHT_BOOKINGS`, `HOTEL_BOOKINGS`, `TRANSPORT_BOOKINGS`, `MICE_EVENTS` (update in place, buang yang
  tak ada di server), konversi `details` ↔ objek booking, rupiah ↔ minor. Fungsi tulis `*OnServer` untuk tiap endpoint.
- Layout dashboard memuat sync ini; banner gabungan + "Reset Demo Data" ikut reload.
- Pemanggil dialihkan ke server (dengan guard double-submit + toast error):
  - `create*Booking` / `createMiceEvent` (Project Order, `*ListPanel`)
  - `update*` detail booking, `select*Option`, MICE BOQ/sesi/checklist/deliverable/approval (halaman `[id]` domain) →
    `PATCH` dengan `details` utuh
  - `update*Status` → endpoint status
  - `updateServiceStatus`, `ensureProjectServiceForBudget`/`updateProjectServiceBudget`, `setServiceVendor`
    (bagian vendor) → endpoint layanan
- Efek lokal yang tetap: aktivitas project, service order & supplier invoice otomatis setelah vendor/confirmed
  (dipicu setelah server sukses), payment gate, quotation vendor (`assignServiceVendor`/`acceptVendorQuotation` set
  vendor lewat server lalu sisanya lokal).
- Mutator lokal yang tak lagi dipanggil dihapus.

## Testing

- Backend: `test/services-bookings.test.ts` — create layanan & booking (idempotensi, validasi, 401, 403 finance,
  404 scope/portal), reuse layanan kosong, transisi sah/tidak sah + alasan, sinkron status layanan, harga turunan MICE &
  departure date, harga jual di bawah tagihan (422), batal ditolak bila ada transaksi Finance, ganti vendor ditolak bila
  ada invoice vendor, hook pembatalan Finance & reject, `details` bukan object / terlalu besar (400);
  `test/db.test.ts` — seed mengisi kolom baru; finance existing tetap hijau.
- Frontend: `bookings-sync.test.ts` — merge, konversi details/harga, penghapusan; suite penuh, vue-tsc tanpa error
  baru, lint tanpa tambahan.
- Smoke API pada salinan DB; migrasi DB lokal + `db:seed:demo`.

## Deploy

Setelah push: jalankan sekali `bun run db:seed:demo` di server (lihat catatan cutover ADR-004). Tanpa itu aplikasi
tetap jalan, tapi booking/layanan lama memakai status awal & label default sampai seed dijalankan.
