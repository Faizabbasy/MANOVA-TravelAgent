# Mockup Scope — MANOVA

> **SUPERSEDED (Section 24, 2026-08-01)** — dokumen ini adalah artefak skema lama (Prompt 0–18) dan TIDAK mencerminkan ~10 modul top-level baru yang dibangun Section 03–23 roadmap Section 00–24 (Product Planning, Ticketing, Accommodation, Transportation, MICE, Booking & Service Order Center, Procurement, Changes & Incidents, Documents & Communication, Client/Supplier Portal penuh, dll.). Body dokumen di bawah **dipertahankan apa adanya** sebagai jejak historis (bukan dihapus/ditulis ulang). Untuk kondisi terkini, lihat `docs/frontend-module-map.md` dan (setelah Phase 2 Section 24) `docs/frontend-end-to-end-implementation-guide.md`.

Status dokumen: **belum ada implementasi.** Disusun awal di Prompt 2 (gap analysis), route/IA/role difinalisasi di Prompt 3, **dirapikan dan dilengkapi di Prompt 4** menjadi dokumen scope yang utuh (product objective, business context, assumptions, constraints, acceptance criteria, definition of done) sesuai Prompt 4 bagian B. Tidak ada informasi valid dari versi sebelumnya yang dihapus.

---

## 1. Product Objective

MANOVA adalah **frontend mockup** sistem pengelolaan operasional project untuk bisnis travel agent — mengelola proses sejak lead/calon client masuk, opportunity dibuat, quotation disiapkan, opportunity dinyatakan won, project otomatis terbentuk, kebutuhan perjalanan diproses, biaya dipantau, invoice diterbitkan, pembayaran diterima, hingga project selesai. Tujuan fase mockup ini adalah menghasilkan pengalaman UI yang koheren dan data demo yang konsisten untuk didemokan ke stakeholder, **bukan** sistem produksi dengan backend nyata.

## 2. Business Context

- Bisnis: travel agent, dengan **fokus utama B2B** (Prompt 0-A) — mengelola project perjalanan untuk client korporat/kelompok, bukan konsumen perorangan sebagai prioritas awal.
- Kombinasi layanan yang harus didukung: tiket pesawat saja, tiket+hotel, tiket+hotel+transportasi, dan project dengan kebutuhan MICE (Prompt 0-B) — lihat konsep "conditional service sections" di bagian 8.
- Alur bisnis baseline: Lead → Prospect → Opportunity → Quotation → Won → Project otomatis → Project planning → Itinerary & Traveler → Pemesanan/pengelolaan service → Vendor → Monitoring perubahan → Budget & Actual → Invoice → Payment → Project completion (Prompt 0-C, dirinci workflow-nya di `docs/route-and-role-matrix.md` bagian 2).
- Sistem dirancang untuk dipakai oleh **beberapa travel agent dengan pola operasional berbeda** — struktur data dan modul tidak boleh terlalu spesifik ke satu travel agent tunggal (Prompt 0-A).

## 3. Primary Users (Role Demo)

Seluruh 11 role baseline **digunakan pada demo** (keputusan LOCKED D-003, `docs/mockup-design-decisions.md`), masing-masing dengan kebutuhan dashboard dan akses modul berbeda (detail lengkap: `docs/route-and-role-matrix.md` bagian 5–6):

Super Admin · Management · Sales · Project Manager · Operations · Ticketing · Accommodation · Transportation · MICE · Finance · Viewer/Auditor.

**Prompt 19 (Change Request, 2026-07-30) menambah 2 role — total 13 role demo** (D-046, `docs/mockup-design-decisions.md` Kelompok I): **Account Executive** (mengambil alih pengelolaan Opportunity/Quotation/Won dari Sales; Sales dipersempit ke Lead saja — D-047) dan **Supplier** (External Partner, akses terisolasi ke satu vendor company — D-048).

## 4. B2B Focus dan B2C Extensibility

- **Fase mockup ini fokus B2B** — seluruh IA, route, dan skenario data demo (bagian 9) dirancang untuk kasus korporat/kelompok.
- Struktur data (khususnya `Party` sebagai master Prospect/Client, lihat D-001/D-024) sengaja dibuat cukup umum agar **dapat mengakomodasi B2C di masa depan** tanpa perombakan besar — namun **tidak ada halaman/alur khusus B2C yang dibangun pada fase ini** (lihat bagian 6, Non-Goals).

## 5. In-Scope Modules

Berdasarkan domain mapping (`docs/template-reuse-mapping.md`) dan IA final (`docs/mockup-information-architecture.md`), mockup MANOVA mencakup 8 area kerja, dikerjakan bertahap:

1. **Foundation** — sentralisasi data/tipe, formatter Rupiah & tanggal (D-037), status-constant terpusat (D-038), primitive `ui/tabs` (D-009), perbaikan bug fungsional (`handleDelete`), resolusi duplikasi `cn()`.
2. **CRM** — Prospects, Clients (dua filtered-view dari satu master `Party`, D-001/D-024), Opportunities, Quotations, dengan Contacts & Activities sebagai tab di Party Detail.
3. **Opportunity to Project** — alur Opportunity Won → Project otomatis (D-002) dengan model approval dua-langkah Sales→Management/Super Admin (D-025).
4. **Project Management** — Project list (`/projects`), Project Detail dengan **8 tab final**: Overview, Itinerary & Services, Travelers, Vendors, Finance, Tasks, Documents, Activity & Changes (D-026), Edit project.
5. **Vendor** — Direktori Vendor top-level (`/vendors`) + tab "Vendors" kontekstual di Project Detail.
6. **Finance** — Invoices, Payments top-level (`/finance/...`); Budget/Cost/Outstanding melebur sebagai bagian tab "Finance" di Project Detail.
7. **Reporting** — Dashboard lintas-domain final (widget kondisional per role, D-031) + halaman `/reports` (Sales Pipeline/Project Performance/Cost and Margin/Finance Summary sebagai section dalam satu halaman).
8. **Administration** — Master Data, Users, Roles and Permissions, Audit Trail (`/admin/...`).

**Catatan:** Operations dan Traveler tidak jadi phase dengan menu top-level sendiri — isinya melebur ke tab Project Detail (phase Project Management), hasil resolusi Q3/D-020.

### 5a. Perluasan Scope — Prompt 19 Change Request (2026-07-30)

Di atas 8 module baseline (seluruhnya COMPLETED, lihat `docs/mockup-section-progress.md` Section 05–18), Prompt 19 menambah:

9. **Customer Journey** — Leads (Table/Kanban/Inbox + drawer), Customers, Project Orders, Lead Source Recap (`/customer-journey/*`). Customers/Project Orders adalah tampilan baru di atas `Party`/`Project` existing (D-050), bukan modul data terpisah.
10. **Activity Center** — log lintas sistem untuk Super Admin (`/activity-center`).
11. **External Partners / Supplier Portal** — akses vendor company ter-isolasi untuk supplier user (`/supplier/*`) + tab "Products" baru di Vendor Detail existing (`/vendors/[id]`).

Detail lengkap: `docs/mockup-section-reports/change-customer-journey-ae-supplier.md`.

### 5b. Penyempurnaan Alur — Prompt 20 Change Request (2026-07-31)

Prompt 19 memisahkan role Sales (Lead) dan Account Executive (Opportunity), tapi Lead belum punya form Qualification terstruktur dan Opportunity belum punya Requirement Detail/gate nyata. Prompt 20 melengkapi:

- **Lead Qualification** — form terstruktur (jenis kebutuhan, destinasi, periode, traveler, service scope, ringkasan kebutuhan, AE tujuan — wajib; budget range, fleksibilitas tanggal, decision maker, urgensi, special request, catatan komunikasi — opsional), gate kelengkapan sebelum "Qualify & Create Opportunity", aksi "Simpan Draft"/"Mark as Unqualified".
- **AE Requirement Detail** — Opportunity Detail mendapat section "Requirement Detail" (itinerary concept, departure city, room requirement, dst.) yang dapat diedit AE, plus Requirement Gate baru sebelum Quotation dapat dibuat (terpisah dari gate sebelum Won, Section 09).
- **Quotation komersial lebih lengkap** — discount, estimated cost, estimated margin, payment terms, service breakdown pada `Quotation` (field aditif), aksi "Edit Quotation" terpisah dari "Create New Version".
- **Mark as Won satu-langkah oleh AE** — menggantikan model approval Won dua-langkah (D-025) khusus untuk eksekusi Won; Management tetap satu-satunya approver Commercial Approval (Quotation) — lihat D-053.
- **Status workflow lebih jelas** — badge baru (Pending Requirement/Ready for Quotation/Quotation Draft/Pending Management Approval/Approved/Won/Lost), label stage lama yang membingungkan direname.

Detail lengkap: `docs/mockup-section-reports/change-sales-qualification-ae-opportunity.md`.

## 6. Out-of-Scope / Non-Goals

- Backend/API nyata, integrasi airline/hotel/payment gateway/WhatsApp API/vendor API — dilarang eksplisit (D-006) dan tidak menjadi bagian scope kapan pun selama fase mockup frontend ini berlangsung.
- Autentikasi/keamanan produksi nyata — mock `localStorage` existing dipertahankan sebagai mock, bukan diperkuat jadi auth nyata.
- Permission granular level-field — role/permission dibangun scalable dan terdokumentasi pada granularity modul (D-030), bukan seluruh permission granular sekaligus di awal.
- Halaman/alur khusus B2C — lihat bagian 4.
- Menambah package/library baru di luar kebutuhan yang sudah terbukti tidak terpenuhi oleh dependency existing (D-036).
- Lint/typecheck/test tooling baru (eslint, vue-tsc, dll.) — pemasangan tooling baru menunggu keputusan eksplisit (tetap terbuka, Q8).
- Approval Won berjenjang berdasarkan nilai/kompleksitas opportunity (D-032 — dipertimbangkan, tidak dipilih untuk versi pertama).
- Direktori Operations/Travelers lintas-project sebagai menu top-level (D-033 — dipertimbangkan, tidak dipilih untuk fase mockup awal).

## 7. Demo Scope

Seluruh 8 in-scope module (bagian 5) dan IA final (`docs/mockup-information-architecture.md` bagian 2–4) termasuk dalam scope demo, didukung oleh 3 skenario data utama plus skenario tambahan (`docs/mockup-data-scenarios.md`):
- Normal Project, High-Change Project, Complex Project (Prompt 0-G) — wajib.
- Skenario tambahan: empty state, overdue invoice, lost opportunity, upcoming departure, cancelled service, pending confirmation, role-restricted finance view.

Demo mencakup seluruh 11 role (bagian 3), masing-masing dengan tampilan dashboard dan akses modul sesuai `docs/route-and-role-matrix.md`.

## 8. Deferred Scope

Ditunda ke fase setelah mockup awal (bukan dihapus dari roadmap jangka panjang):
- Menu Settings versi lengkap (di luar profil minimal) — D-022.
- Direktori Operations/Travelers top-level — D-033.
- Halaman detail Quotation mandiri (`/crm/quotations/[id]`) — cukup kontekstual dari Party/Opportunity Detail untuk saat ini.
- Approval Won berjenjang nilai/kompleksitas — D-032.
- Adopsi resmi `vee-validate`+`zod` untuk form baru vs pola manual existing — masih terbuka, non-blocking (Q7).
- Kelengkapan tooling lint/typecheck/test dan nasib `@nuxtjs/eslint-config-typescript` — masih terbuka, blocking sebelum masuk fase implementasi modul (Q8).
- Nilai threshold numerik final untuk attention condition — sudah dipakai asumsi aman untuk mockup (D-040), tetap `DEFERRED` untuk validasi bisnis nyata (Q9).
- Approval Won berjenjang nilai/kompleksitas — `DEFERRED` (Q10, lihat juga D-032).
- Direktori Operations/Travelers top-level — `DEFERRED` (Q11, lihat juga D-033, duplikat referensi dengan poin kedua di atas).

## 9. Assumptions

- Seluruh dummy data adalah fiktif (nama client/vendor/user), tidak memuat informasi sensitif nyata (Prompt 0 K.13), namun tetap dirancang realistis dan konsisten lintas halaman.
- Contoh destinasi (Manila, Abu Dhabi, Palu) yang disebut Prompt 0-B dipakai sebagai inspirasi tipe-project di skenario data demo — **bukan reproduksi data project nyata milik client sungguhan**.
- `date-fns` dan `Intl.NumberFormat` (browser API bawaan, bukan package) cukup untuk kebutuhan formatting Rupiah/tanggal — tidak perlu package baru (D-037).
- Struktur folder data terpusat final (`app/data/` vs `app/constants/`) akan diputuskan bersamaan desain type definitions di tahap implementasi (D-015), bukan diasumsikan sekarang.

## 10. Constraints

Mengikuti Prompt 0 bagian H, Prompt 2 bagian J, dan Prompt 3 bagian K:
- Tidak menginstal library baru sebelum memastikan library existing tidak cukup (D-036).
- Tidak menduplikasi komponen yang sudah tersedia.
- Tidak menghapus file sebelum mapping dan dokumentasi selesai serta divalidasi — eksekusi cleanup baru terjadi di Prompt 5.
- Tidak membuat route/menu tanpa source of truth — seluruh IA final mengikuti `docs/mockup-information-architecture.md` dan `docs/route-and-role-matrix.md`.
- Tidak mengklaim fitur mockup sebagai sudah terintegrasi nyata (D-006).
- Seluruh status memakai constant/enum terpusat, bukan didefinisikan ulang per komponen (D-038).

## 11. Acceptance Criteria (Dokumentasi Sumber Kebenaran)

- 9 file dokumentasi wajib (Prompt 4-A) tersedia dan saling konsisten (lihat bagian Document Consistency Check di `docs/mockup-progress.md` entri Prompt 4).
- Tidak ada route utama yang ambigu (diwarisi dari acceptance criteria Prompt 3, tetap berlaku).
- Tidak ada menu tanpa tujuan jelas.
- Setiap keputusan penting tercatat di `docs/mockup-design-decisions.md` dengan status yang jelas.
- Tidak ada open question yang blocking terhadap **dimulainya** foundation coding (lihat `docs/mockup-open-questions.md` bagian 1: kosong). Q8 blocking sebelum masuk fase implementasi modul (harus diselesaikan di dalam fase Foundation), Q7/Q9/Q10/Q11 non-blocking/deferred.

## 12. Definition of Done — Frontend Mockup

Fase mockup MANOVA dianggap selesai (menyeluruh, bukan hanya dokumentasi) ketika:
- Seluruh 8 in-scope module (bagian 5) terimplementasi mengikuti IA dan route final, dengan data dari satu sumber terpusat (bukan hardcoded per halaman).
- 3 skenario data demo wajib + skenario tambahan (bagian 7) dapat ditampilkan tanpa data yang saling bertentangan antar halaman.
- Seluruh 11 role dapat login dan melihat dashboard/akses modul sesuai Role & Access Matrix, tanpa role yang menyebabkan crash atau halaman kosong tak terduga.
- Build (`npm run build`) sukses; lint/typecheck/test dijalankan sesuai script yang tersedia pada saat itu (Prompt 0 aturan teknis #15).
- Tidak ada klaim integrasi nyata di UI mana pun (label, tooltip, atau teks yang mengklaim koneksi API sungguhan).
- Dokumentasi (`docs/*.md`) tetap sinkron dengan kondisi kode aktual di setiap akhir tahap.

## 13. Penegasan Eksplisit (Prompt 4-B)

- **Ini frontend mockup** — bukan sistem produksi, dummy data seluruhnya (D-005).
- **Dummy data terpusat** — satu sumber data untuk seluruh halaman/widget, bukan literal per file (D-013).
- **Tidak ada klaim integrasi nyata** — dilarang eksplisit (D-006).
- **Opportunity Won membuat Project** — otomatis, bukan alur manual terpisah (D-002).
- **Party menjadi source untuk Prospect dan Client** — satu master data, dibedakan `lifecycleStatus` (D-001/D-024).
- **Seluruh role digunakan pada demo** — 11 role tanpa kecuali (D-003).
- **Template existing harus direuse** — layout, sidebar, primitive `ui/*`, pola table/wizard/kanban/chart existing dipakai ulang, bukan dibangun dari nol (D-008, D-035).

---

## Riwayat Perubahan Dokumen (bukan dihapus, dicatat sebagai jejak)

- **Prompt 2:** versi awal — scope hasil gap analysis, 10 area kerja dengan Operations/Traveler sebagai phase tersendiri (kandidat menu top-level, masih open question).
- **Prompt 3:** area kerja disesuaikan jadi 8 (Operations/Traveler melebur ke Project Detail), seluruh open question Q1–Q6 dicatat sebagai resolved.
- **Prompt 4 (dokumen ini):** direstrukturisasi lengkap dengan Product Objective, Business Context, Primary Users, B2B/B2C, Assumptions, Constraints, Non-Goals, Acceptance Criteria, dan Definition of Done sesuai Prompt 4 bagian B; seluruh referensi keputusan diperbarui ke format `D-0NN`.
