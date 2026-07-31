# Section Report — Section 05: Account Executive Opportunity dan Quotation

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/Section 05 — Account Executive Opportunity dan Quotation.md`. Section keenam roadmap Section 00–24 baru, dijalankan setelah Section 04 (Sales Leads dan Qualification, COMPLETED). Sesi ini melanjutkan pekerjaan yang sudah sebagian dimulai (type field dan mutator `app/data/index.ts`/`app/types/opportunity.ts` sudah ada di working tree sebelum sesi ini dilanjutkan) — tidak mengulang bagian yang sudah selesai, hanya melengkapi UI wiring, fixture demo, dan dokumentasi yang belum ada.

---

## 1. Section Objective dan Scope

"Lengkapi workflow Account Executive." Wajib: Assigned Leads dan Opportunity pipeline/detail; Requirement detail dan completion indicator; AE dapat edit requirement tanpa menghapus qualification history; Product/service scope, traveler composition, preferences, payment terms, risks, commercial/operational notes; Quotation create/edit/version/duplicate/compare/send mock/revise/withdraw; Line items, taxes/fees, markup, discount, currency, validity, terms, inclusions/exclusions; PDF/print preview frontend; Approval submission ke Management; Stage dan activity history; AE dapat Mark as Lost; AE belum dapat Mark as Won sebelum approved + client confirmation. Acceptance: AE dapat menyelesaikan requirement dan quotation sampai siap approval.

## 2. Source Documents yang Dibaca

`prompts/Section 05 — Account Executive Opportunity dan Quotation.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-04-*.md`, source code aktual (`app/pages/crm/opportunities/[id]/index.vue`, `app/types/opportunity.ts`, `app/data/index.ts`, `app/data/opportunities.ts`), `git status`, `git diff`.

## 3. Existing Implementation yang Diperiksa

`git status`/`git diff` di awal sesi menunjukkan pekerjaan Section 05 **sudah sebagian dimulai** pada sesi sebelumnya (uncommitted): `app/types/opportunity.ts` sudah punya 7 field baru pada `Quotation` (`taxIdr`/`markupIdr`/`currency`/`validUntil`/`termsAndConditions`/`inclusions`/`exclusions`/`sentToClientAt`) dan 2 field baru pada `Opportunity` (`clientConfirmedAt`/`clientConfirmationNote`); `app/data/index.ts` sudah punya 4 mutator baru (`duplicateQuotationVersion`, `sendQuotationToClient`, `withdrawQuotationSubmission`, `recordClientConfirmation`) dan `QuotationDetailInput` sudah diperluas dengan 7 field baru. **Namun** `app/pages/crm/opportunities/[id]/index.vue` (UI) dan `app/data/opportunities.ts` (fixture demo) **belum menggunakan** field/mutator baru ini sama sekali — layer data sudah siap tapi tidak ada satu pun tombol/form/display yang memanggilnya. Audit mengonfirmasi mayoritas Wajib lain sudah COMPLETED sejak Section 08/Prompt 20: Assigned Leads dan Opportunity pipeline/detail (`/crm/opportunities`, existing), Requirement Detail 14 field + completion indicator (existing), edit requirement tanpa menghapus qualification history (existing, `updateOpportunityRequirement`), product/service scope/traveler composition/preferences/payment terms/risks/commercial-operational notes (seluruhnya sudah field `OpportunityRequirementDetail`, existing), Quotation create/edit/version/revise (existing), line items/service breakdown (existing), submit approval ke Management (existing, Commercial Approval Prompt 19), stage dan activity history (existing), Mark as Lost (existing, tombol "Tandai Lost").

**Gap konkret yang dikerjakan sesi ini:** UI wiring untuk Duplicate/Compare/Send to Client/Withdraw/field komersial baru/Client Confirmation (layer data sudah ada, layer UI belum), halaman PDF/Print Preview baru (belum ada sama sekali), fixture demo yang mendemonstrasikan field/aksi baru (belum ada), dan gerbang "Mark as Won" yang belum mensyaratkan `clientConfirmedAt` (kode existing hanya mengecek `approvalStatus === 'approved'`).

## 4. Decisions yang Digunakan

D-062 (`docs/mockup-design-decisions.md`, baru) — Quotation Compare terbatas pada nilai total (bukan histori breakdown penuh per versi, mengikuti keterbatasan model `Quotation` existing sejak Section 08); Client Confirmation sebagai gerbang terpisah dari Commercial Approval, keduanya disyaratkan sebelum Mark as Won.

## 5. Implementation Summary

**Edit Quotation** — dialog diperluas dengan 6 field baru: Tax/Fee, Markup, Currency, Valid Until, Inclusions (textarea), Exclusions (textarea), Terms & Conditions (textarea). Refs baru (`editQuotationTax`/`editQuotationMarkup`/`editQuotationCurrency`/`editQuotationValidUntil`/`editQuotationInclusions`/`editQuotationExclusions`/`editQuotationTerms`) di-passing ke `updateQuotationDetails` (mutator existing, sudah menerima field ini).

**Duplicate Quotation** — tombol baru di section actions Quotation (tampil saat `approvalStatus` draft), memanggil `duplicateQuotationVersion` langsung (tanpa dialog konfirmasi tambahan — konsisten pola aksi ringan seperti "Reopen" Section 04), toast konfirmasi.

**Compare Versions** — panel toggle "Bandingkan dengan versi sebelumnya" di bawah nilai quotation (tampil hanya bila `supersededAmountIdr` ada), menampilkan grid 2 kolom (versi sebelumnya vs versi saat ini) + disclaimer eksplisit bahwa hanya nilai total yang dibandingkan (bukan breakdown/discount/tax/markup penuh per versi — keterbatasan model data, bukan bug).

**Send to Client / Withdraw** — di section "Commercial Approval": saat `approvalStatus === 'submitted'`, AE (`canManageOpportunity`) melihat tombol "Withdraw Submission" di samping pesan menunggu; saat `approvalStatus === 'approved'`, section baru "Send to Client" (tombol, badge status terkirim + tanggal) dan "Client Confirmation" (status confirmed atau dialog "Catat Client Confirmation").

**Client Confirmation & gerbang Mark as Won** — dialog baru memanggil `recordClientConfirmation(opportunityId, actorId, note?)`. `submitMarkAsWon` dan `:disabled` tombol Mark as Won diperbarui: sebelumnya hanya mengecek `quotation.approvalStatus !== 'approved'`, kini juga mengecek `!opportunity.clientConfirmedAt` — pesan bantuan (`title`/teks di bawah tombol) menjelaskan gerbang mana yang belum terpenuhi.

**PDF/Print Preview** — halaman baru `app/pages/crm/opportunities/[id]/quotation-preview.vue` (`layout: false`, `middleware: 'auth'`, gate `canView('crm')`), menampilkan dokumen quotation print-friendly (header MANOVA, Bill To, Trip Detail, tabel service breakdown, subtotal/discount/tax/markup/total, inclusions/exclusions/payment terms/terms and conditions, disclaimer "dokumen mock"). Tombol "Print / Save as PDF" memanggil `window.print()` browser (bukan generator PDF nyata — sesuai batasan protokol dilarang integrasi/generator produksi). Not-found state (opportunity/quotation tidak ada) dan `RoleAccessState` untuk role tanpa akses `crm`. Link "PDF / Print Preview" ditambahkan di section actions Quotation Opportunity Detail (`target="_blank"`, terlihat oleh siapa pun yang bisa melihat quotation, bukan hanya AE).

**Fixture demo** — `QUO-010` (draft terlengkap, existing sejak Prompt 20) dilengkapi tax/markup/currency/validUntil/inclusions/exclusions/termsAndConditions — mendemokan "Edit Quotation" dan "PDF/Print Preview" penuh. `QUO-006` (approved, existing) mendapat `sentToClientAt` TAPI `Opportunity.clientConfirmedAt` sengaja TIDAK diisi — mendemokan gerbang baru Mark as Won secara nyata pada skenario yang sebelumnya (Prompt 20) didemokan sebagai "siap Mark as Won langsung" (lihat Cross-Section Impact, CI-034).

## 6. Routes

`/crm/opportunities/[id]/quotation-preview` — **baru**. `/crm/opportunities/[id]` — fitur baru pada route yang sama (tidak ada route baru untuk detail).

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/pages/crm/opportunities/[id]/quotation-preview.vue`
- `docs/mockup-section-reports/section-05-ae-opportunity-quotation.md` (laporan ini)

**Changed:**
- `app/pages/crm/opportunities/[id]/index.vue` (+import 4 mutator baru, +refs/handler Edit Quotation 7 field baru, +Duplicate Quotation, +Compare Versions panel, +Withdraw Submission, +Send to Client, +Client Confirmation dialog, +gerbang `clientConfirmedAt` pada Mark as Won, +link PDF/Print Preview)
- `app/data/opportunities.ts` (`QUO-010` +7 field komersial; `QUO-006` +`sentToClientAt`)
- `app/types/opportunity.ts`, `app/data/index.ts` — sudah diubah pada sesi sebelumnya (lihat bagian 3), tidak diubah lebih lanjut pada sesi ini kecuali diverifikasi konsisten dengan UI baru
- `docs/mockup-design-decisions.md` (+D-062)
- `docs/mockup-change-impact-log.md` (+CI-034)
- `docs/mockup-open-questions.md` (Q14 sebagian resolved)
- `docs/mockup-data-scenarios.md` (update narasi `OPP-006`/`OPP-010`/`QUO-010`)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 14), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `Dialog`/`DialogTrigger`/`DialogContent`/`DialogScrollContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `SectionCard`, `StatusBadge`, `Button`, `Input`, `Label`, `EmptyState`, `RoleAccessState`, `NuxtLink`. Tidak ada shared component baru — halaman `quotation-preview.vue` memakai `<table>`/`<div>` native dengan Tailwind (dokumen print, bukan UI dashboard interaktif, sengaja tidak memakai `Table*` komponen dashboard).

## 9. Types/Constants/Fixtures/Mock State

**Field aditif** (sudah ada di working tree sebelum sesi ini, diverifikasi dan dipakai penuh oleh UI sesi ini): `Quotation` +`taxIdr`/`markupIdr`/`currency`/`validUntil`/`termsAndConditions`/`inclusions`/`exclusions`/`sentToClientAt`; `Opportunity` +`clientConfirmedAt`/`clientConfirmationNote`. Tidak ada breaking change — seluruh field opsional.

**Fixture:** `QUO-010` (existing, tidak ada ID baru) diperkaya 7 field. `QUO-006` (existing) +`sentToClientAt`. Tidak ada fixture Opportunity/Quotation baru dibuat — cukup memperkaya yang sudah representative untuk skenario ini (konsisten prinsip "jangan membuat dataset paralel").

## 10. Responsive Behavior

Tidak berubah pada `/crm/opportunities/[id]` — dialog/panel baru memakai komponen existing yang sudah responsive. `quotation-preview.vue` memakai `max-w-3xl` terpusat dengan padding responsive, grid 2 kolom yang collapse wajar pada layar sempit (Tailwind default), dan `@media print { @page { margin: 1.5cm } }` untuk hasil cetak yang rapi.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `quotation-preview.vue`: not-found (opportunity tidak ada ATAU opportunity ada tapi belum punya quotation — pesan berbeda untuk masing-masing), `RoleAccessState` (role tanpa akses `crm`).
- Compare Versions panel: tidak render sama sekali bila `supersededAmountIdr` tidak ada (bukan empty state eksplisit, konsisten pola panel kondisional existing).
- Client Confirmation: dua state jelas (belum dikonfirmasi → tombol aksi; sudah dikonfirmasi → badge + tanggal + catatan opsional).
- Withdraw Submission hanya tampil pada state `approvalStatus === 'submitted'` dan hanya untuk `canManageOpportunity` (AE/Super Admin) — Management (non-AE) tetap hanya melihat Approve/Reject.

## 12. Role Behavior

Seluruh aksi baru (Duplicate/Withdraw/Send to Client/Catat Client Confirmation) digerbangi `canManageOpportunity` (account-executive/super-admin, TIDAK diubah — narrow role exception existing sejak Section 08). "PDF / Print Preview" sengaja TIDAK digerbangi `canManageOpportunity` — siapa pun dengan `canView('crm')` (termasuk Management/Viewer) dapat melihat/mencetak, konsisten dengan quotation sebagai dokumen yang relevan dibaca lintas role internal. Halaman `quotation-preview` sendiri tetap memerlukan `middleware: 'auth'` (bukan publik) + `canView('crm')`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (chunk `quotation-preview-*` dan `quotation-preview-styles-*` baru ter-compile).
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (pre-existing, Q8).
- Lint — tidak tersedia, tidak ada script `lint` (pre-existing, Q8).
- **Smoke test HTTP** — opportunity detail representatif (`OPP-001` s/d `OPP-010`), `quotation-preview` (`OPP-010` dengan quotation lengkap, `OPP-006` approved, `OPP-999` not-found, `OPP-007` tanpa quotation), plus regresi (`/`, `/crm`, `/crm/opportunities`, `/crm/parties/PTY-001`, `/customer-journey`, `/customer-journey/leads`, `/reports`, `/projects`, `/finance`) — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep, mengikuti pelajaran Section 08 "verifikasi konten, bukan hanya status code"):
  - `/crm/opportunities/OPP-006` menampilkan badge "Terkirim ke Client" (2×, ringkasan + section Send to Client) dan teks "Client confirmation belum dicatat" (2×); tombol Mark as Won dikonfirmasi `disabled title="Client confirmation belum dicatat"` lewat inspeksi markup langsung.
  - `/crm/opportunities/OPP-010/quotation-preview` menampilkan "Tax / Fee", "Markup", "Inclusions", "Exclusions", "Terms & Conditions", "Total (IDR)" masing-masing 1×.
  - `/crm/opportunities/OPP-999/quotation-preview` menampilkan "Quotation tidak ditemukan" + "tidak ada di data demo".
  - `/crm/opportunities/OPP-007/quotation-preview` (opportunity ada, quotation belum ada) menampilkan "belum memiliki quotation".
  - `/crm/opportunities/OPP-005` (submitted) menampilkan "Withdraw Submission" dan "Menunggu commercial approval" masing-masing 1× (tidak dobel meski default demo role Super Admin punya akses AE-view dan Management-view sekaligus).
  - `/crm/opportunities/OPP-010` menampilkan "Duplicate Quotation" dan "PDF / Print Preview".
  - Tidak ditemukan string error nyata (satu match "error" pada `OPP-001` diverifikasi false-positive — kunci internal `_errors` payload Nuxt, bukan pesan error).
- **Verifikasi interaktif** (klik Duplicate/Withdraw/Send to Client/Catat Client Confirmation, isi Edit Quotation dengan field baru) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat code review ketat terhadap mutator (pola identik mutator existing yang sudah tervalidasi) dan smoke test SSR konten yang membuktikan gate/state bekerja benar di level render untuk skenario kunci.

## 14. Regression

Tidak ada file section lain yang disentuh di luar `app/pages/crm/opportunities/[id]/index.vue` (dimiliki Section 05/08) dan `app/data/opportunities.ts` (fixture Opportunity/Quotation, dimiliki Section 05/08). Route regresi (`Dashboard`, `CRM`, `Customer Journey`, `Reports`, `Projects`, `Finance`, `Party Detail`) dikonfirmasi tetap HTTP 200 tanpa perubahan konten yang tidak diharapkan — seluruh selector yang menjumlahkan `amountIdr` (Dashboard widget Pipeline, Reports Sales Pipeline/Win Rate) tidak terpengaruh karena `amountIdr` `QUO-006`/`QUO-010` tidak diubah nilainya (hanya field baru yang ditambahkan).

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-034 — gerbang tombol "Mark as Won" bertambah syarat Client Confirmation (`Opportunity.clientConfirmedAt`), mengubah PERILAKU (bukan data) skenario demo `OPP-006` yang sebelumnya didokumentasikan Prompt 20 sebagai "Approved, tombol Mark as Won aktif". Perubahan ini disengaja sesuai Wajib literal Section 05, bukan regresi — Opportunity yang sudah `won` (`OPP-001`/`002`/`003`/`008`) tidak terpengaruh sama sekali.

## 16. Known Issues dan Deferred Work

- **Compare Versions terbatas nilai total** — tidak ada breakdown/discount/tax/markup per versi (D-062, keterbatasan model `Quotation` existing sejak Section 08 yang hanya menyimpan `supersededAmountIdr` tunggal, bukan snapshot array). Didokumentasikan eksplisit di UI (disclaimer) dan di sini — bukan gap tersembunyi.
- **PDF/Print Preview bukan generator PDF nyata** — memakai `window.print()` browser (save-as-PDF manual oleh user), sesuai batasan protokol yang melarang integrasi/generator produksi.
- **Approval Queue agregat Management-facing** dan **notifikasi Client Confirmation Management-facing** tetap milik Section 06 (Q14, sebagian resolved oleh section ini — field/aksi AE-facing sudah ada, sisi Management/queue belum).
- Q8 (tooling lint/typecheck/test) tetap terbuka, tidak berubah.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06 lama).

## 17. Protection Notes untuk Section Berikutnya

Section 06 (Management Approval, Won dan Client Activation) dapat mengonsumsi `Opportunity.clientConfirmedAt` langsung (sudah tersedia, tidak perlu field baru) untuk membangun Approval Queue/notifikasi Management-facing. **Jangan mengubah** `recordClientConfirmation`/`duplicateQuotationVersion`/`sendQuotationToClient`/`withdrawQuotationSubmission` signature-nya tanpa memeriksa dampak ke `/crm/opportunities/[id]` (konsumen aktif satu-satunya). Gerbang Mark as Won (`quotation.approvalStatus === 'approved' && opportunity.clientConfirmedAt`) di `submitMarkAsWon` — bila Section 06 menambah gerbang lain, tambahkan sebagai kondisi TAMBAHAN (pola AND, bukan mengganti), konsisten pola D-053/D-062.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/crm/opportunities/OPP-010` untuk melihat Quotation lengkap (Duplicate/Edit/Create New Version, field komersial penuh) dan klik "PDF / Print Preview". Buka `http://localhost:8080/crm/opportunities/OPP-006` untuk melihat gerbang Client Confirmation (tombol Mark as Won disabled, tombol "Catat Client Confirmation" di section Commercial Approval). Buka `http://localhost:8080/crm/opportunities/OPP-005` untuk melihat tombol "Withdraw Submission".

## 19. Recommended Next Section

**Section 06 — Management Approval, Won dan Client Activation**, berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
