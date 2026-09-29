import type { ID } from './common'

/**
 * Availability Slot (Phase 1 — Client–Vendor Commodity) — "Kapasitas tersedia per periode" (Phase 0
 * Section 7). Satu slot merepresentasikan kapasitas satu `CommodityProduct` (atau satu `CommodityVariant`
 * bila `variantId` terisi) untuk satu periode.
 *
 * `availableQuantity` SENGAJA TIDAK disimpan sebagai field — selalu dihitung lewat `getAvailableQuantity()`
 * (`app/data/index.ts`) dari rumus baku Phase 0 Section 9:
 *
 *   availableQuantity = totalQuantity - heldQuantity - bookedQuantity
 *
 * agar tidak pernah stale/tidak sinkron dengan `totalQuantity`/`heldQuantity`/`bookedQuantity`.
 */
export interface AvailabilitySlot {
  id: ID
  commodityProductId: ID
  /** Kosong = availability berlaku di level Commodity Product (tidak per-variant). */
  variantId?: ID
  periodStart: string
  periodEnd: string
  totalQuantity: number
  heldQuantity: number
  bookedQuantity: number
  bookingCutoff?: string
  blackoutDates?: string[]
  createdAt: string
  updatedAt?: string
}
