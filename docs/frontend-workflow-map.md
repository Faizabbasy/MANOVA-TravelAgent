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
| 6 | Product Planning & Costing | NOT_STARTED | Tidak ada entitas/role Product Planner, tidak ada cost sheet terpisah dari Quotation | 10 |
| 7 | Quotation | COMPLETED (2026-07-31) | Create/Edit (+tax/markup/currency/validity/terms/inclusions/exclusions)/Create New Version/Duplicate/Compare (nilai total vs versi sebelumnya)/Send to Client (mock)/Withdraw, PDF/Print Preview (`quotation-preview`, `window.print()`) | 05 |
| 8 | Management Approval | PARTIAL | Submit/Approve/Reject Commercial Approval per-Opportunity ada; approval queue agregat belum ada (Q14) | 06 |
| 9 | Client Confirmation | PARTIAL (2026-07-31) | `recordClientConfirmation` + dialog AE-facing di `/crm/opportunities/[id]`, gerbang tambahan sebelum Mark as Won (Section 05) — queue/notifikasi Management-facing dan Client Portal-facing confirmation belum ada (Q14) | 05/06/08 |
| 10 | Opportunity Won | COMPLETED | Tombol "Mark as Won" (AE, satu-langkah, D-053) — reuse `approveOpportunityWon` | 06 |
| 11 | Active Client | COMPLETED | `Party.lifecycleStatus` `prospect → client` otomatis saat Won (tidak duplikat company) | 06 |
| 12 | Project Order | PARTIAL | `Project` dibuat otomatis (reuse D-050) — status taxonomy baru (Created/Handover Pending/dst., Q16) belum diimplementasikan | 09 |
| 13 | AE-to-PM Handover | PARTIAL | `Project.ownerId` di-set default (`DEFAULT_PROJECT_OWNER_ID`), AE tetap di `teamUserIds` — belum ada langkah "Accept/Return Handover" eksplisit oleh PM | 09 |
| 14 | Planning | COMPLETED | `ProjectStatus` `draft`/`planning`, tab-tab Project Detail | 09/12 |
| 15 | Traveler Collection | PARTIAL | Tab "Travelers" (`Traveler`/`TravelerGroup`/`RoomAssignment`), passport number/expiry ada — visa/insurance/ticket document tracking belum | 11 |
| 16 | Supplier Sourcing | PARTIAL | `VendorQuotation` submit/accept/reject ada (per-service) — RFQ formal/comparison/clarification workflow (Section 17 baru) belum | 17 |
| 17 | Service Booking | PARTIAL | `ProjectService.status` generik (Not Started→Sourcing→...→Completed) — tidak ada halaman per-domain (Ticketing/Accommodation/Transportation/MICE) terpisah, hanya role gate pada tab bersama | 13–16/18 |
| 18 | Readiness | NOT_STARTED | Tidak ada readiness checklist/matrix terpisah dari missing-document indicator existing | 12 |
| 19 | On Trip / Event | PARTIAL | `ProjectStatus.ongoing-trip` ada sebagai status, tidak ada run-sheet/on-trip update page khusus | 12/16 |
| 20 | Changes / Incident | PARTIAL | Tab "Activity & Changes" (`ActivityEntry` + `ChangeCategory`/`ChangeApprovalStatus`) — Incident severity/escalation dan Refund tracking terstruktur belum ada | 19 |
| 21 | Finance Finalization | PARTIAL | Invoice/Payment/Budget vs Actual ada — "credit status mock" refund belum ada | 20 |
| 22 | Completed | COMPLETED | `ProjectStatus.completed` tersedia sebagai status | 09/12 |
| 23 | Closed | NOT_STARTED | Tidak ada status `closed` terpisah dari `completed` (Section 09 baru meminta `Closed` sebagai status berbeda, Q16) | 09 |

## Catatan Dependency Order

Roadmap Section 00–24 menempatkan **Section 10 (Product Planning dan Costing) setelah Section 09 (Project Order)**, padahal pada Workflow Utama di atas, langkah "Product Planning & Costing" (#6) logically terjadi **sebelum** Quotation (#7) — yaitu antara Section 05 (Opportunity/Quotation) dan Section 06 (Management Approval). Ini dicatat sebagai observasi, **bukan** perubahan urutan section (keputusan urutan eksekusi tetap milik user) — kemungkinan Section 10 dimaksudkan sebagai penyempurnaan retroaktif terhadap costing yang sudah mulai dibuat sederhana di Section 05, bukan blocking hard-dependency.

Detail gap lengkap per langkah: `docs/frontend-known-issues.md`.
