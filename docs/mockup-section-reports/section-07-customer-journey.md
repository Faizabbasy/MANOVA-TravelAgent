# Section Report — Section 07: Customer Journey

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_07_Customer_Journey.md`. Section kedelapan roadmap Section 00–24 baru, dijalankan setelah Section 06 (Management Approval, Won dan Client Activation, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi Customer Journey Dashboard untuk Super Admin dan Account Executive." Wajib: Overview funnel Lead→Qualified→Opportunity→Approved→Won→Client→Project Order; Leads Table/Kanban/Inbox dengan drawer; Customers/Companies list; Customer detail tabs (Overview, Contacts, Opportunities, Project Orders, Activities, Documents); Project Orders list dan detail; Drill-down dari metrics ke records; Filters by source, owner, stage, client, date, project type; AE data scope ke portfolio miliknya, Super Admin seluruh data. Acceptance: Semua entity saling terhubung dan tidak menggunakan dataset paralel.

## 2. Source Documents yang Dibaca

`prompts/SECTION_07_Customer_Journey.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-06-*.md`, `docs/route-and-role-matrix.md` bagian 1.9/5, source code aktual (`app/pages/customer-journey/index.vue`, `leads/index.vue`, `customers/index.vue`, `customers/[id]/index.vue`, `project-orders/index.vue`, `lead-sources/index.vue`, `app/pages/crm/opportunities/index.vue`, `app/pages/crm/quotations.vue`), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` di awal sesi menunjukkan Section 06 masih uncommitted di working tree (belum di-commit user, dicatat apa adanya — tidak diasumsikan). Audit terhadap `docs/frontend-known-issues.md` bagian 5 dan `docs/route-and-role-matrix.md` bagian 1.9/5 mengonfirmasi mayoritas Wajib **sudah COMPLETED** sejak Prompt 19 (Change Request): Leads Table/Kanban/Inbox dengan drawer 4-tab (`/customer-journey/leads`), Customers directory (`/customer-journey/customers`), Customer Detail dengan PERSIS 6 tab literal (Overview/Contacts/Opportunities/Project Orders/Activities/Documents, diverifikasi lewat grep `TABS` constant), Project Orders list dan detail (`/customer-journey/project-orders[/[id]]`), seluruhnya reuse `Party`/`Project`/`Opportunity` (D-050, tidak ada dataset paralel — acceptance criterion sudah terpenuhi sejak awal).

**Gap konkret ditemukan (2):**
1. **Overview funnel dan drill-down** — dashboard utama (`/customer-journey/index.vue`) hanya menampilkan 2 panel breakdown terpisah (Lead Pipeline per lead-stage, Opportunity Pipeline per opportunity-stage) — bukan funnel lintas-entitas 7-tahap yang diminta literal, dan tidak ada satu pun metric yang bisa diklik untuk drill-down ke record terkait. Sudah dicatat sebagai `NEEDS_VALIDATION` di `docs/frontend-known-issues.md` sejak Section 00.
2. **AE data scope tidak konsisten** (ditemukan baru saat audit langsung kode, belum tercatat di known-issues manapun) — `scopedLeads` (dashboard utama) untuk role `account-executive` mengembalikan **seluruh** `LEADS` tanpa filter (hanya cabang `sales` yang di-scope ke `ownerId`); "Active Clients" juga selalu dihitung dari seluruh `PARTIES`. Ini bertentangan langsung dengan Wajib literal "AE data scope ke portfolio miliknya" — Opportunity dan Project Order SUDAH ter-scope benar (existing), tapi Lead dan Party/Client TIDAK. Filter Customers/Project Orders list juga belum punya opsi scoping portfolio (hanya filter generik client/status/type/owner).

**Tidak ada gap** pada filter dasar: Leads sudah punya source/owner/stage (Prompt 19); Project Orders sudah punya client/status/type/AE/PM (Prompt 19) — hanya kurang dimensi "date" dan Customers kurang dimensi "owner", keduanya ditambahkan section ini.

## 4. Decisions yang Digunakan

D-064 (`docs/mockup-design-decisions.md`, baru) — Customer Journey Funnel dihitung snapshot independen per tahap (bukan cohort historis); AE portfolio scoping via toggle default-on (bukan hard filter tanpa override).

## 5. Implementation Summary

**Customer Journey Funnel** — panel baru `SectionCard` "Customer Journey Funnel" di `/customer-journey/index.vue`, ditempatkan di atas 2 panel breakdown existing (yang TETAP dipertahankan — funnel adalah ringkasan makro lintas-entitas, breakdown adalah rincian mikro per-stage, keduanya melayani kebutuhan berbeda). 7 tahap (Lead/Qualified/Opportunity/Approved/Won/Client/Project Order) dihitung dari `funnelStages` computed: masing-masing tahap adalah query independen terhadap data terkini (BUKAN pelacakan cohort per-lead, karena codebase tidak menyimpan event-log transisi — konsisten pola `/customer-journey/lead-sources` yang sudah ada). Setiap tahap menampilkan count, conversion % dari tahap sebelumnya (`formatPercentage`), dan progress bar proporsional terhadap tahap terbesar. Disclaimer eksplisit ditulis di UI: "Opportunity" dapat melebihi "Qualified" karena sebagian data demo dibuat sebelum entitas Lead ada.

**Drill-down** — setiap tahap funnel adalah `NuxtLink` ke halaman list terkait dengan query filter:
- Lead → `/customer-journey/leads`
- Qualified → `/customer-journey/leads?stage=qualified`
- Opportunity → `/crm/opportunities`
- Approved → `/crm/quotations?tab=all&status=approved`
- Won → `/crm/opportunities?stage=won`
- Client → `/customer-journey/customers?status=client`
- Project Order → `/customer-journey/project-orders`

4 halaman tujuan (`leads`, `crm/opportunities`, `customer-journey/customers`, `crm/quotations`) diperbarui minimal agar filter awal ter-seed dari `route.query` (pola sama `projects/[id]/index.vue`, sudah established) — sepenuhnya backward-compatible (tanpa query, perilaku identik seperti sebelumnya).

**Bug fix AE scoping** — `scopedLeads` di dashboard utama diperbaiki: AE kini melihat Lead yang di-handover ke dirinya (`lead.handedOverTo === currentUser.id`, field yang sama dipakai toggle "Assigned to Me" existing di `/customer-journey/leads`). `getPartiesByAccountOwner` (baru, `app/data/index.ts`) menyediakan scoping Party/Client untuk AE, dipakai `scopedParties` (baru) yang menggantikan penggunaan `PARTIES` langsung pada `activeClientCount` dan tahap funnel "Client".

**Portfolio toggle pada sub-list** — `/customer-journey/customers` dan `/customer-journey/project-orders` mendapat checkbox "Hanya Portfolio Saya" (komponen `Checkbox`, default `true` untuk role `account-executive`, tidak tampil untuk role lain karena mereka selalu melihat data penuh) — filter dasar (`base`) beralih antara `getPartiesByAccountOwner`/`getProjectsByAccountExecutive` (AE + toggle ON) vs seluruh `PARTIES`/`PROJECTS` (default untuk role lain, atau AE dengan toggle OFF).

**Filter tambahan** — Customers mendapat filter "Account Owner" (dropdown user, disembunyikan untuk AE karena mereka sudah punya toggle portfolio). Project Orders mendapat filter "Periode Keberangkatan" (30/60/90 hari, pola identik `reports/index.vue`).

## 6. Routes

Tidak ada route baru. `/customer-journey`, `/customer-journey/leads`, `/customer-journey/customers`, `/customer-journey/project-orders`, `/crm/opportunities`, `/crm/quotations` seluruhnya mendapat fitur/filter baru pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `docs/mockup-section-reports/section-07-customer-journey.md` (laporan ini)

**Changed:**
- `app/pages/customer-journey/index.vue` (rewrite — funnel 7-tahap + drill-down, scoping fix Lead/Client)
- `app/pages/customer-journey/leads/index.vue` (+seed `stageFilter` dari `route.query.stage`)
- `app/pages/customer-journey/customers/index.vue` (+filter owner, +toggle "Hanya Portfolio Saya", +seed `statusFilter` dari `route.query.status`)
- `app/pages/customer-journey/project-orders/index.vue` (+filter periode keberangkatan, +toggle "Hanya Portfolio Saya")
- `app/pages/crm/opportunities/index.vue` (+seed `stageFilter` dari `route.query.stage`)
- `app/pages/crm/quotations.vue` (+filter `status` pada tab "Semua Quotation" via `route.query.status`)
- `app/data/index.ts` (+`getPartiesByAccountOwner`)
- `docs/mockup-design-decisions.md` (+D-064)
- `docs/mockup-change-impact-log.md` (+CI-037)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 16), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `RoleAccessState`, `StatsCard`, `StatusBreakdownList`, `NuxtLink`, `Checkbox` (pemakaian ke-2 sejak Section 11 — `Traveler` document filter). Tidak ada shared component baru — funnel ditulis sebagai markup lokal `<ol>`/`<li>` di halaman (bukan komponen shared terekstrak) karena baru dipakai di satu tempat; ekstraksi menjadi shared component dapat dipertimbangkan bila section masa depan butuh pola serupa (dicatat, bukan gap).

## 9. Types/Constants/Fixtures/Mock State

Tidak ada perubahan type/shape apa pun. Tidak ada fixture baru/diubah — seluruh fitur murni membaca `LEADS`/`OPPORTUNITIES`/`PARTIES`/`PROJECTS`/`QUOTATIONS` existing lewat selector baru (`getPartiesByAccountOwner`, fungsi filter murni) dan computed lokal halaman.

## 10. Responsive Behavior

Tidak berubah — funnel memakai `SectionCard`/flex/grid Tailwind existing yang sudah responsive; filter tambahan mengikuti pola `<select>`/`<Checkbox>` yang sudah ada di halaman yang sama.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk role tanpa `canView('crm')` (dashboard) atau `hasAccess` (`canView('crm') && role !== 'sales'`, sub-list — tidak diubah).
- Funnel tidak memiliki empty state terpisah — bar dengan lebar 0% dan count 0 tetap informatif (tidak perlu disembunyikan).
- `TableEmpty` Customers diperbarui menyertakan kondisi filter owner baru dan pesan berbeda saat "Hanya Portfolio Saya" aktif tapi kosong ("Belum ada company di portfolio Anda.").

## 12. Role Behavior

`isLeadOnlyView` (Sales) — funnel dan panel Opportunity Pipeline disembunyikan (tidak berubah dari pola existing, Sales tetap hanya melihat Lead). `isAeScoped` (baru, `account-executive`) — mengaktifkan scoping default di dashboard dan sub-list, TIDAK berlaku untuk role lain (Super Admin/Management/Viewer/Finance/Product Planner tetap melihat data penuh, konsisten literal "Super Admin seluruh data" — diperluas ke seluruh role non-AE, bukan hanya Super Admin, mengikuti pola binary existing `scopedOpportunities`).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run — run pertama gagal kompilasi: `Element is missing end tag` pada `customer-journey/index.vue` baris 113, tag `<p>` tanpa penutup akibat edit yang menghapus `NuxtLink` di dalamnya tanpa menutup elemen induk; ditemukan dari pesan error compiler Vue, diperbaiki, retry sukses).
- `npx vitest run` — tidak dijalankan ulang (pre-existing gap, Q8, tidak berubah).
- Lint/typecheck — tidak tersedia (pre-existing, Q8).
- **Smoke test HTTP** — ~30 route (Customer Journey lintas sub-halaman termasuk `[id]` detail, `/crm/opportunities`, `/crm/quotations`, plus regresi representatif CRM/Projects/Vendors/Finance/Reports/Admin/Lead Intake/Settings/Activity Center/Supplier/Client) — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep, default role Super Admin):
  - `/customer-journey` menampilkan panel "Customer Journey Funnel" dengan seluruh 7 label tahap dan 7 href drill-down yang benar.
  - Angka funnel: Lead 10, Qualified 3, Opportunity 10, Approved 5, Won 4, Client 3, Project Order 4 — **dihitung ulang manual terhadap fixture dan cocok persis**: 11 total Lead −1 archived = 10 aktif; 3 Lead berstage `qualified`; 10 Opportunity total (`OPP-001`–`010`); 5 Quotation `approved` (`QUO-001/002/003/006/008`, dikonfirmasi juga via drill-down `?status=approved`); 4 Opportunity `won` (`OPP-001/002/003/008`); 3 Party `client` dari 4 total; 4 Project (`PRJ-101`–`104`).
  - Drill-down: `/customer-journey/leads?stage=qualified` → `<option value="qualified" selected>`; `/crm/opportunities?stage=won` → `<option value="won" selected>`; `/customer-journey/customers?status=client` → `<option value="client" selected>`; `/crm/quotations?tab=all&status=approved` → 5 ID quotation approved tampil persis, tidak lebih tidak kurang.
  - Filter baru: "Hanya Portfolio Saya" tidak tampil untuk Super Admin (benar, `v-if="isAeScoped"`); "Semua Account Owner" (dropdown baru) tampil 1× di Customers; "Semua Periode Keberangkatan" tampil di Project Orders.
- **Verifikasi interaktif** (klik toggle portfolio sebagai AE, klik tahap funnel, ganti role via Settings) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat: (a) inspeksi langsung state `<option selected>`/`<input>` di SSR HTML untuk seluruh skenario query-param; (b) code review ketat terhadap computed scoping baru; (c) perhitungan manual independen terhadap fixture untuk memverifikasi setiap angka funnel presisi, bukan diasumsikan benar.

## 14. Regression

`app/pages/crm/opportunities/index.vue` dan `app/pages/crm/quotations.vue` (dimiliki Section 08/06) disentuh minimal (seed filter dari query, murni aditif — tanpa query, perilaku 100% identik seperti sebelumnya, dikonfirmasi lewat smoke test route tanpa query tetap menampilkan seluruh data). `app/pages/customer-journey/leads/index.vue` (Section 04/05) disentuh serupa (seed `stageFilter`). Tidak ada file lain di luar Customer Journey/CRM yang tersentuh. Seluruh route regresi representatif dikonfirmasi tetap HTTP 200 tanpa perubahan konten yang tidak diharapkan.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-037 — bug fix AE portfolio scoping pada `/customer-journey/index.vue`, yang dimiliki Prompt 19 (Change Request, COMPLETED sebelumnya). Perbaikan ini disengaja/dituju (bukan regresi section ini) — ditemukan lewat audit literal Wajib "AE data scope" yang sama-sama menjadi bagian Section 07. Role non-AE (mayoritas role sistem) tidak terpengaruh sama sekali.

## 16. Known Issues dan Deferred Work

- Funnel bersifat snapshot per-tahap (bukan cohort historis per-lead individual) — didokumentasikan eksplisit di UI (disclaimer) dan D-064, bukan gap tersembunyi. Implementasi cohort tracking penuh membutuhkan event-log transisi yang tidak ada di codebase — evolusi lanjutan bila dibutuhkan.
- `/crm/opportunities` dan `/crm/quotations` (di luar folder `/customer-journey/*`, dimiliki Section 08/06) TIDAK mendapat AE portfolio scoping — drill-down funnel ke sana tetap menampilkan data lintas-AE, hanya ter-filter oleh stage/status yang diklik. Didokumentasikan sebagai batas scope literal "Customer Journey Dashboard" (D-064).
- Verifikasi interaktif (klik toggle, klik funnel, ganti role) tidak dilakukan headless — keterbatasan tooling konsisten, dimitigasi lewat smoke test SSR konten dan perhitungan manual independen.
- Q8 (tooling lint/typecheck/test) tetap terbuka, tidak berubah.

## 17. Protection Notes untuk Section Berikutnya

`getPartiesByAccountOwner` (baru, `app/data/index.ts`) — selector murni, aman direuse section lain yang butuh scoping Party per-AE (mis. Section 08 Client Portal bila perlu menampilkan "AE yang menangani" pada sisi client). **Jangan mengubah** pola drill-down query param (`?stage=`/`?status=`/`?tab=`) tanpa memeriksa dampaknya ke `/customer-journey` (satu-satunya pemanggil saat ini) — filter seed HANYA membaca `route.query` sebagai NILAI AWAL (`ref` biasa, bukan computed dua-arah kecuali `/crm/quotations` yang memang sudah computed dua-arah untuk tab), jadi mengubah filter secara manual di halaman tujuan TIDAK menulis balik ke URL (kecuali quotations tab) — desain yang disengaja, konsisten dengan pola filter existing di seluruh codebase.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/customer-journey` untuk melihat panel "Customer Journey Funnel", klik tahap "Won" atau "Client" untuk melihat drill-down bekerja. Ganti role ke Account Executive via `/settings` untuk melihat toggle "Hanya Portfolio Saya" muncul di `/customer-journey/customers` dan `/customer-journey/project-orders`, serta funnel yang ter-scope ke portfolio AE tersebut.

## 19. Recommended Next Section

**Section 08 — Client Portal** (melengkapi fitur bisnis penuh di atas shell minimal Section 02: quotation confirm, document, traveler submission, communication, invoice status), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
