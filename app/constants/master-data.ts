/**
 * Master data constants — Section 17 (Administration), MIGRASI Section 23 (Administration, Master Data
 * dan Audit, roadmap Section 00–24 baru, D-080).
 *
 * Data dan `interface MasterDataItem` sudah DIPINDAHKAN ke `app/data/master-data.ts` (kini `reactive()`,
 * dapat dimutasi lewat `createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/
 * `reactivateMasterDataRecord`, `app/data/index.ts`) — file ini dipertahankan sebagai RE-EXPORT murni
 * agar konsumen lama (bila ada di luar yang sudah diverifikasi) tidak patah. Per audit Section 23,
 * satu-satunya konsumen aktual (`app/pages/admin/master-data.vue`) sudah diperbarui memakai `~/data`
 * langsung — file ini murni jaring pengaman kompatibilitas, BUKAN sumber data lagi.
 */
export type { MasterDataItem } from '~/types/master-data'
export { MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES } from '~/data/master-data'
