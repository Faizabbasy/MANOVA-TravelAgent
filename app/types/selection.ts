import type { ID } from './common'

/**
 * Commodity Selection (Phase 1 — Client–Vendor Commodity) — "Pilihan Client terhadap produk Vendor"
 * (Phase 0 Section 7). Menjembatani `CommodityRequirement` (Client) dengan `CommodityProduct` (Vendor).
 */
export type SelectionStatus =
  | 'draft'
  | 'submitted'
  | 'under-validation'
  | 'soft-hold'
  | 'confirmed'
  | 'booked'
  | 'completed'
  | 'expired'
  | 'rejected'
  | 'cancelled'
  | 'replaced'

/**
 * Satu Requirement boleh punya maksimal SATU selection aktif per rank (Phase 4: "Primary, Secondary, dan
 * Third Choice") — bukan 1 primary + N alternative bebas seperti draf Phase 1 awal. Diperketat di
 * `hasActiveSelectionWithRank` (`app/data/index.ts`).
 */
export type SelectionChoiceRank = 'primary' | 'secondary' | 'third-choice'

export interface CommoditySelection {
  id: ID
  requirementId: ID
  commodityProductId: ID
  variantId?: ID
  quantity: number
  choiceRank: SelectionChoiceRank
  status: SelectionStatus
  /** Slot yang menampung hold/booking untuk selection ini — diisi saat `holdCommoditySelection` dipanggil. */
  availabilitySlotId?: ID
  /** Diisi saat status masuk `soft-hold` — dievaluasi lazy terhadap waktu berjalan (Phase 4), BUKAN cron/timer. */
  holdExpiresAt?: string
  createdAt: string
  updatedAt?: string
}
