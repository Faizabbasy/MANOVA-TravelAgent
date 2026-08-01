# Mockup Data Scenarios — MANOVA (Prompt 4)

Status dokumen: **baru dibuat di Prompt 4**, sesuai Prompt 4 bagian D. Ini rancangan skenario data demo — bukan implementasi. Belum ada data yang benar-benar ditulis ke kode; ID dan nilai di bawah adalah **spesifikasi yang wajib dipakai identik** saat data terpusat diimplementasikan (agar satu entitas memakai ID dan nilai yang sama di seluruh halaman, sesuai instruksi Prompt 4-D).

Landasan: `docs/mockup-information-architecture.md`, `docs/route-and-role-matrix.md`, `docs/mockup-design-decisions.md` (khususnya D-001/D-024 Party model, D-002/D-025 Opportunity-to-Project, D-028 Project Status, D-029 Service Status, D-037 format Rupiah/tanggal).

**Tanggal acuan "hari ini" untuk seluruh skenario:** konsisten memakai **29 Juli 2026** (Prompt 0 aturan teknis #12 — seluruh tanggal demo harus konsisten). Seluruh tanggal transaksi/keputusan berada sebelum tanggal ini; tanggal perjalanan berada setelahnya (agar "upcoming departure" realistis).

**Skema ID (mengikuti D-014, prefix per entitas — format detail final tetap D-016/DEFERRED, ini dipakai sebagai contoh konkret konsisten):** `USR-` User, `PTY-` Party, `CP-` Contact Person, `OPP-` Opportunity, `QUO-` Quotation, `PRJ-` Project, `VND-` Vendor, `GRP-` Group, `INV-` Invoice, `PAY-` Payment, `TSK-` Task, `CHG-` Change entry, `DOC-` Document.

---

## 0. Master Data Bersama (dipakai lintas skenario, tidak diulang per skenario)

### 0.1 Users (satu per role demo, sesuai D-003)

| ID | Nama | Role |
|---|---|---|
| USR-001 | Rani Kusuma | Sales |
| USR-002 | Doni Saputra | Project Manager |
| USR-013 | Fitri Handayani | Project Manager (kedua, untuk keragaman "project owner") |
| USR-003 | Sari Wijaya | Management |
| USR-004 | Andi Pratama | Ticketing |
| USR-005 | Maya Putri | Accommodation |
| USR-006 | Rudi Hartono | Transportation |
| USR-007 | Lina Marlina | MICE |
| USR-008 | Budi Santoso | Finance |
| USR-009 | Fajar Nugroho | Operations |
| USR-010 | Admin MANOVA | Super Admin |
| USR-011 | Dewi Anggraini | Viewer / Auditor |
| USR-014 | Galih Ramadhan | Account Executive *(Prompt 19)* |
| USR-015 | Hasan Alfarizi | Supplier — PT ABC (`vendorId: VND-006`) *(Prompt 19)* |
| USR-016 | Ika Puspitasari | Supplier — PT EFG (`vendorId: VND-007`) *(Prompt 19)* |

### 0.2 Vendors (fiktif, bukan brand nyata — sesuai D-006)

| ID | Nama | Jenis layanan | Dipakai di project |
|---|---|---|---|
| VND-001 | CV Tiket Mitra Nusantara | Flight | PRJ-101, PRJ-102, PRJ-103 |
| VND-002 | Hotel Prima Mitra | Hotel | PRJ-102, PRJ-103 |
| VND-003 | Trans Wahana Logistik | Transportation | PRJ-103 |
| VND-004 | Cendana MICE Organizer | MICE | PRJ-103 |
| VND-005 | CV Wisata Kargo Ekspres | Transportation (cadangan) | PRJ-103 |
| VND-006 | PT ABC | Hotel (supplier External Partner) | — *(belum ditugaskan ke project, Prompt 19)* |
| VND-007 | PT EFG | MICE (supplier External Partner) | — *(belum ditugaskan ke project, Prompt 19)* |

---

## 1. Skenario Utama 1 — Normal Project (Manila)

### 1.1 CRM
| Field | Nilai |
|---|---|
| Party | PTY-001 — "PT Cipta Distribusi Nusantara" (`lifecycleStatus: Client`, sebelumnya Prospect) |
| Contact person | CP-001 — Hendra Wijaya, Operations Manager |
| Opportunity | OPP-001 — "Manila Business Trip Q3 2026", dibuat 2026-06-10, **Won** 2026-06-25 (approver: USR-003 Sari Wijaya/Management) |
| Quotation | QUO-001 — Rp 95.000.000 (harga ke client), disetujui bersamaan Won |

### 1.2 Project
| Field | Nilai |
|---|---|
| Project | **PRJ-101** — "Manila Business Trip" |
| Destination | Manila, Filipina |
| Travel date | 20–23 Agustus 2026 |
| Project type / characteristic | Normal Project |
| Services (`serviceScope`) | Flight only |
| Traveler count | 6 (individual business traveler, korporat) |
| Project owner | USR-002 — Doni Saputra (PM) |
| Team | USR-004 — Andi Pratama (Ticketing) |
| Vendor | VND-001 |
| Status | `Confirmed` |

### 1.3 Finance
| Field | Nilai |
|---|---|
| Budget (internal) | Rp 85.000.000 |
| Actual cost | Rp 82.500.000 (di bawah budget) |
| Invoice | INV-1011 — Rp 95.000.000, terbit 2026-06-26, jatuh tempo 2026-07-10 |
| Payment | PAY-1011 — Rp 95.000.000 lunas, diterima 2026-07-10 |
| Outstanding | Rp 0 |
| Margin (indikatif, hanya terlihat oleh role dengan akses financial — bagian 5) | Rp 95.000.000 − Rp 82.500.000 = **Rp 12.500.000** (~13%) |

### 1.4 Timeline, Task, Perubahan, Dokumen
| Field | Nilai |
|---|---|
| Timeline | Stabil, tidak ada revisi jadwal |
| Task | TSK-1011 — "Konfirmasi manifest penumpang" — status Done |
| Change history | **(kosong — lihat catatan Empty State di bagian 6.1)** |
| Attention item | Tidak ada |
| Documents | DOC-1011 — "E-ticket_Manila_Group.pdf" (satu-satunya dokumen — lihat catatan Empty State bagian 6.1) |

---

## 2. Skenario Utama 2 — High-Change Project (Abu Dhabi)

### 2.1 CRM
| Field | Nilai |
|---|---|
| Party | PTY-002 — "PT Alam Raya Group" (`lifecycleStatus: Client`) |
| Contact person | CP-002 — Sarah Amelia, HR Manager |
| Opportunity | OPP-002 — "Abu Dhabi Corporate Gathering", dibuat 2026-06-01, **Won** 2026-06-20 (approver: USR-003) |
| Quotation | QUO-002 — Rp 345.000.000 (harga ke client, termasuk revisi kemudian) |

### 2.2 Project
| Field | Nilai |
|---|---|
| Project | **PRJ-102** — "Abu Dhabi Corporate Gathering" |
| Destination | Abu Dhabi, Uni Emirat Arab |
| Travel date | **Awal:** 15–19 September 2026 → **direvisi jadi** 22–26 September 2026 (lihat Change history) |
| Project type / characteristic | High-Change Project |
| Services (`serviceScope`) | Flight + Hotel |
| Traveler count | **Awal 15 → menjadi 18** (lihat Change history) |
| Project owner | USR-013 — Fitri Handayani (PM) |
| Team | USR-004 (Ticketing), USR-005 (Accommodation) |
| Vendor | VND-001 (flight), VND-002 (hotel) |
| Status | `Planning` (sedang finalisasi ulang pasca revisi jadwal) |

### 2.3 Finance
| Field | Nilai |
|---|---|
| Budget (internal) | Rp 310.000.000 |
| Actual cost | Rp 335.000.000 (**melebihi budget ~8%**, akibat upgrade tipe kamar — pemicu attention item) |
| Invoice | INV-1021 — Rp 310.000.000 (terbit 2026-06-21, jatuh tempo 2026-07-01) — **partially paid**; INV-1022 — Rp 35.000.000 (tagihan tambahan akibat perubahan, terbit 2026-07-05, jatuh tempo **2026-07-20 — sudah lewat jatuh tempo relatif terhadap 2026-07-29 → OVERDUE**, lihat bagian 6.2) |
| Payment | PAY-1021 — Rp 250.000.000 diterima 2026-07-05 (parsial untuk INV-1021); INV-1022 **belum ada payment sama sekali** |
| Outstanding | Rp 60.000.000 (sisa INV-1021) + Rp 35.000.000 (INV-1022, overdue) = **Rp 95.000.000** |
| Margin (indikatif) | Rp 345.000.000 − Rp 335.000.000 = **Rp 10.000.000 (~3%, tergerus signifikan dari rencana awal ~35jt akibat perubahan — insight untuk laporan Cost and Margin)** |

### 2.4 Timeline, Task, Perubahan, Dokumen
| Field | Nilai |
|---|---|
| Timeline | Direvisi (lihat Change history) |
| Task | TSK-1021 — "Reschedule hotel booking" — status In Progress; TSK-1022 — "Update traveler manifest" — status **Overdue** |
| Change history | CHG-1021 — "Tanggal perjalanan berubah dari 15–19 Sep menjadi 22–26 Sep 2026" (dicatat 2026-07-08, direview PM); CHG-1022 — "Jumlah traveler bertambah dari 15 menjadi 18 pax" (dicatat 2026-07-08); CHG-1023 — "Tipe kamar hotel di-upgrade dari Deluxe ke Suite (berdampak biaya)" (dicatat 2026-07-12, **belum direview** — kontribusi attention item) |
| Service status detail | Flight = `Confirmed`; Hotel Room Block A (18 pax) = `Changed` (setelah upgrade, sudah re-konfirmasi); Hotel Room Block B (3 pax, dialokasikan untuk traveler yang menyusul belakangan) = **`Cancelled`** (digabung ke Block A setelah jumlah traveler dikonsolidasi — lihat catatan Cancelled Service bagian 6.4) |
| Traveler document note | Salah satu traveler (bagian Group) memiliki paspor yang **akan kedaluwarsa dalam < 6 bulan dari tanggal keberangkatan** — dicatat sebagai item yang perlu ditindaklanjuti tim Ticketing, bukan attention level-project tapi level-traveler |
| Attention item | **Ya** — biaya aktual melebihi budget, invoice overdue (INV-1022), task overdue (TSK-1022), 1 change entry belum direview (CHG-1023) |
| Documents | DOC-1021 — "Revised_Itinerary_AbuDhabi.pdf"; DOC-1022 — "Hotel_Upgrade_Approval.pdf" |

---

## 3. Skenario Utama 3 — Complex Project (Palu, MICE)

### 3.1 CRM
| Field | Nilai |
|---|---|
| Party | PTY-003 — "PT Sinergi Korporindo" (`lifecycleStatus: Client`) |
| Contact person | CP-003 — Michael Tanuwijaya, Event Coordinator |
| Opportunity | OPP-003 — "Palu MICE Conference 2026", dibuat 2026-05-15, **Won** 2026-06-05 (approver: USR-003, lead time lebih panjang karena kompleksitas) |
| Quotation | QUO-003 — Rp 1.400.000.000 (harga ke client) |

### 3.2 Project
| Field | Nilai |
|---|---|
| Project | **PRJ-103** — "Palu MICE Conference 2026" |
| Destination | Palu, Indonesia |
| Travel date | 10–14 Agustus 2026 (**~2 minggu dari tanggal acuan 2026-07-29 → Upcoming Departure**, lihat bagian 6.3) |
| Project type / characteristic | Complex Project |
| Services (`serviceScope`) | Flight + Hotel + Transportation + MICE (kombinasi lengkap, sesuai Prompt 0-G) |
| Traveler count | **60**, terbagi 3 Group: GRP-001 "Management" (10 pax), GRP-002 "Sales Team" (25 pax), GRP-003 "Partner/VIP" (25 pax) |
| Rooming list | GRP-001: 5 kamar twin; GRP-002: 12 twin + 1 single; GRP-003: termasuk 2 suite VIP |
| Special request | 1 peserta Group C membutuhkan akses kursi roda (dicatat di profil traveler ybs.) |
| Project owner | USR-002 — Doni Saputra (PM) |
| Team | USR-004 (Ticketing), USR-005 (Accommodation), USR-006 (Transportation), USR-007 (MICE), USR-009 (Operations, koordinator umum) |
| Vendor | VND-001 (flight), VND-002 (hotel), VND-003 (transportation utama), VND-004 (MICE/venue), VND-005 (transportation cadangan) — **5 vendor** |
| Status | `In Progress` (persiapan akhir, ~2 minggu sebelum keberangkatan) |

### 3.3 Finance
| Field | Nilai |
|---|---|
| Budget (internal, per kategori) | Flight Rp 350.000.000; Hotel Rp 450.000.000; Transportation Rp 150.000.000; MICE/Venue Rp 300.000.000 — **Total Rp 1.250.000.000** |
| Actual cost | Rp 1.180.000.000 (masih berjalan, sebagian rekonsiliasi vendor belum final) |
| Invoice | INV-1031 — Rp 700.000.000 (termin 1, terbit 2026-06-10, jatuh tempo 2026-06-20) — **lunas**; INV-1032 — Rp 700.000.000 (termin 2, terbit 2026-07-15, jatuh tempo **2026-08-05 — belum jatuh tempo, belum dibayar**, lihat bagian 6.5) |
| Payment | PAY-1031 — Rp 700.000.000 diterima 2026-06-18 (untuk INV-1031) |
| Outstanding | Rp 700.000.000 (INV-1032, **belum overdue** — kontras dengan PRJ-102 yang overdue) |
| Margin (indikatif) | Rp 1.400.000.000 − Rp 1.180.000.000 = **Rp 220.000.000 (~16%, masih sehat, masih berjalan rekonsiliasi)** |

### 3.4 Timeline, Task, Perubahan, Dokumen
| Field | Nilai |
|---|---|
| Timeline | Multi-milestone: venue terkonfirmasi, flight batch 1 terbooking, flight batch 2 masih diproses, rooming list draft final Group C |
| Task | TSK-1031 — "Finalisasi rooming list Group C" — In Progress; TSK-1032 — "Konfirmasi venue MICE hari ke-2" — Pending Confirmation; TSK-1033 — "Kirim rundown acara ke client" — Not Started; TSK-1034 — "Rekonsiliasi actual cost transportation" — **Overdue** |
| Change history | CHG-1031 — "Jumlah peserta Group B bertambah dari 20 menjadi 25 pax" (dicatat 2026-07-10, sudah direview) — perubahan minor, tidak mendominasi narasi project ini (berbeda dari PRJ-102) |
| Service status detail | Flight batch 1 = `Confirmed`; Flight batch 2 (grup VIP menyusul) = **`Pending Confirmation`**; Hotel = `Confirmed`; Transportation = **`Pending Confirmation`** (lihat bagian 6.6); MICE/Venue = `Confirmed` |
| Attention item | **Ya** — kombinasi upcoming departure (< 30 hari) + service Transportation `Pending Confirmation` + task overdue (TSK-1034) |
| Documents | DOC-1031 — "Rundown_Acara_MICE_Palu.pdf"; DOC-1032 — "Rooming_List_Draft_GroupC.xlsx"; DOC-1033 — "Kontrak_Vendor_MICE.pdf" |

---

## 4. Opportunity Tambahan — Lost Opportunity

| Field | Nilai |
|---|---|
| Party | PTY-004 — "PT Melati Wisata Kreasi" (`lifecycleStatus` tetap **Prospect** — tidak pernah menjadi Client karena opportunity tidak Won, konsisten dengan D-024) |
| Contact person | CP-004 — Nadia Ramadhani |
| Opportunity | OPP-004 — "Jakarta Incentive Trip", dibuat 2026-06-15, status **`Lost`** pada 2026-07-05 (alasan mock: budget internal client dipotong) |
| Quotation | QUO-004 — Rp 45.000.000, tidak pernah disetujui |
| Project | **Tidak ada** — mengonfirmasi D-002 (hanya Won yang membuat Project) |

---

## 4a. Opportunity Pipeline Aktif (ditambahkan Section 06 — Dashboard)

OPP-001–004 seluruhnya sudah berstatus final (`Won`/`Lost`), sehingga widget dashboard "Opportunity Pipeline" tidak akan pernah punya data untuk ditampilkan tanpa opportunity yang masih berjalan. Tiga baris berikut ditambahkan agar widget tersebut dapat didemokan — bukan skenario utama baru, hanya pelengkap data pipeline:

| Field | Nilai |
|---|---|
| OPP-005 | PTY-004, "Bali Team Building 2026", stage `Won-Requested` (dimajukan dari `Negotiation` di Section 09 — lihat bagian 4d), dibuat 2026-07-05, Quotation QUO-005 versi 2 Rp 180.000.000 (belum diputuskan) |
| OPP-006 | PTY-001, "Manila Repeat Business Q4 2026", stage `Proposal`, dibuat 2026-07-15, Quotation QUO-006 Rp 60.000.000 (belum diputuskan) |
| OPP-007 | PTY-002, "Abu Dhabi Follow-up Training", stage `Qualification`, dibuat 2026-07-20, belum ada quotation |

Task tambahan (agar widget "Milestone/Task Mendatang" Project Manager punya data selain yang overdue): TSK-1023 (PRJ-102, jatuh tempo 2026-08-01), TSK-1035 (PRJ-103, jatuh tempo 2026-08-05).

Detail keputusan dan alasan penambahan ada di `docs/mockup-change-impact-log.md` (CI-002) dan `docs/mockup-section-reports/section-06-dashboard.md`.

---

## 4b. Party Activity (ditambahkan Section 07 — CRM Party)

Entitas baru `PartyActivity` (tab "Activities" Party Detail, berbeda dari `ActivityEntry` yang scoped ke Project) — mengisi riwayat CRM per party dan widget Dashboard Sales "Follow-up Mendatang" (deferred di Section 06). Seluruh `ownerId` memakai `USR-001` (satu-satunya user role Sales di fixture demo).

| ID | Party | Jenis | Catatan | Dijadwalkan (dueAt) |
|---|---|---|---|---|
| PACT-001 | PTY-001 | Call | Follow-up kepuasan trip Manila | — |
| PACT-002 | PTY-004 | Meeting | Diskusi kebutuhan awal Bali Team Building 2026 | — |
| PACT-003 | PTY-004 | Email | Kirim draft quotation Bali Team Building 2026 | — |
| PACT-004 | PTY-004 | Follow-up | Follow-up keputusan quotation Bali Team Building 2026 | 2026-08-03 (upcoming) |
| PACT-005 | PTY-001 | Follow-up | Follow-up repeat business Manila Q4 2026 | 2026-08-02 (upcoming) |
| PACT-006 | PTY-002 | Note | Catatan internal sensitivitas client soal reschedule | — |

PARTIES dan CONTACTS (juga PARTY_ACTIVITIES) sejak Section 07 dibungkus `reactive()` agar aksi "Tambah Prospect"/"Tambah Contact"/"Catat Activity" di `/crm/prospects` dan Party Detail benar-benar menambah data yang terlihat seketika di seluruh halaman (bukan mock statis) — lihat `docs/mockup-change-impact-log.md` (CI-004) dan `docs/mockup-section-reports/section-07-crm-party.md`. Record baru yang dibuat lewat UI memakai `DEMO_REFERENCE_DATE` (2026-07-29) sebagai `createdAt`, bukan waktu perangkat nyata, konsisten dengan D-040.

---

## 4c. Kelengkapan Opportunity dan Quotation Version (ditambahkan Section 08)

Field `Opportunity` dilengkapi (`ownerId`, `estimatedValueIdr`, `destination`, `travelStartDate`/`travelEndDate` opsional, `travelerEstimate` opsional, `requirementNotes` opsional) untuk seluruh 7 opportunity (`OPP-001`–`007`). Seluruh `ownerId` = `USR-001` (satu-satunya Sales). `OPP-007` (stage Qualification) **sengaja** tidak diisi `travelStartDate`/`travelEndDate`/`travelerEstimate`/`requirementNotes` — mendemonstrasikan empty state "Belum ditentukan"/"Requirement belum digali" untuk opportunity yang belum digali sedalam itu.

`Quotation` dilengkapi `version` (seluruhnya `1` kecuali disebut lain) dan `supersededAmountIdr` opsional:

| Quotation | Versi | Nilai | Catatan |
|---|---|---|---|
| QUO-005 (OPP-005, Bali Team Building) | **2** | Rp 180.000.000 | Direvisi naik dari estimasi awal Rp 150.000.000 (`OPP-005.estimatedValueIdr`) — mendemonstrasikan "quotation version mock" |

`PARTY_ACTIVITIES` (Section 07) di-backfill dengan `opportunityId` opsional pada baris yang memang terkait satu opportunity spesifik (PACT-002/003/004 → `OPP-005`; PACT-005 → `OPP-006`) — bukan record baru, agar tampil juga di tab "Activity/Follow-up" Opportunity Detail selain di tab "Activities" Party Detail.

Detail lengkap ada di `docs/mockup-change-impact-log.md` dan `docs/mockup-section-reports/section-08-opportunity-quotation.md`.

---

## 4d. Skenario Won to Project Siap-Demo (ditambahkan Section 09)

`OPP-005` (Bali Team Building 2026) dimajukan dari stage `Negotiation` ke `Won-Requested` agar alur Approve Won dapat langsung didemokan tanpa harus melalui seluruh stage sebelumnya lewat UI terlebih dahulu — data-nya paling lengkap dari ketiga opportunity pipeline (destinasi, tanggal, estimasi traveler, quotation versi 2 semua sudah terisi), sehingga tidak akan terblokir validasi requirement (`docs/route-and-role-matrix.md` bagian 2, catatan Section 09).

Saat Management/Super Admin meng-approve OPP-005 lewat `/crm/opportunities/OPP-005`:
1. Project baru dibuat (ID sekuensial berikutnya setelah `PRJ-103`, otomatis `PRJ-104`).
2. `PTY-004` ("PT Melati Wisata Kreasi") berubah `lifecycleStatus` dari `Prospect` menjadi `Client` — mendemonstrasikan D-002/D-024 secara langsung dengan data nyata, bukan simulasi terpisah.
3. Activity log tercatat di project baru: "Project PRJ-104 dibuat dari Opportunity OPP-005 (Won oleh {approver})".

Ini adalah skenario **interaktif** (baru terjadi setelah user mengklik Approve), bukan record yang sudah ter-seed sebagai hasil akhir — dokumen ini mencatat kondisi **sebelum** aksi tersebut dijalankan.

---

## 4e. Traveler and Participant Detail (ditambahkan Section 11)

Fixture `TRAVELERS`/`TRAVELER_GROUPS` (Foundation) diperluas dari 1 baris (`TRV-1031` saja) menjadi sampel representatif per skenario — **bukan** 1:1 dengan `project.travelerCount` (6/18/60), konsisten dengan pola `TRV-1031` yang sejak awal sudah mewakili sebagian dari 60 traveler PRJ-103. Tab Travelers menampilkan rasio ini secara transparan (`"X dari Y traveler tercatat detail profilnya"`), bukan berpura-pura lengkap.

| Project | Sampel traveler bernama | Catatan |
|---|---|---|
| PRJ-101 (Normal, travelerCount 6) | `TRV-1011`–`TRV-1016` (6, seluruhnya) | Seluruhnya profil lengkap (passport + kontak darurat) — konsisten dengan skenario "berjalan mulus" (bagian 6.1) |
| PRJ-102 (High-Change, travelerCount 18) | `TRV-1021`–`TRV-1026` (6 dari 18) | `TRV-1022` (Yusuf Maulana) — paspor berlaku hingga 2027-01-15, kurang dari 6 bulan sebelum keberangkatan 2026-09-22 (catatan bagian 2.4); `TRV-1023` (Indah Permatasari) — belum mengisi data paspor sama sekali. Keduanya memicu missing-document indicator, dua varian berbeda |
| PRJ-103 (Complex, travelerCount 60) | `TRV-1031` (existing, diperkaya) + `TRV-1032`–`TRV-1036` (5 baru) | Tersebar di GRP-001 (Management), GRP-002 (Sales Team), GRP-003 (Partner/VIP); `TRV-1034` (Taufik Hidayat, GRP-002) belum mengisi data paspor — missing-document indicator juga muncul di skenario Complex |

Rooming list (`ROOM_ASSIGNMENTS`, entitas baru) — hanya untuk traveler bernama yang datanya sudah tercatat, bukan seluruh 60 kursi fisik:

| Room | Group | Tipe | Occupant |
|---|---|---|---|
| ROOM-001 (Twin 101) | GRP-001 | Twin | TRV-1032, TRV-1033 |
| ROOM-002 (Twin 205) | GRP-002 | Twin | TRV-1034, TRV-1035 |
| ROOM-003 (Suite VIP 1) | GRP-003 | Suite | TRV-1031 (kebutuhan kursi roda), TRV-1036 |

Ringkasan rooming per group (`TravelerGroup.roomingNote`, teks) tetap mengikuti angka lengkap dari bagian 3.2 di atas (GRP-001: 5 kamar twin; GRP-002: 12 twin + 1 single; GRP-003: 2 suite VIP) — bukan breakdown kamar granular untuk seluruh 60 pax, hanya narasi ringkas ditambah 3 contoh penugasan kamar konkret di atas.

Detail lengkap ada di `docs/mockup-change-impact-log.md` (CI-013) dan `docs/mockup-section-reports/section-11-traveler-participant.md`.

---

## 4f. Itinerary and Operations Detail (ditambahkan Section 12)

`ITINERARY_ITEMS` (entitas baru) — jadwal harian per project, `groupId` merujuk `TravelerGroup` (Section 11) yang sudah ada:

| Project | Jumlah item | Catatan |
|---|---|---|
| PRJ-101 (Manila, 20–23 Agu 2026) | 4 | Keberangkatan/kepulangan flight + 2 agenda bisnis harian |
| PRJ-102 (Abu Dhabi, 22–26 Sep 2026 revisi) | 5 | Keberangkatan/kepulangan flight, check-in hotel (pasca upgrade kamar), 2 hari Corporate Gathering |
| PRJ-103 (Palu, 10–14 Agu 2026) | 6 | Kedatangan 2 batch (GRP-001 dan GRP-003, referensi group konsisten dengan Section 11), 2 hari MICE Conference, city tour, kepulangan seluruh group |

`PROJECT_SERVICES` (Foundation) diperluas dengan `bookingReference` (mock nomor referensi/PNR/konfirmasi manual, bukan hasil integrasi API nyata — D-006) pada service yang sudah `confirmed`/`changed`; service yang masih `pending-confirmation`/`cancelled` sengaja dibiarkan tanpa referensi (realistis — referensi baru ada setelah booking terkonfirmasi). Satu baris baru ditambahkan: `SVC-1036` (PRJ-103, tipe `additional`, "Asuransi Perjalanan Grup", `confirmed`, referensi `INS-PLW-2026`) — mendemonstrasikan kategori "additional service" dari scope Section 12. Tipe `additional` **tidak** dimasukkan ke `Project.serviceScope` mana pun (tetap 4 kombinasi resmi Prompt 0-B); visibilitas section-nya di UI murni data-driven (ada/tidaknya baris service bertipe ini untuk project tsb), bukan bagian klasifikasi tipe project.

Detail lengkap dan dampak ke Overview tab (Section 10) ada di `docs/mockup-change-impact-log.md` (CI-014) dan `docs/mockup-section-reports/section-12-itinerary-operations.md`.

---

## 4g. Vendor Management Detail (ditambahkan Section 13)

`VENDOR_CONTACTS` (backfill dari `Vendor.contactName` existing, 1 per vendor — bukan data baru, hanya diberi wadah tab "Contacts"), `VENDOR_QUOTATIONS` (10 baris, terhubung ke `Project`/`ProjectService` existing via `projectId`/`serviceId` — hard rule "jangan menggandakan service fixture"), `VENDOR_ACTIVITIES` (5 baris seed).

Skenario comparison konkret (belum diputuskan, siap didemokan): `SVC-1034` (Ground Transportation, PRJ-103, masih `pending-confirmation`) punya 2 quotation bersaing — `VQ-009` (VND-003, Rp45.000.000, vendor yang sudah ditugaskan) vs `VQ-010` (VND-005, Rp52.000.000, kompetitor sama-sama tipe `transportation`). Aksi "Terima" pada salah satu quotation (tab "Vendors" Project Detail) akan menolak quotation lainnya secara otomatis, mengarahkan `ProjectService.vendorId` ke vendor pemenang, dan mengubah status service menjadi `confirmed` via `updateServiceStatus` (Section 12, reuse) — bukan mutasi paralel.

`VQ-007` (VND-001, PRJ-103, `SVC-1032` Flight Batch 2 Grup VIP, `pending-confirmation`) sengaja dibiarkan `submitted` tanpa kompetitor — mendemonstrasikan quotation tunggal yang menunggu keputusan tanpa perbandingan. `VQ-008` (VND-002, PRJ-102, `SVC-1023` Room Block B) berstatus `rejected` — merefleksikan riwayat historis konsolidasi Room Block B ke Block A (Section 05/06).

Detail lengkap ada di `docs/mockup-change-impact-log.md` (CI-015) dan `docs/mockup-section-reports/section-13-vendor-management.md`.

---

## 4h. Project Changes Detail (ditambahkan Section 14)

4 entri `CHG-*` existing (PRJ-102: `CHG-1021`/`1022`/`1023`; PRJ-103: `CHG-1031`) diperkaya field Section 14 — bukan record baru:

| ID | Kategori | Sebelum → Sesudah | Requester | Status Approval |
|---|---|---|---|---|
| `CHG-1021` | Itinerary | 15–19 Sep 2026 → 22–26 Sep 2026 | USR-013 (Fitri Handayani, PM) | Disetujui (USR-003) |
| `CHG-1022` | Traveler | 15 pax → 18 pax | USR-013 | Disetujui (USR-003) |
| `CHG-1023` | Service | Deluxe → Suite | USR-005 (Maya Putri, Accommodation) | **Menunggu Approval** — skenario hidup, siap didemokan |
| `CHG-1031` | Traveler | 20 pax → 25 pax (Group Sales Team) | USR-002 (Doni Saputra, PM) | Disetujui (USR-003) |

`CHG-1023` sengaja dibiarkan `approvalStatus: 'pending'` (selaras `reviewed: false` yang sudah ada sejak Foundation) — mendemonstrasikan alur Setujui/Tolak (`approveChangeEntry`/`rejectChangeEntry`, `app/data/index.ts`) tanpa perlu menambah record baru. Aksi "Catat Perubahan" (`createChangeEntry`) tersedia untuk PM/Operations/role sub-domain (Ticketing/Accommodation/Transportation/MICE)/Super Admin; Setujui/Tolak khusus Management/Super Admin (`canApprove('project')`, docs bagian 5.1).

Detail lengkap ada di `docs/mockup-change-impact-log.md` (CI-016) dan `docs/mockup-section-reports/section-14-project-changes.md`.

---

## 4i. Project Finance Detail (ditambahkan Section 15)

Tidak ada fixture baru — Section 15 murni menambah **selektor turunan** (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`) dan tampilan (`/finance/invoices`, `/finance/payments`, tab "Finance" Project Detail) di atas data `PROJECTS`/`INVOICES`/`PAYMENTS`/`VENDOR_QUOTATIONS` yang sudah ada sejak Foundation/Section 13. Nilai turunan berikut diverifikasi konsisten (hard rule "nilai konsisten lintas Opportunity, Quotation, Vendor, Project, Dashboard, Invoice, dan Payment") lewat smoke test langsung terhadap fixture:

| Project | Margin (Quotation − Actual) | Variance (Budget − Actual) | Committed Vendor Cost (quotation `accepted`) | Outstanding |
|---|---|---|---|---|
| PRJ-101 | Rp12.500.000 (cocok bagian 1.3) | Rp2.500.000 | Rp90.000.000 (VQ-001) | Rp0 |
| PRJ-102 | Rp10.000.000 (cocok bagian 2.3) | **-Rp25.000.000** (over budget) | Rp345.000.000 (VQ-002+VQ-003) | **Rp95.000.000** (cocok bagian 2.3) |
| PRJ-103 | Rp220.000.000 (cocok bagian 3.3) | Rp70.000.000 | Rp930.000.000 (VQ-004+VQ-005+VQ-006) | **Rp700.000.000** (cocok bagian 3.3) |

Committed Vendor Cost PRJ-103 (Rp930.000.000) sengaja lebih kecil dari Actual Cost (Rp1.180.000.000) — merefleksikan kondisi realistis bahwa sebagian actual cost sudah tercatat sebelum quotation vendor terkait (Transportation, `SVC-1034`, masih `pending-confirmation`, lihat Section 13 bagian 4g) resmi `accepted`, bukan inkonsistensi data.

Detail lengkap ada di `docs/mockup-section-reports/section-15-project-finance.md`.

---

## 4j. Lead, Account Executive, dan Supplier Detail (ditambahkan Prompt 19 — Change Request)

Entitas baru `Lead`/`LeadActivity`/`VendorProduct`/`SystemEvent`, plus reassignment `Opportunity.ownerId` dan 1 Opportunity/Project baru untuk skenario repeat client — lihat D-046–D-052 (`docs/mockup-design-decisions.md`) untuk rasional lengkap.

**Leads (`LED-001`–`LED-010`):** satu lead per sumber wajib (`website` ×2, `instagram`, `tiktok`, `whatsapp`, `referral`, `event`, `email`, `sales-outreach`, `other`). `LED-001` ("CV Nirmala Eventama") = qualified milik AE, belum dikonversi — live-demo "Qualify & Create Opportunity" (Prompt 20: kini juga berisi form Qualification LENGKAP — lihat 4k). `LED-005` = qualified, sudah terhubung ke `OPP-005`/`PTY-004` (Bali Team Building, existing sejak Section 08). `LED-009` = qualified, sudah terhubung ke `OPP-001`/`PTY-001` (Manila, Won — sejak Foundation). `LED-010` = archived (contoh filter "Archived leads").

**Commercial Approval:** `QUO-005` (OPP-005, Bali Team Building) — `approvalStatus: submitted`, skenario "satu quotation menunggu approval" (literal Prompt 19-9); `QUO-006` (OPP-006, Manila Repeat Business, PTY-001) — `approvalStatus: approved`, siap didemokan "Ajukan sebagai Won" → Approve Won. `QUO-001`/`002`/`003` (Won existing) di-backfill `approved`; `QUO-004` (Lost) dibiarkan tanpa `approvalStatus`.

**Repeat Client — Beberapa Project Order:** `OPP-008`/`QUO-008`/`PRJ-104` ("Manila Follow-up Training Q1 2027") — Opportunity Won kedua untuk `PTY-001` (yang sudah punya `PRJ-101`), memenuhi literal "satu Active Client dengan beberapa Project Orders" tanpa aksi interaktif tambahan. `PRJ-104` sengaja `draft`/`actualCostIdr: 0` (baru terbentuk dari Won, belum diisi Operations).

**Account Executive Ownership:** `Opportunity.ownerId` pada `OPP-001`–`OPP-008` seluruhnya `USR-014` (Galih Ramadhan, satu-satunya AE demo) — reassignment dari `USR-001` (Sales), lihat D-047.

**Supplier / External Partners:** `VND-006` ("PT ABC", fokus Hotel) dan `VND-007` ("PT EFG", fokus MICE) — masing-masing 1 supplier user ter-isolasi (`USR-015`/`USR-016`, `vendorId` mengarah ke company masing-masing) dan katalog produk berbeda (`VendorProduct`: `VPR-001`/`002` milik PT ABC — kamar & meeting room; `VPR-003`/`004` milik PT EFG — venue & event organizer).

**Lead Source Recap (dihitung, bukan disimpan):** Total Leads 10 (11 sejak Section 04, lihat 4l), Qualified 3 (`LED-001`/`005`/`009`), Opportunities Created 2 (`LED-005`/`009` — punya `opportunityId`), Won 1 (`LED-009` → `OPP-001` Won). Diverifikasi ulang lewat smoke test curl terhadap halaman `/customer-journey/lead-sources` — cocok persis.

**Activity Center:** 22 `SystemEvent` (`EVT-001`–`EVT-022`) merentang seluruh 8 modul (lead/opportunity/quotation/client/project-order/vendor/finance/user), `entityId` merujuk ID entitas existing di atas — tidak ada entity baru yang difabrikasi khusus untuk log.

## 4k. Lead Qualification dan Requirement Gate Detail (ditambahkan Prompt 20 — Change Request)

Melengkapi skenario 4j dengan field Qualification (Lead) dan Requirement Detail/Quotation komersial (Opportunity) yang literal diminta Prompt 20 — lihat D-053–D-056 (`docs/mockup-design-decisions.md`) untuk rasional lengkap.

**Qualification Lead (backfill, bukan record baru):** `LED-001` diisi LENGKAP (seluruh 7 field wajib) — mendemokan Lead siap "Qualify & Create Opportunity" dengan tombol aktif (jenis kebutuhan MICE/Event, destinasi Yogyakarta, 150 traveler, service scope mice+hotel+transportation, ringkasan kebutuhan, AE `USR-014`, plus seluruh field opsional terisi). `LED-004` diisi SEBAGIAN (jenis kebutuhan + destinasi + traveler estimate saja) — mendemokan warning "belum lengkap" (periode perjalanan, service scope, ringkasan kebutuhan, AE belum diisi) dan tombol Qualify disabled.

**Opportunity/Quotation baru (`OPP-009`/`OPP-010`) — melengkapi skenario status workflow yang belum ada di Prompt 19:**
- `OPP-009` ("Palu MICE Conference 2027", repeat opportunity `PTY-003`) — stage `requirement-gathering`, seluruh field requirement dasar LENGKAP, BELUM ada Quotation → status workflow **"Ready for Quotation"**, tombol "Buat Quotation" aktif.
- `OPP-010` ("Surabaya Regional Sales Meeting 2027", repeat opportunity `PTY-002`) — stage `proposal`, Quotation `QUO-010` sudah dibuat tapi `approvalStatus` belum diisi (draft) → status workflow **"Quotation Draft"**. `QUO-010` diisi lengkap discount/estimated cost/estimated margin/payment terms/service breakdown (2 baris: flight + hotel), dan sejak Section 05 (2026-07-31) juga tax/markup/currency/validity/inclusions/exclusions/terms — mendemokan hasil "Edit Quotation" lengkap dan "PDF/Print Preview".
- `OPP-007` (existing, Section 08 — field requirement kosong sengaja) tetap dipakai sebagai skenario **"Pending Requirement"** (tidak diubah).
- `OPP-005` (submitted) = **"Pending Management Approval"**, tombol "Withdraw Submission" (Section 05) tersedia untuk AE selagi menunggu. `OPP-006` (approved, `QUO-006.sentToClientAt` diisi Section 05) = **"Approved"** — TIDAK LAGI otomatis siap "Mark as Won": sejak Section 05 (D-062), tombol Mark as Won men-disable sampai AE mencatat Client Confirmation (`Opportunity.clientConfirmedAt` sengaja dibiarkan kosong pada fixture ini agar gerbang baru demonstrable — lihat `docs/mockup-change-impact-log.md` CI-034).

**Requirement Detail (AE, field baru pada `Opportunity.requirementDetail`):** diisi sebagian pada `OPP-005` (departure city, room requirement, dst.) dan `OPP-006` (flight preference, commercial notes, dst.) — mendemokan tab/section "Requirement Detail" terisi pada Opportunity yang sudah lanjut ke tahap komersial.

**Related Lead (field baru `Opportunity.leadId`):** `OPP-001` ↔ `LED-009`, `OPP-005` ↔ `LED-005` — backfill dari relasi `Lead.opportunityId` yang sudah ada sejak Prompt 19, kini ditautkan balik agar Opportunity Detail dapat menampilkan link "Related Lead".

## 4l. Duplicate/Merge Suggestion Detail (ditambahkan Section 04 — roadmap Section 00–24 baru)

Melengkapi 4j/4k dengan skenario "duplicate suggestion"/"merge suggestion" (Section 04) — lihat D-061 (`docs/mockup-design-decisions.md`) untuk rasional lengkap.

**`LED-011`** ("Yuni K. Kartika", source `referral`, stage `new`) — Lead baru (bukan backfill) dengan email PERSIS SAMA dengan `LED-007` ("Yuni Kartika", source `email`) — `yuni.kartika@example.com`. Mendemokan: badge "Possible Duplicate" di Table view (`/customer-journey/leads`) pada kedua baris; panel "Lead Serupa Terdeteksi" + aksi "Tandai sebagai Duplikat" di drawer Overview kedua lead (simetris — membuka salah satu menampilkan yang lain sebagai kandidat). Total Leads bertambah dari 10 menjadi **11** (Lead Source Recap, `/customer-journey/lead-sources`) — Qualified/Opportunities Created/Won TIDAK berubah (3/2/1) karena `LED-011` berstage `new`, bukan `qualified`.

---

## 4m. Product Planning dan Costing Detail (ditambahkan Section 10 — roadmap Section 00–24 baru)

Entitas baru `ProductTemplate`/`CostSheet` (`app/data/products.ts`) — lihat D-067 (`docs/mockup-design-decisions.md`) untuk rasional lengkap.

- **`PRD-001`/`PRD-002`** (Manila/Abu Dhabi, status `active`) dan **`PRD-003`** (Palu, status `draft` — masih disempurnakan Product Planner). Masing-masing punya 2-4 `serviceAlternatives` (mis. hotel bintang 3 vs 4 vs 5, flight budget vs full-service) dengan satu opsi ditandai `isRecommended`.
- **`CS-001`** (link `PRD-001`+`OPP-001`) dan **`CS-002`** (link `PRD-002`+`OPP-002`) — Cost Sheet historis yang SUDAH `applied` (`status: 'final'`) ke `QUO-001`/`QUO-002` (kedua Opportunity sudah `won`), mendemokan snapshot konsep secara nyata (bukan seeded-done kosmetik — field `appliedToQuotationId`/`appliedAt` benar-benar terisi dan dikunci dari edit).
- **`CS-005`** (link `PRD-002`, TANPA `opportunityId`) — Cost Sheet baseline berdiri sendiri, referensi Planner sebelum ada Opportunity spesifik ke destinasi tsb.
- **`CS-003`**/**`CS-004`** ("Economy Scenario"/"Premium Scenario", keduanya link `PRD-003`+`OPP-009`, status `draft`) — demo hidup "Scenario/version comparison": `OPP-009` (stage `requirement-gathering`, "Ready for Quotation") BELUM punya Quotation, sehingga tombol "Apply to Quotation" pada kedua Cost Sheet ini benar-benar aktif dan fungsional (bukan hanya UI dekoratif) — total sell terhitung Rp254.310.000 (Economy, sebelum tax) dan lebih tinggi untuk Premium (hotel + venue upgrade).
- Total sell hasil kalkulasi Cost Sheet SENGAJA tidak dipaksa sama persis dengan `Quotation.amountIdr` historis (`CS-001` vs `QUO-001`, `CS-002` vs `QUO-002`) — variance kecil merefleksikan negosiasi AE, bukan bug data.

---

## 4n. Traveler Document Detail (ditambahkan Section 11 — roadmap Section 00–24 baru)

Field baru (`idNumber`/`visaNumber`/`visaExpiryDate`/`dietaryRestrictions`/`accessibilityNeeds`/`companionOfTravelerId`/`documentsVerifiedAt`) di-backfill selektif pada `TRAVELERS` existing (`app/data/projects.ts`) — lihat D-068 (`docs/mockup-design-decisions.md`).

- **`TRV-1011`** (PRJ-101, Hendra Wijaya) — `idNumber` + sudah `documentsVerifiedAt` (Terverifikasi). **`TRV-1016`** (Nadia Puspita) — `dietaryRestrictions: 'Vegetarian'` + `companionOfTravelerId: 'TRV-1011'` (demo "Mendampingi: Hendra Wijaya").
- **`TRV-1021`** (PRJ-102, Sarah Amelia, destinasi Abu Dhabi — visa wajib untuk WNI) — `visaNumber`+`visaExpiryDate` lengkap, tetap "Dokumen Lengkap", sudah terverifikasi. **`TRV-1025`** (Citra Ananda) — `visaNumber` TANPA `visaExpiryDate`: sebelum Section 11 baru berstatus "Dokumen Lengkap" (paspornya valid), kini SENGAJA berubah menjadi "Dokumen Belum Lengkap" oleh aturan visa baru (`isTravelerDocumentMissing`) — perubahan status yang disengaja (demo aturan baru), bukan regresi. **`TRV-1024`** (Bayu Aditya) — `dietaryRestrictions`+`accessibilityNeeds` contoh kombinasi.
- **`TRV-1031`** (PRJ-103, Dedi Kurniawan, destinasi domestik — tanpa field visa) — `accessibilityNeeds` (dipindah dari `specialRequest` lama ke field dedicated yang lebih tepat), `idNumber`, sudah terverifikasi. **`TRV-1032`** (Michael Tanuwijaya) — sudah terverifikasi. **`TRV-1036`** (Reza Firmansyah) — `companionOfTravelerId: 'TRV-1031'` (mendampingi Dedi — konsisten keduanya sudah berbagi kamar "Suite VIP 1" di `ROOM_ASSIGNMENTS` sejak Section 11 lama).
- Traveler lain (12 dari 17) TIDAK diberi field baru — tetap merepresentasikan kondisi "belum dilengkapi" yang realistis (readiness indicator per project tidak pernah 100% seluruhnya, mencerminkan kondisi nyata operasional).

---

## 4o. Operational Command Center Detail (ditambahkan Section 12 — roadmap Section 00–24 baru)

Field `timezone`/`visibleToClient` (`ItineraryItem`) dan `isBlocked`/`blockedReason` (`ProjectTask`), plus entitas baru `ShiftNote` — lihat D-069 (`docs/mockup-design-decisions.md`).

- **`ITIN-1015`** (PRJ-101), **`ITIN-1026`** (PRJ-102), **`ITIN-1037`** (PRJ-103) — 3 item itinerary BARU, seluruhnya `visibleToClient: false` (briefing/koordinasi internal). Mendemokan "Internal vs client-shared itinerary": tampil di `/projects/[id]` (badge "Internal Only") TAPI TIDAK tampil di `/client/project-orders/[id]`.
- Seluruh 17 `ItineraryItem` existing diberi `timezone` (Asia/Jakarta untuk keberangkatan dari Jakarta, Asia/Manila/Asia/Dubai/Asia/Makassar sesuai destinasi masing-masing).
- **`TSK-1021`** (PRJ-102, "Reschedule hotel booking") — di-backfill `isBlocked: true` dengan alasan "Menunggu konfirmasi ketersediaan kamar Suite dari hotel". Mengubah Departure Readiness Gate PRJ-102 dari (sebelumnya tidak ada indikator) menjadi "Belum Siap" — demo hidup, bukan regresi.
- **`SFT-1031`**/**`SFT-1032`** (PRJ-103, satu-satunya project `in-progress` pada tanggal referensi demo) — 2 `ShiftNote` shift pagi dan siang, mendemokan on-trip updates/shift handover.

---

## 4p. Ticketing Detail (ditambahkan Section 13 — roadmap Section 00–24 baru)

Entitas baru `FlightBooking` (`app/data/ticketing.ts`) — lihat D-070 (`docs/mockup-design-decisions.md`).

- **`FLT-1011`** (PRJ-101, `issued`) — menautkan `serviceId: 'SVC-1011'`, `pnr: 'MNL8201'` (mengikuti persis `SVC-1011.bookingReference`), 6 traveler (seluruh traveler PRJ-101), opsi terpilih Rp12.500.000/pax (mengikuti `CS-001.costPerPaxIdr`), Net Cost Rp75.000.000 = Sell Price Rp95.000.000 (persis `QUO-001.amountIdr`).
- **`FLT-1021`** (PRJ-102, `reissued`) — menautkan `serviceId: 'SVC-1021'`, `pnr: 'AUH9221'`, `hasScheduleChange: true` merujuk `CHG-1021` (perubahan tanggal 15–19 Sep → 22–26 Sep, Section 14 lama) sebagai alasan reissue — narasi konsisten lintas-modul, bukan kebetulan.
- **`FLT-1023`** (PRJ-102, `refunded`, TANPA `serviceId` — booking individual traveler) — 1 traveler (Bayu Aditya), `statusReason` "mengundurkan diri karena keperluan mendesak".
- **`FLT-1031`** (PRJ-103, `issued`) — menautkan `serviceId: 'SVC-1031'`, Group Management (`GRP-001`, 2 traveler bernama).
- **`FLT-1032`** (PRJ-103, `hold`) — menautkan `serviceId: 'SVC-1032'` (sebelumnya `pending-confirmation` tanpa `bookingReference` — konsisten belum ada PNR), Group Partner/VIP (`GRP-003`), `ticketingDeadline` H+3 dari tanggal referensi demo (mendemokan urgensi).
- **`FLT-1033`** (PRJ-103, `requested`, TANPA `serviceId`) — 2 opsi belum dipilih, `travelerIds` kosong (belum ditugaskan, mewakili "seluruh group" yang belum diformalkan).
- Mencakup 5 dari 7 status lifecycle (`requested`/`hold`/`issued`/`reissued`/`refunded`); `confirmed`/`cancelled` sengaja tidak di-seed (reachable lewat transisi UI, diverifikasi code review).

---

## 4q. Accommodation Detail (ditambahkan Section 14 — roadmap Section 00–24 baru)

Entitas baru `HotelBooking` (`app/data/accommodation.ts`) — lihat D-071 (`docs/mockup-design-decisions.md`), pola arsitektur IDENTIK D-070.

- **`HTL-1022`** (PRJ-102, `amended`) — menautkan `serviceId: 'SVC-1022'`, `confirmationNumber: 'AUH-A104'` (mengikuti persis `SVC-1022.bookingReference`), 6 traveler sampel (mewakili 18 pax Room Block A), opsi terpilih upgrade ke Suite Rp1.800.000/malam, `amendmentNote` merujuk narasi upgrade yang sama seperti `ITIN-1022`/`ITIN-1026`, Net Cost Rp129.600.000 / Sell Price Rp152.900.000.
- **`HTL-1023`** (PRJ-102, `cancelled`) — menautkan `serviceId: 'SVC-1023'` (Room Block B, 3 pax, tanpa `bookingReference` — konsisten belum pernah confirmed), dibatalkan SETELAH `cancellationDeadline` sehingga `cancellationPenaltyIdr: 2.025.000` (15% dari estimasi) — mendemokan "penalty" Wajib literal dengan angka bukan nol.
- **`HTL-1033`** (PRJ-103, `confirmed`) — menautkan `serviceId: 'SVC-1033'` DAN `groupId: 'GRP-001'` (Management, 10 pax) — rooming list (`getHotelRoomingList`) menampilkan `ROOM-001` existing (Section 11) tanpa duplikasi data, `earlyCheckInRequested: true` (kedatangan pagi hari sama dengan check-in).
- **`HTL-1034`** (PRJ-103, `quoted`, TANPA `serviceId`) — `groupId: 'GRP-002'` (Sales Team, 25 pax), 2 opsi property (Bintang 3 vs Bintang 4) mengikuti persis `costPerPaxIdr` `CS-003`/`CS-004` dibagi 4 malam, belum ada Net Cost/Sell Price (harga belum final di tahap `quoted`).
- **`HTL-1035`** (PRJ-103, `confirmed`) — `groupId: 'GRP-003'` (Partner/VIP), HANYA 2 traveler (Dedi Kurniawan + companion) — mendemokan "individual" dari acceptance literal ("individual maupun group") dalam satu entitas yang sama, `policies` menyebut kebutuhan aksesibilitas kursi roda (`TRV-1031.accessibilityNeeds`, direuse langsung sebagai "Traveler special requests", bukan field baru), `lateCheckOutRequested: true`.
- **`HTL-1036`** (PRJ-102, `requested`, TANPA `serviceId`/`groupId`/opsi/traveler) — permintaan overflow kamar untuk traveler yang menyusul belakangan, mewakili tahap paling awal sourcing.
- Mencakup 5 dari 7 status lifecycle (`requested`/`quoted`/`confirmed`/`amended`/`cancelled`); `completed`/`no-show` sengaja tidak di-seed (reachable lewat transisi UI, diverifikasi code review, konsisten pola Section 13).

---

## 4r. Transportation Detail (ditambahkan Section 15 — roadmap Section 00–24 baru)

Entitas baru `TransportBooking` (`app/data/transportation.ts`) — lihat D-072 (`docs/mockup-design-decisions.md`), pola arsitektur IDENTIK D-070/D-071. Seluruh fixture berada di PRJ-103 (satu-satunya project dengan `transportation` di `serviceScope`).

- **`TRN-1034`** (Management/`GRP-001`, 10 pax, `assigned`) — menautkan `serviceId: 'SVC-1034'` ("Ground Transportation", masih `pending-confirmation` — `VQ-009`/`VQ-010` di `app/data/vendors.ts` masih `submitted`, TIDAK diputuskan/diubah oleh section ini), 3 leg multi-day dispatch (airport-hotel, hotel-venue, hotel-airport), unit+driver sudah ditugaskan (`DN 1234 AB`, Herman Wijaya), `standbyHours`/`tollFeeIdr` terisi.
- **`TRN-1035`** (Sales Team/`GRP-002`, 25 pax, `confirmed`) — mendemokan "Change": jadwal City Tour dimajukan 2 jam (`hasChange`/`changeNote`).
- **`TRN-1036`** (Partner-VIP/`GRP-003`, `completed`) — HANYA 2 traveler (Dedi Kurniawan + companion), kendaraan van beraksesibilitas kursi roda (reuse `TRV-1031.accessibilityNeeds`), mendemokan "Incident": unit awal diganti karena kendala AC (`hasIncident`/`incidentNote`).
- **`TRN-1037`** (individual, TANPA `groupId`, `cancelled`) — 1 traveler, dibatalkan sebelum eksekusi karena peserta memakai kendaraan pribadi.
- **`TRN-1038`** (TANPA `groupId`/`serviceId`, `quoted`) — permintaan overflow day charter untuk agenda MICE, 2 opsi kendaraan dibandingkan, belum ada assignment/driver.
- Mencakup 5 dari 7 status lifecycle (`quoted`/`assigned`/`confirmed`/`completed`/`cancelled`); `requested`/`no-show` sengaja tidak di-seed (reachable lewat transisi UI, diverifikasi code review, konsisten pola Section 13/14).

---

## 4s. MICE Detail (ditambahkan Section 16 — roadmap Section 00–24 baru)

Entitas baru `MiceEvent` (`app/data/mice.ts`) — lihat D-073 (`docs/mockup-design-decisions.md`), pola arsitektur IDENTIK D-070/D-071/D-072. SATU fixture (`MICE-1035`), berbeda dari Section 13-15 yang memiliki banyak baris — realita satu event MICE utama per project.

- **`MICE-1035`** (PRJ-103, `in-progress`, client approval `approved`) — menautkan `serviceId: 'SVC-1035'` ("Venue & Rundown Acara", `confirmed`, `bookingReference: 'MICE-PLW-VEN01'`) dan vendor `VND-004` (Cendana MICE Organizer, `VQ-006` accepted Rp280.000.000) untuk mayoritas baris BOQ — total BOQ (netCost ~Rp235,5 juta / sellPrice ~Rp282 juta) berada dalam skala yang sama TANPA memaksakan kesamaan angka persis.
- **2 session**: Hari 1 (`isConfirmed: true`, kapasitas 150, matching `SFT-1032` shift note existing "Venue MICE hari ke-1 sudah siap") dan Hari 2 (`isConfirmed: false`, venue alternatif kapasitas 100 — menautkan langsung ke `TSK-1032` "Konfirmasi venue MICE hari ke-2" dan `RSK-1031` "Ketersediaan venue MICE hari ke-2 belum terkonfirmasi final", `app/data/activity.ts`).
- **4 participant category** (Delegate 60, VIP 10, Local Guest 40, Staff 15 — total 125 pax expected) — total 125 > kapasitas venue Hari 2 (100), MENDEMOKAN "Capacity and schedule conflicts" (Wajib) secara nyata, bukan skenario rekayasa lepas konteks. Attendance (`actualCount`) sudah terisi untuk Hari 1 (120 dari 125 hadir — Local Guest 35 dari 40, sisanya sesuai target).
- **6 baris BOQ** lintas seluruh kategori (catering/av/staging/equipment/booth/other), 5 baris ke `VND-004`, 1 baris (dokumentasi) ke `VND-007`.
- **Staffing**: `USR-007` (Lina Marlina, role `mice`, PIC utama — konsisten `SFT-1032`), `USR-002` (Project Manager, owner PRJ-103), `USR-009` (liaison vendor/logistik, sudah di `teamUserIds` PRJ-103).
- **Checklist** 5 item (permit/setup/rehearsal sudah selesai untuk Hari 1, setup Hari 2 dan teardown belum).
- **Change Order** aktif — menautkan narasi venue Hari 2 (`RSK-1031`/`TSK-1032`) dan rundown belum dikirim client (`TSK-1033`). **Incident** aktif — keterlambatan unit AV cadangan Hari 1, diatasi tanpa mengganggu jadwal.
- Deliverables (3 item) belum ada yang terkirim — realistis, event masih `in-progress` (Hari 2 belum selesai).

---

## 4t. Procurement Detail (ditambahkan Section 17 — roadmap Section 00–24 baru)

Entitas baru `RFQ`/`RFQInvitation`/`RFQResponse`/`RFQClarificationMessage`/`ServiceOrder`/`ServiceOrderAmendment`/`SupplierInvoice` (`app/data/procurement.ts`) — lihat D-074 (`docs/mockup-design-decisions.md`). Seluruh `vendorId` mereuse `VENDORS` existing (`app/data/vendors.ts`), TIDAK ada entitas Supplier paralel. `VND-006` (PT ABC) dan `VND-007` (PT EFG) dipakai luas, melanjutkan skenario "produk berbeda" yang sudah dimulai Prompt 19 (`VENDOR_PRODUCTS`).

**4 RFQ, merentang seluruh status literal:**
- **`RFQ-001`** (`draft`, PRJ-102, hotel) — belum dikirim ke vendor manapun, mendemokan state awal sebelum "Kirim ke Vendor" diklik.
- **`RFQ-002`** (`responses-in`, PRJ-103, mice) — mengundang `VND-004` (Cendana MICE Organizer) dan `VND-007` (PT EFG), keduanya sudah merespons (`RFQRESP-001`/`002`, Rp21.000.000/Rp20.600.000) — melengkapi BOQ `MICE-1035` (Section 16), belum diputuskan.
- **`RFQ-003`** (`clarification`, PRJ-103, hotel VIP suite) — mengundang `VND-002` (Hotel Prima Mitra) dan `VND-006` (PT ABC), keduanya merespons; thread klarifikasi 2 pesan aktif dengan PT ABC (`RFQCLR-001`/`002`, kebijakan pembatalan) — mendemokan clarification thread dua-arah secara nyata.
- **`RFQ-004`** (`closed`, PRJ-103, transportasi VIP) — mengundang `VND-003` (Trans Wahana Logistik) dan `VND-005` (CV Wisata Kargo Ekspres), `VND-003` terpilih (`selectedVendorId`) dan `RFQRESP-005` `selected` (Rp3.400.000), `RFQRESP-006` otomatis `rejected`. SENGAJA TIDAK menautkan `serviceId` ke `SVC-1034` (Ground Transportation PRJ-103, tetap milik skenario comparison VQ-009/VQ-010 Section 13 lama yang masih `pending-confirmation`) — kebutuhan VIP transfer terpisah, menghindari dua mekanisme keputusan vendor untuk baris service yang sama.

**2 Service Order, "one plain, one amended" sesuai kebutuhan literal:**
- **`SO-001`** (`fulfilled`, hasil formal `RFQ-004` → `VND-003`, PRJ-103) — netCost Rp3.400.000/sellPrice Rp4.200.000, `acknowledgedAt`/`fulfilledAt` terisi. 2 Supplier Invoice: `SINV-001` (`approved`, Rp4.200.000, pembayaran final) dan `SINV-002` (`under-review`, Rp450.000, biaya tol tambahan).
- **`SO-002`** (`amended`, engagement langsung tanpa RFQ, `VND-006` → PT ABC, PRJ-102) — netCost Rp9.600.000/sellPrice Rp12.000.000, 1 `ServiceOrderAmendment` (`SOA-001`, upgrade Deluxe→Suite). 2 Supplier Invoice: `SINV-003` (`rejected`, submission awal sebelum amendment, catatan review "jumlah belum sesuai") dan `SINV-004` (`submitted`, submission ulang setelah koreksi) — mendemokan siklus reject→resubmit self-service (resolusi Q12).

**Procurement Performance Review** (`/procurement/performance`) — derivasi murni dari data di atas: `VND-003` (win rate 100%, 1/1 RFQ menang, 1/1 Service Order fulfilled — on-time 100%), `VND-006` (belum menang RFQ, tapi punya riwayat Service Order/invoice), `VND-004`/`VND-007` (masing-masing 1 respons RFQ-002, belum diputuskan — win rate belum terhitung).

---

## 4u. Booking Orchestration Detail (ditambahkan Section 18 — roadmap Section 00–24 baru)

`BookingOrchestrationRecord` (`app/data/booking-orchestration.ts`, D-075) — SATU record per SETIAP fixture Flight/Hotel/Transport/MICE existing (Section 13-16), 18 total (`BKO-001` s/d `BKO-018`): 6 Flight (`FLT-1011`/`1021`/`1023`/`1031`/`1032`/`1033`), 6 Hotel (`HTL-1022`/`1023`/`1033`/`1034`/`1035`/`1036`), 5 Transport (`TRN-1034`/`1035`/`1036`/`1037`/`1038`), 1 MICE (`MICE-1035`) — tidak ada yang terlewat (diverifikasi silang terhadap seluruh fixture `app/data/ticketing.ts`/`accommodation.ts`/`transportation.ts`/`mice.ts`).

**Dependency chain nyata** — `BKO-014` (`TRN-1035`, Transport, Sales Team GRP-002, `confirmed`) `dependsOn` `BKO-010` (`HTL-1034`, Hotel, Sales Team GRP-002 juga, masih `quoted` — BELUM confirmed): transfer darat rombongan yang sama seharusnya menunggu hotel dikonfirmasi dulu — mendemokan "blocked dependency" exception secara nyata (`/bookings/exceptions` menampilkan "Dependency belum terpenuhi: Hotel HTL-1034").

**Payment gate states, seluruh 3 nilai literal terwakili:**
- `cleared` (4 booking): `FLT-1011`/`FLT-1031` (issued penuh), `HTL-1033` (confirmed dengan voucher terbit), `TRN-1036` (completed).
- `pending` (6 booking): `FLT-1021` (reissued), `HTL-1022`/`HTL-1035` (confirmed/amended), `TRN-1034`/`TRN-1035` (assigned/confirmed), `MICE-1035` (in-progress) — seluruhnya sudah confirmed-equivalent tapi belum ditandai lunas, tampil dengan tombol "Mark Payment Cleared" (Operations) di `/bookings`.
- `not-required` (8 booking): sisanya — masih di tahap awal/hold/quoted/cancelled/refunded/requested, belum relevan untuk gate finansial.

**Failure → retry → manual fallback** — `BKO-002` (`FLT-1021`, Abu Dhabi, `reissued`) — 2 `BookingAttempt`: percobaan reissue otomatis pertama `failed` (timeout GDS mock, 2026-07-05 09:00) diikuti `manual-fallback` (2026-07-05 10:30, tim Ticketing memproses manual lewat counter airline) — menautkan langsung ke `scheduleChangeNote` existing (`FlightBooking`, Section 13), bukan detail lepas konteks. Karena percobaan TERAKHIR berhasil (`manual-fallback`), `FLT-1021` TIDAK memicu exception "percobaan gagal" — exception yang tampil untuknya murni dari flag domain `hasScheduleChange` existing (konsisten logika `buildBookingTimelineEntry`: hanya percobaan terakhir yang `failed` yang memicu exception baru).

**Duplicate flag** — `BKO-012` (`HTL-1036`, Hotel, PRJ-102, `requested`) — permintaan kamar overflow untuk traveler yang menyusul belakangan pada project yang SUDAH punya Hotel Booking aktif (`HTL-1022`, `amended`) — `flaggedDuplicate: true`, mendemokan booking yang SENGAJA dibuat sebagai duplicate (dikonfirmasi eksplisit lewat dialog "Booking Aktif Sudah Ada" di `/accommodation`), bukan kesalahan input.

**Exception Queue** (`/bookings/exceptions`) — 6 booking membutuhkan perhatian per skenario di atas: `FLT-1021` (schedule change), `HTL-1022` (amended), `HTL-1036` (duplicate flag), `TRN-1035` (blocked dependency), `TRN-1036` (incident operasional existing, Section 15), `MICE-1035` (change order + incident + capacity conflict existing, Section 16, `getMiceScheduleConflicts` di-reuse langsung).

---

## 4v. Changes, Cancellation, Refund dan Incident Detail (ditambahkan Section 19 — roadmap Section 00–24 baru)

`ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` (`app/data/change-incident.ts`, D-076) — fully additive, ditautkan ke fixture existing (bukan skenario lepas konteks).

**Change Requests (`CR-001` s/d `CR-006`), seluruh 3 sumber dan 5 status literal terwakili:**
- Sumber: `internal` (`CR-001`/`CR-003`/`CR-006`), `client` (`CR-002`/`CR-005`), `supplier` (`CR-004`).
- Status: `approved` (`CR-001` menaut `CHG-1021` existing, `CR-003` menaut `CHG-1031` existing), `under-review` (`CR-002` menaut `CHG-1023` existing, selaras `approvalStatus: 'pending'`), `submitted` (`CR-004`, menaut `ActivityEntry` BARU `CHG-1032` — vendor mengusulkan upgrade armada transport), `rejected` (`CR-005`, menaut `CHG-1033` BARU — client minta reschedule H-1 untuk e-ticket yang sudah issued, ditolak karena fare rules), `implemented` (`CR-006`, menaut `CHG-1034` BARU — rundown MICE ditambah breakout room). `CR-001`/`CR-002`/`CR-003` mendemokan `activityEntryId` menaut ke `ActivityEntry` LAMA (Section 14, `CHG-1021`/`1023`/`1031`) — bukti `ChangeRequest` adalah lapisan tambahan di atas audit trail yang sudah ada, bukan log kedua yang terpisah.

**Cancellations (`CNX-001` s/d `CNX-003`), dengan dan tanpa penalty:**
- `CNX-001` (Flight `FLT-1023`, PRJ-102, `refunded`) — penalty Rp5.000.000, `refundEligible: true`.
- `CNX-002` (Hotel `HTL-1023`, PRJ-102, `cancelled`) — penalty Rp3.750.000 (selaras narasi existing "penalti 15%", D-071), `refundEligible: true`.
- `CNX-003` (Transport `TRN-1037`, PRJ-103, `cancelled`) — TANPA penalty, `refundEligible: false` (traveler beralih kendaraan pribadi sebelum deposit).

**Refund Requests (`REF-001` s/d `REF-005`), seluruh 5 status literal, partial/full, satu `creditStatus: 'issued'`:**
- `REF-001` (`processed`, full audit trail approve→process, `creditStatus: 'issued'`, menaut `CNX-001`+`INV-1021`, partial Rp45.000.000).
- `REF-002` (`approved`, `creditStatus: 'pending'`, menaut `CNX-002`+`INV-1022`, full Rp21.250.000).
- `REF-003` (`under-review`, menaut `CNX-003` [tanpa penalty, murni deposit], full Rp2.000.000).
- `REF-004` (`requested`, TANPA `cancellationId` — goodwill refund menaut langsung `INV-1011`, partial Rp5.000.000).
- `REF-005` (`rejected`, `creditStatus: 'not-applicable'`, TANPA `cancellationId`, menaut `INV-1032`, partial Rp10.000.000 — melewati batas waktu kebijakan).

**Incidents (`INC-001` s/d `INC-004`), seluruh 4 severity, satu `escalated`, satu multi-entry communication log, booking-linked dan project-level:**
- `INC-001` (severity `high`, Transport `TRN-1034`, PRJ-103, status `escalated` ke Operations `USR-009`, `communicationLog` 2 entri — kendaraan mogok saat penjemputan Group Sales Team).
- `INC-002` (severity `medium`, Flight `FLT-1021`, PRJ-102, status `resolved` dengan `resolutionNote`, menaut narasi `scheduleChangeNote` existing).
- `INC-003` (severity `critical`, PRJ-103, project-level TANPA `bookingId` — peringatan cuaca ekstrem Palu, status `open`).
- `INC-004` (severity `low`, PRJ-101, project-level TANPA `bookingId`, status `closed` dengan `resolutionNote` — keterlambatan dokumen traveler, sudah lengkap H-2).

---

## 4w. Project Finance Detail (ditambahkan Section 20 — roadmap Section 00–24 baru)

`Invoice`/`Payment` diperluas aditif, `CreditNote`/`DebitNote` baru, `SupplierInvoice` +AP scheduling/match-status (`app/data/finance.ts`/`app/data/procurement.ts`, D-077). Seluruh backfill fixture existing (`currency: 'IDR'`, `invoiceType`, `recordedBy: 'USR-008'`) TIDAK mengubah satu pun angka yang sudah divalidasi sejak Section 15/16 (bagian 1.3/2.3/3.3 di bawah) — diverifikasi ulang lewat smoke test Section 20.

**Invoice `invoiceType` backfill (nilai efektif `amountIdr`/`status` TIDAK berubah):**
- `INV-1011` (PRJ-101, paid) → `final` (satu-satunya invoice project, penutup).
- `INV-1021` (PRJ-102, partially-paid, "Termin Awal") → `dp`.
- `INV-1022` (PRJ-102, unpaid, invoice tambahan perubahan kamar) → `progress`.
- `INV-1031` (PRJ-103, paid, "Termin 1") → `dp`.
- `INV-1032` (PRJ-103, unpaid, "Termin 2") → `final`.
- `INV-1041` (BARU, PRJ-104 — sebelumnya nol invoice, tidak pernah divalidasi angka apa pun oleh section manapun) → `dp`, currency `USD`, `exchangeRateSnapshot` (rate 15.600/USD, snapshot 2026-07-20), amountIdr Rp20.000.000, unpaid, jatuh tempo 2026-08-20 (skenario "belum jatuh tempo" — mendemokan multi-currency + DP tanpa risiko regresi angka lama).

**Credit/Debit Note seed:**
- `CN-001` (Credit Note, `INV-1011` PRJ-101, sudah `paid`) — Rp2.000.000, "Penyesuaian billing minor — kelebihan pembebanan airport tax". SENGAJA ditaruh di invoice yang outstanding-nya sudah 0 (floor `Math.max(...,0)` menjaga nol perubahan efektif) — BUKAN pada `INV-1021` (REF-001, sudah `creditStatus: 'issued'` sejak Section 19) untuk menghindari mengubah Outstanding PRJ-102 (Rp95.000.000) yang sudah divalidasi presisi sejak Section 15/16. Hook `issueCreditNote` di `updateRefundRequestStatus` bersifat PROSPEKTIF (hanya berlaku transisi status baru sejak Section 20 berjalan) — lihat D-077.
- `DN-001` (Debit Note, PRJ-102, terkait `INV-1022`) — Rp5.000.000, "Biaya tambahan perubahan kamar melebihi kuota yang disepakati". Murni informasional, TIDAK menambah `amountIdr` `INV-1022`.

**Supplier Invoice AP match-status backfill (`app/data/procurement.ts`):**
- `SINV-001` (approved, SO-001/PRJ-103) → `matched`, `paymentScheduleDate: '2026-08-20'`.
- `SINV-002` (under-review, SO-001/PRJ-103, biaya tol tambahan) → `unmatched` — mendemokan reconciliation workspace.
- `SINV-003` (rejected, SO-002/PRJ-102) → TIDAK diisi (moot, tidak relevan direkonsiliasi).
- `SINV-004` (submitted, SO-002/PRJ-102, submission ulang) → `disputed` — mendemokan state ketiga reconciliation (jumlah sesuai submission tapi menunggu konfirmasi pajak terpisah dari vendor).

**Financial Closure Gate (`evaluateFinanceClosureGate`) — hasil per project (kondisi seed saat ini, diverifikasi presisi lewat smoke test SSR, akan berubah begitu user melakukan aksi Record Payment/proses Refund/Mark Matched):**
- PRJ-101: 1 blocker — `REF-004` (`requested`, non-terminal).
- PRJ-102: 3 blocker — 2 invoice outstanding (`INV-1021`/`INV-1022`), `REF-002` (`approved`, non-terminal), `SINV-004` (`disputed`, SO-002).
- PRJ-103: 3 blocker — `INV-1032` outstanding, `REF-003` (`under-review`, non-terminal), `SINV-002` (`unmatched`, SO-001 — SO-001 projectId `PRJ-103`).
- PRJ-104: 1 blocker — `INV-1041` outstanding (belum dibayar, belum jatuh tempo).

---

## 4x. Documents, Communication dan Notifications Detail (ditambahkan Section 21 — roadmap Section 00–24 baru)

`Document`/`Message`/`Notification` baru (`app/data/document-comms.ts`, D-078) — fully additive di atas `ProjectDocument`/`VendorDocument` existing.

**Document seed (`DOCUMENT_RECORDS`, 16 baris) — cakupan lintas 12 `entityType`, mix access-level/source-type/expiry:**
- `DOC-C001` (project PRJ-101, uploaded, internal) s.d. `DOC-C010` (project PRJ-103, generated, client) — mencakup quotation (`DOC-C002`→`OPP-001/quotation-preview`), flight (`DOC-C003`→`FLT-1011/eticket-preview`), hotel (`DOC-C004`→`HTL-1033/voucher-preview`), transport client+internal (`DOC-C005`/`DOC-C006`→`TRN-1034/service-order-preview`+`driver-sheet-preview`), mice client+internal (`DOC-C007`/`DOC-C008`→`MICE-1035/rundown-preview`+`boq-preview`), project-level generated (`DOC-C009`/`DOC-C010`→`PRJ-103/run-sheet-preview`+`manifest-preview`) — seluruh `previewRoute` diverifikasi menaut ke route preview REAL yang sudah ada di codebase (bukan ditebak).
- `DOC-C011` (vendor VND-006, uploaded, supplier) — `expiresAt: '2026-07-01'`, SUDAH EXPIRED relatif terhadap `DEMO_REFERENCE_DATE` (2026-07-29) — mendemokan badge "Expired" di `/documents` dan tab Documents Project Detail.
- `DOC-C012` (party PTY-001, uploaded, client) — `expiresAt: '2026-08-10'`, dalam jendela "akan kedaluwarsa" 30 hari (`DOCUMENT_EXPIRY_WARNING_DAYS`) — mendemokan badge "Segera".
- `DOC-C013` (invoice INV-1011), `DOC-C014` (traveler TRV-1021, `expiresAt` selaras `visaExpiryDate` traveler asli), `DOC-C015` (change-request CR-004), `DOC-C016` (incident INC-001) — melengkapi cakupan `entityType` lintas seluruh 12 nilai.

**Message seed (`MESSAGE_RECORDS`, 8 baris) — 3 channel, 4 `deliveryStatus`, mentions:**
- `MSG-001` (internal-note, PRJ-101, mentions `USR-004`) dan `MSG-006` (internal-note, incident INC-001, mentions `USR-009`) — memicu `Notification` type `mention` via `sendMessage`.
- `MSG-002` (client-message, PRJ-102, delivered/email), `MSG-003` (client-message, PRJ-102, **failed**/whatsapp — satu-satunya delivery gagal), `MSG-007` (client-message, change-request CR-002, delivered/whatsapp, sender `USR-020` client).
- `MSG-004`/`MSG-005` (supplier-message, vendor VND-006, pasangan tanya-jawab Operations↔Supplier, sent/email dan delivered/email).
- `MSG-008` (internal-note, PRJ-104, mentions `USR-004`, **queued** — satu-satunya status queued, mendemokan state "belum settle" di fixture meski `sendMessage` runtime settle deterministik).

**Notification seed (`NOTIFICATION_RECORDS`, 9 baris) — 5 user berbeda (`USR-002`/`003`/`004`/`006`/`009`), mixed read/unread, seluruh 8 `NotificationType`:**
- `NOT-001` (mention, USR-004, unread), `NOT-002` (escalation, USR-009, read), `NOT-003` (change, USR-003, unread), `NOT-004` (assignment, USR-004, read), `NOT-005` (mention, USR-009, unread), `NOT-006` (reminder, USR-002, unread), `NOT-007` (document, USR-003, unread), `NOT-008` (message, USR-004, unread), `NOT-009` (incident, USR-006, read).
- Login sebagai `USR-004` (Andi Pratama, Ticketing, via Settings role switcher) untuk demo bell popover dengan 3 unread (`NOT-001`/`004` read jadi 2 unread aktual — cek `getUnreadNotificationCount('USR-004')` di runtime); login sebagai `USR-009` (Fajar Nugroho, Operations) untuk demo eskalasi Incident yang sudah diterima.

**Hook notification-push langsung dapat didemokan (bukan hanya via seed statis):** eskalasi Incident baru dari `/changes/incidents/[id]` memicu notifikasi ke user yang dieskalasi; Approve/Reject Change Request dari `/changes/[id]` memicu notifikasi ke `requestedBy`; assign/reassign task dari tab "Tasks" Project Detail memicu notifikasi ke assignee baru; compose pesan dengan mentions dari `/documents` atau tab "Communication" Project Detail memicu notifikasi mention.

---

## 5. Role-Restricted Finance View (bukan record baru, kondisi tampilan atas PRJ-103)

Menggunakan **PRJ-103** sebagai subjek konkret untuk mendemonstrasikan Role & Access Matrix (`docs/route-and-role-matrix.md` bagian 5) pada tab "Finance":

| Role yang melihat | Yang terlihat |
|---|---|
| Sales (USR-001) | Hanya nilai Quotation (Rp 1.400.000.000) dan status invoice/payment ringkas (Outstanding Rp 700.000.000) — **tidak melihat** breakdown Budget per kategori, Actual cost, maupun Margin |
| Project Manager (USR-002) | Budget vs Actual per kategori (Flight/Hotel/Transportation/MICE) untuk project yang dikelolanya — **tidak termasuk** aksi edit invoice |
| Finance (USR-008) | Seluruh breakdown Budget/Actual/Invoice/Payment/Outstanding, dapat mengelola (`MANAGE`) invoice & payment |
| Management (USR-003) / Super Admin (USR-010) | Seluruh informasi termasuk Margin, dapat approve |
| Viewer/Auditor (USR-011) | Seluruh informasi finansial, read-only |

Ini menegaskan `docs/route-and-role-matrix.md` bagian 5.1 ("View financial information") dengan contoh data konkret, bukan aturan abstrak.

---

## 6. Pemetaan Skenario Tambahan (Prompt 4-D) ke Data di Atas

Seluruh 7 skenario tambahan yang diminta dipetakan ke entitas yang **sudah ada** di atas (efisien, tidak menambah record yang tidak perlu):

### 6.1 Empty State
PRJ-101 (Normal Project) — tab "Activity & Changes" kosong (tidak ada entri `CHG-`), tab "Documents" hanya berisi 1 dokumen (DOC-1011) — representasi realistis project yang berjalan mulus tanpa riwayat perubahan.

### 6.2 Overdue Invoice
PRJ-102 — INV-1022 (Rp 35.000.000, jatuh tempo 2026-07-20, belum dibayar per tanggal acuan 2026-07-29 → **9 hari overdue**).

### 6.3 Upcoming Departure
PRJ-103 — travel date 10–14 Agustus 2026, ~2 minggu dari tanggal acuan → memicu widget dashboard "Upcoming Departure". PRJ-101 (20–23 Agustus 2026, ~3 minggu) jadi contoh sekunder.

### 6.4 Cancelled Service
PRJ-102 — Hotel Room Block B (3 pax) berstatus `Cancelled` setelah dikonsolidasi ke Room Block A.

### 6.5 Pending Confirmation
PRJ-103 — Flight batch 2 (grup VIP) dan Transportation, keduanya berstatus `Pending Confirmation` mendekati tanggal keberangkatan (memicu attention item bersama).

### 6.6 Lost Opportunity
OPP-004 (PTY-004) — lihat bagian 4.

### 6.7 Role-Restricted Finance View
PRJ-103 — lihat bagian 5.

---

## 7. Konsistensi ID Lintas Halaman (checklist)

Setiap ID pada dokumen ini **wajib dipakai identik** di seluruh titik implementasi berikutnya (dashboard widget, Project Detail, CRM, Finance, Reports, Administration) — tidak boleh ada shape/ID berbeda untuk entitas yang sama seperti temuan Prompt 1 (Project/Task/Expense yang dulu punya 2–3 shape tidak sinkron):

- 3 Project (`PRJ-101`, `PRJ-102`, `PRJ-103`) + 7 Opportunity (`OPP-001`–`OPP-004` skenario utama, `OPP-005`–`OPP-007` pipeline aktif ditambahkan Section 06 — bagian 4a) + 4 Party (`PTY-001`–`PTY-004`) + 4 Contact (`CP-001`–`CP-004`) + 6 Party Activity (`PACT-001`–`PACT-006`, ditambahkan Section 07 — bagian 4b).
- 5 Vendor (`VND-001`–`VND-005`), dipakai berulang lintas project (bukan vendor baru per project).
- 12 User (`USR-001`–`USR-011`, `USR-013`) mencakup seluruh 11 role demo (2 user berperan PM untuk keragaman "project owner").
- ID Invoice/Payment/Task/Change/Document mengikuti prefix project (mis. seluruh entitas PRJ-102 memakai akhiran `102x`) untuk memudahkan penelusuran silang manual sebelum ada database sungguhan.
- `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` sejak Section 07 adalah `reactive()` array (mendukung create-mock nyata dari UI) — ID baru yang dibuat lewat `/crm/prospects` (`createParty`) mengikuti pola sekuensial yang sama (`PTY-005`, `PTY-006`, dst.), dihitung otomatis dari ID tertinggi yang ada, bukan dikelola manual di dokumen ini.
- `OPPORTUNITIES`/`QUOTATIONS` sejak Section 08 juga `reactive()` — transisi stage, submit Won-Requested, tandai Lost/On Hold, dan create/revisi quotation (`advanceOpportunityStage`/`createQuotation`/`reviseQuotation`, `app/data/index.ts`) ter-propagate seketika ke Dashboard/Party Detail/CRM overview tanpa reload.
- `PROJECTS`/`ACTIVITIES` sejak Section 09 juga `reactive()` — Approve Won (`approveOpportunityWon`, `app/data/index.ts`) mendorong Project baru dan entri Activity baru yang langsung terlihat di `/projects`, Dashboard, dan Party Detail. ID Project baru mengikuti pola sekuensial yang sama (`PRJ-104`, dst.), dihitung otomatis — bukan angka acak.
- `TRAVELERS`/`TRAVELER_GROUPS` sejak Section 11 juga `reactive()` (bagian 4e) — `createTraveler`/`updateTraveler`/`removeTraveler`/`importTravelersMock` (`app/data/index.ts`) ter-propagate seketika ke tab Travelers tanpa reload. ID traveler baru mengikuti prefix `TRV-` sekuensial global (bukan per-project), pola yang sama seperti `PTY-`/`PRJ-`.
- `PROJECT_SERVICES` sejak Section 12 juga `reactive()` (bagian 4f) — `updateServiceStatus` (`app/data/index.ts`) ter-propagate seketika ke tab Itinerary & Services DAN tab Overview (Service Summary, Section 10) tanpa reload karena keduanya membaca array yang sama; transisi ke status `changed` juga menambah entri `ACTIVITIES` (prefix `ACT-` sekuensial, konsisten dengan skema existing).
- `VENDORS` sejak Section 13 juga `reactive()` (bagian 4g) — `createVendor`/`createVendorContact`/`submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation` (`app/data/index.ts`) ter-propagate seketika ke `/vendors`, Vendor Detail, dan tab "Vendors" Project Detail tanpa reload. `acceptVendorQuotation` memanggil `updateServiceStatus` (Section 12) untuk mengonfirmasi service — bukan mutasi `PROJECT_SERVICES` paralel.
- `ACTIVITIES` sejak Section 09 sudah `reactive()`; Section 14 menambah `createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry` (`app/data/index.ts`) yang memutasi array yang sama — ter-propagate seketika ke tab "Activity & Changes" DAN (via `isChange`/`reviewed` yang tidak diubah semantiknya) widget attention/recent-activity existing (Section 06/10) tanpa reload. ID Change baru mengikuti prefix `CHG-` sekuensial global (bagian 4h).
- **Prompt 19 (Change Request):** prefix ID baru — `LED-` Lead, `LACT-` Lead Activity, `VPR-` Vendor Product, `EVT-` System Event (bagian 4j). `LEADS`/`LEAD_ACTIVITIES`/`VENDOR_PRODUCTS` seluruhnya `reactive()` (pola sama sejak Section 07) — `createLead`/`createLeadActivity`/`archiveLead`/`qualifyLeadAndCreateOpportunity`/`createVendorProduct` (`app/data/index.ts`) ter-propagate seketika tanpa reload. `qualifyLeadAndCreateOpportunity` mencari `Party` existing berdasarkan nama company dulu (cegah duplicate company) sebelum membuat baru — ID `PTY-`/`OPP-` baru tetap mengikuti skema sekuensial yang sama. `SYSTEM_EVENTS` (Activity Center) BUKAN `reactive()` — murni log seed statis, tidak ada mutator (tidak ada aksi UI yang menambah event baru pada implementasi ini).
- **Section 17 (Procurement):** prefix ID baru — `RFQ-` RFQ, `RFQINV-` RFQ Invitation, `RFQRESP-` RFQ Response, `RFQCLR-` RFQ Clarification Message, `SO-` Service Order, `SOA-` Service Order Amendment, `SINV-` Supplier Invoice, `VDOC-` Vendor Document (bagian 4t). `RFQS`/`RFQ_INVITATIONS`/`RFQ_RESPONSES`/`RFQ_CLARIFICATIONS`/`SERVICE_ORDERS`/`SERVICE_ORDER_AMENDMENTS`/`SUPPLIER_INVOICES`/`VENDOR_DOCUMENTS` seluruhnya `reactive()` (pola sama sejak Section 07) — `createRfq`/`sendRfqToVendors`/`submitRfqResponse`/`addRfqClarificationMessage`/`selectRfqVendor`/`closeRfq`/`createServiceOrder`/`updateServiceOrderStatus`/`amendServiceOrder`/`submitSupplierInvoice`/`reviewSupplierInvoice`/`createVendorDocument` (`app/data/index.ts`) ter-propagate seketika tanpa reload. `VENDORS` (Section 13 lama) diperluas aditif (`category`/`status`/`documents`) via `updateVendor` — bukan entitas baru.

## 8. Batasan

Sesuai Prompt 4: dokumen ini adalah **rancangan data**, bukan implementasi. Tidak ada file kode yang dibuat/diubah, tidak ada seed data yang benar-benar ditulis ke `app/`. Lokasi modul data terpusat final tetap mengikuti D-015 (DEFERRED ke tahap implementasi).
