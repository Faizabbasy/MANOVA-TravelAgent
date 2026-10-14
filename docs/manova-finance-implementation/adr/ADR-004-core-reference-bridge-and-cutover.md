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
`→ ongoing-trip` (tahap Departure) bila ada insiden open/escalated dan `→ completed` bila ada change request submitted/under-review. Alur
portal klien (draft, cek ketersediaan, estimasi biaya, persetujuan klien) tetap lokal (`CR-L…`). Setelah deploy jalankan
sekali `db:seed:demo` (7 CR, 4 insiden, 3 pembatalan riwayat).

## Update 2026-10-12 — Dokumen & pesan (S9)

Metadata dokumen dan pesan internal kini di server (migrasi 0032: `documents`, `messages`). Tidak ada penyimpanan
file — dokumen adalah metadatanya, sama seperti layar sebelumnya. `POST /documents` butuh capability baru
`document.manage` (admin; juga di `frontend/app/data/rbac.ts`), pengunggah = aktor, versi 1. `POST /messages` boleh
untuk seluruh peran internal, pengirim = aktor; status kirim disimulasikan (internal-note → sent, client/supplier →
delivered) dan pesan ke client/supplier tercatat di log aktivitas project. ID server `DOC-001…`/`MSG-012…`; fixture
`DOC-C…` tetap. Notifikasi (termasuk mention) tetap mock lokal sampai S9b. Portal client (unggah/ganti versi dokumen
client, komentar, read/unread) tetap lokal dengan ID `DOC-L…`/`MSG-L…`. Setelah deploy jalankan sekali `db:seed:demo`.

## Update 2026-10-12 — Notifikasi (S9b)

Notifikasi in-app kini di server (migrasi 0033, `notifications`, satu penerima per baris). Server membuatnya di
transaksi aksi: mention di pesan (hanya user internal; mention user portal ditolak), penugasan task (saat dibuat atau PIC
berganti) dan eskalasi insiden — tidak pernah untuk aktornya sendiri. `GET /notifications`, `POST /notifications/:id/read`,
`POST /notifications/read-all`, `DELETE /notifications/:id` hanya untuk notifikasi milik user yang login (milik orang lain
→ 404). Lonceng memuat ulang saat dibuka. Notifikasi yang dipicu portal client tetap lokal (`NOT-L…`). Setelah deploy
jalankan sekali `db:seed:demo` (17 notifikasi demo).

## Update 2026-10-12 — User & jejak audit (S10a)

Status dan role user kini milik server (migrasi 0034: `suspended_reason`, `suspended_at`, `changed_by_api_at`; user
suspend wajib punya alasan). Hanya Super Admin (`admin.manage-users`) yang boleh `POST /users/:id/suspend`,
`POST /users/:id/reactivate` dan `PUT /users/:id/role` (hanya super-admin/admin/finance; user portal dan diri sendiri
ditolak 422; Super Admin aktif terakhir tidak bisa disuspend atau diturunkan). Suspend dan ganti role mengakhiri sesi user
itu, dan user suspend tidak bisa login. `GET /users` untuk role internal. Activity Center dan Session Log membaca
`audit_events` lewat `GET /audit/events` (200 terbaru, id `AUD-…`) dan `GET /audit/sessions` (`SES-…`), keduanya butuh
`admin.view-activity-center`. Editor RBAC, master data dan profil organisasi masih lokal (event `EVT-…`, S10b). Seed ulang
tidak menimpa role/status user yang pernah diubah lewat API (`changed_by_api_at`). Setelah deploy jalankan
`db:migrate` lalu `db:seed:demo`.

## Update 2026-10-12 — Master data & profil organisasi (S10b)

16 kategori master data kini di server (migrasi 0035, `master_data_records`: `category` + `data jsonb`, field divalidasi
per kategori di `core/master-data.ts`; kode IATA bandara/maskapai dan kode currency unik per kategori, juga lewat index
unik) dan profil organisasi di tabel singleton `organization_profile` (`ORG-001`). Semua peran internal membaca
(`GET /master-data`, `GET /organization-profile`; portal 403); Admin dan Super Admin menulis lewat
`admin.manage-master-data`: `POST /master-data/:category` (Idempotency-Key), `PATCH /master-data/:category/:id`,
`POST …/deactivate|reactivate`, `PUT /organization-profile`. Currency default profil harus currency aktif, dan currency
itu tidak bisa dinonaktifkan atau diganti kodenya selama dipakai profil. Kategori ini tetap referensi/konfigurasi: tidak
ada booking, invoice atau penomoran ID yang membacanya sebagai aturan. Hitungan "dipakai di N record" dihitung di
browser. Editor RBAC tetap lokal. Seed ulang tidak menimpa record/profil yang diubah lewat API (`changed_by_api_at`).
Setelah deploy jalankan `db:migrate` lalu `db:seed:demo`.

## Update 2026-10-12 — Inventory: aset, maintenance & peminjaman (S11a)

Aset milik MANOVA, jadwal maintenance dan peminjaman aset kini di server (migrasi 0036: `assets`, `asset_maintenance`,
`asset_checkouts`; satu peminjaman terbuka per aset lewat index unik). Semua peran internal membaca (`GET /assets`,
`/asset-maintenance`, `/asset-checkouts`; portal 403); Admin dan Super Admin menulis lewat `inventory.manage-asset`:
`POST /assets` (Idempotency-Key, kode per kategori dibuat server), `PATCH /assets/:id` (kategori tetap; status manual hanya
`available`/`maintenance`/`retired`, ditolak selama aset dipinjam), `POST /asset-checkouts` (aset harus tersedia; project
belum ditutup; peminjam user internal aktif), `POST /asset-checkouts/:id/return`, `POST /asset-maintenance`,
`POST /asset-maintenance/:id/complete`. Status `overdue` tidak disimpan — dihitung dari tanggal hari ini. `POST
/projects/:id/close` kini menolak (422) selama ada aset yang dipinjam ke project itu belum kembali. Nilai perolehan aset
dan biaya maintenance (`purchasePriceMinor`, `costMinor`) adalah angka operasional Inventory, bukan pembukuan Finance.
Setelah deploy jalankan `db:migrate` lalu `db:seed:demo`.

## Update 2026-10-13 — Konten marketing (S11b)

Jadwal konten dan pipeline pengembangan konten kini di server (migrasi 0037: `content_schedule`, `content_development`).
Semua peran internal membaca (`GET /content-schedule`, `GET /content-development`; portal 403); capability baru
`marketing.manage-content` (Admin + Super Admin, ditambahkan di matriks server, matriks frontend dan katalog capability)
untuk `POST`/`PATCH /content-schedule` dan `POST`/`PATCH /content-development`. PIC konten harus user internal aktif;
`updatedOn` diisi server dengan tanggal bisnis Jakarta. `campaignId` disimpan sebagai referensi teks karena campaign,
promo dan laporan marketing (funnel, CAC, LTV, ROI) masih seperti sebelumnya. Seed ulang tidak menimpa baris yang
diubah lewat API. Setelah deploy jalankan `db:migrate` lalu `db:seed:demo`.

## Update 2026-10-13 — Human Resource (S11c)

Data HR kini di server (migrasi 0038: `employees`, `attendance_records`, `performance_reviews`, `payroll_runs`,
`payroll_lines`, `incentives`). Keputusan pengguna: angka gaji, tunjangan, potongan, komisi dan insentif **dipegang
Finance dan Super Admin**; `hr.manage-payroll` dipindah dari Admin ke Finance di kedua matriks RBAC. Admin tidak
menerima angka itu sama sekali: `GET /employees` mengirim `baseSalaryMinor`/`commissionRatePercent` = `null` tanpa
`hr.manage-payroll`; `/payroll-runs`, `/payroll-lines`, `/hr/commissions`, `/incentives` menolak (403); aksi uang diaudit
dengan awalan `finance.` sehingga Activity Center menyembunyikannya dari Admin. Admin (`hr.manage-employee`) mengelola
field non-uang karyawan; Finance hanya field uang (403 untuk yang lain). Absensi dan review hanya dibaca. Payroll:
`POST /payroll-runs {period}` membuat run draft (`PRN-YYYY-MM`) dengan baris untuk karyawan aktif bergaji, lalu approve →
paid; baris hanya berubah saat draft. **Payroll hanya menyimpan status — tidak ada posting otomatis ke kas/ledger**;
pembayaran gaji dicatat Finance lewat alur kas yang ada. Komisi dihitung server dari project (`owner_user_id` →
karyawan tertaut, `contract_value_minor` × tarif; status mengikuti project) dan tidak disimpan; insentif manual
disimpan (`INS-`). Setelah deploy jalankan `db:migrate` lalu `db:seed:demo`.

## Update 2026-10-14 — Portal client membaca data server (S12a)

Route baca `GET /travelers`, `/travelers/:id`, `/traveler-groups`, `/room-assignments`, `/itinerary-items`,
`/change-requests`, `/incidents`, `/booking-cancellations`, `/documents`, `/messages` kini menerima user client
(`core/client-scope.ts` `readerScopeOf`): semua query dibatasi ke project party client (`partyId`), detail milik party
lain → 404, filter `projectId` tidak bisa menembus party. Tampilan client: itinerary hanya `visibleToClient` tanpa vendor
& biaya vendor; insiden tanpa log komunikasi internal dan eskalasi (PIC tetap terlihat); dokumen hanya `accessLevel =
'client'` (project atau party client); pesan hanya kanal `client-message`. Vendor tetap 403 di route ini (S12d); internal
tidak berubah. Quotation, reservasi dan invoice untuk client menyusul (S12a-2); tulisan portal tetap lokal (S12b).

## Update 2026-10-14 — Portal client: quotation, reservasi & tagihan (S12a-2)

Endpoint khusus client `GET /api/v1/client/quotations`, `/client/reservations`, `/client/invoices`, `/client/invoices/:id`
(hanya role client; party dari sesi) dengan DTO whitelist (`core/client-commerce.ts`):
- quotation: hanya yang `sent_to_client_on` terisi (disetujui & dikirim; revisi yang belum dikirim ulang tidak tampil),
  tanpa markup/estimasi biaya/margin/cost sheet/approval internal; nama penyusun, bukan id;
- reservasi: **tanpa uang** (keputusan pengguna, ADR-007), tanpa vendor/harga opsi/BOQ/catatan internal/PIC; `details`
  whitelist per tipe; status client Diproses/Dikonfirmasi/Selesai/Dibatalkan;
- tagihan: invoice `party_id` = party client (termasuk invoice peserta Group Trip), status issued/void, baris, pembayaran
  (tanpa rekening & ID transaksi), credit note, ringkasan; tanpa perkiraan tagih & catatan internal.
Route S12a untuk client kini mengosongkan ID staf yang tidak ditampilkan (`uploadedBy`, `verifiedBy`,
`documentsVerifiedBy`, `cancelledBy`, `mentions`, `readBy`) dan `financialImpactNote`; penalti pembatalan dan dampak
komersial CR tetap terlihat (keputusan pengguna — ditagihkan ke client). Frontend `data/client-commerce-sync.ts`.
Catatan demo: party client demo (PTY-005) belum punya quotation terkirim maupun booking di seed — tab tersebut kosong.
