import { describe, it, expect } from 'vitest'
import {
  createCommodityProduct, getCommodityProductById, getCommodityProductsByVendor, isCommodityProductDeletable, deleteCommodityProduct,
  createCommodityVariant, getCommodityVariantById, updateCommodityVariant,
  isCommodityVariantDeletable, deleteCommodityVariant,
  createAvailabilitySlot, getAvailabilitySlotById, holdAvailabilityQuantity,
  updateAvailabilitySlotDetails, isAvailabilitySlotDeletable, deleteAvailabilitySlot
} from './index'

describe('Commodity domain — Phase 2 (Vendor Commodity CRUD)', () => {
  describe('Permission isolation — Vendor hanya melihat/mengelola commodity miliknya', () => {
    it('getCommodityProductsByVendor tidak membocorkan commodity vendor lain', () => {
      createCommodityProduct({ vendorId: 'VND-ISO-A', name: 'Milik Vendor A', category: 'hotel', sellPriceIdr: 100000 })
      createCommodityProduct({ vendorId: 'VND-ISO-B', name: 'Milik Vendor B', category: 'hotel', sellPriceIdr: 100000 })

      const vendorAList = getCommodityProductsByVendor('VND-ISO-A')
      const vendorBList = getCommodityProductsByVendor('VND-ISO-B')

      expect(vendorAList.every(p => p.vendorId === 'VND-ISO-A')).toBe(true)
      expect(vendorBList.every(p => p.vendorId === 'VND-ISO-B')).toBe(true)
      expect(vendorAList.some(p => p.name === 'Milik Vendor B')).toBe(false)
      expect(vendorBList.some(p => p.name === 'Milik Vendor A')).toBe(false)
    })
  })

  describe('Commodity Variant — CRUD', () => {
    it('createCommodityVariant gagal untuk commodityProductId yang tidak ada', () => {
      expect(createCommodityVariant('CMD-TIDAK-ADA', 'Variant X')).toBeUndefined()
    })

    it('updateCommodityVariant memperbarui nama dan harga override', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Variant CRUD Product', category: 'hotel', sellPriceIdr: 200000 })
      const variant = createCommodityVariant(product.id, 'Nama Awal')!
      const updated = updateCommodityVariant(variant.id, { name: 'Nama Baru', sellPriceIdr: 250000 })!
      expect(updated.name).toBe('Nama Baru')
      expect(updated.sellPriceIdr).toBe(250000)
      expect(getCommodityVariantById(variant.id)!.name).toBe('Nama Baru')
    })

    it('variant yang direferensikan AvailabilitySlot tidak dapat dihapus', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Variant Referenced Product', category: 'hotel', sellPriceIdr: 200000 })
      const variant = createCommodityVariant(product.id, 'Referenced Variant')!
      createAvailabilitySlot({ commodityProductId: product.id, variantId: variant.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })
      expect(isCommodityVariantDeletable(variant.id)).toBe(false)
      expect(deleteCommodityVariant(variant.id)).toBe(false)
      expect(getCommodityVariantById(variant.id)).toBeDefined()
    })

    it('variant yang belum direferensikan dapat dihapus', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Variant Unreferenced Product', category: 'hotel', sellPriceIdr: 200000 })
      const variant = createCommodityVariant(product.id, 'Unreferenced Variant')!
      expect(isCommodityVariantDeletable(variant.id)).toBe(true)
      expect(deleteCommodityVariant(variant.id)).toBe(true)
      expect(getCommodityVariantById(variant.id)).toBeUndefined()
    })
  })

  describe('Commodity Product — Delete Draft vs Archive', () => {
    it('draft tanpa referensi dapat dihapus, beserta seluruh variant miliknya (cascade)', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Deletable Draft', category: 'hotel', sellPriceIdr: 200000 })
      const variant = createCommodityVariant(product.id, 'Variant Ikut Terhapus')!
      expect(isCommodityProductDeletable(product.id)).toBe(true)
      expect(deleteCommodityProduct(product.id)).toBe(true)
      expect(getCommodityProductById(product.id)).toBeUndefined()
      expect(getCommodityVariantById(variant.id)).toBeUndefined()
    })

    it('draft yang sudah direferensikan AvailabilitySlot TIDAK dapat dihapus (harus di-archive)', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Referenced Draft', category: 'hotel', sellPriceIdr: 200000 })
      createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })
      expect(isCommodityProductDeletable(product.id)).toBe(false)
      expect(deleteCommodityProduct(product.id)).toBe(false)
      expect(getCommodityProductById(product.id)).toBeDefined()
    })

    it('commodity yang bukan draft (published/dst) tidak dapat dihapus sama sekali', () => {
      expect(isCommodityProductDeletable('CMD-001')).toBe(false) // seed, status 'available'
      expect(deleteCommodityProduct('CMD-001')).toBe(false)
    })
  })

  describe('Availability Slot — update detail dan delete', () => {
    it('updateAvailabilitySlotDetails mengubah periode/cutoff tanpa menyentuh quantity', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Slot Detail Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      holdAvailabilityQuantity(slot.id, 2)
      const updated = updateAvailabilitySlotDetails(slot.id, { periodStart: '2026-10-01', periodEnd: '2026-10-05', bookingCutoff: '2026-09-28' })!
      expect(updated.periodStart).toBe('2026-10-01')
      expect(updated.periodEnd).toBe('2026-10-05')
      expect(updated.bookingCutoff).toBe('2026-09-28')
      expect(updated.heldQuantity).toBe(2) // tidak berubah
      expect(updated.totalQuantity).toBe(5) // tidak berubah
    })

    it('slot dengan held/booked > 0 tidak dapat dihapus', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Slot Held Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      holdAvailabilityQuantity(slot.id, 1)
      expect(isAvailabilitySlotDeletable(slot.id)).toBe(false)
      expect(deleteAvailabilitySlot(slot.id)).toBe(false)
      expect(getAvailabilitySlotById(slot.id)).toBeDefined()
    })

    it('slot kosong (held dan booked nol) dapat dihapus', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Slot Empty Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      expect(isAvailabilitySlotDeletable(slot.id)).toBe(true)
      expect(deleteAvailabilitySlot(slot.id)).toBe(true)
      expect(getAvailabilitySlotById(slot.id)).toBeUndefined()
    })
  })

  describe('Published commodity masuk shared catalog / archived tidak tampil ke Client', () => {
    it('commodity published tetap terbaca lewat query umum (sumber data sama untuk Vendor dan Client)', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Catalog Visible Product', category: 'hotel', sellPriceIdr: 200000 })
      product.status = 'published'
      const found = getCommodityProductsByVendor('VND-001').find(p => p.id === product.id)
      expect(found?.status).toBe('published')
    })

    it('CMD-004 (seed, archived) tetap ada di data tapi berstatus archived — query katalog Client (Phase 4) wajib memfilter status ini', () => {
      const archived = getCommodityProductById('CMD-004')!
      expect(archived.status).toBe('archived')
    })
  })
})
