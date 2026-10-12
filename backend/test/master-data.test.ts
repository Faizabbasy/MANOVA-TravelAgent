import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S10b: master data (16 categories) and the organization profile. Admin and Super Admin write
 * (`admin.manage-master-data`), every internal role reads, portals cannot.
 */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let keySeq = 0
const call = (method: string, path: string, who: string, body?: unknown, key = true) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key && method === 'POST' ? { 'idempotency-key': `md-test-${++keySeq}-key` } : {} })
type Rec = { id: string; category: string; isActive: boolean; data: Record<string, unknown> }

describe('reading', () => {
  test('internal roles read master data; portals 403; anonymous 401', async () => {
    const res = await call('GET', '/master-data', 'finance')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.json.data)).toBe(true)
    expect((await call('GET', '/master-data', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/master-data')).status).toBe(401)
    expect((await call('GET', '/organization-profile', 'client')).status).toBe(403)
  })
})

describe('creating', () => {
  test('Admin adds an airport; the code is upper-cased; finance 403; Idempotency-Key required', async () => {
    const res = await call('POST', '/master-data/airport', 'admin', { iataCode: 'kno', name: 'Kualanamu International Airport', city: 'Medan' })
    expect(res.status).toBe(201)
    const rec = res.json.data as Rec
    expect(rec).toMatchObject({ category: 'airport', isActive: true, data: { iataCode: 'KNO', name: 'Kualanamu International Airport', city: 'Medan' } })
    expect(rec.id).toMatch(/^APT-\d+$/)
    expect((await call('GET', '/master-data', 'finance')).json.data.some((r: Rec) => r.id === rec.id)).toBe(true)
    expect((await call('POST', '/master-data/airport', 'finance', { iataCode: 'UPG', name: 'Sultan Hasanuddin', city: 'Makassar' })).status).toBe(403)
    expect((await call('POST', '/master-data/airport', 'admin', { iataCode: 'UPG', name: 'Sultan Hasanuddin', city: 'Makassar' }, false)).status).toBe(400)
    const [audit] = await t.db.query<{ actor_user_id: string }>("select actor_user_id from audit_events where action = 'master_data.created' and entity_id = $1", [rec.id])
    expect(audit!.actor_user_id).toBe('USR-002')
  })

  test('fields are validated per category: required, unknown, type, range and unique code', async () => {
    const post = (category: string, body: unknown) => call('POST', `/master-data/${category}`, 'admin', body)
    expect((await post('airport', { iataCode: 'BTH', city: 'Batam' })).status).toBe(400) // name missing
    expect((await post('airport', { iataCode: 'BTH', name: 'Hang Nadim', city: 'Batam', note: 'x' })).status).toBe(400) // unknown field
    expect((await post('airport', { iataCode: 'BATAM', name: 'Hang Nadim', city: 'Batam' })).status).toBe(400) // not 3 letters
    expect((await post('airport', { iataCode: 'KNO', name: 'Lagi', city: 'Medan' })).status).toBe(422) // code taken
    expect((await post('tax-rule', { name: 'PPN', ratePercent: 150, appliesTo: 'Semua' })).status).toBe(400)
    expect((await post('payment-term', { label: 'Net 1,5', daysDue: 1.5 })).status).toBe(400)
    expect((await post('hotel', { name: 'Hotel A', city: 'Medan', starRating: 6 })).status).toBe(400)
    expect((await post('hotel', { name: 'Hotel A', city: 'Medan', starRating: '4' })).status).toBe(400)
    expect((await post('unknown-category', { label: 'X' })).status).toBe(404)
    const ok = await post('hotel', { name: 'Hotel A', city: 'Medan' }) // star rating is optional
    expect(ok.status).toBe(201)
    expect((ok.json.data as Rec).data).toEqual({ name: 'Hotel A', city: 'Medan' })
    const dest = await post('destination', { label: 'Medan, Indonesia', description: '  ' }) // blank optional text is dropped
    expect((dest.json.data as Rec).data).toEqual({ label: 'Medan, Indonesia' })
  })

  test('a milestone template needs items; the server numbers them', async () => {
    const post = (body: unknown) => call('POST', '/master-data/milestone-template', 'admin', body)
    expect((await post({ label: 'Kosong', items: [] })).status).toBe(400)
    expect((await post({ label: 'Jauh', items: [{ label: 'A', offsetDays: 400 }] })).status).toBe(400)
    expect((await post({ label: 'Tanpa label', items: [{ label: ' ', offsetDays: 1 }] })).status).toBe(400)
    const res = await post({ label: 'Leisure Trip', items: [{ id: 'TPLITEM-1', label: 'Booking', offsetDays: 0 }, { label: 'Berangkat', offsetDays: -2 }] })
    expect(res.status).toBe(201)
    const rec = res.json.data as Rec
    expect(rec.data.items).toEqual([{ id: `${rec.id}-1`, label: 'Booking', offsetDays: 0 }, { id: `${rec.id}-2`, label: 'Berangkat', offsetDays: -2 }])
  })
})

describe('changing', () => {
  test('a partial update keeps the other fields and still validates the whole record', async () => {
    const created = (await call('POST', '/master-data/airline', 'admin', { iataCode: 'id', name: 'Batik Air' })).json.data as Rec
    const res = await call('PATCH', `/master-data/airline/${created.id}`, 'admin', { name: 'Batik Air Indonesia' })
    expect(res.status).toBe(200)
    expect((res.json.data as Rec).data).toEqual({ iataCode: 'ID', name: 'Batik Air Indonesia' })
    expect((await call('PATCH', `/master-data/airline/${created.id}`, 'admin', { name: '' })).status).toBe(400)
    expect((await call('PATCH', `/master-data/airline/${created.id}`, 'admin', { isActive: false })).status).toBe(400) // status has its own endpoints
    expect((await call('PATCH', `/master-data/airport/${created.id}`, 'admin', { name: 'X' })).status).toBe(404) // wrong category
    expect((await call('PATCH', '/master-data/airline/ALN-999', 'admin', { name: 'X' })).status).toBe(404)
    expect((await call('PATCH', `/master-data/airline/${created.id}`, 'finance', { name: 'X' })).status).toBe(403)
    const [audit] = await t.db.query<{ before: { name: string }; after: { name: string } }>(
      "select before, after from audit_events where action = 'master_data.updated' and entity_id = $1", [created.id])
    expect([audit!.before.name, audit!.after.name]).toEqual(['Batik Air', 'Batik Air Indonesia'])
  })

  test('deactivate and reactivate; the same state twice is refused', async () => {
    const created = (await call('POST', '/master-data/payment-term', 'admin', { label: 'Net 45', daysDue: 45 })).json.data as Rec
    const off = await call('POST', `/master-data/payment-term/${created.id}/deactivate`, 'admin')
    expect(off.status).toBe(200)
    expect((off.json.data as Rec).isActive).toBe(false)
    expect((await call('POST', `/master-data/payment-term/${created.id}/deactivate`, 'admin')).status).toBe(422)
    expect(((await call('POST', `/master-data/payment-term/${created.id}/reactivate`, 'admin')).json.data as Rec).isActive).toBe(true)
    expect((await call('POST', `/master-data/payment-term/${created.id}/reactivate`, 'admin')).status).toBe(422)
    expect((await call('POST', `/master-data/payment-term/${created.id}/deactivate`, 'finance')).status).toBe(403)
  })
})

describe('organization profile', () => {
  const profile = {
    legalName: 'PT Manova Wisata Nusantara', displayName: 'MANOVA', address: 'Jl. Sudirman 1, Jakarta',
    defaultCurrencyCode: 'IDR', businessHours: 'Senin–Jumat', contactEmail: 'info@manova.id', contactPhone: '+62 21 1'
  }

  test('Admin saves the profile; currency must be an active one; finance reads but cannot write', async () => {
    const idr = await call('POST', '/master-data/currency', 'admin', { code: 'IDR', name: 'Rupiah', symbol: 'Rp' })
    expect([201, 422]).toContain(idr.status) // the seed may already hold IDR
    expect((await call('PUT', '/organization-profile', 'finance', profile)).status).toBe(403)
    expect((await call('PUT', '/organization-profile', 'admin', { ...profile, contactEmail: 'bukan-email' })).status).toBe(400)
    expect((await call('PUT', '/organization-profile', 'admin', { ...profile, legalName: ' ' })).status).toBe(400)
    expect((await call('PUT', '/organization-profile', 'admin', { ...profile, extra: 1 })).status).toBe(400)
    expect((await call('PUT', '/organization-profile', 'admin', { ...profile, defaultCurrencyCode: 'XYZ' })).status).toBe(422)
    const res = await call('PUT', '/organization-profile', 'admin', profile)
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ id: 'ORG-001', displayName: 'MANOVA', updatedBy: 'USR-002' })
    expect((await call('GET', '/organization-profile', 'finance')).json.data).toMatchObject({ displayName: 'MANOVA' })
    expect((await t.db.query("select 1 from audit_events where action = 'organization.updated'")).length).toBeGreaterThan(0)
  })

  test('the currency the profile uses cannot be deactivated', async () => {
    const [cur] = await t.db.query<{ id: string }>("select id from master_data_records where category = 'currency' and data->>'code' = 'IDR'")
    expect((await call('POST', `/master-data/currency/${cur!.id}/deactivate`, 'admin')).status).toBe(422)
  })
})
