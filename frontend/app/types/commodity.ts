import type { ID } from './common'
import type { ServiceTypeKey } from './project'

/**
 * Commodity Product (Phase 1 — Client–Vendor Commodity) — "Produk atau layanan yang dibuat Vendor"
 * (Phase 0 Section 7). Entitas TERPISAH dari `CommodityRequirement` (kebutuhan milik Client) — jangan
 * digabung/dicampur, lihat `app/types/requirement.ts`.
 *
 * `status` mengikuti 8 nilai baku Phase 0 Section 10. `draft`/`published`/`suspended`/`expired`/`archived`
 * adalah keputusan vendor/sistem (lihat `COMMODITY_PRODUCT_STATUS_TRANSITIONS`), sedangkan
 * `available`/`limited`/`sold-out` adalah state TURUNAN dari sisa `availableQuantity` pada
 * `AvailabilitySlot` milik commodity ini (lihat `syncCommodityProductAvailabilityStatus` di
 * `app/data/index.ts`) — tidak pernah di-set manual langsung ke tiga nilai tsb.
 */
export type CommodityProductStatus =
  | 'draft'
  | 'published'
  | 'available'
  | 'limited'
  | 'sold-out'
  | 'expired'
  | 'archived'
  | 'suspended'

export interface CommodityProduct {
  id: ID
  vendorId: ID
  name: string
  category: ServiceTypeKey
  description?: string
  /** Harga jual ke Client — satu-satunya field harga yang boleh dirender di halaman/komponen Client. */
  sellPriceIdr: number
  /** Harga pokok/internal vendor (opsional) — JANGAN PERNAH dirender di halaman/komponen Client (D-046-style sanitation, lihat Phase 0 Section 11). */
  costPriceIdr?: number
  status: CommodityProductStatus
  createdAt: string
  updatedAt?: string
}

/** Commodity Variant — sub-entitas `CommodityProduct` (mis. tipe kamar, kelas kabin). Disimpan sebagai array top-level terpisah (`COMMODITY_VARIANTS`) dengan FK `commodityProductId`, mengikuti pola normalisasi existing (`ProjectService`/`TravelerGroup` dkk, bukan nested array). */
export interface CommodityVariant {
  id: ID
  commodityProductId: ID
  name: string
  /** Override harga jual variant. Bila kosong, gunakan `CommodityProduct.sellPriceIdr` sebagai fallback. */
  sellPriceIdr?: number
  createdAt: string
}
