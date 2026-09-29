# PHASE 0 — AUDIT DAN BASELINE MANOVA CLIENT–VENDOR COMMODITY

Anda bekerja pada codebase **MANOVA Travel Agent Management System / Travel ERP B2B** berbasis **Nuxt 4, Vue 3, dan TypeScript**.

Prompt ini hanya untuk **Phase 0 — Audit dan Baseline**.

## Larangan Utama

Pada phase ini:

* Jangan mengimplementasikan fitur baru.
* Jangan mengubah UI.
* Jangan membuat route baru.
* Jangan membuat component baru.
* Jangan mengubah store, service, mock data, atau type.
* Jangan memperbaiki bug terlebih dahulu.
* Jangan melakukan refactor.
* Jangan menghapus atau memindahkan file.
* Jangan mengubah role lain.
* Jangan mengubah code yang tidak berkaitan.
* Jangan update laporan progres sebagai implementasi selesai.

Phase ini hanya digunakan untuk membaca, mengaudit, memetakan, dan membuat rencana berdasarkan kondisi codebase yang sebenarnya.

---

# 1. Tujuan Audit

Audit codebase untuk mengetahui kesiapan implementasi fitur berikut:

## Vendor/Supplier

* Vendor membuat komoditas.
* Vendor melihat komoditas miliknya.
* Vendor mengedit komoditas.
* Vendor menghapus draft atau mengarsipkan komoditas.
* Vendor mengatur variant.
* Vendor mengatur harga.
* Vendor mengatur availability.
* Vendor memublikasikan komoditas.
* Vendor melihat order.
* Vendor melihat komoditas yang sudah terjual.

## Client

Hanya terdapat satu role eksternal:

* Client

Client harus dapat:

* Melihat project miliknya.
* Menambahkan kebutuhan komoditas pada project.
* Melihat komoditas yang tersedia dari vendor.
* Membandingkan komoditas.
* Memilih komoditas.
* Menentukan pilihan utama dan alternatif.
* Melihat status availability.
* Melihat status selection, hold, confirmation, dan booking.

## Sinkronisasi

Audit kesiapan flow:

```text
Vendor membuat komoditas
→ Vendor publish
→ Komoditas muncul di katalog Client
→ Client membuat kebutuhan komoditas
→ Sistem mencari komoditas yang cocok
→ Client memilih komoditas
→ Availability diperiksa
→ Soft Hold dibuat
→ Selection dikonfirmasi
→ Vendor melihat order/komoditas terjual
```

---

# 2. Dokumentasi yang Harus Dibaca

Cari dan baca dokumentasi berikut jika tersedia:

* `docs/mockup-scope.md`
* `docs/information-architecture.md`
* `docs/data-scenarios.md`
* `docs/design-decisions.md`
* `docs/open-questions.md`
* `docs/progress.md`
* `docs/role-guide.md`
* `docs/module-relationship-map.md`
* `docs/workflow.md`
* `MANOVA-Laporan-Progres-2026-08-01.html`

Cari juga seluruh file dokumentasi yang mengandung kata:

* Client
* Vendor
* Supplier
* Commodity
* Product
* Service
* Availability
* Reservation
* Order
* Project
* Catalog
* Requirement
* Selection

Jangan berasumsi nama file selalu sama. Gunakan pencarian repository.

---

# 3. Audit Struktur Project

Identifikasi dan laporkan struktur codebase aktual:

## Framework dan konfigurasi

* Versi Nuxt.
* Versi Vue.
* TypeScript configuration.
* UI library yang digunakan.
* State management yang digunakan.
* Form validation library.
* Testing framework.
* Mock data mechanism.
* Persistence mechanism.
* Authentication mechanism.
* Permission mechanism.

## Folder penting

Petakan folder:

* `pages`
* `components`
* `layouts`
* `composables`
* `stores`
* `services`
* `repositories`
* `types`
* `utils`
* `middleware`
* `plugins`
* `data`
* `mocks`
* `tests`
* `docs`

Jika struktur berbeda, jelaskan struktur aktual.

---

# 4. Audit Role dan Permission

Identifikasi seluruh role yang sudah tersedia.

Khusus role eksternal, cek apakah masih terdapat:

* Client Admin
* Client PIC
* Client Approver
* Client Finance
* Participant

Laporkan:

* Apakah role-role tersebut benar-benar sudah digunakan pada route atau permission.
* Apakah role-role tersebut hanya ada di mock data.
* Apakah sudah ada satu role `Client`.
* Dampak penyederhanaan menjadi satu role Client.
* File mana saja yang akan terdampak jika role client disederhanakan.
* Risiko terhadap authentication, navigation, dan permission.

Untuk Vendor/Supplier, cek:

* Nama role aktual.
* Route yang dapat dibuka.
* Navigation yang tersedia.
* Permission yang sudah diterapkan.
* Apakah vendor dapat melihat data vendor lain melalui URL langsung.
* Apakah data sudah dibatasi berdasarkan `vendorId`.

Jangan mengubah role pada phase ini.

---

# 5. Audit Fitur Client yang Sudah Ada

Cari seluruh halaman dan fitur Client.

Laporkan:

## Dashboard

* Apakah ada dashboard Client.
* Data masih hardcoded atau sudah berasal dari store/service.
* Statistik yang tersedia.
* Action yang tersedia.

## Project

* Apakah Client dapat melihat daftar project.
* Apakah Client dapat membuka detail project.
* Apakah project dibatasi berdasarkan client ownership.
* Apakah direct URL ke project client lain sudah dicegah.

## Commodity Requirement

Cek apakah sudah tersedia:

* Requirement list.
* Create requirement.
* Requirement detail.
* Edit requirement.
* Delete requirement.
* Category-specific fields.
* Status requirement.

## Commodity Catalog

Cek apakah sudah tersedia:

* Available commodities.
* Search.
* Filter.
* Detail.
* Compare.
* Availability display.
* Client selling price.
* Product visibility.

## Commodity Selection

Cek apakah sudah tersedia:

* Select commodity.
* Select variant.
* Quantity.
* Primary choice.
* Alternative choice.
* Save draft.
* Submit selection.
* Soft Hold.
* Confirmation.
* Hold expiry.
* Selected commodities list.

Untuk setiap fitur, tandai:

* Sudah fungsional.
* Hanya UI.
* Data hardcoded.
* Partial.
* Belum ada.
* Broken.
* Perlu validasi.

---

# 6. Audit Fitur Vendor/Supplier yang Sudah Ada

Cari seluruh halaman dan fitur Vendor/Supplier.

## Vendor Dashboard

Cek apakah tersedia:

* Commodity summary.
* Draft commodity.
* Published commodity.
* Sold-out commodity.
* Total order.
* Sold commodity.
* Revenue atau nilai transaksi.
* Recent order.

Tentukan apakah angka dihitung dari data atau hardcoded.

## Commodity Management

Cek apakah tersedia:

* Commodity list.
* Create.
* Detail.
* Edit.
* Delete.
* Archive.
* Duplicate.
* Publish.
* Unpublish.
* Variant.
* Image.
* Facility.
* Pricing.
* Policy.
* Availability.

## Orders / Sales

Cek apakah tersedia:

* Order list.
* Sold commodities.
* Order detail.
* Status.
* Project reference.
* Quantity.
* Service date.
* Transaction value.
* Payment status.

## Isolation

Periksa apakah:

* Vendor hanya melihat komoditas miliknya.
* Vendor hanya melihat order miliknya.
* URL langsung ke commodity vendor lain ditolak.
* Store/service memfilter berdasarkan vendor aktif.

---

# 7. Audit Domain Model

Cari type, interface, schema, mock model, atau object yang sudah tersedia untuk:

* Commodity
* Product
* Service
* Vendor product
* Requirement
* Selection
* Availability
* Order
* Booking
* Project service
* Project item

Untuk setiap model, laporkan:

* Nama type/interface.
* Lokasi file.
* Field yang tersedia.
* Field yang kurang.
* Apakah dipakai oleh UI.
* Apakah ada duplikasi.
* Apakah ada ketidakkonsistenan naming.
* Apakah Commodity Product dan Commodity Requirement masih tercampur.

Pastikan audit memahami perbedaan:

## Commodity Product

Produk atau layanan yang dibuat Vendor.

## Commodity Requirement

Kebutuhan yang dibuat Client dalam project.

## Commodity Selection

Pilihan Client terhadap produk Vendor.

## Availability

Kapasitas tersedia per periode.

## Commodity Order

Transaksi yang terbentuk setelah selection dikonfirmasi.

Jangan membuat model baru pada phase ini.

---

# 8. Audit Store, Service, Repository, dan Mock Data

Identifikasi sumber data aktual untuk:

* Client.
* Vendor.
* Project.
* Commodity.
* Requirement.
* Selection.
* Availability.
* Order.

Laporkan:

* Apakah menggunakan Pinia.
* Apakah menggunakan composable state.
* Apakah menggunakan mock API.
* Apakah menggunakan localStorage.
* Apakah data reset saat refresh.
* Apakah Vendor dan Client membaca sumber data yang sama.
* Apakah terdapat duplicate mock data.
* Apakah store memiliki CRUD method.
* Apakah error handling tersedia.
* Apakah ID generation stabil.
* Apakah timestamp konsisten.

Cari potensi masalah:

* Data Vendor dan Client tidak sinkron.
* Commodity dibuat Vendor tetapi Client membaca file lain.
* CRUD hanya mengubah local component state.
* Edit tidak persistent.
* Delete tidak persistent.
* Data kembali ke seed setelah reload.
* Harga vendor bocor ke Client.
* Order tidak memakai snapshot.
* Availability dapat negatif.

---

# 9. Audit Availability dan Stock Logic

Cari seluruh logic availability yang sudah ada.

Periksa apakah sistem memiliki:

* Total quantity.
* Held quantity.
* Booked quantity.
* Available quantity.
* Availability period.
* Expiry.
* Booking cutoff.
* Blackout date.
* Sold-out status.
* Soft Hold.

Verifikasi apakah rumus berikut sudah diterapkan:

```text
availableQuantity =
totalQuantity - heldQuantity - bookedQuantity
```

Cari risiko:

* Negative stock.
* Overselling.
* Double hold.
* Hold tidak mengembalikan stok.
* Booked quantity tidak mengurangi availability.
* Expired product masih tampil.
* Archived product masih bisa dipilih.
* Quantity tidak divalidasi.
* Race condition pada mock logic.

Pada phase ini cukup laporkan, jangan diperbaiki.

---

# 10. Audit State dan Status

Cari seluruh status yang sudah dipakai.

## Commodity Product

Contoh target:

* Draft
* Published
* Available
* Limited
* Sold Out
* Expired
* Archived
* Suspended

## Requirement

Contoh target:

* Draft
* Open
* Matching
* Selection In Progress
* Selection Submitted
* Fulfilled
* Closed
* Cancelled

## Selection

Contoh target:

* Draft
* Submitted
* Under Validation
* Soft Hold
* Confirmed
* Booked
* Completed
* Expired
* Rejected
* Cancelled
* Replaced

## Order

Contoh target:

* Inquiry
* Selected
* Soft Hold
* Confirmed
* Booked
* In Service
* Completed
* Cancelled
* Expired
* Refunded

Laporkan:

* Status yang sudah tersedia.
* Status yang berbeda naming.
* Status yang tidak konsisten.
* Transisi yang saat ini bebas dilakukan.
* Lokasi logic transition.
* Risiko invalid transition.

---

# 11. Audit CRUD Aktual

Buat matriks CRUD berdasarkan kondisi codebase.

Gunakan format:

| Modul               | Create | Read | Update | Delete/Archive | Sumber Data | Kondisi |
| ------------------- | -----: | ---: | -----: | -------------: | ----------- | ------- |
| Vendor Commodity    |        |      |        |                |             |         |
| Commodity Variant   |        |      |        |                |             |         |
| Availability        |        |      |        |                |             |         |
| Client Requirement  |        |      |        |                |             |         |
| Commodity Selection |        |      |        |                |             |         |
| Vendor Order/Sales  |        |      |        |                |             |         |

Gunakan penilaian:

* Functional
* Partial
* UI Only
* Hardcoded
* Missing
* Broken
* Needs Validation

Jangan menilai fitur selesai hanya karena tombol atau halaman tersedia.

---

# 12. Audit UI dan UX

Periksa komponen terkait:

* Table.
* Card.
* Form.
* Drawer.
* Modal.
* Confirmation dialog.
* Toast.
* Empty state.
* Error state.
* Loading state.
* Badge status.
* Filter.
* Search.
* Pagination.
* Date picker.
* Image uploader.
* Variant editor.
* Availability calendar.

Cari masalah:

* Tombol tanpa handler.
* Form submit tidak menyimpan.
* Edit tidak prefill.
* Modal tidak bisa ditutup.
* Delete tidak meminta konfirmasi.
* Tidak ada success feedback.
* Tidak ada error feedback.
* Blank page saat ID tidak ditemukan.
* Double submit.
* Data hilang setelah refresh.
* Status badge tidak sinkron.

---

# 13. Audit Route dan Navigation

Buat daftar route aktual terkait:

## Client

* Dashboard.
* Projects.
* Project detail.
* Commodity requirement.
* Available commodity.
* Commodity detail.
* Comparison.
* Selected commodity.

## Vendor

* Dashboard.
* My commodities.
* Create commodity.
* Commodity detail.
* Edit commodity.
* Availability.
* Orders.
* Sold commodities.

Untuk setiap route, laporkan:

* Path.
* File.
* Role access.
* Navigation source.
* Route guard.
* Data source.
* Status functional atau tidak.
* Risiko direct URL access.

---

# 14. Baseline Validation

Baca `package.json` dan identifikasi command yang tersedia.

Jalankan command baseline yang relevan, misalnya:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Gunakan nama script yang benar dari `package.json`.

Catat secara faktual:

* Command yang dijalankan.
* Pass atau fail.
* Jumlah test.
* Error.
* Warning.
* File penyebab.
* Apakah error sudah ada sebelum perubahan.

Jangan memperbaiki error pada phase ini.

Jika command gagal karena environment, dependency, atau konfigurasi, laporkan secara jujur.

---

# 15. Git dan Working Tree Audit

Periksa:

* Branch aktif.
* Working tree.
* Modified files.
* Untracked files.
* Existing changes dari pekerjaan sebelumnya.

Jangan:

* Reset perubahan orang lain.
* Checkout file.
* Stash tanpa izin.
* Menghapus untracked files.
* Commit perubahan.

Laporkan file yang sudah berubah sebelum task dimulai agar perubahan pekerjaan lain tidak tertimpa.

---

# 16. Risiko Regresi

Identifikasi risiko perubahan terhadap:

* Existing Vendor pages.
* Existing Client pages.
* Project detail.
* Project lifecycle.
* Navigation.
* Authentication.
* Role permission.
* Shared types.
* Shared mock data.
* Shared components.
* Existing tests.
* LocalStorage persistence.

Berikan tingkat risiko:

* Low.
* Medium.
* High.

Jelaskan alasan dan mitigasinya.

---

# 17. Rencana Implementasi Setelah Audit

Berdasarkan kondisi aktual, buat rencana phase berikutnya.

Rencana minimal:

## Phase 1

Domain, types, state transition, shared store/service, dan mock data.

## Phase 2

Vendor Commodity CRUD, variant, dan availability.

## Phase 3

Client Commodity Requirement CRUD dalam project.

## Phase 4

Client catalog, matching, comparison, selection, dan soft hold.

## Phase 5

Vendor Orders dan Sold Commodities.

## Phase 6

Edge cases dan regression.

## Phase 7

Full validation.

## Phase 8

Dokumentasi flow dan laporan progres HTML.

Untuk setiap phase, jelaskan:

* Scope.
* File yang kemungkinan diubah.
* Dependency.
* Acceptance criteria.
* Risiko.
* Test yang perlu dibuat.

Rencana harus menyesuaikan codebase aktual, bukan hanya mengulang master prompt.

---

# 18. Output Laporan Phase 0

Berikan laporan akhir Phase 0 dengan struktur berikut.

## 1. Executive Summary

Ringkasan kondisi codebase dan kesiapan implementasi.

## 2. Baseline Project

* Stack.
* Arsitektur.
* State management.
* Persistence.
* Testing.
* Branch.
* Working tree.

## 3. Dokumentasi yang Dibaca

Daftar file dan temuan penting.

## 4. Existing Role Structure

* Role Client.
* Role Vendor/Supplier.
* Role eksternal lain.
* Dampak penyederhanaan role Client.

## 5. Existing Client Features

Tampilkan route, file, data source, dan status.

## 6. Existing Vendor Features

Tampilkan route, file, data source, dan status.

## 7. Domain Model Findings

* Existing model.
* Missing field.
* Duplicate model.
* Naming conflict.
* Recommended source of truth.

## 8. CRUD Matrix

Gunakan tabel audit CRUD.

## 9. Data Flow Findings

Jelaskan apakah Vendor dan Client sudah menggunakan sumber data yang sama.

## 10. Availability Findings

Jelaskan kondisi stock, hold, booking, dan sold logic.

## 11. Permission Findings

Jelaskan ownership isolation Client dan Vendor.

## 12. Baseline Test Results

Tampilkan command dan hasil aktual.

## 13. Regression Risks

Tampilkan risiko dan mitigasi.

## 14. Proposed File Changes

Daftar file yang kemungkinan:

* Dibuat.
* Diubah.
* Tidak perlu disentuh.

Jangan mengubah file tersebut pada Phase 0.

## 15. Recommended Implementation Plan

Rencana Phase 1 sampai Phase 8 berdasarkan audit aktual.

## 16. Open Questions

Hanya masukkan pertanyaan yang benar-benar tidak dapat dijawab dari codebase atau dokumentasi.

Jangan meminta konfirmasi untuk hal yang dapat ditentukan dengan best practice atau kondisi codebase.

---

# 19. Definition of Done Phase 0

Phase 0 dianggap selesai jika:

* Dokumentasi relevan sudah dibaca.
* Struktur codebase sudah dipetakan.
* Role Client dan Vendor sudah diaudit.
* Route sudah dipetakan.
* Domain model sudah diaudit.
* CRUD matrix sudah dibuat.
* Store/service/mock data sudah diaudit.
* Availability logic sudah diaudit.
* Permission isolation sudah diaudit.
* Baseline test sudah dijalankan.
* Git working tree sudah diperiksa.
* Risiko regresi sudah dicatat.
* Rencana implementasi sudah dibuat.
* Tidak ada fitur yang diubah.
* Tidak ada code yang diubah.

Berhenti setelah memberikan laporan Phase 0.

Jangan lanjut ke Phase 1 sebelum menerima instruksi berikutnya.
