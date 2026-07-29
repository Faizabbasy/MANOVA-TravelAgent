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

### 0.2 Vendors (fiktif, bukan brand nyata — sesuai D-006)

| ID | Nama | Jenis layanan | Dipakai di project |
|---|---|---|---|
| VND-001 | CV Tiket Mitra Nusantara | Flight | PRJ-101, PRJ-102, PRJ-103 |
| VND-002 | Hotel Prima Mitra | Hotel | PRJ-102, PRJ-103 |
| VND-003 | Trans Wahana Logistik | Transportation | PRJ-103 |
| VND-004 | Cendana MICE Organizer | MICE | PRJ-103 |
| VND-005 | CV Wisata Kargo Ekspres | Transportation (cadangan) | PRJ-103 |

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
| OPP-005 | PTY-004, "Bali Team Building 2026", stage `Negotiation`, dibuat 2026-07-05, Quotation QUO-005 Rp 180.000.000 (belum diputuskan) |
| OPP-006 | PTY-001, "Manila Repeat Business Q4 2026", stage `Proposal`, dibuat 2026-07-15, Quotation QUO-006 Rp 60.000.000 (belum diputuskan) |
| OPP-007 | PTY-002, "Abu Dhabi Follow-up Training", stage `Qualification`, dibuat 2026-07-20, belum ada quotation |

Task tambahan (agar widget "Milestone/Task Mendatang" Project Manager punya data selain yang overdue): TSK-1023 (PRJ-102, jatuh tempo 2026-08-01), TSK-1035 (PRJ-103, jatuh tempo 2026-08-05).

Detail keputusan dan alasan penambahan ada di `docs/mockup-change-impact-log.md` (CI-002) dan `docs/mockup-section-reports/section-06-dashboard.md`.

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

- 3 Project (`PRJ-101`, `PRJ-102`, `PRJ-103`) + 7 Opportunity (`OPP-001`–`OPP-004` skenario utama, `OPP-005`–`OPP-007` pipeline aktif ditambahkan Section 06 — bagian 4a) + 4 Party (`PTY-001`–`PTY-004`).
- 5 Vendor (`VND-001`–`VND-005`), dipakai berulang lintas project (bukan vendor baru per project).
- 12 User (`USR-001`–`USR-011`, `USR-013`) mencakup seluruh 11 role demo (2 user berperan PM untuk keragaman "project owner").
- ID Invoice/Payment/Task/Change/Document mengikuti prefix project (mis. seluruh entitas PRJ-102 memakai akhiran `102x`) untuk memudahkan penelusuran silang manual sebelum ada database sungguhan.

## 8. Batasan

Sesuai Prompt 4: dokumen ini adalah **rancangan data**, bukan implementasi. Tidak ada file kode yang dibuat/diubah, tidak ada seed data yang benar-benar ditulis ke `app/`. Lokasi modul data terpusat final tetap mengikuti D-015 (DEFERRED ke tahap implementasi).
