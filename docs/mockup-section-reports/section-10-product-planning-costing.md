# Section Report — Section 10: Product Planning dan Costing

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_10_Product_Planning_Costing.md`. Section kesebelas roadmap Section 00–24 baru, dijalankan setelah Section 09 (Project Order dan Handover, COMPLETED).

---

## 1. Section Objective dan Scope

"Implementasikan Product Planner/Travel Consultant frontend." Wajib: Product/package templates; Itinerary concept; Service alternatives; Cost sheet, markup, tax/fee, contingency, currency; Traveler-based costing; Scenario/version comparison; Inclusions, exclusions, assumptions, validity; Collaboration dengan AE, Operations, Finance; Snapshot konsep ketika dipakai pada quotation/project; Internal costing tidak terlihat Client. Acceptance: Planner dapat menyiapkan product/costing yang digunakan AE dan Project.

## 2. Source Documents yang Dibaca

`prompts/SECTION_10_Product_Planning_Costing.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-09-*.md`, source code aktual (`app/types/opportunity.ts`, `app/types/user.ts`, `app/types/project.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/composables/usePermissions.ts`, `app/data/index.ts`, `app/data/opportunities.ts`, `app/data/users.ts`, `app/pages/vendors/index.vue`, `app/pages/vendors/[id]/index.vue`, `app/pages/crm/opportunities/[id]/index.vue`), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–09 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 8 dan `docs/frontend-implementation-roadmap.md` baris 10 sudah eksplisit menandai section ini `NOT_STARTED` sepenuhnya — role `product-planner` sudah ada sejak Section 02 (`ROLE_MODULE_ACCESS['product-planner']` sebelumnya hanya `VIEW` ke `crm`/`project`/`vendor`/`reports`, komentar eksplisit "belum ada modul dedicated") dan user demo `USR-017` (Teguh Santosa) sudah ada.

Audit langsung kode mengonfirmasi **tidak ada** entitas Product/Package catalog maupun Cost Sheet di manapun (`app/types/*.ts`, `app/data/*.ts`) — `Quotation` (Section 05/08, D-062) sudah punya field komersial (`estimatedCostIdr`/`estimatedMarginIdr`/`serviceBreakdown`/`taxIdr`/`markupIdr`/`currency`) tapi seluruhnya diisi manual oleh AE lewat "Edit Quotation", tidak ada alat costing terstruktur (line item per service, traveler-based, markup/tax/contingency terpisah, scenario comparison) yang jadi tanggung jawab Product Planner. Tidak ada route `/product-planning/*` di manapun. Pola halaman list+detail existing (`/vendors`, `/vendors/[id]`) dan pola "Edit Quotation" (whole-array replace untuk embedded list `serviceBreakdown`) dipelajari sebagai referensi konvensi sebelum implementasi.

**Tidak ada gap** pada fondasi role/module/navigation (Section 02) — role `product-planner`, user `USR-017`, dan slot `ModuleKey` sudah siap sebagai basis, tinggal diisi modul dedicated.

## 4. Decisions yang Digunakan

D-067 (`docs/mockup-design-decisions.md`, baru) — Dua entitas baru (`ProductTemplate`/`CostSheet`) terpisah dari `Quotation`; kalkulasi Cost Sheet derivasi (bukan field tersimpan); scenario/version comparison via multi-Cost-Sheet per Opportunity + duplicate-version; snapshot via `applyCostSheetToQuotation` yang mengunci Cost Sheet; modul `product-planning` baru dengan akses `VIEW` untuk AE/Operations/Finance/PM/Management/Viewer, `MANAGE` untuk Product Planner.

## 5. Implementation Summary

**`ProductTemplate`** (`app/types/product.ts`, baru) — katalog paket reusable: `name`/`destination`/`serviceScope`/`status` (draft→active→archived)/`itineraryConcept`/`serviceAlternatives[]` (embedded, pola sama `QuotationServiceItem`: service/label/costPerPaxIdr/isRecommended/notes)/`inclusions`/`exclusions`/`assumptions`/`validityStart`/`validityEnd`/`basePaxCount`. Route `/product-planning` (list: search/filter status+service, create dialog) dan `/product-planning/[id]` (detail: metadata, itinerary concept, tabel service alternatives, edit dialog whole-form termasuk baris alternatif dinamis tambah/hapus, tombol transisi status, daftar Cost Sheet terkait).

**`CostSheet`** (`app/types/product.ts`, baru) — perhitungan konkret: `name` (label skenario)/`productId?`/`opportunityId?`/`travelerCount`/`currency`/`lineItems[]` (embedded: service/description/costPerPaxIdr)/`markupPercent`/`taxPercent`/`contingencyPercent`/`status` (draft/final)/`version`/`supersededTotalSellIdr?`/`inclusions`/`exclusions`/`assumptions`/`validityStart`/`validityEnd`/`notes`/`appliedToQuotationId?`/`appliedAt?`. Route `/product-planning/cost-sheets` (list: search/filter status+opportunity, create dialog yang bisa dipicu dengan query `?productId=`/`?opportunityId=` prefilled dari halaman lain) dan `/product-planning/cost-sheets/[id]` (detail: line items table + edit dialog, breakdown kalkulasi lengkap, scenario comparison panel, version comparison panel, aksi Edit/Duplicate as New Version/Apply to Quotation).

**Kalkulasi** (`getCostSheetBreakdown`, `app/data/index.ts`) — DIRIVASI murni (tidak ada field tersimpan untuk total): `baseCostIdr` = Σ(`lineItems.costPerPaxIdr`) × `travelerCount` → `+contingencyIdr` (`contingencyPercent`%) → `costWithContingencyIdr` → `+markupIdr` (`markupPercent`%) → `subtotalIdr` → `+taxIdr` (`taxPercent`%) → `totalSellIdr`; `marginIdr` = `totalSellIdr` − `costWithContingencyIdr`.

**Scenario/version comparison** — Cost Sheet dengan `opportunityId` sama = skenario berbeda (`getCostSheetsByOpportunity`), ditampilkan sebagai panel "Scenario Comparison" (pilih salah satu untuk dibandingkan sell/margin side-by-side) di halaman detail. `duplicateCostSheetVersion` (baru, pola identik `duplicateQuotationVersion` D-062) menaikkan `version`, menyimpan `supersededTotalSellIdr`, reset `status`/`appliedToQuotationId`/`appliedAt` — panel "Bandingkan dengan versi sebelumnya" mengikuti pola UI Quotation Compare (D-062) persis.

**Collaboration dengan AE, Operations, Finance** — modul `product-planning` (`ModuleKey` baru) dengan `product-planner`: `MANAGE`; `account-executive`/`operations`/`finance`/`project-manager`/`management`/`viewer`: `VIEW`; role lain: `NONE`. SectionCard "Product Planning & Costing" ditambahkan di Opportunity Detail (`/crm/opportunities/[id]`, sebelum Quotation) menampilkan ringkasan Cost Sheet terkait + tombol "Buat Cost Sheet" (link ke Cost Sheets index dengan `opportunityId` prefilled).

**Snapshot konsep** — `applyCostSheetToQuotation(costSheetId, actorId)` (baru): menghitung breakdown, membuat Quotation baru (bila Opportunity belum punya) atau memperbarui yang masih draft (guard sama `updateQuotationDetails` — menolak bila `submitted`/`approved`), menyalin `estimatedCostIdr`/`estimatedMarginIdr`/`currency`/`serviceBreakdown` (dihitung dari `lineItems` × `travelerCount`) ke Quotation, menyetel `Quotation.costSheetId` (field baru, aditif) untuk traceability, lalu MENGUNCI Cost Sheet (`status: 'final'`) — `updateCostSheet` menolak edit lebih lanjut begitu status `final`, revisi wajib lewat "Duplicate as New Version". Mencatat `PartyActivity` (reuse tab Activity/Follow-up existing).

**Internal costing tidak terlihat Client** — dikonfirmasi lewat grep audit: `CostSheet`/`ProductTemplate`/`~/data` import terkait tidak muncul di `app/pages/client/**` mana pun. Field yang disalin ke Quotation (`estimatedCostIdr`/`estimatedMarginIdr`) sudah termasuk daftar field yang disaring Client Portal sejak D-065 (Section 08) — tidak perlu perubahan tambahan pada 3 halaman Client Portal.

**Fixture** (`app/data/products.ts`, baru) — `PRD-001`/`PRD-002` (Manila/Abu Dhabi, `active`), `PRD-003` (Palu, `draft`). `CS-001`/`CS-002` — Cost Sheet historis SUDAH `applied` ke `QUO-001`/`QUO-002` (Opportunity Won), mendemokan snapshot nyata. `CS-005` — Cost Sheet baseline berdiri sendiri (tanpa `opportunityId`). `CS-003`/`CS-004` ("Economy"/"Premium Scenario") — melekat pada `OPP-009` (belum punya Quotation), demo hidup scenario comparison + tombol Apply to Quotation yang benar-benar fungsional.

## 6. Routes

4 route baru: `/product-planning` (list Product Template), `/product-planning/[id]` (detail Product Template), `/product-planning/cost-sheets` (list Cost Sheet), `/product-planning/cost-sheets/[id]` (detail Cost Sheet). Tidak ada route existing yang di-rename/dihapus. `/crm/opportunities/[id]` diperkaya (SectionCard baru, route sama).

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/product.ts`
- `app/data/products.ts`
- `app/pages/product-planning/index.vue`
- `app/pages/product-planning/[id]/index.vue`
- `app/pages/product-planning/cost-sheets/index.vue`
- `app/pages/product-planning/cost-sheets/[id]/index.vue`
- `docs/mockup-section-reports/section-10-product-planning-costing.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`ModuleKey` +`product-planning`)
- `app/types/opportunity.ts` (`Quotation` +`costSheetId?`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `product-planning` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Product Planning", 2 sub-item, +icon `Package`)
- `app/data/index.ts` (+`getProductTemplateById`, `+getCostSheetById`, `+getCostSheetsByOpportunity`, `+getCostSheetsByProduct`, `+getCostSheetBreakdown`, `+createProductTemplate`, `+updateProductTemplate`, `+getProductTemplateStatusTransitions`, `+updateProductTemplateStatus`, `+createCostSheet`, `+updateCostSheet`, `+duplicateCostSheetVersion`, `+applyCostSheetToQuotation`)
- `app/pages/crm/opportunities/[id]/index.vue` (+SectionCard "Product Planning & Costing", +import 2 selector, +computed `costSheets`)
- `app/pages/index.vue` (widget Product Planner diperbarui dari placeholder "modul belum tersedia" ke link modul nyata)
- `app/pages/admin/roles.vue` (+1 baris `modules` array, +update teks `ROLE_NOTES['product-planner']`/`['account-executive']`)
- `docs/mockup-design-decisions.md` (+D-067)
- `docs/mockup-change-impact-log.md` (+CI-040)
- `docs/mockup-data-scenarios.md` (+bagian 4m)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 19), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`/`TableEmpty`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogScrollContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Button`, `Input`, `Label`, `useToast`. Tidak ada shared component baru — pola halaman mengikuti persis `/vendors`+`/vendors/[id]` (list+detail) dan "Edit Quotation" (whole-array replace embedded list).

## 9. Types/Constants/Fixtures/Mock State

`+ProductTemplate`/`ProductServiceAlternative`/`CostSheet`/`CostSheetLineItem`/`ProductTemplateStatus`/`CostSheetStatus` (entitas dan type baru, `app/types/product.ts`). `Quotation` +`costSheetId?` (aditif, opsional — seluruh Quotation existing tetap valid tanpa perubahan). `ModuleKey` +`product-planning`. Fixture baru: 3 `ProductTemplate` (`PRD-001`–`003`), 5 `CostSheet` (`CS-001`–`005`) — lihat bagian 5 dan `docs/mockup-data-scenarios.md` bagian 4m. Tidak ada fixture ID lama yang diganti/dihapus/direstrukturisasi.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `Table`/`Dialog`/`SectionCard` existing yang sudah responsive (grid `sm:grid-cols-*` untuk breakdown/inclusions, `DialogScrollContent` untuk form panjang di layar kecil).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('product-planning')` (role tanpa akses modul — mis. `sales`/`ticketing`/`client`/`supplier`).
- Not-found: `Product Template tidak ditemukan`/`Cost Sheet tidak ditemukan` (pola identik `/vendors/[id]`) untuk ID yang tidak ada di fixture.
- Empty state: "Belum ada Product Template"/"Belum ada Cost Sheet" (list kosong setelah filter), "Belum ada alternatif layanan tercatat"/"Belum ada line item biaya" (detail).
- Locked state: Cost Sheet `status: 'final'` menyembunyikan tombol "Edit Cost Sheet" dan "Apply to Quotation" (guard `v-if`), menampilkan banner info snapshot dengan tanggal + link Quotation.
- Tombol aksi (Buat/Edit/Duplicate/Apply) seluruhnya digerbangi `canManage('product-planning')` — role `VIEW` (AE/Operations/Finance/PM/Management/Viewer) melihat read-only.

## 12. Role Behavior

`canManage('product-planning')` — level modul standar (RANK-based, `usePermissions`), TIDAK butuh narrow-role-exception tambahan karena hanya `product-planner` dan `super-admin` yang mencapai rank `MANAGE`/`ADMIN` (pola sama `vendor` module, D-030). `product-planner`: `MANAGE` (kelola penuh katalog dan cost sheet). `account-executive`/`operations`/`finance`/`project-manager`/`management`/`viewer`: `VIEW` (baca-saja, kolaborasi — literal Wajib eksplisit menyebut AE/Operations/Finance). `sales`/`ticketing`/`accommodation`/`transportation`/`mice`/`procurement`/`client`/`supplier`: `NONE`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run — run kedua setelah menambah widget Dashboard dan kolom Matrix Role).
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 10 section berturut-turut).
- `npm run lint` — tidak tersedia (`Missing script: "lint"`, Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing, bukan regresi).
- **Smoke test HTTP** — `/product-planning`, `/product-planning/PRD-001`, `/product-planning/PRD-999` (not-found), `/product-planning/cost-sheets`, `/product-planning/cost-sheets/CS-001`, `/product-planning/cost-sheets/CS-003`, `/product-planning/cost-sheets/CS-005`, `/product-planning/cost-sheets/CS-999` (not-found), `/crm/opportunities/OPP-001`, `/crm/opportunities/OPP-009`, `/admin/roles`, plus regresi `/`, `/crm/opportunities`, `/vendors`, `/finance`, `/admin`, `/settings` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/product-planning/PRD-001` menampilkan nama template, 2 service alternative ("Ekonomi — Maskapai Budget"/"Ekonomi — Maskapai Full Service") dan badge "Direkomendasikan".
  - `/product-planning/cost-sheets/CS-003` (Economy Scenario, draft, link ke `OPP-009`) — breakdown dihitung ulang manual dan cocok PERSIS: base cost Rp216.250.000 → contingency 5% Rp10.812.500 → Rp227.062.500 → markup 12% Rp27.247.500 → Rp254.310.000 → tax 5% Rp12.715.500 → **total sell Rp267.025.500**, margin Rp39.963.000. Tombol "Apply to Quotation" dan "Duplicate as New Version" tampil aktif.
  - `/product-planning/cost-sheets/CS-001` (applied/final) menampilkan badge "Final (Locked)" + pesan snapshot ("sudah diterapkan (snapshot) ke...") — tombol "Edit Cost Sheet" dan "Apply to Quotation" dikonfirmasi TIDAK tampil (locked).
  - `/product-planning/cost-sheets/CS-005` (standalone, tanpa Opportunity) menampilkan tombol "Edit Cost Sheet"+"Duplicate as New Version" TAPI TIDAK "Apply to Quotation" (guard `opportunityId` bekerja benar).
  - `/crm/opportunities/OPP-009` menampilkan SectionCard "Product Planning & Costing" berisi kedua skenario ("Economy Scenario"/"Premium Scenario").
  - `/admin/roles` menampilkan kolom "Product Planning" baru di Matrix Role.
- **Verifikasi interaktif** (klik Apply to Quotation, Duplicate as New Version, toggle scenario/version compare, ganti role ke Product Planner) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat code review ketat terhadap seluruh guard mutator baru (`updateCostSheet` menolak edit bila `final`, `applyCostSheetToQuotation` menolak bila Quotation sudah `submitted`/`approved`) dan smoke test SSR konten yang membuktikan kalkulasi + locking + guard bekerja benar untuk 3 kondisi berbeda (applied/standalone/live-scenario).

## 14. Regression

`app/pages/crm/opportunities/[id]/index.vue` (dimiliki Section 05/06/08 — SectionCard baru ditambahkan sebelum SectionCard Quotation, tidak ada yang dihapus/diubah). `app/pages/index.vue` (dimiliki Section 06/02 — hanya widget `showProductPlannerWelcome` yang diubah isinya, widget role lain tidak disentuh). `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya menambah 1 baris array + 2 teks catatan, kolom/baris existing tidak berubah). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `'product-planning'`, nilai existing untuk 7 modul lain di setiap baris TIDAK diubah). Regression checks (smoke test HTTP+konten) mengonfirmasi seluruh route representatif lintas modul (CRM/Customer Journey/Client Portal/Vendors/Finance/Reports/Admin/Settings) tetap berperilaku identik.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-040 — `Quotation.costSheetId` aditif (dimiliki Section 05/08), SectionCard ringkasan Cost Sheet di Opportunity Detail (dimiliki Section 05/08), widget Dashboard Product Planner diperbarui (dimiliki Section 02, CI-030), kolom Matrix Role `/admin/roles` diperbarui (dimiliki Section 17 lama/Section 02) — seluruhnya aditif, regression-tested.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 10 section berturut-turut.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06 lama).
- Currency tetap mock IDR-sentris (D-006, konsisten `Quotation.currency` sejak Section 05) — field `currency` ada di kedua entitas baru tapi tidak ada konversi kurs nyata.
- Total sell hasil kalkulasi Cost Sheet historis (`CS-001`/`CS-002`) tidak dipaksa sama persis dengan `Quotation.amountIdr` — variance kecil disengaja (merefleksikan negosiasi AE), didokumentasikan eksplisit di komentar `app/data/products.ts` dan `docs/mockup-data-scenarios.md` bagian 4m, bukan bug data.

## 17. Protection Notes untuk Section Berikutnya

`ProductTemplate`/`CostSheet` (D-067) — entitas TERPISAH dari `Quotation`, jangan digabung/direstrukturisasi. Cost Sheet yang sudah `status: 'final'` (`appliedToQuotationId` terisi) TIDAK boleh diedit langsung — `updateCostSheet` sudah menolaknya; revisi wajib lewat `duplicateCostSheetVersion`. `getCostSheetBreakdown` TETAP derivasi murni — jangan tambahkan field total/margin tersimpan yang berisiko stale. `CostSheet`/`ProductTemplate` TIDAK BOLEH diimpor di `app/pages/client/**` apa pun alasannya (internal costing tidak boleh terlihat Client, literal Wajib). `Quotation.costSheetId` bersifat aditif dan opsional — jangan jadikan field ini wajib/blocking pada alur Quotation manapun yang tidak melalui Cost Sheet.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/product-planning` untuk katalog Product Template, `http://localhost:8080/product-planning/cost-sheets/CS-003` untuk mencoba "Apply to Quotation" (sebagai Product Planner atau Super Admin, default demo role) pada skenario `OPP-009` yang belum punya Quotation. Buka `http://localhost:8080/product-planning/cost-sheets/CS-001` untuk melihat Cost Sheet yang sudah terkunci (final/applied). Buka `http://localhost:8080/crm/opportunities/OPP-009` untuk melihat titik kolaborasi ringkasan Cost Sheet di Opportunity Detail.

## 19. Recommended Next Section

**Section 11 — Traveler dan Travel Documents** (tracking visa/tiket/asuransi — saat ini `Traveler` hanya punya `passportNumber`/`passportExpiryDate`, status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
