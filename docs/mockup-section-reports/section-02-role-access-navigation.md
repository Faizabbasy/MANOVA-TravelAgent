# Section Report — Section 02: Role, Access dan Navigation

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/Section 02 — Role, Access dan Navigation.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user. Section ketiga roadmap Section 00–24 baru, dijalankan setelah Section 01 (Frontend Foundation dan State Governance, COMPLETED).

---

## 1. Section Objective dan Scope

"Finalisasikan role dan navigation frontend" — 16 role final (Super Admin, Management, Sales, Account Executive, Product Planner, Project Manager, Operations, Ticketing, Accommodation, Transportation, MICE, Procurement, Finance, Viewer/Auditor, Client, Supplier). Wajib: role switcher mock, navigation per role, route guards frontend, data scope Client dan Supplier per company, unauthorized states, Super Admin bukan commercial approver normal, Management commercial approval, AE quotation dan Won setelah approved, Sales Lead/qualification, Client portal, Supplier portal, matrix view untuk review permission. Acceptance: setiap role melihat menu dan data yang sesuai; Supplier PT ABC tidak melihat PT EFG; Client A tidak melihat Client B.

## 2. Source Documents yang Dibaca

`prompts/Section 02 — Role, Access dan Navigation.md`, `prompts/01-PROTOKOL-WAJIB.md`, `prompts/99-RUN-CURRENT-SECTION.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/route-and-role-matrix.md`, `docs/mockup-section-reports/section-00-*.md`/`section-01-*.md`, source code aktual (`app/types/user.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/composables/usePermissions.ts`, `app/composables/useCurrentUser.ts`, `app/middleware/auth.ts`, `app/components/shared/RoleAccessState.vue`, `app/pages/admin/roles.vue`, `app/pages/vendors/index.vue`, `app/pages/supplier/index.vue`, `app/pages/index.vue`), `git status`.

## 3. Existing Implementation yang Diperiksa

Audit mengonfirmasi fondasi role/access SUDAH matang sejak Prompt 5–19: `useCurrentUser()` (role switcher generik berbasis `USERS`, tidak butuh perubahan untuk role baru), `usePermissions()` (`canView`/`canManage`/`canApprove`/`vendorScopeId`), pola narrow-role-exception per halaman, `RoleAccessState.vue` (unauthorized state generik), `NavItem.roles` override (nav-level gating), dan **Matrix View literal SUDAH ADA** di `/admin/roles` (grid `ROLE_MODULE_ACCESS` per role x modul, dibangun Section 17 lama) — bukan gap yang perlu dibangun dari nol seperti sempat diduga di audit Section 00. Ditemukan 3 gap konkret: (1) 3 role dari Role Final belum ada di `RoleId` (`client`/`product-planner`/`procurement`); (2) Matrix View existing hanya menampilkan 6 dari 7 `ModuleKey` (kolom `supplier-portal` tidak pernah ditambahkan sejak Prompt 19 — gap pre-existing); (3) **Dashboard (`/`) tidak memiliki satu widget pun untuk 3 role baru** — seluruh `visibleTo(...)` existing eksplisit tidak menyertakan mereka, akan menghasilkan halaman kosong total bila role ditambahkan tanpa perbaikan ini.

## 4. Decisions yang Digunakan

D-059 (`docs/mockup-design-decisions.md`, baru) — 3 role baru (mengikuti pola D-046), `client-portal` module (pola identik D-048), Client Portal shell MINIMAL (bukan implementasi penuh — konsisten D-058), Procurement sebagai owner fungsional modul Vendor.

## 5. Role Behavior (Ringkasan per Role Baru)

- **Product Planner / Travel Consultant** — `crm`/`project`/`vendor`/`reports`: `VIEW`. Melihat Opportunity/Project/Vendor sebagai referensi costing. Tidak ada modul dedicated sampai Section 10 — Dashboard menampilkan card "Referensi Costing" yang mengarahkan ke `/crm/opportunities`.
- **Procurement / Vendor Management** — `vendor`: `MANAGE` (satu-satunya role non-Super-Admin dengan akses tulis direktori vendor — tombol "Tambah Vendor" di `/vendors` kini aktif untuk Procurement). `project`/`reports`: `VIEW`. Dashboard menampilkan card "Vendor Management" mengarah ke `/vendors`.
- **Client** — seluruh modul internal `NONE`, `client-portal`: `MANAGE`. Login sebagai Client (`USR-019`/`USR-020`) menampilkan nav "Client Portal" (`/client`) sebagai satu-satunya area kerja, diisolasi per `clientPartyId`. Dashboard utama (`/`) menampilkan card "Client Portal" yang mengarahkan ke portal mereka (data internal MANOVA tetap tidak relevan/tidak bocor).
- **Super Admin** — `client-portal`: `ADMIN` (oversight, konsisten pola `supplier-portal` — mengunjungi `/client` tanpa `clientPartyId` tetap menampilkan `RoleAccessState`, tidak bocor data company manapun; dikonfirmasi via smoke test).

## 6. Client Portal (Shell Minimal — Section 02) vs Section 08

`/client` (baru) menampilkan: profil company (nama/kota/telepon), daftar Opportunity (title/destinasi/stage — TANPA `estimatedValueIdr`), daftar Project Order (nama/destinasi/tanggal/status — TANPA budget/actual/margin). Sengaja **tidak** mengimplementasikan quotation confirm, document center, traveler submission, communication, atau invoice status — seluruhnya tetap scope Section 08. Larangan protokol "Jangan menampilkan internal cost/margin kepada Client" dipatuhi dengan mengecualikan seluruh field nilai uang dari shell ini.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/pages/client/index.vue`
- `docs/mockup-section-reports/section-02-role-access-navigation.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`RoleId` +3, `ModuleKey` +`client-portal`, `User.clientPartyId`)
- `app/constants/roles.ts` (`ROLES` +3, `ROLE_MODULE_ACCESS` +3 baris +1 kolom)
- `app/composables/usePermissions.ts` (+`clientScopeId`)
- `app/data/users.ts` (+`USR-017`–`USR-020`)
- `app/constants/navigation.ts` (+nav "Client Portal", +import icon `Users`)
- `app/pages/admin/roles.vue` (`modules` +2, `ROLE_NOTES` +5)
- `app/pages/index.vue` (Dashboard: +3 `computed` visibility, +3 `SectionCard` welcome)
- `docs/mockup-design-decisions.md` (+D-059)
- `docs/mockup-open-questions.md` (Q13 → RESOLVED)
- `docs/mockup-change-impact-log.md` (+CI-030, +CI-031)
- `docs/frontend-module-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md`, `docs/mockup-section-progress.md`
- `docs/route-and-role-matrix.md` (addendum bagian 5, aditif)
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `RoleAccessState`, `StatsCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`. Tidak ada shared component baru — mengikuti pola `/supplier/index.vue` persis untuk `/client/index.vue`.

## 9. Types/Constants/Fixtures/Mock State

`RoleId` 13→16 nilai, `ModuleKey` 7→8 nilai, `User.clientPartyId?: ID` (field baru, opsional, backward-compatible). `ROLE_MODULE_ACCESS` — 13 baris lama nilainya TIDAK diubah, murni ekstensi 3 baris + 1 kolom. 4 `USER` baru dengan ID berurutan (`USR-017`–`USR-020`), 2 di antaranya (`USR-019`/`USR-020`) sengaja memakai nama yang sama dengan `ContactPerson` existing (`CP-001`/`CP-002`) di company yang sama — konsistensi narasi yang kebetulan cocok, dipertahankan.

## 10. Responsive Behavior

Tidak berubah — `/client` memakai layout/grid pattern yang identik dengan `/supplier` (sudah responsive).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `/client`: `RoleAccessState` bila `!canView('client-portal') || !party` (role selain Client, atau Client tanpa `clientPartyId` valid) — dikonfirmasi via smoke test (default Super Admin menampilkan "Anda tidak memiliki akses").
- `/client`: `EmptyState` terpisah untuk daftar Opportunity kosong dan Project Order kosong.
- Dashboard: 3 `SectionCard` welcome baru murni bersyarat (`v-if`), tidak memengaruhi state widget role lain.

## 12. Role Behavior (Verifikasi Acceptance)

- **"Setiap role melihat menu dan data yang sesuai"** — dikonfirmasi: nav `NavItem.moduleKey`/`roles` otomatis menampilkan/menyembunyikan item sesuai `ROLE_MODULE_ACCESS` baru; Dashboard tidak lagi kosong untuk role manapun (16/16 role punya widget/card).
- **"Supplier PT ABC tidak melihat PT EFG"** — tidak berubah dari Prompt 19 (`vendorScopeId`), diverifikasi ulang tidak beregresi.
- **"Client A tidak melihat Client B"** — mekanisme baru `clientScopeId` (pola identik `vendorScopeId`, terverifikasi via code review: `getPartyById`/`getOpportunitiesByParty`/`getProjectsByParty` seluruhnya difilter exact-match `partyId`, tidak pernah membaca `PARTIES`/`OPPORTUNITIES`/`PROJECTS` penuh) — 2 demo user (`USR-019`→`PTY-001`, `USR-020`→`PTY-002`) tersedia untuk verifikasi interaktif oleh user.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses** (dijalankan 2x, setelah penambahan role dan setelah fix Dashboard).
- `npm run build` — **sukses** (2x run), chunk `client-*` baru ter-compile.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- **Smoke test HTTP** — 30 route (baru + existing representatif, termasuk seluruh route Prompt 19/20 dan Section 00/01) — **seluruhnya HTTP 200**.
- **Smoke test konten:**
  - `/client` (default Super Admin, tanpa `clientPartyId`) → "Anda tidak memiliki akses" (isolasi bekerja).
  - `/admin/roles` → label "Client Portal"/"Supplier Portal"/"Product Planner"/"Procurement" tampil di Matrix View.
  - `/admin/users` → 4 user baru (`Teguh Santosa`/`Wulan Kartika`/`Hendra Wijaya`/`Sarah Amelia`) tampil otomatis tanpa perubahan kode halaman tsb.
  - `/` (Dashboard) → tidak ada string error, build size widget baru terkonfirmasi ter-render server-side.
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined"/"Cannot read propert(y|ies)" di HTML manapun yang diuji.
- **Verifikasi interaktif** (ganti role live ke Client A vs Client B, Procurement menambah vendor, Product Planner menjelajah nav) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat code review ketat terhadap `clientScopeId`/`ROLE_MODULE_ACCESS`/nav `roles` override, dan smoke test SSR konten di atas.

## 14. Regression

Section 06 lama (Dashboard) dan Section 17 lama (Administration/Matrix View) disentuh secara aditif murni (CI-030/CI-031) — diverifikasi 30 route existing representatif tetap HTTP 200 tanpa perubahan konten yang tidak diharapkan. Prompt 19 (Supplier isolation) dan Prompt 20 (Sales/AE/Commercial Approval/Mark as Won) tidak disentuh sama sekali — seluruh route terkait tetap 200.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-030 (Dashboard `app/pages/index.vue`, milik Section 06 lama) dan CI-031 (Matrix View `app/pages/admin/roles.vue`, milik Section 17 lama) — keduanya perbaikan gap pre-existing yang ditemukan selama audit Section 02, bukan regresi baru, dan bersifat 100% aditif (0 baris existing dihapus/diubah).

## 16. Known Issues dan Deferred Work

- Q13 **RESOLVED**. Q14 (approval queue/client confirmation, Section 06), Q15 (public lead intake, Section 03), Q16 (taksonomi status Project Order, Section 09) tetap terbuka — bukan scope Section 02.
- Fitur bisnis penuh Client Portal (quotation confirm, document, traveler submission, communication, invoice status) tetap tanggung jawab Section 08 — shell Section 02 sengaja minimal.
- RFQ formal/Service Order Procurement tetap tanggung jawab Section 17 — Section 02 hanya menyiapkan role + akses `vendor: MANAGE`.
- Modul Product Planning/Costing dedicated tetap tanggung jawab Section 10 — Section 02 hanya menyiapkan role + akses VIEW read-only.
- Q8 (tooling) tetap terbuka, tidak berubah.

## 17. Protection Notes untuk Section Berikutnya

- Section 08 (Client Portal) WAJIB reuse `clientScopeId`/`getPartyById`/`getOpportunitiesByParty`/`getProjectsByParty` yang sudah ada di `/client/index.vue` — jangan membuat mekanisme isolasi paralel.
- Section 10/17 WAJIB reuse `ROLE_MODULE_ACCESS.product-planner`/`ROLE_MODULE_ACCESS.procurement` yang sudah di-set Section 02 — hanya perlu menambah halaman/fitur, bukan mengubah level akses modul dasar (kecuali ditemukan kebutuhan nyata, dicatat sebagai CI baru).
- `ROLE_MODULE_ACCESS` (16 role x 8 modul) dan `NavItem.roles` — LOCKED, jangan direstrukturisasi; section berikutnya menambah baris/kolom secara aditif mengikuti pola D-046/D-048/D-059.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/settings` → ganti role ke "Teguh Santosa" (Product Planner) / "Wulan Kartika" (Procurement) / "Hendra Wijaya" (Client PT Cipta Distribusi Nusantara) / "Sarah Amelia" (Client PT Alam Raya Group) untuk memverifikasi Dashboard tidak kosong dan `/client` menampilkan data ter-isolasi per company. Bandingkan `/admin/roles` sebelum/sesudah untuk melihat Matrix View lengkap.

## 19. Recommended Next Section

**Section 03 — Public Lead Intake**, berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
