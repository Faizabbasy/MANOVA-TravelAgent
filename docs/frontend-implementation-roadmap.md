# Frontend Implementation Roadmap — MANOVA (Section 00–24)

Dibuat oleh **Section 00 — Current Progress Reconciliation** (2026-08-01). Urutan eksekusi mengikuti urutan file `prompts/SECTION_NN_*.md` dan `prompts/Section 0N — *.md` apa adanya (ditentukan user, tidak diubah oleh Section 00). Kolom "Status Awal" adalah hasil audit Section 00 terhadap kondisi codebase SEBELUM section tsb mulai dikerjakan.

| Section | Nama | Status Awal (per audit Section 00) | Prasyarat yang Belum Terpenuhi |
|---|---|---|---|
| 00 | Current Progress Reconciliation | COMPLETED | — |
| 01 | Frontend Foundation dan State Governance | COMPLETED (2026-08-01) | — (repository/service-layer: `app/data/index.ts` diformalkan sebagai layer existing, D-058; state reset/seed scenario diimplementasikan baru) |
| 02 | Role, Access dan Navigation | COMPLETED (2026-08-01) | — (role/module/nav/matrix view lengkap; fitur bisnis penuh Client Portal tetap Section 08, RFQ/Procurement workflow tetap Section 17, modul Product Planning tetap Section 10) |
| 03 | Public Lead Intake | COMPLETED (2026-08-01) | — (`/lead-intake`, 4 kategori, consent, UTM preview, duplicate suggestion non-blocking, reuse `createLead`+`updateLeadQualification`) |
| 04 | Sales Leads dan Qualification | COMPLETED (2026-08-01) | — (Edit Lead, Reopen, merge suggestion via archive-dengan-referensi — D-061; true field-merge tetap evolusi lanjutan, bukan gap tersembunyi) |
| 05 | Account Executive Opportunity dan Quotation | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-05-ae-opportunity-quotation.md`) |
| 06 | Management Approval, Won dan Client Activation | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-06-management-approval-won.md`) |
| 07 | Customer Journey | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-07-customer-journey.md`) |
| 08 | Client Portal | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-08-client-portal.md`) |
| 09 | Project Order dan Handover | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-09-project-order-handover.md`) |
| 10 | Product Planning dan Costing | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-10-product-planning-costing.md`) |
| 11 | Traveler dan Travel Documents | COMPLETED (2026-07-31) | — (lihat `docs/mockup-section-reports/section-11-traveler-documents.md`) |
| 12 | Itinerary, Operations, Tasks dan Readiness | COMPLETED (2026-08-01) | — (lihat `docs/mockup-section-reports/section-12-itinerary-operations-readiness.md`) |
| 13 | Ticketing | COMPLETED (2026-08-01) | — (lihat `docs/mockup-section-reports/section-13-ticketing.md`) |
| 14 | Accommodation | COMPLETED (2026-08-01) | — (lihat `docs/mockup-section-reports/section-14-accommodation.md`) |
| 15 | Transportation | COMPLETED (2026-08-01) | — (lihat `docs/mockup-section-reports/section-15-transportation.md`) |
| 16 | MICE dan Event | COMPLETED (2026-08-01) | — (lihat `docs/mockup-section-reports/section-16-mice.md`) |
| 17 | Supplier dan Procurement | COMPLETED (2026-08-01) | — (lihat `docs/mockup-section-reports/section-17-supplier-procurement.md`) |
| 18 | Booking dan Service Orders | NOT_STARTED | Halaman konsolidasi Service Order lintas Section 13–16 |
| 19 | Changes, Cancellation, Refund dan Incident | PARTIAL | Cancellation/Refund/Incident record terstruktur terpisah dari `ActivityEntry` generik |
| 20 | Project Finance | PARTIAL | Refund/credit status mock |
| 21 | Documents, Communication dan Notifications | PARTIAL | Document center konsolidasi lintas modul, notification center in-app, komunikasi client/supplier terstruktur |
| 22 | Dashboards, Reports, Lead Recap dan Activity Center | PARTIAL | Widget Dashboard untuk role baru (Client/Product Planner/Procurement, role sudah ada sejak Section 02 tapi Dashboard `/` belum menyediakan widget spesifik agar tidak kosong — pola sama seperti AE/Supplier di Prompt 19), export mock |
| 23 | Administration, Master Data dan Audit | PARTIAL | Master data currencies/taxes/payment terms/cancellation rules/numbering/templates/readiness gates/assignment rules, historical snapshot warning |
| 24 | Full Regression dan Final Implementation Guide | NOT_STARTED | Menunggu Section 01–23 selesai (final section, sesuai desain) |

## Rekomendasi Urutan Eksekusi Berikutnya

Section 01–17 sudah COMPLETED — lihat laporan masing-masing di `docs/mockup-section-reports/`. Seluruh 4 sub-domain operasional lintas-project (Ticketing/Accommodation/Transportation/MICE, Section 13–16) kini punya modul dedicated, dan Procurement (Section 17 — RFQ formal/comparison/clarification/selection, Service Order/amendment/acknowledgment/fulfillment, Supplier Invoice submission preview, Procurement Performance Review) kini RESOLVED, mengikuti preseden arsitektur D-070/D-071/D-072/D-073 (D-074). Section 18 (Booking dan Service Orders — halaman konsolidasi tampilan Service Order lintas Section 13-16, BERBEDA dari `ServiceOrder` Procurement Section 17, lihat `docs/frontend-known-issues.md` bagian 13) direkomendasikan sebagai section berikutnya berbasis dependency. Sesuai protokol, keputusan section mana yang benar-benar dijalankan berikutnya tetap menunggu perintah eksplisit user.

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
- Management Approval Queue `/crm/quotations` (D-063) dan guard data-layer `approveOpportunityWon` (`approvalStatus === 'approved' && clientConfirmedAt`) — jangan dilonggarkan/dibypass tanpa alasan kuat; "Reject" tetap SATU status (`rejected`), jangan ditambah status paralel "returned-for-revision" tanpa mempertimbangkan D-063.
- Customer Journey Funnel `/customer-journey` (D-064) — snapshot per-tahap, bukan cohort historis; jangan "perbaiki" angka "Opportunity > Qualified" sebagai bug tanpa membaca D-064 dulu. AE portfolio scoping via toggle default-ON (`assignedToMeOnly`/`portfolioOnly` pattern) — jangan diganti hard filter tanpa override tanpa alasan kuat.
- Client Portal (`/client/*`, D-065) — sanitization field internal cost/margin (`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/`approvedBy`/`approvalNote`) WAJIB dipertahankan di 3 halaman ini; jangan tambahkan field tsb ke tampilan Client apa pun tanpa keputusan eksplisit baru. "Reject Quotation" oleh Client TETAP tidak boleh memutasi `Quotation.approvalStatus` (murni komunikasi via `PartyActivity`) — hanya Management/AE yang berwenang mengubah status komersial.
- `ProjectStatus` (8 nilai, D-028) TETAP LOCKED meski `ProjectOrderStatus` (10 nilai, D-066) sudah ada — jangan restrukturisasi `ProjectStatus` untuk "menyamakan" dengan 10 nilai; derivasi via `getProjectOrderStatus()` sudah menjembatani keduanya. Closure checklist (`ProjectClosureChecklist`, D-066) TETAP shell tanpa gating sampai Section 24 secara eksplisit menjadikannya prasyarat transisi Closed.
- `ProductTemplate`/`CostSheet` (D-067) — entitas TERPISAH dari `Quotation`, jangan digabung. `CostSheet` yang sudah `status: 'final'` (`appliedToQuotationId` terisi) TIDAK boleh diedit langsung (`updateCostSheet` menolak) — revisi wajib lewat `duplicateCostSheetVersion`. `getCostSheetBreakdown` TETAP derivasi (bukan field tersimpan) — jangan tambahkan field total/margin tersimpan yang bisa stale. Internal costing (`CostSheet`/`ProductTemplate`) TIDAK BOLEH diimpor di `app/pages/client/**` apa pun alasannya.
- Traveler document fields (D-068) — `isTravelerDocumentMissing` (`app/utils/attention.ts`) mengevaluasi visa HANYA bila `visaNumber` terisi (opsional, bukan wajib universal) — jangan ubah jadi wajib untuk seluruh traveler tanpa keputusan baru (akan mengubah status "lengkap" seluruh fixture existing yang belum diberi visa). Sensitive value masking (`maskDocumentNumber`, hanya PM/Super Admin melihat penuh) berlaku di TABEL DAN print preview (`manifest-preview.vue`) — jangan tambahkan jalur tampilan baru yang melewatkan masking untuk role non-PM.
- Departure readiness gate dan readiness matrix (D-069) — bersifat ADVISORY, TIDAK memblokir `updateProjectStatus`/`PROJECT_STATUS_TRANSITIONS` (D-066). Jangan menjadikannya hard gate tanpa keputusan baru eksplisit — akan mengunci demo dari mencoba transisi status pada data yang sengaja belum "siap". `ItineraryItem.visibleToClient` — default `true` bila kosong (JANGAN diasumsikan `false`); filtering client HANYA lewat `getClientVisibleItineraryItems`, jangan query `ITINERARY_ITEMS`/`getItineraryItems` langsung dari halaman Client Portal manapun.
- `FlightBooking`/modul `/ticketing` (D-070) — entitas TERPISAH dari `ProjectService` (`serviceId` opsional, bukan pengganti). Pola arsitektur "modul top-level baru MENDAMPINGI tab Project Detail existing" (bukan salah satu) — ikuti preseden ini untuk Section 14–16 (Accommodation/Transportation/MICE), jangan pindahkan konten tab existing ke top-level (tetap D-020 LOCKED untuk Operations/Traveler). `netCostIdr` pada `FlightBooking` TIDAK BOLEH tampil di `eticket-preview.vue` atau halaman client-facing manapun — hanya `sellPriceIdr`.
- `RFQ`/`ServiceOrder`/`SupplierInvoice`/modul `/procurement` (D-074) — entitas BARU mereuse `Vendor.id` (bukan Supplier paralel), TERPISAH dari `VendorQuotation` (Section 13 lama, TIDAK diubah/dihapus — dua jalur sourcing berbeda kebutuhan, tetap dipertahankan berdampingan). `ServiceOrder` yang `fulfilled`/`cancelled` bersifat terminal. `netCostIdr` pada `ServiceOrder` TIDAK BOLEH tampil di `/supplier/service-orders/[id]` atau halaman client-facing manapun — hanya `sellPriceIdr`. `SupplierInvoice` TETAP preview/mock murni — jangan tambahkan payment gateway/processing nyata apa pun. Jangan disamakan dengan "Service Order konsolidasi lintas jenis layanan" (Section 18, konsep berbeda meski nama mirip — lihat `docs/frontend-known-issues.md` bagian 13).
