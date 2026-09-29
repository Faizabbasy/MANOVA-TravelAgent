import { reactive } from 'vue'
import type { CommodityProduct, CommodityVariant } from '~/types/commodity'

/**
 * Commodity Product/Variant — mock repository (Phase 1). Reactive array module-level, mengikuti pola
 * `VENDORS`/`PROJECTS` (`app/data/*.ts`) — dimutasi lewat fungsi terpusat di `app/data/index.ts`, BUKAN
 * langsung dari komponen.
 *
 * Seed mencakup seluruh 8 nilai `CommodityProductStatus` (Phase 0 Section 10) sebagai edge case:
 * `draft` (CMD-003), `published`/`available` (CMD-001, CMD-008), `limited` (CMD-007), `sold-out`
 * (CMD-002), `expired` (CMD-005), `archived` (CMD-004), `suspended` (CMD-006).
 */
export const COMMODITY_PRODUCTS: CommodityProduct[] = reactive([
  { id: 'CMD-001', vendorId: 'VND-002', name: 'Kamar Deluxe Bali Resort', category: 'hotel', description: 'Kamar deluxe menghadap taman, sarapan termasuk.', sellPriceIdr: 1200000, costPriceIdr: 900000, status: 'available', createdAt: '2026-07-01' },
  { id: 'CMD-002', vendorId: 'VND-002', name: 'Kamar Superior Bali Resort', category: 'hotel', description: 'Kamar superior standar.', sellPriceIdr: 850000, costPriceIdr: 620000, status: 'sold-out', createdAt: '2026-07-01' },
  { id: 'CMD-003', vendorId: 'VND-001', name: 'Tiket Grup Jakarta-Denpasar', category: 'flight', description: 'Tiket grup pergi-pulang, belum dipublikasikan.', sellPriceIdr: 2100000, costPriceIdr: 1750000, status: 'draft', createdAt: '2026-07-20' },
  { id: 'CMD-004', vendorId: 'VND-004', name: 'Paket MICE Full Day Meeting', category: 'mice', description: 'Paket meeting satu hari penuh, sudah diarsipkan vendor.', sellPriceIdr: 15000000, costPriceIdr: 11000000, status: 'archived', createdAt: '2026-05-01', updatedAt: '2026-07-10' },
  { id: 'CMD-005', vendorId: 'VND-003', name: 'Sewa Bus Pariwisata 40 Seat', category: 'transportation', description: 'Bus pariwisata kapasitas 40 kursi, periode sewa sudah lewat.', sellPriceIdr: 3500000, costPriceIdr: 2800000, status: 'expired', createdAt: '2026-04-01', updatedAt: '2026-07-01' },
  { id: 'CMD-006', vendorId: 'VND-002', name: 'Kamar Suite Bali Resort', category: 'hotel', description: 'Kamar suite, sementara disuspend vendor.', sellPriceIdr: 2500000, costPriceIdr: 1900000, status: 'suspended', createdAt: '2026-06-01', updatedAt: '2026-07-15' },
  { id: 'CMD-007', vendorId: 'VND-006', name: 'Kamar Standard Hotel Budget', category: 'hotel', description: 'Kamar standard, stok menipis.', sellPriceIdr: 450000, costPriceIdr: 320000, status: 'limited', createdAt: '2026-07-05' },
  { id: 'CMD-008', vendorId: 'VND-007', name: 'Venue Meeting Eksekutif Full Day', category: 'mice', description: 'Venue meeting kapasitas 100 orang.', sellPriceIdr: 8000000, costPriceIdr: 6200000, status: 'available', createdAt: '2026-07-08' }
])

export const COMMODITY_VARIANTS: CommodityVariant[] = reactive([
  { id: 'CMV-001', commodityProductId: 'CMD-001', name: 'Twin Bed', createdAt: '2026-07-01' },
  { id: 'CMV-002', commodityProductId: 'CMD-001', name: 'King Bed', sellPriceIdr: 1350000, createdAt: '2026-07-01' },
  { id: 'CMV-003', commodityProductId: 'CMD-002', name: 'Twin Bed', createdAt: '2026-07-01' }
])
