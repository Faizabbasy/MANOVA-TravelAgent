# Backend master data & profil organisasi (S10b) — desain

Tanggal: 12 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-12-master-data-backend)

Lanjutan S10a. **S10b** memindahkan 16 kategori master data (`/admin/master-data`) dan profil organisasi (tab
Organization Profile) ke server. Editor RBAC tetap lokal (keputusan S10a: matriks izin server tetap di kode).

## Masalah yang ditutup

1. Tambah/ubah/nonaktifkan master data dan ubah profil organisasi hanya mengubah memori browser: hilang saat reload,
   tidak terlihat user lain, tidak tercatat di jejak audit server.
2. Milestone template (dipakai "Terapkan Template" di Timeline Tracking) tidak konsisten antar user.

## Keputusan

| Topik | Keputusan |
|---|---|
| Penyimpanan | Satu tabel generik `master_data_records` (`category`, `id`, `is_active`, `data jsonb`); field per kategori divalidasi di server lewat skema di kode. Profil organisasi: tabel singleton `organization_profile` (`id = 'ORG-001'`) |
| Kategori | 16 kunci `MasterDataCategoryKey` yang sama dengan frontend, prefix ID sama (`PT-`, `ST-`, `DST-`, `VC-`, `APT-`, `ALN-`, `MHTL-`, `CUR-`, `TAX-`, `PTM-`, `CXR-`, `NUM-`, `DTPL-`, `RGC-`, `ASR-`, `MTPL-`) |
| Hak tulis | `admin.manage-master-data` (Admin + Super Admin, sudah ada di matriks) untuk master data **dan** profil organisasi — sama dengan gate UI `canManage('administration')` |
| Hak baca | Semua peran internal (`GET /master-data`, `GET /organization-profile`); portal 403 |
| Validasi | Teks wajib (trim, tidak kosong, maks 200; teks panjang maks 2000); angka wajib dan hingga batas wajar (persen 0–100, hari ≥ 0 bulat, bintang hotel 1–5 bulat); kode IATA bandara 3 huruf, maskapai 2 karakter, kode currency 3 huruf, di-uppercase; kode itu unik dalam kategorinya (422). Field tak dikenal ditolak 400 |
| Milestone template | `items` wajib ≥ 1 (`label` wajib, `offsetDays` bulat −365…365); id item dibuat server: `<id template>-<n>` |
| Ubah | `PATCH` menggabungkan field yang dikirim lalu memvalidasi record utuh |
| Nonaktif/aktif | Endpoint terpisah; aksi ke status yang sama → 422. Tidak ada hapus |
| Profil organisasi | `PUT` field lengkap: `legalName`, `displayName`, `address`, `contactEmail` wajib (email valid); `defaultCurrencyCode` harus currency aktif (currency itu tidak bisa dinonaktifkan atau diganti kodenya selama dipakai profil); `businessHours`, `contactPhone` boleh kosong. Server mengisi `updatedAt`/`updatedBy` |
| Audit | `master_data.created/updated/deactivated/reactivated`, `organization.updated` (modul Activity Center: administration) |
| Seed | Seluruh 16 kategori + profil dari fixture frontend (`provenance='demo-fixture'`); seed ulang tidak menimpa record yang diubah lewat API (`changed_by_api_at`) |
| Tetap lokal | Hitungan pemakaian ("dipakai di N record", dihitung dari data yang sudah dimuat), editor RBAC |

## Backend

- Migrasi `0035_master_data`: `master_data_records (id text pk, category text check in 16, is_active bool, data jsonb,
  provenance, changed_by_api_at, created_at, updated_at)` + index `(category, id)`; `organization_profile` dengan check
  `id = 'ORG-001'`, kolom profil, `updated_by` → users, `provenance`, `changed_by_api_at`, `updated_at`.
- `core/master-data.ts`: `CATEGORIES` (prefix + field), `validateRecord`, `listMasterData`, `createMasterRecord`,
  `updateMasterRecord`, `setMasterRecordActive`, `getOrganizationProfile`, `updateOrganizationProfile`.
- `core/master-data-routes.ts`: `GET /master-data`, `POST /master-data/:category` (Idempotency-Key),
  `PATCH /master-data/:category/:id`, `POST /master-data/:category/:id/deactivate|reactivate`,
  `GET /organization-profile`, `PUT /organization-profile`.
- `shared/ids.ts`: 16 prefix terdaftar dari `master_data_records` per kategori.

## Frontend

- `types/api.ts` + endpoints; `data/master-data-sync.ts`: muat semua kategori ke array reactive yang ada (urutan server,
  identitas objek dipertahankan), profil via `Object.assign`; aksi server-first (`createMasterRecordOnServer` dkk.).
- `pages/admin/master-data.vue` dan `OrganizationProfilePanel` memakai server + save gate; form profil di-reset ke data
  server setelah muat.
- Layout (peran internal) dan reset di Settings memuat master data.
- Guard melarang `createMasterDataRecord(`, `updateMasterDataRecord(`, `deactivateMasterDataRecord(`,
  `reactivateMasterDataRecord(`, `updateOrganizationProfile(` di layar.

## Testing

- Backend (`test/master-data.test.ts`): baca (internal 200, portal 403, 401); buat per kategori (validasi 400, kode
  duplikat 422, field tak dikenal 400, finance 403, Idempotency-Key wajib); ubah (gabung + validasi, 404); nonaktif/aktif
  (422 bila sama); milestone template (items wajib, id item); profil (validasi, currency harus aktif, finance 403); audit
  tercatat; seed tidak menimpa perubahan API.
- Frontend: tes `master-data-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0035` otomatis. Setelah push: `bun run db:seed:demo` sekali.
