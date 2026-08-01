# Frontend End-to-End Implementation Guide — MANOVA

Dibuat oleh **Section 24 — Full Regression dan Final Implementation Guide** (2026-08-01), deliverable literal yang diminta `prompts/SECTION_24_Full_Regression_Final_Implementation_Guide.md`: "menjelaskan langkah implementasi frontend dari kondisi awal sampai selesai, urutan dependency, file penting, state architecture, per-role modules, testing, review, dan maintenance." Dokumen ini adalah **narasi sintesis** — ia tidak menggantikan `docs/frontend-implementation-roadmap.md` (status per section), `docs/frontend-module-map.md` (route/module mapping), `docs/frontend-workflow-map.md` (status per langkah workflow), atau `docs/frontend-known-issues.md` (gap detail); ia merujuk keempatnya dan menjelaskan **mengapa** urutan dan arsitektur ini dipilih.

Frontend-only mockup — tidak ada backend/API produksi/database/payment gateway/integrasi vendor nyata di lapisan mana pun yang dijelaskan di bawah (D-005/D-006, LOCKED).

---

## 1. Implementation Journey — Narasi Kronologis

Proyek ini dikerjakan dalam **dua fase berurutan**, dicatat lengkap dengan skema penomoran ganda di `docs/mockup-implementation-state.md` bagian 0:

### Fase 1 — Prompt 0–20 (Foundation Lama, COMPLETED sebelum roadmap Section 00–24 dimulai)

Dimulai dari audit template Nuxt 4 kosong (starter dashboard generik, tanpa domain travel-agency apa pun) — Section 00–04 (Prompt 0–4) murni riset dan dokumentasi: konteks bisnis, audit codebase existing, gap analysis/reuse mapping, information architecture, dan finalisasi seluruh dokumen `docs/mockup-*.md` sebagai source of truth **sebelum** satu baris kode domain ditulis. Section 05 (Prompt 5, "Foundation") adalah coding pertama: rebrand ke MANOVA, `NAV_ITEMS` satu source of truth, type/constant/data foundation, 11 shared UI component. Section 06–18 lama membangun Dashboard, CRM Party, Opportunity/Quotation, Opportunity-Won-to-Project, Project Core, Traveler, Itinerary/Operations, Vendor Management, Project Changes, Project Finance, Reports, Administration — lalu Section 18 lama ("Regression and Demo Readiness") menutup fase ini dengan regresi penuh dan 3 dokumen final (`mockup-demo-script.md`, `mockup-final-known-issues.md`, `mockup-final-route-inventory.md`). Dua Change Request (Prompt 19 — Customer Journey/AE/Supplier/Commercial Approval; Prompt 20 — Sales Qualification to AE Opportunity Flow) memperluas model role dan alur Lead→Opportunity secara aditif di atas fondasi ini.

### Fase 2 — Section 00–24 (Roadmap Baru, "FRONTEND-ONLY CONTINUATION")

`prompts/01-PROTOKOL-WAJIB.md` versi terbaru memperkenalkan roadmap 25-tahap yang jauh lebih rinci per-domain-operasional (Ticketing/Accommodation/Transportation/MICE terpisah, Procurement formal, Booking Orchestration, Changes/Incident terstruktur, Finance closure gate, Documents/Notifications, Dashboards/Reports gap-fill, Administration/Master Data, dan akhirnya regresi penuh ini). Section 00 mengaudit kondisi Fase 1 terhadap roadmap baru dan menemukan sebagian besar fondasi (role, CRM, Project, Vendor, Finance dasar) sudah ada — sehingga Section 01–09 sebagian besar adalah **gap-fill** (menambah field/mutator/UI aditif di atas fondasi Fase 1, bukan membangun ulang), sementara Section 10 dan Section 13–23 sebagian besar **genuinely baru** (Product Planning/Costing, 4 modul operasional dedicated, Procurement formal, Booking Orchestration, Changes/Incident terstruktur, Finance closure, Documents/Notifications, Administration/Master Data — tidak ada implementasi sebelumnya sama sekali).

**Pola arsitektur inti yang berulang identik Section 13–23 (D-070 → D-080):** setiap domain baru menambahkan **entitas baru, ditautkan lewat ID ke entitas existing, tanpa pernah memutasi shape entitas yang sudah ada**. Contoh konkret:
- `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16) — entitas baru, `serviceId` OPSIONAL menaut ke `ProjectService` existing, TIDAK menggantikannya (D-070/D-071/D-072/D-073).
- `RFQ`/`ServiceOrder`/`SupplierInvoice` (Section 17, D-074) — mereuse `Vendor.id`, TIDAK membuat entitas Supplier paralel.
- `BookingOrchestrationRecord`/`BookingTimelineEntry` (Section 18, D-075) — layer konsolidasi murni derivasi/tautan di ATAS 4 entitas booking Section 13-16, TIDAK menambah field ke satu pun dari keempatnya.
- `ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` (Section 19, D-076) — fully additive, WAJIB menautkan `ActivityEntry` existing (Section 14 lama) sebagai satu-satunya audit trail, bukan log kedua.
- `CreditNote`/`DebitNote` (Section 20, D-077) — entitas baru, hook prospektif SATU baris ke `updateRefundRequestStatus` (Section 19, LOCKED) tanpa mengubah guard-nya.
- `Document`/`Message`/`Notification` (Section 21, D-078) — union view di atas `ProjectDocument`/`VendorDocument` existing, bukan pengganti.
- `evaluateProjectClosureGate`/`closeProject` (Section 24 sendiri) — mengisi 3 field derivasi baru pada `ProjectClosureChecklist` (shell sejak Section 09/D-066), pola identik `evaluateFinanceClosureGate`/`closeProjectFinance` (Section 20, D-077).

Pola ini disebut eksplisit di seluruh D-070→D-080 sebagai **"entitas baru, ID-linked, jangan pernah mutasi apa yang direferensikan"** — dan merupakan alasan mengapa 11 section berturut-turut (13-23) dapat dikerjakan tanpa regresi lintas-section yang merusak: setiap section baru menambah lapisan, tidak pernah mengganti lapisan di bawahnya.

---

## 2. Dependency Order — Urutan Build dan Alasannya

Urutan eksekusi literal (`docs/frontend-implementation-roadmap.md`) TIDAK selalu identik dengan urutan logis Workflow Utama (`prompts/01-PROTOKOL-WAJIB.md`) — perbedaan ini didokumentasikan eksplisit di `docs/frontend-workflow-map.md` bagian "Catatan Dependency Order" dan bukan kekeliruan:

- **Section 10 (Product Planning & Costing) dikerjakan SETELAH Section 09 (Project Order)**, padahal langkah Workflow Utama "Product Planning & Costing" (#6) logically terjadi SEBELUM Quotation (#7). Ini bukan blocking hard-dependency — Section 05 sudah membangun costing sederhana di dalam Quotation itu sendiri; Section 10 adalah penyempurnaan retroaktif (entitas `ProductTemplate`/`CostSheet` terpisah dengan versi/skenario) yang bisa disisipkan di titik mana pun tanpa merusak alur Lead→Won yang sudah berjalan.
- **Ticketing/Accommodation/Transportation/MICE (Section 13-16) WAJIB ada sebelum Booking Orchestration (Section 18)** — `BookingOrchestrationRecord` murni menautkan (`bookingType`+`bookingId`) ke 4 entitas booking tsb; tanpa keempatnya sudah eksis, tidak ada apa pun untuk dikonsolidasikan.
- **Procurement (Section 17) WAJIB ada sebelum Finance dapat menutup loop Refund→Credit Note (Section 20)** — `SupplierInvoice` (Section 17) adalah sisi AP yang direkonsiliasi Section 20; dan Section 19 (Changes/Refund) WAJIB ada sebelum Section 20 karena `RefundRequest.creditStatus` (Section 19) adalah forward-dependency yang baru "ditutup nyata" oleh `issueCreditNote` (Section 20, D-077) — didokumentasikan eksplisit di kedua section sebagai forward/backward dependency yang disengaja, bukan pekerjaan yang lupa dikerjakan lebih awal.
- **Traveler/Travel Documents (Section 11) WAJIB ada sebelum Accommodation (Section 14)** — room block/rooming list Accommodation mereuse `TravelerGroup`/`RoomAssignment`/`Traveler` Section 11 by ID, bukan dataset paralel (D-071).
- **Section 09 (Project Order, `ProjectClosureChecklist` shell) WAJIB ada sebelum Section 20 (finance gate) dan Section 24 (project closure gate)** — keduanya mengisi field derivasi baru pada checklist yang sudah dibuat shell-nya sejak Section 09, bukan membuat entitas checklist baru.
- **Section 24 (regresi final) WAJIB berjalan setelah seluruh Section 01-23** — literal desain: hanya section terakhir yang dapat memverifikasi rantai penuh Lead→Closed dan menutup mekanisme Project Closed yang bergantung pada SELURUH gate section-section sebelumnya (finance settled, service/booking terminal, tidak ada incident/change request terbuka).

---

## 3. Key Files — Arsitektur Terpusat

Mengikuti `CLAUDE.md` (struktur Nuxt 4 baku) dengan satu penambahan arsitektur signifikan: **lapisan data terpusat**.

| Lapisan | Lokasi | Peran |
|---|---|---|
| Types | `app/types/*.ts` — satu file per domain (`user.ts`, `party.ts`, `lead.ts`, `opportunity.ts`, `project.ts`, `vendor.ts`, `procurement.ts`, `booking-orchestration.ts`, `change-incident.ts`, `finance.ts`, `activity.ts`, `document-comms.ts`, `product.ts`, `reporting.ts`, `common.ts`) | Definisi TypeScript murni, tidak ada logic. |
| Constants | `app/constants/{roles,navigation,status}.ts` | `ROLES`/`ROLE_MODULE_ACCESS`/`FULL_FINANCIAL_VISIBILITY_ROLES` (roles.ts), `NAV_ITEMS` (navigation.ts, satu source of truth sidebar), seluruh status-option/label/warna terpusat (status.ts) — mencegah drift taksonomi status (D-010/D-038). |
| Fixtures + selector/mutator | `app/data/*.ts` + barrel `app/data/index.ts` | Satu source of truth data (D-013/D-058) — seluruh array fixture adalah `reactive()` Vue, dimutasi HANYA lewat fungsi bernama di `index.ts` (`create*`/`update*`/`approve*`/`evaluate*Gate`/`get*` selector). Halaman TIDAK PERNAH memutasi array fixture langsung. |
| Reusable components | `app/components/shared/*.vue` (domain-agnostic: `SectionCard`, `PageHeader`, `StatusBadge`, `DetailMetadataList`, `RoleAccessState`, `EmptyState`, `StatusBreakdownList`, `ToastContainer`) + `app/components/ui/*` (shadcn-nuxt primitive: `Table*`, `Dialog*`, `Tabs*`, `Sheet*`, dst.) | Dipakai ulang lintas SELURUH 24 section — tidak ada komponen paralel per-domain untuk kebutuhan generik yang sama. |
| Pages | `app/pages/**` (file-based routing) | 82 file page, 89 route (termasuk dynamic `[id]`/print-preview). Setiap modul top-level baru (Ticketing/Accommodation/Transportation/MICE/Procurement/Bookings/Changes/Documents/Product Planning) MENDAMPINGI tab Project Detail existing, bukan menggantikannya (D-070 preseden). |
| Utils/composables | `app/utils/{format,attention,mock-reset}.ts`, `app/composables/{useCurrentUser,usePermissions,useToast}.ts` | Formatter Rupiah/tanggal, attention-condition helper, role/permission check (`usePermissions().can*`/`clientScopeId`/`vendorScopeId`), mock state reset/seed. |

---

## 4. State Architecture

- **Tidak ada backend, tidak ada database.** Seluruh "data tersimpan" adalah array `reactive()` Vue di `app/data/*.ts`, hidup selama sesi browser. Reload halaman = state kembali ke seed asli (kecuali di-reset manual via tombol "Reset Demo Data" di `/settings`, yang justru MENGEMBALIKAN ke seed — lihat `app/utils/mock-reset.ts`/`app/plugins/mock-reset.client.ts`, D-058).
- **`localStorage`/`sessionStorage` dipakai HANYA untuk dua hal yang secara eksplisit diberi label mock-persistence**: (1) role switcher demo (memilih role aktif untuk simulasi akses — bukan otentikasi nyata), (2) snapshot seed untuk mekanisme reset di atas. Saved Views (Section 22, D-079) SENGAJA memakai centralized reactive state (`app/data/reporting.ts`), BUKAN `localStorage`, agar konsisten dengan pola data terpusat — satu pengecualian yang dicatat eksplisit sebagai keputusan desain, bukan inkonsistensi.
- **Mutator generik dengan side-effect eksplisit** — setiap aksi bisnis (approve, reject, mark-as-won, close-finance, close-project, dst.) adalah SATU fungsi bernama di `app/data/index.ts` yang: (a) memvalidasi guard/precondition, (b) memutasi field terkait, (c) mencatat `ActivityEntry`/`SystemEvent` (audit trail), (d) mengembalikan hasil untuk UI. Tidak ada mutasi field langsung dari `.vue` manapun.
- **Sanitization cost/margin internal** — pola konsisten sejak Section 13 (D-070): `netCostIdr`/`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/`approvedBy`/`approvalNote` TIDAK PERNAH dirender di halaman `app/pages/client/**` atau dokumen print-preview client-facing manapun (e-ticket, voucher, service order, rundown, BOQ) — diverifikasi via grep audit eksplisit setiap section yang menyentuh area ini (D-065).
- **Mandatory-reason-on-destructive-transition** — setiap transisi status yang merugikan/tidak dapat dibatalkan (Project On Hold/Cancelled, Void Invoice, Reject Quotation, Suspend User, Cancel Booking) mewajibkan field alasan (`reason`/`suspendedReason`/`voidReason`, dst.) sebelum mutator dieksekusi.
- **Dual audit-trail pattern (D-076)** — `ActivityEntry` (level-project, sejak Section 05/14 lama) tetap SATU-SATUNYA audit trail operasional-komersial per project; `SystemEvent` (sejak Prompt 19, level-sistem non-project) adalah trail administratif terpisah (login, master-data change, dst.). `ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` (Section 19) WAJIB menautkan satu `ActivityEntry` lewat `createChangeEntry` — bukan membuat log ketiga.
- **Derivasi vs field tersimpan** — status/metric yang bisa dihitung ulang dari data lain SELALU derivasi murni (`getProjectOrderStatus()`, `getInvoiceOutstandingIdr()`, `getCostSheetBreakdown()`, `evaluateFinanceClosureGate()`, `evaluateProjectClosureGate()`, `getBookingTimeline()`) — TIDAK ADA field tersimpan yang bisa stale untuk nilai-nilai ini.

---

## 5. Per-Role Modules

16 role (`app/types/user.ts` `RoleId`, D-003/D-059), akses granular per `ModuleKey` via `ROLE_MODULE_ACCESS` (`app/constants/roles.ts`) — `NONE`/`VIEW`/`MANAGE`/`APPROVE`/`ADMIN`. Ringkasan modul dengan hak `MANAGE`/`APPROVE`/`ADMIN` per role (VIEW-only tidak dicantumkan kecuali relevan):

| Role | Modul MANAGE/APPROVE/ADMIN Utama | Ringkasan Aksi Inti |
|---|---|---|
| Super Admin | Seluruh `ModuleKey` (`ADMIN`) | Oversight penuh lintas modul, termasuk `client-portal`/`supplier-portal` (tanpa bocor scope data company manapun — `clientScopeId`/`vendorScopeId` tetap kosong untuknya). |
| Management | `crm`/`project` (`APPROVE`), `documents` (`MANAGE`) | Commercial Approval (Quotation), approve Project status, approve Change Request (via `canApprove('project')`), Close Finance/Close Project (bersama PM/Super Admin). |
| Sales | `crm` (`MANAGE`, scoped ke Lead) | Create/Edit/Qualify/Reopen Lead, assign ke Account Executive. TIDAK lagi mengelola Opportunity/Quotation (dipindah ke AE). |
| Account Executive | `crm` (`MANAGE`) | Opportunity/Quotation lifecycle penuh (create/edit/submit approval/Mark as Won), Requirement Detail, Client Confirmation (AE-facing). |
| Product Planner / Travel Consultant | `product-planning` (`MANAGE`) | Product Template catalog, Cost Sheet (traveler-based costing, scenario/version, snapshot ke Quotation). |
| Project Manager | `project` (`MANAGE`), `changes`/`documents` (`MANAGE`) | Accept/Return Handover, transisi status project, Team/Risk management, Task/Milestone, Close Project. |
| Operations | `project` (`MANAGE`), `bookings`/`changes`/`documents` (`MANAGE`) | Booking Timeline/Exception Queue ("satu sumber kebenaran seluruh service"), Change/Cancellation/Refund/Incident lifecycle, Readiness Gate. |
| Ticketing | `ticketing` (`MANAGE`) | `FlightBooking` lifecycle penuh (Hold/Confirm/Issue/Reissue/Cancel/Refund). |
| Accommodation | `accommodation` (`MANAGE`) | `HotelBooking` lifecycle penuh (Quote/Confirm/Amend/Cancel/No-Show). |
| Transportation | `transportation` (`MANAGE`) | `TransportBooking` lifecycle penuh (Quote/Assign/Confirm/Cancel/No-Show). |
| MICE | `mice` (`MANAGE`) | `MiceEvent` lifecycle penuh (Planning/Confirmed/In-Progress/Completed/Cancelled, BOQ, staffing). |
| Procurement / Vendor Management | `vendor`/`procurement` (`MANAGE`) | Direktori Vendor, RFQ formal (invite/compare/clarify/select), Service Order (amend/acknowledge/fulfill), Procurement Performance Review. |
| Finance | `finance` (`MANAGE`) | Create Invoice/Record Payment/Void Invoice/Credit-Debit Note, AP reconciliation, Financial Closure Gate. |
| Viewer / Auditor | VIEW hampir seluruh modul internal | Read-only lintas sistem, tidak ada aksi mutasi. |
| Client (External) | `client-portal` (`MANAGE`, isolasi `clientPartyId`) | Lihat Quotation tersanitasi, Accept/Reject/Request Revision self-service, submit Traveler, lihat Itinerary/Dokumen/Finance/Change Request milik company sendiri SAJA. |
| Supplier (External) | `supplier-portal` (`MANAGE`, isolasi `vendorId`) | Respon RFQ, acknowledge/fulfill Service Order, submit Supplier Invoice preview, lihat order milik company sendiri SAJA. |

Detail lengkap 16×17 grid tersedia interaktif di `/admin/roles` (Matrix View, LOCKED sejak Section 02/old-Section 17) dan lengkap di `app/constants/roles.ts`.

---

## 6. Testing — Bagaimana Proyek Ini Diverifikasi

**Metode konsisten dipakai di SELURUH 24 section**, bukan hanya Section 24:

1. **Build/typecheck/lint sebagai quality gate** — `npm run build` (Nuxt build, harus exit 0) dijalankan setiap section sejak awal. `npm run lint`/`npm run typecheck` baru tersedia sejak Section 24 (Q8 RESOLVED — lihat bagian 8 di bawah); sebelumnya build sukses adalah satu-satunya sinyal otomatis.
2. **Smoke-test SSR via `curl`** — setiap route baru/berubah diverifikasi HTTP 200 DAN konten spesifik (string/data yang seharusnya muncul) di-grep dari HTML SSR — bukan hanya status code (pelajaran dari bug routing Section 08 lama, dicatat di `docs/mockup-section-progress.md` Entri Section 08).
3. **Code review ketat sebagai pengganti interactive click-testing** — **keterbatasan yang eksplisit dan konsisten di SETIAP laporan section sejak Section 06**: tidak ada tool browser headless tersedia di lingkungan pengembangan ini. Verifikasi klik/interaksi (submit form, klik tombol approve, drag-drop, dst.) TIDAK PERNAH dilakukan secara otomatis end-to-end — dimitigasi lewat pembacaan kode logic secara manual per fungsi mutator + cross-check nilai fixture manual (mis. `USR-002` PM benar memiliki 3 project aktif untuk widget "Active Projects Milik Saya").
4. **Role-switching adalah keterbatasan spesifik** — role aktif disimpan `localStorage` (client-only); SSR/`curl` SELALU merender sebagai default demo user (Super Admin). Ini berarti konten Client Portal/Supplier Portal/role-scoped lain TIDAK dapat diverifikasi via smoke-test SSR biasa — dimitigasi lewat grep audit field terlarang (cost/margin) + cross-check fixture manual per role.
5. **Satu bug fatal nyata yang lolos dari metode #2 di atas** — `DataCloneError` (Section 01, `mock-reset.client.ts`) adalah bug client-only yang TIDAK dieksekusi saat SSR, sehingga 5 section berturut-turut smoke-test `curl` melaporkan sukses padahal app gagal mount di browser sungguhan. Ditemukan hanya karena user melaporkan langsung. Pelajaran ini didokumentasikan permanen di `docs/frontend-known-issues.md` bagian 0b sebagai peringatan: metode #2 TIDAK CUKUP untuk memvalidasi kode `.client.ts`.
6. **Regression checks per section** — setiap section baru menjalankan ulang smoke-test terhadap route-route section sebelumnya yang berpotensi terdampak (bukan seluruh 89 route setiap saat, kecuali Section 24 sendiri yang eksplisit mengaudit seluruhnya — lihat `docs/mockup-section-reports/section-24-full-regression-final-docs.md` bagian route audit, mengutip temuan Phase 1 89/89 pass).

---

## 7. Review — Yang Harus Diperiksa Reviewer Manusia

Checklist lengkap per-role ada di `docs/frontend-demo-and-review-guide.md`. Ringkasan area yang WAJIB direview manual (karena tidak dapat diverifikasi otomatis di lingkungan ini):

- Interaksi klik nyata pada seluruh form/dialog/aksi mutasi (approve/reject/create/edit/delete) — belum pernah divalidasi via automated browser testing.
- Tampilan visual/responsive lintas breakpoint (mobile/tablet/desktop) — dicek struktural (Tailwind responsive class dipakai konsisten) tapi tidak di-screenshot-test.
- Role-switching interaktif nyata (klik pilih role di UI, verifikasi nav/dashboard/akses berubah sesuai) — terutama Client/Supplier yang paling tidak dapat diverifikasi via SSR.
- Print preview (`window.print()`) — 9 dokumen preview route (e-ticket, voucher, service order, driver sheet, rundown, BOQ, quotation, manifest, run sheet) belum pernah divalidasi hasil cetak fisik/PDF-nya, hanya konten HTML.
- 9.428 temuan lint (gaya kode, bukan bug) — lihat bagian 8 di bawah, opsional untuk dibersihkan bertahap, bukan blocker demo.

---

## 8. Maintenance — Panduan untuk Yang Melanjutkan

### Tooling yang kini tersedia (baru Section 24)

```bash
npm run lint        # eslint . --ext .js,.ts,.vue
npm run typecheck   # vue-tsc --noEmit -p tsconfig.json
npm run build        # nuxt build (sudah ada sejak awal)
```

Project memakai **pnpm** secara aktual (`pnpm-lock.yaml` ada, `package-lock.json` tidak ada) — gunakan `pnpm install`/`pnpm add` untuk menambah dependency baru, meski nama script tetap netral (`npm run lint` bekerja lewat package manager apa pun karena membaca `package.json`).

### Menambah domain baru (mengikuti pola D-070)

1. Buat `app/types/<domain>.ts` — entitas baru, TAUTKAN via ID opsional ke entitas existing, JANGAN memutasi shape entitas lama.
2. Buat `app/data/<domain>.ts` — fixture `reactive()`, ID mengikuti skema `XXX-NNNN` existing (jangan pakai ulang prefix yang sudah dipakai domain lain).
3. Tambah selector/mutator di `app/data/index.ts` (barrel) — bukan logic tersebar di halaman.
4. Tambah `ModuleKey` baru di `app/types/user.ts` bila domain butuh permission granularity sendiri; update `ROLE_MODULE_ACCESS` (`app/constants/roles.ts`) untuk SELURUH 16 role secara eksplisit (jangan biarkan role mana pun tanpa entri).
5. Tambah item ke `NAV_ITEMS` (`app/constants/navigation.ts`).
6. Modul top-level baru MENDAMPINGI (bukan menggantikan) tab Project Detail existing bila domain terkait project — ikuti preseden Section 13-16.
7. Update `docs/frontend-module-map.md`/`docs/frontend-workflow-map.md`/`docs/frontend-known-issues.md`/`docs/mockup-design-decisions.md` (D-0xx baru) — dokumentasi WAJIB, bukan opsional (protokol).

### Area yang JANGAN disentuh tanpa keputusan baru eksplisit (LOCKED)

Daftar lengkap dan alasannya: `docs/frontend-implementation-roadmap.md` bagian "Fitur yang Tidak Boleh Dikerjakan Ulang (Protected)". Ringkasan area paling berisiko bila disentuh sembarangan:
- `OpportunityStage`/`ProjectStatus` (union value, hanya boleh diperluas via derivasi seperti `ProjectOrderStatus`, jangan direstrukturisasi).
- `approveOpportunityWon` guard (`approvalStatus === 'approved' && clientConfirmedAt`).
- Sanitization field cost/margin di `app/pages/client/**` — WAJIB grep-audit ulang setiap kali halaman Client baru dibuat.
- `createFlightBooking`/`createHotelBooking`/`createTransportBooking`/`createMiceEvent` — signature/behavior LOCKED, tambahan logic (duplicate-check, orchestration) dibuat DI LUAR fungsi ini.
- `update*BookingStatus` (Section 13-16) — guard/transition-map/reason-wajib LOCKED, `CancellationRecord` dibuat SETELAH transisi berhasil, bukan di dalam fungsi.
- `Invoice.amountIdr` — TIDAK PERNAH ditulis ulang oleh mutator mana pun, gunakan `getInvoiceOutstandingIdr()`.
- `app/pages/projects/[id]/edit.vue` — LOCKED template stub sejak Section 05, sengaja belum dibangun, bukan bug.

### Known non-blocking backlog

Lint 9.428 temuan (gaya kode: indentasi, koma, kutip) — auto-fixable via `eslint --fix` tapi SENGAJA tidak dijalankan Section 24 untuk menghindari mass-reformat/"big redesign" yang melanggar protokol "perubahan lintas section minimal". Lihat `docs/frontend-known-issues.md` bagian 19 untuk breakdown lengkap dan rekomendasi.

### Rekomendasi bila proyek dilanjutkan ke Fase 3 (di luar scope 25-section roadmap ini)

- Backend/API nyata untuk mengganti `app/data/*.ts` (arsitektur selector/mutator SUDAH dirancang agar migrasi ini relatif mekanis — ganti implementasi fungsi di `app/data/index.ts`, kontrak fungsi tetap sama).
- Headless browser testing (Playwright/Cypress) untuk menutup gap "verifikasi interaktif tidak dilakukan" yang konsisten disebut di setiap laporan section.
- `vee-validate`+`zod` untuk form baru (Q7, `docs/mockup-open-questions.md` — lihat keputusan final di `docs/frontend-known-issues.md` bagian 19).
- Accommodation `hasScheduleChange` parity gap (lihat `docs/frontend-known-issues.md` bagian 20) — perbaikan kecil, aman dikerjakan kapan pun karena bersifat aditif murni.
