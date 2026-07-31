# Change Report — Sales Qualification to Account Executive Opportunity Flow

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/22-PROMPT-20-Change-Request-Sales-Qualification-to-AE-OpportunityF.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user. Ini adalah **change request** di atas Prompt 19 (COMPLETED, 2026-07-30) — melengkapi pemisahan tanggung jawab Sales/Account Executive yang sudah ada dengan form Qualification terstruktur, Requirement Detail AE, Requirement Gate, Quotation komersial, dan alur Mark as Won yang lebih sederhana.

---

## 1. Scope

Perbaikan alur Customer Journey Lead → Opportunity → Won:
1. **Lead Qualification** — form terstruktur dengan field wajib/opsional, gate kelengkapan, aksi Simpan Draft/Qualify & Create Opportunity/Mark as Unqualified.
2. **Lead Detail Drawer** — tab "Qualification" baru, completion indicator, missing-field warning, status handover.
3. **Qualify & Create Opportunity** — digerbangi kelengkapan, membawa seluruh data qualification ke Opportunity, mencatat 3 activity baru.
4. **AE Requirement Detail** — Opportunity Detail mendapat section baru dengan 14 field, dapat diedit AE.
5. **Requirement Gate sebelum Quotation** — terpisah dari gate sebelum Won yang sudah ada.
6. **Quotation komersial** — discount, estimated cost, estimated margin, payment terms, service breakdown; aksi Edit Quotation terpisah dari Create New Version.
7. **Management Approval** — workflow existing (Draft→Submitted→Approved/Rejected) dipertahankan, sudah sesuai literal Prompt 20-12.
8. **Mark as Won satu-langkah oleh AE** — menggantikan model approval Won dua-langkah untuk eksekusi Won itu sendiri.
9. **Status workflow baru** — badge Pending Requirement/Ready for Quotation/Quotation Draft/Pending Management Approval/Approved/Won/Lost; label lama yang membingungkan direname.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/22-PROMPT-20-Change-Request-Sales-Qualification-to-AE-OpportunityF.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, design-decisions, open-questions, scope, information-architecture, data-scenarios, route-and-role-matrix), `docs/mockup-section-reports/change-customer-journey-ae-supplier.md` (laporan Prompt 19), source code aktual (types/data/pages CRM Opportunity, Customer Journey Leads, permissions — audit menyeluruh via agent research sebelum implementasi), `git log`/`git status`.

## 3. Existing Implementation yang Diperiksa

Baseline Prompt 19 sudah COMPLETED (belum ter-commit saat Prompt 20 dimulai, kemudian dikonfirmasi ter-commit `78d14c0`). Ditemukan gap konkret yang jadi dasar implementasi:
- `Lead` hanya punya field `qualificationNotes` (satu string bebas) — **tidak ada** field qualification terstruktur, tidak ada gate kelengkapan apa pun.
- `qualifyLeadAndCreateOpportunity` hanya menjaga `!lead.opportunityId` — tidak mengecek kelengkapan data apa pun, dan Opportunity yang dihasilkan punya `destination: ''`/`serviceScope: []` kosong (requirement belum digali sama sekali).
- Opportunity Detail **tidak punya tab/section terstruktur** — hanya satu paragraf read-only "Requirement belum digali", tidak ada UI edit requirement sama sekali.
- `getOpportunityMissingRequirements` (Section 09) sudah ada tapi mensyaratkan Quotation SUDAH ada — tidak bisa dipakai ulang untuk gate SEBELUM Quotation dibuat (sirkular).
- `Quotation` hanya punya `amountIdr` — tidak ada discount/cost/margin/payment terms/service breakdown.
- Model approval Won dua-langkah (D-025, Section 09) masih aktif: AE "Ajukan sebagai Won" → Management "Approve Won"/"Reject" terpisah — berbeda dari flow literal Prompt 20-1/13 yang menggambarkan AE langsung Mark as Won setelah Management approve Quotation.
- `vee-validate`+`zod` terpasang tapi 0% dipakai di seluruh codebase (dikonfirmasi ulang) — form baru mengikuti pola manual (`ref()` + `:disabled`) 100% konsisten existing.

## 4. Decisions yang Digunakan

D-053 s/d D-056 (`docs/mockup-design-decisions.md` Kelompok J) — ringkasan:
- **D-053:** AE "Mark as Won" langsung setelah Commercial Approval, mengganti submit+approve terpisah untuk Won (supersede sebagian D-025, khusus eksekusi Won). Reuse 100% mutator existing.
- **D-054:** Qualification sebagai field aditif pada `Lead`, bukan entitas terpisah. "Hasil qualification" direpresentasikan `Lead.stage`, bukan field baru.
- **D-055:** `getOpportunityRequirementGate` (baru, sebelum Quotation) terpisah dari `getOpportunityMissingRequirements` (Section 09, sebelum Won) — dua gerbang bisnis berbeda.
- **D-056:** `OpportunityWorkflowStatus` dirivasi (bukan field tersimpan) dari `stage`+`quotation.approvalStatus`, menggantikan badge status utama; label `won-requested` juga direname langsung di `OPPORTUNITY_STAGES`.

## 5. Role Behavior

Tidak ada role/permission baru (`RoleId`/`ModuleKey`/`ROLE_MODULE_ACCESS` tidak diubah). Perilaku yang berubah:
- **Sales** — kini mengisi form Qualification lengkap (bukan hanya field dasar) sebelum bisa menyerahkan Lead; memilih Account Executive tujuan secara eksplisit di form (bukan lagi implisit saat klik Qualify).
- **Account Executive** — mendapat aksi baru "Edit Requirement" dan "Edit Quotation" di Opportunity Detail; aksi "Mark as Won" (dulu "Ajukan sebagai Won") kini langsung mengeksekusi Won (tanpa menunggu approval terpisah dari Management untuk Won itu sendiri) selama Quotation sudah `approved` dan requirement lengkap.
- **Management** — tidak lagi melihat tombol "Approve Won"/"Reject" terpisah (state `won-requested` kini sesaat/internal); tetap satu-satunya approver Commercial Approval (Quotation) — perannya justru menjadi lebih jelas: approval Management = approval Quotation, titik.
- **Super Admin** — mewarisi seluruh kapabilitas AE (`canManageOpportunity`) dan Management (`canApprove('crm')`) seperti sebelumnya, tidak berubah.

## 6. Lead Form dan Qualification

**Form Tambah Lead Baru** (`/customer-journey/leads`, dialog "New Lead") — **tidak diubah** (Nama Kontak wajib, Nama Company/Sumber Lead/Telepon/Email opsional/wajib sesuai literal Prompt 20-2), tetap sederhana, tidak langsung membuat Opportunity/Customer.

**Tab "Qualification" baru** di drawer Lead Detail — field:
- **Wajib:** Jenis kebutuhan (Corporate/Group/Individual Travel, MICE/Event), Destinasi, Periode Perjalanan (mulai/selesai), Estimasi Traveler, Service Scope (Flight/Hotel/Transportation/MICE/Other — reuse `ServiceTypeKey`, "Other" dipetakan ke `additional`), Ringkasan Kebutuhan Awal, Account Executive yang Menerima Lead.
- **Opsional:** Estimasi Budget/Budget Range, Fleksibilitas Tanggal, Decision Maker, Tingkat Urgensi, Expected Close, Special Request Awal, Catatan Hasil Komunikasi (reuse field `qualificationNotes` existing).
- **Completion indicator:** badge "Qualification X/7" (warna hijau bila lengkap, kuning bila belum) di header drawer.
- **Missing-field warning:** daftar literal ("Destinasi belum diisi", dst.) muncul saat field wajib belum lengkap — mirror pola `getOpportunityMissingRequirements`.
- **3 aksi:** "Simpan Draft" (`updateLeadQualification`, tanpa gate), "Qualify & Create Opportunity" (disabled sampai lengkap, gate juga dicek di dalam mutator `qualifyLeadAndCreateOpportunity` sendiri — bukan hanya UI), "Mark as Unqualified" (`markLeadUnqualified`, terminal, dengan catatan opsional).

## 7. Opportunity Creation

`qualifyLeadAndCreateOpportunity(leadId)` (signature berubah dari `(leadId, accountExecutiveId)` — AE kini diambil dari `lead.handedOverTo`, diisi form, bukan parameter terpisah):
- Gate: `!lead.opportunityId && getLeadMissingQualification(leadId).length === 0`.
- Party existing dicari dulu berdasarkan nama company (cegah duplicate — tidak berubah dari Prompt 19).
- Opportunity baru membawa: `destination`, `travelStartDate`/`travelEndDate`, `travelerEstimate`, `serviceScope`, `requirementNotes` (dari `requirementSummary`), `contactName` (dari `lead.name`), `leadId`, `expectedCloseDate` — seluruhnya field literal Prompt 20-6.
- 3 activity dicatat: "Lead Qualified", "Lead Assigned to Account Executive (nama)" (keduanya `LeadActivity`), "Opportunity Created dari Lead LED-xxx" (`PartyActivity`, tampil di tab Activity Opportunity Detail).
- Duplicate prevention (`lead.opportunityId` guard) — tidak berubah dari Prompt 19.
- Setelah sukses, user diarahkan ke Opportunity Detail (`navigateTo`) — tidak berubah.

## 8. AE Requirement Detail Completion

Section baru "Requirement Detail" di Opportunity Detail (antara Summary dan Stage Stepper):
- 14 field (`OpportunityRequirementDetail`): itinerary concept, departure city, destination detail, traveler composition, room requirement, flight preference, transport requirement, MICE requirement, special request, decision maker, payment terms, commercial notes, operational notes, risk notes.
- Dialog "Edit Requirement" (AE, `DialogScrollContent` — dialog panjang pertama di codebase yang memakai primitive ini) juga mengizinkan menyempurnakan field dasar (destination/travel dates/traveler estimate/service scope/requirement summary/contact person/estimated value) **tanpa menghapus histori qualification** (field lama tetap tampil sebagai nilai awal form, hanya di-overwrite bila diubah).
- Requirement Gate (lihat bagian 9) ditampilkan di section yang sama.

## 9. Requirement Gate Sebelum Quotation

`getOpportunityRequirementGate(opportunityId)` (baru, `app/data/index.ts`) — mengecek: destination, travel period, estimated traveler, service scope, requirement summary, contact person, estimated value. **Terpisah** dari `getOpportunityMissingRequirements` (Section 09, gerbang sebelum Won — mensyaratkan Quotation SUDAH ada, tidak diubah sama sekali). Tombol "Buat Quotation" (dulu "Lanjut ke Proposal") pada stage `requirement-gathering` di-disable + menampilkan warning list bila gate belum lengkap — reuse pola UI existing (border warning + list, sama seperti gerbang Won Section 09).

Payment terms dan margin/cost summary **sengaja tidak digerbangi** (Prompt 20-10 menandainya kondisional "bila diwajibkan"/"bila dipakai pada approval" tanpa mekanisme konfigurasi eksplisit lain — didokumentasikan sebagai D-055, bukan gap tersembunyi).

## 10. AE Quotation

`Quotation` diperluas: `discountIdr`, `estimatedCostIdr`, `estimatedMarginIdr`, `paymentTerms`, `serviceBreakdown` (`QuotationServiceItem[]` — service/description/amount, dapat ditambah/dihapus baris). Aksi baru "Edit Quotation" (`updateQuotationDetails`, hanya selagi `approvalStatus` masih draft/belum diisi — guard di level mutator) terpisah dari "Create New Version" (dulu "Revisi Quotation", tidak berubah perilakunya: menaikkan versi, reset approval ke draft). Quotation tetap terhubung ke Opportunity/Party/AE/Requirement/Service scope/Approval history seperti sebelumnya (tidak ada perubahan relasi).

## 11. Management Approval

**Tidak diubah** — workflow Draft→Submitted for Approval→Approved/Rejected by Management (`submitQuotationForApproval`/`approveQuotation`/`rejectQuotation`, Prompt 19) sudah sesuai literal Prompt 20-12 (Management/Super Admin saja yang approve, meninjau value/discount/margin/payment terms/service scope/kompleksitas/risk — teks dialog sudah menyebutkan seluruhnya sejak Prompt 19). Field `approvedBy`/`approvalNote`/status ditampilkan sebagai representasi "history" (pola implisit dari status transisi, konsisten precedent Prompt 19 — bukan array history penuh).

## 12. Permission Changes

**Tidak ada perubahan `ROLE_MODULE_ACCESS`/`RoleId`/`ModuleKey`.** Perubahan murni pada level UI/gate halaman:
- `canManageOpportunity`/`canApproveCommercial`/`canManageLead` (narrow role exceptions, pola Section 07/08) — **tidak diubah** daftar role-nya.
- Gate baru bersifat data-completeness (`getLeadMissingQualification`, `getOpportunityRequirementGate`), bukan role-based — dicek di level mutator DAN UI (defense-in-depth, konsisten pola `getOpportunityMissingRequirements` existing).

## 13. Files Created, Changed, dan Removed

**Created:**
- `docs/mockup-section-reports/change-sales-qualification-ae-opportunity.md` (laporan ini).

**Changed:**
- Types: `app/types/lead.ts` (+13 field Qualification, +`LeadServiceCategory`/`LeadUrgency`), `app/types/opportunity.ts` (+`OpportunityRequirementDetail`, +`OpportunityWorkflowStatus`, +`QuotationServiceItem`, +4 field `Opportunity`, +5 field `Quotation`).
- Constants: `app/constants/status.ts` (+`LEAD_SERVICE_CATEGORIES`, +`LEAD_URGENCY_LEVELS`, +`OPPORTUNITY_WORKFLOW_STATUSES`, label `won-requested` diubah).
- Data: `app/data/index.ts` (+7 selector/mutator baru: `getLeadMissingQualification`, `updateLeadQualification`, `markLeadUnqualified`, `getOpportunityRequirementGate`, `updateOpportunityRequirement`, `getOpportunityWorkflowStatus`, `updateQuotationDetails`; `qualifyLeadAndCreateOpportunity` signature+body diubah), `app/data/leads.ts` (`LED-001`/`LED-004` backfill qualification), `app/data/opportunities.ts` (+`OPP-009`/`OPP-010`/`QUO-010`, `requirementDetail` pada `OPP-005`/`OPP-006`, `leadId`/`contactName` pada beberapa opportunity existing).
- Pages: `app/pages/customer-journey/leads/index.vue` (tab Qualification baru, form, gate, 3 aksi, completion indicator), `app/pages/crm/opportunities/[id]/index.vue` (section Requirement Detail baru, Requirement Gate, Edit Quotation, Mark as Won satu-langkah, badge status workflow baru, summary metadata +Contact Person/Lead Source/Expected Close/Related Lead), `app/pages/admin/roles.vue` (teks `ROLE_NOTES.management`/`.sales` disinkronkan — CI-029).
- Dokumentasi: `docs/mockup-scope.md`, `docs/mockup-information-architecture.md`, `docs/mockup-data-scenarios.md`, `docs/mockup-design-decisions.md`, `docs/mockup-progress.md`, `docs/route-and-role-matrix.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-change-impact-log.md`, `docs/mockup-section-reports/README.md`.

**Removed:** Tidak ada file dihapus. `rejectOpportunityWon` (`app/data/index.ts`) tetap ada (tidak dihapus) meski tidak lagi dipanggil UI manapun — backward-compatible, D-053.

## 14. Data/Types/Constants Affected

Ringkasan (detail lengkap: `docs/mockup-implementation-state.md` bagian 4, `docs/mockup-change-impact-log.md` CI-027–CI-029): 13 field baru `Lead`, 4 field baru + 1 interface baru (`OpportunityRequirementDetail`) pada `Opportunity`, 5 field baru + 1 interface baru (`QuotationServiceItem`) pada `Quotation`, 1 type baru dirivasi (`OpportunityWorkflowStatus`). Tidak ada entitas/field existing yang dihapus atau diubah shape-nya secara breaking — seluruhnya aditif.

## 15. Validation

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**, chunk `leads-*`/`opportunities-*`/`customer-journey-*` ter-compile tanpa error kompilasi.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing, tidak berubah).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test HTTP** — ~27 route (baru+existing representatif) di-curl: `/`, `/customer-journey/leads`, `/crm/opportunities[+/OPP-001,005,006,007,009,010]`, `/crm/prospects`, `/crm/clients`, `/crm/parties/[PTY-001,004]`, `/projects[+/PRJ-101,104]`, `/vendors[+/VND-006]`, `/finance/invoices`, `/finance/payments`, `/reports`, `/admin[+/users,roles,audit-trail]`, `/customer-journey[+/customers[+/PTY-001],project-orders[+/PRJ-104],lead-sources]`, `/activity-center`, `/supplier[+/products,orders]` — **seluruhnya HTTP 200**, tidak ada string "Internal Server Error"/"TypeError"/"is not defined"/"Cannot read propert(y|ies)" di HTML manapun.
- **Smoke test konten:**
  - OPP-006 (quotation approved): badge "Approved" tampil, tombol "Mark as Won" aktif.
  - OPP-005 (quotation submitted): badge "Pending Management Approval" tampil, tombol "Mark as Won" disabled dengan penjelasan.
  - OPP-007 (requirement kosong, existing): badge "Pending Requirement" tampil.
  - OPP-009 (requirement lengkap, tanpa quotation, baru): badge "Ready for Quotation" tampil, tombol "Buat Quotation" aktif.
  - OPP-010 (quotation draft lengkap, baru): badge "Quotation Draft", tombol "Edit Quotation", section "Service Breakdown" (2 baris) tampil.
  - `/customer-journey/leads`: list lead existing tampil normal (nama-nama lead terverifikasi via curl), "New Lead" tombol tampil.
  - `/customer-journey/lead-sources`: Total Leads 10, Qualified 3, Opportunities Created 2, Won 1 — **tidak berubah** dari Prompt 19 (dihitung ulang, cocok — fixture Prompt 20 tidak menambah/mengubah relasi Lead↔Opportunity yang mempengaruhi angka ini).
  - `/admin/roles`: tetap HTTP 200 dengan teks role yang sudah disinkronkan.
- **Verifikasi interaktif** (isi form Qualification/Requirement Detail secara live, klik tombol Simpan Draft/Qualify/Mark as Unqualified/Mark as Won, drag-drop) **tidak dilakukan** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap seluruh gate baru (`getLeadMissingQualification` dicek identik di UI computed dan mutator, `getOpportunityRequirementGate`, gate tombol "Mark as Won") dan trace manual seluruh kondisi `v-if`/computed yang menentukan visibilitas tombol per skenario data (dikonfirmasi via smoke test konten di atas untuk 5 opportunity dengan status workflow berbeda).

## 16. Regression

Section 05/Foundation (label `OPPORTUNITY_STAGES.won-requested` — label-only, `value` tidak berubah, seluruh consumer diverifikasi HTTP 200), Section 07 (Party — tidak disentuh), Section 08 (Opportunity — field aditif, struktur stage tidak berubah, seluruh Opportunity existing OPP-001–008 tetap dapat dibuka dan menampilkan data lama dengan benar), Section 09 (Won-to-Project — `approveOpportunityWon`/`getOpportunityMissingRequirements` tidak diubah signature/body-nya, dipanggil ulang dengan urutan berbeda dari UI, bukan logic baru), Section 17/Administration (`admin/roles.vue` — teks saja, `ROLE_MODULE_ACCESS` tidak disentuh), Prompt 19 (Customer Journey/Supplier/Activity Center — seluruh route diverifikasi tetap HTTP 200 tanpa perubahan konten) — seluruhnya diverifikasi tidak beregresi lewat smoke test HTTP+konten di atas.

## 17. Known Issues

- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`, tidak berubah sejak Section 06.
- **Payment terms/margin-cost summary tidak digerbangi hard-block** pada Requirement Gate (D-055) — Prompt 20-10 menandainya kondisional tanpa mekanisme konfigurasi eksplisit lain di codebase; keputusan didokumentasikan, bukan gap tersembunyi.
- Verifikasi interaktif (isi form live, klik aksi, ganti role) tidak dilakukan secara headless (keterbatasan tooling, konsisten sejak Section 06).
- "Hasil qualification" (Prompt 20-4) tidak disimpan sebagai field terpisah, direpresentasikan `Lead.stage` (D-054) — simplifikasi yang disengaja, bukan field yang terlewat.
- `rejectOpportunityWon` (`app/data/index.ts`) tidak lagi dipanggil dari UI manapun sejak D-053 — dipertahankan (tidak dihapus) untuk backward-compatibility, tidak ada dampak fungsional karena tidak ada state `won-requested` yang persisten di fixture manapun.
- Q7, Q9, Q10, Q11, Q12 — tidak berubah dari Prompt 19.

## 18. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik). Untuk review lokal: `npm run dev`, buka `http://localhost:8080/customer-journey/leads` (klik lead "CV Nirmala Eventama"/LED-001 untuk melihat tab Qualification lengkap, atau "Doni Ferdian"/LED-004 untuk melihat warning belum lengkap), `http://localhost:8080/crm/opportunities/OPP-006` (Requirement Detail terisi, tombol Mark as Won aktif), `http://localhost:8080/crm/opportunities/OPP-009` (Ready for Quotation), `http://localhost:8080/crm/opportunities/OPP-010` (Quotation Draft dengan service breakdown) — ganti role lewat `/admin` role switcher untuk melihat perspektif Sales vs Account Executive vs Management.

## 19. Acceptance Criteria — Self-Check

| Kriteria (Prompt 20-19) | Status |
|---|---|
| Form Lead awal tetap sederhana | ✅ (tidak diubah) |
| Sales dapat melengkapi Qualification setelah Lead dibuat | ✅ (tab Qualification baru) |
| Sales dapat menyimpan qualification draft | ✅ ("Simpan Draft", tanpa gate) |
| Qualification memiliki validasi field wajib | ✅ (`getLeadMissingQualification`, 7 field) |
| Sales dapat assign Account Executive | ✅ (field "Account Executive yang Menerima Lead") |
| Sales dapat Qualify & Create Opportunity | ✅ (gate + gate di mutator) |
| Satu Lead tidak dapat membuat Opportunity ganda | ✅ (`lead.opportunityId` guard, tidak berubah) |
| Opportunity membawa data qualification | ✅ (destination/dates/traveler/service scope/requirement notes/contact name/expected close) |
| AE menjadi owner Opportunity | ✅ (tidak berubah sejak Prompt 19) |
| AE dapat melengkapi requirement detail | ✅ (section + dialog "Edit Requirement") |
| AE dapat membuat dan mengubah quotation | ✅ (Create Quotation existing + "Edit Quotation"/"Create New Version" baru) |
| AE dapat submit ke Management | ✅ (tidak berubah, Prompt 19) |
| Hanya Management yang dapat approve/reject | ✅ (`canApprove('crm')`, tidak berubah) |
| Status tidak lagi menggunakan Won (Menunggu Approval) | ✅ (label direname + badge workflow status baru) |
| AE tidak dapat Mark as Won sebelum approval | ✅ (gate `quotation.approvalStatus === 'approved'`) |
| Opportunity Won mengaktifkan Client | ✅ (reuse `approveOpportunityWon`, tidak diubah) |
| Project Order otomatis dibuat | ✅ (reuse, tidak diubah) |
| Activity history konsisten | ✅ (3 activity baru saat Qualify, activity Opportunity existing tidak berubah) |
| Role permission bekerja | ✅ (tidak ada permission baru, gate data-completeness diverifikasi) |
| Dokumentasi diperbarui | ✅ (10 dokumen + laporan ini) |
| Validation dilaporkan jujur | ✅ (Q8 dicatat terbuka, verifikasi interaktif dicatat tidak dilakukan) |

## 20. Recommended Next

Tidak ada section/change baku selanjutnya. Rekomendasi: selesaikan Q8 (tooling lint/typecheck/test) bila akan ada perubahan besar berikutnya. Menunggu perintah user.
