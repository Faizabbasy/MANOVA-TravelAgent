import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S11a: assets, maintenance and checkouts. Admin and Super Admin write (`inventory.manage-asset`), internal roles read. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let keySeq = 0
const call = (method: string, path: string, who: string, body?: unknown, key = true) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key && method === 'POST' ? { 'idempotency-key': `inv-test-${++keySeq}-key` } : {} })
type Asset = { id: string; code: string; status: string; condition: string; category: string; purchasePriceMinor: string | null; quantity: number }
type Checkout = { id: string; assetId: string; projectId: string | null; borrowedBy: string; status: string; returnedOn: string | null; conditionOnReturn: string | null }
type Maint = { id: string; assetId: string; status: string; completedOn: string | null; costMinor: string | null }

const today = new Date().toISOString().slice(0, 10)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const newAsset = async (over: Record<string, unknown> = {}) => (await call('POST', '/assets', 'admin', {
  name: 'Kamera Uji', category: 'camera', purchasedOn: '2026-01-10', location: 'Gudang Jakarta', quantity: 1, condition: 'good', ...over
})).json.data as Asset

describe('reading', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    for (const path of ['/assets', '/asset-maintenance', '/asset-checkouts']) {
      expect((await call('GET', path, 'finance')).status).toBe(200)
      expect((await call('GET', path, 'client')).status).toBe(403)
      expect((await t.call('GET', `/api/v1${path}`)).status).toBe(401)
    }
  })
})

describe('assets', () => {
  test('Admin adds an asset with a code per category; finance 403; validation; Idempotency-Key required', async () => {
    const res = await call('POST', '/assets', 'admin', { name: 'Lensa 50mm', category: 'camera', purchasedOn: '2026-02-01', location: 'Gudang Jakarta', quantity: 1, condition: 'excellent', purchasePriceMinor: '8500000' })
    expect(res.status).toBe(201)
    const a = res.json.data as Asset
    expect(a).toMatchObject({ status: 'available', category: 'camera', purchasePriceMinor: '8500000' })
    expect(a.id).toMatch(/^AST-\d+$/)
    expect(a.code).toMatch(/^CAM-\d+$/)
    const it = await newAsset({ category: 'it', name: 'Laptop' })
    expect(it.code).toMatch(/^IT-\d+$/)
    expect((await call('POST', '/assets', 'finance', { name: 'X', category: 'camera', purchasedOn: '2026-02-01', location: 'G', quantity: 1, condition: 'good' })).status).toBe(403)
    expect((await call('POST', '/assets', 'admin', { name: 'X', category: 'camera', purchasedOn: '2026-02-01', location: 'G', quantity: 1, condition: 'good' }, false)).status).toBe(400)
    expect((await call('POST', '/assets', 'admin', { name: ' ', category: 'camera', purchasedOn: '2026-02-01', location: 'G', quantity: 1, condition: 'good' })).status).toBe(400)
    expect((await call('POST', '/assets', 'admin', { name: 'X', category: 'boat', purchasedOn: '2026-02-01', location: 'G', quantity: 1, condition: 'good' })).status).toBe(400)
    expect((await call('POST', '/assets', 'admin', { name: 'X', category: 'camera', purchasedOn: '2026-02-01', location: 'G', quantity: 0, condition: 'good' })).status).toBe(400)
    expect((await call('POST', '/assets', 'admin', { name: 'X', category: 'camera', purchasedOn: '2026-02-01', location: 'G', quantity: 1, condition: 'good', purchasePriceMinor: 8500000 })).status).toBe(400)
    expect((await call('POST', '/assets', 'admin', { name: 'X', category: 'camera', purchasedOn: '2026-02-01', location: 'G', quantity: 1, condition: 'good', status: 'in-use' })).status).toBe(400)
    const [audit] = await t.db.query<{ actor_user_id: string }>("select actor_user_id from audit_events where action = 'asset.created' and entity_id = $1", [a.id])
    expect(audit!.actor_user_id).toBe('USR-002')
  })

  test('an update changes fields; status only to available/maintenance/retired; never while lent out; category is fixed', async () => {
    const a = await newAsset()
    const res = await call('PATCH', `/assets/${a.id}`, 'admin', { location: 'Gudang Surabaya', status: 'maintenance', note: 'Cek sensor' })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ location: 'Gudang Surabaya', status: 'maintenance' })
    expect((await call('PATCH', `/assets/${a.id}`, 'admin', { status: 'in-use' })).status).toBe(400)
    expect((await call('PATCH', `/assets/${a.id}`, 'admin', { category: 'it' })).status).toBe(400)
    expect((await call('PATCH', `/assets/${a.id}`, 'finance', { location: 'X' })).status).toBe(403)
    expect((await call('PATCH', '/assets/AST-999', 'admin', { location: 'X' })).status).toBe(404)
    await call('PATCH', `/assets/${a.id}`, 'admin', { status: 'available' })
    await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, dueOn: inDays(5) })
    expect((await call('PATCH', `/assets/${a.id}`, 'admin', { status: 'retired' })).status).toBe(422)
    expect((await call('PATCH', `/assets/${a.id}`, 'admin', { location: 'Lapangan' })).json.data.status).toBe('in-use')
  })
})

describe('checkouts', () => {
  test('lend an available asset to a project; it becomes in-use; a second checkout is refused; return sets the condition', async () => {
    const a = await newAsset()
    expect((await call('POST', '/asset-checkouts', 'finance', { assetId: a.id, dueOn: inDays(3) })).status).toBe(403)
    expect((await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, dueOn: inDays(-1) })).status).toBe(400) // due in the past
    expect((await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, projectId: 'PRJ-999', dueOn: inDays(3) })).status).toBe(422)
    expect((await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, borrowedBy: 'USR-021', dueOn: inDays(3) })).status).toBe(422) // a portal user cannot borrow
    const res = await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, projectId: 'PRJ-101', dueOn: inDays(3), note: 'Untuk dokumentasi' })
    expect(res.status).toBe(201)
    const co = res.json.data as Checkout
    expect(co).toMatchObject({ assetId: a.id, projectId: 'PRJ-101', borrowedBy: 'USR-002', status: 'checked-out' })
    expect(co.id).toMatch(/^ACO-\d+$/)
    expect(((await call('GET', '/assets', 'admin')).json.data as Asset[]).find(x => x.id === a.id)!.status).toBe('in-use')
    expect((await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, dueOn: inDays(3) })).status).toBe(422)

    expect((await call('POST', `/asset-checkouts/${co.id}/return`, 'admin', {})).status).toBe(400) // condition required
    const back = await call('POST', `/asset-checkouts/${co.id}/return`, 'admin', { condition: 'damaged' })
    expect(back.status).toBe(200)
    expect(back.json.data).toMatchObject({ status: 'returned', returnedOn: today, conditionOnReturn: 'damaged' })
    expect(((await call('GET', '/assets', 'admin')).json.data as Asset[]).find(x => x.id === a.id)).toMatchObject({ status: 'maintenance', condition: 'damaged' })
    expect((await call('POST', `/asset-checkouts/${co.id}/return`, 'admin', { condition: 'good' })).status).toBe(422)
  })

  test('a retired or maintenance asset cannot be lent; an overdue checkout is reported as overdue', async () => {
    const a = await newAsset()
    await call('PATCH', `/assets/${a.id}`, 'admin', { status: 'retired' })
    expect((await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, dueOn: inDays(3) })).status).toBe(422)
    const b = await newAsset()
    const co = (await call('POST', '/asset-checkouts', 'admin', { assetId: b.id, dueOn: inDays(1) })).json.data as Checkout
    await t.db.query("update asset_checkouts set checked_out_on = current_date - 10, due_on = current_date - 2 where id = $1", [co.id])
    expect(((await call('GET', '/asset-checkouts', 'admin')).json.data as Checkout[]).find(x => x.id === co.id)!.status).toBe('overdue')
  })

  test('a project cannot be closed while assets lent to it are out', async () => {
    const a = await newAsset({ name: 'Proyektor Uji' })
    const project = (await t.call('POST', '/api/v1/projects', {
      cookie: c.admin, headers: { 'idempotency-key': 'inv-close-project-key' },
      body: { name: 'Tutup Uji', partyId: 'PTY-002', destination: 'Bali', travelStartDate: '2027-06-01', travelEndDate: '2027-06-04', serviceScope: ['hotel'], travelerCount: 2, contractValueMinor: '10000000' }
    })).json.data.id as string
    const co = (await call('POST', '/asset-checkouts', 'admin', { assetId: a.id, projectId: project, dueOn: inDays(3) })).json.data as Checkout
    await t.db.query("update projects set status = 'completed', finance_settled_at = now() where id = $1", [project])
    const blocked = await t.call('POST', `/api/v1/projects/${project}/close`, { cookie: c.admin, body: { finalNote: 'Selesai' } })
    expect(blocked.status).toBe(422)
    expect(blocked.json.error.message).toContain('Proyektor Uji')
    await call('POST', `/asset-checkouts/${co.id}/return`, 'admin', { condition: 'good' })
    const next = await t.call('POST', `/api/v1/projects/${project}/close`, { cookie: c.admin, body: { finalNote: 'Selesai' } })
    expect(next.json.error?.message ?? '').not.toContain('aset')
  })
})

describe('maintenance', () => {
  test('schedule and complete; the asset in maintenance becomes available; overdue is derived', async () => {
    const a = await newAsset()
    await call('PATCH', `/assets/${a.id}`, 'admin', { status: 'maintenance', condition: 'needs-service' })
    expect((await call('POST', '/asset-maintenance', 'finance', { assetId: a.id, type: 'repair', scheduledOn: inDays(2) })).status).toBe(403)
    expect((await call('POST', '/asset-maintenance', 'admin', { assetId: a.id, type: 'polish', scheduledOn: inDays(2) })).status).toBe(400)
    expect((await call('POST', '/asset-maintenance', 'admin', { assetId: 'AST-999', type: 'repair', scheduledOn: inDays(2) })).status).toBe(422)
    const res = await call('POST', '/asset-maintenance', 'admin', { assetId: a.id, type: 'repair', scheduledOn: inDays(2), vendorName: 'Service Center', costMinor: '750000', intervalDays: 90 })
    expect(res.status).toBe(201)
    const m = res.json.data as Maint
    expect(m).toMatchObject({ status: 'scheduled', costMinor: '750000' })
    expect(m.id).toMatch(/^MNT-\d+$/)
    const done = await call('POST', `/asset-maintenance/${m.id}/complete`, 'admin')
    expect(done.json.data).toMatchObject({ status: 'completed', completedOn: today })
    expect(((await call('GET', '/assets', 'admin')).json.data as Asset[]).find(x => x.id === a.id)).toMatchObject({ status: 'available', condition: 'good' })
    expect((await call('POST', `/asset-maintenance/${m.id}/complete`, 'admin')).status).toBe(422)

    const late = (await call('POST', '/asset-maintenance', 'admin', { assetId: a.id, type: 'inspection', scheduledOn: inDays(1) })).json.data as Maint
    await t.db.query('update asset_maintenance set scheduled_on = current_date - 3 where id = $1', [late.id])
    expect(((await call('GET', '/asset-maintenance', 'admin')).json.data as Maint[]).find(x => x.id === late.id)!.status).toBe('overdue')
  })
})
