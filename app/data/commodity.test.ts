import { describe, it, expect } from 'vitest'
import {
  getCommodityProductById, getCommodityProductsByVendor, createCommodityProduct, updateCommodityProductStatus,
  getCommodityProductStatusTransitions, syncCommodityProductAvailabilityStatus,
  getAvailableQuantity, getAvailabilitySlotById, createAvailabilitySlot, updateAvailabilitySlotTotal,
  holdAvailabilityQuantity, releaseAvailabilityHold, confirmAvailabilityHold, isHoldExpired,
  getCommodityRequirementById, getCommodityRequirementsByClient, createCommodityRequirement,
  updateCommodityRequirement, updateCommodityRequirementStatus, getCommodityRequirementStatusTransitions,
  isCommodityRequirementEditable, isCommodityRequirementDeletable, deleteCommodityRequirement,
  getCommoditySelectionById, hasActiveSelectionWithRank, createCommoditySelection,
  submitAndHoldCommoditySelection, confirmCommoditySelection, cancelCommoditySelectionHold, expireCommoditySelectionHold,
  createCommodityOrderFromSelection, isCommodityOrderSold, getCommodityOrderStatusTransitions, getCommodityOrderById,
  getCommodityProducts, getCommodityRequirements
} from './index'

describe('Commodity domain — Phase 1', () => {
  describe('Commodity Product vs Commodity Requirement tetap entitas berbeda', () => {
    it('disimpan di array terpisah dengan prefix ID berbeda', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Test Product', category: 'flight', sellPriceIdr: 100000 })
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'flight', title: 'Test Requirement', quantity: 1 })
      expect(product.id.startsWith('CMD-')).toBe(true)
      expect(requirement.id.startsWith('CRQ-')).toBe(true)
      expect(getCommodityProducts().some(p => p.id === requirement.id)).toBe(false)
      expect(getCommodityRequirements().some(r => r.id === product.id)).toBe(false)
    })
  })

  describe('Client dan Vendor membaca sumber data yang sama', () => {
    it('getCommodityProductsByVendor dan getCommodityProducts membaca array module-level yang sama', () => {
      const product = createCommodityProduct({ vendorId: 'VND-9-shared-test', name: 'Shared Source Test', category: 'hotel', sellPriceIdr: 500000 })
      const viaVendorQuery = getCommodityProductsByVendor('VND-9-shared-test')
      const viaFullList = getCommodityProducts().filter(p => p.vendorId === 'VND-9-shared-test')
      expect(viaVendorQuery).toHaveLength(1)
      expect(viaVendorQuery[0]).toBe(viaFullList[0])
      // `product` adalah objek mentah hasil create; `viaVendorQuery[0]` adalah reactive proxy Vue yang
      // membungkus objek yang sama (array data di-`reactive()`-kan) — beda reference (`toBe` gagal by
      // design), tapi sama datanya (`toEqual`), dan mutasi pada salah satunya tetap tercermin di keduanya.
      expect(viaVendorQuery[0]).toEqual(product)
    })

    it('getCommodityRequirementsByClient membaca sumber yang sama dengan getCommodityRequirementById', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-102', clientPartyId: 'PTY-9-shared-test', category: 'mice', title: 'Shared Source Requirement', quantity: 2 })
      const byClient = getCommodityRequirementsByClient('PTY-9-shared-test')
      expect(byClient[0]).toBe(getCommodityRequirementById(requirement.id))
    })
  })

  describe('Availability — formula dan validasi tidak boleh negatif', () => {
    it('getAvailableQuantity = totalQuantity - heldQuantity - bookedQuantity (data seed)', () => {
      const slot = getAvailabilitySlotById('AVL-001')!
      expect(getAvailableQuantity(slot)).toBe(slot.totalQuantity - slot.heldQuantity - slot.bookedQuantity)
      expect(getAvailableQuantity(slot)).toBe(5)
    })

    it('slot sold-out (AVL-002) menghasilkan availableQuantity = 0, bukan negatif', () => {
      const slot = getAvailabilitySlotById('AVL-002')!
      expect(getAvailableQuantity(slot)).toBe(0)
    })

    it('holdAvailabilityQuantity gagal (undefined) bila qty melebihi sisa availability — mencegah overselling/negative stock', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Limited Stock Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 3 })!
      expect(holdAvailabilityQuantity(slot.id, 5)).toBeUndefined()
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(3)
    })

    it('holdAvailabilityQuantity berhasil dalam batas, releaseAvailabilityHold mengembalikan stok tanpa pernah negatif', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Hold Release Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      expect(holdAvailabilityQuantity(slot.id, 4)).toBeDefined()
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(1)
      releaseAvailabilityHold(slot.id, 4)
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
      // Release berlebih tidak boleh membuat heldQuantity negatif.
      releaseAvailabilityHold(slot.id, 10)
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
    })

    it('confirmAvailabilityHold memindahkan qty dari held ke booked tanpa mengubah total', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Confirm Hold Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      holdAvailabilityQuantity(slot.id, 3)
      const confirmed = confirmAvailabilityHold(slot.id, 3)!
      expect(confirmed.heldQuantity).toBe(0)
      expect(confirmed.bookedQuantity).toBe(3)
      expect(confirmed.totalQuantity).toBe(5)
      expect(getAvailableQuantity(confirmed)).toBe(2)
    })

    it('confirmAvailabilityHold gagal bila qty melebihi heldQuantity yang ada', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Confirm Excess Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      holdAvailabilityQuantity(slot.id, 2)
      expect(confirmAvailabilityHold(slot.id, 3)).toBeUndefined()
    })

    it('updateAvailabilitySlotTotal menolak kapasitas di bawah bookedQuantity', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Reduce Capacity Product', category: 'hotel', sellPriceIdr: 200000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      holdAvailabilityQuantity(slot.id, 4)
      confirmAvailabilityHold(slot.id, 4)
      expect(updateAvailabilitySlotTotal(slot.id, 2)).toBeUndefined()
      expect(getAvailabilitySlotById(slot.id)!.totalQuantity).toBe(5)
      expect(updateAvailabilitySlotTotal(slot.id, 10)).toBeDefined()
      expect(getAvailabilitySlotById(slot.id)!.totalQuantity).toBe(10)
    })

    it('isHoldExpired: CSL-005 (seed) sudah lewat DEMO_REFERENCE_DATE, CSL-001 belum', () => {
      const expired = getCommoditySelectionById('CSL-005')!
      const active = getCommoditySelectionById('CSL-001')!
      expect(isHoldExpired(expired.holdExpiresAt)).toBe(true)
      expect(isHoldExpired(active.holdExpiresAt)).toBe(false)
    })
  })

  describe('Commodity Product — state transition', () => {
    it('draft hanya boleh ke published atau archived', () => {
      expect(getCommodityProductStatusTransitions('draft')).toEqual(['published', 'archived'])
    })

    it('archived adalah status terminal (tidak ada transisi keluar)', () => {
      expect(getCommodityProductStatusTransitions('archived')).toEqual([])
    })

    it('updateCommodityProductStatus menolak transisi tidak valid (draft -> available)', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Invalid Transition Product', category: 'hotel', sellPriceIdr: 200000 })
      expect(updateCommodityProductStatus(product.id, 'available')).toBeUndefined()
      expect(getCommodityProductById(product.id)!.status).toBe('draft')
    })

    it('updateCommodityProductStatus menerima transisi valid (draft -> published)', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Valid Transition Product', category: 'hotel', sellPriceIdr: 200000 })
      expect(updateCommodityProductStatus(product.id, 'published')).toBeDefined()
      expect(getCommodityProductById(product.id)!.status).toBe('published')
    })

    it('syncCommodityProductAvailabilityStatus menurunkan status dari agregat availability (available/limited/sold-out)', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Sync Status Product', category: 'hotel', sellPriceIdr: 200000 })
      updateCommodityProductStatus(product.id, 'published')
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 10 })!
      expect(getCommodityProductById(product.id)!.status).toBe('available')

      holdAvailabilityQuantity(slot.id, 8) // sisa 2 -> limited (threshold 3)
      expect(getCommodityProductById(product.id)!.status).toBe('limited')

      holdAvailabilityQuantity(slot.id, 2) // sisa 0 -> sold-out
      expect(getCommodityProductById(product.id)!.status).toBe('sold-out')

      releaseAvailabilityHold(slot.id, 10) // sisa 10 -> available lagi
      expect(getCommodityProductById(product.id)!.status).toBe('available')
    })

    it('syncCommodityProductAvailabilityStatus TIDAK menyentuh status draft/archived/suspended/expired', () => {
      const draftProduct = createCommodityProduct({ vendorId: 'VND-001', name: 'Draft Untouched Product', category: 'hotel', sellPriceIdr: 200000 })
      createAvailabilitySlot({ commodityProductId: draftProduct.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 0 })
      expect(getCommodityProductById(draftProduct.id)!.status).toBe('draft')

      const archivedProduct = getCommodityProductById('CMD-004')!
      expect(archivedProduct.status).toBe('archived')
      syncCommodityProductAvailabilityStatus('CMD-004')
      expect(getCommodityProductById('CMD-004')!.status).toBe('archived')
    })
  })

  describe('Commodity Requirement — state transition dan CRUD', () => {
    it('status terminal (closed/cancelled) tidak memiliki transisi keluar', () => {
      expect(getCommodityRequirementStatusTransitions('closed')).toEqual([])
      expect(getCommodityRequirementStatusTransitions('cancelled')).toEqual([])
    })

    it('updateCommodityRequirementStatus menolak transisi dari status terminal', () => {
      const requirement = getCommodityRequirementById('CRQ-004')! // closed (seed)
      expect(updateCommodityRequirementStatus(requirement.id, 'open')).toBeUndefined()
    })

    it('hanya requirement draft yang editable', () => {
      expect(isCommodityRequirementEditable('draft')).toBe(true)
      expect(isCommodityRequirementEditable('open')).toBe(false)
      expect(isCommodityRequirementEditable('closed')).toBe(false)
    })

    it('updateCommodityRequirement menolak edit pada requirement yang sudah open/closed', () => {
      const openRequirement = getCommodityRequirementById('CRQ-001')! // open (seed)
      expect(updateCommodityRequirement(openRequirement.id, { title: 'Diedit paksa' })).toBeUndefined()
      expect(getCommodityRequirementById('CRQ-001')!.title).not.toBe('Diedit paksa')
    })

    it('draft/open aman dihapus, selection-in-progress tidak', () => {
      expect(isCommodityRequirementDeletable('draft')).toBe(true)
      expect(isCommodityRequirementDeletable('open')).toBe(true)
      expect(isCommodityRequirementDeletable('selection-in-progress')).toBe(false)
    })

    it('deleteCommodityRequirement menolak menghapus requirement yang sudah selection-in-progress', () => {
      expect(deleteCommodityRequirement('CRQ-003')).toBe(false)
      expect(getCommodityRequirementById('CRQ-003')).toBeDefined()
    })

    it('deleteCommodityRequirement berhasil untuk requirement draft', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'flight', title: 'Akan Dihapus', quantity: 1 })
      expect(deleteCommodityRequirement(requirement.id)).toBe(true)
      expect(getCommodityRequirementById(requirement.id)).toBeUndefined()
    })
  })

  describe('Commodity Selection — primary/secondary/third-choice, soft hold, confirm, cancel, expire', () => {
    it('hanya boleh ada satu primary aktif per requirement (data seed CRQ-003)', () => {
      expect(hasActiveSelectionWithRank('CRQ-003', 'primary')).toBe(true)
      expect(createCommoditySelection({ requirementId: 'CRQ-003', commodityProductId: 'CMD-008', quantity: 1, choiceRank: 'primary' })).toBeUndefined()
    })

    it('rank third-choice tetap bisa ditambahkan walau primary dan secondary sudah terisi (seed CRQ-003)', () => {
      const thirdChoice = createCommoditySelection({ requirementId: 'CRQ-003', commodityProductId: 'CMD-008', quantity: 1, choiceRank: 'third-choice' })
      expect(thirdChoice).toBeDefined()
      expect(thirdChoice!.status).toBe('draft')
    })

    it('submitAndHoldCommoditySelection: availability diperiksa, gagal bila stok tidak cukup', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Selection Insufficient Product', category: 'hotel', sellPriceIdr: 100000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 1 })!
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Insufficient Stock Requirement', quantity: 5 })
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 5, choiceRank: 'primary' })!
      expect(submitAndHoldCommoditySelection(selection.id, slot.id, '2026-09-10')).toBeUndefined()
      expect(getCommoditySelectionById(selection.id)!.status).toBe('under-validation')
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(1)
    })

    it('submitAndHoldCommoditySelection -> confirmCommoditySelection: full flow dari draft sampai confirmed', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Full Flow Product', category: 'hotel', sellPriceIdr: 100000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Full Flow Requirement', quantity: 2 })
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 2, choiceRank: 'primary' })!

      const held = submitAndHoldCommoditySelection(selection.id, slot.id, '2026-09-10')!
      expect(held.status).toBe('soft-hold')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(2)

      const confirmed = confirmCommoditySelection(selection.id)!
      expect(confirmed.status).toBe('confirmed')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
      expect(getAvailabilitySlotById(slot.id)!.bookedQuantity).toBe(2)
    })

    it('cancelCommoditySelectionHold mengembalikan stok yang sedang ditahan', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Cancel Hold Product', category: 'hotel', sellPriceIdr: 100000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Cancel Hold Requirement', quantity: 3 })
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 3, choiceRank: 'primary' })!
      submitAndHoldCommoditySelection(selection.id, slot.id, '2026-09-10')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(3)

      const cancelled = cancelCommoditySelectionHold(selection.id)!
      expect(cancelled.status).toBe('cancelled')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(5)
    })

    it('expireCommoditySelectionHold mengembalikan stok yang tertahan (mencegah "hold tidak mengembalikan stok")', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Expire Hold Product', category: 'hotel', sellPriceIdr: 100000 })
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 4 })!
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Expire Hold Requirement', quantity: 4 })
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 4, choiceRank: 'primary' })!
      submitAndHoldCommoditySelection(selection.id, slot.id, '2026-07-01')
      expect(isHoldExpired(getCommoditySelectionById(selection.id)!.holdExpiresAt)).toBe(true)

      const expired = expireCommoditySelectionHold(selection.id)!
      expect(expired.status).toBe('expired')
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(4)
    })

    it('expireCommoditySelectionHold hanya berlaku dari status soft-hold', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Expire Draft Requirement', quantity: 1 })
      const draftSelection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: 'CMD-001', quantity: 1, choiceRank: 'primary' })!
      expect(expireCommoditySelectionHold(draftSelection.id)).toBeUndefined()
    })
  })

  describe('Commodity Order — snapshot harga dan status sold', () => {
    it('createCommodityOrderFromSelection hanya berhasil dari selection berstatus confirmed', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Order From Draft Requirement', quantity: 1 })
      const draftSelection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: 'CMD-001', quantity: 1, choiceRank: 'primary' })!
      expect(createCommodityOrderFromSelection(draftSelection.id, 'PRJ-101')).toBeUndefined()
    })

    it('harga confirmed order menggunakan snapshot — tidak berubah walau harga commodity diedit setelahnya', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Snapshot Test Product', category: 'hotel', sellPriceIdr: 777000 })
      updateCommodityProductStatus(product.id, 'published')
      const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 5 })!
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Snapshot Requirement', quantity: 1 })
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'primary' })!
      submitAndHoldCommoditySelection(selection.id, slot.id, '2026-09-10')
      confirmCommoditySelection(selection.id)

      const order = createCommodityOrderFromSelection(selection.id, 'PRJ-101')!
      expect(order.sellPriceIdrSnapshot).toBe(777000)
      expect(order.commodityNameSnapshot).toBe('Snapshot Test Product')

      // Vendor mengedit harga & nama produk SETELAH order terbentuk.
      product.sellPriceIdr = 999000
      product.name = 'Nama Sudah Diubah Vendor'

      expect(order.sellPriceIdrSnapshot).toBe(777000)
      expect(order.commodityNameSnapshot).toBe('Snapshot Test Product')
    })

    it('CMO-001 (seed) adalah snapshot dari CMD-008 pada saat dibuat', () => {
      const order = getCommodityOrderById('CMO-001')!
      const product = getCommodityProductById('CMD-008')!
      expect(order.commodityNameSnapshot).toBe(product.name)
      expect(order.sellPriceIdrSnapshot).toBe(8000000)
      expect(order.vendorId).toBe('VND-007')
      expect(isCommodityOrderSold(order.status)).toBe(true)
    })

    it('isCommodityOrderSold: soft-hold belum dihitung sold, confirmed/booked/in-service/completed dihitung sold', () => {
      expect(isCommodityOrderSold('soft-hold')).toBe(false)
      expect(isCommodityOrderSold('inquiry')).toBe(false)
      expect(isCommodityOrderSold('confirmed')).toBe(true)
      expect(isCommodityOrderSold('booked')).toBe(true)
      expect(isCommodityOrderSold('in-service')).toBe(true)
      expect(isCommodityOrderSold('completed')).toBe(true)
      expect(isCommodityOrderSold('cancelled')).toBe(false)
      expect(isCommodityOrderSold('expired')).toBe(false)
      expect(isCommodityOrderSold('refunded')).toBe(false)
    })

    it('status order terminal (cancelled/expired/refunded) tidak punya transisi lanjutan', () => {
      expect(getCommodityOrderStatusTransitions('cancelled')).toEqual([])
      expect(getCommodityOrderStatusTransitions('expired')).toEqual([])
      expect(getCommodityOrderStatusTransitions('refunded')).toEqual([])
    })
  })
})
