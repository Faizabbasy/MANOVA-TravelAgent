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

**Leads (`LED-001`–`LED-010`):** satu lead per sumber wajib (`website` ×2, `instagram`, `tiktok`, `whatsapp`, `referral`, `event`, `email`, `sales-outreach`, `other`). `LED-001` ("CV Nirmala Eventama") = qualified milik AE, belum dikonversi — live-demo "Qualify & Create Opportunity". `LED-005` = qualified, sudah terhubung ke `OPP-005`/`PTY-004` (Bali Team Building, existing sejak Section 08). `LED-009` = qualified, sudah terhubung ke `OPP-001`/`PTY-001` (Manila, Won — sejak Foundation). `LED-010` = archived (contoh filter "Archived leads").

**Commercial Approval:** `QUO-005` (OPP-005, Bali Team Building) — `approvalStatus: submitted`, skenario "satu quotation menunggu approval" (literal Prompt 19-9); `QUO-006` (OPP-006, Manila Repeat Business, PTY-001) — `approvalStatus: approved`, siap didemokan "Ajukan sebagai Won" → Approve Won. `QUO-001`/`002`/`003` (Won existing) di-backfill `approved`; `QUO-004` (Lost) dibiarkan tanpa `approvalStatus`.

**Repeat Client — Beberapa Project Order:** `OPP-008`/`QUO-008`/`PRJ-104` ("Manila Follow-up Training Q1 2027") — Opportunity Won kedua untuk `PTY-001` (yang sudah punya `PRJ-101`), memenuhi literal "satu Active Client dengan beberapa Project Orders" tanpa aksi interaktif tambahan. `PRJ-104` sengaja `draft`/`actualCostIdr: 0` (baru terbentuk dari Won, belum diisi Operations).

**Account Executive Ownership:** `Opportunity.ownerId` pada `OPP-001`–`OPP-008` seluruhnya `USR-014` (Galih Ramadhan, satu-satunya AE demo) — reassignment dari `USR-001` (Sales), lihat D-047.

**Supplier / External Partners:** `VND-006` ("PT ABC", fokus Hotel) dan `VND-007` ("PT EFG", fokus MICE) — masing-masing 1 supplier user ter-isolasi (`USR-015`/`USR-016`, `vendorId` mengarah ke company masing-masing) dan katalog produk berbeda (`VendorProduct`: `VPR-001`/`002` milik PT ABC — kamar & meeting room; `VPR-003`/`004` milik PT EFG — venue & event organizer).

**Lead Source Recap (dihitung, bukan disimpan):** Total Leads 10, Qualified 3 (`LED-001`/`005`/`009`), Opportunities Created 2 (`LED-005`/`009` — punya `opportunityId`), Won 1 (`LED-009` → `OPP-001` Won). Diverifikasi ulang lewat smoke test curl terhadap halaman `/customer-journey/lead-sources` — cocok persis.

**Activity Center:** 22 `SystemEvent` (`EVT-001`–`EVT-022`) merentang seluruh 8 modul (lead/opportunity/quotation/client/project-order/vendor/finance/user), `entityId` merujuk ID entitas existing di atas — tidak ada entity baru yang difabrikasi khusus untuk log.

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

## 8. Batasan

Sesuai Prompt 4: dokumen ini adalah **rancangan data**, bukan implementasi. Tidak ada file kode yang dibuat/diubah, tidak ada seed data yang benar-benar ditulis ke `app/`. Lokasi modul data terpusat final tetap mengikuti D-015 (DEFERRED ke tahap implementasi).
