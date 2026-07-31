# Frontend Implementation Roadmap — MANOVA (Section 00–24)

Dibuat oleh **Section 00 — Current Progress Reconciliation** (2026-08-01). Urutan eksekusi mengikuti urutan file `prompts/SECTION_NN_*.md` dan `prompts/Section 0N — *.md` apa adanya (ditentukan user, tidak diubah oleh Section 00). Kolom "Status Awal" adalah hasil audit Section 00 terhadap kondisi codebase SEBELUM section tsb mulai dikerjakan.

| Section | Nama | Status Awal (per audit Section 00) | Prasyarat yang Belum Terpenuhi |
|---|---|---|---|
| 00 | Current Progress Reconciliation | COMPLETED | — |
| 01 | Frontend Foundation dan State Governance | COMPLETED (2026-08-01) | — (repository/service-layer: `app/data/index.ts` diformalkan sebagai layer existing, D-058; state reset/seed scenario diimplementasikan baru) |
| 02 | Role, Access dan Navigation | COMPLETED (2026-08-01) | — (role/module/nav/matrix view lengkap; fitur bisnis penuh Client Portal tetap Section 08, RFQ/Procurement workflow tetap Section 17, modul Product Planning tetap Section 10) |
| 03 | Public Lead Intake | NOT_STARTED | Tidak ada prasyarat blocking dari section lain — dapat dikerjakan kapan saja setelah Section 01/02 |
| 04 | Sales Leads dan Qualification | PARTIAL | Reopen archived lead, merge-duplicate suggestion |
| 05 | Account Executive Opportunity dan Quotation | PARTIAL | Duplicate/compare quotation, send-mock ke client, withdraw submission, PDF/print preview, line item tax/fee/markup terpisah dari discount |
| 06 | Management Approval, Won dan Client Activation | PARTIAL | Approval queue agregat (Q14), client confirmation record (Q14) |
| 07 | Customer Journey | PARTIAL | Funnel drill-down per stage + conversion metrics eksplisit (saat ini `/customer-journey` menampilkan stats ringkas, bukan funnel interaktif penuh) |
| 08 | Client Portal | PARTIAL (shell `/client` dari Section 02) | Fitur bisnis penuh: quotation confirm, document, traveler submission, communication, invoice status |
| 09 | Project Order dan Handover | PARTIAL | Taksonomi status baru (Q16), langkah Accept/Return Handover eksplisit oleh PM |
| 10 | Product Planning dan Costing | NOT_STARTED | Entitas Product/Package catalog dan Cost Sheet baru (role `product-planner` sudah ada sejak Section 02) |
| 11 | Traveler dan Travel Documents | PARTIAL | Tracking visa/tiket/asuransi (saat ini hanya passport), completion indicator per dokumen |
| 12 | Itinerary, Operations, Tasks dan Readiness | PARTIAL | Readiness checklist/matrix terpisah, departure countdown/alert eksplisit, run sheet |
| 13 | Ticketing | PARTIAL | Halaman dedicated `/ticketing` atau setara, PNR/e-ticket mock, dashboard Ticketing tersendiri |
| 14 | Accommodation | PARTIAL | Halaman dedicated, room block/voucher mock, dashboard Accommodation tersendiri |
| 15 | Transportation | PARTIAL | Halaman dedicated, driver/vehicle mock, dashboard Transportation tersendiri |
| 16 | MICE dan Event | PARTIAL | Halaman dedicated, venue/BOQ/staffing mock, dashboard MICE tersendiri |
| 17 | Supplier dan Procurement | PARTIAL | RFQ formal/comparison/clarification, Service Order/amendment/acknowledgment, supplier invoice submission preview (role `procurement` + `vendor: MANAGE` sudah ada sejak Section 02) |
| 18 | Booking dan Service Orders | NOT_STARTED | Halaman konsolidasi Service Order lintas Section 13–16 |
| 19 | Changes, Cancellation, Refund dan Incident | PARTIAL | Cancellation/Refund/Incident record terstruktur terpisah dari `ActivityEntry` generik |
| 20 | Project Finance | PARTIAL | Refund/credit status mock |
| 21 | Documents, Communication dan Notifications | PARTIAL | Document center konsolidasi lintas modul, notification center in-app, komunikasi client/supplier terstruktur |
| 22 | Dashboards, Reports, Lead Recap dan Activity Center | PARTIAL | Widget Dashboard untuk role baru (Client/Product Planner/Procurement, role sudah ada sejak Section 02 tapi Dashboard `/` belum menyediakan widget spesifik agar tidak kosong — pola sama seperti AE/Supplier di Prompt 19), export mock |
| 23 | Administration, Master Data dan Audit | PARTIAL | Master data currencies/taxes/payment terms/cancellation rules/numbering/templates/readiness gates/assignment rules, historical snapshot warning |
| 24 | Full Regression dan Final Implementation Guide | NOT_STARTED | Menunggu Section 01–23 selesai (final section, sesuai desain) |

## Rekomendasi Urutan Eksekusi Berikutnya

Section 01 sudah COMPLETED (2026-08-01) — lihat `docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md`. Section 02 (Role, Access dan Navigation) direkomendasikan sebagai section berikutnya berbasis dependency (role `client`/`product-planner`/`procurement` yang ditambahkan di sini menjadi prasyarat Section 08/10/17). Sesuai protokol, keputusan section mana yang benar-benar dijalankan berikutnya tetap menunggu perintah eksplisit user — dokumen ini hanya menyediakan rekomendasi berbasis dependency, bukan keputusan final.

## Fitur yang Tidak Boleh Dikerjakan Ulang (Protected)

- Party/Prospect/Client lifecycle model (D-001/D-024).
- `OpportunityStage` (9 nilai) dan `ProjectStatus` (8 nilai) — LOCKED, dipakai luas, hanya boleh diperluas aditif/dirivasi (pola D-049/D-053/D-055/D-056), tidak direstrukturisasi.
- Commercial Approval workflow (submit/approve/reject Quotation, D-049).
- Mark as Won satu-langkah oleh AE (D-053).
- Lead Qualification data model dan gate (D-054/D-055).
- Vendor isolation Supplier per company (`vendorId`/`vendorScopeId`, D-048).
- Seluruh shared component `app/components/ui/*` dan pola halaman (`PageHeader`/`SectionCard`/`DetailMetadataList`/`StatusBadge`/`RoleAccessState`/`EmptyState`/`Table*`/`Dialog*`/`Tabs*`/`Sheet*`).
- Pola narrow-role-exception permission (`canManageX` per halaman) — jangan dipindah paksa ke `ROLE_MODULE_ACCESS` tanpa alasan kuat.
- Seluruh fixture ID existing (`PTY-`, `OPP-`, `QUO-`, `PRJ-`, `LED-`, `VND-`, `USR-`, dst.) — section baru menambah, tidak mengganti nomor existing.
