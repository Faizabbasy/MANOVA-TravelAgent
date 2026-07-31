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
| 03 | Public Lead Intake | NOT_STARTED | — |
| 04 | Sales Leads dan Qualification | PARTIAL | `/customer-journey/leads` |
| 05 | Account Executive Opportunity dan Quotation | PARTIAL | `/crm/opportunities`, `/crm/opportunities/[id]` |
| 06 | Management Approval, Won dan Client Activation | PARTIAL | `/crm/opportunities/[id]` (section Commercial Approval + Mark as Won) |
| 07 | Customer Journey | PARTIAL | `/customer-journey`, `/customer-journey/customers[/[id]]`, `/customer-journey/project-orders[/[id]]` |
| 08 | Client Portal | NOT_STARTED | — |
| 09 | Project Order dan Handover | PARTIAL | `/projects`, `/projects/[id]`, `Opportunity.projectId` |
| 10 | Product Planning dan Costing | NOT_STARTED | — |
| 11 | Traveler dan Travel Documents | PARTIAL | Tab "Travelers" `/projects/[id]` |
| 12 | Itinerary, Operations, Tasks dan Readiness | PARTIAL | Tab "Itinerary & Services", "Tasks" `/projects/[id]` |
| 13 | Ticketing | PARTIAL (role-only, belum ada page dedicated) | Role `ticketing`, tab "Itinerary & Services" sub-flight |
| 14 | Accommodation | PARTIAL (role-only, belum ada page dedicated) | Role `accommodation`, tab "Itinerary & Services" sub-hotel |
| 15 | Transportation | PARTIAL (role-only, belum ada page dedicated) | Role `transportation`, tab "Itinerary & Services" sub-transport |
| 16 | MICE dan Event | PARTIAL (role-only, belum ada page dedicated) | Role `mice`, tab "Itinerary & Services" sub-MICE |
| 17 | Supplier dan Procurement | PARTIAL | `/vendors`, `/vendors/[id]`, `/supplier`, `/supplier/products`, `/supplier/orders` |
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
/finance, /finance/invoices, /finance/payments
/reports
/activity-center
/admin, /admin/users, /admin/roles, /admin/master-data, /admin/audit-trail
/supplier, /supplier/products, /supplier/orders
/client (baru, Section 02 — shell minimal Client Portal)
/expenses, /tasks (route lama/locked, tidak di sidebar — lihat docs/mockup-final-route-inventory.md)
```

Section 00 tidak membuat route baru (audit-only). Section 01 tidak membuat route baru (murni file utilitas + 1 section baru di `/settings`). **Section 02 menambah 1 route baru: `/client`** (shell minimal, lihat bagian 3).

## 3. Role Inventory Aktual vs Role Final Roadmap Baru

**Role aktual (`app/types/user.ts`, 16 nilai, per Section 02 2026-08-01):** `super-admin`, `management`, `account-executive`, `sales`, `product-planner`, `project-manager`, `operations`, `ticketing`, `accommodation`, `transportation`, `mice`, `procurement`, `finance`, `viewer`, `client`, `supplier` — **cocok penuh** dengan Role Final `prompts/01-PROTOKOL-WAJIB.md` (Q13 RESOLVED, D-059). `ModuleKey` bertambah `client-portal` (pola identik `supplier-portal`).

Catatan: `procurement` mendapat `vendor: MANAGE` (owner fungsional direktori Vendor, Section 17 nantinya membangun RFQ/sourcing di atasnya). `product-planner` mendapat VIEW read-only ke `crm`/`project`/`vendor`/`reports` sebagai placeholder sampai Section 10 membangun modul dedicated-nya. `client` mendapat `client-portal: MANAGE`, diisolasi per `clientPartyId` (`Party`, D-050) — shell `/client` (Section 02) baru mencakup profil company + list Opportunity + list Project Order (tanpa nilai komersial); fitur penuh tetap Section 08.

## 4. Data Model Inventory Aktual

`app/types/`: `common.ts`, `user.ts` (`RoleId`/`ModuleKey`/`User`), `party.ts` (`Party`/`ContactPerson`/`PartyActivity`), `lead.ts` (`Lead`/`LeadActivity`, +13 field Qualification Prompt 20), `opportunity.ts` (`Opportunity`/`Quotation`, +`OpportunityRequirementDetail`/`QuotationServiceItem`/`OpportunityWorkflowStatus` Prompt 20), `project.ts` (`Project`/`ProjectService`/`ItineraryItem`/`TravelerGroup`/`Traveler`/`RoomAssignment`), `vendor.ts` (`Vendor`/`VendorContact`/`VendorQuotation`/`VendorProduct`), `finance.ts` (`Invoice`/`Payment`), `activity.ts` (`ActivityEntry`/`Document`/`Task`/`SystemEvent`).

Belum ada type untuk: Client company profile terpisah (kemungkinan reuse `Party` per pola D-050, perlu keputusan saat Section 08), Product/Package catalog (Section 10), Travel document per jenis (visa/insurance — `Traveler` baru punya `passportNumber`/`passportExpiryDate`), RFQ/Service Order (Section 17/18), Cancellation/Refund/Incident record terstruktur (Section 19, saat ini hanya `ActivityEntry.category` generik), Notification record (Section 21).

## 4b. State Reset / Seed Scenario (Section 01, baru)

`app/utils/mock-reset.ts` + `app/plugins/mock-reset.client.ts` — snapshot seluruh reactive array terpusat diambil sedini mungkin (saat plugin client dimuat), tombol "Reset Demo Data" di `/settings` mengembalikan seluruh mock data ke kondisi seed awal. Lihat D-058 (`docs/mockup-design-decisions.md`) untuk rasional kenapa ini yang dipilih dibanding membangun lapisan repository paralel.

## 5. Area yang Harus Dilindungi (Jangan Dikerjakan Ulang)

Lihat `docs/mockup-implementation-state.md` bagian 5 untuk daftar lengkap dan alasannya (LOCKED `OpportunityStage`/`ProjectStatus`, Party/Prospect/Client model D-001/D-024, Commercial Approval D-049, Mark as Won satu-langkah D-053, Lead Qualification D-054, Requirement Gate D-055, vendor isolation Supplier D-048, pola narrow-role-exception permission, seluruh shared component `ui/*`). Section 01–24 berikutnya **wajib** membaca dokumen tsb sebelum menyentuh area manapun yang bersinggungan.
