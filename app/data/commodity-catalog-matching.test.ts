import { describe, it, expect } from 'vitest'
import {
  createCommodityProduct, updateCommodityProductStatus, createAvailabilitySlot, getAvailableQuantity, getAvailabilitySlotById,
  createCommodityRequirement, createCommoditySelection, hasActiveSelectionWithRank, hasActiveDuplicateSelection,
  submitAndHoldCommoditySelection, cancelCommoditySelectionHold, getCommoditySelectionById,
  computeHoldExpiry, sweepExpiredHolds, matchCommodityToRequirement, matchCommoditiesForRequirement,
  getCatalogVisibleCommodities, getCommodityTotalAvailable
} from './index'

/** Helper — commodity published + 1 slot siap pakai, dipakai berulang di seluruh test Phase 4 ini. */
function makePublishedCommodity (category: 'hotel' | 'flight' | 'mice' | 'transportation', totalQuantity: number, sellPriceIdr = 100000) {
  const product = createCommodityProduct({ vendorId: 'VND-001', name: `Matching Test ${category} ${Math.random()}`, category, sellPriceIdr })
  updateCommodityProductStatus(product.id, 'published')
  const slot = createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-10', totalQuantity })!
  return { product, slot }
}

describe('Commodity domain — Phase 4 (Catalog, Matching, Selection, Hold)', () => {
  describe('Catalog visibility', () => {
    it('getCatalogVisibleCommodities hanya menampilkan published/available/limited dengan availability > 0', () => {
      const { product } = makePublishedCommodity('hotel', 5)
      expect(getCatalogVisibleCommodities().some(p => p.id === product.id)).toBe(true)

      // Draft tidak boleh muncul
      expect(getCatalogVisibleCommodities().some(p => p.id === 'CMD-003')).toBe(false) // seed draft
      // Archived tidak boleh muncul
      expect(getCatalogVisibleCommodities().some(p => p.id === 'CMD-004')).toBe(false) // seed archived
      // Sold-out (availability 0) tidak boleh muncul walau status published-family
      expect(getCatalogVisibleCommodities().some(p => p.id === 'CMD-002')).toBe(false) // seed sold-out
    })
  })

  describe('Deterministic matching — Exact Match, Near Match, Alternative, No Match', () => {
    it('kategori berbeda selalu No Match (dikecualikan dari hasil)', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'flight', title: 'Flight Req', quantity: 1 })
      const { product: hotelProduct } = makePublishedCommodity('hotel', 10)
      expect(matchCommodityToRequirement(requirement, hotelProduct)).toBe('no-match')
      expect(matchCommoditiesForRequirement(requirement.id).some(r => r.commodity.id === hotelProduct.id)).toBe(false)
    })

    it('quantity cukup + tanggal requirement tercakup penuh dalam periode slot -> Exact Match', () => {
      const requirement = createCommodityRequirement({
        projectId: 'PRJ-101',
        clientPartyId: 'PTY-001',
        category: 'hotel',
        title: 'Exact Match Req',
        quantity: 3,
        detail: { category: 'hotel', checkInDate: '2026-09-02', checkOutDate: '2026-09-05' }
      })
      const { product } = makePublishedCommodity('hotel', 10)
      expect(matchCommodityToRequirement(requirement, product)).toBe('exact-match')
    })

    it('quantity cukup tapi tanggal requirement TIDAK tercakup periode slot manapun -> Near Match', () => {
      const requirement = createCommodityRequirement({
        projectId: 'PRJ-101',
        clientPartyId: 'PTY-001',
        category: 'hotel',
        title: 'Near Match Req',
        quantity: 2,
        detail: { category: 'hotel', checkInDate: '2026-12-01', checkOutDate: '2026-12-05' }
      })
      const { product } = makePublishedCommodity('hotel', 10)
      expect(matchCommodityToRequirement(requirement, product)).toBe('near-match')
    })

    it('quantity TIDAK cukup (available > 0 tapi < requested) -> Alternative', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'mice', title: 'Alternative Req', quantity: 10 })
      const { product } = makePublishedCommodity('mice', 2)
      expect(matchCommodityToRequirement(requirement, product)).toBe('alternative')
    })

    it('availability nol -> No Match walau status published', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'transportation', title: 'No Match Req', quantity: 1 })
      const { product } = makePublishedCommodity('transportation', 0)
      expect(matchCommodityToRequirement(requirement, product)).toBe('no-match')
    })

    it('matchCommoditiesForRequirement mengurutkan Exact -> Near -> Alternative', () => {
      const requirement = createCommodityRequirement({
        projectId: 'PRJ-101',
        clientPartyId: 'PTY-001',
        category: 'hotel',
        title: 'Sort Order Req',
        quantity: 2,
        detail: { category: 'hotel', checkInDate: '2026-09-02', checkOutDate: '2026-09-04' }
      })
      const exact = makePublishedCommodity('hotel', 10) // covers date, enough qty -> exact
      const alternative = makePublishedCommodity('hotel', 1) // not enough qty -> alternative
      const results = matchCommoditiesForRequirement(requirement.id)
      const exactIndex = results.findIndex(r => r.commodity.id === exact.product.id)
      const alternativeIndex = results.findIndex(r => r.commodity.id === alternative.product.id)
      expect(exactIndex).toBeGreaterThanOrEqual(0)
      expect(alternativeIndex).toBeGreaterThanOrEqual(0)
      expect(exactIndex).toBeLessThan(alternativeIndex)
    })

    it('sold-out dan suspended commodity (kategori sama: hotel) tidak pernah muncul di hasil matching', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Exclude Req', quantity: 1 })
      const results = matchCommoditiesForRequirement(requirement.id)
      expect(results.some(r => r.commodity.id === 'CMD-002')).toBe(false) // seed sold-out, kategori hotel
      expect(results.some(r => r.commodity.id === 'CMD-006')).toBe(false) // seed suspended, kategori hotel
    })

    it('expired commodity (kategori transportation) tidak pernah muncul di hasil matching', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'transportation', title: 'Exclude Expired Req', quantity: 1 })
      const results = matchCommoditiesForRequirement(requirement.id)
      expect(results.some(r => r.commodity.id === 'CMD-005')).toBe(false) // seed expired
    })
  })

  describe('Selection — Primary/Secondary/Third Choice, duplicate guard', () => {
    it('maksimal satu selection aktif per rank (primary/secondary/third-choice)', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Rank Req', quantity: 1 })
      const { product: a } = makePublishedCommodity('hotel', 5)
      const { product: b } = makePublishedCommodity('hotel', 5)
      const { product: c } = makePublishedCommodity('hotel', 5)

      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: a.id, quantity: 1, choiceRank: 'primary' })).toBeDefined()
      expect(hasActiveSelectionWithRank(requirement.id, 'primary')).toBe(true)
      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: b.id, quantity: 1, choiceRank: 'primary' })).toBeUndefined()

      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: b.id, quantity: 1, choiceRank: 'secondary' })).toBeDefined()
      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: c.id, quantity: 1, choiceRank: 'third-choice' })).toBeDefined()
      // Keempat rank sudah habis (hanya 3 rank tersedia) — commodity baru dengan rank apapun akan ditolak.
      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: c.id, quantity: 1, choiceRank: 'primary' })).toBeUndefined()
    })

    it('tidak ada duplicate active selection untuk commodity+variant yang sama (rank berbeda sekalipun)', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Duplicate Guard Req', quantity: 1 })
      const { product } = makePublishedCommodity('hotel', 5)
      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'primary' })).toBeDefined()
      expect(hasActiveDuplicateSelection(requirement.id, product.id, undefined)).toBe(true)
      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'secondary' })).toBeUndefined()
    })

    it('selection yang sudah cancelled tidak lagi dihitung aktif — rank & commodity bisa dipakai ulang', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Reuse After Cancel Req', quantity: 1 })
      const { product } = makePublishedCommodity('hotel', 5)
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'primary' })!
      cancelCommoditySelectionHold(selection.id)
      expect(hasActiveSelectionWithRank(requirement.id, 'primary')).toBe(false)
      expect(createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'primary' })).toBeDefined()
    })
  })

  describe('Availability recheck, Soft Hold, quantity tidak melebihi availability', () => {
    it('submitAndHoldCommoditySelection menolak bila quantity melebihi sisa availability', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Exceed Qty Req', quantity: 10 })
      const { product, slot } = makePublishedCommodity('hotel', 3)
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 10, choiceRank: 'primary' })!
      expect(submitAndHoldCommoditySelection(selection.id, slot.id, computeHoldExpiry())).toBeUndefined()
      expect(getAvailabilitySlotById(slot.id)!.heldQuantity).toBe(0)
    })

    it('Soft Hold berhasil mengurangi availability sementara (bukan permanen)', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Soft Hold Req', quantity: 2 })
      const { product, slot } = makePublishedCommodity('hotel', 5)
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 2, choiceRank: 'primary' })!
      const held = submitAndHoldCommoditySelection(selection.id, slot.id, computeHoldExpiry())!
      expect(held.status).toBe('soft-hold')
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(3)
    })

    it('computeHoldExpiry menghasilkan tanggal N hari setelah acuan', () => {
      expect(computeHoldExpiry('2026-07-29')).toBe('2026-08-01')
    })
  })

  describe('Hold expiry dan stock restoration', () => {
    // Ditaruh PALING AWAL dalam describe ini — `sweepExpiredHolds()` bersifat global (menyapu SELURUH
    // `COMMODITY_SELECTIONS`, termasuk seed), jadi test lain di bawah yang juga memanggilnya akan
    // ikut men-sweep CSL-005 lebih dulu bila urutannya dibalik.
    it('seed CSL-005 (hold sudah lewat, belum diproses) di-expire dan stok AVL-003 pulih setelah sweep', () => {
      const before = getAvailableQuantity(getAvailabilitySlotById('AVL-003')!)
      expect(before).toBe(0) // seed: totalQuantity 6, held 2, booked 4
      sweepExpiredHolds()
      expect(getCommoditySelectionById('CSL-005')!.status).toBe('expired')
      const after = getAvailableQuantity(getAvailabilitySlotById('AVL-003')!)
      expect(after).toBe(2) // heldQuantity (2) dikembalikan, bookedQuantity (4) tidak berubah
    })

    it('sweepExpiredHolds meng-expire soft-hold yang sudah lewat dan mengembalikan availability (stock restoration)', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Sweep Req', quantity: 4 })
      const { product, slot } = makePublishedCommodity('hotel', 4)
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 4, choiceRank: 'primary' })!
      submitAndHoldCommoditySelection(selection.id, slot.id, '2026-07-01') // holdExpiresAt sudah lewat DEMO_REFERENCE_DATE (2026-07-29)
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(0)

      const expired = sweepExpiredHolds()
      expect(expired.some(s => s.id === selection.id)).toBe(true)
      expect(getCommoditySelectionById(selection.id)!.status).toBe('expired')
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(4) // stok kembali penuh
    })

    it('sweepExpiredHolds TIDAK menyentuh hold yang masih aktif (belum lewat)', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Sweep Active Req', quantity: 1 })
      const { product, slot } = makePublishedCommodity('hotel', 5)
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 1, choiceRank: 'primary' })!
      submitAndHoldCommoditySelection(selection.id, slot.id, '2026-12-31') // jauh di depan DEMO_REFERENCE_DATE
      sweepExpiredHolds()
      expect(getCommoditySelectionById(selection.id)!.status).toBe('soft-hold')
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(4)
    })

    it('cancelCommoditySelectionHold (Hold cancellation) juga mengembalikan stok secara penuh', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Cancel Restore Req', quantity: 3 })
      const { product, slot } = makePublishedCommodity('hotel', 5)
      const selection = createCommoditySelection({ requirementId: requirement.id, commodityProductId: product.id, quantity: 3, choiceRank: 'primary' })!
      submitAndHoldCommoditySelection(selection.id, slot.id, computeHoldExpiry())
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(2)
      cancelCommoditySelectionHold(selection.id)
      expect(getAvailableQuantity(getAvailabilitySlotById(slot.id)!)).toBe(5)
    })
  })

  describe('getCommodityTotalAvailable — agregat dipakai katalog & matching', () => {
    it('menjumlahkan availability lintas seluruh slot milik satu commodity', () => {
      const product = createCommodityProduct({ vendorId: 'VND-001', name: 'Aggregate Test', category: 'hotel', sellPriceIdr: 100000 })
      createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-09-01', periodEnd: '2026-09-05', totalQuantity: 3 })
      createAvailabilitySlot({ commodityProductId: product.id, periodStart: '2026-10-01', periodEnd: '2026-10-05', totalQuantity: 4 })
      expect(getCommodityTotalAvailable(product.id)).toBe(7)
    })
  })
})
