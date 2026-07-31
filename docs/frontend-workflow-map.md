# Frontend Workflow Map — MANOVA (Roadmap Section 00–24)

Dibuat oleh **Section 00 — Current Progress Reconciliation** (2026-08-01). Memetakan Workflow Utama yang didefinisikan `prompts/01-PROTOKOL-WAJIB.md` terhadap implementasi aktual per langkah.

Workflow Utama (literal protokol):

`Public/Manual Lead → Sales Qualification → Assign Account Executive → Opportunity → Requirement Detail → Product Planning & Costing → Quotation → Management Approval → Client Confirmation → Opportunity Won → Active Client → Project Order → AE-to-PM Handover → Planning → Traveler Collection → Supplier Sourcing → Service Booking → Readiness → On Trip / Event → Changes / Incident → Finance Finalization → Completed → Closed`

## Status per Langkah

| # | Langkah | Status | Implementasi Aktual | Section Pemilik |
|---|---|---|---|---|
| 1 | Public Lead | COMPLETED (2026-08-01) | `/lead-intake` — 4 kategori, consent, UTM/referrer preview, duplicate suggestion, tulis langsung ke `LEADS` (Q15 RESOLVED) | 03 |
| 1b | Manual Lead | COMPLETED | Dialog "New Lead" (`/customer-journey/leads`), Sales-created | 04 |
| 2 | Sales Qualification | COMPLETED (2026-08-01) | Tab "Qualification" drawer Lead, 13 field, gate `getLeadMissingQualification`; Edit Lead, Reopen, merge suggestion (archive-dengan-referensi, D-061) | 04 |
| 3 | Assign Account Executive | COMPLETED | Field "Account Executive yang Menerima Lead" pada form Qualification (`Lead.handedOverTo`) | 04 |
| 4 | Opportunity | COMPLETED | `qualifyLeadAndCreateOpportunity` — auto-create saat Qualify, Party existing dicari dulu (no-duplicate) | 04/05 |
| 5 | Requirement Detail | COMPLETED | Section "Requirement Detail" `/crm/opportunities/[id]` (14 field AE), dialog "Edit Requirement", Requirement Gate sebelum Quotation | 05 |
| 6 | Product Planning & Costing | COMPLETED (2026-07-31) | `ProductTemplate`/`CostSheet` (`/product-planning`, `/product-planning/cost-sheets`), traveler-based costing (markup/tax/contingency), scenario/version comparison, snapshot ke Quotation via `applyCostSheetToQuotation` | 10 |
| 7 | Quotation | COMPLETED (2026-07-31) | Create/Edit (+tax/markup/currency/validity/terms/inclusions/exclusions)/Create New Version/Duplicate/Compare (nilai total vs versi sebelumnya)/Send to Client (mock)/Withdraw, PDF/Print Preview (`quotation-preview`, `window.print()`) | 05 |
| 8 | Management Approval | COMPLETED (2026-07-31) | Submit/Approve/Reject per-Opportunity (Prompt 19) + Management Approval Queue agregat `/crm/quotations` (Section 06, dialog review margin/discount/tax/markup/terms/complexity/risk, histori via `PartyActivity`) | 06 |
| 9 | Client Confirmation | COMPLETED (2026-07-31) | `recordClientConfirmation` + dialog AE-facing (Section 05); tab "Menunggu Client Confirmation" Management-facing di `/crm/quotations` (Section 06); **self-service oleh Client sendiri** di `/client/opportunities/[id]` (Section 08, CI-038) — Accept/Reject/Request Revision | 05/06/08 |
| 10 | Opportunity Won | COMPLETED | Tombol "Mark as Won" (AE, satu-langkah, D-053) — reuse `approveOpportunityWon` | 06 |
| 11 | Active Client | COMPLETED | `Party.lifecycleStatus` `prospect → client` otomatis saat Won (tidak duplikat company) | 06 |
| 12 | Project Order | COMPLETED (2026-07-31) | `Project` dibuat otomatis (reuse D-050) — `ProjectOrderStatus` 10-nilai dirivasi (D-066), `getProjectOrderStatus()` | 09 |
| 13 | AE-to-PM Handover | COMPLETED (2026-07-31) | `Project.ownerId` di-set default (`DEFAULT_PROJECT_OWNER_ID`) tetap dipertahankan; `acceptProjectHandover`/`returnProjectHandover` (baru) — langkah Accept/Return Handover eksplisit oleh PM dengan reason, UI di tab Overview | 09 |
| 14 | Planning | COMPLETED | `ProjectStatus` `draft`/`planning`, tab-tab Project Detail | 09/12 |
| 15 | Traveler Collection | COMPLETED (2026-07-31) | Tab "Travelers" (`Traveler`/`TravelerGroup`/`RoomAssignment`) + passport/ID/visa metadata, dietary/accessibility/companion, internal verification, sensitive value masking, bulk import preview+error report, manifest/rooming export preview, readiness indicator, client self-submission (`/client/project-orders/[id]`). Ticket/insurance document tracking TIDAK termasuk Wajib literal Section 11 — tetap di luar scope (bukan gap tersembunyi). | 11 |
| 16 | Supplier Sourcing | COMPLETED (2026-08-01) | `VendorQuotation` submit/accept/reject (per-service, Section 13 lama) TETAP ada, ditambah RFQ formal (`/procurement`) — invitation, per-vendor response, side-by-side comparison, clarification thread dua-arah, formal "Select" action, handoff ke Service Order | 17 |
| 17 | Service Booking | PARTIAL | `ProjectService.status` generik (Not Started→Sourcing→...→Completed) tetap dipakai lintas domain. Flight (Section 13, `FlightBooking`), Hotel (Section 14, `HotelBooking`), Transportation (Section 15, `TransportBooking`), dan MICE (Section 16, `MiceEvent`) kini punya lifecycle detail dedicated (Hold/Confirm/Issue/Reissue/Cancel/Refund untuk flight; Quote/Confirm/Amend/Cancel/No-Show untuk hotel; Quote/Assign/Confirm/Cancel/No-Show untuk transportasi; Planning/Confirmed/In-Progress/Completed/Cancelled untuk MICE) — seluruh Section 13–16 kini RESOLVED. Procurement `ServiceOrder` (Section 17, `/procurement/service-orders/[id]`) menambahkan lapisan formal vendor-facing (acknowledgment/amendment/fulfillment/invoice) TERPISAH dari lifecycle per-domain di atas — konsolidasi tampilan tunggal lintas SELURUH modul (booking + Service Order Procurement) tetap milik Section 18 | 13–17/18 |
| 18 | Readiness | NOT_STARTED | Tidak ada readiness checklist/matrix terpisah dari missing-document indicator existing | 12 |
| 19 | On Trip / Event | PARTIAL | `ProjectStatus.ongoing-trip` ada sebagai status; run sheet (`/projects/[id]/run-sheet-preview`) dan on-trip updates/shift notes (`ShiftNote`, tab Itinerary & Services) sudah ada sejak Section 12; Ticketing (Section 13, `/ticketing`), Accommodation (Section 14, `/accommodation`), Transportation (Section 15, `/transportation`), dan MICE (Section 16, `/mice`) kini seluruhnya punya modul dedicated | 12/13-16 |
| 20 | Changes / Incident | PARTIAL | Tab "Activity & Changes" (`ActivityEntry` + `ChangeCategory`/`ChangeApprovalStatus`) — Incident severity/escalation dan Refund tracking terstruktur belum ada | 19 |
| 21 | Finance Finalization | PARTIAL | Invoice/Payment/Budget vs Actual ada — "credit status mock" refund belum ada | 20 |
| 22 | Completed | COMPLETED | `ProjectStatus.completed` tersedia sebagai status | 09/12 |
| 23 | Closed | PARTIAL (2026-07-31) | `ProjectOrderStatus.closed` dirivasi dari `Project.closedAt` (D-066) — TIDAK ada mekanisme untuk mengisi `closedAt` sendiri, sengaja diserahkan ke Section 24 (Closure Checklist shell sudah ada, belum menggerbangi apa pun) | 09/24 |

## Catatan Dependency Order

Roadmap Section 00–24 menempatkan **Section 10 (Product Planning dan Costing) setelah Section 09 (Project Order)**, padahal pada Workflow Utama di atas, langkah "Product Planning & Costing" (#6) logically terjadi **sebelum** Quotation (#7) — yaitu antara Section 05 (Opportunity/Quotation) dan Section 06 (Management Approval). Ini dicatat sebagai observasi, **bukan** perubahan urutan section (keputusan urutan eksekusi tetap milik user) — kemungkinan Section 10 dimaksudkan sebagai penyempurnaan retroaktif terhadap costing yang sudah mulai dibuat sederhana di Section 05, bukan blocking hard-dependency.

Detail gap lengkap per langkah: `docs/frontend-known-issues.md`.
