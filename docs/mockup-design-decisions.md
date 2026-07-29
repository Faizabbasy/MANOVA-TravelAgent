# Mockup Design Decisions — MANOVA

Status dokumen: log keputusan kumulatif lintas tahap. Setiap entri memiliki status `LOCKED`, `PROPOSED`, `NEEDS_VALIDATION`, atau `DEFERRED`, beserta alasan. Entri tidak dihapus meski status berubah — perubahan status dicatat sebagai entri baru yang mereferensikan entri lama.

---

## Diwarisi dari Prompt 0 (status LOCKED)

Keputusan berikut sudah dikunci user di tahap konteks bisnis (Prompt 0 bagian C) dan dipakai sebagai constraint gap analysis Prompt 2. Dicatat ulang di sini agar satu dokumen ini jadi source of truth keputusan, bukan tersebar di prompt asal.

1. **[LOCKED]** Client dan Prospect menggunakan satu master data pihak/customer (Party/Customer Account) dengan lifecycle/status yang membedakan keduanya, bukan dua entitas terpisah.
   - Alasan: keputusan eksplisit user di Prompt 0, untuk menghindari duplikasi data pihak yang sama saat prospect menjadi client.
2. **[LOCKED]** Opportunity yang berubah menjadi Won otomatis membuat Project.
   - Alasan: baseline alur bisnis MANOVA (Prompt 0-C), tidak ada jalur "buat project manual" sebagai default.
3. **[LOCKED]** Seluruh role akan digunakan saat demo (tidak ada role yang di-skip pada skenario demo).
   - Alasan: eksplisit dari user, berdampak langsung ke desain RBAC (harus mencakup 11 role minimum Prompt 0-E).
4. **[LOCKED]** Hak mengubah Opportunity menjadi Won mengikuti role/permission yang direkomendasikan berdasarkan audit dan kebutuhan operasional — tidak boleh hardcode tanpa didokumentasikan.
   - Alasan: user meminta rekomendasi berbasis analisis, bukan asumsi sepihak.
5. **[LOCKED]** Sistem saat ini adalah frontend mockup dummy data; tidak ada backend nyata yang perlu dipertahankan.
   - Alasan: dikonfirmasi ulang oleh audit Prompt 1 — tidak ditemukan integrasi API/backend nyata di codebase existing.
6. **[LOCKED]** Tidak boleh mengarang integrasi airline/hotel/payment gateway/WhatsApp API/vendor API nyata, dan tidak boleh mengklaim fitur mockup sebagai sudah terintegrasi.
   - Alasan: eksplisit dari user (Prompt 0-C), untuk menghindari miskomunikasi ke stakeholder saat demo.

---

## Keputusan Baru dari Gap Analysis (Prompt 2)

Seluruh keputusan berikut berstatus **PROPOSED** — merupakan rekomendasi hasil analisis reuse, belum divalidasi/dikunci oleh user. Akan dinaikkan ke `LOCKED` di Prompt 3 setelah dikonfirmasi, atau direvisi bila user tidak setuju.

7. **[PROPOSED]** Kategori reuse untuk 9 route existing mengikuti tabel di `docs/template-reuse-mapping.md` bagian C (mis. `/projects/:id` → `REUSE_LAYOUT_REPLACE_CONTENT`, `/login` → `REUSE_COMPONENTS`, dst.).
   - Alasan: didasarkan pada tingkat kematangan pola interaksi vs seberapa domain-specific isi komponennya (lihat detail per baris di mapping matrix).
   - Cara menerapkan: dipakai sebagai starting point Prompt 3 saat menentukan IA/route final; boleh direvisi bila ditemukan konteks baru.
8. **[PROPOSED]** Arsitektur tab di `pages/projects/[id]/index.vue` (Overview/Kanban/Timeline/Finances/Files/Activity) dipertahankan strukturnya sebagai kerangka Project Workspace MANOVA, isi diganti total per domain.
   - Alasan: ini aset reuse struktural paling bernilai di seluruh codebase (kompleksitas tertinggi, interaksi paling matang: drag-drop kanban, chart, file list, activity log).
   - Cara menerapkan: tab tambahan (Traveler, Vendor) kemungkinan perlu ditambahkan di atas kerangka existing, bukan menggantinya.
9. **[PROPOSED]** Implementasi tab existing di Project Workspace diekstrak menjadi primitive `ui/tabs` berbasis reka-ui (saat ini reka-ui Tabs belum dibungkus jadi primitive, ditemukan Prompt 1).
   - Alasan: menghindari duplikasi logic tab di halaman lain yang akan butuh pola serupa (mis. Client detail, Vendor detail).
   - Cara menerapkan: ekstraksi dilakukan hati-hati agar tidak merusak Project Workspace yang sudah kompleks (lihat risiko di mapping bagian D).
10. **[PROPOSED]** Status-badge (project status, task status/priority, invoice/payment status, dll.) memakai satu wrapper/mapping warna terpusat, bukan didefinisikan ulang per komponen seperti pola lama (`ProjectsTable`, `TasksOverview`, `StatsCard` saat ini masing-masing punya peta warna sendiri).
    - Alasan: mencegah drift taksonomi status yang sudah terjadi di template existing (dicatat di audit Prompt 1 bagian 8).
    - Cara menerapkan: satu sumber enum + mapping warna, dipakai lintas modul.
11. **[PROPOSED]** `dashboard/BudgetChart.vue` menjadi basis komponen "Budget vs Actual" MANOVA, direfactor jadi props-driven per-project (bukan single global dataset seperti sekarang), sekaligus memperbaiki bug `console.log` tertinggal dan non-reaktifnya warna tema.
    - Alasan: ini satu-satunya komponen chart existing yang konsepnya sudah 1:1 cocok dengan kebutuhan MANOVA (Prompt 0-F: "Budget versus actual cost").
12. **[PROPOSED]** Pola table+filter+search+modal+toast di `pages/expenses.vue` dijadikan acuan/basis untuk komponen Invoice table dan Traveler table baru (bukan dibangun dari nol), setelah bug `handleDelete` diperbaiki.
    - Alasan: ini pola interaksi paling matang di codebase (audit Prompt 1 bagian 10).
13. **[PROPOSED]** Data dummy lintas dashboard-widget dan lintas-page dipindahkan ke satu modul data terpusat sebelum modul MANOVA baru dibangun di atasnya (lokasi eksak — `app/data/` vs `app/constants/` — DEFERRED ke Prompt 3/implementasi).
    - Alasan: mengonfirmasi peringatan Prompt 0-G soal data yang harus "berasal dari satu source yang terpusat", dan temuan Prompt 1 soal Project/Task/Expense yang punya 2–3 shape tidak sinkron.
14. **[PROPOSED]** ID entitas MANOVA memakai skema string bergaya bisnis (mengikuti pola `PRJ-001` yang sudah sebagian ada), bukan `Date.now()` atau campuran number/string seperti pola lama.
    - Alasan: `Date.now()` rawan collision (ditemukan di 2 tempat existing) dan tipe `id` yang campur-aduk mempersulit reuse antar halaman.
    - Status detail skema final: **DEFERRED** — hanya prinsip umum yang dikunci di sini, format detail per entitas menyusul saat implementasi.

## Keputusan yang Sengaja Ditunda (DEFERRED)

15. **[DEFERRED]** Lokasi persis modul data terpusat (`app/data/` vs `app/constants/` vs kombinasi keduanya sesuai Prompt 0 aturan teknis #5–6).
    - Alasan ditunda: keputusan struktur folder lebih tepat diambil bersamaan dengan desain type definitions di Prompt 3/implementasi, bukan di tahap gap analysis murni dokumentasi.
16. **[DEFERRED]** Format ID final per entitas (mis. apakah Traveler pakai prefix `TRV-`, Vendor pakai `VND-`, dst.)
    - Alasan ditunda: baru relevan saat type definitions benar-benar dirancang.
17. **[DEFERRED]** Nasib teknis duplikasi `app/lib/utils.ts` vs `app/utils/cn.ts`, dan `DialogContent.vue` vs `DialogScrollContent.vue`.
    - Alasan ditunda: perubahan ini menyentuh kode yang dipakai luas (`cn()` dipanggil hampir di semua komponen) — lebih aman diputuskan bersamaan dengan mulai fase implementasi, bukan sebagai keputusan dokumentasi berdiri sendiri.

## Keputusan yang Butuh Validasi User (NEEDS_VALIDATION) — status pada akhir Prompt 2

Lihat `docs/mockup-open-questions.md` untuk daftar lengkap dengan konteks masing-masing. Ringkasan singkat (detail tidak diduplikasi di sini):
- Fungsi final wizard `/projects/create` vs alur LOCKED Opportunity→Project otomatis.
- Scope `Tasks` top-level vs Kanban tab Project Workspace.
- Operations & Travelers: menu top-level atau sub-tab.
- Nasib 9 dead link sidebar dan menu `Settings`.
- Nasib `dashboard/AIAssistant.vue`.

**Catatan:** seluruh 5 poin di atas **diresolusi pada Prompt 3** (lihat bagian baru di bawah, entri #18–#29). Poin di atas dipertahankan apa adanya sebagai jejak keputusan (bukan dihapus), sesuai aturan "entri tidak dihapus meski status berubah."

---

## Keputusan Baru dari Finalisasi IA/Route/Role/Workflow (Prompt 3)

Prompt 3 secara eksplisit meminta "finalisasikan rancangan" — berbeda dari Prompt 2 yang murni gap analysis. Karena itu, seluruh keputusan berikut berstatus **LOCKED** (bukan PROPOSED), kecuali ditandai lain. Ini adalah keputusan desain/IA, bukan keputusan yang menyentuh kode aplikasi — kode tetap belum diubah pada tahap ini.

18. **[LOCKED]** Resolusi Q1 (nasib `/projects/create`): wizard 3-langkah existing **tidak lagi menjadi entry point mandiri** "buat project manual". Project hanya lahir otomatis dari Opportunity Won (konsisten dengan keputusan #2). Pola wizard/stepper-nya direpurpose sebagai bagian tampilan konfirmasi/setup awal Project yang muncul otomatis setelah Won disetujui.
    - Alasan: entry point manual independen berlawanan langsung dengan keputusan LOCKED #2; me-repurpose pola (bukan membuang) tetap memenuhi prinsip reuse Prompt 0.
    - Detail lengkap: `docs/route-and-role-matrix.md` bagian 2.
19. **[LOCKED]** Resolusi Q2 (`Tasks`): tidak menjadi menu top-level. Task management terjadi di dalam tab "Tasks" pada Project Detail (basis: Kanban tab existing di `projects/[id]/index.vue`). Visibilitas lintas-project cukup lewat widget dashboard, bukan halaman/menu tersendiri.
    - Alasan: mencegah duplikasi konsep task di dua tempat dengan shape data berbeda (temuan audit Prompt 1).
20. **[LOCKED]** Resolusi Q3 (Operations & Travelers): **keduanya tidak menjadi menu top-level.** Operations melebur jadi tab "Itinerary & Services" (dengan sub-section kondisional per tipe layanan project), Travelers melebur jadi tab "Travelers" — keduanya di dalam Project Detail. Vendor **tetap** jadi menu top-level (`/vendors`) karena secara alami melayani banyak project sekaligus, berbeda karakteristik dari Operations/Travelers yang inheren single-project-scoped.
    - Alasan: menghindari menu global yang kosong/tipis di fase mockup awal (tidak ada kebutuhan eksplisit Prompt 0 untuk direktori operasional/traveler lintas-project saat ini); Vendor dipertahankan karena kebutuhan reuse vendor lintas-project punya dasar bisnis nyata.
    - Detail lengkap: `docs/mockup-information-architecture.md` bagian 3.4, 3.5, 3.6.
21. **[LOCKED]** Resolusi Q4 (9 dead link sidebar): `/clients`→`/crm/clients`, `/invoices`→`/finance/invoices`, `/reports`→`/reports`, `/files`→tab Documents di Project Detail, `/team`→`/admin/users` + info tim di tab Overview, `/time-tracking`/`/templates`/`/integrations`→excluded (tidak dilanjutkan).
    - Alasan per item: lihat `docs/route-and-role-matrix.md` bagian 1.8 dan `docs/mockup-information-architecture.md` bagian 6.3.
22. **[LOCKED]** Resolusi Q5 (`Settings`): dipertahankan dalam skema minimal (profil/akun pribadi), diakses lewat popover profil user (pola existing `AppSidebar.vue`), **bukan** item sidebar utama.
    - Alasan: isi saat ini tidak cukup substansial untuk jadi menu top-level tersendiri; menghindari "menu tanpa tujuan jelas" (instruksi eksplisit Prompt 2-F).
23. **[LOCKED]** Resolusi Q6 (`dashboard/AIAssistant.vue`): tidak dilanjutkan sebagai bagian desain dashboard MANOVA (tidak ada mapping domain di Prompt 0 manapun). **Catatan penting:** ini keputusan IA/desain, bukan eksekusi hapus file — penghapusan fisik tetap menunggu tahap cleanup (Prompt 5), sesuai batasan "jangan menghapus file" pada tahap ini.
24. **[LOCKED]** Party/Prospect/Client memakai model satu record `Party` dengan field `lifecycleStatus` (`Prospect`|`Client`) — bukan dua entity/tabel independen. Transisi `Prospect`→`Client` terjadi otomatis saat opportunity milik party tsb menjadi Won.
    - Alasan: merinci keputusan LOCKED #1 Prompt 0 menjadi model UI konkret; mencegah pola "banyak shape untuk satu konsep" seperti Project/Task/Expense di template lama.
    - Detail lengkap: `docs/mockup-information-architecture.md` bagian 5.
25. **[LOCKED]** Alur Opportunity→Won memakai model approval dua-langkah: Sales mengajukan ("Submit as Won" / stage internal `WonRequested`), Management atau Super Admin menyetujui (aksi yang benar-benar mengeksekusi pembuatan Project).
    - Alasan: daftar role Prompt 3-H tidak menyediakan role "Sales Manager" terpisah; model ini memakai role yang sudah ada (Management) tanpa mengarang role baru, sekaligus tetap merepresentasikan "approval oleh pihak selain Sales" sesuai instruksi Prompt 3-E.
    - Model alternatif (approval berjenjang berdasarkan nilai/kompleksitas) dipertimbangkan tapi **tidak dipilih** untuk versi pertama karena menambah kompleksitas tanpa dasar threshold yang jelas di Prompt 0 — dicatat sebagai kemungkinan evolusi, bukan dibuang.
    - Detail lengkap: `docs/route-and-role-matrix.md` bagian 2.3.
26. **[LOCKED]** Project Detail dikonsolidasikan dari 6 tab existing (Overview/Kanban/Timeline/Finances/Files/Activity) menjadi **8 tab baru**: Overview, Itinerary & Services, Travelers, Vendors, Finance, Tasks, Documents, Activity & Changes.
    - Alasan konsolidasi: 16 kandidat area di Prompt 3-C digabung berdasarkan konteks yang sama (mis. Flight/Hotel/Transportation/MICE/Timeline → satu tab "Itinerary & Services" dengan sub-section kondisional; Changes+Activity → satu tab dengan filter toggle, karena berasal dari satu sumber log yang sama).
    - Detail lengkap: `docs/mockup-information-architecture.md` bagian 4.
27. **[LOCKED]** Tab-tab Project Detail tetap berada dalam **satu route** `/projects/[id]` dengan state tab di sisi client (deep-link via query param), **bukan** nested route per tab meski dicontohkan sebagai opsi di Prompt 3-B.
    - Alasan: mempertahankan pola coding existing yang sudah sehat (`projects/[id]/index.vue` sudah begitu) dan menghindari overengineering untuk tahap mockup (Prompt 0 aturan teknis #3 dan #7).
28. **[LOCKED]** Project status final: Draft, Planning, Confirmed, In Progress, Ongoing Trip, Completed, On Hold, Cancelled — dengan transisi linear maju + cabang On Hold/Cancelled dari status non-terminal manapun.
    - Detail lengkap termasuk badge warna dan attention condition: `docs/route-and-role-matrix.md` bagian 3.
29. **[LOCKED]** Service status generik (Flight/Hotel/Transportation/MICE) memakai satu lifecycle yang sama: Not Started → Sourcing → Quoted → Pending Confirmation → Confirmed → (Changed ⇄ Confirmed) → Completed, dengan Cancelled sebagai cabang terminal dari status non-terminal manapun. Perbedaan antar jenis layanan cukup lewat field tambahan (subtype-specific field), bukan status set berbeda.
    - Alasan: eksplisit sesuai instruksi Prompt 3-G untuk menghindari status yang berbeda total per jenis layanan.
    - Detail lengkap: `docs/route-and-role-matrix.md` bagian 4.
30. **[LOCKED]** Role & Access Matrix memakai 5 access level (`NONE`/`VIEW`/`MANAGE`/`APPROVE`/`ADMIN`) pada granularity modul (CRM/Project/Vendor/Finance/Reports/Administration), bukan granularity field — kecuali untuk role sub-domain (Ticketing/Accommodation/Transportation/MICE) yang memang didefinisikan Prompt 0-E scoped ke satu sub-section layanan.
    - Detail lengkap: `docs/route-and-role-matrix.md` bagian 5.
31. **[LOCKED]** Dashboard memakai satu komponen dengan widget kondisional per role (bukan dashboard/route terpisah per role).
    - Detail lengkap: `docs/route-and-role-matrix.md` bagian 6.

## Keputusan yang Masih Dipertimbangkan, Belum Dipilih (dicatat sebagai alternatif, bukan open question baru)

32. **[DEFERRED]** Approval Won berjenjang berdasarkan nilai/kompleksitas opportunity (lihat entri #25) — bisa dievaluasi lagi setelah ada data threshold nyata dari bisnis, bukan diasumsikan sekarang.
33. **[DEFERRED]** Direktori Operations/Travelers lintas-project sebagai menu top-level (lihat entri #20) — dipertimbangkan lagi bila kebutuhan agregasi lintas-project benar-benar tervalidasi di fase setelah mockup awal.
