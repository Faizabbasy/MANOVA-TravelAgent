import type { CapabilityDefinition } from '~/types/rbac'
import type { ServiceTypeKey } from '~/types/project'

/**
 * Action flag bernama (Revisi 9-Modul, P0/P1) — menggantikan "narrow role exception" yang tersebar sebagai
 * array role literal di dalam halaman, mis. `['account-executive','super-admin'].includes(currentRole.value)`
 * (`app/pages/crm/opportunities/[id]/index.vue`) atau `SERVICE_TYPE_ROLE_MAP`
 * (`app/pages/projects/[id]/index.vue`).
 *
 * Kenapa harus dipindah: begitu role bisa dibuat saat runtime, role literal di dalam halaman menjadi mati —
 * role custom baru tidak akan pernah masuk daftar hardcoded itu, berapa pun permission modul yang diberikan
 * admin. Capability membuat gerbang halus tsb ikut bisa di-assign dari Admin > Roles > Action Flags.
 *
 * Granularity modul (`canView`/`canManage`) TETAP menjadi gerbang utama — capability hanya untuk kasus di
 * mana rank modul tidak cukup presisi, sesuai D-030.
 */
export const CAPABILITY_GROUPS = {
  projectOrder: 'Project Order',
  sales: 'Sales & CRM',
  finance: 'Finance',
  people: 'HR & Inventory',
  administration: 'Administration'
} as const

/** Helper agar penulisan key service tidak dieja manual di banyak tempat. */
export function serviceCapabilityKey (serviceType: ServiceTypeKey): string {
  return `project-order.manage-service.${serviceType}`
}

export const CAPABILITIES: CapabilityDefinition[] = [
  // Project Order — menggantikan gerbang halus di app/pages/projects/[id]/index.vue
  { key: 'project-order.accept-handover', label: 'Terima / tolak handover Project Order', group: CAPABILITY_GROUPS.projectOrder },
  { key: 'project-order.manage-operations', label: 'Kelola operasional project (service, vendor, booking)', group: CAPABILITY_GROUPS.projectOrder },
  { key: 'project-order.manage-travelers', label: 'Kelola traveler & rooming list', group: CAPABILITY_GROUPS.projectOrder },
  { key: 'project-order.log-change', label: 'Catat change request / incident project', group: CAPABILITY_GROUPS.projectOrder },
  { key: 'project-order.advance-step', label: 'Jalankan transisi step Project Order', group: CAPABILITY_GROUPS.projectOrder, description: 'Tombol "Next Action" pada Status Workflow — tetap tunduk pada gate tiap step.' },
  { key: 'project-order.close', label: 'Tutup (close) Project Order', group: CAPABILITY_GROUPS.projectOrder },
  { key: 'project-order.view-margin', label: 'Lihat margin & internal cost project', group: CAPABILITY_GROUPS.projectOrder },
  { key: serviceCapabilityKey('flight'), label: 'Kelola service: Flight', group: CAPABILITY_GROUPS.projectOrder },
  { key: serviceCapabilityKey('hotel'), label: 'Kelola service: Hotel', group: CAPABILITY_GROUPS.projectOrder },
  { key: serviceCapabilityKey('transportation'), label: 'Kelola service: Transportation', group: CAPABILITY_GROUPS.projectOrder },
  { key: serviceCapabilityKey('mice'), label: 'Kelola service: MICE', group: CAPABILITY_GROUPS.projectOrder },
  { key: serviceCapabilityKey('additional'), label: 'Kelola service: Additional', group: CAPABILITY_GROUPS.projectOrder },

  // Sales & CRM — menggantikan role literal di /crm/* dan /customer-journey/*
  { key: 'sales.manage-lead', label: 'Kelola & kualifikasi Lead', group: CAPABILITY_GROUPS.sales },
  { key: 'sales.manage-lead-pipeline', label: 'Kelola Quotation Lead', group: CAPABILITY_GROUPS.sales },
  { key: 'sales.mark-won', label: 'Tandai Lead sebagai Won', group: CAPABILITY_GROUPS.sales },
  { key: 'sales.approve-quotation', label: 'Setujui Quotation (Management)', group: CAPABILITY_GROUPS.sales },
  { key: 'crm.manage-party', label: 'Kelola data customer / prospect', group: CAPABILITY_GROUPS.sales },
  { key: 'crm.manage-follow-up', label: 'Kelola rule follow-up otomatis & loyalty', group: CAPABILITY_GROUPS.sales },

  // Finance
  { key: 'finance.record-payment', label: 'Catat & verifikasi pembayaran', group: CAPABILITY_GROUPS.finance },
  { key: 'finance.manage-opex', label: 'Kelola Opex', group: CAPABILITY_GROUPS.finance },
  { key: 'finance.close-period', label: 'Tutup periode / finance closure', group: CAPABILITY_GROUPS.finance },

  // HR & Inventory (dipakai penuh mulai P7, didefinisikan sejak awal agar builder role tidak perlu diubah lagi)
  { key: 'hr.manage-employee', label: 'Tambah & kelola data karyawan', group: CAPABILITY_GROUPS.people },
  { key: 'hr.manage-payroll', label: 'Jalankan payroll & komisi', group: CAPABILITY_GROUPS.people },
  { key: 'hr.manage-performance', label: 'Kelola performance review', group: CAPABILITY_GROUPS.people },
  { key: 'inventory.manage-asset', label: 'Kelola aset & maintenance', group: CAPABILITY_GROUPS.people },

  // Administration
  { key: 'admin.manage-users', label: 'Kelola user (buat, suspend, assign role)', group: CAPABILITY_GROUPS.administration },
  { key: 'admin.manage-roles', label: 'Kelola role & permission', group: CAPABILITY_GROUPS.administration, description: 'Akses Admin > Roles builder. Perubahan tetap tunduk pada guard rail anti self-lockout.' },
  { key: 'admin.manage-master-data', label: 'Kelola master data & profil organisasi', group: CAPABILITY_GROUPS.administration },
  { key: 'admin.view-activity-center', label: 'Akses Activity Center lintas sistem', group: CAPABILITY_GROUPS.administration }
]

export const CAPABILITY_KEYS = CAPABILITIES.map(capability => capability.key)

const CAPABILITY_KEY_SET = new Set(CAPABILITY_KEYS)

export function isKnownCapabilityKey (key: string): boolean {
  return CAPABILITY_KEY_SET.has(key)
}

export function getCapabilityDefinition (key: string): CapabilityDefinition | undefined {
  return CAPABILITIES.find(capability => capability.key === key)
}
