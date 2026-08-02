import type { ID } from './common'

/**
 * Commodity Order (Phase 1 — Client–Vendor Commodity) — "Transaksi yang terbentuk setelah selection
 * dikonfirmasi" (Phase 0 Section 7). Dibuat sebagai SNAPSHOT dari `CommoditySelection` + `CommodityProduct`
 * pada momen konfirmasi (Phase 4/5) — mengikuti pola snapshot harga yang sudah dipakai `ServiceOrder`
 * (`sellPriceIdr`, bukan referensi hidup), agar perubahan harga vendor di kemudian hari TIDAK mengubah
 * order yang sudah ada (Phase 0 Section 8: "Order tidak memakai snapshot" adalah risiko yang harus dicegah).
 */
export type CommodityOrderStatus =
  | 'inquiry'
  | 'selected'
  | 'soft-hold'
  | 'confirmed'
  | 'booked'
  | 'in-service'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'refunded'

export interface CommodityOrder {
  id: ID
  selectionId: ID
  projectId: ID
  vendorId: ID
  commodityProductId: ID
  variantId?: ID
  /** Snapshot nama — tidak berubah walau `CommodityProduct`/`CommodityVariant` diedit vendor setelahnya. */
  commodityNameSnapshot: string
  variantNameSnapshot?: string
  /** Snapshot harga jual pada saat order dibuat. */
  sellPriceIdrSnapshot: number
  quantity: number
  status: CommodityOrderStatus
  createdAt: string
  updatedAt?: string
}
