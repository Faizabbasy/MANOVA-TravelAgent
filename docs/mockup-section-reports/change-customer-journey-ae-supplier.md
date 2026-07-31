# Change Report — Customer Journey, Account Executive, Supplier, dan Commercial Approval

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/21-PROMPT-19-CHANGES-&-UPDATE.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user. Ini adalah **change request** di atas mockup 18-section yang sudah COMPLETED (Section 00–18) — bukan lanjutan phasing baku.

---

## 1. Scope

Perubahan terhadap codebase MANOVA existing:
1. **Role** — 2 role baru: Account Executive, Supplier (13 role total). Contoh akun supplier PT ABC/PT EFG dengan vendor isolation.
2. **Sales dan Account Executive** — Sales dipersempit ke Lead (screening/qualification); Account Executive mengambil alih Opportunity/Quotation s/d Won, tetap Account Owner.
3. **Commercial Approval** — workflow Draft→Submitted→Approved/Rejected pada Quotation, hanya Management/Super Admin yang approve, AE tidak dapat Mark as Won sebelum approved.
4. **Opportunity Won** — company Prospect→Active Client, Project Order otomatis (existing, dipertahankan), repeat client tidak membuat company baru.
5. **Customer Journey Dashboard** — Leads (Table/Kanban/Inbox+drawer), Customers, Project Orders.
6. **Super Admin Dashboard** — Lead Source Recap, Activity Center.
7. **Supplier dan External Partners** — vendor company, supplier user, katalog produk, isolasi data.
8. **Route dan Navigation** — dievaluasi berdasarkan codebase existing, tidak ada route duplikat bila existing dapat diadaptasi.
9. **Data Foundation** — perluasan dummy data terpusat.
10. **Hak Akses Minimum** — per role di atas.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/21-PROMPT-19-CHANGES-&-UPDATE.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, design-decisions, open-questions, scope, information-architecture, data-scenarios, route-and-role-matrix, template-reuse-mapping), `docs/mockup-section-reports/section-05` s/d `section-18`, source code aktual (types/constants/data/composables/pages CRM/Vendor/Admin — audit menyeluruh via agent research sebelum implementasi), `git log`/`git status`.

## 3. Existing Implementation yang Diperiksa

Baseline 18-section sudah COMPLETED dan ter-commit (Section 05–18). Ditemukan: `Party` (D-001/D-024) sudah tepat sebagai basis "Company"; `Project` sudah tepat sebagai basis "Project Order" (Account Executive derivable via `Opportunity.ownerId`); `Opportunity.stage` state machine (D-028, 9 nilai) sudah dipakai luas Section 08/09/14 — tidak cocok direstrukturisasi untuk Commercial Approval; primitive `ui/sheet/*` sudah ada sejak Foundation tapi **belum pernah dipakai** (dependency check: 0 pemakaian); `ROLE_MODULE_ACCESS`/`usePermissions()` sudah scalable untuk role/modul baru tanpa perubahan struktural; pola "narrow role exception" (`canManageParty`, `canManageOpportunity`) sudah mapan sejak Section 07/08, dipakai ulang konsisten.

## 4. Decisions yang Digunakan

D-046 s/d D-052 (`docs/mockup-design-decisions.md` Kelompok I) — ringkasan:
- **D-046:** 2 role baru (Account Executive, Supplier).
- **D-047:** Sales dipersempit ke Lead; `Opportunity.ownerId` di-reassign ke AE.
- **D-048:** Modul `supplier-portal` terpisah dari `vendor`; isolasi via `User.vendorId`/`usePermissions().vendorScopeId`.
- **D-049:** Commercial Approval sebagai lapisan aditif pada `Quotation`, **bukan** restrukturisasi `OpportunityStage`.
- **D-050:** "Company"/"Project Order" = `Party`/`Project` existing, bukan entitas paralel.
- **D-051:** `Lead`/`LeadActivity` sebagai entitas baru (pre-Party), reuse `PartyActivityType`.
- **D-052:** `NavItem.roles` — narrow role override di level navigasi untuk Activity Center dan pembatasan Sales di Customer Journey.

## 5. Role Changes

13 role total (`app/types/user.ts`, `app/constants/roles.ts`):

| Role | Perubahan |
|---|---|
| Account Executive *(baru)* | `crm: MANAGE` (Opportunity/Quotation s/d Won-Requested + submit Commercial Approval), `project: VIEW`, `reports: VIEW` (Sales Pipeline) |
| Sales *(dipersempit)* | `crm: MANAGE` tetap (kini Lead saja secara UI — narrow gate `canManageOpportunity` tidak lagi menyertakan Sales), Customer Journey dibatasi Leads saja |
| Supplier *(baru)* | Seluruh modul internal `NONE`; `supplier-portal: MANAGE`, ter-isolasi `vendorId` |
| Management, Super Admin | Tidak berubah rank modul lama; Super Admin `ADMIN` di `supplier-portal` (oversight) |
| 8 role lain (PM/Operations/Ticketing/Accommodation/Transportation/MICE/Finance/Viewer) | Tidak berubah |

3 demo user baru: `USR-014` Galih Ramadhan (AE), `USR-015` Hasan Alfarizi (Supplier PT ABC), `USR-016` Ika Puspitasari (Supplier PT EFG).

## 6. Sales dan Account Executive Flow

- **Sales:** menerima lead, screening, qualification, mencatat sumber, follow-up, mengubah stage Lead (`stage: new|contacted|qualified|unqualified`), menyerahkan lead qualified ke AE (`handedOverTo`). Tidak bisa approve commercial/Mark as Won (gate `canManageOpportunity` tidak lagi menyertakan Sales).
- **Account Executive:** menerima lead qualified (via "Qualify & Create Opportunity" — membuat `Party`+`Opportunity` baru, mencari `Party` existing dulu berdasarkan nama untuk cegah duplicate company), requirement gathering, create/edit/revise Quotation, submit for Commercial Approval, Mark as Won (setelah `Quotation.approvalStatus === 'approved'`), handover ke PM (`Project.ownerId`), tetap Account Owner (`Opportunity.ownerId`).

## 7. Commercial Approval

Workflow: `Draft` → `Submitted for Approval` (AE, `submitQuotationForApproval`) → `Approved`/`Rejected` (Management/Super Admin, `approveQuotation`/`rejectQuotation`, `canApprove('crm')`) → AE lanjut Negotiation/Final Confirmation → Ajukan sebagai Won (di-gate `quotation.approvalStatus === 'approved'`) → Approve Won existing (Management/Super Admin, tidak berubah). Ditampilkan di Opportunity Detail sebagai section baru "Commercial Approval" — approver, status, tanggal, catatan (`approvalNote`), history tersirat dari status transisi (mock, bukan backend nyata).

## 8. Customer Journey

- **`/customer-journey`** — Dashboard hub, stats Lead/Opportunity, breakdown per stage.
- **`/customer-journey/leads`** — Table/Kanban/Inbox view (toggle), search, filter stage/owner/source, Archived toggle, right-side `Sheet` drawer (Overview/Activities/Follow-ups, Qualify & Create Opportunity, Archive).
- **`/customer-journey/customers[/[id]]`** — directory Company (= `Party`), tab Overview/Contacts/Opportunities/Project Orders/Activities/Documents.
- **`/customer-journey/project-orders[/[id]]`** — seluruh Project Order (= `Project`), filter client/status/AE/PM/tanggal/tipe; detail PO number/status/overview/financial/documents/related Opportunity/approved Quotation.
- **`/customer-journey/lead-sources`** — Lead Source Recap (total/qualified/opportunities created/won/conversion rate per 9 sumber).
- **Sales dibatasi ke Leads saja** — Customers/Project Orders/Lead Source Recap tidak tampil di nav maupun page-level (`hasAccess` guard).

## 9. Super Admin Dashboard — Lead Source Recap dan Activity Center

Lead Source Recap terintegrasi sebagai route Customer Journey (bagian 8) sekaligus dapat diakses Super Admin. **Activity Center** (`/activity-center`, Super Admin saja) menampilkan `SystemEvent[]` (22 entri seed) lintas 8 modul (lead/opportunity/quotation/client/project-order/vendor/finance/user), filter modul/user/search, stat tile per modul.

## 10. Supplier Isolation

`User.vendorId` menyimpan satu-satunya `Vendor` company yang boleh dilihat supplier user. `usePermissions().vendorScopeId` (computed, `undefined` untuk role selain `supplier`) dipakai di seluruh 3 halaman `/supplier/*` untuk memfilter `getVendorById`/`getServicesByVendor`/`getVendorQuotations`/`getVendorProducts` — tidak pernah membaca array penuh. Diverifikasi: Super Admin (default demo user, tanpa `vendorId`) mengunjungi `/supplier` menampilkan `RoleAccessState` (tidak bocor data vendor manapun); `/vendors/VND-006?tab=products` hanya menampilkan produk PT ABC, tidak menyebut PT EFG sama sekali (dan sebaliknya).

## 11. Files Created, Changed, dan Removed

**Created:**
- `app/types/lead.ts`, `app/data/leads.ts`
- `app/pages/customer-journey/index.vue`, `.../leads/index.vue`, `.../customers/index.vue`, `.../customers/[id]/index.vue`, `.../project-orders/index.vue`, `.../project-orders/[id]/index.vue`, `.../lead-sources/index.vue`
- `app/pages/activity-center/index.vue`
- `app/pages/supplier/index.vue`, `.../products/index.vue`, `.../orders/index.vue`
- `docs/mockup-section-reports/change-customer-journey-ae-supplier.md` (laporan ini)

**Changed:**
- Types: `app/types/user.ts` (+`account-executive`/`supplier`, +`ModuleKey.supplier-portal`, +`User.vendorId`), `app/types/party.ts` (+`size`/`city`/`phone`/`accountOwnerId`), `app/types/opportunity.ts` (+`QuotationApprovalStatus`, +3 field `Quotation`), `app/types/vendor.ts` (+`VendorProduct`, `VendorDetailTab` +`'products'`), `app/types/activity.ts` (+`SystemEvent`).
- Constants: `app/constants/roles.ts` (+2 role, +kolom `supplier-portal`), `app/constants/status.ts` (+`LEAD_SOURCES`/`LEAD_STAGES`/`QUOTATION_APPROVAL_STATUSES`), `app/constants/navigation.ts` (+`NavItem.roles`, +grup Customer Journey/Activity Center/Supplier Portal).
- Composables: `app/composables/usePermissions.ts` (+`vendorScopeId`).
- Utils: `app/utils/attention.ts` (`isFollowUpUpcoming` tipe parameter dipersempit, lihat CI-025).
- Data: `app/data/users.ts` (+3 user), `app/data/vendors.ts` (+2 vendor, +`VENDOR_PRODUCTS`, +2 contact), `app/data/parties.ts` (+field 4 party existing), `app/data/opportunities.ts` (ownerId reassignment, restage OPP-005, +OPP-008/QUO-008, +approvalStatus backfill), `app/data/projects.ts` (+PRJ-104), `app/data/activity.ts` (+ACT-1041, +`SYSTEM_EVENTS`), `app/data/index.ts` (+15 selector/mutator baru).
- Pages: `app/pages/crm/opportunities/[id]/index.vue` (Commercial Approval section, gate AE, fix owner display), `app/pages/crm/parties/[id]/index.vue` + `app/pages/crm/prospects.vue` (`canManageParty` +AE), `app/pages/vendors/[id]/index.vue` (+tab Products), `app/pages/reports/index.vue` (`showSalesPipeline` +AE), `app/pages/index.vue` (Dashboard: KPI+widget +AE, +widget Supplier).
- Layout: `app/components/layout/AppSidebar.vue` (`roles` override di filter nav).

**Removed:** Tidak ada.

## 12. Data/Types/Constants Affected

Lihat `docs/mockup-implementation-state.md` bagian 4 dan `docs/mockup-change-impact-log.md` (CI-020 s/d CI-026) untuk detail lengkap. Ringkasan: 4 entitas baru (`Lead`, `LeadActivity`, `VendorProduct`, `SystemEvent`), 4 field aditif pada `Party`, 3 field aditif pada `Quotation`, 1 field aditif pada `User`, 1 `ModuleKey` baru, 1 field baru pada `NavItem`. Tidak ada entitas/field existing yang dihapus atau diubah shape-nya secara breaking.

## 13. Permission Changes

- `ROLE_MODULE_ACCESS` — 2 baris baru (`account-executive`, `supplier`), 1 kolom baru (`supplier-portal`) untuk seluruh 13 role.
- `usePermissions()` — +`vendorScopeId` (data-scoping, bukan permission action-level baru).
- Narrow role exceptions (pola existing, bukan mekanisme baru): `canManageOpportunity` (Opportunity Detail) berpindah Sales→AE; `canManageParty` (Party Detail/Prospects) +AE; `canManageLead` (Leads, baru) = Sales/AE/Super Admin; `canApproveCommercial` (Opportunity Detail, baru) = `canApprove('crm')` generik (Management/Super Admin).
- `NavItem.roles` — override nav-level baru untuk Activity Center (Super Admin saja) dan pembatasan Sales di 3 child Customer Journey.

## 14. Validation

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (beberapa run menemui `EBUSY` pre-existing pada cleanup `.output`/Windows file lock — diselesaikan dengan mematikan proses `node` yang masih berjalan sebelum retry, build itu sendiri selalu sukses tanpa error kompilasi).
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test HTTP** — 32 route (baru + existing representatif) di-curl, seluruhnya **HTTP 200**: `/`, `/crm/prospects`, `/crm/clients`, `/crm/opportunities[+/OPP-001,005,006,008]`, `/crm/parties/[PTY-001,004]`, `/projects[+/PRJ-101,104]`, `/vendors[+/VND-006,007]`, `/finance/invoices`, `/finance/payments`, `/reports`, `/admin[+/users,roles,audit-trail]`, `/customer-journey[+/leads,customers[+/PTY-001],project-orders[+/PRJ-104],lead-sources]`, `/activity-center`, `/supplier[+/products,orders]`.
- **Smoke test konten:**
  - Commercial Approval: OPP-005 menampilkan badge "Menunggu Approval" (2x) dan tombol "Ajukan sebagai Won" disabled dengan penjelasan; OPP-006 menampilkan badge "Disetujui" dan tombol aktif.
  - Supplier isolation: default SSR (Super Admin, tanpa `vendorId`) mengunjungi `/supplier` menampilkan "Anda tidak memiliki akses" (bukan crash/data bocor).
  - Vendor Products: `/vendors/VND-006?tab=products` menampilkan 2 produk PT ABC (Paket Kamar Deluxe, Paket Meeting Room) tanpa menyebut PT EFG; `/vendors/VND-007?tab=products` sebaliknya.
  - Lead Source Recap: Total Leads 10, Qualified 3, Opportunities Created 2, Won 1 — **dihitung ulang manual dari fixture dan cocok persis**.
  - Activity Center: "Menampilkan 22 dari 22 entri" — cocok jumlah `SYSTEM_EVENTS`.
  - Sidebar (default Super Admin): "Customer Journey", "Activity Center", "Supplier Portal" seluruhnya tampil.
  - `admin/roles` dan `admin/users` otomatis merefleksikan role/user baru (Account Executive, Supplier, Galih Ramadhan, Hasan Alfarizi, Ika Puspitasari) tanpa perubahan kode di halaman tsb — mengonfirmasi desain reaktif existing (Section 17) benar-benar generic.
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
- **Verifikasi interaktif** (ganti role Sales/AE/Supplier×2/Management/Super Admin secara live, drag-drop Kanban, klik drawer) **tidak dilakukan** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06; role tersimpan di `localStorage` klien, SSR selalu default Super Admin). Dimitigasi lewat code review ketat terhadap seluruh gate baru (`canManageLead`, `canManageOpportunity`, `canApproveCommercial`, `vendorScopeId`, `NavItem.roles`) dan manual trace kondisi `v-if`/computed.

## 15. Regression

Section 06 (Dashboard — hanya widget baru bersyarat ditambahkan, 11 role lama tidak berubah, diverifikasi diff), Section 07 (Party — `canManageParty` diperluas aditif, tidak restriktif), Section 08 (Opportunity — `ownerId` field value berubah tapi struktur/logic stage tidak, seluruh Opportunity existing tetap dapat dibuka), Section 09 (Won-to-Project — `approveOpportunityWon`/`rejectOpportunityWon` tidak diubah signature-nya, hanya OPP-005 seed state yang di-restage), Section 13 (Vendor — tab baru aditif, 4 tab lama tidak disentuh), Section 16 (Reports — 1 baris visibilitas, 5 section lain tidak berubah) — seluruhnya diverifikasi tidak beregresi lewat smoke test HTTP+konten di atas.

## 16. Known Issues

- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`, tidak berubah sejak Section 06.
- **Q12 (baru)** — `/supplier/orders` read-only, tidak ada self-service submit quotation dari sisi supplier (literal Prompt 19-7 hanya meminta "melihat", bukan "mengajukan"; `submitVendorQuotation` sudah ada dan reusable bila ke depannya dibutuhkan).
- Verifikasi interaktif ganti-role/drag-drop Kanban tidak dilakukan secara headless (keterbatasan tooling, konsisten sejak Section 06).
- Kanban view Leads tidak mendukung drag-and-drop untuk mengubah stage (murni grouping visual, klik card membuka drawer) — perubahan stage dilakukan lewat aksi eksplisit di drawer/action (Qualify & Create Opportunity), bukan drag antar kolom. Ini simplifikasi yang disengaja (menghindari dependency `vue-draggable-plus` untuk fitur yang tidak diminta eksplisit selain label "Kanban").
- Pemetaan role untuk beberapa section baru (Customer Journey Vendor Summary-equivalent, dsb.) mengikuti keputusan implementasi D-047/D-050/D-052 yang didokumentasikan transparan, bukan tabel LOCKED literal dari Prompt 0-3 — disarankan direview user bila perlu diformalkan lebih lanjut.

## 17. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik). Untuk review lokal: `npm run dev`, buka `http://localhost:8080/customer-journey`, `http://localhost:8080/activity-center` (sebagai Super Admin — default), `http://localhost:8080/supplier` (ganti role ke Supplier PT ABC/PT EFG lewat `/admin` role switcher untuk melihat data ter-scope).

## 18. Acceptance Criteria — Self-Check

| Kriteria (Prompt 19-13) | Status |
|---|---|
| Account Executive tersedia | ✅ |
| AE dapat membuat dan mengubah quotation | ✅ |
| Hanya Management yang dapat approve/reject commercial approval | ✅ (`canApprove('crm')` = Management/Super Admin) |
| Opportunity tidak dapat Won sebelum approval Management | ✅ (gate `quotation.approvalStatus === 'approved'`) |
| Opportunity Won mengaktifkan Client dan membuat Project Order | ✅ (existing, tidak diubah — diverifikasi masih berfungsi) |
| Customer Journey tersedia untuk Super Admin dan AE | ✅ |
| Leads memiliki Table/Kanban/Inbox dan right-side drawer | ✅ |
| Action lead menggunakan Qualify & Create Opportunity | ✅ (bukan "Convert to Customer") |
| Customers memiliki Overview, Contacts, Opportunities, Project Orders, Activities, Documents | ✅ |
| Project Orders memiliki list dan detail workflow | ✅ |
| Super Admin memiliki Lead Source Recap | ✅ |
| Super Admin memiliki Activity Center | ✅ |
| Supplier PT ABC dan PT EFG memiliki akun dan produk/layanan berbeda | ✅ |
| Supplier hanya melihat data vendor sendiri | ✅ (diverifikasi via smoke test) |
| Data lintas halaman konsisten | ✅ (satu sumber `PARTIES`/`PROJECTS`/`OPPORTUNITIES`, tidak ada dataset paralel) |
| Dokumentasi dan laporan diperbarui | ✅ (11 dokumen + laporan ini) |
| Validation dilaporkan jujur | ✅ (Q8/Q12 dicatat terbuka, verifikasi interaktif dicatat tidak dilakukan) |

## 19. Recommended Next

Tidak ada section/change baku selanjutnya. Rekomendasi: selesaikan Q8 (tooling lint/typecheck/test) bila akan ada perubahan besar berikutnya. Menunggu perintah user.
