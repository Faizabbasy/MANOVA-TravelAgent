# Frontend Demo and Review Guide — MANOVA

Dibuat oleh **Section 24 — Full Regression dan Final Implementation Guide** (2026-08-01). Memperluas pola `docs/mockup-demo-script.md` (Section 18 lama, 10-step, mencakup fase Prompt 0–20) ke SELURUH permukaan aplikasi saat ini (25-tahap roadmap Section 00–24). Dokumen `mockup-demo-script.md` lama TIDAK dihapus — tetap berlaku sebagai versi historis fase pertama; dokumen ini adalah versi definitif/final yang dipakai untuk demo dan review mulai sekarang.

**Cara ganti role saat demo:** buka `/settings`, klik salah satu user demo pada daftar (`setCurrentUser(user.id)`) — role aktif tersimpan di `localStorage` browser (mock-only, D-058), tidak ada login/password nyata. Seluruh ID fixture yang dikutip di bawah adalah ID sungguhan di codebase (`app/data/*.ts`), bukan placeholder.

---

## 0. Batasan yang Harus Disampaikan di Awal Demo Apa Pun

- Ini adalah **frontend-only mockup**. Tidak ada backend, API produksi, database, payment gateway, atau integrasi vendor/airline/hotel/WhatsApp nyata di mana pun (D-005/D-006). Seluruh "kirim"/"simpan"/"generate PDF" adalah simulasi client-side.
- Data reset ke kondisi seed setiap kali tombol "Reset Demo Data" (`/settings`) ditekan, atau tetap berubah selama sesi browser berjalan (state hidup di memory, `reactive()` Vue).
- Verifikasi klik-interaktif end-to-end TIDAK pernah dijalankan otomatis di lingkungan pengembangan ini (tidak ada tool browser headless) — seluruh fungsi sudah dikonfirmasi lewat code review ketat + smoke-test konten SSR, tapi kombinasi klik-demi-klik yang presenter lakukan secara live akan menjadi validasi interaktif PERTAMA untuk sebagian jalur.
- Print preview (e-ticket, voucher, quotation, dst.) memakai `window.print()` browser bawaan — bukan generator PDF/dokumen nyata.
- 9.428 temuan lint (murni gaya kode) ada di backlog — tidak memengaruhi fungsi apa pun, jangan disalahartikan sebagai bug saat mereview kode.

---

## 1. Demo Script — Alur Utama Lead sampai Closed

Presenter disarankan login sebagai **Super Admin** (`USR-010`, superset akses) di awal, lalu berpindah role sesuai langkah yang relevan.

### Langkah 1 — Public Lead Intake (tanpa login)
Buka `/lead-intake` (route publik, tanpa layout dashboard). Isi salah satu dari 4 kategori (Ticketing/Accommodation/Transportation/MICE), centang consent, submit. Perhatikan preview UTM/referrer dan saran duplikat non-blocking bila email/telepon mirip lead existing (mis. coba email mirip `LED-007`).

### Langkah 2 — Sales Qualification
Login sebagai **Sales** (`USR-001`, Rani Kusuma). Buka `/customer-journey/leads`. Pilih lead baru dari Langkah 1 (atau `LED-005`/`LED-009` yang sudah siap), buka drawer detail, isi tab "Qualification" (13 field), assign ke Account Executive lewat field "Account Executive yang Menerima Lead". Simpan — perhatikan lead berubah status dan otomatis membuat `Opportunity`+`Party` (no-duplicate check, Party existing dicari dulu).

### Langkah 3 — AE Opportunity, Requirement, dan Quotation
Login sebagai **Account Executive** (`USR-014`, Galih Ramadhan). Buka `/crm/opportunities/OPP-005` (contoh live: stage `negotiation`, `QUO-005` `submitted`) atau `/crm/opportunities/OPP-009`/`OPP-010` (skenario "Ready for Quotation"/"Quotation Draft"). Isi/edit Requirement Detail, buka Cost Sheet terkait di `/product-planning/cost-sheets` (login **Product Planner**, `USR-017`, untuk sisi costing bila ingin tunjukkan kolaborasi lintas role), lalu kembali sebagai AE untuk Create/Edit Quotation, buka preview cetak di `/crm/opportunities/OPP-005/quotation-preview`.

### Langkah 4 — Management Approval
Login sebagai **Management** (`USR-003`, Sari Wijaya). Buka `/crm/quotations` (Management Approval Queue, 3 tab). Review `QUO-005` (tab "Menunggu Approval") — buka dialog detail (margin/discount/tax/markup/terms/complexity/risk), Approve atau Reject dengan catatan.

### Langkah 5 — Client Confirmation
Dua jalur: (a) AE mencatat manual di `/crm/opportunities/[id]` (dialog "Catat Client Confirmation"), atau (b) self-service oleh Client sendiri — login sebagai **Client** (`USR-019`, Hendra Wijaya, `clientPartyId: PTY-001`), buka `/client/opportunities/[id]` milik company-nya, Accept/Reject/Request Revision.

### Langkah 6 — Won, Active Client, Project Order
Sebagai **AE**, klik "Mark as Won" pada Opportunity yang sudah `approved`+`clientConfirmedAt` terisi — perhatikan `Party.lifecycleStatus` berubah `prospect→client` otomatis dan `Project` baru langsung tercipta (redirect otomatis ke `/projects/[id]`).

### Langkah 7 — AE-to-PM Handover dan Planning
Login sebagai **Project Manager** (`USR-002`, Doni Saputra, atau `USR-013`, Fitri Handayani). Buka `/projects/PRJ-104` (satu-satunya project `draft`, sengaja dibiarkan Handover Pending untuk demo) — tab Overview, klik "Accept Handover" (atau "Return Handover" dengan alasan untuk demo jalur reject). Untuk contoh project yang sudah berjalan penuh, gunakan `PRJ-101`/`PRJ-102`/`PRJ-103`.

### Langkah 8 — Traveler Collection
Masih di `/projects/PRJ-101` (atau 102/103), tab "Travelers" — lihat `TravelerGroup`/`RoomAssignment`, coba bulk import preview, lihat manifest/rooming export preview (`/projects/PRJ-101/manifest-preview`), perhatikan sensitive value masking (hanya PM/Super Admin melihat nomor dokumen penuh).

### Langkah 9 — Supplier Sourcing (RFQ)
Login sebagai **Procurement** (`USR-018`, Wulan Kartika). Buka `/procurement`, lihat `RFQ-001`–`RFQ-004` (lifecycle `draft`→`sent`→`responses-in`→`comparison`→`selected`→`closed`), buka salah satu (mis. `RFQ-003`, status `comparison`) untuk lihat side-by-side comparison + clarification thread, lakukan "Select". Untuk sisi Supplier: login sebagai **Supplier** (`USR-015`, Hasan Alfarizi, `vendorId: VND-006`), buka `/supplier/rfq` untuk respons RFQ yang mengundang company-nya.

### Langkah 10 — Service Booking (pilih 1-2 domain)
Login sebagai role domain terkait, mis. **Ticketing** (`USR-004`, Andi Pratama) buka `/ticketing/FLT-1011` (lifecycle Hold/Confirm/Issue), preview e-ticket di `/ticketing/FLT-1011/eticket-preview` (perhatikan `netCostIdr` TIDAK muncul di preview). Alternatif: **Accommodation** (`USR-005`, Maya Putri) di `/accommodation/HTL-1022`, **Transportation** (`USR-006`, Rudi Hartono) di `/transportation/TRN-1034`, atau **MICE** (`USR-007`, Lina Marlina) di `/mice/MICE-1035`. Untuk pandangan konsolidasi lintas domain: login **Operations** (`USR-009`, Fajar Nugroho), buka `/bookings` (Timeline) dan `/bookings/exceptions` (Exception Queue).

### Langkah 11 — Readiness
Kembali ke `/projects/PRJ-101`, tab "Itinerary & Services" — lihat SectionCard "Departure Readiness Gate" dan "Service Readiness Matrix" (advisory, tidak mem-block transisi status).

### Langkah 12 — Changes / Incident
Sebagai **Operations** atau **Project Manager**, buka `/changes` — lihat `CR-001`–`CR-006` (Change Request), tab Cancellations (`CNX-001`–`CNX-003`), tab Refunds (`REF-001`–`REF-005`), tab Incidents (`INC-001`–`INC-004`, coba buka `INC-002`/`INC-003` yang berstatus lebih lanjut untuk lihat escalation+communication log).

### Langkah 13 — Finance
Login sebagai **Finance** (`USR-008`, Budi Santoso). Buka `/finance/invoices` (lihat `INV-1011`/`INV-1021`/`INV-1022`/dst.), `/finance/payments` (`PAY-1011`/dst.), `/finance/notes` (`CN-001`/`DN-001` — Credit/Debit Note, perhatikan `CN-001` hasil hook prospektif dari `REF-xxx` yang `processed` setelah Section 20 berjalan), `/finance/reconciliation`. Di `/projects/PRJ-101` tab "Finance", coba "Close Finance" bila closure gate sudah `ready`.

### Langkah 14 — Project Closure (BARU, Section 24)
Sebagai **Management**/**Project Manager**/**Super Admin**, buka `/projects/[id]` tab Overview, gulir ke SectionCard "Project Closure" (baru). Bila project belum memenuhi gate, perhatikan daftar blocker eksplisit (service/booking belum terminal, finance belum settled, ada incident/change request terbuka, dokumen kedaluwarsa). Bila `ready:true`, isi Final Note (wajib) + Client Feedback (opsional), klik "Close Project" — perhatikan closure summary derivasi muncul (total service/booking/invoiced/paid/incident resolved/change implemented). **Catatan jujur:** tidak ada fixture project berstatus `completed` saat ini, sehingga jalur sukses ("ready:true") tidak dapat didemokan langsung tanpa mengubah status project lebih dulu secara manual (`updateProjectStatus`) — demokan jalur "belum ready" (blocker list) sebagai default, atau majukan status `PRJ-101` secara manual di layar untuk menunjukkan jalur sukses.

### Langkah 15 — Reports dan Dashboard Tour
Buka `/` (Dashboard, widget berubah total sesuai role aktif) dan `/reports` (7 SectionCard termasuk "SLA dan Quotation Performance" baru). Coba "Simpan View"/terapkan Saved View, dan dialog "Export" (perhatikan toast konfirmasi nama file — TIDAK ADA file nyata dihasilkan).

### Langkah 16 — Admin/Master Data Tour
Login sebagai **Super Admin**. Buka `/admin` (5 kartu termasuk Organization Profile baru), `/admin/master-data` (3 kelompok × 15 sub-tab, coba Add/Edit satu entri di kategori "Currency"), `/admin/users` (tab "Access Review", coba Suspend/Reactivate `USR-011`), `/admin/roles` (Matrix View read-only, 16×17 grid), `/admin/audit-trail` (coba search box, cari "close" untuk lihat jejak Close Finance/Close Project).

---

## 2. Per-Role Review Checklist

Untuk setiap role, verifikasi: (a) item nav yang tampil sesuai `ROLE_MODULE_ACCESS`, (b) minimal satu aksi nyata berhasil dijalankan, (c) untuk Client/Supplier — data yang terlihat HANYA milik company/vendor sendiri dan TIDAK ADA field cost/margin internal.

| Role | User Demo | Nav yang Wajib Tampil | Aksi Inti untuk Diverifikasi |
|---|---|---|---|
| Super Admin | `USR-010` | Seluruh nav item | `/admin/*` penuh, Matrix Role, oversight `/client`/`/supplier` tanpa data bocor. |
| Management | `USR-003` | Customer Journey, CRM, Projects, Finance (VIEW), Reports, Documents (MANAGE) | Approve/Reject Quotation di `/crm/quotations`, Close Finance/Close Project. |
| Sales | `USR-001` | Customer Journey → Leads saja | Create/Qualify/Reopen Lead, assign ke AE. TIDAK bisa akses Opportunity/Quotation mutasi. |
| Account Executive | `USR-014` | CRM penuh, Product Planning (VIEW) | Create/Edit Quotation, Mark as Won, Client Confirmation (AE-facing). |
| Product Planner | `USR-017` | Product Planning (MANAGE) | Create Cost Sheet, apply ke Quotation. |
| Project Manager | `USR-002`/`USR-013` | Projects (MANAGE), Changes/Documents (MANAGE) | Accept/Return Handover, transisi status, Close Project. |
| Operations | `USR-009` | Projects, Bookings (MANAGE), Changes (MANAGE) | Booking Timeline/Exception, buat Change Request. |
| Ticketing | `USR-004` | Ticketing (MANAGE) | Hold/Confirm/Issue `FlightBooking`. |
| Accommodation | `USR-005` | Accommodation (MANAGE) | Quote/Confirm `HotelBooking`. |
| Transportation | `USR-006` | Transportation (MANAGE) | Assign/Confirm `TransportBooking`. |
| MICE | `USR-007` | MICE (MANAGE) | Update status `MiceEvent`, BOQ. |
| Procurement | `USR-018` | Vendors (MANAGE), Procurement (MANAGE) | Kirim RFQ, bandingkan respons, Select vendor, buat Service Order. |
| Finance | `USR-008` | Finance (MANAGE) | Create Invoice, Record Payment, Issue Credit Note, AP reconciliation. |
| Viewer / Auditor | `USR-011` (suspended — gunakan user viewer aktif lain bila ada, atau catat status Suspended sebagai demo state itu sendiri) | VIEW hampir seluruh modul | Konfirmasi TIDAK ADA tombol aksi mutasi yang berfungsi di halaman manapun. |
| Client | `USR-019` (`PTY-001`) / `USR-020` (`PTY-002`) | Client Portal saja | Accept/Reject Quotation, submit Traveler, lihat Project Order milik company sendiri. **Wajib cek**: tidak ada `estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/`approvedBy`/`approvalNote` di mana pun. |
| Supplier | `USR-015` (`VND-006`, aktif) / `USR-016` (`VND-007`, suspended — demo state ditolak akses) | Supplier Portal saja | Respon RFQ, acknowledge Service Order, submit invoice preview. **Wajib cek**: tidak ada `netCostIdr` Procurement/Booking pihak lain, hanya order milik vendor sendiri. |

**Catatan khusus role Suspended (`USR-011`, `USR-016`):** gunakan untuk mendemokan state "akses ditolak" — role-switch ke user ini seharusnya tetap bisa dipilih di `/settings` (demo mechanism), tapi perilaku aplikasi terhadap user berstatus `suspended` adalah bagian dari Access Review Section 23, bukan blocking-login (tidak ada mekanisme login nyata untuk diblokir).

---

## 3. Known Limitations to State Upfront (Ringkasan)

Detail lengkap: `docs/frontend-known-issues.md`. Poin yang WAJIB disebutkan presenter/reviewer sebelum atau selama demo:

1. Frontend-only mockup — tidak ada backend/database/payment gateway/integrasi nyata.
2. Interactive click-testing tidak pernah divalidasi otomatis (tidak ada headless browser di lingkungan pengembangan) — dimitigasi code review, bukan dihilangkan sebagai risiko.
3. Role-switching adalah mekanisme demo client-only (`localStorage`) — tidak identik dengan sistem login/otentikasi produksi.
4. Project Closed "documents complete" check bersifat best-effort (expiry-only), tidak ada daftar dokumen wajib per tipe project di data model saat ini.
5. Accommodation (`HotelBooking`) tidak memiliki flag schedule-change setara Flight/Transport/MICE — parity gap kecil, dicatat, tidak diperbaiki (lihat known-issues bagian 20).
6. 9.428 temuan lint (gaya kode) — non-blocking, tidak memengaruhi fungsi.
7. Print preview memakai `window.print()` browser, bukan generator dokumen/PDF nyata.
8. Data demo reset ke seed HANYA lewat tombol eksplisit "Reset Demo Data" (`/settings`) — perubahan yang dibuat selama demo akan tetap terlihat sampai direset atau browser di-reload penuh (tergantung timing snapshot).
