import { describe, expect, it, vi } from 'vitest'
import { VENDOR_PRODUCTS, VENDORS } from './vendors'
import { createOwnVendorProductOnServer, loadVendorPortal, mergeVendorProducts } from './vendor-portal-sync'
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
