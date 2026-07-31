# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori section, `docs/mockup-progress.md` untuk narasi Prompt 0–5+19, dan `docs/mockup-change-impact-log.md` untuk detail perubahan lintas-section). Wajib dibaca di awal setiap section/change request baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Seluruh 18 section mockup baku (Section 00–18) **COMPLETED**, ditambah **Prompt 19 — Change Request (Customer Journey, Account Executive, Supplier, Commercial Approval)** COMPLETED di atasnya (2026-07-30).
- **Current section/change:** Tidak ada yang aktif — menunggu perintah user untuk section/change berikutnya.
- **Last completed:** **Prompt 19 — Change Request** (`prompts/21-PROMPT-19-CHANGES-&-UPDATE.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/change-customer-journey-ae-supplier.md`.
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

**Catatan commit:** Section 08–15 sudah ter-commit (lihat histori `git log`); Section 16 (`2625a2b`), Section 17 (`6d5d179`), Section 18 (`9c0abe7`) ter-commit. Prompt 19 (Change Request) **belum ter-commit** pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

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

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Prompt 19, KECUALI primitive `ui/sheet/*` (sudah ada sejak Foundation, **baru dipakai pertama kali** di drawer Lead Detail — `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription`/`SheetFooter`). Seluruh halaman baru reuse `PageHeader`/`SectionCard`/`RoleAccessState`/`EmptyState`/`StatusBadge`/`StatusBreakdownList`/`StatsCard`/`Table*`/`Dialog*`/`Tabs*`/`DetailMetadataList` existing.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Entitas baru (Prompt 19):** `Lead`/`LeadActivity` (`app/types/lead.ts`, `app/data/leads.ts`), `VendorProduct` (`app/types/vendor.ts`, `app/data/vendors.ts` — `VENDOR_PRODUCTS`), `SystemEvent` (`app/types/activity.ts`, `app/data/activity.ts` — `SYSTEM_EVENTS`, **bukan** `reactive()`, log statis).

**Field aditif:** `Party` +`size`/`city`/`phone`/`accountOwnerId`; `Quotation` +`approvalStatus`/`approvedBy`/`approvalNote` (`QuotationApprovalStatus`); `User` +`vendorId`; `Project` — tidak ada field baru.

**Role & permission:** `RoleId` +`account-executive`/`supplier` (13 role total); `ModuleKey` +`supplier-portal`; `usePermissions()` +`vendorScopeId` (vendor isolation); `NavItem` +`roles?: RoleId[]` (narrow nav override, dipakai Activity Center dan 3 child Customer Journey).

**Data reassignment:** `Opportunity.ownerId` (OPP-001–008) di-reassign dari `USR-001` (Sales) ke `USR-014` (AE). `OPP-005` di-restage dari `won-requested` ke `negotiation` (QUO-005 `approvalStatus: submitted`); `OPP-006` tetap `negotiation` (QUO-006 `approvalStatus: approved`). `OPP-008`/`QUO-008`/`PRJ-104` baru (repeat client PTY-001).

**Selektor/mutator baru:** `getDocumentsByParty`, `getOpportunitiesByOwner`, `getProjectsByAccountExecutive`, `submitQuotationForApproval`/`approveQuotation`/`rejectQuotation`, `getLeadById`/`getLeadActivities`/`getLeadFollowUps`/`createLead`/`createLeadActivity`/`archiveLead`/`qualifyLeadAndCreateOpportunity`, `getVendorProducts`/`createVendorProduct` — seluruhnya di `app/data/index.ts`.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak disentuh** Prompt 19.
- `OpportunityStage` (union 9 nilai, D-028) — **tidak direstrukturisasi** Prompt 19 (D-049) meski workflow Commercial Approval ditambahkan; state machine Won existing (`won-requested → won`, D-025) tetap dipakai apa adanya sebagai gerbang final.
- `/crm/prospects`, `/crm/clients`, `/crm/parties/[id]`, `/projects`, `/projects/[id]` — **tidak diubah** oleh modul Customer Journey (D-050); Customer Journey adalah lensa presentasi baru di atas data yang sama, bukan pengganti.
- Tab "Activity & Changes" Project Detail (`ActivityEntry`, LOCKED Section 05/14) — **tidak disentuh** oleh `SystemEvent` (Activity Center) yang merupakan log terpisah level-atas.
- Selektor finansial/operasional (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`, `getServicesForProjects`, `isUpcomingDeparture`) — gunakan yang sudah ada, jangan hitung ulang logic yang sama di tempat lain.
- `app/pages/reports/index.vue` — pemilik penuh 6 section Reports (Section 16); `app/pages/vendors/[id]/index.vue` — pemilik Vendor Detail (Section 13), Prompt 19 hanya menambah 1 tab.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** export mock Reports tidak dikerjakan (Section 16); tidak ada CRUD invoice/payment (Section 15); Supplier Portal (`/supplier/orders`) read-only, tidak ada self-service submit quotation dari sisi supplier (Q12, `docs/mockup-open-questions.md`).

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses** | Client & server bundle ter-build sukses, seluruh route baru ter-compile (verifikasi chunk `customer-journey-*`, `leads-*`, `customers-*`, `project-orders-*`, `lead-sources-*`, `activity-center--*`, `supplier-*`, `products-*`, `orders-*`). Kendala `EBUSY` pada penghapusan `.output` di beberapa run (pre-existing, A-002) — diselesaikan dengan mematikan proses `node` yang masih berjalan sebelum retry. |
| Smoke test HTTP (32 route, baru + existing) | **Sukses** | Seluruhnya HTTP 200, termasuk `?tab=products` (Vendor Detail) |
| Smoke test konten | **Sukses** | Commercial Approval badge "Menunggu Approval" (OPP-005)/"Disetujui" (OPP-006) tampil tepat; Supplier (default Super Admin, tanpa `vendorId`) menampilkan `RoleAccessState` — isolasi bekerja; Lead Source Recap (Total 10/Qualified 3/Opportunities 2/Won 1) dihitung ulang manual dan cocok; Vendor Detail Products tab menampilkan katalog PT ABC/PT EFG tanpa cross-contamination; Activity Center menampilkan 22/22 event |
| Regresi route existing (Dashboard, CRM, Projects, Vendors, Finance, Reports, Admin) | **Tidak berubah** kontennya, tetap HTTP 200 | |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (ganti role live) | **Tidak dilakukan headless** | Keterbatasan tooling konsisten sejak Section 06 — dimitigasi lewat code review ketat terhadap seluruh gate baru (`canManageLead`, `canManageOpportunity`, `vendorScopeId`, `roles` nav override) |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. Belum diselesaikan sejak Section 06, termasuk di change request ini.
- Q12 (baru) — self-service submit quotation dari `/supplier/orders` tidak diimplementasikan (deferred, `docs/mockup-open-questions.md`).
- Export mock Reports tidak dikerjakan (Section 16, tidak berubah).
- Verifikasi interaktif tidak dilakukan secara headless (keterbatasan tooling, konsisten sejak Section 06).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Tidak ada section/change baku selanjutnya. Untuk langkah berikutnya, pertimbangkan: menyelesaikan Q8 (tooling lint/typecheck/test), backend/API integration, atau perubahan/permintaan baru dari user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Prompt 19 (Change Request — Customer Journey, Account Executive, Supplier, Commercial Approval) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
