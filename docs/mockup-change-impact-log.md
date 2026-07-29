# Mockup Change Impact Log — MANOVA

Log **append-only**, wajib diperbarui setiap kali sebuah section mengubah hasil section sebelumnya, sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian A dan C. Histori lama tidak dihapus atau ditimpa.

Setiap entri wajib memuat: Change ID dan tanggal · Triggering section · Previous section affected · Alasan perubahan · Files affected · Previous behavior dan new behavior · Risk · Regression checks · Dokumentasi yang diperbarui.

---

## CI-001 — Eksekusi Penghapusan `AIAssistant.vue` sesuai Keputusan D-023

- **Change ID / Tanggal:** CI-001 · 2026-07-29
- **Triggering section:** Section 05 — Bersihkan Template dan Siapkan Foundation (eksekusi kode).
- **Previous section affected:** Section 03 — Information Architecture, Route, Role, dan Workflow (pemilik keputusan D-023: "penghapusan fisik `dashboard/AIAssistant.vue` menunggu tahap cleanup Prompt 5, tidak dieksekusi sekarang").
- **Alasan perubahan:** Section 03 secara eksplisit menunda eksekusi fisik keputusan ke Section 05 (keputusan itu sendiri murni dokumentasi, tidak mengubah kode). Section 05 adalah section pertama yang benar-benar mengeksekusi keputusan tersebut sebagai perubahan kode.
- **Files affected:** `app/components/dashboard/AIAssistant.vue` (dihapus), `app/pages/index.vue` (satu-satunya pemanggil komponen ini, ditulis ulang total pada Section 05 sehingga referensi lama otomatis tidak ada).
- **Previous behavior:** Dashboard lama merender `AIAssistant.vue` sebagai widget statis tanpa mapping domain MANOVA apa pun.
- **New behavior:** Dashboard baru (Section 05) tidak lagi memiliki widget AI Assistant; seluruh widget berbasis fixture domain MANOVA (opportunity, project, invoice, activity).
- **Risk:** Rendah — dependency check (`grep` lintas `app/`) mengonfirmasi hanya `pages/index.vue` lama yang merender komponen ini, dan halaman tersebut sudah ditulis ulang total pada section yang sama sehingga tidak ada pemanggil yang tertinggal.
- **Regression checks:** `npm run build` sukses setelah penghapusan (dijalankan 3x pada Section 05); smoke test manual route `/` menunjukkan HTTP 200 tanpa error konsol terkait komponen hilang.
- **Dokumentasi yang diperbarui:** `docs/mockup-progress.md` (Entri 6), `docs/mockup-design-decisions.md` (D-023, status tetap LOCKED, catatan eksekusi ditambahkan), `docs/mockup-section-reports/section-05-foundation.md`.

---

## CI-002 — Perluasan Fixture Opportunity/Quotation/Task untuk Widget Dashboard

- **Change ID / Tanggal:** CI-002 · 2026-07-29
- **Triggering section:** Section 06 — Dashboard.
- **Previous section affected:** Section 05 — Foundation (pemilik fixture `app/data/opportunities.ts` dan `app/data/activity.ts`).
- **Alasan perubahan:** Seluruh 4 Opportunity dari Section 05 (`OPP-001`–`004`) sudah berstatus final (`Won`/`Lost`), sehingga widget "Opportunity Pipeline" dan "Quotations Menunggu Keputusan" (scope eksplisit Prompt 6) tidak akan pernah punya data untuk ditampilkan. Task fixture juga hanya punya 2 task overdue, tidak ada yang "akan datang" (belum overdue), sehingga widget "Milestone/Task Mendatang" (Project Manager) juga akan selalu kosong. Kedua kondisi ini bukan bug Section 05 (skenario aslinya memang dirancang seputar 3 project yang sudah Won), tapi menjadi gap nyata begitu Dashboard mencoba memvisualisasikan pipeline/upcoming-task yang docs-nya (`docs/route-and-role-matrix.md` bagian 6) secara eksplisit meminta widget tsb ada.
- **Files affected:** `app/data/opportunities.ts` (+`OPP-005`, `OPP-006`, `OPP-007`, +`QUO-005`, `QUO-006`), `app/data/activity.ts` (+`TSK-1023`, +`TSK-1035`).
- **Previous behavior:** `OPPORTUNITIES`/`QUOTATIONS`/`TASKS` hanya berisi data 3 skenario utama (Normal/High-Change/Complex) + 1 Lost Opportunity; seluruhnya sudah dalam status akhir/tidak ada task mendatang.
- **New behavior:** Tiga baris Opportunity baru dalam stage terbuka (`negotiation`, `proposal`, `qualification`) dan dua Task baru dengan `dueAt` di masa depan ditambahkan — array existing tidak diubah/dihapus, murni penambahan (append), mengikuti pola ID dan shape yang sama persis dengan data existing.
- **Risk:** Rendah. Tidak ada data existing yang diubah atau dihapus; ID baru tidak bentrok dengan ID existing manapun; halaman yang sudah memakai `OPPORTUNITIES`/`TASKS` (`/crm/opportunities`, dashboard, dll.) hanya akan menampilkan baris tambahan ini sebagai data baru yang valid.
- **Regression checks:** `npm run build` sukses setelah penambahan; `/crm/opportunities` (yang sudah membaca fixture `OPPORTUNITIES` sejak Section 05) diperiksa masih menampilkan seluruh 7 opportunity tanpa error (halaman tsb belum py filter/UI khusus untuk stage baru — akan disempurnakan Section 08).
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4a baru + checklist ID bagian 7), `docs/route-and-role-matrix.md` (bagian 6, catatan implementasi Section 06), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-06-dashboard.md`.

## CI-003 — Adaptasi Komponen Dashboard dan Rewrite Halaman Dashboard Section 05

- **Change ID / Tanggal:** CI-003 · 2026-07-29
- **Triggering section:** Section 06 — Dashboard.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/pages/index.vue` shell, dan pemilik keputusan eksplisit untuk *tidak* menghapus/mengadaptasi `BudgetChart.vue`/`ExpenseCategories.vue`/`RecentActivity.vue` sampai section yang membutuhkannya).
- **Alasan perubahan:** Section 05 secara eksplisit mencadangkan 6 komponen dashboard lama (kategori reuse `ADAPT`, bukan `REMOVE_AFTER_VALIDATION`) untuk diadaptasi "saat fase Finance/Project Management/Reporting". Section 06 (Dashboard) adalah fase pertama yang benar-benar membutuhkan 3 dari 6 komponen tsb (`BudgetChart`, `ExpenseCategories`, `RecentActivity`) untuk widget Budget vs Actual, Cost Breakdown, dan Recent Activity — sesuai scope eksplisit Prompt 6. `app/pages/index.vue` (dashboard shell Section 05) juga perlu ditulis ulang total untuk mencapai status "final" sesuai tujuan Prompt 6 ("Menyelesaikan dashboard frontend mockup").
- **Files affected:** `app/pages/index.vue`, `app/components/dashboard/BudgetChart.vue`, `app/components/dashboard/ExpenseCategories.vue`, `app/components/dashboard/RecentActivity.vue`.
- **Previous behavior:** Ketiga komponen dashboard berisi data hardcoded fiktif dalam USD (bulan fiktif, department fiktif, user/avatar fiktif dari Unsplash), tidak terhubung fixture apa pun, dan tidak dirender di halaman manapun (dicadangkan, idle). Dashboard shell (Section 05) menampilkan widget generik (Active Projects/Open Opportunities/Upcoming Departures/Attention/Outstanding/Recent Activity custom) dengan visibilitas role yang lebih longgar dari tabel `docs/route-and-role-matrix.md` bagian 6.
- **New behavior:** Ketiga komponen menerima data lewat props dan menampilkan angka Rupiah nyata dari fixture project/opportunity. Dashboard kini mengimplementasikan widget 1:1 sesuai tabel role docs bagian 6 (rincian di `docs/mockup-section-reports/section-06-dashboard.md`), ditambah filter status/tipe/client/owner/periode.
- **Risk:** Rendah–sedang. Ketiga komponen sebelumnya tidak punya consumer (idle), sehingga adaptasi propsnya tidak berisiko merusak halaman lain. `app/pages/index.vue` adalah rewrite total, tapi tetap satu route yang sama, tidak mengubah routing/layout.
- **Regression checks:** `npm run build` sukses; smoke test curl seluruh route utama tetap HTTP 200; verifikasi tekstual bundle server mengonfirmasi string widget baru ter-compile dengan benar.
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/route-and-role-matrix.md`, `docs/mockup-section-reports/section-06-dashboard.md`.

---

*(Entri berikutnya akan ditambahkan begitu sebuah section mengubah hasil section sebelumnya — lihat protokol bagian C untuk kriteria kapan perubahan section lama diperbolehkan.)*
