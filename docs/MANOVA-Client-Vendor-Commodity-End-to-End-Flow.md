# Client–Vendor Commodity — End-to-End Flow

Dokumen ini menjelaskan alur kerja penuh fitur **Client–Vendor Commodity**, dibangun bertahap lewat `phases/PHASE_01_Domain_Types_Store_Mock_Data.md` sampai `phases/PHASE_06_Regression_Edge_Cases.md`. Fitur ini **terpisah dari roadmap Section 00–24** (`docs/frontend-implementation-roadmap.md`) — sebuah alur baru yang memungkinkan Vendor mempublikasikan komoditas (kamar, tiket, slot venue, dll.) yang dapat dicari, dipilih, di-hold sementara, dan dikonfirmasi menjadi Order oleh Client, lengkap dengan ringkasan Sold Commodities di sisi Vendor.

Frontend-only mockup — seluruh state adalah `reactive()` Vue module-level (`app/data/*.ts`), tidak ada backend/database/payment gateway sungguhan, konsisten dengan seluruh bagian aplikasi lain.

---

## 1. Ringkasan Arsitektur

| Lapisan | File | Isi |
|---|---|---|
| Types | `app/types/commodity.ts`, `availability.ts`, `requirement.ts`, `selection.ts`, `commodity-order.ts` | `CommodityProduct`/`CommodityVariant`, `AvailabilitySlot`, `CommodityRequirement`, `CommoditySelection`, `CommodityOrder` |
| Mock data | `app/data/commodities.ts`, `availability.ts`, `requirements.ts`, `selections.ts`, `commodity-orders.ts` | Seed data per entitas (di-`reactive()`-kan) |
| Data/mutation layer | `app/data/index.ts` (section "Commodity Product / Variant / Availability / Requirement / Selection / Order") | **Satu-satunya** titik mutasi yang sah — seluruh create/update/delete/transition ada di sini sebagai fungsi bernama, halaman `.vue` tidak pernah memutasi array mentah |
| Status constants | `app/constants/status.ts` | `COMMODITY_PRODUCT_STATUSES`, `COMMODITY_REQUIREMENT_STATUSES`, `COMMODITY_SELECTION_STATUSES`, `SELECTION_CHOICE_RANKS`, `COMMODITY_ORDER_STATUSES` |
| Pages (Vendor) | `app/pages/supplier/commodities/**`, `app/pages/supplier/commodity-orders/**` | Kelola Commodity Product/Variant/Availability, Vendor Orders, Sold Commodities |
| Pages (Client) | `app/pages/client/project-orders/[id]/index.vue` (tab "commodity"), `app/pages/client/catalog/[requirementId]/index.vue` | Kelola Requirement, Katalog/Matching/Compare/Selection/Hold |
| Tests | `app/data/commodity.test.ts`, `commodity-vendor-crud.test.ts`, `commodity-client-requirement.test.ts`, `commodity-catalog-matching.test.ts`, `commodity-vendor-orders.test.ts`, `commodity-regression.test.ts` | Satu file per fase (Phase 1–6) |

### Rute (routes)

| Route | Role | Fungsi |
|---|---|---|
| `/supplier/commodities` | Vendor (`supplier-portal`) | List + Create Commodity Product |
| `/supplier/commodities/[id]` | Vendor | Detail: kelola Variant, Availability Slot, Publish/Unpublish/Archive/Hapus Draft |
| `/supplier/commodities/[id]/edit` | Vendor | Edit Commodity Product |
| `/supplier/commodity-orders` | Vendor | Vendor Orders: "Menunggu Konfirmasi" (Soft Hold pending), daftar Order + search/filter, ringkasan Sold Commodities |
| `/supplier/commodity-orders/[id]` | Vendor | Detail Order: status timeline, tombol transisi status |
| `/client/project-orders/[id]?tab=commodity` | Client (`client-portal`) | List + Create/Edit/Hapus Commodity Requirement |
| `/client/catalog/[requirementId]` | Client | Katalog, hasil Matching, Compare, Selection dialog, Selected Commodities (Soft Hold/Confirmed/dst.) |

### Status enum

| Entitas | Nilai (urutan bebas nilai) |
|---|---|
| `CommodityProductStatus` | `draft` · `published` · `available` · `limited` · `sold-out` · `expired` · `suspended` · `archived` |
| `RequirementStatus` | `draft` · `open` · `matching` · `selection-in-progress` · `selection-submitted` · `fulfilled` · `closed` · `cancelled` |
| `SelectionStatus` | `draft` · `submitted` · `under-validation` · `soft-hold` · `confirmed` · `booked` · `completed` · `expired` · `rejected` · `cancelled` · `replaced` |
| `CommodityOrderStatus` | `inquiry` · `selected` · `soft-hold` · `confirmed` · `booked` · `in-service` · `completed` · `cancelled` · `expired` · `refunded` |

`available`/`limited`/`sold-out` pada `CommodityProduct` **selalu derivasi** (`syncCommodityProductAvailabilityStatus`), tidak pernah di-set manual dari UI. `CommodityOrder` dalam praktiknya hanya pernah dibuat langsung berstatus `confirmed` (lewat `createCommodityOrderFromSelection`) — nilai `inquiry`/`selected`/`soft-hold` ada di type untuk kelengkapan state machine tapi tidak dipakai jalur create yang sekarang berjalan.

---

## 2. Matriks CRUD Aktual

| Entitas | Create | Read | Update | Delete |
|---|---|---|---|---|
| `CommodityProduct` (Vendor) | ✅ `createCommodityProduct` (selalu `draft`) | ✅ `getCommodityProducts`/`ById`/`ByVendor` | ✅ `updateCommodityProduct` (field) + `updateCommodityProductStatus` (transisi) | ✅ `deleteCommodityProduct` — HANYA bila `draft` dan tidak direferensikan Availability/Selection (`isCommodityProductDeletable`); selain itu pakai Archive |
| `CommodityVariant` (Vendor) | ✅ `createCommodityVariant` | ✅ `getCommodityVariantsByProduct`/`ById` | ✅ `updateCommodityVariant` | ✅ `deleteCommodityVariant` — guarded (`isCommodityVariantDeletable`) |
| `AvailabilitySlot` (Vendor) | ✅ `createAvailabilitySlot` | ✅ `getAvailabilitySlotById`/`ByCommodity` | ✅ `updateAvailabilitySlotTotal` (kapasitas, tidak boleh < booked), `updateAvailabilitySlotDetails` (periode/cutoff/blackout) | ✅ `deleteAvailabilitySlot` — guarded (`isAvailabilitySlotDeletable`, held+booked harus 0) |
| `CommodityRequirement` (Client) | ✅ `createCommodityRequirement` (selalu `draft`) | ✅ `getCommodityRequirements`/`ById`/`ByProject`/`ByClient` | ✅ `updateCommodityRequirement` — HANYA saat `draft` (`isCommodityRequirementEditable`) | ✅ `deleteCommodityRequirement` — HANYA `draft`/`open` (`isCommodityRequirementDeletable`) |
| `CommoditySelection` (Client create, sistem+Vendor transisi) | ✅ `createCommoditySelection` (selalu `draft`, guard rank+duplikat) | ✅ `getCommoditySelectionsByRequirement`/`ById` | ✅ transisi status (`submitAndHoldCommoditySelection`, `confirmCommoditySelection`, `cancelCommoditySelectionHold`, `expireCommoditySelectionHold`) | ❌ Tidak ada delete langsung — dibatalkan lewat transisi status `cancelled`, bukan penghapusan record |
| `CommodityOrder` (sistem, Vendor kelola status) | ✅ `createCommodityOrderFromSelection` (dipanggil via `confirmCommodityOrderFromSelection`, HANYA dari Selection `confirmed`) | ✅ `getCommodityOrderById`/`ByVendor`/`ByClient`/`BySelection` | ✅ `updateCommodityOrderStatus` / `advanceCommodityOrderStatus` (transisi + sinkron Selection) | ❌ Tidak ada delete — Order adalah catatan permanen begitu terbentuk |

---

## 3. Happy Path & Alternative Path

### 3.1 Vendor create dan publish commodity

**Happy path:**
1. Vendor login (`role: supplier`) → `/supplier/commodities` → tombol "Buat Komoditas" → isi nama/kategori/harga jual/harga pokok (opsional) → `createCommodityProduct` → status awal `draft`.
2. Buka detail (`/supplier/commodities/[id]`) → tambah Variant (opsional, `createCommodityVariant`) → tambah Availability Slot (`createAvailabilitySlot`, wajib untuk bisa tampil "Available").
3. Klik "Publish" → `updateCommodityProductStatus(id, 'published')`. Setiap mutasi Availability (create/hold/release/confirm) memicu `syncCommodityProductAvailabilityStatus` yang otomatis menaikkan status ke `available`/`limited` (≤3 sisa stok agregat) / `sold-out` (0 sisa stok).

**Alternative/error path:**
- Publish ditolak bila status saat ini bukan `draft`/`suspended` (`COMMODITY_PRODUCT_STATUS_TRANSITIONS`) — toast error muncul (Phase 6 fix, sebelumnya gagal senyap).
- Harga pokok internal (`costPriceIdr`) hanya pernah tampil di halaman Vendor ini, tidak pernah dirender ke Client.

### 3.2 Client melihat catalog

**Happy path:**
1. Client login (`role: client`) → buka Requirement → "Cari Komoditas" → `/client/catalog/[requirementId]`.
2. `getCatalogVisibleCommodities()` menyaring HANYA `CommodityProduct` berstatus `published`/`available`/`limited` DAN `getCommodityTotalAvailable > 0` — `draft`/`archived`/`suspended`/`expired`/`sold-out` tidak pernah tampil.

**Alternative/error path:**
- Tidak ada komoditas cocok sama sekali → `EmptyState` "No Match".
- Ada komoditas cocok tapi search filter tidak menemukan apa pun → `EmptyState` "Tidak Ada Hasil" terpisah (Phase 6 fix — sebelumnya halaman kosong tanpa pesan).

### 3.3 Client membuat requirement

**Happy path:**
1. `/client/project-orders/[id]?tab=commodity` → "Tambah Kebutuhan Komoditas" → isi kategori/judul/quantity/detail spesifik kategori (tanggal check-in/out untuk hotel, dst.) → `createCommodityRequirement` (status `draft`).
2. Requirement bisa diedit selama `draft`, dihapus selama `draft`/`open`.

**Alternative/error path:**
- Edit/Delete disembunyikan otomatis (tombol tidak muncul) begitu requirement melewati `draft`/`open` — dicegah di data layer juga (`isCommodityRequirementEditable`/`Deletable`), bukan hanya UI.

### 3.4 Matching

**Happy path:**
1. Saat `/client/catalog/[requirementId]` dibuka, requirement `open` otomatis naik ke `matching`.
2. `matchCommoditiesForRequirement(requirementId)` — rule deterministik murni (kategori sama + `availableQty` vs `requirement.quantity` + cakupan tanggal periode Availability Slot) menghasilkan tier `exact-match` / `near-match` / `alternative` (tier `no-match` disaring dari hasil).
3. Hasil dikelompokkan 3 `SectionCard` terurut Exact → Near → Alternative, masing-masing hanya tampil bila ada isi.

**Alternative/error path:** kategori berbeda atau availability 0 → `no-match`, tidak muncul di hasil sama sekali (bukan ditampilkan sebagai grup kosong).

### 3.5 Client selection

**Happy path:**
1. Klik "Pilih" pada satu baris hasil matching → dialog: pilih Variant (bila ada), Quantity (dibatasi `maxSelectableQuantity`, tombol submit disabled bila melebihi), Choice Rank (Primary/Secondary/Third Choice).
2. "Simpan Draft" → `createCommoditySelection` saja (status `draft`, TIDAK menahan stok) — atau "Ajukan Selection" → lanjut ke 3.6 (Soft Hold) langsung.

**Alternative/error path:**
- Rank yang sama sudah aktif, atau commodity+variant yang sama sudah aktif dipilih → `createCommoditySelection` menolak (`hasActiveSelectionWithRank`/`hasActiveDuplicateSelection`) → toast error, bukan silent no-op.
- Quantity melebihi sisa availability → tombol submit disabled + pesan validasi inline.

### 3.6 Soft Hold

**Happy path:**
1. `submitAndHoldCommoditySelection(selectionId, slotId, holdExpiresAt)`: `draft → submitted → under-validation` → availability dicek ulang (`holdAvailabilityQuantity`, menaikkan `heldQuantity`) → `under-validation → soft-hold`, `holdExpiresAt = computeHoldExpiry()` (default H+3 dari `DEMO_REFERENCE_DATE`).
2. Selection Soft Hold tampil di tabel "Selected Commodities" (Client) dengan sisa hari sebelum expired.

**Alternative/error path:**
- Availability berubah (habis oleh pihak lain) tepat saat submit → `holdAvailabilityQuantity` gagal → status di-rollback, toast error "Availability Tidak Cukup Saat Submit".
- Client bisa membatalkan Soft Hold kapan saja (`cancelCommoditySelectionHold` → `releaseAvailabilityHold`, mengembalikan stok, status `cancelled`).

### 3.7 Confirmation

**Happy path:**
1. Vendor buka `/supplier/commodity-orders` (memanggil `sweepExpiredHolds()` di awal — Phase 6 fix) → bagian "Menunggu Konfirmasi" menampilkan Soft Hold selection milik komoditasnya (`getPendingSoftHoldSelectionsByVendor`, hanya yang belum punya Order).
2. Klik "Konfirmasi Order" → `confirmCommodityOrderFromSelection(selectionId, vendorId)`: validasi Soft Hold + kepemilikan vendor + **status commodity masih layak dijual** (`published`/`available`/`limited`/`sold-out`, Phase 6 guard) + belum ada Order duplikat → `confirmCommoditySelection` (`soft-hold → confirmed`, `confirmAvailabilityHold` memindahkan `heldQuantity → bookedQuantity`) → `createCommodityOrderFromSelection` (snapshot nama+harga → `CommodityOrder` baru, status `confirmed`).

**Alternative/error path:**
- Commodity sudah di-archive/suspend/expired sejak Soft Hold dibuat → konfirmasi ditolak, toast error eksplisit (Phase 6 fix — lihat 3.11).
- Hold sudah lewat `holdExpiresAt` → sudah di-sweep jadi `expired` sebelum vendor sempat melihatnya sebagai pending (lihat 3.9).
- Order untuk selection yang sama sudah pernah dibuat → ditolak (guard duplikasi).

### 3.8 Vendor sold commodity

**Happy path:**
1. `isCommodityOrderSold(status)` = `confirmed`/`booked`/`in-service`/`completed`. Begitu Order terbentuk (`confirmed`), langsung terhitung sold.
2. Vendor lanjutkan status di `/supplier/commodity-orders/[id]` (status timeline `Confirmed → Booked → In Service → Completed`, tombol transisi dari `getCommodityOrderStatusTransitions`) → `advanceCommodityOrderStatus` — men-sinkronkan `CommoditySelection.status` untuk `booked`/`completed`/`cancelled` sehingga **Client melihat status yang sama** di tabel Selected Commodities-nya.
3. Ringkasan "Sold Commodities" (`/supplier/commodity-orders`, `getVendorSoldCommoditiesSummary`) — total qty, jumlah order, revenue per komoditas, hanya dari Order yang `isCommodityOrderSold`.

**Alternative/error path:** Order dibatalkan (`cancelled`) di tengah jalan → langsung tidak lagi dihitung sold, dan Selection ikut disinkron ke `cancelled`. Transisi tidak valid (mis. `confirmed` langsung ke `completed`, lewati `booked`) ditolak.

### 3.9 Hold expired

**Happy path:**
1. `isHoldExpired(holdExpiresAt)` — predikat murni, dibandingkan `DEMO_REFERENCE_DATE`.
2. `sweepExpiredHolds()` — sapuan lazy (BUKAN cron/timer, keputusan desain sejak Phase 1), memanggil `expireCommoditySelectionHold` untuk tiap Soft Hold yang lewat expiry: mengembalikan `heldQuantity` (`releaseAvailabilityHold`) dan mengubah status Selection ke `expired`.
3. Dipanggil di **dua** titik: saat Client membuka `/client/catalog/[requirementId]` (Phase 4) DAN saat Vendor membuka `/supplier/commodity-orders` (Phase 6 fix — sebelumnya hanya sisi Client, celah yang memungkinkan Vendor mengonfirmasi hold yang seharusnya sudah expired).

**Alternative/error path:** Selection yang sudah `expired` tidak bisa lagi dikonfirmasi (`confirmCommodityOrderFromSelection` menolak karena status bukan `soft-hold`).

### 3.10 Sold out

**Happy path:**
1. Setiap mutasi Availability (hold/release/confirm/create/update slot) memanggil `syncCommodityProductAvailabilityStatus` → bila agregat sisa stok lintas-variant = 0, status Product otomatis `sold-out`.
2. Product `sold-out` langsung hilang dari katalog Client (`getCatalogVisibleCommodities` mensyaratkan `availableQty > 0`).

**Alternative/error path:** Selection yang **sudah** Soft Hold sebelum produk jadi `sold-out` (karena selection itu sendiri yang menghabiskan stok) tetap valid dikonfirmasi — stoknya sudah dicadangkan lebih dulu, bukan "menjual stok yang tidak ada" (diverifikasi eksplisit di `commodity-regression.test.ts`).

### 3.11 Commodity archived

**Happy path:** Vendor klik "Archive" di `/supplier/commodities/[id]` (`canArchive`, hanya butuh status ≠ `archived`) → `updateCommodityProductStatus(id, 'archived')` → produk hilang dari katalog Client, data historis (Order/Selection lama) tetap utuh.

**Alternative/error path (defect Phase 6, sudah diperbaiki):** Sebelum Phase 6, Soft Hold yang sudah ada SEBELUM produk di-archive tetap bisa dikonfirmasi jadi Order (menjual listing yang sudah ditutup vendor). Sekarang `confirmCommodityOrderFromSelection` menolak konfirmasi untuk produk berstatus `archived`/`expired`/`suspended`/`draft`, dengan toast error yang menjelaskan alasannya.

**Known limitation (belum diperbaiki, disengaja minimal-scope Phase 6):** aksi Archive/Unpublish itu sendiri TIDAK memblokir atau memperingatkan vendor bila masih ada Selection aktif (Soft Hold/Confirmed/Booked) yang mereferensikan produk tsb — hanya jalur "menjual" (konfirmasi Order) yang dijaga, bukan jalur "mengarsipkan". Lihat bagian Known Limitations.

### 3.12 Availability changed

**Happy path:** Vendor mengubah kapasitas slot (`updateAvailabilitySlotTotal`) — ditolak bila nilai baru negatif atau lebih kecil dari `bookedQuantity` yang sudah terbentuk (mencegah kapasitas "menghilangkan" stok yang sudah terjual). Setiap perubahan memicu ulang `syncCommodityProductAvailabilityStatus`, sehingga status Product (dan karenanya visibilitas katalog Client) selalu konsisten dengan Availability terbaru tanpa perlu refresh manual di tempat lain.

**Alternative/error path:** Update ditolak → toast error "Kapasitas tidak boleh negatif atau kurang dari jumlah yang sudah booked."

### 3.13 Permission boundary

**Vendor isolation:** `usePermissions().vendorScopeId` — `getCommodityProductsByVendor`, `getCommodityOrdersByVendor`, `getPendingSoftHoldSelectionsByVendor` semua menyaring ketat berdasarkan `vendorId`. Setiap halaman Vendor punya computed `isOwn` (`commodity.vendorId === vendorScopeId`) + `RoleAccessState` bila `!canView('supplier-portal') || !vendorScopeId`.

**Client isolation:** `usePermissions().clientScopeId` — `getCommodityRequirementsByClient`, `getCommodityOrdersByClient` (join lewat Selection → Requirement, karena `CommodityOrder` sendiri tidak menyimpan `clientPartyId` langsung) menyaring berdasarkan `clientPartyId`. Setiap halaman Client punya computed `isOwn`/`isOwnCompany` + `RoleAccessState` serupa.

**Data sanitization:** Client tidak pernah melihat `costPriceIdr`/markup/margin Vendor. Vendor Order menyimpan **snapshot** nama+harga saat konfirmasi — perubahan harga/nama produk setelahnya tidak memengaruhi Order yang sudah terbentuk (diverifikasi test snapshot immutability).

**Direct URL access:** Mengakses ID yang tidak ada atau bukan milik sendiri lewat URL langsung selalu menampilkan halaman "Tidak Ditemukan" yang aman (`v-if="!record || !isOwn"`), tidak pernah melempar error/crash.

---

## 4. Known Limitations

- Archive/Unpublish Commodity Product tidak memblokir/memperingatkan adanya Selection aktif yang mereferensikannya (lihat 3.11) — dampak nyatanya sudah dicegah di jalur konfirmasi Order, tapi vendor tidak mendapat sinyal proaktif saat aksi Archive itu sendiri dilakukan.
- `CommodityOrder` tidak punya field riwayat status (`statusHistory`) tersimpan — "Status Timeline" di UI adalah representasi visual dari urutan status literal (`confirmed → booked → in-service → completed`), bukan log timestamp per transisi.
- Pembatalan Order (`cancelled`) setelah `booked`/`in-service` tidak mengembalikan `bookedQuantity` pada Availability Slot — konsisten dengan batasan yang sama pada `cancelCommoditySelectionHold` (hanya melepas stok dari status `soft-hold`), didokumentasikan sebagai batasan yang disengaja, bukan diperbaiki di Phase 6 karena di luar 18 item checklist regresi eksplisit.
- Tidak ada backend/database sungguhan — seluruh state hilang saat reload kecuali di-reset manual ke seed lewat `/settings` (pola sama seluruh aplikasi).
- Perkakas lint (`eslint`) melaporkan 119 error pre-existing di `nuxt.config.ts`/`tailwind.config.ts` (gaya kode, bukan bug fungsional) yang sudah ada sebelum fitur ini dan berada di luar scope Client–Vendor Commodity — tidak disentuh.

---

## 5. Referensi Silang

- Spesifikasi tiap fase: `phases/PHASE_01_Domain_Types_Store_Mock_Data.md` … `phases/PHASE_06_Regression_Edge_Cases.md`
- Hasil test/typecheck/lint/build aktual serta daftar defect Phase 6: lihat `MANOVA-Laporan-Progres-2026-08-01.html`, bagian "Client–Vendor Commodity".
