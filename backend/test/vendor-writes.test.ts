import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO_CORE } from '../src/db/seed-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S2 Vendor: profile, contacts, products and documents written through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

const FIRST_VND = `VND-${String(Math.max(...DEMO_CORE.vendors.map(v => Number(v.id.slice(4)))) + 1).padStart(3, '0')}`
let n = 0
const key = () => `vendor-key-${++n}-abcdef`
const post = (who: string, body: unknown, k: string | null = key()) =>
  t.call('POST', '/api/v1/vendors', { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('POST /vendors', () => {
  test('admin creates an active vendor with a server id; audit recorded', async () => {
    const res = await post('admin', { name: 'PT Bus Nusantara', serviceType: 'transportation', contactName: 'Andi', contactPhone: '0812-1', category: 'Ground Transportation' })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ id: FIRST_VND, name: 'PT Bus Nusantara', serviceType: 'transportation', status: 'active', contactName: 'Andi', contactPhone: '0812-1', category: 'Ground Transportation', provenance: 'manual' })
    const [a] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'vendor.created' and entity_id = $1", [FIRST_VND])
    expect(a!.n).toBe('1')
  })

  test('same key = one vendor; key required; validation; finance 403', async () => {
    const k = key()
    const a = await post('admin', { name: 'PT Sekali Vendor', serviceType: 'hotel', contactName: 'B' }, k)
    expect((await post('admin', { name: 'PT Sekali Vendor', serviceType: 'hotel', contactName: 'B' }, k)).json.data.id).toBe(a.json.data.id)
    expect((await post('admin', { name: 'X', serviceType: 'hotel', contactName: 'B' }, null)).status).toBe(400)
    const bad = await post('admin', { name: ' ', serviceType: 'kapal', contactName: '', status: 'aktif' })
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['contactName', 'name', 'serviceType', 'status'])
    expect((await post('finance', { name: 'X', serviceType: 'hotel', contactName: 'B' })).status).toBe(403)
  })

  test('a new vendor can be billed by Finance at once', async () => {
    const vendor = (await post('admin', { name: 'PT Tagihan Baru', serviceType: 'hotel', contactName: 'C' })).json.data.id as string
    const res = await t.call('POST', '/api/v1/finance/vendor-invoices', {
      cookie: c.finance,
      body: { vendorId: vendor, vendorInvoiceNumber: 'TB-001', invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '5000000', projectId: 'PRJ-101' }
    })
    expect(res.status).toBe(201)
  })
})

describe('PATCH /vendors/:id', () => {
  test('admin edits profile and status; service type and id are fixed; audit keeps before/after', async () => {
    const res = await t.call('PATCH', '/api/v1/vendors/VND-005', { cookie: c.admin, body: { status: 'active', category: 'Bus Pariwisata', contactPhone: '0899' } })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ status: 'active', category: 'Bus Pariwisata', contactPhone: '0899' })
    const [audit] = await t.db.query<{ before: { status: string } }>("select before from audit_events where action = 'vendor.updated' and entity_id = 'VND-005' order by id desc limit 1")
    expect(audit!.before.status).toBe('pending')
    for (const body of [{ serviceType: 'hotel' }, { id: 'VND-X' }]) {
      expect((await t.call('PATCH', '/api/v1/vendors/VND-005', { cookie: c.admin, body })).status, JSON.stringify(body)).toBe(400)
    }
    expect((await t.call('PATCH', '/api/v1/vendors/VND-999', { cookie: c.admin, body: { category: 'X' } })).status).toBe(404)
    expect((await t.call('PATCH', '/api/v1/vendors/VND-005', { cookie: c.finance, body: { category: 'X' } })).status).toBe(403)
  })
})

describe('contacts, products, documents', () => {
  test('admin adds each; lists show them to finance; vendor portal user cannot list all', async () => {
    const contact = await t.call('POST', '/api/v1/vendors/VND-002/contacts', { cookie: c.admin, body: { name: 'Rudi', title: 'Reservation', email: 'rudi@hotel.example' } })
    expect(contact.status).toBe(201)
    expect(contact.json.data.id).toMatch(/^VCT-\d+$/)
    const product = await t.call('POST', '/api/v1/vendors/VND-002/products', { cookie: c.admin, body: { name: 'Kamar Superior', category: 'hotel', priceMinor: '900000' } })
    expect(product.status).toBe(201)
    expect(product.json.data).toMatchObject({ id: expect.stringMatching(/^VPR-\d+$/), priceMinor: '900000' })
    const doc = await t.call('POST', '/api/v1/vendors/VND-002/documents', { cookie: c.admin, body: { name: 'Kontrak 2027.pdf', type: 'Kontrak' } })
    expect(doc.status).toBe(201)
    expect(doc.json.data).toMatchObject({ id: expect.stringMatching(/^VDOC-\d+$/), uploadedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })

    expect((await t.call('GET', '/api/v1/vendor-contacts', { cookie: c.finance })).json.data.some((x: { name: string }) => x.name === 'Rudi')).toBe(true)
    expect((await t.call('GET', '/api/v1/vendor-products', { cookie: c.finance })).json.data.some((x: { name: string }) => x.name === 'Kamar Superior')).toBe(true)
    expect((await t.call('GET', '/api/v1/vendor-documents', { cookie: c.finance })).json.data.some((x: { name: string }) => x.name === 'Kontrak 2027.pdf')).toBe(true)
    expect((await t.call('GET', '/api/v1/vendor-contacts', { cookie: c.vendor })).status).toBe(403)

    expect((await t.call('POST', '/api/v1/vendors/VND-002/products', { cookie: c.admin, body: { name: 'X', category: 'kapal', priceMinor: '-1' } })).status).toBe(400)
    expect((await t.call('POST', '/api/v1/vendors/VND-002/contacts', { cookie: c.finance, body: { name: 'X', title: 'Y' } })).status).toBe(403)
    expect((await t.call('POST', '/api/v1/vendors/VND-999/documents', { cookie: c.admin, body: { name: 'X', type: 'Y' } })).status).toBe(404)
  })
})
