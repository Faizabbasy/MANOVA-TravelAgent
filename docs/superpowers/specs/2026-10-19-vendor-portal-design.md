# Portal vendor di atas tabel yang sudah ada (S12d) — desain

Tanggal: 19 Oktober 2026 · Branch: `production` · Status: disetujui (eksekusi native)

Portal vendor (`/supplier/*`, role `vendor`, aktif hanya di dev/staging — ADR-006) membaca service order, quotation
vendor, layanan/booking dan profil vendornya dari server, bisa **acknowledge / fulfilled** service order (bug: selalu
404), dan menambah produk lewat server. RFQ (S12e), komoditas (S12f), amandemen SO, serta kontak/dokumen/pesan/tagihan
vendor (belum ada UI portal) di luar lingkup.

## Keputusan pengguna

1. Lingkup inti: perbaikan status SO + data portal dari server + produk vendor (lihat & tambah).
2. Vendor hanya boleh **acknowledge** (`sent → acknowledged`) dan **fulfilled** (`acknowledged`/`amended → fulfilled`);
   membatalkan SO tetap hak staf.
3. Produk baru dari vendor **langsung tersimpan** atas nama vendornya; staf mendapat notifikasi.

## Masalah yang ditutup

1. `POST /service-orders/:id/status` menolak semua user portal dengan 404 (`isPortalActor ? null`), padahal
   `GET /service-orders/:id` sudah tersedia untuk vendor pemiliknya — tombol Acknowledge/Fulfilled di portal selalu gagal.
2. Sync plan vendor hanya `projects` + `notifications`: SO, quotation, layanan/booking dan profil vendor di portal masih
   fixture lokal, padahal endpoint baca-nya sudah dibatasi per vendor.
3. Tambah produk di "My Products" hanya mengubah array lokal; `/vendor-products` & `POST /vendors/:id/products` menolak
   vendor.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Status SO | `POST /service-orders/:id/status` mendapat cabang vendor: SO harus milik vendor sesi (`getServiceOrder` yang sudah dibatasi `vendor_id`; bukan miliknya → 404); `to` hanya `acknowledged` atau `fulfilled` (lainnya → 403 "Vendor hanya bisa mengonfirmasi atau menandai selesai."); transisi tetap divalidasi `SERVICE_ORDER_TRANSITIONS` (422). Log aktivitas project yang ada (`logOrderStatus`) + notifikasi ke owner project. Client tetap 404; jalur internal tidak berubah |
| Baca dari server | Sync plan vendor = `projects`, `notifications`, `procurement` (quotation vendor + SO, sudah dibatasi), `bookings` (layanan + booking, DTO vendor tanpa harga jual), `vendorPortal` (profil vendor sendiri lewat `GET /vendors/:id` + produknya). Daftar vendor & katalog internal tetap tidak dimuat (403 untuk vendor) |
| Produk | Endpoint khusus vendor `GET /api/v1/vendor/products` (produk vendor sesi) dan `POST /api/v1/vendor/products` (Idempotency-Key; validasi sama `createVendorProduct`: nama, kategori, deskripsi, harga ≥ 0 opsional). Hanya role vendor dengan `vendorId`; role lain 403. Notifikasi ke semua admin aktif (pemegang `vendor.manage-vendor`) |
| Frontend | `data/vendor-portal-sync.ts` (muat profil + produk, tambah produk server-first). "My Products" memakai `createSaveGate`. Halaman SO vendor sudah memanggil server untuk SO server — cukup perbaikan backend; SO lokal `SO-L` (asal RFQ) tetap lokal sampai S12e |

## Testing

- Backend `test/vendor-portal.test.ts`: vendor acknowledge/fulfill SO miliknya (log aktivitas + notifikasi owner);
  SO vendor lain 404; `to: cancelled`/`sent` 403; transisi salah 422; client 404; jalur internal tetap. Produk: list
  hanya milik vendor sesi; tambah 201 (+ replay key sama = satu baris), validasi 400, role lain 403, admin dapat notifikasi.
- Frontend: tes `vendor-portal-sync`, sync-plan vendor, guard produk, `pnpm test`, vue-tsc ≤ 1986, eslint vs HEAD, build.

## Deploy

Tanpa migrasi.
