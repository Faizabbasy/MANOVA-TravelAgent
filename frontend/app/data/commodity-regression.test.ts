import { describe, it, expect } from 'vitest'
import {
  createCommodityProduct, updateCommodityProductStatus, getCommodityProductById, createAvailabilitySlot, getAvailabilitySlotById,
  createCommodityRequirement, createCommoditySelection, submitAndHoldCommoditySelection, getCommoditySelectionById,
  computeHoldExpiry, sweepExpiredHolds, isHoldExpired,
  confirmCommodityOrderFromSelection, getPendingSoftHoldSelectionsByVendor, getCommodityOrderBySelection
} from './index'

/** Helper — Vendor Publish + 1 slot, sama seperti `commodity-vendor-orders.test.ts`. */
function publishVendorCommodity (vendorId: string, totalQuantity: number, sellPriceIdr = 250000) {
  const product = createCommodityProduct({ vendorId, name: `Regression Test ${Math.random()}`, category: 'hotel', sellPriceIdr })
  updateCommodityProductStatus(product.id, 'published')
  const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-10', totalQuantity })!
  return { product, slot }
}

function clientSelectAndHold (clientPartyId: string, projectId: string, commodityProductId: string, slotId: string, quantity: number, holdExpiresAt: string = computeHoldExpiry()) {
  const requirement = createCommodityRequirement({ projectId, clientPartyId, category: 'hotel', title: 'Regression Test Requirement', quantity })
  const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId, quantity, choiceRank: 'primary' })!
  const held = submitAndHoldCommoditySelection(selection.id, slotId, holdExpiresAt)!
  return { requirement, selection, held }
}

describe('Commodity domain — Phase 6 (Regression & Edge Cases)', () => {
  describe('Defect: Archive referenced commodity — Soft Hold lama tidak boleh dikonfirmasi jadi Order setelah komoditas diarsipkan', () => {
    it('confirmCommodityOrderFromSelection menolak (undefined) saat product sudah archived', () => {
      const vendorId = 'VND-6-archive-defect'
      const { product, slot } = publishVendorCommodity(vendorId, 5)
      const { selection } = clientSelectAndHold('PTY-6-archive-defect', 'PRJ-101', product.id, slot.id, 2)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('soft-hold')

      // Vendor mengarsipkan komoditas SETELAH Client sudah Soft Hold (skenario defect Phase 6).
      updateCommodityProductStatus(product.id, 'archived')
      expect(getCommoditySelectionById(selection.id)!.status).toBe('soft-hold') // archive tidak menyentuh selection

      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)
      expect(order).toBeUndefined()
      expect(getCommodityOrderBySelection(selection.id)).toBeUndefined()
      // Selection tetap soft-hold, tidak diam-diam ikut berubah walau confirm ditolak.
      expect(getCommoditySelectionById(selection.id)!.status).toBe('soft-hold')
    })

    it('confirmCommodityOrderFromSelection menolak saat product sudah suspended (unpublish)', () => {
      const vendorId = 'VND-6-suspend-defect'
      const { product, slot } = publishVendorCommodity(vendorId, 5)
      const { selection } = clientSelectAndHold('PTY-6-suspend-defect', 'PRJ-101', product.id, slot.id, 1)
      updateCommodityProductStatus(product.id, 'suspended')
      expect(confirmCommodityOrderFromSelection(selection.id, vendorId)).toBeUndefined()
    })

    it('confirmCommodityOrderFromSelection tetap berhasil bila product sold-out (stok untuk hold ini sudah dicadangkan sebelumnya)', () => {
      const vendorId = 'VND-6-soldout-ok'
      const { product, slot } = publishVendorCommodity(vendorId, 2)
      const { selection } = clientSelectAndHold('PTY-6-soldout-ok', 'PRJ-101', product.id, slot.id, 2)
      // Availability habis dipakai selection ini sendiri -> product otomatis sold-out (derived status).
      expect(getCommodityProductById(product.id)!.status).toBe('sold-out')
      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)
      expect(order).toBeDefined()
      expect(order!.status).toBe('confirmed')
    })
  })

  describe('Defect: Expired hold — sweepExpiredHolds harus dijalankan sebelum vendor melihat/mengonfirmasi pending list', () => {
    it('selection soft-hold yang sudah lewat holdExpiresAt tetap muncul di pending list SEBELUM sweep, dan hilang SETELAH sweep', () => {
      const vendorId = 'VND-6-expired-hold'
      const { product, slot } = publishVendorCommodity(vendorId, 4)
      const { selection } = clientSelectAndHold('PTY-6-expired-hold', 'PRJ-101', product.id, slot.id, 2, '2020-01-01')
      expect(isHoldExpired(getCommoditySelectionById(selection.id)!.holdExpiresAt)).toBe(true)

      // Sebelum sweep — hold yang sudah kadaluarsa masih tampak seolah pending (bug yang diperbaiki Phase 6
      // adalah TIDAK memanggil sweep di halaman Vendor Orders; primitive-nya sendiri memang lazy by design).
      expect(getPendingSoftHoldSelectionsByVendor(vendorId).some(s => s.id === selection.id)).toBe(true)

      sweepExpiredHolds()

      expect(getCommoditySelectionById(selection.id)!.status).toBe('expired')
      expect(getPendingSoftHoldSelectionsByVendor(vendorId).some(s => s.id === selection.id)).toBe(false)
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)

      // Setelah expired, confirm tidak lagi mungkin (selection bukan lagi soft-hold).
      expect(confirmCommodityOrderFromSelection(selection.id, vendorId)).toBeUndefined()
    })
  })

  describe('Sanity — fungsi Phase 1-5 lain tidak terdampak perubahan guard Phase 6', () => {
    it('confirmCommodityOrderFromSelection tetap berhasil untuk product published biasa (jalur happy path tidak rusak)', () => {
      const vendorId = 'VND-6-sanity'
      const { product, slot } = publishVendorCommodity(vendorId, 3)
      const { selection } = clientSelectAndHold('PTY-6-sanity', 'PRJ-101', product.id, slot.id, 1)
      const order = confirmCommodityOrderFromSelection(selection.id, vendorId)
      expect(order).toBeDefined()
      expect(order!.commodityProductId).toBe(product.id)
    })
  })
})
