import { describe, it, expect, afterEach } from 'vitest'
import { VENDOR_CONTACTS, VENDOR_DOCUMENTS, VENDOR_PRODUCTS, VENDORS } from './vendors'
import { createVendorOnServer, mergeServerVendorCatalog, mergeServerVendors, upsertServerVendor } from './vendors-sync'
import type { VendorDto } from '~/types/api'

const dto = (over: Partial<VendorDto> = {}): VendorDto => ({
  id: 'VND-901', name: 'PT Uji Vendor', serviceType: 'hotel', status: 'active', contactName: 'Andi', contactPhone: null, category: null, provenance: 'manual', ...over
})
const snap = <T>(a: T[]) => a.map(x => ({ ...x }))
const v0 = snap(VENDORS); const c0 = snap(VENDOR_CONTACTS); const p0 = snap(VENDOR_PRODUCTS); const d0 = snap(VENDOR_DOCUMENTS)
afterEach(() => {
  VENDORS.splice(0, VENDORS.length, ...snap(v0))
  VENDOR_CONTACTS.splice(0, VENDOR_CONTACTS.length, ...snap(c0))
  VENDOR_PRODUCTS.splice(0, VENDOR_PRODUCTS.length, ...snap(p0))
  VENDOR_DOCUMENTS.splice(0, VENDOR_DOCUMENTS.length, ...snap(d0))
})

describe('vendors-sync (S2)', () => {
  it('memperbarui vendor di tempat; null jadi undefined', () => {
    const local = VENDORS.find(v => v.id === 'VND-002')!
    upsertServerVendor(dto({ id: 'VND-002', name: 'Hotel Prima Mitra Baru', category: null, contactPhone: '0899' }))
    expect(VENDORS.find(v => v.id === 'VND-002')).toBe(local)
    expect(local).toMatchObject({ name: 'Hotel Prima Mitra Baru', contactPhone: '0899' })
    expect(local.category).toBeUndefined()
  })

  it('merge menghapus vendor yang tidak ada di server; katalog diganti daftar server', () => {
    mergeServerVendors([dto({ id: 'VND-001' }), dto({ id: 'VND-950' })])
    expect(VENDORS.map(v => v.id)).toEqual(['VND-001', 'VND-950'])
    mergeServerVendorCatalog({
      contacts: [{ id: 'VCT-900', vendorId: 'VND-001', name: 'A', title: 'B', email: null, phone: null }],
      products: [{ id: 'VPR-900', vendorId: 'VND-001', name: 'Paket', category: 'hotel', description: null, priceMinor: '1500000' }],
      documents: [{ id: 'VDOC-900', vendorId: 'VND-001', name: 'Kontrak.pdf', type: 'Kontrak', uploadedAt: '2026-10-06' }]
    })
    expect(VENDOR_CONTACTS.map(x => x.id)).toEqual(['VCT-900'])
    expect(VENDOR_PRODUCTS[0]).toMatchObject({ id: 'VPR-900', priceIdr: 1_500_000 })
    expect(VENDOR_DOCUMENTS[0]).toMatchObject({ id: 'VDOC-900', uploadedAt: '2026-10-06' })
  })

  it('createVendorOnServer mengirim input dan mendaftarkan hasil server', async () => {
    const sent: unknown[] = []
    const api = { core: { createVendor: (input: unknown, k: string) => { sent.push({ input, k }); return Promise.resolve({ data: dto({ id: 'VND-008', name: 'PT Bus' }) }) } } }
    const vendor = await createVendorOnServer(api as never, { name: 'PT Bus', serviceType: 'transportation', contactName: 'B' }, 'key-vendor-001')
    expect(sent).toEqual([{ input: { name: 'PT Bus', serviceType: 'transportation', contactName: 'B' }, k: 'key-vendor-001' }])
    expect(vendor.id).toBe('VND-008')
    expect(VENDORS.some(v => v.id === 'VND-008')).toBe(true)
  })
})
