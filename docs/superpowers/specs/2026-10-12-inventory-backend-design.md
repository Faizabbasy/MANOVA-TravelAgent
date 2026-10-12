# Backend inventory (S11a) — desain

Tanggal: 12 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-12-inventory-backend)

S11 dipecah: **S11a** inventory (dokumen ini), **S11b** marketing (jadwal & pengembangan konten), **S11c** HR (perlu
keputusan pemilik angka gaji dulu).

## Masalah yang ditutup

1. Aset, jadwal maintenance dan peminjaman aset hanya ada di memori browser.
2. Syarat "seluruh aset sudah dikembalikan" di langkah Done hanya dicek di UI; `POST /projects/:id/close` tidak tahu soal aset.
3. UI tidak punya cara meminjamkan aset ke project atau menjadwalkan maintenance — data pinjaman hanya dari fixture.

## Keputusan

| Topik | Keputusan |
|---|---|
| Hak tulis | `inventory.manage-asset` (Admin + Super Admin, sudah ada) |
| Hak baca | Semua peran internal; portal 403 |
| Aset | `AST-…`; kode per kategori dibuat server (`CAM-`, `PRD-`, `PRP-`, `VHC-`, `IT-` + nomor). Kategori tidak bisa diubah setelah dibuat (kode ikut kategori). Status `in-use` hanya lewat peminjaman; ubah status manual hanya ke `available`/`maintenance`/`retired` dan ditolak selama aset sedang dipinjam |
| Nilai | `purchasePriceMinor` (aset) dan `costMinor` (maintenance) — angka operasional aset, bukan pembukuan Finance; desimal string, opsional |
| Peminjaman | `ACO-…`; aset harus `available`; project (opsional) harus ada dan belum ditutup; peminjam = user internal aktif (default: aktor); `dueOn` ≥ hari ini; satu peminjaman terbuka per aset (index unik). Aset → `in-use` |
| Pengembalian | Kondisi wajib; aset ikut kondisi itu, status `available` (atau `maintenance` bila `damaged`) |
| Maintenance | `MNT-…`; jadwalkan (tipe, tanggal, vendor, biaya, catatan, interval hari opsional); selesaikan → `completedOn` hari ini; aset yang berstatus `maintenance` kembali `available` kondisi `good` |
| Terlambat | Tidak disimpan: peminjaman terbuka lewat `dueOn` dan maintenance belum selesai lewat `scheduledOn` dikirim sebagai `overdue` (dihitung dari tanggal hari ini) |
| Tutup project | `closeProject` menolak 422 selama ada peminjaman terbuka untuk project itu (nama aset disebut) |
| Audit | `asset.created/updated/checked_out/returned`, `asset_maintenance.scheduled/completed` |
| Seed | Aset, maintenance, peminjaman dari fixture; seed ulang tidak menimpa baris yang diubah API |
| Tetap lokal | Ringkasan & utilisasi (dihitung di browser dari data server) |

## Backend

- Migrasi `0036_inventory`: `assets`, `asset_maintenance`, `asset_checkouts` (+ index unik satu peminjaman terbuka per aset).
- `core/inventory.ts` + `core/inventory-routes.ts`: `GET /assets`, `GET /asset-maintenance`, `GET /asset-checkouts`,
  `POST /assets`, `PATCH /assets/:id`, `POST /asset-checkouts`, `POST /asset-checkouts/:id/return`,
  `POST /asset-maintenance`, `POST /asset-maintenance/:id/complete`.
- `project-workflow.closeProject`: blocker aset.

## Frontend

- Types/endpoints; `data/inventory-sync.ts` (muat ke `ASSETS`/`MAINTENANCE_SCHEDULES`/`ASSET_CHECKOUTS`, aksi server-first).
- Halaman Inventory server-first + dialog baru **Pinjamkan Aset** dan **Jadwalkan Maintenance**.
- Layout & reset Settings memuat inventory; guard melarang `addAsset(`, `updateAsset(`, `returnAsset(`, `completeMaintenance(`.

## Testing

- Backend `test/inventory.test.ts`: baca (internal/portal/401), aset (validasi, kode, finance 403, status manual), pinjam
  (aset tidak tersedia 422, project ditutup 422, dua peminjaman 422), kembali, maintenance, overdue, tutup project ditolak
  selama aset belum kembali; seed tidak menimpa perubahan API.
- Frontend: tes `inventory-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0036` otomatis. Setelah push: `bun run db:seed:demo` sekali.
