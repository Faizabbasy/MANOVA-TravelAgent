import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12d: the vendor portal (USR-015, VND-006) — service order status and the vendor's own products. */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': key } : {} })
const k = () => `vendor-key-${++n}-${Date.now()}`
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)

describe('vendor service order status', () => {
  test('own order: sent → acknowledged → fulfilled; project log and owner told', async () => {
    const so = (await t.db.query<{ id: string; project_id: string }>("select id, project_id from service_orders where vendor_id = 'VND-006' and project_id is not null order by id limit 1"))[0]!
    await t.db.query("update service_orders set status = 'sent' where id = $1", [so.id])
    const owner = (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [so.project_id]))[0]!.owner_user_id
    const n0 = await notes(owner)
    const ack = await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'acknowledged' })
    expect(ack.status, JSON.stringify(ack.json)).toBe(200)
    expect(ack.json.data.status).toBe('acknowledged')
    const done = await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'fulfilled' })
    expect(done.json.data.status).toBe('fulfilled')
    expect(await notes(owner)).toBe(n0 + 2)
    const log = await t.db.query("select 1 from project_activities where source_action = 'service_order.status_changed' and source_entity_id = $1", [so.id])
    expect(log.length).toBe(2)
    expect((await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'acknowledged' })).status).toBe(422)
  })

  test('cancel or re-send is staff only; another vendor’s order is not found; a client gets 404', async () => {
    const so = (await t.db.query<{ id: string }>("select id from service_orders where vendor_id = 'VND-006' order by id desc limit 1"))[0]!
    await t.db.query("update service_orders set status = 'sent' where id = $1", [so.id])
    expect((await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'cancelled', reason: 'Tidak sanggup' })).status).toBe(403)
    expect((await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'sent' })).status).toBe(403)
    expect((await t.db.query<{ status: string }>('select status from service_orders where id = $1', [so.id]))[0]!.status).toBe('sent')
    const foreign = (await t.db.query<{ id: string }>("select id from service_orders where vendor_id <> 'VND-006' order by id limit 1"))[0]!
    expect((await call('POST', `/service-orders/${foreign.id}/status`, 'vendor', { to: 'acknowledged' })).status).toBe(404)
    expect((await call('POST', `/service-orders/${so.id}/status`, 'client', { to: 'acknowledged' })).status).toBe(404)
  })
})
