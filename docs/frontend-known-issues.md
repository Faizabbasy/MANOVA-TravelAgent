# Frontend Known Issues — MANOVA (Roadmap Section 00–24)

Dibuat oleh **Section 00 — Current Progress Reconciliation** (2026-08-01). Berisi gap yang ditemukan saat mencocokkan kondisi codebase aktual (hasil Prompt 0–20, COMPLETED) terhadap roadmap Section 00–24 baru. Known issues historis Prompt 0–20 **tidak diulang di sini** — tetap di `docs/mockup-final-known-issues.md` dan `docs/mockup-implementation-state.md` bagian 6 (rujuk dokumen tsb untuk gap lama seperti Q8 tooling).

Status: `NEEDS_VALIDATION` (perlu keputusan/implementasi saat section pemilik dikerjakan), `DEFERRED` (sengaja ditunda, bukan blocker), `KNOWN_GAP` (dicatat, tidak dianggap bug — batas scope Prompt 0–20 yang belum mencakup requirement roadmap baru).

## 0. Section 01–04 — Sudah Diselesaikan (2026-08-01)

Gap foundation berikut ditemukan Section 00 dan sudah ditutup oleh Section 01 (`docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md`), dicatat di sini untuk jejak, bukan lagi open:
- **State reset / seed scenario** — sebelumnya tidak ada mekanisme reset. Sekarang tersedia `app/utils/mock-reset.ts` + `app/plugins/mock-reset.client.ts` + tombol "Reset Demo Data" (`/settings`).
- **Repository/service layer** — diklarifikasi (bukan gap): `app/data/index.ts` sudah memenuhi maksud fungsionalnya (single source, tidak ada fixture terduplikasi per halaman) sejak Foundation lama. Lihat D-058 (`docs/mockup-design-decisions.md`).
- **`ErrorState.vue`/`LoadingState.vue`** — dikonfirmasi tersedia dan reusable (bukan hilang), meski belum dipakai luas — tersedia untuk section berikutnya yang butuh simulasi loading/error eksplisit.

## 0b. BUG — App Gagal Mount di Browser Sejak Section 01 (`DataCloneError`) — RESOLVED (2026-07-31)

**Ini adalah bug nyata, bukan gap scope** — dilaporkan langsung oleh user sebagai "500 Internal Server Error — Failed to execute 'structuredClone' on 'Window': [object Array] could not be cloned."

- **Root cause:** `app/plugins/mock-reset.client.ts` memanggil `captureMockSnapshot()` pada SETIAP page load di browser, yang memanggil `structuredClone()` langsung terhadap array `reactive()` Vue (`OPPORTUNITIES`/`QUOTATIONS`/`PARTIES`/`PROJECTS`/`VENDORS`/`TRAVELERS`/`LEADS`/dst.). `structuredClone()` browser tidak dapat mengkloning `Proxy` (termasuk hasil `reactive()`) — selalu melempar `DataCloneError`, membuat SELURUH app gagal mount di browser manapun sejak Section 01 (2026-08-01) menambahkan plugin ini.
- **Mengapa lolos tidak terdeteksi sejak Section 01–05 (5 section berturut-turut):** Bug hanya terjadi di kode **client-only** (`.client.ts`), yang tidak pernah dieksekusi saat SSR. Seluruh smoke test sejak Section 01 memakai `curl` (HTML hasil SSR — selalu HTTP 200 karena SSR tidak pernah menjalankan plugin ini). Setiap laporan section sejak itu secara eksplisit mencatat "verifikasi interaktif tidak dilakukan headless (keterbatasan tooling)" — kali ini keterbatasan tsb terbukti benar-benar menyembunyikan bug fatal, bukan cuma risiko teoretis.
- **Fix:** `app/utils/mock-reset.ts` — `structuredClone` diganti helper `deepClone` (`JSON.parse(JSON.stringify(...))`), aman karena seluruh fixture adalah data JSON-safe murni. Direproduksi dan diverifikasi lewat skrip Node sebelum dan sesudah fix. Detail: `docs/mockup-change-impact-log.md` CI-035.
- **Status:** `RESOLVED`. **Rekomendasi kuat untuk section berikutnya:** jangan mengandalkan smoke test `curl` saja untuk memvalidasi kode `.client.ts` baru — kelas bug ini (fatal, client-only, tidak terlihat dari SSR) tidak akan terdeteksi oleh metode tsb.

## 1. Role dan Akses — RESOLVED Section 02 (2026-08-01)

- ~~Role `client`, `product-planner`, `procurement` belum ada~~ — **RESOLVED**, `RoleId` kini 16 nilai (D-059).
- ~~Matrix view permission belum dikonfirmasi~~ — **RESOLVED**, `/admin/roles` dikonfirmasi SUDAH berupa grid ModuleKey x Role literal (sejak Section 17 lama) — diperluas 6→8 kolom (CI-031).
- ~~Dashboard kosong untuk role baru~~ — **RESOLVED** (ditemukan+ditutup dalam Section 02 yang sama, CI-030) — 3 widget welcome baru untuk Client/Procurement/Product Planner.
- Sisa pekerjaan role baru tetap milik section pemiliknya: fitur bisnis penuh Client Portal (Section 08), RFQ/Service Order Procurement (Section 17) — role/akses/nav/shell sudah siap sebagai fondasi. Modul Product Planning/Costing (Section 10) sudah **RESOLVED** — lihat bagian 8.
- ~~Public Lead Intake belum ada~~ — **RESOLVED** Section 03 (`/lead-intake`). Duplicate suggestion di form publik bersifat non-blocking preview (mock, cek phone/email terhadap `LEADS`) — merge-duplicate PENUH tetap tanggung jawab Section 04.

## 2. Lead dan Qualification (Section 04) — RESOLVED (2026-08-01)

- ~~Reopen lead archived~~ — **RESOLVED**, `reopenLead` + tombol "Reopen" di drawer footer.
- ~~Merge-duplicate suggestion~~ — **RESOLVED** sebagai archive-dengan-referensi (D-061) — bukan true field-merge (dicatat sebagai simplifikasi eksplisit, evolusi lanjutan bila dibutuhkan).
- ~~Edit Lead (field kontak dasar)~~ — **RESOLVED**, sebelumnya hanya bisa diisi sekali saat create.

## 3. Opportunity dan Quotation (Section 05) — RESOLVED (2026-07-31)

- ~~Quotation duplicate/compare~~ — **RESOLVED**, `duplicateQuotationVersion` ("Duplicate Quotation", salinan persis sebagai versi baru) + panel "Bandingkan dengan versi sebelumnya" (toggle). Compare TERBATAS pada nilai total (`amountIdr` vs `supersededAmountIdr`) — tidak ada breakdown/discount/tax/markup per versi, karena model `Quotation` existing (Section 08) tidak menyimpan snapshot penuh per versi (D-062, disclaimer eksplisit tampil di UI, bukan gap tersembunyi).
- ~~Send mock ke client / withdraw submission~~ — **RESOLVED**, `sendQuotationToClient` ("Send to Client", timestamp mock) dan `withdrawQuotationSubmission` ("Withdraw Submission", revert `submitted`→`draft`, guard hanya dari status `submitted`).
- ~~PDF/print preview~~ — **RESOLVED**, halaman baru `/crm/opportunities/[id]/quotation-preview` (`layout: false`, print via `window.print()` browser — bukan generator PDF nyata, sesuai batasan protokol).
- ~~Line item tax/fee/markup terpisah~~ — **RESOLVED**, `Quotation.taxIdr`/`markupIdr`/`currency`/`validUntil`/`termsAndConditions`/`inclusions`/`exclusions` (field baru, aditif) tampil di "Edit Quotation" dan Quotation Preview.
- **Client Confirmation gate** — ditambahkan sesuai Wajib literal Section 05 ("AE belum dapat Mark as Won sebelum approved + client confirmation"): `recordClientConfirmation` + dialog AE-facing, Mark as Won kini men-disable sampai `Opportunity.clientConfirmedAt` terisi (selain `Quotation.approvalStatus === 'approved'` yang sudah ada). Queue/notifikasi Management-facing dan Client Portal-facing tetap milik Section 06/08 (Q14, belum RESOLVED).

## 4. Management Approval dan Client Activation (Section 06) — RESOLVED (2026-07-31)

- ~~Approval queue agregat belum ada~~ — **RESOLVED**, `/crm/quotations` ditulis ulang dari `ModulePlaceholder` menjadi Management Approval Queue (tab "Menunggu Approval", dialog review detail margin/discount/tax/markup/terms/complexity/risk, aksi Approve/Reject dengan catatan). Lihat Q14 (RESOLVED), D-063.
- ~~Client confirmation belum ada record/aksi eksplisit~~ — **RESOLVED sepenuhnya**: AE-facing (`recordClientConfirmation`, Section 05) + Management-facing visibility (tab "Menunggu Client Confirmation" di `/crm/quotations`, Section 06). Mark as Won digerbangi `quotation.approvalStatus === 'approved'` DAN `clientConfirmedAt` terisi — kini DIVALIDASI DI LEVEL DATA (`approveOpportunityWon`), bukan hanya UI (D-063). Rekaman client confirmation tetap dicatat AE (mock, bukan self-service dari Client Portal) — didokumentasikan sebagai batasan yang disengaja, bukan gap.
- **Approve/Reject/Return for Revision dengan notes/history** — **RESOLVED**: "Reject" berfungsi sekaligus sebagai "Return for Revision" (tidak ada status paralel baru, D-063); `submitQuotationForApproval`/`approveQuotation`/`rejectQuotation` kini mencatat `PartyActivity` per keputusan (histori), reuse tab "Activity / Follow-up" existing di Opportunity Detail.
- **Duplicate Client dan Project Order prevention** — dikonfirmasi SUDAH ada sejak Section 09/Prompt 20 (`if (opportunity.projectId) return getProjectById(...)` di `approveOpportunityWon`; dedup Party by name di `qualifyLeadAndCreateOpportunity`) — tidak perlu perubahan, hanya diverifikasi ulang Section 06.

## 5. Customer Journey (Section 07) — RESOLVED (2026-07-31)

- ~~Funnel drill-down dan conversion metrics~~ — **RESOLVED**, `/customer-journey` mendapat panel "Customer Journey Funnel" 7-tahap (Lead→Qualified→Opportunity→Approved→Won→Client→Project Order), tiap tahap menampilkan conversion % dari tahap sebelumnya dan dapat diklik (drill-down ke `/customer-journey/leads`, `/crm/opportunities`, `/crm/quotations`, `/customer-journey/customers`, `/customer-journey/project-orders` dengan filter query yang sesuai). D-064.
- ~~AE data scope belum konsisten~~ — **RESOLVED** (bug ditemukan+ditutup dalam section yang sama, CI-037): `scopedLeads`/Active Clients dashboard sebelumnya TIDAK ter-scope untuk AE sama sekali (padahal Opportunity/Project Order sudah). Diperbaiki + diperluas ke sub-list `/customer-journey/customers` dan `/customer-journey/project-orders` (toggle "Hanya Portfolio Saya", default ON untuk AE).
- ~~Filters by source/owner/stage/client/date/project type~~ — **RESOLVED**: Leads (source/owner/stage, sejak Prompt 19) + Customers (+owner, baru) + Project Orders (client/status/type/AE/PM sejak Prompt 19, +date/periode keberangkatan, baru) — seluruh 6 dimensi filter literal Wajib kini tersedia lintas modul Customer Journey.

## 6. Client Portal (Section 08) — RESOLVED (2026-07-31)

**Catatan:** Entri asli ("belum ada sama sekali — tidak ada route `/client/*`, tidak ada role `client`") sudah STALE sejak Section 02 (2026-08-01) membangun role/shell minimal — dokumen ini belum diperbarui saat itu (oversight, ditemukan dan dikoreksi di sini).

- ~~Client dashboard, company profile+contacts, travel request, quotation view+revision+accept/reject, Project Orders+itinerary+traveler+dokumen+finance+change request, support contact, action center~~ — **RESOLVED** (Section 08). `/client` (dashboard rewrite total dari shell Section 02), `/client/opportunities/[id]` (baru), `/client/project-orders/[id]` (baru, 6 tab).
- ~~Accept/reject confirmation self-service~~ — **RESOLVED** (CI-038) — sebelumnya dicatat sebagai batasan disengaja di Section 05 ("AE mencatat manual, bukan self-service"), kini Client dapat mengonfirmasi/menyatakan keberatan sendiri lewat `/client/opportunities/[id]` (reuse `recordClientConfirmation`, D-065).
- **Sanitization internal cost/margin/notes** — diverifikasi eksplisit lewat grep audit: TIDAK ADA `estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/`approvedBy`/`approvalNote` di ketiga file Client Portal. Lihat D-065.
- **Shared documents read-only** — Client TIDAK dapat upload dokumen sendiri (keputusan disengaja, D-065 — `DOCUMENTS` bukan `reactive()`, upload akan memerlukan migrasi tambahan di luar scope literal). Evolusi lanjutan bila dibutuhkan.
- **Verifikasi interaktif role Client tidak dilakukan headless** — role-switching adalah mekanisme client-only (`localStorage`), SSR/curl selalu merender sebagai default demo user (Super Admin, D-041) yang TIDAK punya `clientScopeId` — sehingga `/client/*` di bawah curl SELALU menampilkan `RoleAccessState` "tidak memiliki akses" (perilaku BENAR untuk Super Admin, tapi berarti konten Client-facing sesungguhnya tidak dapat diverifikasi lewat smoke test SSR seperti section lain). Dimitigasi lewat code review ketat + grep audit field terlarang + cross-check fixture manual (`PTY-001`/`USR-019` dan `PTY-002`/`USR-020`), TIDAK lewat smoke test konten SSR biasa.

## 7. Project Order dan Handover (Section 09) — RESOLVED (2026-07-31)

- ~~Taksonomi status baru belum diimplementasikan~~ — **RESOLVED**, lihat Q16 (RESOLVED) dan D-066. `ProjectOrderStatus` (10 nilai) dirivasi dari `ProjectStatus` (LOCKED, tidak diubah) + field handover/ready/closure baru.
- ~~AE-to-PM handover accept/return belum ada~~ — **RESOLVED**, `acceptProjectHandover`/`returnProjectHandover` (baru, `app/data/index.ts`) + UI di tab Overview `/projects/[id]`. PM default (`DEFAULT_PROJECT_OWNER_ID`) tetap dipakai untuk penugasan awal (Section 09 tidak mengubah mekanisme assignment PM, hanya menambah langkah accept/return SETELAH assignment) — `PRJ-104` (satu-satunya project `draft`) sengaja dibiarkan Handover Pending untuk demo hidup.
- **Ditemukan sekaligus ditutup dalam section yang sama:** `project.status` sebelumnya TIDAK PERNAH punya mutator (hanya diset sekali saat `approveOpportunityWon`) — kini dapat bertransisi via `updateProjectStatus` dengan guard peta transisi + reason wajib untuk On Hold/Cancelled. Team assignment (`teamUserIds`) sebelumnya tanpa mutator sama sekali — kini `addProjectTeamMember`/`removeProjectTeamMember`. Tasks tab sebelumnya read-only murni (tidak ada create/edit meski `dueAt` sudah ada di type sejak Foundation) — kini `createProjectTask`/`updateProjectTask` + milestone/dependency/assignee. Risk tracking (`ProjectRisk`, entitas baru) dan Closure Checklist (shell) ditambahkan. Link "Project ini berasal dari opportunity" sebelumnya mengarah ke list, bukan detail spesifik — diperbaiki (CI-039).

## 8. Product Planning dan Costing (Section 10) — RESOLVED (2026-07-31)

- ~~Belum ada sama sekali~~ — **RESOLVED**. `ProductTemplate`/`CostSheet` (entitas baru, `app/types/product.ts`), modul `product-planning` (`ModuleKey`), route `/product-planning` (katalog) dan `/product-planning/cost-sheets` (traveler-based costing, markup/tax/contingency, scenario/version comparison via multi-Cost-Sheet per Opportunity). Snapshot ke Quotation lewat `applyCostSheetToQuotation` (mengunci Cost Sheet setelahnya). Detail lengkap `docs/mockup-section-reports/section-10-product-planning-costing.md`.

## 9. Traveler dan Travel Documents (Section 11) — RESOLVED (2026-07-31)

- ~~Dokumen selain paspor belum di-track~~ — **RESOLVED sebagian**. `Traveler` kini punya `idNumber`/`visaNumber`/`visaExpiryDate` (Wajib literal Section 11 hanya menyebut "Passport/ID/visa metadata") — visa ikut dievaluasi `isTravelerDocumentMissing` bila diisi. **Tiket dan asuransi TETAP belum ada field/UI** — di luar Wajib literal Section 11 (tidak disebutkan), dicatat eksplisit sebagai `KNOWN_GAP` yang tersisa, bukan regresi/terlewat.
- Detail lengkap fitur baru: `docs/mockup-section-reports/section-11-traveler-documents.md`.

## 10. Itinerary, Operations, Tasks dan Readiness (Section 12) — RESOLVED (2026-08-01)

- ~~Readiness checklist/matrix terpisah belum ada~~ — **RESOLVED**. `getServiceReadinessMatrix`/`getDepartureReadiness` (baru, `app/data/index.ts`) — agregat kesiapan layanan per tipe + gate keberangkatan (dokumen traveler/layanan confirmed/task blocked/risk open/invoice outstanding), ditampilkan sebagai SectionCard "Departure Readiness Gate" dan "Service Readiness Matrix" di tab Itinerary & Services. Bersifat ADVISORY (tidak memblokir transisi status project, pola sama Closure Checklist D-066). Detail lengkap: `docs/mockup-section-reports/section-12-itinerary-operations-readiness.md`.
- Ticket/insurance document tracking (Traveler, Section 11) TETAP di luar scope literal manapun — tetap `KNOWN_GAP` terpisah (lihat bagian 9).
- **Departure countdown/alert eksplisit** — `isUpcomingDeparture` (util existing) dipakai untuk Attention widget, belum tentu tampil sebagai "countdown" UI khusus. Status: `NEEDS_VALIDATION`.

## 11. Ticketing / Accommodation / Transportation / MICE (Section 13–16) — SELURUHNYA RESOLVED (2026-08-01)

- ~~Belum ada halaman dedicated per domain~~ — **Ticketing (Section 13) RESOLVED.** `/ticketing` (list) + `/ticketing/[id]` (detail lifecycle) + `/ticketing/[id]/eticket-preview` (dokumen) — modul top-level baru dengan `ModuleKey` sendiri, MENDAMPINGI (bukan menggantikan) ringkasan sub-flight di tab "Itinerary & Services" Project Detail. Ini secara eksplisit MENINJAU ULANG ketegangan dengan D-020 yang dicatat di sini sebelumnya — resolusinya BUKAN memindahkan konten tab ke top-level, melainkan menambahkan modul top-level BARU khusus lifecycle detail (options/PNR/segments/deadline/state machine/fare rules/financial) yang literal Wajib Section 13 minta, sementara tab existing (D-020, LOCKED) tetap sebagai ringkasan cepat dalam konteks satu project. Lihat D-070 (`docs/mockup-design-decisions.md`). Detail lengkap: `docs/mockup-section-reports/section-13-ticketing.md`.
- ~~Belum ada halaman dedicated per domain~~ — **Accommodation (Section 14) RESOLVED.** `/accommodation` (list) + `/accommodation/[id]` (detail lifecycle) + `/accommodation/[id]/voucher-preview` (dokumen) — modul top-level baru pola arsitektur IDENTIK Ticketing (D-070/D-071), MENDAMPINGI ringkasan sub-hotel tab "Itinerary & Services". Room block/occupancy/rooming list dan traveler special request DIREUSE dari `TravelerGroup`/`RoomAssignment`/`Traveler` (Section 11) lewat `groupId`/`travelerIds` — bukan dataset paralel. Lihat D-071 (`docs/mockup-design-decisions.md`). Detail lengkap: `docs/mockup-section-reports/section-14-accommodation.md`.
- ~~Belum ada halaman dedicated per domain~~ — **Transportation (Section 15) RESOLVED.** `/transportation` (list) + `/transportation/[id]` (detail lifecycle) + `/transportation/[id]/service-order-preview` (dokumen client-facing) + `/transportation/[id]/driver-sheet-preview` (dokumen internal driver, tanpa informasi harga sama sekali) — modul top-level baru pola arsitektur IDENTIK Ticketing/Accommodation (D-070/D-071/D-072), MENDAMPINGI ringkasan sub-transportation tab "Itinerary & Services". Manifest/group allocation DIREUSE dari `TravelerGroup`/`Traveler` (Section 11); supplier DIREUSE dari `Vendor`/`ProjectService.vendorId` (Section 13 lama) — bukan dataset paralel. Lihat D-072 (`docs/mockup-design-decisions.md`). Detail lengkap: `docs/mockup-section-reports/section-15-transportation.md`.
- ~~Belum ada halaman dedicated per domain~~ — **MICE (Section 16) RESOLVED.** `/mice` (list) + `/mice/[id]` (detail: brief/venue/sessions/participant categories/BOQ/staffing/checklist/deliverables) + `/mice/[id]/rundown-preview` (dokumen client-facing agenda) + `/mice/[id]/boq-preview` (dokumen client-facing budget, sanitized) — modul top-level baru pola arsitektur IDENTIK Ticketing/Accommodation/Transportation (D-070/D-071/D-072), MENDAMPINGI ringkasan sub-mice tab "Itinerary & Services". Staffing/PIC DIREUSE dari `User` (Section 02); vendor package DIREUSE dari `Vendor` (Section 13 lama) — bukan dataset paralel. "Client approval states" TERPISAH dari status event (pola sama Commercial Approval, D-049). "Capacity and schedule conflicts" — derivasi ADVISORY, mendemokan kondisi nyata (venue Hari 2 kapasitas < peserta) yang menautkan ke `RSK-1031`/`TSK-1032` existing. Lihat D-073 (`docs/mockup-design-decisions.md`). Detail lengkap: `docs/mockup-section-reports/section-16-mice.md`.
- **Seluruh 4 sub-domain operasional (Ticketing/Accommodation/Transportation/MICE, Section 13–16) kini RESOLVED** — preseden arsitektur D-070/D-071/D-072/D-073 (modul top-level baru mendampingi tab existing, reuse data Section 11/13, sanitasi cost internal konsisten) dapat dijadikan acuan untuk kebutuhan serupa di section berikutnya (mis. Section 17 Supplier/Procurement RFQ formal, bila membutuhkan pola serupa).

## 12. Supplier dan Procurement (Section 17) — RESOLVED (2026-08-01)

- ~~Role Procurement belum ada~~ — **RESOLVED Section 02** (Q13), diperkuat Section 17 (`ROLE_MODULE_ACCESS.procurement.procurement = 'MANAGE'`).
- ~~RFQ formal/comparison/clarification/selection~~ — **RESOLVED**. Modul top-level baru `/procurement` (D-074): `RFQ`/`RFQInvitation`/`RFQResponse`/`RFQClarificationMessage` (`app/types/procurement.ts`), lifecycle 7-status (`draft`→`sent`→`responses-in`→`comparison`⇄`clarification`→`selected`→`closed`), side-by-side comparison table, clarification thread per vendor (dua arah), formal "Select" action (`selectRfqVendor`). `submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation` (Section 13 lama) TIDAK diubah — tetap jalur terpisah untuk assignment cepat satu-vendor-satu-service.
- ~~Service Order/amendment/acknowledgment/fulfillment~~ — **RESOLVED**. `ServiceOrder`/`ServiceOrderAmendment` (baru), lifecycle 6-status (`draft`→`sent`→`acknowledged`⇄`amended`→`fulfilled`/`cancelled`), handoff RFQ→Service Order via tombol "Buat Service Order" di RFQ detail (status `selected`), acknowledgment dan fulfillment status update self-service dari `/supplier/service-orders/[id]`.
- ~~Supplier invoice submission preview~~ — **RESOLVED**, menutup Q12 (`docs/mockup-open-questions.md`, RESOLVED Section 17). `SupplierInvoice` — preview/mock murni, TIDAK ADA payment gateway/processing nyata (larangan protokol), hanya dapat diajukan terhadap Service Order `fulfilled` milik vendor yang sama.
- **Baru (aditif Section 17)**: `Vendor` (Section 13 lama) diperluas `category`/`status`/`documents` (`VendorDocument`, tab "Documents" baru Vendor Detail) — TIDAK mengganti `/vendors` existing. Procurement Performance Review (`/procurement/performance`) — win rate, rata-rata waktu respons, on-time fulfillment, quotation history, seluruhnya DERIVASI dari data RFQ/Service Order existing (`getVendorProcurementPerformance`), bukan field tersimpan.
- **Known gap yang tetap ada (dicatat, bukan tersembunyi)**: "On-time %" Performance Review disederhanakan sebagai rasio Service Order `fulfilled` terhadap total (tidak ada field due-date terpisah untuk dibandingkan — D-074). Client approval/self-service pada RFQ/Service Order TIDAK ada (di luar scope literal, keputusan sama seperti MICE `MiceApprovalStatus` D-073 — approval yang ada adalah "client selected vendor" secara internal, bukan Client Portal). Verifikasi interaktif (klik Select/Acknowledge/submit invoice) tidak dilakukan headless, dimitigasi code review ketat + smoke test SSR konten (konsisten sejak Section 06).

## 13. Booking dan Service Orders (Section 18)

- **Belum ada halaman konsolidasi** — booking flight/hotel/transport/MICE hanya terlihat sebagai baris `ProjectService` di tab "Itinerary & Services", belum ada tampilan Service Order konsolidasi lintas jenis layanan. Status: `NOT_STARTED`.
- **Catatan disambiguasi (Section 17)**: `ServiceOrder` (`app/types/procurement.ts`, Section 17) adalah dokumen formal Procurement→vendor (dari RFQ atau engagement langsung), BUKAN "Service Order konsolidasi lintas jenis layanan" yang dimaksud gap ini (yang merujuk pada tampilan gabungan `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` per project). Kedua konsep bernama mirip tapi BERBEDA — Section 18, bila dikerjakan, harus eksplisit menyatakan yang mana yang dimaksud atau mempertimbangkan penamaan yang membedakan keduanya.

## 14. Changes, Cancellation, Refund dan Incident (Section 19)

- **Cancellation/Refund/Incident record terstruktur belum ada** — tab "Activity & Changes" existing (`ActivityEntry` + `ChangeCategory`/`ChangeApprovalStatus`) menangani "Change" generik, belum ada kategori/field khusus Cancellation (penalty), Refund (partial/full/credit status), atau Incident (severity/escalation). Status: `KNOWN_GAP`.

## 15. Project Finance (Section 20)

- **Refund/credit status mock belum ada** — Invoice/Payment/Budget vs Actual sudah ada (Section 15 lama), refund tracking belum. Status: `KNOWN_GAP`.

## 16. Documents, Communication dan Notifications (Section 21)

- **Document center konsolidasi lintas modul belum ada** — dokumen saat ini tersebar per tab ("Documents" Project Detail, "Documents" Customer Detail via `getDocumentsByParty`), belum ada satu halaman terpusat.
- **Notification center in-app belum ada** — tidak ada halaman/dropdown notifikasi terpusat.
- **Komunikasi client/supplier terstruktur belum ada** — `PartyActivity`/`LeadActivity`/`VendorActivity` mencatat activity internal, belum ada "communication log" client-facing yang eksplisit terpisah dari catatan internal.

## 17. Dashboards, Reports, Lead Recap dan Activity Center (Section 22)

- **Export mock (CSV/PDF placeholder)** — belum ada di Reports (dicatat sejak Section 16 lama, tetap belum dikerjakan).
- **Widget role baru** — begitu role Client/Product Planner/Procurement ditambahkan, Dashboard perlu widget baru agar tidak kosong (pola sama seperti Prompt 19 menambah widget AE/Supplier).

## 18. Administration, Master Data dan Audit (Section 23)

- **Master data terbatas** — `app/constants/master-data.ts` (Section 17 lama) mencakup `MASTER_PROJECT_TYPES`/`MASTER_SERVICE_TYPES`/`MASTER_DESTINATIONS`/`MASTER_VENDOR_CATEGORIES`; belum ada currencies, taxes, payment terms, cancellation rules, numbering scheme, template, readiness gates, atau assignment rules sebagai master data terkelola.
- **Historical snapshot warning** — belum ada peringatan saat master data yang sudah dipakai record lama diubah.

## 19. Tooling (Warisan Prompt 0–20, Tidak Berubah)

- **Q8 — Lint/typecheck/test** tetap `NEEDS_VALIDATION` sejak Section 06 lama (`eslint` inti dan `vue-tsc` belum terpasang). Tidak diselesaikan Section 00 (di luar scope audit-only; instalasi package baru tetap tunduk kebijakan D-036).
