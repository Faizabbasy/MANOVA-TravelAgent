import { reactive } from 'vue'
import type { CommodityOrder } from '~/types/commodity-order'

/**
 * Commodity Order — mock repository (Phase 1). CMO-001 adalah snapshot dari `CSL-004` (`confirmed`) +
 * `CMD-008` pada saat order dibuat — dipakai test untuk membuktikan `sellPriceIdrSnapshot` TIDAK berubah
 * walau `CMD-008.sellPriceIdr` diedit vendor setelahnya (Phase 0 Section 8).
 */
export const COMMODITY_ORDERS: CommodityOrder[] = reactive([
  { id: 'CMO-001', selectionId: 'CSL-004', projectId: 'PRJ-102', vendorId: 'VND-007', commodityProductId: 'CMD-008', commodityNameSnapshot: 'Venue Meeting Eksekutif Full Day', sellPriceIdrSnapshot: 8000000, quantity: 1, status: 'confirmed', createdAt: '2026-07-24' }
])
