# Section 13 — Vendor Management

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/15-PROMPT-13-VENDOR-MANAGEMENT.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Membangun modul Vendor penuh: `/vendors` (list, filter, create), `/vendors/[id]` (Vendor Detail, baru — 4 tab Overview/Services/Quotations/Contacts sesuai `docs/mockup-information-architecture.md` bagian 3.6, LOCKED), dan mengisi tab "Vendors" pada Project Detail (baseline Foundation, hanya daftar nama vendor datar) dengan vendor assignment per service, perbandingan quotation, dan aksi Accept/Reject yang menentukan confirmation status. **Tidak mengerjakan** tab Finance (tetap baseline Foundation, menyusul Section 15), tidak menyentuh Overview/Travelers/Itinerary & Services (Section 10/11/12) kodenya.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/15-PROMPT-13-VENDOR-MANAGEMENT.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, data-scenarios, design-decisions, information-architecture, route-and-role-matrix, template-reuse-mapping), `docs/mockup-section-reports/section-05-foundation.md` s/d `section-12-itinerary-operations.md`, source code aktual (`app/types/vendor.ts`, `app/data/vendors.ts`, `app/data/index.ts`, `app/constants/status.ts`, `app/constants/roles.ts`, `app/composables/usePermissions.ts`, `app/pages/vendors/index.vue`, `app/pages/projects/[id]/index.vue`, `app/pages/crm/parties/[id]/index.vue` sebagai pola tab-detail reference), `git status`/`git log`.

## 3. Existing Implementation yang Diperiksa

`/vendors` sejak Section 05 sudah shell nyata (bukan `ModulePlaceholder`) — tabel flat `Vendor`/`Jenis Layanan`/`Kontak` dari fixture `VENDORS` (array biasa, bukan `reactive()`), tanpa filter/create/detail route. Tab "Vendors" Project Detail hanya menampilkan nama vendor unik yang ter-assign via `service.vendorId`, tanpa status/quotation. **Temuan penting:** `app/constants/roles.ts` (`ROLE_MODULE_ACCESS.vendor`) sudah memberi `VIEW` untuk seluruh role kecuali Super Admin (`ADMIN`) sejak Foundation — ini **bertentangan** dengan anotasi lama di `docs/route-and-role-matrix.md` bagian 0/1.4 yang menyebut Operations/Ticketing/Accommodation/Transportation/MICE mendapat `MANAGE` (subset) pada modul Vendor. Bagian 5 (Role & Access Matrix, sumber tunggal per header dokumennya sendiri) justru **konsisten** dengan kode (kolom Vendor: `VIEW` untuk role-role tsb). `git log`/`git status` dikonfirmasi bersih (kecuali `prompts/99-RUN-CURRENT-SECTION.md` yang diedit user), commit terakhir `57899a4 "SECTION12-ITINERARY-OPERATIONS"`.

## 4. Decisions yang Digunakan

D-030 (Role & Access Matrix, bagian 5 dipakai sebagai ground truth — dikonfirmasi identik dengan kode `ROLE_MODULE_ACCESS` yang sudah berjalan sejak Section 05), D-006 (larangan fabrikasi integrasi nyata — diterapkan pada desain quotation sebagai data manual, bukan hasil RFQ API), D-038 (sentralisasi status constants — `VENDOR_QUOTATION_STATUSES` ditambahkan ke `app/constants/status.ts`).

## 5. Implementation Summary dan User Flow

- **Vendor list (`/vendors`):** filter search+jenis layanan, kolom "Penugasan Aktif" (jumlah service ter-assign, reuse `getServicesByVendor`), dialog "Tambah Vendor" (Super Admin saja).
- **Vendor Detail (`/vendors/[id]`, baru):** 4 tab —
  - **Overview:** metadata ringkas + "Aktivitas Terbaru" (`VendorActivity`, 5 entri terakhir) — mengisi "Activity/history" tanpa menambah tab kelima (LOCKED 4-tab).
  - **Services:** daftar `ProjectService` ter-assign ke vendor ini (`getServicesByVendor`, reuse langsung `PROJECT_SERVICES` Section 05/12, hard rule "jangan menggandakan service fixture"), klik baris → `/projects/[id]?tab=itinerary-services`.
  - **Quotations:** riwayat quotation vendor ini lintas project (read-only dari sisi vendor), dialog "Submit Quotation" (Super Admin) — pilih Project, lalu Service (opsional, difilter sesuai `vendor.serviceType`), nilai, catatan.
  - **Contacts:** CRUD tambah contact (pola identik Section 07 Contact CRM), backfill 1 contact per vendor dari `Vendor.contactName` existing.
- **Tab "Vendors" Project Detail:** ditulis ulang total — per service, tampilkan vendor yang ditugaskan + status konfirmasi (`SERVICE_STATUSES`, reuse), dan **Perbandingan Quotation** (tabel `VendorQuotation` untuk service tsb, diurutkan dari termurah) dengan tombol **Terima**/**Tolak** untuk quotation berstatus `submitted`, digerbangi `canManageServiceType(service.type)` (Section 12, reuse langsung — bukan mekanisme baru). Menerima quotation otomatis: menolak quotation bersaing lain untuk service yang sama, mengarahkan `ProjectService.vendorId` ke vendor pemenang, memanggil `updateServiceStatus(serviceId, 'confirmed')` (Section 12, reuse), dan mencatat `VendorActivity`.

**User flow yang bisa didemokan:** buka `/projects/PRJ-103?tab=vendors` sebagai Super Admin → lihat service "Ground Transportation" dengan 2 quotation bersaing (Trans Wahana Logistik Rp45.000.000 vs CV Wisata Kargo Ekspres Rp52.000.000) → klik "Terima" pada yang lebih murah → toast "Quotation Diterima" → quotation kompetitor otomatis berubah "Ditolak", badge status service berubah jadi "Confirmed" → buka `/vendors/VND-003` (vendor pemenang) → tab Quotations menampilkan quotation ini kini "Diterima", tab Overview menampilkan entri aktivitas baru "Quotation Transportation untuk project PRJ-103 diterima." → kembali ke `?tab=overview` Project Detail → Service Summary (Section 10) otomatis merefleksikan penambahan 1 service `confirmed` tanpa reload.

## 6. Routes

**Baru:** `/vendors/[id]` (Vendor Detail, 4 tab). `/vendors` (Section 05 shell) diisi penuh. Tidak ada route baru di `/projects/[id]` — tab "Vendors" diisi.

## 7. Files Created, Changed, dan Removed

**Created:** `app/pages/vendors/[id]/index.vue`, `docs/mockup-section-reports/section-13-vendor-management.md`.

**Changed:**
- `app/types/vendor.ts` — `+VendorContact`, `+VendorQuotationStatus`, `+VendorQuotation`, `+VendorActivity`, `+VendorDetailTab`.
- `app/data/vendors.ts` — `VENDORS` dibungkus `reactive()`, `+VENDOR_CONTACTS` (5), `+VENDOR_QUOTATIONS` (10), `+VENDOR_ACTIVITIES` (5).
- `app/data/index.ts` — +9 selector/mutator (`getVendorContacts`, `getVendorQuotations`, `getVendorActivities`, `getServicesByVendor`, `getQuotationsForService`, `createVendor`, `createVendorContact`, `submitVendorQuotation`, `acceptVendorQuotation`, `rejectVendorQuotation`).
- `app/constants/status.ts` — `+VENDOR_QUOTATION_STATUSES`.
- `app/pages/vendors/index.vue` — ditulis ulang total (filter + create dialog + link detail).
- `app/pages/projects/[id]/index.vue` — tab "Vendors" ditulis ulang total; tab lain **tidak diubah** (diverifikasi smoke test, bagian 13).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `Dialog*`, `Table*`, `SectionCard` (+`#actions`), `StatusBadge`, `EmptyState`, `Button`, `Tabs*` (Vendor Detail — pemakaian keempat setelah Party/Project/Opportunity Detail), `DetailMetadataList`, `useToast`/`ToastContainer`. `canManageServiceType` (Section 12) direuse langsung untuk gerbang Accept/Reject.

**Created:** Tidak ada file komponen baru — konsisten dengan tab-detail lain yang juga tidak diekstrak jadi komponen terpisah.

## 9. Types, Constants, Fixtures, dan Mock State

Lihat bagian 7 dan `docs/mockup-change-impact-log.md` (CI-015). Ringkasan fixture baru: 5 `VendorContact` (backfill), 10 `VendorQuotation` (7 `accepted`/1 `rejected` historis + 2 `submitted` skenario comparison hidup untuk `SVC-1034`), 5 `VendorActivity` seed.

## 10. Responsive Behavior

Vendor list filter row: `flex-col sm:flex-row`. Vendor Detail metadata + tab: pola identik Party/Project Detail (sudah terverifikasi responsive di section sebelumnya). Tab "Vendors" Project Detail: per-service card `p-4 rounded-lg border`, tabel comparison di dalamnya memakai `Table` primitive (`overflow-auto` bawaan). Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (konsisten keterbatasan sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru — data lokal sinkron.
- **Empty:** `TableEmpty`/`EmptyState` untuk vendor list kosong (filter tidak match), Vendor Detail tab Services/Quotations/Contacts kosong, dan tab Vendors Project Detail bila project tidak punya service; teks muted "Belum ada quotation untuk layanan ini." per service tanpa quotation (diverifikasi: `SVC-1036` PRJ-103 tidak punya quotation, menampilkan teks ini, bukan tabel kosong).
- **Error:** Tidak ada state error tersimulasi baru.
- **Not-found:** Vendor Detail (`/vendors/VND-999`) menampilkan not-found state — diverifikasi HTTP 200 dengan teks "Vendor tidak ditemukan", pola identik Party/Project/Opportunity Detail.
- **Unauthorized:** `RoleAccessState` untuk `!canView('vendor')` — gerbang halaman baru untuk `/vendors` dan `/vendors/[id]`.

## 12. Role Behavior

`canView('vendor')` — gerbang akses halaman `/vendors`/`/vendors/[id]` (semua role kecuali yang `NONE`; per matrix, tidak ada role dengan `vendor: NONE`, jadi seluruh role bisa melihat). `canManage('vendor')` — generik, **tidak butuh pengecualian sempit** (berbeda dari Section 07/11/12) karena `ROLE_MODULE_ACCESS.vendor` sudah presisi: `ADMIN` Super Admin, `VIEW` seluruh role lain (termasuk Management — tidak ada rank `APPROVE` yang membocorkan akses seperti modul CRM/Project). Gerbang Accept/Reject quotation di tab Vendors Project Detail memakai `canManageServiceType` (Section 12, reuse) karena aksi tsb adalah keputusan Project-domain (menulis `ProjectService.vendorId`), bukan Vendor-domain murni — lihat catatan implementasi di `docs/route-and-role-matrix.md` bagian 1.4.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**, chunk `/vendors/[id]` terkonfirmasi ter-generate.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test konten mendalam** (curl + grep, bukan hanya status code):
  - `/vendors` — HTTP 200, seluruh 5 vendor tampil.
  - `/vendors/VND-001?tab=quotations` — HTTP 200, "Manila Business Trip" (PRJ-101) tampil, 3× badge "Diterima" (3 quotation `accepted` milik VND-001), nilai "Rp 90.000.000" cocok fixture.
  - `/vendors/VND-999` — HTTP 200, teks "Vendor tidak ditemukan" tampil (not-found state benar).
  - `/projects/PRJ-103?tab=vendors` — HTTP 200; "Perbandingan Quotation" muncul 5× (5 dari 6 service PRJ-103 punya quotation, `SVC-1036` additional tidak — cocok fixture); label "Diajukan" muncul 3× dan tombol "Terima"/"Tolak" masing-masing 3× (cocok 3 quotation `submitted`: `SVC-1032`×1, `SVC-1034`×2); nilai "Rp 45.000.000" dan "Rp 52.000.000" (skenario comparison Ground Transportation) terkonfirmasi tampil.
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
  - **Regresi tab lain Project Detail** — `?tab=overview`, `?tab=travelers`, `?tab=itinerary-services` (PRJ-101/102/103) tetap HTTP 200 tanpa perubahan konten dari sebelum Section 13.
- **Verifikasi interaktif** (klik Terima/Tolak dan mengonfirmasi status berubah real-time, ganti role dan cek tombol aksi hilang) **tidak dilakukan** — tidak ada tool browser headless di lingkungan ini (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap `acceptVendorQuotation`/`rejectVendorQuotation` (pola mutasi identik dengan mutator Section 07/09/11/12 yang sudah terverifikasi konten-nya) dan manual trace efek berantai (reject kompetitor → assign vendorId → `updateServiceStatus` → log activity).

## 14. Regression Checks

Section 05 (shell 8-tab, tidak diubah strukturnya; `/vendors` shell diperkaya, bukan diganti paradigma), Section 10 (Overview tab kode tidak diubah — Service Summary akan otomatis merefleksikan status baru bila quotation di-Accept saat demo, computed generik existing), Section 11 (Travelers, tidak disentuh), Section 12 (Itinerary & Services, `updateServiceStatus` di-reuse bukan diduplikasi — dikonfirmasi lewat pembacaan kode, bukan modifikasi) — seluruhnya diverifikasi tidak beregresi tak terduga.

## 15. Cross-Section Impact

**Satu entri baru:** CI-015 (`docs/mockup-change-impact-log.md`) — `Vendor` jadi `reactive()` + entitas baru `VendorContact`/`VendorQuotation`/`VendorActivity`; tab "Vendors" Project Detail (milik Foundation, belum ada owner section sampai sekarang) diisi penuh oleh Section 13 sesuai rencana IA bagian 3.6. **Koreksi dokumentasi** (bukan keputusan baru): `docs/route-and-role-matrix.md` bagian 0/1.4 (anotasi role Vendor lama, tidak pernah diimplementasikan dan bertentangan dengan kode `ROLE_MODULE_ACCESS` sejak Section 05) disinkronkan dengan bagian 5 dan kode aktual — lihat catatan implementasi di bagian 1.4 dokumen tsb.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **sembilan section berturut-turut** (06–13) berjalan tanpa validasi otomatis penuh.
- CRUD hapus vendor/contact/quotation tidak diimplementasikan — scope literal hanya minta "list/detail/contact", "quotation dan comparison", "assignment", "confirmation status", tidak eksplisit minta delete; create+update (Accept/Reject) sudah cukup mendemonstrasikan siklus hidup quotation.
- Vendor Detail tab "Quotations" bersifat read-only terhadap keputusan Accept/Reject (aksinya ada di tab Vendors Project Detail) — desain sengaja untuk menghindari duplikasi logic mutasi di dua tempat berbeda, didokumentasikan di bagian 5 di atas, bukan keterbatasan tak disengaja.
- Verifikasi interaktif (klik Accept/Reject, ganti role) tidak dilakukan langsung (keterbatasan tooling lingkungan, konsisten sejak Section 06).

## 18. Protection Notes untuk Section Berikutnya

- Tab "Vendors" Project Detail dan `/vendors/[id]` kini sumber lengkap untuk vendor assignment/quotation/confirmation — Section 14 (Project Changes) dan berikutnya **tidak perlu** menduplikasi ringkasan ini.
- `Vendor`/`VendorContact`/`VendorQuotation`/`VendorActivity` di `app/types/vendor.ts` dan `app/data/vendors.ts` — jangan diubah shape-nya tanpa cross-section impact check; gunakan selector/mutator existing (`getVendorContacts`, `getVendorQuotations`, `getVendorActivities`, `getServicesByVendor`, `getQuotationsForService`, `createVendor`, `createVendorContact`, `submitVendorQuotation`, `acceptVendorQuotation`, `rejectVendorQuotation`).
- **Koreksi dokumentasi Role Matrix Vendor (bagian 15) sudah final** — jangan mengembalikan anotasi lama "MANAGE (subset)" untuk Ops/Ticketing/dst. pada modul Vendor tanpa mengubah kode `ROLE_MODULE_ACCESS` terlebih dahulu (perubahan kode itu sendiri di luar scope Section 13, butuh keputusan eksplisit bila memang diinginkan ke depannya).
- `acceptVendorQuotation` memanggil `updateServiceStatus` (Section 12) — bila Section 14/15 menambah efek lain pada transisi status service, perbarui di satu tempat (`updateServiceStatus`), jangan buat jalur mutasi status paralel.

## 19. Recommended Next Section

Section 14 — Project Changes (`prompts/16-PROMPT-14-PROJECT-CHANGES.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — sembilan section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
