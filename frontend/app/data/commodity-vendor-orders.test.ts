import { describe, it, expect } from 'vitest'
import {
  createCommodityProduct, updateCommodityProductStatus, createAvailabilitySlot, getAvailabilitySlotById, getAvailableQuantity,
  createCommodityRequirement, createCommoditySelection, submitAndHoldCommoditySelection, getCommoditySelectionById,
  computeHoldExpiry, cancelCommoditySelectionHold,
  getCommodityOrderById, getCommodityOrderBySelection, getCommodityOrdersByVendor, getCommodityOrdersByClient,
  getPendingSoftHoldSelectionsByVendor, confirmCommodityOrderFromSelection, advanceCommodityOrderStatus,
  getCommodityOrderStatusTransitions, isCommodityOrderSold, getVendorSoldCommoditiesSummary, getCatalogVisibleCommodities
} from './index'

/** Helper — Vendor Publish siap dipilih Client (Phase 5 integration test), 1 slot dengan `totalQuantity` diberikan. */
function publishVendorCommodity (vendorId: string, totalQuantity: number, sellPriceIdr = 250000) {
  const product = createCommodityProduct({ vendorId, name: `Vendor Order Test ${Math.random()}`, category: 'hotel', sellPriceIdr })
  updateCommodityProductStatus(product.id, 'published')
  const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-10', totalQuantity })!
  return { product, slot }
}

/** Helper — Client Select + Hold atas commodity yang sudah dipublish, mengembalikan selection berstatus `soft-hold`. */
function clientSelectAndHold (clientPartyId: string, projectId: string, commodityProductId: string, slotId: string, quantity: number) {
  const requirement = createCommodityRequirement({ projectId, clientPartyId, category: 'hotel', title: 'Vendor Order Test Requirement', quantity })
  const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId, quantity, choiceRank: 'primary' })!
  const held = submitAndHoldCommoditySelection(selection.id, slotId, computeHoldExpiry())!
  return { requirement, selection, held }
}

describe('Commodity domain — Phase 5 (Vendor Orders, Sold Commodities)', () => {
  describe('Integration — Vendor publish → Client select → Hold → Confirmed → Vendor sold', () => {
    it('mengikuti seluruh alur end-to-end dan menghitung sold hanya setelah Order confirmed', () => {
      const vendorId = 'VND-5-flow-test'
      const clientPartyId = 'PTY-5-flow-test'

      // 1. Vendor publish — komoditas jadi katalog-visible untuk Client (Phase 4 gate, dipakai sebagai baseline Phase 5).
      const { product, slot } = publishVendorCommodity(vendorId, 5, 300000)
      expect(getCatalogVisibleCommodities().some(item => item.id === product.id)).toBe(true)

      // 2. Client select + submit -> Soft Hold
      const { requirement, selection } = clientSelectAndHold(clientPartyId, 'PRJ-101', product.id, slot.id, 2)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('soft-hold')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(2)

      // Soft Hold belum dihitung sold, dan belum ada Order.
      expect(getCommodityOrderBySelection(selection.id)).toBeUndefined()
      expect(getPendingSoftHoldSelectionsByVendor(vendorId).some(s => s.id === selection.id)).toBe(true)
      expect(getVendorSoldCommoditiesSummary(vendorId).some(row => row.commodityProductId === product.id)).toBe(false)

      // 3. Vendor confirms -> Order confirmed, held->booked
      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)!
      expect(order).toBeDefined()
      expect(order.status).toBe('confirmed')
      expect(order.vendorId).toBe(vendorId)
      expect(order.commodityNameSnapshot).toBe(product.name)
      expect(order.sellPriceIdrSnapshot).toBe(300000)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('confirmed')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
      expect(getAvailabilitySlotById(slot.id)!.bookedQuantity).toBe(2)

      // Selection yang sudah punya Order tidak lagi "pending confirmation".
      expect(getPendingSoftHoldSelectionsByVendor(vendorId).some(s => s.id === selection.id)).toBe(false)

      // 4. Vendor sold — confirmed sudah dihitung sold, muncul di ringkasan Vendor.
      expect(isCommodityOrderSold(order.status)).toBe(true)
      const summary = getVendorSoldCommoditiesSummary(vendorId)
      const row = summary.find(item => item.commodityProductId === product.id)!
      expect(row).toBeDefined()
      expect(row.soldQuantity).toBe(2)
      expect(row.soldRevenueIdr).toBe(600000)
      expect(row.orderCount).toBe(1)

      // Vendor hanya melihat order commodity miliknya.
      expect(getCommodityOrdersByVendor(vendorId).some(o => o.id === order.id)).toBe(true)
      expect(getCommodityOrdersByVendor('VND-other-vendor').some(o => o.id === order.id)).toBe(false)

      // Client melihat Order yang sama (join lewat Selection -> Requirement).
      expect(getCommodityOrdersByClient(clientPartyId).some(o => o.id === order.id)).toBe(true)
      expect(getCommodityOrdersByClient('PTY-other-client').some(o => o.id === order.id)).toBe(false)
      expect(requirement.clientPartyId).toBe(clientPartyId)

      // 5. Confirmed -> Booked (order-level), selection ikut tersinkron -> Client melihat status yang sama.
      const booked = advanceCommodityOrderStatus(order.id, 'booked')!
      expect(booked.status).toBe('booked')
      expect(getCommoditySelectionById(selection.id)!.status).toBe('booked')
      expect(isCommodityOrderSold(booked.status)).toBe(true)
    })
  })

  describe('Vendor hanya melihat order commodity miliknya', () => {
    it('getCommodityOrdersByVendor menyaring ketat berdasarkan vendorId', () => {
      const vendorA = 'VND-5-iso-a'
      const vendorB = 'VND-5-iso-b'
      const { product, slot } = publishVendorCommodity(vendorA, 3)
      const { selection } = clientSelectAndHold('PTY-5-iso', 'PRJ-101', product.id, slot.id, 1)
      const order = confirmCommodityOrderFromSelection(selection.id, vendorA)!
      expect(getCommodityOrdersByVendor(vendorA).map(o => o.id)).toContain(order.id)
      expect(getCommodityOrdersByVendor(vendorB).map(o => o.id)).not.toContain(order.id)
    })

    it('confirmCommodityOrderFromSelection menolak bila selection bukan komoditas vendor tsb', () => {
      const owner = 'VND-5-owner'
      const intruder = 'VND-5-intruder'
      const { product, slot } = publishVendorCommodity(owner, 3)
      const { selection } = clientSelectAndHold('PTY-5-owner-test', 'PRJ-101', product.id, slot.id, 1)
      expect(confirmCommodityOrderFromSelection(selection.id, intruder)).toBeUndefined()
      expect(getCommoditySelectionById(selection.id)!.status).toBe('soft-hold')
    })
  })

  describe('Soft Hold belum dihitung sold; Confirmed/Booked/In Service/Completed dihitung sold', () => {
    it('isCommodityOrderSold konsisten dengan status Order yang benar-benar dibuat lewat alur Phase 5', () => {
      const vendorId = 'VND-5-sold-states'
      const { product, slot } = publishVendorCommodity(vendorId, 4)
      const { selection } = clientSelectAndHold('PTY-5-sold-states', 'PRJ-101', product.id, slot.id, 1)

      expect(getVendorSoldCommoditiesSummary(vendorId)).toHaveLength(0)

      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)!
      expect(isCommodityOrderSold(order.status)).toBe(true)

      advanceCommodityOrderStatus(order.id, 'booked')
      advanceCommodityOrderStatus(order.id, 'in-service')
      expect(isCommodityOrderSold(getCommodityOrderById(order.id)!.status)).toBe(true)
      // 'in-service' tidak punya padanan Selection status — Selection tetap bertahan di 'booked'.
      expect(getCommoditySelectionById(selection.id)!.status).toBe('booked')

      const completed = advanceCommodityOrderStatus(order.id, 'completed')!
      expect(completed.status).toBe('completed')
      expect(isCommodityOrderSold(completed.status)).toBe(true)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('completed')
    })
  })

  describe('Expired, Cancelled, dan Rejected tidak dihitung sebagai sold', () => {
    it('Selection yang dibatalkan sebelum dikonfirmasi tidak pernah menghasilkan Order', () => {
      const vendorId = 'VND-5-cancel-flow'
      const { product, slot } = publishVendorCommodity(vendorId, 3)
      const { selection } = clientSelectAndHold('PTY-5-cancel-flow', 'PRJ-101', product.id, slot.id, 2)
      cancelCommoditySelectionHold(selection.id)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('cancelled')
      expect(confirmCommodityOrderFromSelection(selection.id, vendorId)).toBeUndefined()
      expect(getVendorSoldCommoditiesSummary(vendorId)).toHaveLength(0)
    })

    it('advanceCommodityOrderStatus ke cancelled menyinkronkan Selection ke cancelled dan berhenti dihitung sold', () => {
      const vendorId = 'VND-5-order-cancel'
      const { product, slot } = publishVendorCommodity(vendorId, 3)
      const { selection } = clientSelectAndHold('PTY-5-order-cancel', 'PRJ-101', product.id, slot.id, 1)
      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)!
      const cancelled = advanceCommodityOrderStatus(order.id, 'cancelled')!
      expect(cancelled.status).toBe('cancelled')
      expect(isCommodityOrderSold(cancelled.status)).toBe(false)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('cancelled')
      expect(getVendorSoldCommoditiesSummary(vendorId)).toHaveLength(0)
    })
  })

  describe('Guard duplikasi dan validasi Order', () => {
    it('confirmCommodityOrderFromSelection menolak Selection yang belum Soft Hold (mis. masih draft)', () => {
      const vendorId = 'VND-5-guard-draft'
      const product = createCommodityProduct({ vendorId, name: 'Guard Draft Product', category: 'hotel', sellPriceIdr: 100000 })
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-5-guard', category: 'hotel', title: 'Guard Requirement', quantity: 1 })
      const draftSelection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'primary' })!
      expect(confirmCommodityOrderFromSelection(draftSelection.id, vendorId)).toBeUndefined()
    })

    it('confirmCommodityOrderFromSelection menolak membuat Order kedua untuk Selection yang sama', () => {
      const vendorId = 'VND-5-guard-duplicate'
      const { product, slot } = publishVendorCommodity(vendorId, 3)
      const { selection } = clientSelectAndHold('PTY-5-guard-duplicate', 'PRJ-101', product.id, slot.id, 1)
      const firstOrder = confirmCommodityOrderFromSelection(selection.id, vendorId)!
      expect(firstOrder).toBeDefined()
      // Selection sudah 'confirmed' (bukan lagi 'soft-hold'), jadi upaya kedua ditolak lebih awal.
      expect(confirmCommodityOrderFromSelection(selection.id, vendorId)).toBeUndefined()
      expect(getCommodityOrdersByVendor(vendorId).filter(o => o.selectionId === selection.id)).toHaveLength(1)
    })

    it('advanceCommodityOrderStatus menolak transisi tidak valid dan tidak mengubah status', () => {
      const vendorId = 'VND-5-guard-transition'
      const { product, slot } = publishVendorCommodity(vendorId, 3)
      const { selection } = clientSelectAndHold('PTY-5-guard-transition', 'PRJ-101', product.id, slot.id, 1)
      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)!
      // confirmed tidak boleh langsung ke completed/in-service (harus lewat booked, lihat COMMODITY_ORDER_TRANSITIONS).
      expect(getCommodityOrderStatusTransitions('confirmed')).not.toContain('completed')
      expect(advanceCommodityOrderStatus(order.id, 'completed')).toBeUndefined()
      expect(getCommodityOrderById(order.id)!.status).toBe('confirmed')
    })
  })

  describe('Confirmation memindahkan held quantity menjadi booked quantity', () => {
    it('slot heldQuantity -> 0 dan bookedQuantity bertambah sebesar qty saat vendor confirm', () => {
      const vendorId = 'VND-5-held-to-booked'
      const { product, slot } = publishVendorCommodity(vendorId, 6)
      const { selection } = clientSelectAndHold('PTY-5-held-to-booked', 'PRJ-101', product.id, slot.id, 3)
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(3)
      expect(getAvailabilitySlotById(slot.id)!.bookedQuantity).toBe(0)

      confirmCommodityOrderFromSelection(selection.id, vendorId)

      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
      expect(getAvailabilitySlotById(slot.id)!.bookedQuantity).toBe(3)
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(3)
    })
  })

  describe('Vendor order menggunakan snapshot commodity dan harga', () => {
    it('mengedit harga/nama commodity setelah Order dibuat tidak mengubah snapshot Order (reuse alur Phase 5)', () => {
      const vendorId = 'VND-5-snapshot'
      const { product, slot } = publishVendorCommodity(vendorId, 3, 450000)
      const { selection } = clientSelectAndHold('PTY-5-snapshot', 'PRJ-101', product.id, slot.id, 1)
      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)!
      expect(order.sellPriceIdrSnapshot).toBe(450000)

      product.sellPriceIdr = 999999
      product.name = 'Nama Baru Setelah Order'

      expect(getCommodityOrderById(order.id)!.sellPriceIdrSnapshot).toBe(450000)
      expect(getCommodityOrderById(order.id)!.commodityNameSnapshot).not.toBe('Nama Baru Setelah Order')
    })
  })

  describe('CMO-001 (seed) — Order confirmed sudah ada sebelum Phase 5', () => {
    it('sudah dihitung sold dan tampil pada ringkasan Sold Commodities VND-007', () => {
      expect(isCommodityOrderSold(getCommodityOrderById('CMO-001')!.status)).toBe(true)
      const summary = getVendorSoldCommoditiesSummary('VND-007')
      expect(summary.some(row => row.commodityProductId === 'CMD-008')).toBe(true)
    })
  })
})
