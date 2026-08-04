import {
  TrendingUp,
  Wallet,
  Heart,
  Building2,
  Route,
  UserCog,
  Package,
  Megaphone,
  BarChart3,
  ShieldCheck,
  Briefcase,
  Truck,
  FileText
} from 'lucide-vue-next'
import type { ModuleDefinition } from '~/types/rbac'
import type { ModuleKey } from '~/types/user'

/**
 * Sembilan modul bisnis (Revisi 9-Modul) — mengikuti daftar modul/fitur yang diminta klien, menggantikan
 * 17 `ModuleKey` lama yang tumbuh organik per-section (`ticketing`/`accommodation`/`transportation`/`mice`
 * sempat menjadi modul sendiri-sendiri). Empat modul `system` di bawahnya BUKAN bagian dari sembilan modul
 * bisnis, tapi tetap perlu digerbangi terpisah (Administration, dua portal eksternal, dan Documents yang
 * dipakai lintas modul).
 *
 * Modul lama TIDAK dihapus begitu saja — dipetakan lewat `LEGACY_MODULE_ALIAS` di bawah, sehingga 92 dari
 * 108 call-site `canView`/`canManage`/`canApprove` yang ada tetap bekerja tanpa disentuh sama sekali.
 */
export const MODULES: ModuleDefinition[] = [
  { key: 'sales', label: 'Sales', description: 'Lead, opportunity, quotation, sales order, forecast, dan channel management.', group: 'business', order: 1, icon: TrendingUp },
  { key: 'finance-acc', label: 'Finance & ACC', description: 'General ledger, AR/AP, revenue, multi currency, pajak, dan opex.', group: 'business', order: 2, icon: Wallet },
  { key: 'crm', label: 'CRM', description: 'Database customer, riwayat & preferensi perjalanan, follow-up, loyalty, review.', group: 'business', order: 3, icon: Heart },
  { key: 'vendor-partner', label: 'Vendor & Partner Management', description: 'Data vendor, kontrak & SLA, penjadwalan, pembayaran, dan rating internal.', group: 'business', order: 4, icon: Building2 },
  { key: 'operations', label: 'Operations & Scheduling', description: 'Project order, itinerary, resource scheduling, booking calendar, change request, status trip.', group: 'business', order: 5, icon: Route },
  { key: 'hr', label: 'Human Resource Management', description: 'Data karyawan, absensi & payroll, komisi & insentif, performance dan productivity tracking.', group: 'business', order: 6, icon: UserCog },
  { key: 'inventory', label: 'Inventory', description: 'Kamera & alat produksi, properti pendukung, dan jadwal maintenance milik MANOVA.', group: 'business', order: 7, icon: Package },
  { key: 'marketing', label: 'Marketing & Analysis', description: 'Campaign tracking, promo & voucher, conversion funnel, CAC, dan customer LTV.', group: 'business', order: 8, icon: Megaphone },
  { key: 'bi', label: 'Reporting & Business Intelligence', description: 'Dashboard real-time, revenue, cost per trip, vendor performance, dan marketing ROI.', group: 'business', order: 9, icon: BarChart3 },
  { key: 'administration', label: 'Administration', description: 'User, role & permission, master data, audit trail, dan profil organisasi.', group: 'system', order: 10, icon: ShieldCheck },
  { key: 'documents', label: 'Documents & Communication', description: 'Document center, pesan, dan notifikasi lintas modul.', group: 'system', order: 11, icon: FileText },
  { key: 'client-portal', label: 'Client Portal', description: 'Portal self-service klien, diisolasi per company (`clientPartyId`).', group: 'system', order: 12, icon: Briefcase },
  { key: 'vendor-portal', label: 'Vendor Portal', description: 'Portal self-service vendor, diisolasi per vendor company (`vendorId`).', group: 'system', order: 13, icon: Truck }
]

export const MODULE_KEYS = MODULES.map(module => module.key)

const MODULE_KEY_SET = new Set(MODULE_KEYS)

export const BUSINESS_MODULES = MODULES.filter(module => module.group === 'business')

export function isKnownModuleKey (key: string): boolean {
  return MODULE_KEY_SET.has(key)
}

export function getModuleDefinition (key: ModuleKey): ModuleDefinition | undefined {
  return MODULES.find(module => module.key === resolveModuleKey(key))
}

export function getModuleLabel (key: ModuleKey): string {
  return getModuleDefinition(key)?.label ?? key
}

/**
 * Peta `ModuleKey` lama → modul baru. INI kunci agar restrukturisasi tidak memaksa menyentuh ratusan
 * call-site: halaman lama tetap memanggil `canView('project')`/`canView('bookings')`/dst. dan otomatis
 * teresolusi ke modul barunya.
 *
 * `crm` SENGAJA tidak ada di sini — ia key kanonik baru sekaligus key lama, tapi cakupannya menyempit
 * (dulu mencakup lead/opportunity/quotation juga). Ke-20 call-site `'crm'` yang sebenarnya bermakna
 * Sales disweep manual di P2, tidak bisa lewat alias.
 *
 * `administration`, `client-portal`, dan `documents` juga tidak ada di sini karena identitas (key lama
 * === key baru), jadi langsung lolos cek `isKnownModuleKey`.
 */
export const LEGACY_MODULE_ALIAS: Record<string, ModuleKey> = {
  project: 'operations',
  bookings: 'operations',
  changes: 'operations',
  ticketing: 'operations',
  accommodation: 'operations',
  transportation: 'operations',
  mice: 'operations',
  vendor: 'vendor-partner',
  procurement: 'vendor-partner',
  finance: 'finance-acc',
  reports: 'bi',
  'product-planning': 'sales',
  'supplier-portal': 'vendor-portal'
}

const warnedModuleKeys = new Set<string>()

/**
 * Normalisasi module key ke key kanonik. Key tak dikenal dikembalikan apa adanya (akan resolve ke `NONE`)
 * TAPI diberi peringatan sekali di dev — tanpa ini, satu typo module key membuat halaman hilang diam-diam
 * karena `RANK[undefined] >= RANK.VIEW` bernilai `false`, bukan error.
 */
export function resolveModuleKey (key: ModuleKey): ModuleKey {
  if (MODULE_KEY_SET.has(key)) { return key }
  const aliased = LEGACY_MODULE_ALIAS[key]
  if (aliased) { return aliased }
  if (import.meta.dev && !warnedModuleKeys.has(key)) {
    warnedModuleKeys.add(key)
    console.warn(`[rbac] Module key tidak dikenal: "${key}" — diperlakukan sebagai NONE. Tambahkan ke MODULES atau LEGACY_MODULE_ALIAS (app/constants/modules.ts).`)
  }
  return key
}
