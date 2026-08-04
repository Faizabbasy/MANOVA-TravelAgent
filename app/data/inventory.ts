import { reactive } from 'vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  Asset,
  AssetCategoryKey,
  AssetCheckout,
  AssetUtilization,
  MaintenanceSchedule
} from '~/types/inventory'
import type { StatusOption } from '~/types/common'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Inventory aset milik MANOVA (Revisi 9-Modul, modul 7 — `revisi.md` #20 "tambah inventory di role
 * operation (di alat alat yang manova punya)").
 */

export const ASSET_CATEGORIES: StatusOption<AssetCategoryKey>[] = [
  { value: 'camera', label: 'Kamera & Optik', tone: 'primary', order: 1 },
  { value: 'production', label: 'Alat Produksi', tone: 'info', order: 2 },
  { value: 'property', label: 'Properti Pendukung', tone: 'purple', order: 3 },
  { value: 'vehicle', label: 'Kendaraan Operasional', tone: 'warning', order: 4 },
  { value: 'it', label: 'Perangkat IT', tone: 'neutral', order: 5 }
]

export const ASSET_CONDITIONS: StatusOption<Asset['condition']>[] = [
  { value: 'excellent', label: 'Sangat Baik', tone: 'success', order: 1 },
  { value: 'good', label: 'Baik', tone: 'info', order: 2 },
  { value: 'needs-service', label: 'Perlu Servis', tone: 'warning', order: 3 },
  { value: 'damaged', label: 'Rusak', tone: 'destructive', order: 4 }
]

export const ASSET_STATUSES: StatusOption<Asset['status']>[] = [
  { value: 'available', label: 'Tersedia', tone: 'success', order: 1 },
  { value: 'in-use', label: 'Dipakai', tone: 'primary', order: 2 },
  { value: 'maintenance', label: 'Maintenance', tone: 'warning', order: 3 },
  { value: 'retired', label: 'Tidak Dipakai', tone: 'neutral', order: 4 }
]

export const MAINTENANCE_TYPES: StatusOption<MaintenanceSchedule['type']>[] = [
  { value: 'routine', label: 'Perawatan Rutin', tone: 'info', order: 1 },
  { value: 'repair', label: 'Perbaikan', tone: 'destructive', order: 2 },
  { value: 'calibration', label: 'Kalibrasi', tone: 'primary', order: 3 },
  { value: 'inspection', label: 'Inspeksi', tone: 'neutral', order: 4 }
]

export const MAINTENANCE_STATUSES: StatusOption<MaintenanceSchedule['status']>[] = [
  { value: 'scheduled', label: 'Terjadwal', tone: 'info', order: 1 },
  { value: 'in-progress', label: 'Dikerjakan', tone: 'warning', order: 2 },
  { value: 'completed', label: 'Selesai', tone: 'success', order: 3 },
  { value: 'overdue', label: 'Terlewat', tone: 'destructive', order: 4 }
]

export const CHECKOUT_STATUSES: StatusOption<AssetCheckout['status']>[] = [
  { value: 'requested', label: 'Diminta', tone: 'neutral', order: 1 },
  { value: 'checked-out', label: 'Dipinjam', tone: 'primary', order: 2 },
  { value: 'returned', label: 'Dikembalikan', tone: 'success', order: 3 },
  { value: 'overdue', label: 'Telat Kembali', tone: 'destructive', order: 4 }
]

export const ASSETS: Asset[] = reactive([
  { id: 'AST-001', code: 'CAM-001', name: 'Sony A7 IV Body', category: 'camera', brand: 'Sony', serialNumber: 'SN-A7IV-88213', purchasedAt: '2024-03-12', purchasePriceIdr: 38_500_000, condition: 'excellent', status: 'in-use', location: 'Gudang Jakarta' },
  { id: 'AST-002', code: 'CAM-002', name: 'Sony A7 III Body', category: 'camera', brand: 'Sony', serialNumber: 'SN-A7III-55190', purchasedAt: '2022-09-04', purchasePriceIdr: 27_000_000, condition: 'good', status: 'available', location: 'Gudang Jakarta' },
  { id: 'AST-003', code: 'CAM-003', name: 'Lensa Sony 24-70mm f/2.8 GM II', category: 'camera', brand: 'Sony', serialNumber: 'SN-2470-11902', purchasedAt: '2024-03-12', purchasePriceIdr: 34_000_000, condition: 'excellent', status: 'in-use', location: 'Gudang Jakarta' },
  { id: 'AST-004', code: 'CAM-004', name: 'DJI Mini 4 Pro Drone', category: 'camera', brand: 'DJI', serialNumber: 'SN-DJI-44021', purchasedAt: '2024-06-20', purchasePriceIdr: 16_500_000, condition: 'good', status: 'available', location: 'Gudang Jakarta' },
  { id: 'AST-005', code: 'CAM-005', name: 'DJI RS 3 Gimbal', category: 'camera', brand: 'DJI', purchasedAt: '2023-11-08', purchasePriceIdr: 9_800_000, condition: 'needs-service', status: 'maintenance', location: 'Service Center', note: 'Motor pan terasa tersendat saat beban penuh.' },
  { id: 'AST-006', code: 'PRD-001', name: 'Portable LED Panel Set (4 unit)', category: 'production', brand: 'Godox', purchasedAt: '2023-05-15', purchasePriceIdr: 14_200_000, condition: 'good', status: 'in-use', location: 'Gudang Jakarta' },
  { id: 'AST-007', code: 'PRD-002', name: 'Wireless Mic Rode Wireless Pro', category: 'production', brand: 'Rode', purchasedAt: '2024-01-22', purchasePriceIdr: 7_900_000, condition: 'excellent', status: 'available', location: 'Gudang Jakarta' },
  { id: 'AST-008', code: 'PRD-003', name: 'Sound System Portable 500W', category: 'production', brand: 'Yamaha', purchasedAt: '2022-04-11', purchasePriceIdr: 22_000_000, condition: 'good', status: 'available', location: 'Gudang Surabaya' },
  { id: 'AST-009', code: 'PRD-004', name: 'Proyektor 5000 Lumens', category: 'production', brand: 'Epson', purchasedAt: '2023-02-28', purchasePriceIdr: 18_600_000, condition: 'good', status: 'in-use', location: 'Gudang Jakarta' },
  { id: 'AST-010', code: 'PRP-001', name: 'Backdrop Frame 6x3m (3 set)', category: 'property', purchasedAt: '2022-08-30', purchasePriceIdr: 9_000_000, condition: 'good', status: 'available', location: 'Gudang Jakarta' },
  { id: 'AST-011', code: 'PRP-002', name: 'Standing Banner & Signage Kit', category: 'property', purchasedAt: '2023-07-19', purchasePriceIdr: 4_500_000, condition: 'good', status: 'in-use', location: 'Gudang Jakarta' },
  { id: 'AST-012', code: 'PRP-003', name: 'Meja Registrasi Lipat (10 unit)', category: 'property', purchasedAt: '2021-12-02', purchasePriceIdr: 12_500_000, condition: 'needs-service', status: 'available', location: 'Gudang Surabaya', note: 'Dua unit engselnya longgar.' },
  { id: 'AST-013', code: 'PRP-004', name: 'Tenda Kerucut 3x3m (8 unit)', category: 'property', purchasedAt: '2023-03-06', purchasePriceIdr: 16_000_000, condition: 'good', status: 'available', location: 'Gudang Surabaya' },
  { id: 'AST-014', code: 'VHC-001', name: 'Toyota Hiace Commuter', category: 'vehicle', brand: 'Toyota', serialNumber: 'B 1234 MNV', purchasedAt: '2021-10-14', purchasePriceIdr: 545_000_000, condition: 'good', status: 'available', location: 'Pool Jakarta' },
  { id: 'AST-015', code: 'IT-001', name: 'MacBook Pro 14 M3 (Editing)', category: 'it', brand: 'Apple', serialNumber: 'SN-MBP-77341', purchasedAt: '2024-02-05', purchasePriceIdr: 34_900_000, condition: 'excellent', status: 'in-use', location: 'Kantor Jakarta' },
  { id: 'AST-016', code: 'IT-002', name: 'Printer Label & Badge Event', category: 'it', brand: 'Brother', purchasedAt: '2023-09-27', purchasePriceIdr: 6_400_000, condition: 'damaged', status: 'retired', location: 'Gudang Jakarta', note: 'Head printer rusak, biaya perbaikan melebihi nilai sisa.' }
])

export const MAINTENANCE_SCHEDULES: MaintenanceSchedule[] = reactive([
  { id: 'MNT-001', assetId: 'AST-005', type: 'repair', scheduledAt: '2026-07-18', status: 'in-progress', vendorName: 'DJI Authorized Service', costIdr: 2_400_000, note: 'Penggantian motor pan.' },
  { id: 'MNT-002', assetId: 'AST-001', type: 'routine', scheduledAt: '2026-07-10', completedAt: '2026-07-10', status: 'completed', vendorName: 'Sony Service Center', costIdr: 850_000, intervalDays: 180 },
  { id: 'MNT-003', assetId: 'AST-014', type: 'routine', scheduledAt: '2026-07-22', status: 'overdue', vendorName: 'Auto2000', costIdr: 3_200_000, intervalDays: 90, note: 'Servis 40.000 km.' },
  { id: 'MNT-004', assetId: 'AST-012', type: 'repair', scheduledAt: '2026-08-05', status: 'scheduled', vendorName: 'CV Karya Logam', costIdr: 1_100_000 },
  { id: 'MNT-005', assetId: 'AST-008', type: 'inspection', scheduledAt: '2026-08-12', status: 'scheduled', intervalDays: 180 },
  { id: 'MNT-006', assetId: 'AST-004', type: 'calibration', scheduledAt: '2026-07-25', status: 'overdue', vendorName: 'DJI Authorized Service', costIdr: 650_000, note: 'Kalibrasi kompas & gimbal sebelum dipakai project berikutnya.' },
  { id: 'MNT-007', assetId: 'AST-009', type: 'routine', scheduledAt: '2026-09-01', status: 'scheduled', intervalDays: 180 }
])

export const ASSET_CHECKOUTS: AssetCheckout[] = reactive([
  { id: 'ACO-001', assetId: 'AST-001', projectId: 'PRJ-103', borrowedBy: 'USR-007', checkedOutAt: '2026-07-20', dueAt: '2026-08-20', status: 'checked-out' },
  { id: 'ACO-002', assetId: 'AST-003', projectId: 'PRJ-103', borrowedBy: 'USR-007', checkedOutAt: '2026-07-20', dueAt: '2026-08-20', status: 'checked-out' },
  { id: 'ACO-003', assetId: 'AST-006', projectId: 'PRJ-103', borrowedBy: 'USR-007', checkedOutAt: '2026-07-22', dueAt: '2026-08-20', status: 'checked-out' },
  { id: 'ACO-004', assetId: 'AST-009', projectId: 'PRJ-103', borrowedBy: 'USR-009', checkedOutAt: '2026-07-24', dueAt: '2026-08-20', status: 'checked-out' },
  { id: 'ACO-005', assetId: 'AST-011', projectId: 'PRJ-102', borrowedBy: 'USR-013', checkedOutAt: '2026-07-14', dueAt: '2026-07-24', status: 'overdue', note: 'Dipakai untuk site visit, belum dikembalikan.' },
  { id: 'ACO-006', assetId: 'AST-015', borrowedBy: 'USR-025', checkedOutAt: '2026-06-01', dueAt: '2026-12-31', status: 'checked-out', note: 'Penugasan jangka panjang tim Marketing.' },
  { id: 'ACO-007', assetId: 'AST-007', projectId: 'PRJ-101', borrowedBy: 'USR-009', checkedOutAt: '2026-06-10', dueAt: '2026-06-20', returnedAt: '2026-06-19', status: 'returned', conditionOnReturn: 'excellent' },
  { id: 'ACO-008', assetId: 'AST-013', projectId: 'PRJ-101', borrowedBy: 'USR-009', checkedOutAt: '2026-06-08', dueAt: '2026-06-20', returnedAt: '2026-06-22', status: 'returned', conditionOnReturn: 'good', note: 'Terlambat 2 hari karena cuaca.' }
])

/* ------------------------------------------------------------------ *
 * Selector
 * ------------------------------------------------------------------ */

export function getAssetById (assetId: string): Asset | undefined {
  return ASSETS.find(asset => asset.id === assetId)
}

export function getAssetsByCategory (category?: AssetCategoryKey): Asset[] {
  return category ? ASSETS.filter(asset => asset.category === category) : [...ASSETS]
}

export function getMaintenanceByAsset (assetId: string): MaintenanceSchedule[] {
  return MAINTENANCE_SCHEDULES.filter(item => item.assetId === assetId).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

/** Jadwal maintenance yang sudah lewat tapi belum selesai — sumber utama peringatan di halaman Inventory. */
export function getOverdueMaintenance (referenceIso = DEMO_REFERENCE_DATE): MaintenanceSchedule[] {
  return MAINTENANCE_SCHEDULES.filter(item =>
    item.status !== 'completed' && differenceInCalendarDays(parseISO(referenceIso), parseISO(item.scheduledAt)) > 0)
}

export function getUpcomingMaintenance (windowDays = 30, referenceIso = DEMO_REFERENCE_DATE): MaintenanceSchedule[] {
  return MAINTENANCE_SCHEDULES
    .filter((item) => {
      if (item.status === 'completed') { return false }
      const days = differenceInCalendarDays(parseISO(item.scheduledAt), parseISO(referenceIso))
      return days >= 0 && days <= windowDays
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export function getCheckoutsByAsset (assetId: string): AssetCheckout[] {
  return ASSET_CHECKOUTS.filter(item => item.assetId === assetId).sort((a, b) => b.checkedOutAt.localeCompare(a.checkedOutAt))
}

export function getCheckoutsByProject (projectId: string): AssetCheckout[] {
  return ASSET_CHECKOUTS.filter(item => item.projectId === projectId)
}

export function getActiveCheckouts (): AssetCheckout[] {
  return ASSET_CHECKOUTS.filter(item => item.status === 'checked-out' || item.status === 'overdue')
}

/**
 * Apakah seluruh aset yang dipinjam untuk sebuah project sudah kembali. Inilah sumber data untuk
 * `ProjectClosureChecklist.assetsReturned` — field yang selama ini ada tapi tidak pernah punya
 * mekanisme pengisian.
 */
export function areProjectAssetsReturned (projectId: string): { returned: boolean; outstanding: AssetCheckout[] } {
  const outstanding = getCheckoutsByProject(projectId).filter(item => item.status !== 'returned')
  return { returned: outstanding.length === 0, outstanding }
}

export function returnAsset (checkoutId: string, condition: Asset['condition'], referenceIso = DEMO_REFERENCE_DATE): AssetCheckout | undefined {
  const checkout = ASSET_CHECKOUTS.find(item => item.id === checkoutId)
  if (!checkout || checkout.status === 'returned') { return undefined }
  checkout.returnedAt = referenceIso
  checkout.status = 'returned'
  checkout.conditionOnReturn = condition

  const asset = getAssetById(checkout.assetId)
  if (asset) {
    asset.condition = condition
    asset.status = condition === 'damaged' ? 'maintenance' : 'available'
  }
  return checkout
}

export function completeMaintenance (maintenanceId: string, referenceIso = DEMO_REFERENCE_DATE): MaintenanceSchedule | undefined {
  const schedule = MAINTENANCE_SCHEDULES.find(item => item.id === maintenanceId)
  if (!schedule) { return undefined }
  schedule.status = 'completed'
  schedule.completedAt = referenceIso

  const asset = getAssetById(schedule.assetId)
  if (asset && asset.status === 'maintenance') {
    asset.status = 'available'
    asset.condition = 'good'
  }
  return schedule
}

export interface InventorySummary {
  total: number
  available: number
  inUse: number
  maintenance: number
  overdueMaintenance: number
  overdueCheckouts: number
  totalValueIdr: number
}

export function getInventorySummary (referenceIso = DEMO_REFERENCE_DATE): InventorySummary {
  return {
    total: ASSETS.length,
    available: ASSETS.filter(asset => asset.status === 'available').length,
    inUse: ASSETS.filter(asset => asset.status === 'in-use').length,
    maintenance: ASSETS.filter(asset => asset.status === 'maintenance').length,
    overdueMaintenance: getOverdueMaintenance(referenceIso).length,
    overdueCheckouts: ASSET_CHECKOUTS.filter(item => item.status === 'overdue').length,
    totalValueIdr: ASSETS.filter(asset => asset.status !== 'retired').reduce((sum, asset) => sum + asset.purchasePriceIdr, 0)
  }
}

/** Utilisasi per aset — berapa sering dan berapa lama sebuah aset benar-benar dipakai. */
export function getAssetUtilization (windowDays = 90, referenceIso = DEMO_REFERENCE_DATE): AssetUtilization[] {
  return ASSETS
    .filter(asset => asset.status !== 'retired')
    .map((asset) => {
      const checkouts = getCheckoutsByAsset(asset.id)
      const daysInUse = checkouts.reduce((sum, checkout) => {
        const end = checkout.returnedAt ?? referenceIso
        const days = differenceInCalendarDays(parseISO(end), parseISO(checkout.checkedOutAt))
        return sum + Math.max(0, days)
      }, 0)

      return {
        assetId: asset.id,
        assetName: asset.name,
        checkoutCount: checkouts.length,
        daysInUse,
        utilizationPercent: Math.min(100, Math.round((daysInUse / windowDays) * 100))
      }
    })
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
}
