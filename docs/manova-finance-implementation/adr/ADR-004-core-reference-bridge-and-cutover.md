# ADR-004 — Core reference bridge, typed booking reference, dan cutover demo vs produksi

- **Status:** Accepted (Phase 1, 29 Sep 2026)
- **Konteks:** Finance butuh FK valid ke Party/Project/Vendor/Booking, tetapi seluruh domain operasional masih array `reactive()` di `frontend/app/data/*` dan paket melarang rewrite massal `app/data/index.ts` maupun membuat booking tandingan. Temuan audit yang membentuk desain:
  - Tidak ada entitas Booking universal: `FlightBooking`, `HotelBooking`, `TransportBooking`, `MiceEvent` di empat file tipe; agregasi `booking-orchestration.ts` memakai literal `'flight' | 'hotel' | 'transport' | 'mice'` (bukan `'transportation'` seperti `ServiceTypeKey`).
  - Booking **tidak punya `vendorId`**. Vendor terhubung lewat `ProjectService.vendorId` (via `booking.serviceId`) atau `ServiceOrder.vendorId` (procurement). Vendor demo `VND-006` hanya terhubung lewat `SO-002` → PRJ-102.
  - ID fixture stabil dan statis (`PTY-001`, `VND-006`, `PRJ-101`, `SVC-1011`, `FLT-1011`, `SO-002`), tanggal fixture statis.

## Keputusan

1. **Bridge referensi, bukan domain kedua** (migrasi `0002_core_references`): `parties`, `vendors`, `projects` (+ `project_members` di `0003`), `project_services`, `service_orders`, `booking_refs(booking_type, booking_id, project_id, service_id?)`. Hanya kolom identitas/relasi/tampilan dasar; **tanpa harga, biaya, status booking, atau lifecycle procurement.**
2. **Typed booking reference** `(booking_type, booking_id)` dengan literal orkestrasi (`transport`). FK komposit memaksa service sebuah booking/service order berada di project yang sama. Tidak ada tabel booking universal.
3. **ID legacy dipakai apa adanya** sebagai primary key teks, sehingga deep link lama dan referensi finance tetap cocok. Kolom `provenance ∈ {manual, demo-fixture, migration}` membedakan asal data.
4. **Seed demo diekstrak deterministik** dari fixture frontend oleh `bun run seed:extract` → `backend/src/db/seeds/demo-core.json` (terurut, tanpa timestamp; ekstraktor dev-only, server tidak pernah membaca source frontend). Seed memuat referensi dan 7 akun demo saja — **tidak ada invoice/payment/saldo**; test memastikan tidak ada field uang.
5. **API Phase 1 read-only** untuk referensi ini (`/projects`, `/parties`, `/vendors`, `/service-orders/:id`, `/bookings/:type/:id`) dengan scope server. Mutasi referensi tetap di modul operasional sampai domain tersebut dimigrasi.

## Cutover demo vs produksi

| Lingkungan | Sumber referensi | Uang |
|---|---|---|
| Dev/demo | `db:seed:demo` (provenance `demo-fixture`) | Belum ada di Phase 1. Phase 2+ memakai fixture test-only eksplisit (paket `10`), bukan riwayat mock. |
| Produksi | Import terkontrol ber-provenance `migration` atau entri `manual`; seed demo ditolak | Saldo pembuka diverifikasi (maker finance, checker management) pada tanggal cutover; transaksi sebelum cutover hanya historical import. |

Selama domain operasional masih mock, **status/tanggal project di bridge adalah snapshot** saat seed. Aturan pakainya: finance boleh memakai bridge untuk identitas, scope, dan label; keputusan yang bergantung pada status/tanggal booking live (mis. H-x cancellation di Phase 5) harus menunggu domain booking punya sumber server atau mengambil data dari layanan booking resmi. Ini dicatat sebagai blocker Phase 5.

## Alternatif yang ditolak

- **Menyalin seluruh `app/data/index.ts` ke backend** — dilarang paket; menciptakan dua sumber tulis.
- **Tabel `bookings` universal** — bersaing dengan empat domain booking.
- **String ID bebas tanpa FK** — tidak menjamin validitas referensi finance.

## Cara menjalankan

```bash
cd backend
bun run seed:extract    # regenerasi demo-core.json setelah fixture frontend berubah (review diff-nya)
bun run db:seed:demo    # upsert idempotent
```

## Update 2026-10-06 — Project header write API (S3a)

Header project kini ditulis lewat API (`POST /api/v1/projects`, `PATCH /api/v1/projects/:id`, dan
`PUT /api/v1/projects/:id/contract-value` khusus Finance/Super Admin). ID baru dibuat server (`id_sequences`,
format sama: `PRJ-503` dst.) dan baris ber-provenance `manual`. Frontend mengisi array `PROJECTS` dari server
setelah sesi siap (`app/data/projects-sync.ts`). Status/alur Project Order, tim, layanan, milestone, traveler,
dan itinerary **masih** modul frontend sampai tahapnya pindah. Spec:
`docs/superpowers/specs/2026-10-06-project-core-backend-design.md`.

## Update 2026-10-06 — Customer write API (S1)

Customer (profil, kontak, aktivitas CRM) kini ditulis lewat API (`POST/PATCH /api/v1/parties`, kontak dan
aktivitas per customer); semua pembuatan customer di UI internal (tambah customer, qualify B2B/B2C, gabung Group
Trip) lewat server dengan ID `PTY-` dari `id_sequences`. Saat project dibuat dari lead yang di-Won, server
menaikkan customer `prospect` → `client`. Lead, quotation, dan sales order masih modul frontend (S6); portal
client tetap mock (ADR-006).

## Update 2026-10-06 — Project Order workflow & team (S3b)

Status project dan alur Project Order (handover, transisi, Ready, tutup finance, tutup project) serta anggota tim
kini ditulis lewat API (`/api/v1/projects/:id/handover/*`, `/transition`, `/ready`, `/finance-close`, `/close`,
`/members/:userId`). Server menegakkan aturan yang datanya ada di server (peta transisi, alasan, handover, DP
diterima sebelum Ready, hambatan Finance sebelum tutup finance); gate berbasis data lokal (traveler, itinerary,
insiden, booking) tetap di UI. Pembatalan project lewat Finance mengubah status project di transaksi yang sama.
Layanan + vendor menyusul bersama Booking (S4).

## Update 2026-10-06 — Vendor write API (S2)

Profil vendor (nama, kontak, kategori, status), kontak vendor, katalog produk, dan catatan dokumen vendor kini
ditulis lewat API (`POST/PATCH /api/v1/vendors`, `POST /vendors/:id/contacts|products|documents`) dengan ID
`VND-`/`VCT-`/`VPR-`/`VDOC-` dari `id_sequences` dan capability `vendor.manage-vendor` (admin). Jenis layanan
vendor tidak bisa diubah setelah dibuat. Dokumen hanya metadata (belum ada penyimpanan file). Vendor baru langsung
bisa ditagih Finance. Akun login Vendor Portal, produk dari portal supplier, quotation, aktivitas, dan service
order vendor tetap lokal (procurement S5, portal ADR-006).

**Cutover S1/S2 di server yang sudah berjalan:** deploy hanya menjalankan `db:migrate`; seed demo cuma di deploy
pertama. Setelah deploy yang membawa migrasi 0019–0021, jalankan sekali `bun run db:seed:demo` di server
(upsert idempoten) **sebelum** ada yang menambah kontak/produk/dokumen. Tanpa itu, kontak/produk/dokumen demo
hilang dari UI, dan ID `VCT-`/`VPR-`/`VDOC-` baru bisa bertabrakan dengan fixture (fixture lalu dilewati seed).

## Update 2026-10-07 — Layanan project & booking (S4a)

Layanan project dan booking flight/hotel/transport/MICE kini ditulis lewat API (`POST /projects/:id/services`,
`PATCH /project-services/:id`, `POST /bookings/:type`, `PATCH /bookings/:type/:id`, `POST /bookings/:type/:id/status`)
dengan ID `SVC-`/`FLT-`/`HTL-`/`TRN-`/`MICE-` dari `id_sequences` dan capability `project-order.manage-service.<jenis>`.
`booking_refs` menjadi tabel booking penuh (status, harga net, referensi/PNR, alasan status, `details` JSONB milik UI);
semua FK Finance tetap. Harga MICE dan tanggal berangkat dihitung server dari `details`. Aturan: status layanan
mengikuti booking-nya; batal booking yang sudah punya transaksi Finance ditolak (ajukan lewat Finance — pembatalan
Finance ikut membatalkan booking, dan dikembalikan bila kasusnya ditolak); harga jual tidak boleh di bawah yang sudah
ditagih; vendor layanan tidak bisa diganti bila sudah ada invoice vendor untuknya. Tetap lokal: quotation vendor,
service order & supplier invoice otomatis, payment gate & attempt log booking (S4b/S5), log aktivitas project.
Migrasi 0022 memberi baris lama label & status awal; `db:seed:demo` sekali setelah deploy mengisi nilai aslinya.

## Update 2026-10-07 — Quotation vendor, service order & orkestrasi booking (S4b)

Quotation vendor (`GET/POST /vendor-quotations`, `/:id/accept`, `/:id/reject`) dan service order (`GET /service-orders`,
`POST /service-orders/:id/status`) kini di server. Menerima quotation dalam satu transaksi: quotation pesaing ditolak,
quotation lama yang diterima digantikan, vendor layanan diset (aturan invoice vendor S4a tetap berlaku), layanan
`confirmed` bila belum punya booking, dan service order dibuat bernilai quotation. Mengganti vendor layanan membuat
service order draft untuk vendor baru dan membatalkan order vendor lama yang belum ditagih; order yang sudah ditagih
Finance tidak bisa dibatalkan. Payment gate booking **dihitung** dari Finance (tagihan booking sendiri, atau DP project
bila booking tak punya tagihan) — tombol "cleared" manual dihapus. Log percobaan booking dan tanda duplikat (409 +
konfirmasi) di server. **Supplier invoice otomatis lokal dihapus**: tagihan vendor hanya lewat Finance (Utang Vendor).
Tetap lokal: RFQ, amandemen SO, supplier invoice & portal supplier (S5, ADR-006), `dependsOn`, aktivitas project/vendor.
Setelah deploy jalankan sekali `db:seed:demo` (quotation, status SO, log percobaan demo).

## Update 2026-10-07 — Lead, quotation client & Won (S6a)

Lead (`GET/POST /leads`, `PATCH /leads/:id`, `/:id/{qualify,unqualify,archive,reopen,merge,won}`, aktivitas &
follow-up) dan quotation client (`GET /quotations`, `POST /leads/:id/quotation`, `PATCH /quotations/:id`,
`/:id/{revise,submit,withdraw,approve,reject,send}`) kini di server (migrasi 0024). Tiap versi quotation menyimpan isi
lengkapnya dan terkunci begitu diajukan; revisi membuat versi baru. Pengaju boleh menyetujui sendiri — audit mencatat
`selfApproved`. Qualify memeriksa field wajib form dan menautkan customer (dipakai ulang bila nama & jenis sama, kalau
tidak dibuat baru). Won membuat project lewat jalur S3a dengan nilai kontrak = versi yang disetujui; revisi setelah
Won tidak mengubah project (nilai kontrak tetap milik Finance). `projects.lead_id` / `source_quotation_id` kini FK
`NOT VALID` (baris lama tidak dicek), dan `POST /projects` menolak lead/quotation yang tidak dikenal dengan 400.
Seed ulang memperbarui teks fixture tetapi tidak menimpa stage lead, status/versi quotation, atau tautan customer.
Tetap lokal: sales order B2C & Group Trip (S6b — jawaban B2C disimpan apa adanya di `leads.b2c`), cost sheet,
lampiran/komentar quotation, akun portal client, dan form publik `/lead-intake` (perlu endpoint anonim tersendiri).
Setelah deploy jalankan sekali `db:seed:demo` (31 lead, aktivitas, 10 quotation).

## Update 2026-10-07 — Sales order B2C & Group Trip (S6b)

Seluruh sales order kini di server (migrasi 0025 memperluas `sales_order_refs`; `project_id` boleh kosong untuk order
B2C standalone): `GET/POST /sales-orders`, `POST /sales-orders/:id/status`, `GET /projects/:id/seats`, dan qualify B2C
(`POST /leads/:id/qualify` dengan `priceMinor`) / Group Trip (`POST /leads/:id/group-trip`). Kursi Group Trip =
kapasitas − pax order paid/ongoing/done − pax order draft; pembuatan booking mengunci baris project, kursi kurang →
waitlist tanpa order. Booking Group Trip menjadi `paid` hanya lewat konfirmasi DP Finance (dalam transaksi yang sama);
order standalone ditandai paid manual dan tidak bisa ditagih lewat Finance. Batal wajib alasan dan tetap boleh setelah
ada invoice (Finance menindaklanjuti refund/void). Seed hanya menulis status order yang belum pernah diubah API
(`status_changed_at` kosong). Tetap lokal: traveler (S7). Setelah deploy jalankan sekali `db:seed:demo`.

## Update 2026-10-07 — Peserta: traveler, grup & rooming (S7a)

Traveler, grup traveler, dan rooming list kini di server (migrasi 0027): `GET /travelers`, `/traveler-groups`,
`/room-assignments`, tulis lewat `project-order.manage-travelers` (tambah/ubah/hapus-koreksi, verifikasi dokumen, VIP,
batal dengan alasan, ganti peserta atomik, isi kamar tanpa dobel-assign, impor dengan validasi ulang paspor). Seluruh
peran internal membaca data identitas lengkap (paspor/KTP/visa); portal 403. Konfirmasi DP Group Trip membuat traveler
sebanyak pax order dalam transaksi yang sama (sekali per order); batal order membatalkan traveler-nya dan
mengeluarkannya dari kamar. Seed hanya memperbarui baris fixture yang belum diubah API (`changed_by_api_at`). Tetap
lokal: portal client (ADR-006). Setelah deploy jalankan sekali `db:seed:demo`.

## Update 2026-10-08 — Itinerary harian (S7b)

Item itinerary harian kini di server (migrasi 0028, `itinerary_items`, ID `ITIN-`): `GET /itinerary-items?projectId=`
untuk seluruh peran internal (termasuk nominal vendor; portal 403), tulis lewat `project-order.manage-operations`
(`POST /projects/:id/itinerary-items` dengan Idempotency-Key, `PATCH`/`DELETE /itinerary-items/:id`). Tanggal dan judul
wajib, jam `HH:MM`, grup harus milik project yang sama, nominal vendor (string minor) hanya bila vendor diisi —
mengosongkan vendor ikut mengosongkan nominal. Tanggal tidak dipaksa di dalam periode project. Seed hanya memperbarui
item fixture yang belum diubah API. Tetap lokal: versi itinerary, komentar, approve/minta revisi (portal client,
ADR-006). Setelah deploy jalankan sekali `db:seed:demo`.

## Update 2026-10-09 — Task & milestone project (S7c)

Task (`project_tasks`, `TSK-`) dan milestone (`project_milestones`, `PMS-`, checklist deliverable sebagai jsonb) kini
di server (migrasi 0029): `GET /tasks`, `GET /milestones` untuk seluruh peran internal (portal 403), tulis lewat
`project-order.manage-operations`. Task boleh tanpa project (tugas umum); blokir wajib beralasan dan terpisah dari
status. Tanggal rencana milestone terkunci (422) setelah project lewat Drafting; "tandai selesai" mengisi tanggal
realisasi hari ini. Template milestone tetap data master lokal: frontend menghitung daftarnya lalu
`POST /projects/:id/milestones/replace` mengganti seluruh milestone project dalam satu transaksi. Project baru
(`POST /projects`, termasuk Won lead) langsung mendapat 8 milestone default dari server. Seed: 16 task dan 192
milestone (termasuk riwayat PRJ-301…340), hanya memperbarui baris yang belum diubah API. Tetap lokal: risiko, catatan
project, shift notes (tanpa layar tulis), log aktivitas (S7d). Setelah deploy jalankan sekali `db:seed:demo`.

## Update 2026-10-10 — Log aktivitas & entri perubahan project (S7d)

Log aktivitas project kini di server (migrasi 0030, `project_activities`): `ACT-` ditulis oleh aksi server dalam
transaksi yang sama (status booking termasuk lewat pembatalan Finance, layanan ditandai `changed`, booking dobel
disengaja, status service order, project dari lead Won); `CHG-` dicatat manual lewat `POST /projects/:id/changes`
(`project-order.log-change`, peminta = aktor) lalu disetujui/ditolak (`project-order.review-change`, capability baru,
juga di `frontend/app/data/rbac.ts`). Entri perubahan otomatis ditutup dengan `POST /project-activities/:id/review`
(sebelumnya memicu tanda "perlu perhatian" selamanya). `GET /project-activities` untuk seluruh peran internal; portal
403. Modul yang masih lokal (change request, insiden, pembatalan non-Finance, RFQ, amend SO, portal, persetujuan klien
MICE) tetap menulis `ACT-L`/`CHG-L` di browser; sinkron tidak menghapusnya. Log sistem / Activity Center tetap lokal
(S10). Setelah deploy jalankan sekali `db:seed:demo` (9 entri demo).

## Update 2026-10-11 — Change request, insiden & pembatalan non-Finance (S8)

Change request (alur internal submitted → under-review → approved/rejected → implemented), insiden, dan catatan
pembatalan no-show/refunded kini di server (migrasi 0031: `change_requests`, `incidents`, `booking_cancellations`).
Membuat change request membuka entri perubahan `CHG-` (S7d) dalam transaksi yang sama dan keputusan change request
memutuskan entri itu. Hak: buat CR/insiden & langkah insiden `project-order.log-change`; review/setujui/tolak CR
`project-order.review-change`. Status booking `no-show`/`refunded` menerima `penaltyMinor` & `refundEligible` dan
menyimpan catatan `CNX-`; pembatalan `cancelled` tetap kasus Finance (`refunds`) tanpa catatan lokal. Server menolak
`→ in-progress` bila ada insiden open/escalated dan `→ completed` bila ada change request submitted/under-review. Alur
portal klien (draft, cek ketersediaan, estimasi biaya, persetujuan klien) tetap lokal (`CR-L…`). Setelah deploy jalankan
sekali `db:seed:demo` (7 CR, 4 insiden, 3 pembatalan riwayat).
