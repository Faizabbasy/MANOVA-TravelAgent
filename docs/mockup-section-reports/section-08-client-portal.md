# Section Report — Section 08: Client Portal

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_08_Client_Portal.md`. Section kesembilan roadmap Section 00–24 baru, dijalankan setelah Section 07 (Customer Journey, COMPLETED).

---

## 1. Section Objective dan Scope

"Implementasikan role Client secara lengkap pada frontend." Wajib: Client dashboard; Company profile dan contacts; Travel request creation; Quotation view, revision request, accept/reject confirmation mock; Project Orders milik company; Shared itinerary; Traveler/participant submission; Shared documents; Invoice/payment status sell-side; Change request; Support/contact AE dan PM; Notifications/action center; Client tidak melihat internal margin, supplier cost, internal notes, atau client lain. Acceptance: Client dapat menjalankan seluruh pekerjaan yang memang menjadi tanggung jawabnya tanpa akses internal.

## 2. Source Documents yang Dibaca

`prompts/SECTION_08_Client_Portal.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-07-*.md`, source code aktual (`app/pages/client/index.vue`, `app/composables/usePermissions.ts`, `app/constants/roles.ts`, `app/types/user.ts`, `app/data/index.ts`, `app/types/project.ts`/`finance.ts`/`activity.ts`/`party.ts`), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` di awal sesi menunjukkan Section 06/07 masih uncommitted di working tree (belum di-commit user, dicatat apa adanya). Audit terhadap `docs/frontend-known-issues.md` bagian 6 menemukan entri yang SUDAH STALE: mencatat "belum ada sama sekali — tidak ada route `/client/*`, tidak ada role `client`" padahal Section 02 (2026-08-01) sudah membangun role `client`, `ModuleKey` `client-portal`, `User.clientPartyId`, `usePermissions().clientScopeId`, dan shell `/client/index.vue` minimal (profil company + list Opportunity + list Project Order, tanpa nilai komersial). Dokumen tsb tidak diperbarui saat itu — dikoreksi di section ini.

Audit langsung kode `/client/index.vue` (shell) mengonfirmasi:
- Isolasi `clientScopeId` sudah bekerja benar (seluruh query di-scope ke `Party` milik user login).
- List Project Order mengarah ke `/projects/${id}` — route INTERNAL yang digerbangi `canView('project')`. Role `client` punya `project: 'NONE'` (`app/constants/roles.ts`) — link ini secara efektif SELALU menampilkan `RoleAccessState` "tidak memiliki akses" bagi Client, bug UX tersembunyi (bukan crash, tapi fitur yang tidak pernah bisa dipakai).
- TIDAK ADA fitur bisnis apa pun di luar 3 stat card + 2 list read-only — seluruh 12 item Wajib Section 08 (kecuali dashboard shell dan isolasi dasar) belum ada.

## 4. Decisions yang Digunakan

D-065 (`docs/mockup-design-decisions.md`, baru) — sanitization field eksplisit; Accept/Reject self-service reuse `recordClientConfirmation`; Reject bersifat komunikasi (bukan mutasi status); Change Request kategori dibatasi; Shared Documents read-only.

## 5. Implementation Summary

**`/client/index.vue`** (ditulis ulang total) — Dashboard lengkap:
- **Action Center** (baru) — agregat 3 jenis notifikasi lintas Opportunity/Project Order company: quotation `approved` menunggu `clientConfirmedAt`, traveler dengan dokumen belum lengkap (`isTravelerDocumentMissing`, project aktif saja), invoice overdue (`isInvoiceOverdue`) — masing-masing link langsung ke halaman terkait.
- **Profil Company** (dipertahankan dari shell) + **Support** (baru, kontak Account Executive via `party.accountOwnerId`) + **Contacts** (baru, list `getContactsByParty` + dialog "Tambah Kontak" reuse `createContact`).
- **Travel Request** (baru) — dialog "Ajukan Travel Request": destinasi, tanggal perkiraan, estimasi traveler, service scope (toggle pill, pola sama Requirement Detail Section 08 lama/Opportunity), catatan kebutuhan. Submit memanggil `createLead({ source: 'client-portal', ownerId: party.accountOwnerId ?? 'USR-001', ... })` lalu langsung `updateLeadQualification` mengisi draft detail (termasuk `handedOverTo: party.accountOwnerId`) — Lead baru muncul di `/customer-journey/leads` untuk ditindaklanjuti Sales/AE, TIDAK ADA dataset paralel.
- **Opportunity/Project Order list** — link diperbaiki ke `/client/opportunities/[id]`/`/client/project-orders/[id]` (baru), menggantikan link lama yang tidak accessible.

**`/client/opportunities/[id]/index.vue`** (baru) — Quotation client-facing:
- Guard isolasi: `opportunity.partyId === clientScopeId`, selain itu not-found.
- Quotation ditampilkan tersanitasi: `amountIdr`/`discountIdr`/`taxIdr`/`currency`/`validUntil`/`paymentTerms`/`termsAndConditions`/`inclusions`/`exclusions`/`serviceBreakdown` — TIDAK PERNAH `estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`approvedBy`/`approvalNote`.
- **Setujui Quotation** — muncul saat `approvalStatus === 'approved' && !clientConfirmedAt`, memanggil `recordClientConfirmation(opportunityId, currentUser.id, note)` (Section 05, reuse, kini self-service — CI-038).
- **Tolak Quotation** — `createPartyActivity` mencatat keberatan (pesan wajib), TIDAK memutasi `approvalStatus` apa pun (Client bukan approver komersial).
- **Minta Revisi** — selalu tersedia bila quotation ada, `createPartyActivity` mencatat permintaan.

**`/client/project-orders/[id]/index.vue`** (baru) — Project Order client-facing, 6 tab:
- **Overview** — destinasi/tanggal/traveler/`quotationAmountIdr` (harga jual, BUKAN `budgetIdr`/`actualCostIdr`), service scope, kontak AE+PM.
- **Itinerary** — `getItineraryItems`, day-by-day read-only.
- **Travelers** — list + dialog tambah/edit (reuse `createTraveler`/`updateTraveler` apa adanya, Section 11), indikator dokumen lengkap/belum.
- **Documents** — `getDocumentsByProject`, read-only (keputusan disengaja, lihat bagian 9).
- **Finance** — Invoice (label/amount/due/status/aging) + riwayat Payment per invoice, reuse selector Section 15, TANPA budget/margin.
- **Change Request** — list `ActivityEntry` (`isChange`) + dialog ajukan (reuse `createChangeEntry`, Section 14), kategori dropdown dibatasi `traveler`/`itinerary`/`service`/`other` (menyembunyikan `vendor`/`budget`).

## 6. Routes

`/client/opportunities/[id]` — **baru**. `/client/project-orders/[id]` — **baru**. `/client` — rewrite total (route sama).

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/pages/client/opportunities/[id]/index.vue`
- `app/pages/client/project-orders/[id]/index.vue`
- `docs/mockup-section-reports/section-08-client-portal.md` (laporan ini)

**Changed:**
- `app/pages/client/index.vue` (ditulis ulang total dari shell Section 02)
- `app/types/lead.ts` (`LeadSource` +`'client-portal'`)
- `app/constants/status.ts` (`LEAD_SOURCES` +1 entri)
- `app/constants/navigation.ts` (komentar diperbarui, tidak ada perubahan struktur)
- `docs/mockup-design-decisions.md` (+D-065)
- `docs/mockup-change-impact-log.md` (+CI-038)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 17), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `RoleAccessState`, `StatsCard`, `EmptyState`, `StatusBadge`, `DetailMetadataList`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogScrollContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Table*`, `Button`, `Input`, `Label`, `NuxtLink`, `useToast`. Tidak ada shared component baru.

## 9. Types/Constants/Fixtures/Mock State

`LeadSource` +`'client-portal'` (aditif, `LEAD_SOURCES` +1 entri, label "Client Portal (Repeat Request)"). Tidak ada entitas baru, tidak ada fixture baru/diubah. **Keputusan disengaja:** `DOCUMENTS` (`app/data/activity.ts`) TETAP bukan `reactive()` dan tidak mendapat mutator create — tab "Documents" Client Portal bersifat read-only (dokumen yang DIBAGIKAN OLEH agency, bukan two-way upload). Menambah kemampuan upload akan memerlukan migrasi `reactive()` + mutator baru yang di luar scope literal "Shared documents" (dibaca wajar sebagai fitur viewing).

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `SectionCard`/`Table`/`Tabs`/`Dialog` existing yang sudah responsive.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk role tanpa `canView('client-portal')` ATAU tanpa `party` (termasuk role `client` yang `clientPartyId`-nya somehow tidak valid — edge case defensif).
- Not-found EKSPLISIT (bukan hanya `RoleAccessState` generik) untuk `/client/opportunities/[id]`/`/client/project-orders/[id]` bila ID tidak ada ATAU ID ada tapi `partyId`/`clientScopeId` tidak cocok (isolasi — mencegah Client A menebak ID Client B, pesan tidak membocorkan mana dari 2 kondisi yang terjadi).
- Action Center: `EmptyState` "Tidak ada tindakan yang perlu dilakukan saat ini" bila kosong.
- Setiap list (Opportunity/Project Order/Contacts/Travelers/Documents/Invoice/Change Request) punya `EmptyState`/`TableEmpty` sendiri dengan copy yang sesuai konteks.

## 12. Role Behavior

Seluruh 3 halaman digerbangi `canView('client-portal')` (role `client` = `MANAGE`, Super Admin = `ADMIN` — tapi Super Admin tidak punya `clientScopeId` sehingga tetap `RoleAccessState`, isolasi tidak bisa di-bypass Super Admin lewat halaman ini, konsisten pola Supplier Portal). Tidak ada role lain yang mendapat akses `/client/*` (`ROLE_MODULE_ACCESS` existing, tidak diubah).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (chunk `client-*` baru ter-compile untuk 2 route baru).
- `npx vitest run` — tidak dijalankan ulang (pre-existing gap, Q8).
- Lint/typecheck — tidak tersedia (pre-existing, Q8).
- **Smoke test HTTP** — `/client`, `/client/opportunities/OPP-001` (ada, bukan milik default SSR context), `/client/opportunities/OPP-999` (not-found), `/client/project-orders/PRJ-101`, `/client/project-orders/PRJ-999` (not-found), `/client/project-orders/PRJ-101?tab=travelers`/`?tab=finance`/`?tab=changes`, plus ~12 route regresi lintas modul (CRM/Customer Journey/Projects/Vendors/Finance/Reports/Admin/Supplier/Settings) — **seluruhnya HTTP 200**, tanpa string error (`TypeError`/`Cannot read`/`is not defined`).
- **Grep audit field terlarang** — `estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/`approvedBy`/`approvalNote`/`vendorId`/`VENDOR_QUOTATIONS` di ketiga file (`client/index.vue`, `client/opportunities/[id]/index.vue`, `client/project-orders/[id]/index.vue`) — **nol kecocokan** (satu-satunya match adalah di komentar penjelasan, bukan kode aktif).
- **KETERBATASAN PENTING (dicatat eksplisit, bukan diabaikan):** Verifikasi interaktif KONTEN role Client TIDAK DAPAT dilakukan lewat smoke test SSR/curl seperti section lain. Role-switching (`useCurrentUser.setCurrentUser`) adalah mekanisme **client-only** (`localStorage`) — SSR selalu merender dengan `DEFAULT_USER_ID = 'USR-010'` (Super Admin, D-041), yang TIDAK punya `clientScopeId`. Akibatnya `/client/*` di bawah curl SELALU menampilkan `RoleAccessState` "Anda tidak memiliki akses" — perilaku ini **BENAR** (membuktikan isolasi bekerja untuk role yang salah), tapi berarti konten Client-facing sesungguhnya (Action Center, quotation tersanitasi, form traveler, dst.) TIDAK PERNAH benar-benar dirender dalam smoke test manapun di section ini. Dimitigasi lewat: (a) grep audit field terlarang (lihat di atas) — bukti objektif, bukan asumsi; (b) code review baris-per-baris terhadap isolasi (`isOwnCompany`, `clientScopeId`) di kedua halaman detail baru; (c) cross-check manual fixture linkage (`PTY-001`/`USR-019` — 2 Project Order Won `PRJ-101`/`PRJ-104` + 1 Opportunity `OPP-006` approved-belum-confirmed, cocok untuk mendemokan seluruh fitur; `PTY-002`/`USR-020` — untuk verifikasi isolasi lintas company).

## 14. Regression

Tidak ada file di luar `app/pages/client/*`, `app/types/lead.ts`, `app/constants/status.ts`, `app/constants/navigation.ts` (komentar) yang disentuh. `recordClientConfirmation`/`createContact`/`createLead`/`updateLeadQualification`/`createTraveler`/`updateTraveler`/`createChangeEntry`/`createPartyActivity` (seluruhnya mutator existing dari section lain) TIDAK diubah signature/body-nya — hanya dipanggil dari titik akses baru. Route existing (`/crm/opportunities/[id]`, `/customer-journey/leads`, `/projects/[id]`, dst.) dikonfirmasi tetap HTTP 200 tanpa perubahan konten.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-038 — `recordClientConfirmation` (Section 05) kini dipanggil dari 2 titik akses (AE-facing existing + Client-facing baru), bukan mutator baru. Tidak ada dampak terhadap Section 06 (`/crm/quotations` Management Approval Queue tetap membaca `Opportunity.clientConfirmedAt` yang sama, otomatis konsisten tanpa perubahan kode).

## 16. Known Issues dan Deferred Work

- Shared Documents read-only (tidak ada upload client) — keputusan disengaja (D-065), evolusi lanjutan bila dibutuhkan (`DOCUMENTS` perlu jadi `reactive()` + mutator baru).
- Verifikasi interaktif konten role Client tidak dapat dilakukan headless — keterbatasan LEBIH KETAT dari section lain (bukan hanya "klik tidak diverifikasi", tapi seluruh render konten tidak teruji SSR), dicatat eksplisit di bagian 13, dimitigasi lewat grep audit + code review + cross-check fixture.
- Q8 (tooling lint/typecheck/test) tetap terbuka, tidak berubah.

## 17. Protection Notes untuk Section Berikutnya

`recordClientConfirmation` kini punya 2 pemanggil (AE-facing `/crm/opportunities/[id]`, Client-facing `/client/opportunities/[id]`) — **jangan mengubah signature-nya** tanpa memeriksa dampak ke keduanya. `LeadSource` bertambah 1 nilai (`'client-portal'`) — union type, seluruh switch/mapping existing yang generik terhadap `LEAD_SOURCES` (mis. `/customer-journey/lead-sources`) otomatis mendukungnya tanpa perubahan kode (diverifikasi: halaman tsb iterasi `LEAD_SOURCES` generik, bukan hardcode daftar). Bila Section 09+ menyentuh `/client/project-orders/[id]` (mis. menambah tab), **pertahankan sanitization** — jangan menambahkan field `budgetIdr`/`actualCostIdr`/cost internal lain ke halaman ini.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `/settings` dan ganti role ke salah satu demo user Client (`Hendra Wijaya` — `PTY-001`, atau `Sarah Amelia` — `PTY-002`), lalu buka `http://localhost:8080/client` untuk melihat dashboard penuh (Action Center akan menampilkan item untuk `OPP-006` bila login sebagai `Hendra Wijaya`/PTY-001). Klik Opportunity/Project Order untuk masuk ke halaman detail baru dan coba aksi Setujui/Tolak/Minta Revisi, tambah Traveler, ajukan Change Request.

## 19. Recommended Next Section

**Section 09 — Project Order dan Handover** (taksonomi status baru Q16, langkah Accept/Return Handover eksplisit oleh PM), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
