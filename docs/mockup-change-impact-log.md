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

## CI-004 — Fixture Party Diubah Menjadi Reactive, Entitas Baru `PartyActivity`

- **Change ID / Tanggal:** CI-004 · 2026-07-29
- **Triggering section:** Section 07 — CRM Party.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/data/parties.ts`, `app/types/party.ts`).
- **Alasan perubahan:** Scope Section 07 eksplisit meminta "create/edit frontend mock" untuk Prospect/Contact/Activity. Fixture Foundation (Section 05) adalah array biasa read-only sepanjang Section 05/06 — mutasi (`.push()`) tidak akan ter-render ulang di consumer manapun tanpa reactivity. Dibungkus `reactive()` (Vue) agar create-mock benar-benar terlihat di seluruh halaman yang membaca `PARTIES`/`CONTACTS` tanpa reload, sesuai nilai demo yang diminta scope.
- **Files affected:** `app/data/parties.ts` (`PARTIES`, `CONTACTS` dibungkus `reactive()`; `+PARTY_ACTIVITIES`), `app/types/party.ts` (`+PartyActivity`, `+PartyActivityType`, `+PartyDetailTab`), `app/data/index.ts` (+6 selector/helper terkait).
- **Previous behavior:** `PARTIES`/`CONTACTS` adalah array TypeScript biasa, hanya pernah dibaca (`.filter/.find/.map`), tidak pernah dimutasi runtime di section manapun sebelumnya.
- **New behavior:** Array yang sama, sekarang `reactive()` — method baca tetap identik (tidak ada perubahan API untuk consumer existing seperti Dashboard/`crm/index.vue`/`crm/opportunities.vue`), ditambah kemampuan `.push()` yang ter-propagate reaktif lewat helper `createParty`/`createContact`/`createPartyActivity` (`app/data/index.ts`).
- **Risk:** Rendah. Perubahan `Array` → `reactive(Array)` backward-compatible untuk seluruh operasi baca; tidak ada consumer existing yang bergantung pada array TIDAK reaktif. `createdAt` record baru memakai `DEMO_REFERENCE_DATE` tetap (bukan `new Date()`), konsisten D-040.
- **Regression checks:** `npm run build` sukses; smoke test `/`, `/crm`, `/crm/opportunities` (consumer existing `PARTIES`) tetap HTTP 200 dengan data yang sama seperti sebelumnya.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4b baru), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-07-crm-party.md`.

## CI-005 — Widget Dashboard Sales "Follow-up Mendatang" (Melengkapi Gap Section 06)

- **Change ID / Tanggal:** CI-005 · 2026-07-29
- **Triggering section:** Section 07 — CRM Party.
- **Previous section affected:** Section 06 — Dashboard (pemilik `app/pages/index.vue`).
- **Alasan perubahan:** Section 06 secara eksplisit mendeferred widget Sales "Follow-up/activity mendatang milik sendiri" karena model `PartyActivity` belum ada. Section 07 membangun model tersebut — hard rule Section 07 secara eksplisit mengizinkan "Perubahan Dashboard hanya untuk integration minimal dan wajib dicatat", sehingga mengisi gap yang sudah terdokumentasi ini termasuk scope yang diizinkan, bukan penyimpangan.
- **Files affected:** `app/pages/index.vue` (+1 computed `myUpcomingFollowUps`, +1 flag `showFollowUps`, +1 `SectionCard` widget — tidak ada bagian lain Dashboard yang diubah).
- **Previous behavior:** Sales hanya melihat 2 widget (Opportunity Pipeline, Quotations Menunggu Keputusan); widget follow-up tidak ada sama sekali (dicatat sebagai known issue).
- **New behavior:** Sales kini melihat 3 widget, termasuk "Follow-up Mendatang" berisi `PartyActivity` dengan `dueAt` dalam 14 hari ke depan milik sendiri (`ownerId`).
- **Risk:** Sangat rendah — perubahan aditif murni pada satu blok kode, tidak menyentuh widget/filter/computed lain di Dashboard.
- **Regression checks:** `npm run build` sukses; struktur Dashboard untuk role lain (Management/PM/Finance/dst.) tidak berubah sama sekali (diverifikasi lewat diff — hanya blok Sales yang bertambah).
- **Dokumentasi yang diperbarui:** `docs/route-and-role-matrix.md` (bagian 6, akan diperbarui untuk menghapus catatan "belum diimplementasikan" — lihat section report), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-06-dashboard.md` (ditandai known issue selesai) dan `section-07-crm-party.md`.

## CI-006 — `SectionCard.vue` Diperluas dengan Slot Opsional `#actions`

- **Change ID / Tanggal:** CI-006 · 2026-07-29
- **Triggering section:** Section 07 — CRM Party.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/components/shared/SectionCard.vue`).
- **Alasan perubahan:** Tab Contacts dan Activities di Party Detail butuh tombol "Tambah" di header card, sejajar dengan title. `SectionCard.vue` sebelumnya hanya punya slot default (isi card) dan prop `title`/`description` — tidak ada tempat meletakkan aksi header tanpa mendesain pola baru. Menambah slot `#actions` opsional (mengikuti pola `PageHeader.vue` yang sudah punya slot serupa) lebih konsisten daripada membuat komponen header custom baru per halaman.
- **Files affected:** `app/components/shared/SectionCard.vue`.
- **Previous behavior:** `<CardHeader>` hanya berisi `CardTitle`/`CardDescription`, tidak ada slot tambahan.
- **New behavior:** `<CardHeader>` jadi flex row (`justify-between`); slot `#actions` dirender di sisi kanan **hanya bila diisi** (`v-if="$slots.actions"`). Seluruh pemakaian `SectionCard` existing yang tidak mengisi slot ini (Dashboard, Projects, Project Detail, dll.) tidak berubah tampilannya sama sekali.
- **Risk:** Rendah — perubahan aditif, dijaga dengan `v-if` sehingga tidak ada efek visual pada consumer yang tidak memakai slot baru.
- **Regression checks:** `npm run build` sukses; smoke test seluruh route yang memakai `SectionCard` (Dashboard, `/projects`, `/projects/[id]`, `/crm/*`) tetap HTTP 200.
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-07-crm-party.md`.

## CI-007 — Fixture Opportunity/Quotation Diubah Menjadi Reactive, Field Diperluas

- **Change ID / Tanggal:** CI-007 · 2026-07-30
- **Triggering section:** Section 08 — Opportunity dan Quotation.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/data/opportunities.ts`, `app/types/opportunity.ts`), Section 06 — Dashboard (consumer `OPPORTUNITIES`/`QUOTATIONS` di beberapa widget).
- **Alasan perubahan:** Scope Section 08 eksplisit meminta stage transition, submit Won-Requested, tandai Lost/On Hold, dan create/revisi Quotation — seluruhnya mutasi runtime. Fixture Foundation adalah array biasa read-only. Field `Opportunity` juga perlu diperluas (`ownerId`, `estimatedValueIdr`, `destination`, `travelStartDate`/`travelEndDate`, `travelerEstimate`, `requirementNotes`) karena scope eksplisit meminta "Owner, value, requirement, destination, travel date, traveler estimate" ditampilkan — field ini belum ada sejak Foundation.
- **Files affected:** `app/data/opportunities.ts` (`reactive()`, 7 field baru per Opportunity, `QUO-005` versi 2), `app/types/opportunity.ts` (interface diperluas).
- **Previous behavior:** `OPPORTUNITIES`/`QUOTATIONS` array biasa, tidak pernah dimutasi; `Opportunity` hanya py `id/partyId/title/stage/createdAt/decidedAt/wonApprovedBy/lostReason/serviceScope/quotationId/projectId`.
- **New behavior:** Array yang sama, `reactive()` — method baca tetap identik untuk consumer existing (Dashboard `opportunityPipeline`/`quotationsPendingDecision`, `crm/index.vue`, Party Detail Opportunities tab). Field baru bersifat aditif (opsional untuk yang boleh kosong), tidak menghapus field lama.
- **Risk:** Rendah. Field baru aditif, tidak ada consumer existing yang destructuring in a way that would break. Dashboard's `opportunityPipeline`/`quotationsPendingDecision` computed diperiksa ulang — tetap benar karena tidak ada baris Quotation baru per opportunity (quotation tetap 1:1, hanya `version`/`supersededAmountIdr` bertambah pada row yang sama).
- **Regression checks:** `npm run build` sukses; smoke test `/`, `/crm`, `/crm/parties/PTY-004` (consumer `OPPORTUNITIES`) tetap HTTP 200 dengan data konsisten.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4c baru), `docs/route-and-role-matrix.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-08-opportunity-quotation.md`.

## CI-008 — `PartyActivity` Diperluas dengan `opportunityId` Opsional dan Backfill

- **Change ID / Tanggal:** CI-008 · 2026-07-30
- **Triggering section:** Section 08 — Opportunity dan Quotation.
- **Previous section affected:** Section 07 — CRM Party (pemilik `app/types/party.ts`, `app/data/parties.ts` — `PARTY_ACTIVITIES`).
- **Alasan perubahan:** Scope Section 08 eksplisit meminta "Activity/follow-up" di Opportunity Detail. Reuse `PartyActivity` (Section 07) alih-alih membuat entitas activity baru — sesuai prinsip "jangan menduplikasi data" — membutuhkan cara menandai activity sebagai milik satu opportunity spesifik.
- **Files affected:** `app/types/party.ts` (`+opportunityId?` pada `PartyActivity`), `app/data/parties.ts` (backfill `opportunityId` pada `PACT-002`, `PACT-003`, `PACT-004` → `OPP-005`; `PACT-005` → `OPP-006`), `app/data/index.ts` (`createPartyActivity` menerima `opportunityId` opsional, `+getPartyActivitiesByOpportunity`).
- **Previous behavior:** `PartyActivity` hanya terikat `partyId`; 6 seed record dari Section 07 tidak punya konsep keterkaitan opportunity.
- **New behavior:** Field opsional, backward-compatible — 2 dari 6 record (PACT-001, PACT-006) tetap tanpa `opportunityId` (activity umum level-party, bukan spesifik opportunity). Tab Activities Party Detail tidak berubah (masih menampilkan semua activity milik party); Opportunity Detail menampilkan subset yang relevan.
- **Risk:** Rendah — field opsional, tidak ada consumer yang bergantung pada field ini tidak ada.
- **Regression checks:** `npm run build` sukses; smoke test `/crm/parties/PTY-004` (Activities tab, consumer `PARTY_ACTIVITIES`) tetap HTTP 200.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-08-opportunity-quotation.md`.

## CI-009 — Party Detail Opportunities Tab Ditaut ke Opportunity Detail

- **Change ID / Tanggal:** CI-009 · 2026-07-30
- **Triggering section:** Section 08 — Opportunity dan Quotation.
- **Previous section affected:** Section 07 — CRM Party (pemilik `app/pages/crm/parties/[id]/index.vue`).
- **Alasan perubahan:** Section 07 secara eksplisit mencatat tab Opportunities Party Detail sebagai "read-only, belum ada link, menunggu Section 08" (lihat protection notes `section-07-crm-party.md`). Section 08 membangun halaman detail yang dimaksud, sehingga integrasi cross-link ini adalah pekerjaan yang sudah direncanakan, bukan penyimpangan.
- **Files affected:** `app/pages/crm/parties/[id]/index.vue` (baris tabel Opportunities kini `@click` menavigasi ke `/crm/opportunities/[id]`).
- **Previous behavior:** Baris opportunity di tab ini statis, tidak bisa diklik.
- **New behavior:** Baris opportunity bisa diklik, menavigasi ke Opportunity Detail (pola identik dengan baris Prospects/Clients/Opportunities list yang sudah ada).
- **Risk:** Sangat rendah — perubahan aditif satu baris (`class`+`@click`), tidak mengubah data/struktur tab lain.
- **Regression checks:** `npm run build` sukses; smoke test `/crm/parties/PTY-001`, `/crm/parties/PTY-004` tetap HTTP 200.
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-07-crm-party.md` (protection note ditandai selesai), `section-08-opportunity-quotation.md`.

## CI-010 — Fixture Project/Activity Diubah Menjadi Reactive, Field `sourceQuotationId` Ditambahkan

- **Change ID / Tanggal:** CI-010 · 2026-07-30
- **Triggering section:** Section 09 — Opportunity Won to Project.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/data/projects.ts`, `app/data/activity.ts`, `app/types/project.ts`).
- **Alasan perubahan:** Approve Won harus mendorong Project baru ke `PROJECTS` dan entri log ke `ACTIVITIES` secara runtime, terlihat seketika di `/projects`, Dashboard, dan Party Detail. `Project.sourceQuotationId` disebut eksplisit di checklist LOCKED (`docs/route-and-role-matrix.md` bagian 2.2 item 6) tapi belum ada di type sejak Foundation.
- **Files affected:** `app/data/projects.ts` (`reactive()`), `app/data/activity.ts` (`reactive()`), `app/types/project.ts` (`+sourceQuotationId?`).
- **Previous behavior:** `PROJECTS`/`ACTIVITIES` array biasa, tidak pernah dimutasi sejak Section 05; `Project` tidak punya referensi eksplisit ke quotation asal.
- **New behavior:** Array yang sama, `reactive()` — method baca (dipakai luas oleh Dashboard/Projects list/Project Detail/Party Detail) tetap identik. Field baru bersifat opsional/aditif.
- **Risk:** Rendah. Konsumen existing (Dashboard, `/projects`, Project Detail, Party Detail Projects tab) hanya membaca array ini — tidak ada yang bergantung pada array TIDAK reaktif. Field baru opsional, tidak breaking untuk 3 project existing yang tidak mengisinya.
- **Regression checks:** `npm run build` sukses; smoke test `/`, `/projects`, `/projects/PRJ-101`, `/crm/parties/PTY-001` (konsumen `PROJECTS`) tetap HTTP 200 dengan data tidak berubah (masih 3 project sebelum aksi Approve Won benar-benar diklik).
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4d baru), `docs/route-and-role-matrix.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.

## CI-011 — Toast Global Diekstrak dari Pola Lokal `pages/expenses.vue`

- **Change ID / Tanggal:** CI-011 · 2026-07-30
- **Triggering section:** Section 09 — Opportunity Won to Project.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/layouts/dashboard.vue`; `pages/expenses.vue` adalah aset template lama, bukan hasil section manapun, tapi Section 05 mencatatnya sebagai "pola toast akan direuse").
- **Alasan perubahan:** Scope Section 09 eksplisit meminta "Success/error feedback". `expenses.vue` punya implementasi toast lokal (state+markup ~50 baris) yang tidak dipakai halaman lain. Alih-alih duplikasi, diekstrak jadi composable (`useToast`) + shared component (`ToastContainer`), dipasang sekali di layout.
- **Files affected:** `app/layouts/dashboard.vue` (+`<ToastContainer />`, satu baris).
- **Previous behavior:** Tidak ada toast global; `expenses.vue` (halaman lama, tidak ditautkan navigasi) punya toast lokalnya sendiri, tidak terpengaruh perubahan ini.
- **New behavior:** Layout dashboard kini merender satu `ToastContainer` global, dipakai `/crm/opportunities/[id]` untuk feedback Approve/Reject Won. Halaman lain belum memanggil `useToast()` (tidak ada perubahan perilaku pada halaman existing).
- **Risk:** Sangat rendah — penambahan satu komponen overlay (`position: fixed`, kosong bila tidak ada toast aktif) ke layout yang dipakai semua halaman.
- **Regression checks:** `npm run build` sukses; smoke test seluruh route utama tetap HTTP 200 tanpa perubahan visual (toast container kosong secara default).
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.

## CI-012 — OPP-005 Dimajukan ke Stage `Won-Requested`

- **Change ID / Tanggal:** CI-012 · 2026-07-30
- **Triggering section:** Section 09 — Opportunity Won to Project.
- **Previous section affected:** Section 08 — Opportunity dan Quotation (pemilik `app/data/opportunities.ts`, seed data OPP-005 sebagai `negotiation`).
- **Alasan perubahan:** Section 09 butuh minimal satu opportunity di stage `won-requested` agar Approve Won dapat langsung didemokan tanpa harus mengklik seluruh stage sebelumnya lewat UI terlebih dahulu. OPP-005 dipilih karena datanya paling lengkap (destinasi, tanggal, traveler estimate, quotation v2 sudah terisi sejak Section 08), tidak akan terblokir validasi requirement.
- **Files affected:** `app/data/opportunities.ts` (`OPP-005.stage`: `'negotiation'` → `'won-requested'`).
- **Previous behavior:** OPP-005 di stage Negotiation (Sales masih bisa submit/tahan/lost).
- **New behavior:** OPP-005 di stage Won-Requested (menunggu Approve/Reject Management/Super Admin). Perilaku UI Section 08 (tombol per-stage) tidak berubah — hanya data seed opportunity ini yang berbeda titik awalnya.
- **Risk:** Rendah — satu perubahan field pada satu record seed, tidak memengaruhi opportunity lain atau logic Section 08.
- **Regression checks:** `npm run build` sukses; smoke test `/crm/opportunities` (list, menampilkan OPP-005 dengan stage baru) dan `/crm/opportunities/OPP-005` tetap HTTP 200 dengan konten sesuai.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4a diperbarui, bagian 4d baru), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-08-opportunity-quotation.md` (tidak diubah — perubahan ini terjadi setelah Section 08 selesai, dicatat di sini bukan retroaktif mengubah laporan Section 08), `section-09-opportunity-won-to-project.md`.

---

*(Entri berikutnya akan ditambahkan begitu sebuah section mengubah hasil section sebelumnya — lihat protokol bagian C untuk kriteria kapan perubahan section lama diperbolehkan.)*
