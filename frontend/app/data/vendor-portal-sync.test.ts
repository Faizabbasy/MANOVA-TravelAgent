import { describe, expect, it, vi } from 'vitest'
import { VENDOR_PRODUCTS, VENDOR_QUOTATIONS, VENDORS } from './vendors'
import { PROJECT_SERVICES } from './projects'
import { HOTEL_BOOKINGS } from './accommodation'
import { SERVICE_ORDERS } from './procurement'
import { createOwnVendorProductOnServer, loadVendorPortal, mergeVendorProducts, resetVendorPortal, takeVendorSnapshot } from './vendor-portal-sync'
import type { ManovaApi } from '~/lib/api/endpoints'

const ok = <T>(data: T) => Promise.resolve({ data })
const apiWith = (core: Record<string, unknown>) => ({ core } as unknown as Pick<ManovaApi, 'core'>)
const product = (id: string, vendorId = 'VND-006') => ({ id, vendorId, name: `Produk ${id}`, category: 'hotel' as const, description: null, priceMinor: '1200000' })

describe('vendor portal sync (S12d)', () => {
  it('the vendor’s products become the server’s; other vendors keep theirs', () => {
    const others = VENDOR_PRODUCTS.filter(p => p.vendorId !== 'VND-006').map(p => p.id)
    mergeVendorProducts('VND-006', [product('VPR-900')])
    expect(VENDOR_PRODUCTS.filter(p => p.vendorId === 'VND-006').map(p => p.id)).toEqual(['VPR-900'])
    expect(VENDOR_PRODUCTS.filter(p => p.vendorId !== 'VND-006').map(p => p.id)).toEqual(others)
    expect(VENDOR_PRODUCTS.find(p => p.id === 'VPR-900')?.priceIdr).toBe(1_200_000)
  })

  it('load reads the own vendor profile and products', async () => {
    const getVendor = vi.fn(() => ok({ id: 'VND-006', name: 'PT ABC Server', serviceType: 'hotel', status: 'active', contactName: 'Hasan', contactPhone: null, category: null }))
    const listOwnVendorProducts = vi.fn(() => ok([product('VPR-901')]))
    await loadVendorPortal(apiWith({ getVendor, listOwnVendorProducts }), 'VND-006')
    expect(getVendor).toHaveBeenCalledWith('VND-006')
    expect(VENDORS.find(v => v.id === 'VND-006')?.name).toBe('PT ABC Server')
    expect(VENDOR_PRODUCTS.filter(p => p.vendorId === 'VND-006').map(p => p.id)).toEqual(['VPR-901'])
  })

  it('a new product is added only after the server accepts it', async () => {
    const created = await createOwnVendorProductOnServer(apiWith({ createOwnVendorProduct: () => ok(product('VPR-902')) }), { name: 'Produk VPR-902', category: 'hotel', priceIdr: 1_200_000 })
    expect(created.id).toBe('VPR-902')
    const before = VENDOR_PRODUCTS.length
    await expect(createOwnVendorProductOnServer(apiWith({ createOwnVendorProduct: () => Promise.reject(new Error('400')) }), { name: '', category: 'hotel' })).rejects.toThrow()
    expect(VENDOR_PRODUCTS.length).toBe(before)
  })
})

describe('leaving the vendor session (S12d review)', () => {
  it('reset after a vendor session restores the shared lists the vendor syncs replaced', () => {
    const before = {
      services: PROJECT_SERVICES.map(s => s.id),
      hotels: HOTEL_BOOKINGS.map(b => b.id),
      orders: SERVICE_ORDERS.map(o => o.id),
      quotations: VENDOR_QUOTATIONS.map(q => q.id),
      products: VENDOR_PRODUCTS.map(p => p.id)
    }
    takeVendorSnapshot()
    PROJECT_SERVICES.splice(0, PROJECT_SERVICES.length)
    HOTEL_BOOKINGS.splice(0, HOTEL_BOOKINGS.length)
    SERVICE_ORDERS.splice(0, SERVICE_ORDERS.length)
    VENDOR_QUOTATIONS.splice(0, VENDOR_QUOTATIONS.length)
    mergeVendorProducts('VND-006', [])
    expect(resetVendorPortal()).toBe(true)
    expect(PROJECT_SERVICES.map(s => s.id)).toEqual(before.services)
    expect(HOTEL_BOOKINGS.map(b => b.id)).toEqual(before.hotels)
    expect(SERVICE_ORDERS.map(o => o.id)).toEqual(before.orders)
    expect(VENDOR_QUOTATIONS.map(q => q.id)).toEqual(before.quotations)
    expect(VENDOR_PRODUCTS.map(p => p.id)).toEqual(before.products)
    expect(resetVendorPortal()).toBe(false) // nothing left to restore
  })
})
