import type { ID } from './common'

/**
 * Sejak Revisi 9-Modul, role dibuat/dihapus saat runtime dari Admin > Roles — sehingga `RoleId` TIDAK
 * bisa lagi berupa union TS. Definisi role yang sebenarnya ada di `app/data/rbac.ts` (`ROLE_DEFINITIONS`).
 *
 * `KnownRoleId` di bawah hanya dokumentasi role seed dan tetap dipakai untuk memberi autocomplete pada
 * literal yang ditulis manual — bukan pembatas. Kehilangan exhaustiveness check dikompensasi oleh:
 *   - capability bernama (`app/constants/capabilities.ts`) menggantikan perbandingan role literal,
 *   - `resolveRoleId()` yang menerjemahkan role id lama, dan
 *   - test `app/data/rbac.test.ts` yang memverifikasi tidak ada akses yang hilang.
 *
 * Penyederhanaan 7-Role: `crm`/`marketing` melebur ke `sales`, `bi`/`hr` ke `management`,
 * `vendor-partner`/`inventory` ke `operations` (`LEGACY_ROLE_ALIAS`, `app/data/rbac.ts`) — id lama tetap
 * diterjemahkan otomatis, hanya tidak lagi jadi `ROLE_DEFINITIONS` tersendiri.
 */
export type KnownRoleId =
  | 'super-admin'
  | 'management'
  | 'sales'
  | 'finance'
  | 'operations'
  | 'client'
  | 'vendor'

export type RoleId = KnownRoleId | (string & {})

export type PermissionLevel = 'NONE' | 'VIEW' | 'MANAGE' | 'APPROVE' | 'ADMIN'

/**
 * Sembilan modul bisnis + empat modul sistem — definisi lengkapnya (label, deskripsi, ikon, urutan) ada di
 * `app/constants/modules.ts`. Module key lama (`project`, `bookings`, `ticketing`, `procurement`, dst.)
 * tetap valid dipakai karena diterjemahkan otomatis lewat `LEGACY_MODULE_ALIAS`, sehingga halaman lama
 * tidak perlu disweep serentak.
 */
export type KnownModuleKey =
  | 'sales'
  | 'finance-acc'
  | 'crm'
  | 'vendor-partner'
  | 'operations'
  | 'hr'
  | 'inventory'
  | 'marketing'
  | 'bi'
  | 'administration'
  | 'documents'
  | 'client-portal'
  | 'vendor-portal'

export type ModuleKey = KnownModuleKey | (string & {})

/** Access review / suspend state (Section 23 — Administration, Master Data dan Audit, D-080). */
export type UserStatus = 'active' | 'suspended'

export interface User {
  id: ID
  name: string
  email: string
  role: RoleId
  status: UserStatus
  /** WAJIB diisi saat `status` berpindah ke `suspended` — pola alasan-wajib yang sama dengan seluruh transisi destruktif lain di codebase ini. Dikosongkan kembali oleh `reactivateUser`. */
  suspendedReason?: string
  suspendedAt?: string
  /** Isolasi vendor — hanya terisi untuk role portal ber-`scopeField: 'vendorId'`; menentukan satu-satunya `Vendor` company yang boleh dilihat user ini. */
  vendorId?: ID
  /** Isolasi client — hanya terisi untuk role portal ber-`scopeField: 'clientPartyId'`; menentukan satu-satunya `Party` (company) yang boleh dilihat user ini di `/client/*`. */
  clientPartyId?: ID
}
