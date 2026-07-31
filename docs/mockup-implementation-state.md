# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori section, `docs/mockup-progress.md` untuk narasi Prompt 0–5+19, dan `docs/mockup-change-impact-log.md` untuk detail perubahan lintas-section). Wajib dibaca di awal setiap section/change request baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 0. Skema Penomoran Ganda (Dibaca Dulu Sebelum Bagian 1)

Sejak 2026-08-01 ada **dua skema section berdampingan** (D-057, `docs/mockup-design-decisions.md` Kelompok K) — jangan tertukar:
- **Skema lama (Prompt 0–20):** Section 00–18 + Prompt 19/20, seluruhnya **COMPLETED**, dijalankan dari `prompts/00-README.md` s/d `prompts/22-PROMPT-20-...md`. Tetap source of truth historis, tidak ditulis ulang.
- **Skema baru (Section 00–24):** roadmap lebih luas dari `prompts/01-PROTOKOL-WAJIB.md` versi "FRONTEND-ONLY CONTINUATION" + `prompts/Section 0N — *.md`/`prompts/SECTION_NN_*.md`. **Section 00–04 sudah dijalankan** (2026-08-01) — lihat `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`, dan `docs/mockup-section-reports/section-00-current-progress-reconciliation.md`/`section-01-frontend-foundation-state-governance.md`/`section-02-role-access-navigation.md`/`section-03-public-lead-intake.md`/`section-04-sales-leads-qualification.md`.

Bagian 1–8 di bawah ini tetap merujuk skema lama (Prompt 0–20) apa adanya — belum ditulis ulang mengikuti skema baru, karena Section 00 murni audit (tidak mengubah kode).

## 1. Current Phase dan Current Section

- **Current phase (skema lama):** Seluruh 18 section mockup baku (Section 00–18) **COMPLETED**, ditambah **Prompt 19 — Change Request (Customer Journey, Account Executive, Supplier, Commercial Approval)** (2026-07-30) dan **Prompt 20 — Change Request (Sales Qualification to Account Executive Opportunity Flow)** (2026-07-31), keduanya COMPLETED.
- **Current phase (skema baru):** Section 00–05 **COMPLETED** (Section 05: 2026-07-31). Section 06–24 belum dimulai — lihat `docs/frontend-implementation-roadmap.md` untuk status awal per section.
- **Current section/change:** Tidak ada yang aktif — menunggu perintah user untuk section/change berikutnya (skema mana pun).
- **Last completed:** **Section 05 — Account Executive Opportunity dan Quotation** (skema baru), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-05-ae-opportunity-quotation.md`.
- Section 04 — Sales Leads dan Qualification (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-04-sales-leads-qualification.md`.
- Section 03 — Public Lead Intake (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-03-public-lead-intake.md`.
- Section 02 — Role, Access dan Navigation (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-02-role-access-navigation.md`.
- Section 01 — Frontend Foundation dan State Governance (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md`.
- Section 00 — Current Progress Reconciliation (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-00-current-progress-reconciliation.md`.
- Prompt 20 — Change Request (skema lama): COMPLETED, detail `docs/mockup-section-reports/change-sales-qualification-ae-opportunity.md`.
- Prompt 19 — Change Request (skema lama): COMPLETED, detail `docs/mockup-section-reports/change-customer-journey-ae-supplier.md`.
- Section 18 — Regression and Demo Readiness: COMPLETED, detail `docs/mockup-section-reports/section-18-regression-demo-readiness.md`.
- Section 17 — Administration: COMPLETED, detail `docs/mockup-section-reports/section-17-administration.md`.
- Section 16 — Reports: COMPLETED, detail `docs/mockup-section-reports/section-16-reports.md`.
- Section 15 — Project Finance: COMPLETED, detail `docs/mockup-section-reports/section-15-project-finance.md`.
- Section 14 — Project Changes: COMPLETED, detail `docs/mockup-section-reports/section-14-project-changes.md`.
- Section 13 — Vendor Management: COMPLETED, detail `docs/mockup-section-reports/section-13-vendor-management.md`.
- Section 12 — Itinerary and Operations: COMPLETED, detail `docs/mockup-section-reports/section-12-itinerary-operations.md`.
- Section 11 — Traveler and Participant: COMPLETED, detail `docs/mockup-section-reports/section-11-traveler-participant.md`.
- Section 10 — Project Core: COMPLETED, detail `docs/mockup-section-reports/section-10-project-core.md`.
- Section 09 — Opportunity Won to Project: COMPLETED, detail `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08–15 sudah ter-commit (lihat histori `git log`); Section 16 (`2625a2b`), Section 17 (`6d5d179`), Section 18 (`9c0abe7`) ter-commit; Prompt 19 (Change Request) ter-commit (`78d14c0`). Prompt 20 (Change Request) **belum ter-commit** pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

**Prompt 20** — tidak ada route baru. `/customer-journey/leads` (tab "Qualification" baru di drawer) dan `/crm/opportunities/[id]` (section "Requirement Detail" baru, badge status workflow baru, tombol "Mark as Won" menggantikan "Ajukan sebagai Won") berubah kontennya, bukan route-nya. `/admin/roles` — teks deskripsi 2 role diperbarui (CI-029), tidak ada perubahan struktur.

Baris baru/berubah Prompt 19 (Change Request) — route Section 05–18 tidak diulang di sini (lihat `docs/route-and-role-matrix.md` bagian 0 untuk inventory lengkap):

| Route | Catatan Prompt 19 |
|---|---|
| `/customer-journey`, `/customer-journey/leads`, `/customer-journey/customers[+/id]`, `/customer-journey/project-orders[+/id]`, `/customer-journey/lead-sources` | **Baru** — modul Customer Journey. Customers/Project Orders/Lead Source Recap reuse `Party`/`Project`/`Opportunity` existing (D-050), bukan dataset baru. Sales dibatasi ke Leads saja. |
| `/activity-center` | **Baru** — log lintas sistem, Super Admin saja (narrow `roles` override, D-052). |
| `/supplier`, `/supplier/products`, `/supplier/orders` | **Baru** — Supplier Portal, vendor-isolated (`vendorId`, D-048). |
| `/vendors/[id]` | **Tab "Products" ditambahkan** — katalog `VendorProduct`, tab lain tidak diubah. |
| `/crm/opportunities/[id]` | **Section "Commercial Approval" ditambahkan**; `canManageOpportunity` berpindah dari Sales ke Account Executive (D-047/D-049). |
| `/crm/parties/[id]`, `/crm/prospects` | `canManageParty` diperluas menambahkan `account-executive` (Sales tetap ada). |
| `/reports` | `showSalesPipeline` diperluas menambahkan `account-executive`. |
| `/` (Dashboard) | Widget Opportunity Pipeline/Quotations Pending diperluas untuk `account-executive`; widget baru "Supplier Portal" (welcome card) untuk role `supplier` — mencegah Dashboard kosong untuk 2 role baru. |

## 2b. Foundation Baru (Section 01, Skema Roadmap Baru)

`app/utils/mock-reset.ts` (snapshot + restore seed) dan `app/plugins/mock-reset.client.ts` (capture snapshot saat app dimuat, client-only) — dipakai tombol "Reset Demo Data" di `/settings`. Lihat D-058 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md`.

## 2c. Role dan Akses Baru (Section 02, Skema Roadmap Baru)

`RoleId` 13→16 (+`product-planner`/`procurement`/`client`), `ModuleKey`+`client-portal`, `User.clientPartyId`, `usePermissions().clientScopeId`, route baru `/client` (shell minimal), Dashboard +3 widget welcome role baru, Matrix View `/admin/roles` diperluas 6→8 kolom. Lihat D-059 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-02-role-access-navigation.md`.

## 2d. Public Lead Intake Baru (Section 03, Skema Roadmap Baru)

Route baru `/lead-intake` (`layout: false`, tanpa `middleware: 'auth'`) — 4 kategori (`LeadServiceCategory`, reuse type existing), consent checkbox, UTM/referrer preview, duplicate suggestion non-blocking, reuse penuh `createLead`+`updateLeadQualification` (Prompt 20, tidak ada mutator/field baru). `/login` mendapat 1 link discoverability. Lihat D-060 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-03-public-lead-intake.md`.

## 2e. Sales Lead Workflow Lengkap (Section 04, Skema Roadmap Baru)

`app/data/index.ts` +4 mutator/selector baru: `reopenLead`, `updateLeadContact`, `getLeadDuplicateCandidates` (dipusatkan, dipakai ulang `/lead-intake` DAN `/customer-journey/leads`), `mergeLeadAsDuplicate` (archive-dengan-referensi). `/customer-journey/leads` +dialog "Edit Lead", +tombol "Reopen" (drawer footer), +panel "Lead Serupa Terdeteksi" (Overview tab) +badge "Possible Duplicate" (Table view). Fixture +`LED-011` (duplikat sengaja terhadap `LED-007`, Total Leads 10→11). Lihat D-061 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-04-sales-leads-qualification.md`.

## 2f. AE Opportunity dan Quotation Lengkap (Section 05, Skema Roadmap Baru)

`app/data/index.ts` +4 mutator baru: `duplicateQuotationVersion` ("Duplicate Quotation"), `sendQuotationToClient` ("Send to Client", mock), `withdrawQuotationSubmission` ("Withdraw Submission", guard hanya dari status `submitted`), `recordClientConfirmation` (gerbang tambahan sebelum Mark as Won). `Quotation` +7 field aditif (`taxIdr`/`markupIdr`/`currency`/`validUntil`/`termsAndConditions`/`inclusions`/`exclusions`); `Opportunity` +2 field aditif (`clientConfirmedAt`/`clientConfirmationNote`). Route baru `/crm/opportunities/[id]/quotation-preview` (`layout: false`, print via `window.print()` browser — PDF/print preview mock, BUKAN generator PDF nyata). `/crm/opportunities/[id]` mendapat: tombol "Duplicate Quotation", panel "Bandingkan dengan versi sebelumnya" (compare terbatas pada nilai total, lihat D-062), field komersial baru pada "Edit Quotation", tombol "Withdraw Submission" (AE, saat submitted), tombol "Send to Client"/dialog "Catat Client Confirmation" (saat approved), dan gerbang baru pada tombol "Mark as Won" (kini mensyaratkan `clientConfirmedAt` selain `approvalStatus === 'approved'`). Fixture: `QUO-010` dilengkapi tax/markup/currency/validity/inclusions/exclusions/terms; `QUO-006` +`sentToClientAt` (Opportunity `OPP-006` sengaja TIDAK diberi `clientConfirmedAt`, mendemokan gerbang baru — lihat CI-034). Lihat D-062 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-05-ae-opportunity-quotation.md`.

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Prompt 19 maupun Prompt 20, KECUALI primitive `ui/sheet/*` (sudah ada sejak Foundation, **baru dipakai pertama kali** di drawer Lead Detail — `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription`/`SheetFooter`) dan `ui/dialog/DialogScrollContent` (sudah ada sejak Foundation, **baru dipakai pertama kali** Prompt 20 — dialog "Edit Requirement"/"Edit Quotation" yang panjang). Seluruh halaman baru/berubah reuse `PageHeader`/`SectionCard`/`RoleAccessState`/`EmptyState`/`StatusBadge`/`StatusBreakdownList`/`StatsCard`/`Table*`/`Dialog*`/`Tabs*`/`DetailMetadataList` existing.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Entitas baru (Prompt 19):** `Lead`/`LeadActivity` (`app/types/lead.ts`, `app/data/leads.ts`), `VendorProduct` (`app/types/vendor.ts`, `app/data/vendors.ts` — `VENDOR_PRODUCTS`), `SystemEvent` (`app/types/activity.ts`, `app/data/activity.ts` — `SYSTEM_EVENTS`, **bukan** `reactive()`, log statis).

**Field aditif (Prompt 19):** `Party` +`size`/`city`/`phone`/`accountOwnerId`; `Quotation` +`approvalStatus`/`approvedBy`/`approvalNote` (`QuotationApprovalStatus`); `User` +`vendorId`; `Project` — tidak ada field baru.

**Field aditif (Prompt 20):** `Lead` +13 field Qualification (`serviceCategory`/`destination`/`travelStartDate`/`travelEndDate`/`travelerEstimate`/`serviceScope`/`requirementSummary`/`budgetRange`/`dateFlexible`/`decisionMaker`/`urgency`/`specialRequestNote`, `handedOverTo` kini diisi manual lewat form bukan otomatis); `Opportunity` +`contactName`/`leadId`/`expectedCloseDate`/`requirementDetail` (`OpportunityRequirementDetail`, 14 field AE); `Quotation` +`discountIdr`/`estimatedCostIdr`/`estimatedMarginIdr`/`paymentTerms`/`serviceBreakdown` (`QuotationServiceItem[]`). Type baru (dirivasi, bukan tersimpan): `OpportunityWorkflowStatus`.

**Role & permission:** `RoleId` +`account-executive`/`supplier` (13 role total, Prompt 19); `ModuleKey` +`supplier-portal`; `usePermissions()` +`vendorScopeId` (vendor isolation); `NavItem` +`roles?: RoleId[]` (narrow nav override, dipakai Activity Center dan 3 child Customer Journey). Prompt 20 **tidak menambah role/module baru** — murni field/gate baru pada modul `crm` existing.

**Data reassignment (Prompt 19):** `Opportunity.ownerId` (OPP-001–008) di-reassign dari `USR-001` (Sales) ke `USR-014` (AE). `OPP-005` di-restage dari `won-requested` ke `negotiation` (QUO-005 `approvalStatus: submitted`); `OPP-006` tetap `negotiation` (QUO-006 `approvalStatus: approved`). `OPP-008`/`QUO-008`/`PRJ-104` baru (repeat client PTY-001).

**Data baru (Prompt 20):** `OPP-009`/`OPP-010` + `QUO-010` (skenario "Ready for Quotation"/"Quotation Draft"). `LED-001`/`LED-004` di-backfill field Qualification (lengkap/sebagian). `requirementDetail` diisi pada `OPP-005`/`OPP-006`. `leadId` diisi pada `OPP-001`(→LED-009)/`OPP-005`(→LED-005).

**Selektor/mutator baru (Prompt 19):** `getDocumentsByParty`, `getOpportunitiesByOwner`, `getProjectsByAccountExecutive`, `submitQuotationForApproval`/`approveQuotation`/`rejectQuotation`, `getLeadById`/`getLeadActivities`/`getLeadFollowUps`/`createLead`/`createLeadActivity`/`archiveLead`/`qualifyLeadAndCreateOpportunity`, `getVendorProducts`/`createVendorProduct`.

**Selektor/mutator baru (Prompt 20):** `getLeadMissingQualification`, `updateLeadQualification`, `markLeadUnqualified` (Lead); `qualifyLeadAndCreateOpportunity` — signature berubah dari `(leadId, accountExecutiveId)` menjadi `(leadId)` (AE diambil dari `lead.handedOverTo`, digerbangi kelengkapan); `getOpportunityRequirementGate`, `updateOpportunityRequirement`, `getOpportunityWorkflowStatus` (Opportunity); `updateQuotationDetails` (Quotation) — seluruhnya di `app/data/index.ts`.

**Selektor/mutator baru (Section 05):** `duplicateQuotationVersion`, `sendQuotationToClient`, `withdrawQuotationSubmission` (Quotation); `recordClientConfirmation` (Opportunity) — seluruhnya di `app/data/index.ts`. `updateQuotationDetails`/`QuotationDetailInput` (Prompt 20) diperluas aditif dengan 7 field baru (tidak ada perubahan signature).

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak disentuh** Prompt 19/20.
- `OpportunityStage` (union 9 nilai, D-028) — **tidak direstrukturisasi** Prompt 19/20 (D-049/D-053) meski workflow Commercial Approval ditambahkan dan alur Won disederhanakan; seluruh 9 nilai stage tetap ada di union, hanya urutan pemanggilan UI dan label `won-requested` yang berubah.
- `/crm/prospects`, `/crm/clients`, `/crm/parties/[id]`, `/projects`, `/projects/[id]` — **tidak diubah** oleh modul Customer Journey (D-050); Customer Journey adalah lensa presentasi baru di atas data yang sama, bukan pengganti.
- Tab "Activity & Changes" Project Detail (`ActivityEntry`, LOCKED Section 05/14) — **tidak disentuh** oleh `SystemEvent` (Activity Center) yang merupakan log terpisah level-atas.
- Selektor finansial/operasional (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`, `getServicesForProjects`, `isUpcomingDeparture`) — gunakan yang sudah ada, jangan hitung ulang logic yang sama di tempat lain.
- `getOpportunityMissingRequirements` (Section 09, gerbang final sebelum Won) — **tidak diubah** Prompt 20; `getOpportunityRequirementGate` (Prompt 20, gerbang sebelum Quotation) adalah fungsi TERPISAH, bukan pengganti (D-055).
- `approveOpportunityWon`/`rejectOpportunityWon` (Section 09) — **tidak diubah signature/body-nya** Prompt 20; `rejectOpportunityWon` kini tidak dipanggil UI manapun (dead dari sisi UI, tetap ada di `app/data/index.ts` untuk backward-compatibility, D-053).
- `app/pages/reports/index.vue` — pemilik penuh 6 section Reports (Section 16); `app/pages/vendors/[id]/index.vue` — pemilik Vendor Detail (Section 13), Prompt 19 hanya menambah 1 tab, Prompt 20 tidak menyentuh.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** export mock Reports tidak dikerjakan (Section 16); tidak ada CRUD invoice/payment (Section 15); Supplier Portal (`/supplier/orders`) read-only, tidak ada self-service submit quotation dari sisi supplier (Q12, `docs/mockup-open-questions.md`); payment terms/margin-cost summary tidak digerbangi hard-block pada Requirement Gate (D-055); Quotation Compare (Section 05) terbatas pada nilai total, bukan breakdown penuh per versi (D-062); PDF/Print Preview (Section 05) memakai `window.print()` browser, bukan generator PDF nyata (batasan protokol).
- `getOpportunityMissingRequirements`/`approveOpportunityWon` (Section 09) — **tidak diubah** Section 05; gerbang baru `clientConfirmedAt` pada tombol Mark as Won bersifat TAMBAHAN terhadap gerbang `approvalStatus === 'approved'` existing (Prompt 19/20), bukan pengganti.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini (Prompt 20):

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses** | Client & server bundle ter-build sukses, chunk `leads-*`/`opportunities-*`/`customer-journey-*` ter-compile dengan perubahan Prompt 20. |
| Smoke test HTTP (~27 route, baru+existing representatif) | **Sukses** | Seluruhnya HTTP 200 |
| Smoke test konten | **Sukses** | Badge status workflow sesuai per skenario opportunity (OPP-005 "Pending Management Approval", OPP-006 "Approved"+tombol "Mark as Won" aktif, OPP-007 "Pending Requirement", OPP-009 "Ready for Quotation"+"Buat Quotation" aktif, OPP-010 "Quotation Draft"+"Edit Quotation"+Service Breakdown tampil); Leads list menampilkan lead existing tanpa error; Lead Source Recap (Total 10/Qualified 3/Opportunities 2/Won 1) tidak berubah |
| Regresi route existing (Dashboard, CRM, Projects, Vendors, Finance, Reports, Admin, Customer Journey, Activity Center, Supplier) | **Tidak berubah** kontennya, tetap HTTP 200 | |
| `npx vitest run` | **"No test files found", exit code 0 (harness)** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (isi form Qualification/Requirement Detail live, klik Mark as Won) | **Tidak dilakukan headless** | Keterbatasan tooling konsisten sejak Section 06 — dimitigasi lewat code review ketat terhadap seluruh gate baru (`getLeadMissingQualification`, `getOpportunityRequirementGate`, gate tombol "Mark as Won") dan smoke test SSR konten per skenario |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. Belum diselesaikan sejak Section 06, termasuk di change request ini.
- Q12 — self-service submit quotation dari `/supplier/orders` tidak diimplementasikan (deferred, `docs/mockup-open-questions.md`, tidak berubah).
- Payment terms/margin-cost summary tidak digerbangi hard-block pada Requirement Gate (D-055, kondisional tanpa mekanisme konfigurasi eksplisit — dicatat sebagai keputusan, bukan gap tersembunyi).
- Export mock Reports tidak dikerjakan (Section 16, tidak berubah).
- Verifikasi interaktif tidak dilakukan secara headless (keterbatasan tooling, konsisten sejak Section 06).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Skema lama (Prompt 0–20): tidak ada section/change baku selanjutnya. Skema baru (Section 00–24): Section 06 (Management Approval, Won dan Client Activation — melengkapi gap PARTIAL: approval queue agregat, notifikasi/queue client confirmation Management-facing, Q14) direkomendasikan sebagai kandidat berikutnya berbasis dependency (lihat `docs/frontend-implementation-roadmap.md`), tapi menunggu perintah eksplisit user.

## 8. Last Updated

- **Date:** 2026-07-31
- **Updater:** Section 05 (Account Executive Opportunity dan Quotation, skema roadmap Section 00–24 baru) execution — Duplicate Quotation, Compare Versions (nilai total), Send to Client (mock), Withdraw Submission, PDF/Print Preview (`quotation-preview`, baru), field komersial Quotation (tax/markup/currency/validity/terms/inclusions/exclusions), Client Confirmation (gerbang tambahan sebelum Mark as Won) di `/crm/opportunities/[id]`. `npx nuxi prepare` + `npm run build` diverifikasi sukses.
- **Update susulan (bug fix, sama tanggal):** User melaporkan app gagal mount di browser ("500 Internal Server Error — Failed to execute 'structuredClone' on 'Window'"). Root cause: `app/plugins/mock-reset.client.ts` (Section 01) memanggil `structuredClone()` langsung terhadap array `reactive()` Vue — tidak pernah terdeteksi oleh smoke test `curl` manapun sejak Section 01 karena kode client-only tidak dieksekusi saat SSR. Diperbaiki di `app/utils/mock-reset.ts` (`structuredClone` → `deepClone` berbasis JSON). Detail: `docs/mockup-change-impact-log.md` CI-035, `docs/frontend-known-issues.md` bagian 0b.
