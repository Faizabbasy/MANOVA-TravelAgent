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

*(Entri berikutnya akan ditambahkan begitu sebuah section mengubah hasil section sebelumnya — lihat protokol bagian C untuk kriteria kapan perubahan section lama diperbolehkan.)*
