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
- **Current phase (skema baru):** Section 00–21 **COMPLETED** (Section 21: 2026-08-01). Section 22–24 belum dimulai — lihat `docs/frontend-implementation-roadmap.md` untuk status awal per section.
- **Current section/change:** Tidak ada yang aktif — menunggu perintah user untuk section/change berikutnya (skema mana pun).
- **Last completed:** **Section 21 — Documents, Communication dan Notifications** (skema baru), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-21-documents-comms-notifications.md`.
- Section 20 — Project Finance (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-20-project-finance.md`.
- Section 19 — Changes, Cancellation, Refund dan Incident (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-19-change-cancel-refund-incident.md`.
- Section 18 — Booking dan Service Orders (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-18-booking-service-orders.md`.
- Section 17 — Supplier dan Procurement (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-17-supplier-procurement.md`.
- Section 16 — MICE dan Event (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-16-mice.md`.
- Section 15 — Transportation (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-15-transportation.md`.
- Section 14 — Accommodation (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-14-accommodation.md`.
- Section 13 — Ticketing (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-13-ticketing.md`.
- Section 12 — Itinerary, Operations, Tasks dan Readiness (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-12-itinerary-operations-readiness.md`.
- Section 11 — Traveler dan Travel Documents (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-11-traveler-documents.md`.
- Section 10 — Product Planning dan Costing (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-10-product-planning-costing.md`.
- Section 09 — Project Order dan Handover (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-09-project-order-handover.md`.
- Section 08 — Client Portal (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-08-client-portal.md`.
- Section 07 — Customer Journey (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-07-customer-journey.md`.
- Section 06 — Management Approval, Won dan Client Activation (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-06-management-approval-won.md`.
- Section 05 — Account Executive Opportunity dan Quotation (skema baru): COMPLETED, detail `docs/mockup-section-reports/section-05-ae-opportunity-quotation.md`.
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

## 2g. Management Approval Queue dan Guard Data-Layer Won (Section 06, Skema Roadmap Baru)

`app/pages/crm/quotations.vue` ditulis ulang total dari `ModulePlaceholder` menjadi Management Approval Queue (3 tab: Menunggu Approval/Menunggu Client Confirmation/Semua Quotation, tab state via query `?tab=`). `app/data/index.ts` +2 selector baru (`getQuotationsPendingApproval`, `getOpportunitiesPendingClientConfirmation`); `submitQuotationForApproval`/`approveQuotation`/`rejectQuotation` kini mencatat `PartyActivity` per keputusan (histori); `approveOpportunityWon` +guard `quotation.approvalStatus === 'approved' && opportunity.clientConfirmedAt` (dipindah dari UI-only ke level data) +reaffirmation `party.accountOwnerId`. "Reject" tetap satu status (`rejected`), berfungsi sekaligus sebagai "Return for Revision" — tidak ada status paralel baru. `comingSoon` dihapus dari nav item "Quotations". Lihat D-063 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-06-management-approval-won.md`.

## 2h. Customer Journey Funnel dan AE Portfolio Scoping (Section 07, Skema Roadmap Baru)

`/customer-journey` mendapat panel "Customer Journey Funnel" (7 tahap: Lead→Qualified→Opportunity→Approved→Won→Client→Project Order), setiap tahap menunjukkan conversion % dari tahap sebelumnya dan dapat diklik untuk drill-down (query filter otomatis ter-seed di halaman tujuan: `/customer-journey/leads?stage=`, `/crm/opportunities?stage=`, `/crm/quotations?tab=all&status=`, `/customer-journey/customers?status=`, `/customer-journey/project-orders`). Bug AE portfolio scoping diperbaiki (CI-037): `scopedLeads`/Active Clients dashboard sebelumnya tidak ter-scope untuk AE. Toggle "Hanya Portfolio Saya" (default ON untuk AE) ditambahkan di `/customer-journey/customers` (+filter owner baru) dan `/customer-journey/project-orders` (+filter periode keberangkatan baru). `app/data/index.ts` +`getPartiesByAccountOwner`. Lihat D-064 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-07-customer-journey.md`.

## 2i. Client Portal Lengkap (Section 08, Skema Roadmap Baru)

`/client` ditulis ulang total dari shell Section 02 menjadi dashboard penuh (profile+contacts, Action Center/notifications, Support/AE contact, travel request creation via dialog, list Opportunity/Project Order dengan link ke halaman detail baru). Route baru `/client/opportunities/[id]` (quotation view tersanitasi + Request Revision + Accept/Reject self-service) dan `/client/project-orders/[id]` (6 tab: Overview, Itinerary, Travelers, Documents, Finance, Change Request). Seluruh field internal cost/margin (`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/`approvedBy`/`approvalNote`) dipastikan TIDAK PERNAH dirender (diverifikasi grep audit) — lihat D-065. `recordClientConfirmation` (Section 05) kini dipanggil self-service oleh Client (CI-038). `LeadSource` +`client-portal` (aditif, `app/types/lead.ts`+`app/constants/status.ts`). Tidak ada mutator data baru — seluruh aksi reuse `createContact`/`createLead`/`updateLeadQualification`/`recordClientConfirmation`/`createPartyActivity`/`createTraveler`/`updateTraveler`/`createChangeEntry` existing. Lihat D-065 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-08-client-portal.md`.

## 2j. Project Order dan Handover Lengkap (Section 09, Skema Roadmap Baru)

`ProjectOrderStatus` (10 nilai) dirivasi via `getProjectOrderStatus()` dari `ProjectStatus` (LOCKED, tidak diubah) + field baru `handoverAcceptedAt`/`handoverAcceptedBy`/`handoverReturnedAt`/`handoverReturnReason`/`readyAt`/`closedAt`/`closureChecklist` pada `Project`. Tab Overview `/projects/[id]` mendapat 4 SectionCard baru: Handover & Project Status (Accept/Return Handover dengan reason, transisi status dengan guard+reason wajib untuk On Hold/Cancelled), Team (tambah/hapus anggota — `teamUserIds` sebelumnya tanpa mutator), Risks (`ProjectRisk`, entitas baru), Closure Checklist (shell, 4 item, tidak menggerbangi apa pun sampai Section 24). Tab Tasks ditulis ulang total (sebelumnya read-only murni) — create/edit task, milestone flag, dependency single-link, assignee. Bug fix: link "opportunity asal" sebelumnya ke list bukan detail spesifik (CI-039). Fixture: `PRJ-101`/`102`/`103` di-backfill `handoverAcceptedAt`; `PRJ-104` sengaja dibiarkan Handover Pending untuk demo. Lihat D-066 (`docs/mockup-design-decisions.md`) dan `docs/mockup-section-reports/section-09-project-order-handover.md`.

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

**Selektor baru (Section 06):** `getQuotationsPendingApproval`, `getOpportunitiesPendingClientConfirmation` — `app/data/index.ts`. Mutator existing `submitQuotationForApproval`/`approveQuotation`/`rejectQuotation`/`approveOpportunityWon` diperkaya perilakunya (logging `PartyActivity`, guard tambahan, `party.accountOwnerId`) TANPA perubahan signature.

**Selektor baru (Section 07):** `getPartiesByAccountOwner` — `app/data/index.ts`. Tidak ada perubahan type/shape.

**Section 08:** Tidak ada mutator/selector baru di `app/data/index.ts` — seluruh aksi Client Portal reuse mutator generik existing (lihat bagian 2i). `LeadSource` +`'client-portal'` (aditif, `app/types/lead.ts`), `LEAD_SOURCES` +1 entri (`app/constants/status.ts`).

**Section 09:** +13 mutator/selector baru di `app/data/index.ts` — `getProjectOrderStatus`, `getRisksByProject`, `acceptProjectHandover`, `returnProjectHandover`, `markProjectReady`, `getProjectStatusTransitions`, `updateProjectStatus`, `updateProjectClosureChecklist`, `addProjectTeamMember`, `removeProjectTeamMember`, `createProjectTask`, `updateProjectTask`, `createProjectRisk`, `updateProjectRiskStatus`. `Project` +7 field aditif (lihat 2j). `ProjectTask` +3 field aditif (`isMilestone`/`dependsOnTaskId`/`assignedTo`). `+ProjectRisk`/`ProjectRiskSeverity`/`ProjectRiskStatus` (`app/types/activity.ts`). `+ProjectOrderStatus`/`ProjectClosureChecklist` (`app/types/project.ts`). `+PROJECT_ORDER_STATUSES`/`RISK_SEVERITIES`/`RISK_STATUSES` (`app/constants/status.ts`). `TASKS` jadi `reactive()`, `+PROJECT_RISKS` (`app/data/activity.ts`).

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
- `getOpportunityMissingRequirements` (Section 09) — **tidak diubah** Section 05/06. `approveOpportunityWon` (Section 09) — diperkaya Section 06 (guard `approvalStatus`/`clientConfirmedAt` dipindah ke level data, +`party.accountOwnerId`) TANPA mengubah signature/guard existing (`stage !== 'won-requested'`, duplicate-project prevention via `projectId`).
- `QuotationApprovalStatus` (`draft`/`submitted`/`approved`/`rejected`, Prompt 19) — **tidak direstrukturisasi** Section 06 meski Wajib menyebut "return for revision"; "reject" berfungsi sekaligus sebagai "return for revision" (D-063), bukan status paralel baru.
- `recordClientConfirmation` (Section 05) — **tidak diubah signature/body-nya** Section 08; hanya dipanggil dari titik akses baru (`/client/opportunities/[id]`, self-service Client) selain titik akses AE-facing existing (`/crm/opportunities/[id]`). `DOCUMENTS` (`app/data/activity.ts`) — **tetap bukan `reactive()`**, Client Portal hanya membaca (read-only), tidak ada mutator create (D-065, keputusan disengaja).
- `ProjectStatus` (8 nilai, D-028) — **tidak direstrukturisasi** Section 09 meski `ProjectOrderStatus` (10 nilai) ditambahkan; derivasi via `getProjectOrderStatus()` (D-066), pola sama D-053/D-056. `app/pages/projects/[id]/index.vue` — 8-tab shell TETAP LOCKED (D-026/D-027), Section 09 hanya menambah SectionCard baru DI DALAM tab Overview/Tasks existing, TIDAK menambah tab ke-9.
- `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16) — **tidak diubah shape-nya** Section 18; `createFlightBooking`/`createHotelBooking`/`createTransportBooking`/`createMiceEvent` **tidak diubah signature/body-nya**, duplicate-check dan orchestration record dibuat DI LUAR fungsi tsb (D-075). `ServiceOrder`/`RFQ`/`SupplierInvoice` (Section 17) — **tidak disentuh sama sekali** oleh Section 18; `BookingOrchestrationRecord`/`BookingTimelineEntry` SENGAJA tidak dinamai "Service Order" apa pun (disambiguasi eksplisit, `docs/frontend-known-issues.md` bagian 13).
- `ActivityEntry`/`createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry` (Section 14 lama) — **tidak diubah signature/body-nya** Section 19; `createChangeRequest`/`approveChangeRequest`/`rejectChangeRequest` (baru, D-076) memanggilnya sebagai dependency, TIDAK menggantikannya — `ActivityEntry` TETAP satu-satunya audit trail project. `update*BookingStatus` (Section 13-16) — **tidak diubah guard/transition-map/reason-wajib-nya** Section 19; `createCancellationRecord` dipanggil DI LUAR fungsi tsb, SETELAH transisi berhasil (hook UI-level di 4 halaman detail booking). `Invoice`/`Payment` (Foundation) — **tidak disentuh sama sekali** oleh Section 19; `RefundRequest.creditStatus` TETAP field mock self-contained saat itu (forward dependency Section 20, kini RESOLVED — lihat bawah).
- `Invoice`/`Payment` (Foundation) dan `SupplierInvoice` (Section 17) — **diperluas ADITIF** oleh Section 20 (D-077, field baru saja, TIDAK ADA field lama yang diubah/dihapus, nilai efektif fixture existing tidak berubah). `updateRefundRequestStatus` (Section 19) — **tidak diubah guard/transition-map/reason-wajib-nya** Section 20; hook `issueCreditNote` (baru) dipanggil DI DALAM fungsi tsb SETELAH `creditStatus` di-set, murni aditif SETELAH transisi berhasil, bersifat PROSPEKTIF (tidak retroaktif ke `REF-001`). `getDepartureReadiness` (Section 12 lama) — **satu baris** diperbarui (exclude status `'void'`), struktur/return-type tidak berubah. `ProjectClosureChecklist.financeSettled` (shell Section 09/D-066) — kini digerbangi `evaluateFinanceClosureGate`/`closeProjectFinance` (Section 20), 3 item checklist lain TETAP manual/tidak digerbangi.
- `ProjectDocument`/`getDocumentsByProject`/`getDocumentsByParty` (Section 14 lama/Prompt 19) dan `VendorDocument` (Section 17) — **tidak diubah shape-nya** Section 21; `getDocumentsForProject` (baru, D-078) murni union view. `escalateIncident`/`approveChangeRequest`/`rejectChangeRequest` (Section 19) dan `createProjectTask`/`updateProjectTask` (Section 09 lama) — **tidak diubah guard/transition-map/signature-nya** Section 21; hook `pushNotification` SATU-DUA baris aditif di akhir fungsi (lihat CI-051). `NotificationPanel.vue`/`TopHeader.vue` — data source direwire dari hardcoded fake ke data real, shell UI/kontrak `defineExpose` dipertahankan 100% (AKTIVASI boilerplate mati, bukan mengubah fitur yang bekerja).

## 6. Known Issues dan Validation Status

**Catatan currency dokumen ini:** bagian 2/4 (narasi "2x"/daftar selector per-section) di atas TIDAK diperbarui oleh Section 10–16 (terhenti di 2j/Section 09) — bagian 1 (Current Phase), 6, 7, 8 tetap dijaga current oleh Section 17/19/20/21, tapi rincian selector/type/fixture Section 10–16 hanya tercatat lengkap di `docs/mockup-change-impact-log.md` (CI-040 s/d CI-046) dan masing-masing `docs/mockup-section-reports/section-1{0-6}-*.md` — bukan gap tersembunyi Section 17 (ditemukan saat audit awal section ini, dicatat apa adanya, TIDAK diperbaiki retroaktif karena di luar scope literal Section 17).

Divalidasi ulang langsung pada tanggal update dokumen ini (Section 21):

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test HTTP (~26 route, baru+existing representatif) | **Sukses** | Seluruhnya HTTP 200 (termasuk `/nonexistent-route-xyz`). Digunakan dev server existing yang sudah berjalan di port 8080 (leftover sesi sebelumnya), di-restart via file-watcher HMR otomatis untuk memuat route/komponen baru, kemudian di-kill setelah validasi selesai. |
| Smoke test konten | **Sukses** | `/documents` menampilkan "Documents & Communication" dan `DOC-C011` (expired); `/projects/PRJ-101?tab=documents` menampilkan dokumen legacy DAN baru; `/projects/PRJ-101?tab=activity-changes` menampilkan SectionCard "Communication" dan "Unified Activity Timeline". |
| Regresi route existing (Changes, Bookings, Procurement, Finance, Admin Roles, Ticketing/Accommodation/Transportation/MICE, CRM, Customer Journey, Client, Supplier, dashboard) | **Tidak berubah** kontennya, tetap HTTP 200 | |
| `npx vitest run` | **"No test files found", exit code 0 (harness)** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (klik bell popover/mark-as-read/kirim pesan/upload dokumen) | **Tidak dilakukan headless** | Keterbatasan tooling konsisten sejak Section 06 — dimitigasi lewat code review ketat dan smoke test SSR konten state awal |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. Belum diselesaikan sejak Section 06, termasuk di Section 21.
- Payment terms/margin-cost summary tidak digerbangi hard-block pada Requirement Gate (D-055, kondisional tanpa mekanisme konfigurasi eksplisit — dicatat sebagai keputusan, bukan gap tersembunyi).
- Export mock Reports tidak dikerjakan (Section 16, tidak berubah).
- Verifikasi interaktif tidak dilakukan secara headless (keterbatasan tooling, konsisten sejak Section 06).
- "On-time %" Procurement Performance Review (Section 17) disederhanakan sebagai rasio Service Order `fulfilled` terhadap total — tidak ada field due-date terpisah (dicatat sebagai keputusan D-074, bukan gap tersembunyi).
- "Supplier-visible status" pada `BookingTimelineEntry` (Section 18) bersifat SIMULATIF (bucket label, bukan halaman Supplier Portal baru) — keempat domain booking tidak punya akses Supplier sendiri, vendor-facing sesungguhnya tetap `ServiceOrder` Procurement (Section 17). Dicatat sebagai keputusan D-075, bukan gap tersembunyi.
- `reports/index.vue` (Section 16 lama) SSR selalu menampilkan `LoadingState` (isLoading di-toggle via `setTimeout` di `onMounted`, tidak berjalan saat SSR) — ditemukan selama regresi Section 20, PRE-EXISTING sejak Section 16, TIDAK disentuh Section 20/21 (di luar scope kepemilikan file), diperbaiki otomatis oleh hydration browser real.
- **`RefundRequest.creditStatus` (Section 19) kini terintegrasi nyata ke `CreditNote`** (Section 20, D-077) — forward dependency RESOLVED, lihat `docs/frontend-known-issues.md` bagian 15.
- **Versi client-safe/supplier-safe Unified Activity Timeline (Section 21, D-078) DIDEFER** — selector `getUnifiedActivityTimeline` sudah generik/mendukung `viewerAccessLevel: 'client'`/`'supplier'`, tinggal pemanggilan tambahan di halaman Portal terkait yang belum dikerjakan (stretch goal, bukan blocker) — lihat `docs/frontend-known-issues.md` bagian 16.
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Skema lama (Prompt 0–20): tidak ada section/change baku selanjutnya. Skema baru (Section 00–24): Section 22 (Dashboards, Reports, Lead Recap dan Activity Center — status PARTIAL) direkomendasikan sebagai kandidat berikutnya berbasis urutan roadmap literal (lihat `docs/frontend-implementation-roadmap.md`), tapi menunggu perintah eksplisit user.

## 8. Last Updated

- **Date:** 2026-08-01
- **Updater:** Section 21 (Documents, Communication dan Notifications, skema roadmap Section 00–24 baru) execution — `Document`/`Message`/`Notification` (D-078) fully additive di atas `ProjectDocument`/`VendorDocument`; modul baru `/documents` (3 tab); `NotificationPanel.vue`/`TopHeader.vue` direwire dari boilerplate mati ke data real; 4 hook `pushNotification` kurasi (`sendMessage` mentions, `escalateIncident`, `approveChangeRequest`/`rejectChangeRequest`, `createProjectTask`/`updateProjectTask`); `getUnifiedActivityTimeline` access-filtered disurfaced di tab "Activity & Changes" Project Detail; tab "Documents" Project Detail diperkaya category/version/expiry/access-level. `npx nuxi prepare` + `npm run build` sukses.
- **Update sebelumnya (Section 20, 2026-08-01):** `Invoice`/`Payment` diperluas aditif (currency/DP/void, D-077), `CreditNote`/`DebitNote` baru menutup forward dependency D-076 (hook prospektif di `updateRefundRequestStatus`), `SupplierInvoice` +AP scheduling/match-status, modul `/finance` diperluas (`/finance/notes`, `/finance/reconciliation` baru), Financial Closure Gate (`evaluateFinanceClosureGate`/`closeProjectFinance`) mengisi `ProjectClosureChecklist.financeSettled` dengan logic nyata pertama kalinya. Lihat `docs/mockup-section-reports/section-20-project-finance.md`.
- **Update sebelumnya (Section 19, 2026-08-01):** `ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` (D-076) fully additive di atas `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16), `Invoice`/`Payment` (Foundation), dan `ActivityEntry`/`createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry` (Section 14 lama, tetap satu-satunya audit trail); modul top-level baru `/changes` (4 tab) + 4 route detail; hook `createCancellationRecord` di 4 halaman detail booking; extension tab "Activity & Changes" `/projects/[id]` (+4 SectionCard); extension `/client/project-orders/[id]` (tab "Changes & Incidents" sanitized); Matrix Role `/admin/roles` +kolom "Changes & Incidents". Lihat `docs/mockup-section-reports/section-19-change-cancel-refund-incident.md`.
- **Update sebelumnya (Section 18, 2026-08-01):** consolidation/orchestration layer fully additive `BookingOrchestrationRecord`/`BookingTimelineEntry` (D-075) di atas `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16); modul top-level baru `/bookings` (Timeline) + `/bookings/exceptions` (Exception Queue); duplicate booking prevention di 3 halaman create (`/ticketing`, `/accommodation`, `/transportation`); payment gate mock (`not-required`/`pending`/`cleared`) dengan hook otomatis di 4 fungsi `update*Status`; refactor tab "Itinerary & Services" `/projects/[id]` (4 blok lama → 1 SectionCard "Booking Timeline" terunifikasi); Matrix Role `/admin/roles` +kolom "Bookings". Lihat `docs/mockup-section-reports/section-18-booking-service-orders.md`.
- **Update sebelumnya (Section 17, 2026-08-01):** Modul top-level baru `/procurement` (RFQ formal/comparison/clarification/selection, Service Order/amendment/acknowledgment/fulfillment, Procurement Performance Review, D-074); `/vendors` diperluas aditif (`category`/`status`/`documents`, tab "Documents" baru); `/supplier` diperluas (RFQ Inbox, Service Order Inbox, Invoice Submission preview — resolusi Q12); ringkasan RFQ/Service Order di tab "Itinerary & Services" `/projects/[id]`; Matrix Role `/admin/roles` +kolom "Procurement". Lihat `docs/mockup-section-reports/section-17-supplier-procurement.md`.
- **Update sebelumnya (Section 16, 2026-08-01):** Modul top-level baru `/mice` (`MiceEvent` — brief/venue/sessions/participant categories/BOQ/staffing/checklist/client approval/change order/incident/deliverables), ringkasan MICE Event di tab Itinerary & Services. Lihat `docs/mockup-section-reports/section-16-mice.md`.
- **Update sebelumnya (Section 09, 2026-07-31):** `ProjectOrderStatus` 10-nilai dirivasi (D-066); Accept/Return Handover dengan reason; transisi `Project.status` dengan guard+reason wajib; Team assignment; Tasks tab ditulis ulang (milestone/dependency/assignee); `ProjectRisk` (entitas baru); Closure Checklist shell. Bug fix link opportunity asal (CI-039).
- **Update sebelumnya (Section 08, sama tanggal):** `/client` ditulis ulang total (dashboard, profile+contacts, Action Center, travel request); route baru `/client/opportunities/[id]` (accept/reject self-service, CI-038) dan `/client/project-orders/[id]` (6 tab). **Catatan penting yang tetap berlaku:** verifikasi interaktif role Client TIDAK dapat dilakukan via smoke test SSR/curl (role-switching client-only via `localStorage`).
- **Update sebelumnya (Section 07, sama tanggal):** Panel "Customer Journey Funnel" 7-tahap dengan drill-down di `/customer-journey`; bug fix AE portfolio scoping (CI-037); toggle "Hanya Portfolio Saya" + filter owner/date baru di Customers/Project Orders list.
- **Update sebelumnya (Section 06, sama tanggal):** `/crm/quotations` ditulis ulang menjadi Management Approval Queue; histori approve/reject via `PartyActivity`; guard `approvalStatus`/`clientConfirmedAt` dipindah ke level data (`approveOpportunityWon`); `party.accountOwnerId` reaffirmation saat Won.
- **Update sebelumnya (Section 05, sama tanggal):** Duplicate Quotation, Compare Versions (nilai total), Send to Client (mock), Withdraw Submission, PDF/Print Preview (`quotation-preview`), field komersial Quotation (tax/markup/currency/validity/terms/inclusions/exclusions), Client Confirmation AE-facing di `/crm/opportunities/[id]`.
- **Update susulan (bug fix, sama tanggal):** User melaporkan app gagal mount di browser ("500 Internal Server Error — Failed to execute 'structuredClone' on 'Window'"). Root cause: `app/plugins/mock-reset.client.ts` (Section 01) memanggil `structuredClone()` langsung terhadap array `reactive()` Vue — tidak pernah terdeteksi oleh smoke test `curl` manapun sejak Section 01 karena kode client-only tidak dieksekusi saat SSR. Diperbaiki di `app/utils/mock-reset.ts` (`structuredClone` → `deepClone` berbasis JSON). Detail: `docs/mockup-change-impact-log.md` CI-035, `docs/frontend-known-issues.md` bagian 0b.
