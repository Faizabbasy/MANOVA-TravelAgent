import type { Component } from 'vue'
import type { BadgeTone, ID } from './common'
import type { ModuleKey, PermissionLevel, RoleId } from './user'

/**
 * RBAC dinamis (Revisi 9-Modul, P0) — menggantikan matriks compile-time `ROLE_MODULE_ACCESS`
 * (`app/constants/roles.ts`) dengan data reaktif yang bisa dibuat/diubah dari UI Administration.
 *
 * Empat entitas, sengaja dipisah menjadi baris-baris grant (bukan satu object bersarang) agar:
 *   1. Role baru cukup menambah baris, tidak perlu mengisi SELURUH kolom modul (dense literal lama
 *      memaksa 17 key per role — sumber utama kenapa menambah role jadi mahal).
 *   2. Baris yang tidak ada === `NONE` / inherit, sehingga diff perubahan permission kecil dan terbaca.
 *   3. Mutasi bisa in-place pada array `reactive()`, konsisten dengan seluruh data layer mock ini.
 *
 * Catatan tipe: `RoleId`/`ModuleKey` kini `string` (lihat `app/types/user.ts`) karena role dibuat saat
 * runtime — union TS tidak lagi mungkin. Kompensasinya: `KnownModuleKey` (autocomplete),
 * `resolveModuleKey()` + dev warning (typo tidak hilang diam-diam), dan capability bernama
 * (`app/constants/capabilities.ts`) untuk menggantikan perbandingan role literal yang tersebar.
 */

export type RoleKind = 'internal' | 'portal'

export interface RoleDefinition {
  id: RoleId
  label: string
  tone: BadgeTone
  order: number
  kind: RoleKind
  /** Role seed bawaan sistem — boleh diedit permission-nya, TIDAK boleh dihapus. */
  isSystem: boolean
  /**
   * Bypass total matriks grant (selalu `ADMIN` di semua modul/menu/capability). Hanya `super-admin`.
   * Ini adalah guard rail anti self-lockout utama: tanpa backend, role yang salah dikonfigurasi tidak
   * bisa dipulihkan dari server — harus selalu ada satu role yang mustahil terkunci.
   */
  isSuperAdmin?: boolean
  /** Menggantikan `FULL_FINANCIAL_VISIBILITY_ROLES` (dulu array literal terpisah). */
  canViewFullFinancials: boolean
  /**
   * Isolasi portal — menggantikan cek literal `currentRole === 'supplier'` / `=== 'client'` di
   * `usePermissions`. Menentukan field `User` mana yang membatasi seluruh query role ini.
   */
  scopeField?: 'vendorId' | 'clientPartyId'
  description?: string
  clonedFromRoleId?: RoleId
  createdAt?: string
  createdBy?: ID
}

/** Satu baris per role × modul. Baris absen === `NONE`. */
export interface RoleModuleGrant {
  roleId: RoleId
  moduleKey: ModuleKey
  level: PermissionLevel
}

/**
 * Grant level-menu — meng-override grant modul untuk SATU entri nav saja. Baris absen === inherit
 * dari modul. Inilah yang membuat "assign menu ke role" mungkin tanpa harus menciptakan satu modul
 * per halaman. Key-nya `NavItem.key` (slug stabil), BUKAN label atau route — supaya rename label /
 * pindah route tidak diam-diam mencabut akses.
 */
export interface RoleMenuGrant {
  roleId: RoleId
  menuKey: string
  level: PermissionLevel
}

/** Action flag granular — menggantikan `['project-manager','super-admin'].includes(currentRole)`. */
export interface RoleCapabilityGrant {
  roleId: RoleId
  capabilityKey: string
  granted: boolean
}

export interface CapabilityDefinition {
  key: string
  label: string
  /** Dipakai untuk mengelompokkan checkbox di Admin > Roles > Action Flags. */
  group: string
  description?: string
}

export type ModuleGroup = 'business' | 'system'

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  group: ModuleGroup
  order: number
  icon: Component
}

/** Bentuk hasil evaluasi gerbang — dipakai bersama oleh RBAC dan workflow Project Order (P4). */
export interface GateResult {
  ready: boolean
  blockers: string[]
}
