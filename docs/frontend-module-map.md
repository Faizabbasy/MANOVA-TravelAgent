# Frontend Module Map — MANOVA (Roadmap Section 00–24)

Dibuat oleh **Section 00 — Current Progress Reconciliation** (2026-08-01), sesuai `prompts/01-PROTOKOL-WAJIB.md` versi "FRONTEND-ONLY CONTINUATION". Memetakan kondisi codebase aktual (hasil Prompt 0–20, seluruhnya COMPLETED — lihat `docs/mockup-implementation-state.md`) terhadap 25 section roadmap baru (Section 00–24). Dokumen ini **tidak menggantikan** `docs/mockup-information-architecture.md`/`docs/route-and-role-matrix.md` (tetap source of truth IA/route Prompt 0–20) — ini adalah lapisan pemetaan tambahan (D-057, `docs/mockup-design-decisions.md`).

Status: `COMPLETED` (memenuhi seluruh "Wajib" section baru), `PARTIAL` (sebagian fondasi ada, sebagian "Wajib" section baru belum), `NOT_STARTED` (belum ada implementasi sama sekali), `NEEDS_REVIEW` (ada tapi perlu verifikasi visual/interaktif).

---

## 1. Ringkasan Status per Section

| Section | Nama | Status | Route/Modul Aktual Terkait |
|---|---|---|---|
| 00 | Current Progress Reconciliation | COMPLETED | — (audit-only) |
| 01 | Frontend Foundation dan State Governance | COMPLETED | `app/types/*`, `app/constants/*`, `app/data/*`, `app/components/ui/*`, `app/utils/mock-reset.ts`, `app/plugins/mock-reset.client.ts`, `/settings` |
| 02 | Role, Access dan Navigation | COMPLETED | `app/composables/usePermissions.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `/admin/roles`, `/settings`, `/client` |
| 03 | Public Lead Intake | COMPLETED | `/lead-intake` (baru, `layout: false`), `/login` (+link) |
| 04 | Sales Leads dan Qualification | COMPLETED | `/customer-journey/leads` (+Edit Lead, +Reopen, +merge suggestion) |
| 05 | Account Executive Opportunity dan Quotation | COMPLETED (2026-07-31) | `/crm/opportunities`, `/crm/opportunities/[id]`, `/crm/opportunities/[id]/quotation-preview` (baru) |
| 06 | Management Approval, Won dan Client Activation | COMPLETED (2026-07-31) | `/crm/opportunities/[id]` (Commercial Approval + Mark as Won), `/crm/quotations` (Management Approval Queue, baru) |
| 07 | Customer Journey | COMPLETED (2026-07-31) | `/customer-journey` (+funnel 7-tahap, drill-down), `/customer-journey/customers[/[id]]` (+owner filter, +portfolio toggle), `/customer-journey/project-orders[/[id]]` (+date filter, +portfolio toggle) |
| 08 | Client Portal | COMPLETED (2026-07-31) | `/client` (rewrite — dashboard, profile+contacts, action center, travel request), `/client/opportunities/[id]` (baru), `/client/project-orders/[id]` (baru, 6 tab) |
| 09 | Project Order dan Handover | COMPLETED (2026-07-31) | `/projects`, `/projects/[id]` (Overview +Handover/Status/Team/Risks/Closure Checklist, Tasks tab ditulis ulang), `Opportunity.projectId` |
| 10 | Product Planning dan Costing | COMPLETED (2026-07-31) | `/product-planning` (baru), `/product-planning/[id]` (baru), `/product-planning/cost-sheets` (baru), `/product-planning/cost-sheets/[id]` (baru), ringkasan Cost Sheet di `/crm/opportunities/[id]` |
| 11 | Traveler dan Travel Documents | COMPLETED (2026-07-31) | Tab "Travelers" `/projects/[id]` (diperkaya), `/projects/[id]/manifest-preview` (baru), tab "Travelers" `/client/project-orders/[id]` (diperkaya) |
| 12 | Itinerary, Operations, Tasks dan Readiness | COMPLETED (2026-08-01) | Tab "Itinerary & Services", "Tasks" `/projects/[id]` (diperkaya), `/projects/[id]/run-sheet-preview` (baru), tab "Itinerary" `/client/project-orders/[id]` (difilter) |
| 13 | Ticketing | COMPLETED (2026-08-01) | `/ticketing` (baru), `/ticketing/[id]` (baru), `/ticketing/[id]/eticket-preview` (baru), ringkasan Flight Booking di tab "Itinerary & Services" `/projects/[id]` |
| 14 | Accommodation | COMPLETED (2026-08-01) | `/accommodation` (baru), `/accommodation/[id]` (baru), `/accommodation/[id]/voucher-preview` (baru), ringkasan Hotel Booking di tab "Itinerary & Services" `/projects/[id]` |
| 15 | Transportation | COMPLETED (2026-08-01) | `/transportation` (baru), `/transportation/[id]` (baru), `/transportation/[id]/service-order-preview` (baru), `/transportation/[id]/driver-sheet-preview` (baru), ringkasan Transport Booking di tab "Itinerary & Services" `/projects/[id]` |
| 16 | MICE dan Event | COMPLETED (2026-08-01) | `/mice` (baru), `/mice/[id]` (baru), `/mice/[id]/rundown-preview` (baru), `/mice/[id]/boq-preview` (baru), ringkasan MICE Event di tab "Itinerary & Services" `/projects/[id]` |
| 17 | Supplier dan Procurement | COMPLETED (2026-08-01) | `/vendors` (+kolom kategori/status), `/vendors/[id]` (+tab Documents), `/supplier` (+2 link card), `/supplier/products`, `/supplier/orders`, `/supplier/rfq` (baru), `/supplier/rfq/[id]` (baru), `/supplier/service-orders` (baru), `/supplier/service-orders/[id]` (baru), `/procurement` (baru), `/procurement/rfq/[id]` (baru), `/procurement/service-orders/[id]` (baru), `/procurement/performance` (baru), ringkasan RFQ/Service Order di tab "Itinerary & Services" `/projects/[id]` |
| 18 | Booking dan Service Orders | NOT_STARTED (konsolidasi lintas modul belum ada) | Tab "Vendors" `/projects/[id]` (setara sebagian) |
| 19 | Changes, Cancellation, Refund dan Incident | PARTIAL | Tab "Activity & Changes" `/projects/[id]` |
| 20 | Project Finance | PARTIAL | `/finance/invoices`, `/finance/payments`, tab "Finance" `/projects/[id]` |
| 21 | Documents, Communication dan Notifications | PARTIAL | Tab "Documents" `/projects/[id]`, tab "Documents" Customer Detail |
| 22 | Dashboards, Reports, Lead Recap dan Activity Center | PARTIAL | `/`, `/reports`, `/customer-journey/lead-sources`, `/activity-center` |
| 23 | Administration, Master Data dan Audit | PARTIAL | `/admin`, `/admin/users`, `/admin/roles`, `/admin/master-data`, `/admin/audit-trail` |
| 24 | Full Regression dan Final Implementation Guide | NOT_STARTED | — (final section) |

## 2. Route Inventory Aktual (per 2026-08-01)

```
/                                    Dashboard (role-conditional widgets)
/login
/settings
/crm, /crm/prospects, /crm/clients, /crm/opportunities[/[id]], /crm/parties/[id], /crm/quotations (placeholder)
/customer-journey, /customer-journey/leads, /customer-journey/customers[/[id]], /customer-journey/project-orders[/[id]], /customer-journey/lead-sources
/projects, /projects/create, /projects/[id], /projects/[id]/edit
/vendors, /vendors/[id]
/procurement, /procurement/rfq/[id], /procurement/service-orders/[id], /procurement/performance (baru, Section 17)
/finance, /finance/invoices, /finance/payments
/reports
/activity-center
/admin, /admin/users, /admin/roles, /admin/master-data, /admin/audit-trail
/supplier, /supplier/products, /supplier/orders, /supplier/rfq[/[id]], /supplier/service-orders[/[id]] (2 route terakhir baru, Section 17)
/client (baru, Section 02 — shell minimal Client Portal)
/lead-intake (baru, Section 03 — public, layout:false, tanpa middleware auth)
/expenses, /tasks (route lama/locked, tidak di sidebar — lihat docs/mockup-final-route-inventory.md)
```

Section 00 tidak membuat route baru (audit-only). Section 01 tidak membuat route baru (murni file utilitas + 1 section baru di `/settings`). **Section 02 menambah 1 route baru: `/client`** (shell minimal, lihat bagian 3). **Section 03 menambah 1 route baru: `/lead-intake`** (public, di luar dashboard internal — lihat `docs/mockup-design-decisions.md` D-060).

## 3. Role Inventory Aktual vs Role Final Roadmap Baru

**Role aktual (`app/types/user.ts`, 16 nilai, per Section 02 2026-08-01):** `super-admin`, `management`, `account-executive`, `sales`, `product-planner`, `project-manager`, `operations`, `ticketing`, `accommodation`, `transportation`, `mice`, `procurement`, `finance`, `viewer`, `client`, `supplier` — **cocok penuh** dengan Role Final `prompts/01-PROTOKOL-WAJIB.md` (Q13 RESOLVED, D-059). `ModuleKey` bertambah `client-portal` (pola identik `supplier-portal`).

Catatan: `procurement` mendapat `vendor: MANAGE` (owner fungsional direktori Vendor) DAN kini `procurement: MANAGE` (Section 17 — RFQ/Service Order/Supplier Invoice lifecycle penuh di `/procurement`, D-074). `product-planner` mendapat VIEW read-only ke `crm`/`project`/`vendor`/`reports` sebagai placeholder sampai Section 10 membangun modul dedicated-nya. `client` mendapat `client-portal: MANAGE`, diisolasi per `clientPartyId` (`Party`, D-050) — shell `/client` (Section 02) baru mencakup profil company + list Opportunity + list Project Order (tanpa nilai komersial); fitur penuh tetap Section 08.

## 4. Data Model Inventory Aktual

`app/types/`: `common.ts`, `user.ts` (`RoleId`/`ModuleKey`/`User`), `party.ts` (`Party`/`ContactPerson`/`PartyActivity`), `lead.ts` (`Lead`/`LeadActivity`, +13 field Qualification Prompt 20), `opportunity.ts` (`Opportunity`/`Quotation`, +`OpportunityRequirementDetail`/`QuotationServiceItem`/`OpportunityWorkflowStatus` Prompt 20), `project.ts` (`Project`/`ProjectService`/`ItineraryItem`/`TravelerGroup`/`Traveler`/`RoomAssignment`), `vendor.ts` (`Vendor`/`VendorContact`/`VendorQuotation`/`VendorProduct`/`VendorDocument`, +`category`/`status` pada `Vendor`, Section 17), `procurement.ts` (`RFQ`/`RFQInvitation`/`RFQResponse`/`RFQClarificationMessage`/`ServiceOrder`/`ServiceOrderAmendment`/`SupplierInvoice`, baru Section 17), `finance.ts` (`Invoice`/`Payment`), `activity.ts` (`ActivityEntry`/`Document`/`Task`/`SystemEvent`).

Belum ada type untuk: Client company profile terpisah (kemungkinan reuse `Party` per pola D-050, perlu keputusan saat Section 08), Travel document per jenis (visa/insurance — `Traveler` baru punya `passportNumber`/`passportExpiryDate`), "Service Order konsolidasi lintas jenis layanan" (Section 18 — BERBEDA dari `ServiceOrder` Procurement Section 17, lihat `docs/frontend-known-issues.md` bagian 13 catatan disambiguasi), Cancellation/Refund/Incident record terstruktur (Section 19, saat ini hanya `ActivityEntry.category` generik), Notification record (Section 21). Product/Package catalog dan Cost Sheet (Section 10) sudah **RESOLVED** — `+ProductTemplate`/`ProductServiceAlternative`/`CostSheet`/`CostSheetLineItem` (`app/types/product.ts`). RFQ/Service Order Procurement (Section 17) sudah **RESOLVED**.

## 4b. State Reset / Seed Scenario (Section 01, baru)

`app/utils/mock-reset.ts` + `app/plugins/mock-reset.client.ts` — snapshot seluruh reactive array terpusat diambil sedini mungkin (saat plugin client dimuat), tombol "Reset Demo Data" di `/settings` mengembalikan seluruh mock data ke kondisi seed awal. Lihat D-058 (`docs/mockup-design-decisions.md`) untuk rasional kenapa ini yang dipilih dibanding membangun lapisan repository paralel.

## 5. Area yang Harus Dilindungi (Jangan Dikerjakan Ulang)

Lihat `docs/mockup-implementation-state.md` bagian 5 untuk daftar lengkap dan alasannya (LOCKED `OpportunityStage`/`ProjectStatus`, Party/Prospect/Client model D-001/D-024, Commercial Approval D-049, Mark as Won satu-langkah D-053, Lead Qualification D-054, Requirement Gate D-055, vendor isolation Supplier D-048, pola narrow-role-exception permission, seluruh shared component `ui/*`). Section 01–24 berikutnya **wajib** membaca dokumen tsb sebelum menyentuh area manapun yang bersinggungan.
