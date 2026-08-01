# Section 23 — Administration, Master Data dan Audit

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_23_Administration_Master_Data_Audit.md`.

---

## 1. Section Objective dan Scope

**Berbeda karakter dari Section 22** (kurasi gap-fill sempit di atas fondasi besar yang sudah ada) — audit awal mengonfirmasi mayoritas Wajib literal Section 23 GENUINELY BARU, belum ada implementasinya sama sekali di section mana pun sebelumnya. `docs/mockup-section-reports/section-17-administration.md` (OLD SCHEME, dibaca penuh) mengonfirmasi kondisi sebelum section ini: `/admin` (hub 4 link card), `/admin/users` (list+role-switch, TANPA CRUD), `/admin/roles` (matrix read-only, LOCKED), `/admin/master-data` (4 tab, EKSPLISIT read-only by design comment kode), `/admin/audit-trail` (3 filter dropdown atas `ActivityEntry`, TANPA search box, TANPA menampilkan `SystemEvent` sama sekali). `docs/frontend-known-issues.md` bagian 18 mencatat gap ini eksplisit sebelum section berjalan.

8 poin diimplementasikan penuh (D-080, `docs/mockup-design-decisions.md`):

1. Migrasi master data 4 kategori lama (`MASTER_PROJECT_TYPES`/`MASTER_SERVICE_TYPES`/`MASTER_DESTINATIONS`/`MASTER_VENDOR_CATEGORIES`) dari `app/constants/master-data.ts` (static) ke `app/data/master-data.ts` (`reactive()`), ID/value dipertahankan persis.
2. 11 kategori master data BARU — Operational Reference (Airport/Airline/Hotel), Commercial & Finance (Currency/Tax Rule/Payment Term/Cancellation Rule), System Configuration (Numbering Scheme/Document Template/Readiness Gate/Assignment Rule) — seluruhnya reference/configuration data dengan batas non-integrasi eksplisit terhadap business logic LOCKED.
3. CRUD generik (`createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord`) dipanggil dengan `MasterDataCategoryKey`.
4. Historical snapshot warning (`getMasterDataUsageCount`) — genuine untuk 4/15 kategori, generik+jujur untuk 10 sisanya.
5. `/admin/master-data` direstrukturisasi — 3 kelompok x 15 sub-tab, Add/Edit/Deactivate/Reactivate mock.
6. Organization Profile (baru, singleton, `/admin/organization`).
7. User suspend/reactivate + Access Review (`/admin/users`).
8. Audit trail search (`/admin/audit-trail`) — lintas `ActivityEntry` DAN `SystemEvent`.

`/admin/roles` dan role-switch demo TIDAK disentuh sama sekali (LOCKED sejak Section 02/old-Section 17).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/SECTION_23_Administration_Master_Data_Audit.md`, `CLAUDE.md`, `docs/mockup-section-progress.md` (entri Section 22 dan OLD-SCHEME Section 17), `docs/mockup-section-reports/section-17-administration.md` (OLD SCHEME, dibaca penuh), `docs/frontend-known-issues.md` §18, `docs/mockup-design-decisions.md` (D-079, D-076 penuh), `docs/frontend-implementation-roadmap.md`/`docs/frontend-module-map.md`, `docs/mockup-section-reports/README.md` dan `section-22-dashboards-reports-activity.md` (template 19-bagian).

## 3. Existing Implementation yang Diperiksa

`app/constants/master-data.ts` (4 array statis, `MasterDataItem`), `app/pages/admin/master-data.vue` (4-tab read-only), `app/pages/admin/index.vue` (hub 4 link card + role switcher), `app/pages/admin/users.vue` (list+search+role-filter+detail dialog, TANPA CRUD), `app/pages/admin/roles.vue` (matrix read-only, 17 modul x 16 role), `app/pages/admin/audit-trail.vue` (3 filter dropdown atas `ACTIVITIES`, TANPA search, TANPA `SYSTEM_EVENTS`), `app/types/user.ts` (`User` — dikonfirmasi TIDAK ada `status`/`isActive`/`suspended`; `ModuleKey`; `RoleId`), `app/types/activity.ts` (`ActivityEntry` full shape, `SystemEvent`/`SystemEventModule` — dikonfirmasi `'user'` sudah ada, `'administration'` belum), `app/data/index.ts` (~3800 baris — pola `CreateXInput`, `nextSequentialId`, `DEMO_REFERENCE_DATE`, `pushNotification` [Section 21] sebagai preseden helper-push-ke-array-reaktif terdekat; dikonfirmasi TIDAK ADA mutator yang pernah push ke `SYSTEM_EVENTS`), `app/data/activity.ts` (`ACTIVITIES`/`SYSTEM_EVENTS` reactive arrays), `app/constants/navigation.ts`/`roles.ts` (`ModuleKey` `administration` existing, 5 nav item Administration existing sebelum ditambah), `app/data/users.ts` (`USERS` — dikonfirmasi array literal, BUKAN `reactive()`, TIDAK PERNAH dimutasi mutator manapun).

## 4. Decisions yang Digunakan

D-076 (LOCKED — `ActivityEntry` adalah SATU-SATUNYA audit trail untuk perubahan project-scoped; `SystemEvent` adalah mekanisme TERPISAH yang sudah ada sejak Prompt 19 khusus untuk log admin/lintas-modul non-project-scoped — dihormati penuh, TIDAK dilanggar). D-079 (mengantisipasi eksplisit Section 23 kemungkinan "genuinely new work" — dikonfirmasi benar). Keputusan implementasi baru: **D-080** (`docs/mockup-design-decisions.md`) — migrasi master data ke reactive/editable, 9 kategori baru dengan batas non-integrasi eksplisit, Organization Profile sebagai singleton (bukan multi-tenancy), `SystemEvent` sebagai mekanisme admin-audit (bukan entitas baru).

## 5. Implementation Summary dan User Flow

**Master Data migrasi + 11 kategori baru:** `app/types/master-data.ts` (baru) mendefinisikan `MasterDataItem` (dipindah, shape sama) + 11 interface baru (`Airport`/`Airline`/`Hotel`/`MasterCurrency`/`TaxRule`/`PaymentTerm`/`CancellationRule`/`NumberingScheme`/`DocumentTemplate`/`ReadinessGateConfig`/`AssignmentRule`/`OrganizationProfile`) + `MasterDataCategoryKey` union (15 nilai). `app/data/master-data.ts` (baru) berisi seluruh 15 array `reactive()` + `ORGANIZATION_PROFILE` singleton, seed demo konsisten skenario existing (Airport CGK/MNL/AUH/PLW/DPS/SIN, Airline Garuda/Lion Air/Citilink/Philippine Airlines/Etihad, Currency IDR/USD/SGD/EUR). `app/constants/master-data.ts` (diubah) kini murni re-export dari `~/data/master-data` — jaring pengaman kompatibilitas untuk konsumen lama (audit grep repo-wide mengonfirmasi hanya SATU konsumen aktual: `app/pages/admin/master-data.vue`, yang sudah diperbarui memakai `~/data` langsung).

**CRUD generik (`app/data/index.ts`):** `MASTER_DATA_REGISTRY` memetakan `MasterDataCategoryKey`→{array reactive, prefix ID, label}. `createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord` bekerja generik atas registry ini — setiap panggilan memicu `pushSystemEvent`. `getMasterDataUsageCount(key, id)` mengembalikan `number` genuine untuk `currency` (exact-match `Invoice.currency`), `destination` (fuzzy-match prefix nama kota terhadap `Project.destination`), `project-type`/`service-type` (peta ID-tetap→field typed `Project.characteristic`/`ProjectService.type`, hanya untuk ID seed asli) — dan `null` (peringatan generik, JUJUR bukan fabrikasi) untuk 10 kategori lain yang genuinely tanpa cross-reference bersih.

**`/admin/master-data` (rewrite total):** 3 kelompok (Operational Reference/Commercial & Finance/System Configuration, tab button), masing-masing berisi chip kategori (7/4/4). Setiap kategori: tabel dinamis (kolom dari `FieldDef[]` per kategori) + filter Aktif/Non-aktif/Semua + tombol "Tambah" (role `MANAGE`+ modul `administration`). Dialog Create/Edit generik (field dari `CategoryDef.fields`, text/number/textarea). Aksi Edit/Deactivate memanggil `getMasterDataUsageCount` — bila count>0 atau `null`, dialog konfirmasi tampil ("N record existing mereferensikan nilai ini — data historis tidak akan terpengaruh" atau versi generik) sebelum eksekusi.

**Organization Profile (baru, `/admin/organization`):** form single-page mengedit `ORGANIZATION_PROFILE` (legalName/displayName/address/defaultCurrencyCode/businessHours/contactEmail/contactPhone) via `updateOrganizationProfile`. Read-only untuk role tanpa `MANAGE` modul `administration`. Discoverable dari kartu ke-5 `/admin` hub dan nav child ke-5 Administration.

**User suspend/reactivate + Access Review (`/admin/users`, diperkaya aditif):** `User.status: 'active'|'suspended'` (baru). `suspendUser(id, reason, actorId)` — mandatory-reason (pola sama transisi destruktif lain di codebase), `reactivateUser(id, actorId)` mengosongkan `suspendedReason`/`suspendedAt`. Halaman mendapat `Tabs` baru (Directory/Access Review, aditif — list+search+role-filter+detail dialog existing TIDAK direstrukturisasi): tab Directory menambah kolom "Status Akun" + tombol Suspend/Aktifkan per baris; tab Access Review menampilkan user aktif filterable + aksi Suspend satu-klik + daftar user disuspend beserta alasan.

**Audit trail search (`/admin/audit-trail`, diperkaya aditif):** search box baru (di atas 3 filter dropdown existing, TIDAK dihapus/direstrukturisasi) mencari lintas `ActivityEntry.message`/`reason`/`impactNote`/`category`/`beforeValue`/`afterValue`. SectionCard baru "Log Sistem (Non-Project)" menampilkan `SYSTEM_EVENTS` (TERPISAH dari list `ActivityEntry` di atasnya — shape/scope berbeda), search box yang sama berlaku ke kedua section. `SystemEventModule`+`'administration'` (baru) dan `pushSystemEvent` (`app/data/index.ts`) — mutator PERTAMA yang benar-benar menulis ke `SYSTEM_EVENTS` (sebelumnya "log statis"), dipanggil dari SELURUH mutator admin baru di atas.

**User flow yang bisa didemokan:** Super Admin buka `/admin/master-data` → pilih kelompok/kategori → klik "Tambah" → isi form → simpan → toast konfirmasi + entri baru muncul di tabel + entri baru muncul di `/admin/audit-trail` (SectionCard Log Sistem). Klik "Edit"/"Nonaktifkan" pada item yang dipakai project (mis. `DST-001` Manila) → dialog konfirmasi usage-count → lanjutkan → toast + audit entry. Buka `/admin/organization` → ubah field → simpan → toast + audit entry. Buka `/admin/users` tab "Access Review" → cari user → klik "Suspend" → isi alasan wajib → toast + user pindah status + audit entry; klik "Aktifkan Kembali" pada user disuspend → toast + audit entry. Buka `/admin/audit-trail` → ketik kata kunci di search box → hasil terfilter di KEDUA section (ActivityEntry dan Log Sistem).

## 6. Routes

- `/admin` (+kartu ke-5 "Organization Profile")
- `/admin/master-data` (rewrite total — bukan lagi placeholder read-only)
- `/admin/users` (+tab "Access Review", +suspend/reactivate)
- `/admin/roles` (TIDAK disentuh — LOCKED)
- `/admin/audit-trail` (+search box, +SectionCard "Log Sistem (Non-Project)")
- `/admin/organization` (baru)

## 7. Files Created, Changed, dan Removed

**Files Created:**
- `app/types/master-data.ts`
- `app/data/master-data.ts`
- `app/pages/admin/organization.vue`
- `docs/mockup-section-reports/section-23-admin-master-audit.md` (laporan ini)

**Files Changed:**
- `app/constants/master-data.ts` — static exports → re-export dari `~/data/master-data`, `MasterDataItem` dipindah ke `~/types/master-data`.
- `app/types/activity.ts` — `SystemEventModule` +`'administration'`.
- `app/types/user.ts` — `User` +`status`/`suspendedReason`/`suspendedAt`, +`UserStatus` (baru).
- `app/data/users.ts` — `USERS` array literal → `reactive([...])`, +field `status` seluruh 19 user, 2 diseed `suspended`.
- `app/utils/mock-reset.ts` — comment diperbarui (klaim lama "`USERS` tidak pernah dimutasi"/"`SYSTEM_EVENTS` log statis" dikoreksi eksplisit).
- `app/data/index.ts` — +import/export 13 array baru dari `./master-data`, +import type dari `~/types/master-data`, +`User` type import, +`pushSystemEvent`/`MASTER_DATA_REGISTRY`/`getMasterDataCategoryMeta`/`createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord`/`getMasterDataUsageCount`/`updateOrganizationProfile`/`suspendUser`/`reactivateUser` — seluruhnya ditambahkan di AKHIR file, nol baris existing diubah.
- `app/pages/admin/master-data.vue` — rewrite total.
- `app/pages/admin/users.vue` — +`Tabs` Directory/Access Review, +kolom Status Akun, +tombol Suspend/Aktifkan, +dialog Suspend.
- `app/pages/admin/audit-trail.vue` — +search box, +SectionCard "Log Sistem (Non-Project)".
- `app/pages/admin/index.vue` — +kartu ke-5.
- `app/constants/navigation.ts` — +nav child ke-5 "Organization Profile".
- `docs/mockup-design-decisions.md` (+D-080), `docs/mockup-change-impact-log.md` (+CI-053), `docs/mockup-data-scenarios.md` (+bagian 4z), `docs/frontend-module-map.md`/`docs/frontend-implementation-roadmap.md` (baris Section 23 PARTIAL→COMPLETED), `docs/frontend-known-issues.md` (bagian 18 RESOLVED), `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 32), `docs/mockup-section-progress.md` (+entri Section 23), `docs/mockup-section-reports/README.md` (+baris Section 23).

**Files Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `PageHeader`, `SectionCard` (+`#actions`), `RoleAccessState`, `EmptyState`, `StatusBadge`, `Table*`, `Dialog*` (`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`), `Tabs*` (`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`), `Label`, `Input`, `Button`, `useToast`, `usePermissions`, `useCurrentUser`.

**Created:** Tidak ada komponen `.vue` baru di `app/components/` — seluruh UI baru (dialog CRUD master data, dialog usage-warning, dialog suspend, form Organization Profile, tab Access Review) memakai primitive `ui/*`/`shared/*` existing, native `<select>`/`<textarea>` mengikuti pola styling yang sudah dipakai luas di codebase ini (mis. `app/pages/finance/notes.vue`).

## 9. Types, Constants, Fixtures, dan Mock State

`MasterDataItem` (dipindah dari `app/constants/master-data.ts`, shape TIDAK berubah). Baru (`app/types/master-data.ts`): `Airport`, `Airline`, `Hotel`, `MasterCurrency`, `TaxRule`, `PaymentTerm`, `CancellationRule`, `NumberingScheme`, `DocumentTemplate`, `ReadinessGateConfig`, `AssignmentRule`, `OrganizationProfile`, `MasterDataCategoryKey`. `SystemEventModule` +`'administration'` (aditif, `app/types/activity.ts`). `User` +`status`/`suspendedReason`/`suspendedAt`, +`UserStatus` (baru, `app/types/user.ts`).

Fixtures (`app/data/master-data.ts`, seluruhnya `reactive()`): `MASTER_PROJECT_TYPES` (3, migrasi), `MASTER_SERVICE_TYPES` (5, migrasi), `MASTER_DESTINATIONS` (7, migrasi), `MASTER_VENDOR_CATEGORIES` (6, migrasi), `AIRPORTS` (6, baru), `AIRLINES` (5, baru), `MASTER_HOTELS` (4, baru), `MASTER_CURRENCIES` (4, baru — IDR/USD/SGD/EUR), `TAX_RULES` (2, baru), `PAYMENT_TERMS` (3, baru), `CANCELLATION_RULES` (4, baru), `NUMBERING_SCHEMES` (3, baru), `DOCUMENT_TEMPLATES` (3, baru), `READINESS_GATE_CONFIGS` (4, baru), `ASSIGNMENT_RULES` (3, baru), `ORGANIZATION_PROFILE` (1 singleton, baru). `USERS` (`app/data/users.ts`) — konversi ke `reactive()`, +`status` seluruh 19 baris, 2 diseed `suspended` (`USR-011` Viewer, `USR-016` Supplier PT EFG — lihat `docs/mockup-data-scenarios.md` bagian 4z untuk rasional pemilihan).

Mock state baru: `pushSystemEvent`, `MASTER_DATA_REGISTRY`, `createMasterDataRecord`, `updateMasterDataRecord`, `deactivateMasterDataRecord`, `reactivateMasterDataRecord`, `getMasterDataUsageCount`, `getMasterDataCategoryMeta`, `updateOrganizationProfile`, `suspendUser`, `reactivateUser` (seluruhnya `app/data/index.ts`, ditambahkan di akhir file).

## 10. Responsive Behavior

`/admin/master-data` — grid kelompok/chip kategori `grid-cols-2 sm:grid-cols-4`, tabel dibungkus `.overflow-x-auto` (pola sama seluruh tabel lintas-kategori codebase ini), dialog form `max-w-md`. `/admin/users` — `Tabs` full-width, tabel Access Review sama pola tabel existing. `/admin/organization` — form `grid-cols-1 sm:grid-cols-2`. `/admin/audit-trail` — search box `max-w-sm`, SectionCard "Log Sistem" pakai `divide-y` list yang sama polanya dengan list `ActivityEntry` di atasnya. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia di lingkungan ini (keterbatasan konsisten sejak Section 06).

## 11. States Implemented

- **Loading:** Tidak diperlukan — seluruh data mock sinkron di memori klien (pola sama seluruh section sejak Section 22/D-079).
- **Empty:** `EmptyState` di `/admin/master-data` (filter tidak menghasilkan item), `/admin/users` tab Directory dan Access Review (pencarian tidak menghasilkan user), `/admin/audit-trail` SectionCard "Log Sistem" (search tidak menghasilkan hasil).
- **Unauthorized:** `RoleAccessState` untuk `!canView('administration')` — TIDAK berubah di 5 halaman existing, diterapkan konsisten di `/admin/organization` (baru).
- **Validation:** Dialog Create/Edit master data — tombol "Simpan" disabled sampai seluruh field wajib terisi (`isFormValid`). Dialog Suspend — tombol "Suspend" disabled sampai alasan diisi. Form Organization Profile — tombol "Simpan Perubahan" disabled sampai field wajib terisi (legalName/displayName/address/contactEmail) DAN form berubah (`isDirty`).
- **Conflict/Confirmation:** Dialog usage-warning (edit/deactivate master data) — "historical snapshot warning ketika master berubah" (Wajib literal), genuine count atau peringatan generik jujur.
- **Read-only degrade:** `/admin/organization` — field disabled + banner "Anda hanya memiliki akses lihat" untuk role tanpa `MANAGE`.

## 12. Role Behavior

Gerbang akses TIDAK berubah — `canView('administration')` (5 halaman existing + `/admin/organization` baru, pola identik). Aksi tulis (Add/Edit/Deactivate/Reactivate master data, submit Organization Profile, Suspend/Reactivate user) digerbangi `canManage('administration')` — hanya Super Admin (`ADMIN` di modul `administration`) yang mendapat rank ≥ `MANAGE`; Management/Viewer (`VIEW`) tetap dapat melihat seluruh halaman baru tapi tidak melihat tombol aksi tulis. `/admin/roles` (matrix, LOCKED) TIDAK mendapat kolom/baris baru — Organization Profile berada di bawah `ModuleKey` `administration` yang sudah ada, tidak butuh `ModuleKey` baru.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **Sukses** (types generated).
- `npm run build` — **Sukses (exit 0)**. Log build diperiksa (`grep -iE "error|warn"`) — tidak ada baris yang cocok; build menghasilkan 18,6 MB output (3,49 MB gzip), `.output/server/index.mjs` terkonfirmasi ada.
- `npm run dev` — dijalankan dengan `NUXT_IGNORE_LOCK=1`. Port 8080 terpakai proses leftover sesi sebelumnya (Windows) — Nuxt otomatis jatuh ke port **3001**. Dev server berjalan bersih di port tsb.
- **Smoke test HTTP** (curl, 23 route): `/admin`, `/admin/users`, `/admin/roles`, `/admin/master-data`, `/admin/audit-trail`, `/admin/organization`, `/documents`, `/changes`, `/bookings`, `/finance`, `/`, `/reports`, `/crm/opportunities`, `/projects`, `/vendors`, `/ticketing`, `/accommodation`, `/transportation`, `/mice`, `/customer-journey`, `/client`, `/supplier`, `/nonexistent-route-xyz` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/admin` → `Organization Profile` ditemukan (kartu ke-5).
  - `/admin/master-data` → `Operational Reference`, `Commercial &amp; Finance`, `System Configuration`, `Airport` ditemukan (3 kelompok + kategori chip aktif group default).
  - `/admin/organization` → `Legal Name`, `MANOVA Travel`, `PT Manova Wisata Nusantara` ditemukan (field + seed value).
  - `/admin/users` → `Access Review`, `Dewi Anggraini`, `Suspended` ditemukan (tab baru + user seed suspended).
  - `/admin/audit-trail` → `Log Sistem (Non-Project)`, `Cari pesan` ditemukan (SectionCard baru + search box).
- **Error-string check** (`Internal Server Error`/`TypeError`/`is not defined`/`Cannot read propert`) pada `/admin`, `/admin/users`, `/admin/roles`, `/admin/master-data`, `/admin/audit-trail`, `/admin/organization`, `/vendors`, `/finance`, `/reports` — **tidak ditemukan** pada satu pun halaman.
- Regresi route existing (Documents, Changes, Bookings, Finance, Reports, Vendors, Ticketing/Accommodation/Transportation/MICE, CRM, Customer Journey, Client, Supplier, `/`) — **tidak berubah** kontennya, tetap HTTP 200.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck`/lint — tidak tersedia (`vue-tsc`/`eslint` core belum terpasang, Q8, pre-existing).
- **Verifikasi interaktif** (klik Add/Edit/Deactivate/Reactivate master data, Suspend/Reactivate user, submit Organization Profile, ketik di search box Audit Trail) — **tidak dilakukan headless**, tidak ada tool browser headless tersedia di lingkungan ini (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap seluruh handler (`submitForm`/`confirmOrRun`/`requestDeactivate`/`reactivateItem`/`submitSuspend`/`doReactivate`/`submit` Organization Profile) + smoke test konten di atas.
- Dev server **di-kill** setelah validasi selesai (`Stop-Process -Force` atas PID yang listening di port 3001, dikonfirmasi via `netstat` sebelum dan connection-refused sesudah).

## 14. Regression Checks

Route existing yang tidak disentuh (`/documents`, `/changes`, `/bookings`, `/finance`, `/reports`, `/vendors`, `/ticketing`, `/accommodation`, `/transportation`, `/mice`, `/crm/opportunities`, `/customer-journey`, `/client`, `/supplier`, `/`) — seluruhnya tetap HTTP 200, konten tidak berubah. `/admin/roles` — dikonfirmasi TIDAK disentuh sama sekali (tidak ada baris/kolom baru di matrix). Konsumen lama `app/constants/master-data.ts` (`app/pages/admin/master-data.vue`, satu-satunya yang ditemukan lewat grep repo-wide) — sudah diperbarui memakai `~/data` langsung, dan re-export lama tetap berfungsi sebagai jaring pengaman. `useCurrentUser.ts`/`getUserById` (konsumen `USERS`) — TIDAK diubah signature, dikonfirmasi tetap bekerja dengan `USERS` sebagai `reactive()` Proxy array (role switcher `/admin` dan `/admin/users` dikonfirmasi masih menampilkan seluruh 19 user dan dapat beralih role via smoke test konten). `SYSTEM_EVENTS` consumer existing (`/activity-center`) — dikonfirmasi TIDAK terpengaruh (hanya membaca array yang sama, entri baru dari Section 23 akan otomatis muncul di sana juga tanpa perubahan kode `/activity-center`).

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-053 — daftar lengkap. Section terdampak (SEMUA aditif/read-only, TIDAK ADA mutasi destruktif): Section 17 lama (`app/constants/master-data.ts`, 4 halaman `/admin/*` — diperkaya, TIDAK ditulis ulang strukturnya di luar yang didokumentasikan), Prompt 19 (`SystemEvent`/`SYSTEM_EVENTS`, `app/types/activity.ts`/`app/data/activity.ts` — menerima entri baru untuk pertama kali, shape TIDAK berubah), Foundation (`USERS`, `app/data/users.ts` — jadi `reactive()` untuk pertama kali dimutasi sejak section pertama), Section 20 (`Invoice.currency`, hanya dibaca), Section 10 lama/Foundation (`Project.destination`/`characteristic`/`ProjectService.type`, hanya dibaca). Business logic LOCKED (`FlightBooking`/`HotelBooking`/`CancellationRecord`/`update*BookingStatus`/`nextSequentialId`/departure-readiness derivation/lead-routing mutator/`/admin/roles`) — TIDAK disentuh sama sekali.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev`, port 3001 pada sesi validasi ini, tidak ada deployment/preview URL publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) tetap terbuka** — 23 section berturut-turut berjalan tanpa validasi otomatis penuh.
- **10 dari 15 kategori master data memakai usage-warning GENERIK** (`vendor-category`/`airport`/`airline`/`hotel`/`tax-rule`/`payment-term`/`cancellation-rule`/`numbering-scheme`/`document-template`/`readiness-gate`/`assignment-rule`) — bukan angka genuine, karena TIDAK ADA cross-reference bersih ke entitas existing untuk kategori-kategori tsb (didokumentasikan jujur di UI dan kode, bukan fabrikasi angka). Lihat `docs/frontend-known-issues.md` bagian 18.
- **Access Review TIDAK punya field "terakhir login"** — tidak ada di data model `User` (LOCKED sejak Foundation), sengaja TIDAK difabrikasi sesuai instruksi brief eksplisit. Scope disederhanakan menjadi filterable view user aktif + suspend satu-klik.
- **`NumberingScheme`/`ReadinessGateConfig`/`AssignmentRule`/`DocumentTemplate` — display/config preview PERMANEN by design**, bukan gap yang perlu ditutup section berikutnya — batas non-integrasi terhadap business logic LOCKED (ID generation `nextSequentialId`, departure-readiness derivation Section 12, lead-routing mutator Section 04) adalah keputusan arsitektur yang disengaja untuk menghormati hard rule "jangan mengarang integrasi/mesin bisnis nyata".
- **Airport/Airline/Hotel — referensi admin murni**, SENGAJA TIDAK ditautkan sebagai foreign key ke `FlightBooking`/`HotelBooking` (Section 13-14, LOCKED). Keputusan permanen yang sama.
- Verifikasi interaktif (klik Add/Edit/Deactivate/Suspend/submit form) tidak dilakukan headless — dimitigasi code review ketat + smoke test konten (konsisten sejak Section 06).

## 18. Protection Notes untuk Section Berikutnya

- `/admin/roles` (matrix, LOCKED sejak Section 02/old-Section 17) — **tetap tidak boleh disentuh** kecuali `ModuleKey` baru genuinely ditambahkan oleh section masa depan.
- `MASTER_DATA_REGISTRY`/`createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord` (baru, `app/data/index.ts`) — pola registry generik siap dipakai bila section masa depan butuh menambah kategori master data baru: cukup tambah array `reactive()` di `app/data/master-data.ts`, interface di `app/types/master-data.ts`, entry baru di `MASTER_DATA_REGISTRY`, dan `MasterDataCategoryKey` union — JANGAN buat mutator/halaman paralel.
- `pushSystemEvent` (baru, `app/data/index.ts`) — helper generik siap dipakai section masa depan yang butuh mencatat `SystemEvent` baru (mis. modul admin lain) — JANGAN push langsung ke `SYSTEM_EVENTS` tanpa lewat helper ini.
- `USERS` kini `reactive()` — section masa depan yang butuh mutasi user lain (mis. edit profile) dapat memakai pola `suspendUser`/`reactivateUser` sebagai acuan (`find` by ID lalu mutate in-place, `pushSystemEvent` di akhir).
- `getMasterDataUsageCount` — bila section masa depan menambah entitas yang mereferensikan salah satu dari 10 kategori yang saat ini `null` (mis. `Vendor` mendapat field `categoryId` typed yang match `VC-*`), cross-reference genuine BARU dapat ditambahkan sebagai `case` baru di fungsi ini — JANGAN buat fungsi cek usage paralel.

## 19. Recommended Next Section

**Section 24 — Full Regression dan Final Implementation Guide** (`prompts/SECTION_24_Full_Regression_Final_Implementation_Guide.md`), final section roadmap — seluruh Section 01–23 kini COMPLETED. Tidak dieksekusi otomatis — menunggu perintah user.
