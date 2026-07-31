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

## CI-013 — `Traveler`/`TravelerGroup` Diperluas dan Dijadikan Reactive, Entitas Baru `RoomAssignment`

- **Change ID / Tanggal:** CI-013 · 2026-07-30
- **Triggering section:** Section 11 — Traveler and Participant.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/types/project.ts`, `app/data/projects.ts`, `app/data/index.ts`, `app/utils/attention.ts`, `app/constants/status.ts`).
- **Alasan perubahan:** Scope Section 11 eksplisit meminta profil traveler (passport/travel document metadata, emergency contact), missing-document indicator, group dan rooming list, serta add/edit/remove/import mock — seluruhnya mutasi runtime dan field yang belum ada sejak Foundation. Mengikuti prinsip "extend, jangan duplikasi" yang sama seperti CI-004/CI-007/CI-010 (Party/Opportunity/Project menjadi reactive di section yang membutuhkan mutasinya).
- **Files affected:** `app/types/project.ts` (`Traveler` +`passportNumber`/`passportExpiryDate`/`emergencyContactName`/`emergencyContactPhone`; `TravelerGroup` +`roomingNote`; +`RoomType`, +`RoomAssignment`), `app/data/projects.ts` (`TRAVELER_GROUPS`/`TRAVELERS` dibungkus `reactive()`, +`ROOM_ASSIGNMENTS`, fixture traveler diperluas dari 1 baris menjadi 18 baris representatif lintas PRJ-101/102/103), `app/data/index.ts` (+`getTravelersByGroup`, `+getRoomAssignments`, `+getTravelersMissingDocuments`, `+createTraveler`, `+updateTraveler`, `+removeTraveler`, `+importTravelersMock`), `app/utils/attention.ts` (+`PASSPORT_EXPIRY_WARNING_DAYS`, `+isTravelerDocumentMissing`), `app/constants/status.ts` (+`ROOM_TYPES`).
- **Previous behavior:** `TRAVELERS`/`TRAVELER_GROUPS` array biasa (bukan `reactive()`), hanya 1 baris traveler total (`TRV-1031`, PRJ-103) merepresentasikan seluruh 3 skenario; tidak ada field dokumen/kontak darurat/rooming.
- **New behavior:** Array yang sama, `reactive()` — method baca tetap identik untuk consumer existing (`getTravelerGroups`/`getTravelers` sudah dipakai tab Travelers sejak Section 05). Field baru bersifat opsional/aditif. Fixture traveler diperluas jadi sampel representatif per skenario (6 di PRJ-101, 6 di PRJ-102, 6 di PRJ-103) — **bukan** 1:1 dengan `project.travelerCount` (6/18/60), didokumentasikan transparan di komentar fixture dan UI tab Travelers (bukan gap tersembunyi, melanjutkan pola sampel `TRV-1031` sejak Foundation).
- **Risk:** Rendah. Field baru opsional, tidak breaking untuk baris existing (`TRV-1031` diperkaya, bukan diganti/dihapus — id dan `specialRequest` wheelchair tetap sama). Consumer existing (`projects/[id]/index.vue` tab Travelers, sebelumnya baseline Foundation) adalah satu-satunya pemakai `TRAVELERS`/`TRAVELER_GROUPS`, dan justru diperbarui bersamaan pada section yang sama.
- **Regression checks:** `npm run build` sukses; smoke test konten (curl + grep, bukan hanya status code) mengonfirmasi tab lain (`?tab=itinerary-services`, `?tab=finance`) pada PRJ-102/103 tidak berubah; Overview tab (Section 10) tidak disentuh sama sekali.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4e baru), `docs/route-and-role-matrix.md` (bagian 0/1.3, baris Project Detail), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-11-traveler-participant.md`.

---

## CI-014 — `ProjectService` Diperluas dan Dijadikan Reactive, Entitas Baru `ItineraryItem`, Tipe Layanan `additional`

- **Change ID / Tanggal:** CI-014 · 2026-07-30
- **Triggering section:** Section 12 — Itinerary and Operations.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/types/project.ts`, `app/data/projects.ts`, `app/data/index.ts`, `app/constants/status.ts`, `app/utils/format.ts`); Section 10 — Project Core (Overview tab membaca `PROJECT_SERVICES` yang sama untuk "Service Summary").
- **Alasan perubahan:** Scope Section 12 meminta booking/reference mock, update status per sub-section (role-gated), daily itinerary, dan tipe layanan "additional service" — seluruhnya mutasi runtime dan field yang belum ada sejak Foundation. Mengikuti prinsip "extend, jangan duplikasi" yang sama seperti CI-007/CI-010/CI-013.
- **Files affected:** `app/types/project.ts` (`ProjectService` +`bookingReference`; `ServiceTypeKey` +`'additional'`; +`ItineraryItem`), `app/data/projects.ts` (`PROJECT_SERVICES` dibungkus `reactive()`, +`bookingReference` pada 5 baris existing, +1 baris baru `SVC-1036` tipe `additional` untuk PRJ-103, +`ITINERARY_ITEMS` 15 baris lintas 3 skenario), `app/data/index.ts` (+`getItineraryItems`, `+updateServiceStatus`), `app/constants/status.ts` (`SERVICE_TYPES` +`additional`), `app/utils/format.ts` (+`formatDayLabel`).
- **Previous behavior:** `PROJECT_SERVICES` array biasa (bukan `reactive()`), tidak ada `bookingReference`, hanya 4 tipe layanan (flight/hotel/transportation/mice), tidak ada entitas itinerary harian.
- **New behavior:** Array yang sama, `reactive()` — method baca tetap identik untuk consumer existing (Overview tab Section 10 "Service Summary", tab Vendors `vendorsForProject`). Field baru aditif. `'additional'` **tidak pernah** dimasukkan ke `Project.serviceScope` (tetap 4 kombinasi resmi sesuai Prompt 0-B/D-039) — visibilitas section "Additional Service" murni data-driven (ada/tidaknya baris service bertipe itu), bukan bagian klasifikasi tipe project.
- **Risk:** Rendah–sedang. Menambah 1 baris `SVC-1036` (PRJ-103, status `confirmed`) mengubah angka breakdown "Service Summary" Overview tab (Section 10) dari 5 menjadi 6 service — **efek samping yang diharapkan** dari perluasan fixture generik (computed Overview tidak diubah kodenya, otomatis merefleksikan data baru), diverifikasi lewat regression check (bagian di bawah), bukan regresi.
- **Regression checks:** `npm run build` sukses; smoke test konten (curl+grep) mengonfirmasi Overview PRJ-103 (`?tab=overview`) tetap HTTP 200 dan Service Summary menampilkan breakdown baru secara konsisten (6 service, bukan error/hilang data); tab Travelers (Section 11) dan Vendors tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4f baru), `docs/route-and-role-matrix.md` (bagian 0/1.3, bagian 5 catatan implementasi), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-12-itinerary-operations.md`.

---

## CI-015 — `Vendor` Dijadikan Reactive, Entitas Baru `VendorContact`/`VendorQuotation`/`VendorActivity`; Tab "Vendors" Project Detail Ditulis Ulang

- **Change ID / Tanggal:** CI-015 · 2026-07-30
- **Triggering section:** Section 13 — Vendor Management.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/types/vendor.ts`, `app/data/vendors.ts`, `app/pages/vendors/index.vue`, tab "Vendors" `app/pages/projects/[id]/index.vue`); Section 12 — Itinerary and Operations (pemilik `PROJECT_SERVICES`/`updateServiceStatus`, dibaca ulang — bukan diduplikasi — oleh alur Accept Quotation).
- **Alasan perubahan:** Scope Section 13 meminta vendor detail+contact, quotation+comparison, assignment ke Project/Service, dan confirmation status — seluruhnya mutasi runtime dan entitas yang belum ada sejak Foundation (yang hanya py `Vendor` datar tanpa contact/quotation). Tab "Vendors" Project Detail secara eksplisit didesain sejak IA (`docs/mockup-information-architecture.md` bagian 3.6: "Assignment vendor ke project tetap terjadi di tab 'Vendors' pada Project Detail") sebagai tempat aksi assignment terjadi — Section 13 adalah pemilik pengisian tab ini (pola yang sama seperti Section 10/11/12 mengisi tab Overview/Travelers/Itinerary & Services).
- **Files affected:** `app/types/vendor.ts` (+`VendorContact`, `+VendorQuotationStatus`, `+VendorQuotation`, `+VendorActivity`, `+VendorDetailTab`), `app/data/vendors.ts` (`VENDORS` dibungkus `reactive()`, `+VENDOR_CONTACTS` 5 baris backfill, `+VENDOR_QUOTATIONS` 10 baris, `+VENDOR_ACTIVITIES` 5 baris), `app/data/index.ts` (+8 selector/mutator: `getVendorContacts`, `getVendorQuotations`, `getVendorActivities`, `getServicesByVendor`, `getQuotationsForService`, `createVendor`, `createVendorContact`, `submitVendorQuotation`, `acceptVendorQuotation`, `rejectVendorQuotation`), `app/constants/status.ts` (+`VENDOR_QUOTATION_STATUSES`), `app/pages/vendors/index.vue` (list ditulis ulang: filter+create), `app/pages/vendors/[id]/index.vue` (**baru** — Vendor Detail 4-tab), `app/pages/projects/[id]/index.vue` (tab "Vendors" ditulis ulang: per-service assignment + quotation comparison + Accept/Reject, gerbang reuse `canManageServiceType` Section 12).
- **Previous behavior:** `VENDORS` array biasa (bukan `reactive()`), tidak ada contact/quotation/activity, tidak ada route `/vendors/[id]`. Tab "Vendors" Project Detail hanya menampilkan daftar nama vendor unik yang ter-assign (dari `service.vendorId`), tanpa status/quotation/aksi apa pun.
- **New behavior:** Array yang sama, `reactive()` — method baca tetap identik untuk consumer existing (`getVendorById` dipakai luas sejak Foundation di banyak halaman). Accept Quotation memanggil `updateServiceStatus` (Section 12) yang **sudah ada**, bukan mutasi `PROJECT_SERVICES` paralel — memenuhi hard rule "jangan menggandakan service fixture" secara harfiah.
- **Risk:** Rendah. Field/entitas baru seluruhnya aditif; tidak ada consumer existing yang membaca `VENDORS` dengan cara yang akan rusak oleh `reactive()`. Perubahan pada tab "Vendors" Project Detail adalah pengisian scope yang memang belum dikerjakan section manapun sebelumnya (bukan modifikasi tak terduga atas pekerjaan section lain), konsisten dengan kriteria protokol bagian C.
- **Regression checks:** `npm run build` sukses; smoke test konten (curl+grep) mengonfirmasi tab lain Project Detail (`?tab=overview`, `?tab=travelers`, `?tab=itinerary-services`) tetap HTTP 200 tanpa perubahan konten; `/vendors` dan `/vendors/[id]` baru diverifikasi menampilkan data quotation/contact yang benar.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4g baru), `docs/route-and-role-matrix.md` (bagian 0/1.4/5, koreksi dokumentasi role Vendor — lihat catatan di section report), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-13-vendor-management.md`.

---

## CI-016 — `ActivityEntry` Diperluas dengan Field Change (Category/Reason/Requester/Before-After/Impact/Approval)

- **Change ID / Tanggal:** CI-016 · 2026-07-30
- **Triggering section:** Section 14 — Project Changes.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/types/activity.ts`, `app/data/activity.ts`, tab "Activity & Changes" `app/pages/projects/[id]/index.vue`); Section 06 — Dashboard (consumer `isProjectNeedingAttention`/`hasUnreviewedChange` yang membaca `isChange`/`reviewed` — TIDAK diubah).
- **Alasan perubahan:** Scope Section 14 meminta change list/detail dengan category/reason/requester/before-after/impact serta status approval mock — seluruhnya field yang belum ada sejak Foundation pada `ActivityEntry`. Mengikuti hard rule eksplisit dan LOCKED `docs/mockup-information-architecture.md` bagian 4 ("data berasal dari satu sumber log yang sama... bukan dua sumber data terpisah"), field baru ditambahkan ADITIF pada `ActivityEntry` existing — bukan entitas `Change` paralel.
- **Files affected:** `app/types/activity.ts` (+`ChangeCategory`, `+ChangeApprovalStatus`, `ActivityEntry` +7 field opsional), `app/data/activity.ts` (4 baris `CHG-*` existing diperkaya field baru — bukan record baru, ID/shape lama tidak berubah), `app/constants/status.ts` (+`CHANGE_CATEGORIES`, `+CHANGE_APPROVAL_STATUSES`), `app/data/index.ts` (+`createChangeEntry`, `+approveChangeEntry`, `+rejectChangeEntry`), `app/pages/projects/[id]/index.vue` (tab "Activity & Changes" diperkaya: dialog "Catat Perubahan", tampilan detail per-entry, tombol Setujui/Tolak, timeline kronologis untuk mode "Changes only").
- **Previous behavior:** `ActivityEntry` hanya `id/projectId/message/isChange/reviewed/createdAt`; tab "Activity & Changes" hanya menampilkan pesan + badge Reviewed/Belum Direview, tanpa detail/kategori/approval.
- **New behavior:** Field baru seluruhnya opsional (`category`/`reason`/`requestedBy`/`beforeValue`/`afterValue`/`impactNote`/`approvalStatus`/`approvedBy`). `reviewed` (dipakai `hasUnreviewedChange`, Section 06, LOCKED) **tidak diubah maknanya** — `approvalStatus` adalah konsep terpisah (keputusan formal approve/reject), disinkronkan manual (`approveChangeEntry`/`rejectChangeEntry` turut men-set `reviewed: true`) agar kedua flag tidak saling bertentangan.
- **Risk:** Rendah. Consumer existing (`isProjectNeedingAttention`, Overview "Recent Activity", Dashboard) hanya membaca `isChange`/`reviewed`/`message`/`createdAt` — field baru tidak mengubah bentuk data yang sudah dibaca, murni tambahan. `CHG-1023` (satu-satunya entry `reviewed: false` sebelumnya) kini juga `approvalStatus: 'pending'` — konsisten, bukan kontradiksi (entry yang belum direview secara alami juga belum diputuskan approve/reject-nya).
- **Regression checks:** `npm run build` sukses; smoke test konten (curl+grep) mengonfirmasi tab lain Project Detail (`?tab=overview`, `?tab=travelers`, `?tab=itinerary-services`, `?tab=vendors`) tetap HTTP 200 tanpa perubahan konten; Dashboard (`/`) tetap HTTP 200.
- **Dokumentasi yang diperbarui:** `docs/mockup-data-scenarios.md` (bagian 4h baru), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-14-project-changes.md`.

---

## CI-017 — Penghapusan Flag `comingSoon` pada Nav Item Reports

- **Change ID / Tanggal:** CI-017 · 2026-07-30
- **Triggering section:** Section 16 — Reports.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/constants/navigation.ts`, `NAV_ITEMS`).
- **Alasan perubahan:** `/reports` sebelumnya `ModulePlaceholder` (Section 05) sehingga nav item-nya ditandai `comingSoon: true` (badge "Segera"). Section 16 menyelesaikan implementasi penuh halaman ini, sehingga badge tsb sudah tidak sesuai kondisi aktual — dihapus agar sidebar konsisten dengan pola section lain yang sudah selesai (Section 07 melakukan hal sama untuk Prospects/Clients, lihat histori CI di atas).
- **Files affected:** `app/constants/navigation.ts` (satu baris, item `Reports` — `comingSoon: true` dihapus).
- **Previous behavior:** Sidebar menampilkan badge "Segera" di sebelah label "Reports" meski halaman sudah lengkap.
- **New behavior:** Badge "Segera" tidak lagi tampil untuk Reports; item lain (`Quotations`, `Invoices`, `Payments`, seluruh item Administration) tidak disentuh dan tetap bertanda `comingSoon: true` apa adanya.
- **Risk:** Sangat rendah — perubahan satu baris murni tampilan (badge kondisional `v-if="item.comingSoon"` di `AppSidebar.vue`, tidak diubah), tidak memengaruhi routing/permission.
- **Regression checks:** `npm run build` sukses; smoke test `/` (sidebar) mengonfirmasi badge "Segera" hilang untuk Reports, seluruh item lain tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-16-reports.md`.

**Catatan tambahan (ditemukan, sengaja tidak diperbaiki):** `Invoices`/`Payments` di file yang sama juga masih bertanda `comingSoon: true` meski `COMPLETED` sejak Section 15 (kemungkinan oversight Section 15). Section 16 **tidak** memperbaikinya untuk menjaga scope tetap murni Reports — dicatat sebagai known issue di `docs/mockup-section-reports/section-16-reports.md` bagian 17, bukan diperbaiki diam-diam.

---

## CI-018 — Penghapusan Flag `comingSoon` pada Nav Item Administration dan Finance

- **Change ID / Tanggal:** CI-018 · 2026-07-30
- **Triggering section:** Section 17 — Administration.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/constants/navigation.ts`, `NAV_ITEMS`); Section 15 — Project Finance (pemilik halaman `/finance/invoices` dan `/finance/payments`).
- **Alasan perubahan:** 
  1. Halaman admin (`/admin/*`) sebelumnya merupakan placeholder statis, sehingga nav item-nya ditandai `comingSoon: true`. Section 17 menyelesaikan implementasi penuh modul Administration, sehingga badge tsb dihapus agar navigasi konsisten.
  2. Halaman Finance (`/finance/invoices` dan `/finance/payments`) telah selesai diimplementasikan pada Section 15, tetapi terlewat untuk menghapus flag `comingSoon: true`. Section 17 melakukan perbaikan ini agar menu navigasi merefleksikan fungsionalitas yang ada.
- **Files affected:** `app/constants/navigation.ts` (penghapusan `comingSoon` pada sub-item Finance dan Administration).
- **Previous behavior:** Menu sidebar menampilkan badge "Segera" di sebelah sub-item Finance dan Administration.
- **New behavior:** Badge "Segera" tidak lagi tampil untuk Invoices, Payments, Master Data, Users, Roles, dan Audit Trail.
- **Risk:** Sangat rendah — murni tampilan pada sidebar.
- **Regression checks:** `npm run build` sukses; navigasi sidebar berfungsi normal ke seluruh halaman yang diaktifkan.
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-section-reports/section-17-administration.md`.

---

## CI-019 — Fix Bug `handleDelete` Tidak Terdefinisi di `expenses.vue`

- **Change ID / Tanggal:** CI-019 · 2026-07-30
- **Triggering section:** Section 18 — Regression and Demo Readiness.
- **Previous section affected:** Section 01 — Template Audit (awal penemuan bug, dicatat di `docs/template-audit.md` bagian 1 poin 2); Section 05 — Foundation (pemilik halaman, sengaja tidak difix karena bukan scope Foundation).
- **Alasan perubahan:** Bug `handleDelete` (fungsi tidak terdefinisi) ditemukan sejak audit awal Section 01 namun sengaja tidak diperbaiki selama 17 section karena `/expenses` bukan route aktif IA MANOVA. Section 18 (Regression and Demo Readiness) secara eksplisit menginstruksikan "perbaiki bug nyata" — dan ini adalah satu-satunya bug fungsional nyata yang tersisa (bukan desain).
- **Files affected:** `app/pages/expenses.vue` (satu baris, line 941).
- **Previous behavior:** Tombol "Delete" di modal detail expense memanggil `handleDelete(detailExpense)` → `ReferenceError: handleDelete is not defined` saat diklik.
- **New behavior:** Tombol memanggil `requestDelete(detailExpense)` — fungsi yang sudah terdefinisi di baris 222, membuka dialog konfirmasi hapus, konsisten dengan tombol delete di baris tabel.
- **Risk:** Sangat rendah — perubahan satu baris, hanya memengaruhi `/expenses` (route tidak aktif yang tidak terhubung dari sidebar MANOVA).
- **Regression checks:** `nuxi prepare` sukses. Tidak ada consumer lain dari `handleDelete` di seluruh codebase (dikonfirmasi via grep).
- **Dokumentasi yang diperbarui:** `docs/mockup-final-known-issues.md` (C-001 status: FIXED), `docs/mockup-section-reports/section-18-regression-demo-readiness.md`.

---

## CI-020 — `Opportunity.ownerId` Direassign dari Sales ke Account Executive; Gate `canManageOpportunity` Berpindah

- **Change ID / Tanggal:** CI-020 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request (Customer Journey, Account Executive, Supplier, Commercial Approval).
- **Previous section affected:** Section 08 — Opportunity dan Quotation (pemilik `app/data/opportunities.ts`, `app/pages/crm/opportunities/[id]/index.vue`).
- **Alasan perubahan:** Prompt 19 secara eksplisit memindahkan tanggung jawab pengelolaan Opportunity/Quotation dari Sales ke Account Executive (role baru). Mempertahankan `ownerId`/gate lama akan membuat "Account Owner" menunjuk ke role yang menurut definisi baru tidak lagi mengelola Opportunity — perlu diperbaiki untuk integrasi (protokol bagian C).
- **Files affected:** `app/data/opportunities.ts` (`ownerId` pada OPP-001–008 diubah dari `USR-001` ke `USR-014`), `app/pages/crm/opportunities/[id]/index.vue` (`canManageOpportunity`: `['sales','super-admin']` → `['account-executive','super-admin']`; label "Owner" pada `summaryMetadata` diganti "Account Executive" + fix bug tampilan lama yang hardcode fallback nama "Rani Kusuma (Sales)" menjadi lookup `getUserById` yang benar).
- **Previous behavior:** Seluruh Opportunity dimiliki Sales (`USR-001`); tombol aksi stage/quotation hanya tampil untuk role Sales/Super Admin.
- **New behavior:** Seluruh Opportunity dimiliki Account Executive (`USR-014`); tombol aksi tampil untuk role Account Executive/Super Admin. Sales tetap bisa **melihat** (read-only, `canView('crm')` tidak berubah) tapi tidak lagi melihat tombol aksi.
- **Risk:** Rendah–sedang. Perubahan `ownerId` murni nilai field (bukan struktur); Dashboard (Section 06) widget yang membaca `Opportunity` (Pipeline, Quotations Pending) tidak bergantung pada `ownerId` spesifik sehingga tidak terpengaruh isinya, hanya visibilitasnya (lihat CI-021).
- **Regression checks:** `npm run build` sukses; smoke test `/crm/opportunities`, `/crm/opportunities/OPP-001`, `/crm/opportunities/OPP-005`, `/crm/opportunities/OPP-006` — seluruhnya HTTP 200, Account Executive tampil sebagai owner di summary metadata.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-047, `docs/mockup-data-scenarios.md` bagian 4j, `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/change-customer-journey-ae-supplier.md`.

## CI-021 — Dashboard Widget Diperluas untuk Account Executive dan Supplier

- **Change ID / Tanggal:** CI-021 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request.
- **Previous section affected:** Section 06 — Dashboard (pemilik `app/pages/index.vue`).
- **Alasan perubahan:** 2 role baru (Account Executive, Supplier) tidak punya widget/KPI card manapun di Dashboard existing (seluruh flag `visibleTo(...)` hardcode 11 role lama) — login sebagai AE/Supplier akan menampilkan Dashboard kosong (nol KPI, nol widget), melanggar Definition of Done eksplisit `docs/mockup-scope.md` bagian 12 ("tanpa role yang menyebabkan... halaman kosong tak terduga").
- **Files affected:** `app/pages/index.vue` (KPI `open-opportunities` + `showPipeline` + `showQuotationsPending` diperluas menambahkan `account-executive`; +`showSupplierWelcome` dan 1 `SectionCard` baru "Supplier Portal" khusus role `supplier`).
- **Previous behavior:** Widget Opportunity Pipeline/Quotations Pending hanya untuk Sales/Management/Super Admin/Viewer; tidak ada widget untuk Supplier sama sekali.
- **New behavior:** Account Executive melihat widget yang sama seperti yang dulu dilihat Sales (Pipeline, Quotations Pending) — konsisten dengan AE kini mengelola pipeline tsb (CI-020). Supplier melihat satu widget baru berisi penjelasan singkat + tautan ke `/supplier` (data internal MANOVA tetap tidak ditampilkan, isolasi vendor tetap berlaku).
- **Risk:** Rendah — perubahan aditif murni (menambah role ke daftar `visibleTo(...)` existing + 1 blok `SectionCard` baru bersyarat), tidak mengubah widget/computed lain milik role existing.
- **Regression checks:** `npm run build` sukses; struktur Dashboard untuk 11 role lama tidak berubah (diverifikasi lewat diff — hanya baris yang disebutkan di atas yang bertambah).
- **Dokumentasi yang diperbarui:** `docs/route-and-role-matrix.md` bagian 6, `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/change-customer-journey-ae-supplier.md`.

## CI-022 — `canManageParty` Diperluas Menambahkan Account Executive

- **Change ID / Tanggal:** CI-022 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request.
- **Previous section affected:** Section 07 — CRM Party (pemilik `app/pages/crm/parties/[id]/index.vue`, `app/pages/crm/prospects.vue`).
- **Alasan perubahan:** Prompt 19 eksplisit: Account Executive "mengelola relationship dengan prospect/client". Narrow-exception `canManageParty` sebelumnya hanya `['sales','super-admin']`.
- **Files affected:** `app/pages/crm/parties/[id]/index.vue`, `app/pages/crm/prospects.vue` (`canManageParty`: +`account-executive`, Sales tetap dipertahankan — tidak ada larangan eksplisit Party-level di Prompt 19).
- **Previous behavior:** Hanya Sales/Super Admin dapat membuat Prospect baru, menambah Contact, menambah Activity di Party Detail.
- **New behavior:** Account Executive juga dapat melakukan aksi tsb (Sales tidak kehilangan akses).
- **Risk:** Sangat rendah — perluasan daftar role murni aditif, tidak mengubah UI/struktur.
- **Regression checks:** `npm run build` sukses; smoke test `/crm/prospects`, `/crm/parties/PTY-001` tetap HTTP 200.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-047, `docs/mockup-implementation-state.md`.

## CI-023 — Tab "Products" Ditambahkan ke Vendor Detail

- **Change ID / Tanggal:** CI-023 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request.
- **Previous section affected:** Section 13 — Vendor Management (pemilik `app/pages/vendors/[id]/index.vue`, `app/types/vendor.ts` — `VendorDetailTab`).
- **Alasan perubahan:** Area Supplier/External Partners (Prompt 19-7) meminta "product/service catalog" per vendor company — tab Vendor Detail existing (Overview/Services/Quotations/Contacts) belum punya wadah untuk ini.
- **Files affected:** `app/types/vendor.ts` (`VendorDetailTab` +`'products'`, +`VendorProduct` interface), `app/pages/vendors/[id]/index.vue` (+tab "Products": table + dialog "Tambah Produk", gated `canManageVendor` — tab lain tidak diubah).
- **Previous behavior:** 4 tab (Overview/Services/Quotations/Contacts), tidak ada konsep katalog produk.
- **New behavior:** 5 tab, tab baru menampilkan `VendorProduct[]` milik vendor tsb (`getVendorProducts`, reuse selektor yang sama dipakai `/supplier/products`).
- **Risk:** Rendah — penambahan tab murni aditif (array `TABS` bertambah satu elemen), 4 tab lama tidak disentuh kodenya.
- **Regression checks:** `npm run build` sukses; smoke test `/vendors/VND-001` (tab lama) dan `/vendors/VND-006?tab=products` (tab baru) — seluruhnya HTTP 200 dengan konten benar.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-048, `docs/route-and-role-matrix.md` bagian 1.11, `docs/mockup-implementation-state.md`.

## CI-024 — Reports `showSalesPipeline` Diperluas Menambahkan Account Executive

- **Change ID / Tanggal:** CI-024 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request.
- **Previous section affected:** Section 16 — Reports (pemilik `app/pages/reports/index.vue`).
- **Alasan perubahan:** Section Sales Pipeline pada `/reports` sebelumnya hanya untuk Sales/Management/Super Admin/Viewer — konsisten dengan CI-020/CI-021, Account Executive yang kini mengelola pipeline tsb turut ditambahkan.
- **Files affected:** `app/pages/reports/index.vue` (`showSalesPipeline`: +`account-executive`).
- **Previous behavior:** Account Executive (role baru) tidak melihat section Sales Pipeline di Reports.
- **New behavior:** Account Executive melihat section Sales Pipeline (data sama, agregasi `OPPORTUNITIES`/`QUOTATIONS` tidak berubah).
- **Risk:** Sangat rendah — satu baris, murni penambahan role ke daftar visibilitas existing.
- **Regression checks:** `npm run build` sukses; smoke test `/reports` tetap HTTP 200, angka section lain tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-implementation-state.md`.

## CI-025 — `isFollowUpUpcoming` Tipe Parameter Dipersempit (Reuse untuk Lead Follow-Up)

- **Change ID / Tanggal:** CI-025 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request.
- **Previous section affected:** Section 07 — CRM Party (pemilik `app/utils/attention.ts`, fungsi `isFollowUpUpcoming` awalnya bertipe parameter `PartyActivity`).
- **Alasan perubahan:** Modul Leads baru butuh logic "follow-up akan datang" yang identik (hanya membaca `dueAt`) untuk `LeadActivity` (entitas berbeda, tanpa field `partyId`). Menghindari duplikasi logic (hard rule "jangan menghitung ulang logic yang sama di tempat lain").
- **Files affected:** `app/utils/attention.ts` (tipe parameter `isFollowUpUpcoming`: `PartyActivity` → `{ dueAt?: string }`, import `PartyActivity` yang jadi tidak terpakai dihapus).
- **Previous behavior:** Fungsi hanya bisa dipanggil dengan `PartyActivity`.
- **New behavior:** Fungsi menerima objek apa pun dengan field `dueAt?` opsional — `PartyActivity` tetap kompatibel (structural typing, tidak ada perubahan perilaku/signature yang terlihat konsumen existing), `LeadActivity` kini juga bisa memakainya.
- **Risk:** Sangat rendah — pelebaran tipe parameter yang backward-compatible, logic function tidak berubah satu baris pun.
- **Regression checks:** `npm run build` sukses; seluruh consumer existing (`getUpcomingFollowUps`, Dashboard widget "Follow-up Mendatang", Party Detail, Opportunity Detail) diperiksa tetap memanggil dengan `PartyActivity` seperti sebelumnya, tidak ada perubahan perilaku.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-051, `docs/mockup-implementation-state.md`.

## CI-026 — OPP-005 Dikembalikan ke Stage `negotiation` (dari `won-requested`, CI-012)

- **Change ID / Tanggal:** CI-026 · 2026-07-30
- **Triggering section:** Prompt 19 — Change Request.
- **Previous section affected:** Section 09 — Opportunity Won to Project (pemilik keputusan CI-012 yang memajukan OPP-005 ke `won-requested` demi kemudahan demo Approve Won).
- **Alasan perubahan:** Workflow Commercial Approval baru (D-049) mensyaratkan `Quotation.approvalStatus === 'approved'` sebelum Opportunity boleh diajukan ke `won-requested`. OPP-005 (di `won-requested` sejak CI-012) sekarang justru menjadi skenario yang salah didemokan tanpa quotation approval terlebih dulu — direstage ke `negotiation` dengan `QUO-005.approvalStatus = 'submitted'`, menjadikannya skenario "quotation menunggu approval" (literal Prompt 19-9). Live-demo Approve Won kini memakai OPP-006 (`QUO-006.approvalStatus = 'approved'`) sebagai gantinya.
- **Files affected:** `app/data/opportunities.ts` (`OPP-005.stage`: `'won-requested'` → `'negotiation'`).
- **Previous behavior:** OPP-005 siap langsung di-Approve/Reject Won oleh Management/Super Admin tanpa melalui gerbang komersial.
- **New behavior:** OPP-005 berada di stage Negotiation dengan quotation menunggu Commercial Approval — mendemonstrasikan gerbang baru secara utuh sebelum Won dapat diajukan.
- **Risk:** Rendah — satu perubahan field pada satu record seed (bukan struktur), tidak memengaruhi opportunity lain. Party PTY-004 tetap Prospect (tidak ada regresi status lifecycle).
- **Regression checks:** `npm run build` sukses; smoke test `/crm/opportunities/OPP-005` (Commercial Approval badge "Menunggu Approval", tombol "Ajukan sebagai Won" disabled) dan `/crm/opportunities/OPP-006` (badge "Disetujui", tombol aktif) — sesuai desain.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-049, `docs/mockup-data-scenarios.md` bagian 4j, `docs/mockup-implementation-state.md`.

## CI-027 — Alur "Ajukan sebagai Won" (Dua-Langkah) Diganti "Mark as Won" (AE, Satu Langkah)

- **Change ID / Tanggal:** CI-027 · 2026-07-31
- **Triggering section:** Prompt 20 — Change Request (Sales Qualification to Account Executive Opportunity Flow).
- **Previous section affected:** Section 09 — Opportunity Won to Project (pemilik `approveOpportunityWon`/`rejectOpportunityWon`, model approval Won dua-langkah D-025), Section 08/Prompt 19 — Opportunity Detail (pemilik `app/pages/crm/opportunities/[id]/index.vue`).
- **Alasan perubahan:** Prompt 20-1/13 eksplisit menggambarkan AE langsung "Mark as Won" setelah Management approve Quotation (Commercial Approval), tanpa approval kedua terpisah untuk Won itu sendiri — lihat D-053.
- **Files affected:** `app/pages/crm/opportunities/[id]/index.vue` (tombol "Ajukan sebagai Won" + section Approve/Reject Won Management dihapus dari alur normal, diganti tombol AE "Mark as Won" yang memanggil `advanceOpportunityStage`+`approveOpportunityWon` berurutan). `app/data/index.ts` **tidak diubah** (`approveOpportunityWon`/`rejectOpportunityWon` dipakai ulang apa adanya, `rejectOpportunityWon` kini tidak dipanggil UI manapun tapi tetap ada).
- **Previous behavior:** AE klik "Ajukan sebagai Won" → stage `won-requested` → Management/Super Admin melihat tombol "Approve Won"/"Reject" terpisah → klik Approve untuk benar-benar membuat Project.
- **New behavior:** AE klik "Mark as Won" (gated: Quotation `approved` + requirement lengkap) → Project langsung dibuat dalam satu aksi, `wonApprovedBy` diisi `quotation.approvedBy` (Management yang approve komersial).
- **Risk:** Sedang — mengubah UX approval Won yang sudah didemokan sejak Section 09, tapi TIDAK ada perubahan struktur data/mutator (reuse penuh), dan tidak ada fixture existing yang berada di stage `won-requested` (diverifikasi sebelum perubahan) sehingga tidak ada skenario demo yang rusak.
- **Regression checks:** `npm run build` sukses; smoke test `/crm/opportunities/OPP-006` (quotation approved) menampilkan tombol "Mark as Won" aktif; `/crm/opportunities/OPP-005` (quotation submitted) menampilkan tombol disabled dengan penjelasan; tidak ada opportunity yang ter-stuck di `won-requested`.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-053, `docs/route-and-role-matrix.md` bagian 2.3, `docs/mockup-implementation-state.md`.

## CI-028 — Label Stage `won-requested` Direname ("Won (Menunggu Approval)" → "Pending Management Approval")

- **Change ID / Tanggal:** CI-028 · 2026-07-31
- **Triggering section:** Prompt 20 — Change Request.
- **Previous section affected:** Section 05 — Foundation (pemilik `app/constants/status.ts`, `OPPORTUNITY_STAGES`, status-constant terpusat D-038).
- **Alasan perubahan:** Prompt 20-14 eksplisit: "Ganti status yang membingungkan dari Won (Menunggu Approval) menjadi Pending Management Approval".
- **Files affected:** `app/constants/status.ts` (`OPPORTUNITY_STAGES`, entri `won-requested`: `label` saja — `value`/`tone`/`order` tidak berubah).
- **Previous behavior:** Label "Won (Menunggu Approval)" tampil di stepper stage Opportunity Detail dan badge lain yang membaca `OPPORTUNITY_STAGES`.
- **New behavior:** Label "Pending Management Approval". Seluruh consumer (`crm/opportunities/index.vue`, `crm/opportunities/[id]/index.vue`, `crm/parties/[id]/index.vue`, `customer-journey/customers/[id]/index.vue`, `customer-journey/index.vue`, `pages/index.vue`, `pages/reports/index.vue`) otomatis ikut berubah tanpa disentuh kodenya (satu sumber label terpusat, D-038).
- **Risk:** Sangat rendah — label-only, `value` (dipakai luas untuk `.stage === '...'` checks) tidak berubah.
- **Regression checks:** `npm run build` sukses; smoke test 6 file consumer tetap HTTP 200, tidak ada string lama "Won (Menunggu Approval)" tersisa (`grep` dikonfirmasi).
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-056.

## CI-029 — Teks Role Note `admin/roles.vue` Disinkronkan dengan Model Role Prompt 19/20

- **Change ID / Tanggal:** CI-029 · 2026-07-31
- **Triggering section:** Prompt 20 — Change Request.
- **Previous section affected:** Section 17 — Administration (pemilik `app/pages/admin/roles.vue`, `ROLE_NOTES`).
- **Alasan perubahan:** Ditemukan saat implementasi Prompt 20: teks deskripsi role `management` ("Approve Won Opportunity...") dan `sales` ("Kelola Prospect, Opportunity, dan Quotation...") pada halaman `/admin/roles` masih merefleksikan model role SEBELUM Prompt 19 (tidak diperbarui saat Prompt 19 memindahkan pengelolaan Opportunity dari Sales ke AE) — kini juga tidak akurat terhadap D-053 (Management approve Quotation, bukan Won secara langsung).
- **Files affected:** `app/pages/admin/roles.vue` (`ROLE_NOTES.management`, `ROLE_NOTES.sales` — teks deskriptif saja, bukan `ROLE_MODULE_ACCESS`).
- **Previous behavior:** Teks menyiratkan Management approve Won langsung dan Sales mengelola Opportunity/Quotation.
- **New behavior:** Teks mencerminkan model role aktual: Management approve/reject Commercial Approval Quotation; Sales mengelola Lead (screening/qualification/assign AE), melihat Opportunity hasil handover secara terbatas.
- **Risk:** Sangat rendah — teks deskriptif murni (tidak ada logic/permission yang berubah), inkonsistensi ini pre-existing sejak Prompt 19 (bukan regresi baru dari Prompt 20).
- **Regression checks:** `npm run build` sukses; smoke test `/admin/roles` tetap HTTP 200.
- **Dokumentasi yang diperbarui:** Tidak ada dokumen lain yang mereferensikan teks ini secara langsung.

## CI-030 — Dashboard (`/`) Mendapat 3 Widget Welcome Baru untuk Role Baru (Client/Procurement/Product Planner)

- **Change ID / Tanggal:** CI-030 · 2026-08-01
- **Triggering section:** Section 02 — Role, Access dan Navigation (roadmap Section 00–24 baru).
- **Previous section affected:** Section 06 lama — Dashboard (pemilik `app/pages/index.vue`).
- **Alasan perubahan:** Section 02 menambah 3 role baru (`client`/`procurement`/`product-planner`, D-059). Audit menemukan seluruh widget Dashboard existing memakai daftar `visibleTo(...)` eksplisit yang tidak menyertakan role baru manapun — tanpa perbaikan, ketiga role akan melihat Dashboard kosong total (regresi UX, bukan sekadar "belum lengkap").
- **Files affected:** `app/pages/index.vue` (+3 `computed` visibility, +3 `SectionCard` welcome/redirect bersyarat — pola identik `showSupplierWelcome`/Prompt 19, murni aditif).
- **Previous behavior:** Dashboard hanya punya widget welcome untuk Supplier; role lain di luar daftar `visibleTo` manapun akan melihat halaman kosong.
- **New behavior:** Client melihat card "Client Portal" (link `/client`), Procurement melihat card "Vendor Management" (link `/vendors`), Product Planner melihat card "Referensi Costing" (link `/crm/opportunities`) — seluruhnya bersyarat, tidak memengaruhi widget role lain manapun.
- **Risk:** Sangat rendah — 3 blok `SectionCard` baru bersyarat ditambahkan, 0 baris existing diubah/dihapus.
- **Regression checks:** `npm run build` sukses; smoke test `/` tetap HTTP 200 tanpa error string; struktur widget 16 role lama tidak disentuh (diverifikasi via diff — hanya baris baru yang ditambahkan).
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-059, `docs/mockup-implementation-state.md`.

## CI-031 — Matrix Role × Modul (`/admin/roles`) Dilengkapi Kolom dan Catatan yang Sebelumnya Terlewat

- **Change ID / Tanggal:** CI-031 · 2026-08-01
- **Triggering section:** Section 02 — Role, Access dan Navigation.
- **Previous section affected:** Section 17 lama — Administration (pemilik `app/pages/admin/roles.vue`).
- **Alasan perubahan:** Audit Section 02 menemukan `modules` (daftar kolom matrix) belum pernah diperbarui sejak `supplier-portal` ditambahkan Prompt 19 (kolom tsb tidak pernah tampil di Matrix View meski ada di `ROLE_MODULE_ACCESS`) — gap dokumentasi pre-existing, bukan regresi baru. `ROLE_NOTES` juga belum pernah diisi untuk `account-executive`/`supplier` (Prompt 19).
- **Files affected:** `app/pages/admin/roles.vue` (`modules` +`supplier-portal`+`client-portal`; `ROLE_NOTES` +5 entri: `account-executive`, `product-planner`, `procurement`, `client`, `supplier`).
- **Previous behavior:** Matrix hanya menampilkan 6 kolom (crm/project/vendor/finance/reports/administration); `supplier-portal` tidak terlihat sama sekali di Matrix View meski sudah jadi bagian `ROLE_MODULE_ACCESS` sejak Prompt 19.
- **New behavior:** Matrix menampilkan 8 kolom lengkap; seluruh 16 role kini punya catatan singkat di kolom pertama.
- **Risk:** Sangat rendah — penambahan data statis (array literal), tidak ada logic yang diubah.
- **Regression checks:** `npm run build` sukses; smoke test `/admin/roles` tetap HTTP 200, konten "Supplier Portal"/"Client Portal"/"Product Planner"/"Procurement" dikonfirmasi tampil via curl.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-059.

## CI-032 — `/login` Mendapat Link Discoverability ke `/lead-intake`

- **Change ID / Tanggal:** CI-032 · 2026-08-01
- **Triggering section:** Section 03 — Public Lead Intake (roadmap Section 00–24 baru).
- **Previous section affected:** Foundation/template baseline (pemilik `app/pages/login.vue`, tidak pernah disentuh section manapun sejak awal proyek).
- **Alasan perubahan:** `/lead-intake` (baru) sengaja TIDAK dimasukkan ke navigasi internal (`app/constants/navigation.ts`) — sesuai Wajib literal "Public tidak mendapat dashboard internal". Tanpa tautan apa pun, halaman ini hanya reachable lewat mengetik URL langsung, menyulitkan review. `/login` adalah satu-satunya halaman publik lain yang sudah ada.
- **Files affected:** `app/pages/login.vue` (+1 paragraf link `NuxtLink` di footer, murni aditif).
- **Previous behavior:** Footer `/login` hanya berisi teks "Sistem mockup internal MANOVA — bukan lingkungan produksi."
- **New behavior:** Footer menambahkan baris "Ingin mengajukan permintaan perjalanan? Isi form di sini" yang mengarah ke `/lead-intake`.
- **Risk:** Sangat rendah — satu paragraf baru, tidak mengubah form login/logic autentikasi mock apa pun.
- **Regression checks:** `npm run build` sukses; smoke test `/login` tetap HTTP 200, teks link dikonfirmasi tampil via curl.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-060.

## CI-033 — `/lead-intake` Direfactor agar Reuse Selector Duplikat Terpusat

- **Change ID / Tanggal:** CI-033 · 2026-08-01
- **Triggering section:** Section 04 — Sales Leads dan Qualification (roadmap Section 00–24 baru).
- **Previous section affected:** Section 03 — Public Lead Intake (baru COMPLETED, laporan `docs/mockup-section-reports/section-03-public-lead-intake.md`).
- **Alasan perubahan:** Section 04 membutuhkan logic deteksi duplikat yang identik dengan yang sudah dibuat Section 03 (cocok phone/email). Alih-alih menduplikasi logic tsb di `/customer-journey/leads`, logic dipindah menjadi selector terpusat `getLeadDuplicateCandidates` (`app/data/index.ts`) dan `/lead-intake` di-refactor untuk memanggilnya — mencegah 2 implementasi paralel yang bisa divergen (hard rule "jangan menghitung ulang logic yang sama di tempat lain").
- **Files affected:** `app/pages/lead-intake/index.vue` (computed `duplicateMatch` — sebelumnya `LEADS.find(...)` inline, sekarang `getLeadDuplicateCandidates({phone,email})[0]`; perilaku identik, hanya sumber logic yang berbeda).
- **Previous behavior:** Deteksi duplikat di `/lead-intake` memakai logic lokal (tidak reusable).
- **New behavior:** Deteksi duplikat memakai selector bersama `getLeadDuplicateCandidates` — hasil untuk input yang sama PERSIS IDENTIK (perilaku tidak berubah dari sisi user, hanya sumber kode).
- **Risk:** Sangat rendah — pure refactor, hasil functionally identik (diverifikasi lewat smoke test `/lead-intake` tetap 200 tanpa error).
- **Regression checks:** `npm run build` sukses; smoke test `/lead-intake` (dengan/tanpa query UTM) tetap HTTP 200.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-061.

## CI-034 — Gerbang "Mark as Won" Bertambah Syarat Client Confirmation, Mengubah Perilaku Skenario Demo `OPP-006`

- **Change ID / Tanggal:** CI-034 · 2026-07-31
- **Triggering section:** Section 05 — Account Executive Opportunity dan Quotation (roadmap Section 00–24 baru).
- **Previous section affected:** Prompt 20 — Change Request: Sales Qualification to Account Executive Opportunity Flow (COMPLETED, skema lama) — laporannya secara eksplisit mendokumentasikan `OPP-006` sebagai skenario smoke-test "'Approved'+tombol Mark as Won aktif".
- **Alasan perubahan:** Section 05 Wajib literal: "AE belum dapat Mark as Won sebelum approved + client confirmation" — gerbang baru `Opportunity.clientConfirmedAt` ditambahkan sebagai syarat TAMBAHAN (bukan pengganti) `Quotation.approvalStatus === 'approved'` pada `submitMarkAsWon`/tombol Mark as Won.
- **Files affected:** `app/pages/crm/opportunities/[id]/index.vue` (kondisi `:disabled` tombol Mark as Won + fungsi `submitMarkAsWon`), `app/data/opportunities.ts` (`QUO-006` +`sentToClientAt: '2026-07-23'`, `Opportunity.clientConfirmedAt` sengaja TIDAK diisi pada `OPP-006` agar gerbang baru demonstrable).
- **Previous behavior:** `OPP-006` (quotation `approved`) menampilkan tombol Mark as Won aktif (dapat diklik langsung), sesuai smoke test Prompt 20.
- **New behavior:** `OPP-006` kini menampilkan tombol Mark as Won **disabled** dengan title "Client confirmation belum dicatat" sampai AE mencatat Client Confirmation lewat dialog baru di section Commercial Approval. Opportunity/Quotation lain yang sudah `won` (`OPP-001`/`002`/`003`/`008`) tidak terpengaruh — gerbang hanya berlaku pada tombol aksi, bukan data historis yang sudah `won`.
- **Risk:** Rendah — perubahan disengaja sesuai Wajib literal Section 05, bukan bug. Tidak ada Opportunity yang sudah `won` di-reset atau kehilangan data.
- **Regression checks:** `npm run build` sukses; smoke test konten (curl+grep) mengonfirmasi `OPP-006` menampilkan `disabled title="Client confirmation belum dicatat"` pada tombol Mark as Won; `OPP-001`/`002`/`003`/`004`/`005`/`007`/`008`/`009`/`010` tetap HTTP 200 tanpa string error.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-062.

## CI-035 — Bug Fix: `mock-reset.ts` Melempar `DataCloneError` Saat App Dimuat di Browser (Regresi Tersembunyi Sejak Section 01)

- **Change ID / Tanggal:** CI-035 · 2026-07-31
- **Triggering section:** Laporan bug user langsung ("500 Internal Server Error — Failed to execute 'structuredClone' on 'Window': [object Array] could not be cloned"), bukan section baku.
- **Previous section affected:** Section 01 — Frontend Foundation dan State Governance (COMPLETED, skema roadmap baru) — pemilik `app/utils/mock-reset.ts` dan `app/plugins/mock-reset.client.ts`.
- **Root cause:** `captureMockSnapshot()` (dipanggil dari plugin `mock-reset.client.ts` pada SETIAP page load di browser) memanggil `structuredClone()` langsung terhadap array `reactive()` (Vue Proxy) — `OPPORTUNITIES`, `QUOTATIONS`, `PARTIES`, `PROJECTS`, `VENDORS`, `TRAVELERS`, `LEADS`, dst. `structuredClone()` browser tidak dapat mengkloning objek `Proxy` (termasuk hasil `reactive()` Vue) karena bukan exotic Array/Object asli — selalu melempar `DataCloneError`. Direproduksi dan dikonfirmasi via Node (`structuredClone(reactive([...]))` throw persis pesan yang sama; `JSON.parse(JSON.stringify(...))` terhadap objek yang sama sukses).
- **Mengapa lolos tidak terdeteksi sejak Section 01 (2026-08-01):** Bug ini HANYA terjadi di **client plugin** (`.client.ts`), yang tidak pernah dieksekusi saat SSR. Seluruh smoke test sejak Section 01 memakai `curl` (HTML hasil SSR) — metode ini secara struktural tidak pernah menjalankan kode client-only, sehingga bug fatal yang membuat SELURUH app gagal mount di browser (bukan cuma satu halaman) tidak pernah terdeteksi selama 5 section berturut-turut (01–05). Dicatat eksplisit sebagai keterbatasan tooling yang sudah berulang kali disebutkan ("verifikasi interaktif tidak dilakukan headless") — kali ini keterbatasan tsb terbukti menyembunyikan bug nyata, bukan hanya risiko teoretis.
- **Files affected:** `app/utils/mock-reset.ts` (`captureMockSnapshot`/`resetMockState` — `structuredClone` diganti helper `deepClone` berbasis `JSON.parse(JSON.stringify(...))`, aman karena seluruh fixture adalah data JSON-safe murni tanpa `Date`/`Map`/`Set`/function).
- **Previous behavior:** App gagal mount di browser manapun (client-side fatal exception saat plugin dijalankan) — muncul sebagai halaman error generik ("500 Internal Server Error") meski SSR HTML awal terkirim normal (menjelaskan mengapa `curl` selalu melaporkan HTTP 200 di seluruh laporan section sebelumnya).
- **New behavior:** Snapshot berhasil dibuat tanpa error; `resetMockState()` ("Reset Demo Data", `/settings`) tetap berfungsi seperti didesain.
- **Risk:** Sangat rendah untuk fix ini sendiri (satu fungsi helper, tidak mengubah signature publik `captureMockSnapshot`/`resetMockState`/`hasMockSnapshot`). Risiko tinggi yang DIPERBAIKI: sebelumnya app tidak dapat dipakai sama sekali di browser nyata.
- **Regression checks:** Direproduksi dan diverifikasi lewat skrip Node (`structuredClone` vs `JSON`-based clone terhadap `reactive()` array Vue identik). `npm run build` dijalankan ulang setelah fix.
- **Dokumentasi yang diperbarui:** `docs/frontend-known-issues.md` (bagian baru).

## CI-036 — Gerbang "Mark as Won" Dipindah ke Level Data (`approveOpportunityWon`), Bukan Hanya UI

- **Change ID / Tanggal:** CI-036 · 2026-07-31
- **Triggering section:** Section 06 — Management Approval, Won dan Client Activation.
- **Previous section affected:** Section 05 (gerbang `clientConfirmedAt` awalnya hanya dicek di `submitMarkAsWon`, `/crm/opportunities/[id]`) dan Section 09 (`approveOpportunityWon`, pemilik asli mutator ini).
- **Alasan perubahan:** Section 06 Wajib literal "Seluruh permitted dan forbidden flow dapat diuji melalui role switcher" — forbidden flow (Mark as Won tanpa Commercial Approval/Client Confirmation) sebelumnya hanya dicegah lewat tombol `disabled` di UI, bukan benar-benar diblokir bila mutator dipanggil dari jalur lain.
- **Files affected:** `app/data/index.ts` (`approveOpportunityWon` +guard `quotation.approvalStatus === 'approved' && opportunity.clientConfirmedAt`, +`party.accountOwnerId` reaffirmation).
- **Previous behavior:** `approveOpportunityWon` hanya memvalidasi `stage === 'won-requested'` dan requirement dasar (destinasi/tanggal/traveler/quotation ada) — tidak memvalidasi status approval/confirmation quotation.
- **New behavior:** Memanggil `approveOpportunityWon` pada Opportunity yang quotation-nya belum `approved` atau `clientConfirmedAt` belum terisi sekarang mengembalikan `undefined` (gagal), sama seperti bila tombol UI disabled diklik paksa.
- **Risk:** Sangat rendah — guard hanya menambah kondisi penolakan pada path yang SEBELUMNYA sudah selalu dipanggil dengan kedua syarat terpenuhi (UI sudah menggerbanginya sejak Section 05). Data historis (`OPP-001`/`002`/`003`/`008`, sudah `won`) tidak tersentuh karena guard `stage !== 'won-requested'` mengembalikan lebih dulu.
- **Regression checks:** `npm run build` sukses; smoke test konten mengonfirmasi `OPP-006` tetap menampilkan tombol Mark as Won disabled (perilaku UI tidak berubah, kini didukung guard data); `OPP-001` (won lama) tetap menampilkan link "Lihat Project hasil konversi" tanpa perubahan.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-063.

## CI-037 — Bug Fix: AE Portfolio Scoping Tidak Bekerja untuk Lead dan Client di Customer Journey Dashboard

- **Change ID / Tanggal:** CI-037 · 2026-07-31
- **Triggering section:** Section 07 — Customer Journey.
- **Previous section affected:** Prompt 19 — Change Request (Customer Journey, Account Executive, Supplier, Commercial Approval), pemilik asli `/customer-journey/index.vue` dan literal "AE data scope ke portfolio miliknya".
- **Alasan perubahan:** Audit Section 07 menemukan `scopedLeads` (dashboard utama) untuk role `account-executive` mengembalikan SELURUH `LEADS` tanpa scoping apa pun (hanya role `sales` yang di-scope ke `ownerId`) — AE melihat angka Lead yang identik dengan Super Admin, bertentangan dengan Wajib literal Prompt 19-10/Section 07. "Active Clients" juga selalu dihitung dari seluruh `PARTIES` tanpa scoping AE sama sekali.
- **Files affected:** `app/pages/customer-journey/index.vue` (`scopedLeads` +cabang `account-executive` → filter `handedOverTo === currentUser.id`; `scopedParties` baru, dipakai `activeClientCount` dan funnel tahap "Client"), `app/data/index.ts` (`+getPartiesByAccountOwner`).
- **Previous behavior:** AE melihat "Lead Aktif"/"Lead Qualified"/"Active Clients" dengan angka yang sama persis dengan Super Admin (data seluruh sistem, bukan portfolio sendiri).
- **New behavior:** AE melihat angka Lead (via `handedOverTo`) dan Active Client (via `Party.accountOwnerId`) yang sudah ter-scope ke portfolio mereka sendiri — konsisten dengan Opportunity/Project Order yang SUDAH ter-scope benar sejak awal.
- **Risk:** Rendah — perbaikan aditif pada computed existing, tidak mengubah struktur data atau route. Role selain AE (Super Admin/Management/Sales/Viewer) tidak terpengaruh (cabang `else` tetap mengembalikan data penuh seperti semula).
- **Regression checks:** `npm run build` sukses; smoke test konten mengonfirmasi funnel/stat card tetap menampilkan angka penuh untuk role default (Super Admin: Lead 10, Client 3) — regresi terhadap perilaku Super Admin/role lain dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-064.

## CI-038 — Client Kini Dapat Mengonfirmasi Quotation Sendiri (Self-Service), Melengkapi Gap Section 05

- **Change ID / Tanggal:** CI-038 · 2026-07-31
- **Triggering section:** Section 08 — Client Portal.
- **Previous section affected:** Section 05 — Account Executive Opportunity dan Quotation (pemilik asli `recordClientConfirmation`, sebelumnya hanya dipanggil dari UI AE-facing di `/crm/opportunities/[id]`).
- **Alasan perubahan:** Section 08 Wajib "Quotation view, revision request, accept/reject confirmation mock" secara literal meminta Client dapat mengonfirmasi quotation-nya sendiri — `recordClientConfirmation` (mutator generik, menerima `actorId` apa pun) sudah cukup untuk ini tanpa perubahan signature, hanya perlu titik akses baru dari `/client/opportunities/[id]`.
- **Files affected:** `app/pages/client/opportunities/[id]/index.vue` (baru — memanggil `recordClientConfirmation(opportunityId, currentUser.id, note)` saat Client klik "Setujui Quotation").
- **Previous behavior:** Client confirmation hanya bisa dicatat AE secara manual (mewakili Client) dari Opportunity Detail internal — Client sendiri tidak punya akses sama sekali ke tindakan ini (dicatat eksplisit sebagai known-issue Section 05: "AE mencatat client confirmation secara manual, bukan self-service client").
- **New behavior:** Client dapat login ke `/client/opportunities/[id]` dan mengonfirmasi (atau menyatakan keberatan) quotation-nya sendiri. AE tetap dapat mencatat manual sebagai fallback (tombol existing di Opportunity Detail tidak dihapus/diubah) — dua jalur ke mutator yang sama, bukan duplikasi logic.
- **Risk:** Rendah — `recordClientConfirmation` tidak diubah sama sekali (signature, guard, efek samping identik). Risiko utama (Client mengklaim identitas lain) dimitigasi oleh isolasi `clientScopeId` yang memastikan Client hanya bisa memanggil aksi ini untuk Opportunity milik company-nya sendiri.
- **Regression checks:** `npm run build` sukses; smoke test route `/client/opportunities/OPP-001` dan `/crm/opportunities/OPP-006` (AE-facing, existing) keduanya tetap HTTP 200 tanpa perubahan perilaku existing.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-065.

## CI-039 — Bug Fix: Link "Opportunity Asal" di Project Detail Overview Mengarah ke List, Bukan Detail Spesifik

- **Change ID / Tanggal:** CI-039 · 2026-07-31
- **Triggering section:** Section 09 — Project Order dan Handover.
- **Previous section affected:** Section 10 — Project Core (pemilik asli tab Overview `/projects/[id]/index.vue`).
- **Alasan perubahan:** Audit Section 09 ("Source Opportunity dan approved Quotation" Wajib) menemukan link "Project ini berasal dari opportunity {{ project.opportunityId }}" mengarah ke `/crm/opportunities` (halaman list, statis, tidak memakai `project.opportunityId` sama sekali) — bukan ke Opportunity spesifiknya. Bug kecil, ditemukan dan diperbaiki bersamaan saat menambahkan referensi Quotation approved di section yang sama.
- **Files affected:** `app/pages/projects/[id]/index.vue` (`to="/crm/opportunities"` → `` `to=\`/crm/opportunities/${project.opportunityId}\`` ``).
- **Previous behavior:** Klik link "opportunity {{ ID }}" selalu membuka `/crm/opportunities` (list lengkap), user harus mencari sendiri opportunity yang dimaksud.
- **New behavior:** Klik link langsung membuka `/crm/opportunities/{{ id }}` (detail spesifik).
- **Risk:** Sangat rendah — satu baris, murni memperbaiki URL yang salah, tidak ada logic lain yang berubah.
- **Regression checks:** `npm run build` sukses; smoke test `/projects/PRJ-101` mengonfirmasi href baru `/crm/opportunities/OPP-001` (dikonfirmasi via curl+grep).
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-066.

## CI-040 — Product Planning dan Costing Menambahkan Referensi Aditif ke Quotation, Opportunity Detail, Dashboard Widget Product Planner, dan Matrix Role

- **Change ID / Tanggal:** CI-040 · 2026-07-31
- **Triggering section:** Section 10 — Product Planning dan Costing.
- **Previous section affected:** Section 05/08 (`app/types/opportunity.ts`, pemilik asli `Quotation`), Section 08 (pemilik asli halaman Opportunity Detail), Section 02 (pemilik asli widget welcome Product Planner di Dashboard dan kolom Matrix Role `/admin/roles`).
- **Alasan perubahan:** Section 10 Wajib "Snapshot konsep ketika dipakai pada quotation/project" dan "Collaboration dengan AE, Operations, Finance" mensyaratkan traceability dari `Quotation` kembali ke `CostSheet` sumbernya, dan titik kolaborasi yang terlihat di Opportunity Detail (bukan hanya di modul Product Planning terpisah). Widget Dashboard Product Planner (Section 02, CI-030) sebelumnya eksplisit berkata "modul dedicated belum tersedia" — kini modulnya ada, widget usang tersebut wajib diperbarui. Matrix Role (`/admin/roles`) memakai daftar `modules` hardcoded yang harus disinkronkan dengan `ModuleKey` baru agar kolom baru tidak hilang dari tampilan.
- **Files affected:** `app/types/opportunity.ts` (`Quotation` +`costSheetId?: ID`, aditif, opsional), `app/pages/crm/opportunities/[id]/index.vue` (+SectionCard "Product Planning & Costing" ringkasan Cost Sheet sebelum SectionCard Quotation, +import 2 selector), `app/pages/index.vue` (SectionCard "Product Planning dan Costing" menggantikan "Referensi Costing" placeholder), `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['product-planner']`/`['account-executive']`).
- **Previous behavior:** `Quotation` tidak punya field `costSheetId`; Opportunity Detail tidak menampilkan apa pun terkait costing internal; widget Dashboard Product Planner mengarahkan ke `/crm/opportunities` dengan pesan "modul belum tersedia"; Matrix Role hanya menampilkan 7 kolom modul.
- **New behavior:** `Quotation.costSheetId` terisi otomatis saat `applyCostSheetToQuotation` dipanggil (opsional, tidak mengubah quotation lama manapun — seluruh `QUOTATIONS` existing tetap `undefined` kecuali QUO-001/QUO-002 yang di-backfill via fixture `CS-001`/`CS-002`); Opportunity Detail menampilkan ringkasan Cost Sheet + link "Buat Cost Sheet"; widget Dashboard dan Matrix Role kini mengarah ke modul nyata.
- **Risk:** Rendah — seluruh perubahan aditif (field opsional baru, SectionCard baru, 1 baris array, teks). Tidak ada field/komponen/route existing yang dihapus atau diubah maknanya. `Quotation` yang tidak pernah disentuh `applyCostSheetToQuotation` (mayoritas fixture existing) berperilaku identik seperti sebelumnya.
- **Regression checks:** `npm run build` sukses 2x; smoke test konten mengonfirmasi `/crm/opportunities/OPP-001` (Won, Cost Sheet applied) menampilkan badge "Applied" dan `/crm/opportunities/OPP-009` (belum ada Quotation) menampilkan 2 Cost Sheet draft (Economy/Premium Scenario); `/admin/roles` menampilkan kolom "Product Planning"; regresi tab lain Opportunity Detail dan halaman Dashboard/Matrix Role lain dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-067.

## CI-041 — `importTravelersMock` (Section 11 Lama) Dihapus, Digantikan Alur Preview+Commit; Form Traveler Client Portal Diperkaya

- **Change ID / Tanggal:** CI-041 · 2026-07-31
- **Triggering section:** Section 11 — Traveler dan Travel Documents (roadmap Section 00–24 baru).
- **Previous section affected:** Section 11 lama/Prompt 11 (pemilik asli `importTravelersMock` dan tab Travelers `/projects/[id]`), Section 08 (pemilik asli form traveler self-submission `/client/project-orders/[id]`).
- **Alasan perubahan:** Section 11 baru Wajib literal "Bulk import preview dan error report mock" — `importTravelersMock` lama langsung membuat baris tanpa tahap preview/validasi, tidak memenuhi literal ini. Field dokumen baru (ID/visa/dietary/accessibility) perlu tersedia juga di form self-submission Client Portal agar traveler data tetap satu sumber kebenaran yang konsisten (Wajib acceptance "Traveler data digunakan konsisten").
- **Files affected:** `app/data/index.ts` (`importTravelersMock` DIHAPUS, `+previewTravelerImportMock`, `+commitTravelerImport`, `+toggleTravelerVerification`, `+getTravelerReadiness`, `CreateTravelerInput` +6 field), `app/pages/projects/[id]/index.vue` (tombol "Import (Mock)" kini membuka dialog preview, bukan langsung membuat baris), `app/pages/client/project-orders/[id]/index.vue` (form traveler +5 field baru: ID/visa/visa-expiry/dietary/accessibility).
- **Previous behavior:** Klik "Import (Mock)" langsung membuat 3 baris traveler kosong (dokumen belum lengkap) tanpa langkah konfirmasi. Form traveler Client Portal hanya punya passport/emergency contact/special request.
- **New behavior:** Klik "Import (Mock)" membuka dialog preview 5 baris (sebagian sengaja mengandung error — nama kosong/paspor duplikat), user meninjau error report lalu menekan "Import Baris Valid (N)" untuk benar-benar membuat baris (hanya yang valid). Form traveler Client Portal kini punya field yang sama lengkapnya dengan form internal (kecuali companion/verification yang tetap internal-only).
- **Risk:** Rendah — `importTravelersMock` hanya dipanggil dari satu titik (sudah diperbarui bersamaan), tidak ada consumer lain yang patah. Field baru pada form Client Portal aditif (opsional), tidak mengubah field existing.
- **Regression checks:** `npm run build` sukses 2x; smoke test konten mengonfirmasi tab Travelers `/projects/PRJ-101`/`102`/`103` menampilkan readiness indicator dan badge verifikasi/dokumen yang cocok dengan fixture baru (dihitung ulang manual); regresi tab lain Project Detail dan Client Portal dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-068.

## CI-042 — Client Portal Itinerary Kini Difilter `visibleToClient`; Tab Itinerary & Services dan Tasks (Section 12 Lama/Section 09) Diperkaya Total

- **Change ID / Tanggal:** CI-042 · 2026-08-01
- **Triggering section:** Section 12 — Itinerary, Operations, Tasks dan Readiness (roadmap Section 00–24 baru).
- **Previous section affected:** Section 08 (pemilik asli tab Itinerary `/client/project-orders/[id]`), Section 12 lama/Prompt 12 (pemilik asli tab Itinerary & Services `/projects/[id]`), Section 09 (pemilik asli tab Tasks `/projects/[id]`).
- **Alasan perubahan:** Section 12 baru Wajib literal "Internal vs client-shared itinerary" — item operasional internal (mis. briefing tim) tidak boleh terlihat Client. Sebelumnya `/client/project-orders/[id]` memakai `getItineraryItems` mentah (menampilkan SEMUA item tanpa filter apa pun) — satu-satunya perubahan pada halaman Client Portal ini adalah mengganti selector, bukan mengubah UI/field lain.
- **Files affected:** `app/pages/client/project-orders/[id]/index.vue` (`getItineraryItems` → `getClientVisibleItineraryItems`), `app/pages/projects/[id]/index.vue` (tab Itinerary & Services +4 SectionCard baru, tab Tasks +toggle blocker), `app/data/projects.ts` (+3 `ItineraryItem` internal-only baru, backfill `timezone`), `app/data/activity.ts` (+`SHIFT_NOTES`, `TSK-1021` di-backfill `isBlocked`).
- **Previous behavior:** Client Portal menampilkan seluruh itinerary tanpa pengecualian; tab Itinerary & Services `/projects/[id]` tidak punya readiness/attention/shift-note apa pun; Tasks tidak punya konsep blocker.
- **New behavior:** Client Portal hanya menampilkan item `visibleToClient !== false` (3 item baru sengaja disembunyikan, item lama tetap tampil seperti sebelumnya — `undefined` diperlakukan sebagai `true`). Tab internal menampilkan Departure Readiness Gate, Service Readiness Matrix, Attention/Exception Queue, dan On-Trip Updates/Shift Notes baru; Tasks menampilkan badge dan toggle Blocked.
- **Risk:** Rendah — filter aditif (item lama tanpa `visibleToClient` tetap `true`/tampil, tidak ada yang tiba-tiba hilang dari Client Portal kecuali 3 item baru yang memang sengaja dibuat internal). SectionCard baru di tab internal ditambahkan, tidak ada yang dihapus.
- **Regression checks:** `npm run build` sukses 2x; smoke test konten mengonfirmasi `/client/project-orders/PRJ-102?tab=itinerary` TIDAK menampilkan "Serah Terima Room Block..." (item internal baru) TAPI tetap menampilkan "Corporate Gathering" (item lama); regresi tab lain Project Detail dan Client Portal dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-069.

## CI-043 — Ticketing Menambahkan Ringkasan Flight Booking di Tab Itinerary & Services, Kolom Matrix Role

- **Change ID / Tanggal:** CI-043 · 2026-08-01
- **Triggering section:** Section 13 — Ticketing.
- **Previous section affected:** Section 12 lama/Foundation (pemilik asli tab "Itinerary & Services" dan model `ProjectService`), Section 02/17 lama (pemilik asli Matrix Role `/admin/roles`).
- **Alasan perubahan:** Section 13 Wajib "Segments dan traveler assignment" dan acceptance "Ticketing role dapat mengelola flight" perlu titik akses yang terlihat DI DALAM konteks satu project (bukan hanya dari modul `/ticketing` terpisah) — SectionCard "Flight Bookings" ditambahkan sebagai ringkasan+link, bukan duplikasi data (`ProjectService` tidak diubah shape-nya).
- **Files affected:** `app/pages/projects/[id]/index.vue` (+blok "Flight Bookings" di sub-section flight, +import `getFlightBookingsByProject`/`FLIGHT_BOOKING_STATUSES`), `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['ticketing']`).
- **Previous behavior:** Sub-section flight tab Itinerary & Services hanya menampilkan tabel `ProjectService` generik (label/vendor/booking reference/status); Matrix Role hanya 9 kolom modul.
- **New behavior:** Sub-section flight kini juga menampilkan daftar `FlightBooking` terkait (PNR/status/traveler count) dengan link ke `/ticketing/[id]`, dan tombol "Buat Flight Booking" (prefill `projectId`). Matrix Role menampilkan kolom "Ticketing" baru.
- **Risk:** Rendah — seluruh perubahan aditif (blok baru, 1 baris array, teks). `ProjectService`/tabel existing tidak diubah/dihapus.
- **Regression checks:** `npm run build` sukses; smoke test konten mengonfirmasi `/projects/PRJ-101?tab=itinerary-services` menampilkan Flight Booking FLT-1011 dengan status "Issued", `/admin/roles` menampilkan kolom "Ticketing"; regresi tab lain Project Detail dan halaman Matrix Role lain dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-070.

---

## CI-044 — Accommodation Menambahkan Ringkasan Hotel Booking di Tab Itinerary & Services, Kolom Matrix Role

- **Change ID / Tanggal:** CI-044 · 2026-08-01
- **Triggering section:** Section 14 — Accommodation.
- **Previous section affected:** Section 12 lama/Foundation (pemilik asli tab "Itinerary & Services" dan model `ProjectService`), Section 02/17 lama (pemilik asli Matrix Role `/admin/roles`), Section 11 (pemilik asli `TravelerGroup`/`RoomAssignment`/`Traveler.specialRequest` yang direuse read-only oleh Hotel Booking Detail).
- **Alasan perubahan:** Section 14 Wajib "Room block, occupancy, rooming list" dan acceptance "Accommodation role dapat menangani individual maupun group" perlu titik akses yang terlihat DI DALAM konteks satu project (bukan hanya dari modul `/accommodation` terpisah) — SectionCard "Hotel Bookings" ditambahkan sebagai ringkasan+link, bukan duplikasi data (`ProjectService` tidak diubah shape-nya); rooming list Hotel Booking Detail membaca `RoomAssignment` existing lewat `getHotelRoomingList` (read-only, tidak menulis).
- **Files affected:** `app/pages/projects/[id]/index.vue` (+blok "Hotel Bookings" di sub-section hotel, +import `getHotelBookingsByProject`/`HOTEL_BOOKING_STATUSES`), `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['accommodation']`).
- **Previous behavior:** Sub-section hotel tab Itinerary & Services hanya menampilkan tabel `ProjectService` generik (label/vendor/booking reference/status); Matrix Role hanya 10 kolom modul (setelah Section 13).
- **New behavior:** Sub-section hotel kini juga menampilkan daftar `HotelBooking` terkait (konfirmasi/status/traveler count) dengan link ke `/accommodation/[id]`, dan tombol "Buat Hotel Booking" (prefill `projectId`). Matrix Role menampilkan kolom "Accommodation" baru.
- **Risk:** Rendah — seluruh perubahan aditif (blok baru, 1 baris array, teks). `ProjectService`/`TravelerGroup`/`RoomAssignment`/`Traveler`/tabel existing tidak diubah/dihapus.
- **Regression checks:** `npm run build` sukses; smoke test konten mengonfirmasi `/projects/PRJ-102?tab=itinerary-services` menampilkan Hotel Booking HTL-1022 dengan status "Amended" dan konfirmasi "AUH-A104", `/admin/roles` menampilkan kolom "Accommodation"; regresi tab lain Project Detail, tab Travelers (rooming list Section 11), dan halaman Matrix Role lain dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-071.

---

## CI-045 — Transportation Menambahkan Ringkasan Transport Booking di Tab Itinerary & Services, Kolom Matrix Role

- **Change ID / Tanggal:** CI-045 · 2026-08-01
- **Triggering section:** Section 15 — Transportation.
- **Previous section affected:** Section 12 lama/Foundation (pemilik asli tab "Itinerary & Services" dan model `ProjectService`), Section 02/17 lama (pemilik asli Matrix Role `/admin/roles`), Section 13 lama (pemilik asli `VendorQuotation` SVC-1034, TIDAK diubah statusnya).
- **Alasan perubahan:** Section 15 Wajib "Manifest/group allocation" dan acceptance "Transportation role dapat merencanakan dan menutup seluruh service" perlu titik akses yang terlihat DI DALAM konteks satu project (bukan hanya dari modul `/transportation` terpisah) — SectionCard "Transport Bookings" ditambahkan sebagai ringkasan+link, bukan duplikasi data (`ProjectService` tidak diubah shape-nya).
- **Files affected:** `app/pages/projects/[id]/index.vue` (+blok "Transport Bookings" di sub-section transportation, +import `getTransportBookingsByProject`/`TRANSPORT_BOOKING_STATUSES`), `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['transportation']`).
- **Previous behavior:** Sub-section transportation tab Itinerary & Services hanya menampilkan tabel `ProjectService` generik (label/vendor/booking reference/status); Matrix Role hanya 11 kolom modul (setelah Section 14).
- **New behavior:** Sub-section transportation kini juga menampilkan daftar `TransportBooking` terkait (unit/status/traveler count) dengan link ke `/transportation/[id]`, dan tombol "Buat Transport Booking" (prefill `projectId`). Matrix Role menampilkan kolom "Transportation" baru.
- **Risk:** Rendah — seluruh perubahan aditif (blok baru, 1 baris array, teks). `ProjectService`/`TravelerGroup`/`VendorQuotation`/tabel existing tidak diubah/dihapus.
- **Regression checks:** `npm run build` sukses; smoke test konten mengonfirmasi `/projects/PRJ-103?tab=itinerary-services` menampilkan Transport Booking `TRN-1034` s/d `TRN-1038` dengan status masing-masing, `/admin/roles` menampilkan kolom "Transportation"; regresi tab lain Project Detail dan halaman Matrix Role lain dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-072.

---

## CI-046 — MICE Menambahkan Ringkasan MICE Event di Tab Itinerary & Services, Kolom Matrix Role

- **Change ID / Tanggal:** CI-046 · 2026-08-01
- **Triggering section:** Section 16 — MICE dan Event.
- **Previous section affected:** Section 12 lama/Foundation (pemilik asli tab "Itinerary & Services" dan model `ProjectService`), Section 02/17 lama (pemilik asli Matrix Role `/admin/roles`), Section 09/12 lama (pemilik asli `RSK-1031`/`TSK-1032`/`TSK-1033`/`SFT-1032`, HANYA dirujuk secara naratif, TIDAK diubah).
- **Alasan perubahan:** Section 16 acceptance "MICE role dapat mengelola event dari planning sampai post-event completion" perlu titik akses yang terlihat DI DALAM konteks satu project (bukan hanya dari modul `/mice` terpisah) — SectionCard "MICE Events" ditambahkan sebagai ringkasan+link, bukan duplikasi data (`ProjectService` tidak diubah shape-nya).
- **Files affected:** `app/pages/projects/[id]/index.vue` (+blok "MICE Events" di sub-section mice, +import `getMiceEventsByProject`/`MICE_EVENT_STATUSES`), `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['mice']`).
- **Previous behavior:** Sub-section mice tab Itinerary & Services hanya menampilkan tabel `ProjectService` generik; Matrix Role hanya 12 kolom modul (setelah Section 15).
- **New behavior:** Sub-section mice kini juga menampilkan daftar `MiceEvent` terkait (venue/status/jumlah sesi/pax) dengan link ke `/mice/[id]`, dan tombol "Buat MICE Event" (prefill `projectId`). Matrix Role menampilkan kolom "MICE" baru.
- **Risk:** Rendah — seluruh perubahan aditif (blok baru, 1 baris array, teks). `ProjectService`/`TravelerGroup`/`Vendor`/`RSK-1031`/`TSK-1032`/`1033`/tabel existing tidak diubah/dihapus.
- **Regression checks:** `npm run build` sukses; smoke test konten mengonfirmasi `/projects/PRJ-103?tab=itinerary-services` menampilkan MICE Event `MICE-1035` dengan status "In Progress", `/admin/roles` menampilkan kolom "MICE"; regresi tab lain Project Detail dan halaman Matrix Role lain dikonfirmasi tidak berubah.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-073.

---

## CI-047 — Procurement Menambahkan Ekstensi Aditif ke Vendor Directory, Supplier Portal, Project Detail, Matrix Role, Nav, dan ModuleKey

- **Change ID / Tanggal:** CI-047 · 2026-08-01
- **Triggering section:** Section 17 — Supplier dan Procurement.
- **Previous section affected:** Section 13 lama (pemilik asli `/vendors`, `Vendor`, `app/data/vendors.ts`); Prompt 19 (pemilik asli `/supplier`, Supplier Portal, vendor isolation `vendorScopeId`); Section 12 lama/Foundation (pemilik asli tab Project Detail); Section 02/17 lama (pemilik asli Matrix Role `/admin/roles`, `ModuleKey`, `ROLE_MODULE_ACCESS`, `NAV_ITEMS`).
- **Alasan perubahan:** Section 17 acceptance "Procurement dan Supplier dapat menjalankan sourcing sampai fulfillment handoff" membutuhkan titik integrasi aditif ke lima area existing: (1) `Vendor` diperluas `category`/`status`/`documents` (Wajib literal "Supplier companies, contacts, categories, documents, status"), (2) Supplier Portal diperluas RFQ Inbox/Service Order Inbox/Invoice Submission (Wajib literal "Supplier dashboard dan portal... invoice submission preview"), (3) Project Detail mendapat ringkasan RFQ/Service Order (pola sama CI-043/044/045/046), (4) Matrix Role +kolom `procurement`, (5) `ModuleKey`+`NAV_ITEMS`+`ROLE_MODULE_ACCESS` +`procurement`. Seluruhnya mengikuti pola aditif yang sama seperti CI-043/044/045/046 (Ticketing/Accommodation/Transportation/MICE menambahkan ringkasan+kolom matrix serupa untuk section masing-masing).
- **Files affected:** `app/types/vendor.ts` (+`category`/`status`/`documents` pada `Vendor`, +`VendorDocument`, `VendorDetailTab` +`documents`), `app/data/vendors.ts` (+`VENDOR_DOCUMENTS`, backfill `category`/`status` seluruh 7 vendor existing), `app/pages/vendors/index.vue` (+kolom Kategori/Status, +field kategori di form Tambah Vendor), `app/pages/vendors/[id]/index.vue` (+tab "Documents", +dialog Edit Kategori/Status), `app/pages/supplier/index.vue` (+2 stat card, +2 link card RFQ Inbox/Service Orders), `app/pages/projects/[id]/index.vue` (+SectionCard "Procurement — RFQ dan Service Order" di sub-section Itinerary & Services, +import `getServiceOrdersByProject`/`getRfqsByProject`), `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['procurement']`), `app/types/user.ts` (`ModuleKey` +`procurement`), `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `procurement` seluruh 16 role), `app/constants/navigation.ts` (+menu "Procurement" 3-child, +2 child Supplier Portal "RFQ Inbox"/"Service Orders").
- **Previous behavior:** `Vendor` hanya `id`/`name`/`serviceType`/`contactName`/`contactPhone` (5 field), Vendor Detail 5 tab tanpa Documents; Supplier Portal dashboard hanya 2 link card (Products/Orders); Project Detail sub-section Itinerary & Services tidak punya blok Procurement; Matrix Role 13 kolom modul (setelah Section 16); Supplier Portal nav hanya 2 child.
- **New behavior:** `Vendor` +3 field aditif (opsional, seluruh 7 vendor existing di-backfill `status: 'active'`, `category` terisi deskriptif — regression-safe, tidak ada consumer existing yang bergantung pada field ini tidak ada); Vendor Detail 6 tab; Supplier Portal dashboard 4 link card; Project Detail menampilkan RFQ/Service Order terhubung (bila ada) dengan link ke `/procurement/*`; Matrix Role 14 kolom modul; Supplier Portal nav 4 child.
- **Risk:** Rendah. Seluruh perubahan aditif — field/tab/kolom/nav-item baru, tidak ada field/tab/kolom/route existing yang dihapus atau diubah shape/perilakunya. `VendorContact`/`VendorQuotation`/`VendorActivity`/`VendorProduct` (Section 13 lama/Prompt 19) TIDAK disentuh. `getServicesByVendor`/`submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation` (Section 13 lama) TIDAK diubah signature/perilakunya.
- **Regression checks:** `npx nuxi prepare` + `npm run build` sukses (2x run, termasuk setelah perbaikan default clarification thread). Smoke test konten (curl+grep) mengonfirmasi `/vendors` menampilkan kolom Kategori/Status baru, `/vendors/VND-006?tab=documents` menampilkan dokumen PT ABC, `/supplier` menampilkan 4 link card, `/projects/PRJ-103?tab=itinerary-services` menampilkan blok "Procurement — RFQ dan Service Order" dengan RFQ-004, `/admin/roles` menampilkan kolom "Procurement"; regresi `/vendors/VND-002` (vendor existing tanpa dokumen), `/supplier/products`, `/supplier/orders`, `/projects/PRJ-101`/`PRJ-102` (tab lain), `/accommodation`, `/transportation`, `/mice`, `/ticketing` dikonfirmasi tetap HTTP 200 tanpa perubahan konten existing.
- **Dokumentasi yang diperbarui:** `docs/mockup-design-decisions.md` D-074, `docs/mockup-data-scenarios.md` (bagian baru), `docs/frontend-known-issues.md` bagian 12/13, `docs/mockup-open-questions.md` Q12 (RESOLVED), `docs/mockup-implementation-state.md`, `docs/mockup-section-reports/section-17-supplier-procurement.md`.

---

*(Entri berikutnya akan ditambahkan begitu sebuah section mengubah hasil section sebelumnya — lihat protokol bagian C untuk kriteria kapan perubahan section lama diperbolehkan.)*

