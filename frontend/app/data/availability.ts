import { reactive } from 'vue'
import type { AvailabilitySlot } from '~/types/availability'

/**
 * Availability Slot — mock repository (Phase 1). `availableQuantity` SENGAJA tidak disimpan di sini,
 * lihat `getAvailableQuantity()` (`app/data/index.ts`).
 *
 * Edge case yang sengaja diseed:
 * - AVL-002: `bookedQuantity` menghabiskan `totalQuantity` pada level variant (available = 0) walau
 *   commodity induknya (CMD-001) masih `available` secara agregat (variant lain, AVL-001, masih ada stok).
 * - AVL-003: kombinasi `heldQuantity` + `bookedQuantity` menghabiskan stok (available = 0) — dipasangkan
 *   dengan `CSL-005` (`app/data/selections.ts`) yang `holdExpiresAt`-nya SUDAH LEWAT `DEMO_REFERENCE_DATE`
 *   tapi belum diproses (`heldQuantity` belum dikembalikan) — kasus nyata yang harus ditangani Phase 4
 *   ("hold tidak mengembalikan stok", Phase 0 Section 9).
 * - AVL-004: `heldQuantity` persis mencerminkan `CSL-001` (soft hold aktif, belum expired).
 */
export const AVAILABILITY_SLOTS: AvailabilitySlot[] = reactive([
  { id: 'AVL-001', commodityProductId: 'CMD-001', variantId: 'CMV-001', periodStart: '2026-08-10', periodEnd: '2026-08-15', totalQuantity: 10, heldQuantity: 2, bookedQuantity: 3, bookingCutoff: '2026-08-08', createdAt: '2026-07-01' },
  { id: 'AVL-002', commodityProductId: 'CMD-001', variantId: 'CMV-002', periodStart: '2026-08-10', periodEnd: '2026-08-15', totalQuantity: 4, heldQuantity: 0, bookedQuantity: 4, bookingCutoff: '2026-08-08', createdAt: '2026-07-01' },
  { id: 'AVL-003', commodityProductId: 'CMD-002', periodStart: '2026-07-01', periodEnd: '2026-07-20', totalQuantity: 6, heldQuantity: 2, bookedQuantity: 4, bookingCutoff: '2026-06-28', createdAt: '2026-06-01' },
  { id: 'AVL-004', commodityProductId: 'CMD-007', periodStart: '2026-08-01', periodEnd: '2026-08-31', totalQuantity: 10, heldQuantity: 3, bookedQuantity: 6, bookingCutoff: '2026-07-28', createdAt: '2026-07-05' },
  { id: 'AVL-005', commodityProductId: 'CMD-008', periodStart: '2026-09-01', periodEnd: '2026-09-01', totalQuantity: 5, heldQuantity: 0, bookedQuantity: 1, bookingCutoff: '2026-08-25', createdAt: '2026-07-08' }
])
