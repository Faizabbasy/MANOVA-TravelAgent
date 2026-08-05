import type { ID } from './common'

/**
 * Inventory (Revisi 9-Modul, modul 7) — aset MILIK MANOVA: kamera & alat produksi, properti pendukung,
 * dan jadwal maintenance-nya.
 *
 * Sengaja TERPISAH dari `Vendor`/`Commodity` (pasokan pihak ketiga) dan dari `ProjectService` (layanan
 * yang dijual). `AssetCheckout` menautkan aset ke project sehingga `closureChecklist.assetsReturned` —
 * field yang sudah lama ada tapi tidak pernah terisi — akhirnya punya sumber data nyata.
 */

export type AssetCategoryKey = 'camera' | 'production' | 'property' | 'vehicle' | 'it'

export type AssetCondition = 'excellent' | 'good' | 'needs-service' | 'damaged'

export type AssetStatus = 'available' | 'in-use' | 'maintenance' | 'retired'

export interface Asset {
  id: ID
  code: string
  name: string
  category: AssetCategoryKey
  brand?: string
  serialNumber?: string
  purchasedAt: string
  /** Nilai perolehan — opsional, tidak wajib diisi saat input aset baru. */
  purchasePriceIdr?: number
  condition: AssetCondition
  status: AssetStatus
  location: string
  /** Jumlah unit dalam satu baris aset ini (stok). Aset satuan bernilai 1. */
  quantity: number
  note?: string
}

export type MaintenanceType = 'routine' | 'repair' | 'calibration' | 'inspection'
export type MaintenanceStatus = 'scheduled' | 'in-progress' | 'completed' | 'overdue'

export interface MaintenanceSchedule {
  id: ID
  assetId: ID
  type: MaintenanceType
  scheduledAt: string
  completedAt?: string
  status: MaintenanceStatus
  vendorName?: string
  costIdr?: number
  note?: string
  /** Interval pengulangan dalam hari — kosong berarti sekali jalan. */
  intervalDays?: number
}

export type CheckoutStatus = 'requested' | 'checked-out' | 'returned' | 'overdue'

export interface AssetCheckout {
  id: ID
  assetId: ID
  projectId?: ID
  borrowedBy: ID
  checkedOutAt: string
  dueAt: string
  returnedAt?: string
  status: CheckoutStatus
  conditionOnReturn?: AssetCondition
  note?: string
}

export interface AssetUtilization {
  assetId: ID
  assetName: string
  checkoutCount: number
  daysInUse: number
  /** Persentase hari terpakai terhadap jendela pengamatan. */
  utilizationPercent: number
}
