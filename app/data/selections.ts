import { reactive } from 'vue'
import type { CommoditySelection } from '~/types/selection'

/**
 * Commodity Selection — mock repository (Phase 1).
 *
 * Edge case yang sengaja diseed:
 * - CSL-001 (primary) + CSL-002 (secondary) pada `CRQ-003` yang sama — mendemonstrasikan aturan
 *   "maksimal satu selection aktif per rank: Primary, Secondary, Third Choice" (Phase 4).
 * - CSL-001: `holdExpiresAt` ('2026-08-05') MASIH di depan `DEMO_REFERENCE_DATE` ('2026-07-29') — hold aktif.
 * - CSL-005: `holdExpiresAt` ('2026-07-20') SUDAH LEWAT `DEMO_REFERENCE_DATE` — hold kadaluarsa yang
 *   belum diproses (stok pada `AVL-003` masih tercatat held), kasus nyata untuk Phase 4.
 * - CSL-004: `confirmed` — dipasangkan dengan `CMO-001` (`app/data/commodity-orders.ts`) untuk
 *   mendemonstrasikan snapshot harga pada Commodity Order.
 */
export const COMMODITY_SELECTIONS: CommoditySelection[] = reactive([
  { id: 'CSL-001', requirementId: 'CRQ-003', commodityProductId: 'CMD-007', quantity: 3, choiceRank: 'primary', status: 'soft-hold', availabilitySlotId: 'AVL-004', holdExpiresAt: '2026-08-05', createdAt: '2026-07-25' },
  { id: 'CSL-002', requirementId: 'CRQ-003', commodityProductId: 'CMD-001', variantId: 'CMV-001', quantity: 2, choiceRank: 'secondary', status: 'draft', createdAt: '2026-07-25' },
  { id: 'CSL-004', requirementId: 'CRQ-006', commodityProductId: 'CMD-008', quantity: 1, choiceRank: 'primary', status: 'confirmed', availabilitySlotId: 'AVL-005', createdAt: '2026-07-10', updatedAt: '2026-07-24' },
  { id: 'CSL-005', requirementId: 'CRQ-007', commodityProductId: 'CMD-002', quantity: 2, choiceRank: 'primary', status: 'soft-hold', availabilitySlotId: 'AVL-003', holdExpiresAt: '2026-07-20', createdAt: '2026-06-26' }
])
