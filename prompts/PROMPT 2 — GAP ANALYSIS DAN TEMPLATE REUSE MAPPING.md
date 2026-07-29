Gunakan konteks MANOVA dan hasil audit codebase sebelumnya.

Pada tahap ini, buat gap analysis antara template existing dan kebutuhan sistem Travel Agent MANOVA. Fokus utama adalah menentukan reuse strategy. Jangan mulai implementasi, jangan melakukan rename massal, dan jangan menghapus file.

==================================================
A. TUJUAN
==================================================

Tentukan bagaimana setiap halaman, fitur, komponen, data model, route, dan navigation item pada template dapat:

- Direuse apa adanya.
- Diadaptasi.
- Diganti kontennya dengan struktur tetap dipertahankan.
- Dipertahankan sementara.
- Dihapus pada tahap cleanup.
- Membutuhkan komponen baru.

==================================================
B. DOMAIN MAPPING
==================================================

Analisis potensi mapping template ke domain berikut:

CRM:
- Lead.
- Prospect.
- Client.
- Contact Person.
- Opportunity.
- Activity.
- Quotation.

Project:
- Project list.
- Project detail.
- Project overview.
- Timeline.
- Task.
- Milestone.
- Change history.
- Document.
- Notes.
- Team.

Operations:
- Itinerary.
- Flight.
- Hotel.
- Transportation.
- MICE.
- Additional service.
- Booking status.
- Operational task.

Traveler:
- Participant.
- Traveler profile.
- Group.
- Rooming list.
- Travel document.
- Special request.

Vendor:
- Vendor.
- Vendor quotation.
- Service offering.
- Vendor contact.

Finance:
- Budget.
- Estimated cost.
- Actual cost.
- Invoice.
- Payment.
- Outstanding.
- Margin summary.

Administration:
- User.
- Role.
- Permission.
- Master data.
- Audit trail.
- Notification.

==================================================
C. MAPPING MATRIX
==================================================

Buat tabel mapping dengan kolom minimum:

- Existing route.
- Existing page or feature.
- Existing purpose.
- Existing main components.
- Proposed MANOVA module.
- Proposed MANOVA route.
- Reuse category.
- Required adaptation.
- Data impact.
- Navigation impact.
- Risk.
- Recommended action.
- Execution phase.

Gunakan kategori reuse berikut secara konsisten:

- `REUSE_AS_IS`
- `REUSE_COMPONENTS`
- `REUSE_LAYOUT_REPLACE_CONTENT`
- `ADAPT`
- `KEEP_TEMPORARILY`
- `REPLACE`
- `REMOVE_AFTER_VALIDATION`
- `NEW_REQUIRED`

==================================================
D. COMPONENT REUSE MATRIX
==================================================

Buat mapping komponen existing terhadap kebutuhan MANOVA.

Contoh kebutuhan yang harus dianalisis:

- KPI card.
- Opportunity pipeline.
- Project table.
- Project status badge.
- Upcoming departure.
- Attention list.
- Client detail.
- Opportunity stage.
- Project tabs.
- Itinerary timeline.
- Service summary.
- Traveler table.
- Vendor quotation comparison.
- Budget versus actual.
- Invoice table.
- Payment status.
- Change log.
- Activity feed.
- Role matrix.
- Empty/loading/error states.

Untuk setiap kebutuhan, tentukan:

- Komponen existing yang bisa dipakai.
- Apakah perlu wrapper.
- Apakah perlu variant baru.
- Apakah perlu komponen baru.
- Apakah komponen terlalu spesifik ke domain lama.
- Apakah perubahan berisiko merusak halaman existing.

==================================================
E. DATA MODEL GAP
==================================================

Bandingkan data existing dengan entitas MANOVA.

Buat daftar:

- Type yang dapat direuse.
- Type yang perlu digeneralisasi.
- Type yang perlu diganti.
- Type baru yang dibutuhkan.
- Status dan enum baru.
- Relasi penting.
- Data yang harus terpusat.
- Data yang tidak boleh lagi berada langsung di page.
- ID dan reference yang harus konsisten.
- Data scenario yang harus mendukung tiga tipe project demo.

Jangan implementasikan type pada tahap ini.

==================================================
F. NAVIGATION GAP
==================================================

Bandingkan sidebar/header existing dengan kebutuhan MANOVA.

Susun rekomendasi menu sementara:

- Dashboard.
- CRM.
- Projects.
- Operations.
- Travelers.
- Vendors.
- Finance.
- Reports.
- Master Data.
- User & Role Management.
- Settings bila memang dibutuhkan.

Jangan membuat semua item hanya karena tersedia dalam daftar. Evaluasi kebutuhan fase mockup dan hindari menu kosong.

==================================================
G. FITUR YANG TIDAK RELEVAN
==================================================

Untuk setiap candidate removal:

- Jelaskan alasan tidak relevan.
- Jelaskan apakah ada komponen di dalamnya yang masih reusable.
- Periksa dependensi route, component, store, middleware, atau navigation.
- Tentukan apakah aman dihapus, cukup disembunyikan, atau dipertahankan sementara.
- Jangan menghapus pada tahap ini.

==================================================
H. OUTPUT DOKUMENTASI
==================================================

Buat atau update:

1. `docs/template-reuse-mapping.md`
2. `docs/mockup-scope.md`
3. `docs/mockup-design-decisions.md`
4. `docs/mockup-open-questions.md`
5. `docs/mockup-progress.md`

Aturan:

- Jangan menghapus isi existing yang masih valid.
- Setiap keputusan harus memiliki alasan.
- Setiap asumsi harus ditandai sebagai asumsi.
- Setiap hal yang belum pasti harus masuk open questions.
- Jangan mencatat keputusan sebagai final bila belum divalidasi.
- Gunakan status: `LOCKED`, `PROPOSED`, `NEEDS_VALIDATION`, atau `DEFERRED`.

==================================================
I. REKOMENDASI PHASING
==================================================

Susun urutan adaptasi template:

- Foundation.
- CRM.
- Opportunity to Project.
- Project Management.
- Operations.
- Traveler.
- Vendor.
- Finance.
- Reporting.
- Administration.
- Regression and demo readiness.

Untuk setiap phase, tuliskan:

- Scope.
- Route.
- Main components.
- Reuse target.
- Data dependency.
- Exit criteria.

==================================================
J. BATASAN
==================================================

- Jangan mengubah kode aplikasi.
- Jangan menghapus file.
- Jangan mengubah route.
- Jangan mengubah sidebar.
- Jangan membuat halaman baru.
- Jangan memasang package.
- Jangan mengerjakan implementation.
- Jangan mengarang fitur di luar konteks.
- Jangan menyederhanakan mapping hanya berdasarkan nama halaman.

Pada akhir pekerjaan, tampilkan ringkasan:

- Jumlah fitur per reuse category.
- Top reusable assets.
- Top removal candidates.
- Gap paling besar.
- Risiko utama.
- Keputusan yang perlu dikunci pada tahap berikutnya.

Setelah itu berhenti.