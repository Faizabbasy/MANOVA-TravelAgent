import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12c-1: a client proposes changes to its registration / tax / billing data and name; Admin approves or rejects. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
  await t.db.query("update parties set account_owner_user_id = 'USR-002' where id = 'PTY-005'")
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown) => t.call(method, `/api/v1${path}`, { cookie: c[who], body })
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
type Change = { id: string; partyId: string; status: string; changes: Record<string, string>; rejectionReason: string | null }
const pending = async () => ((await call('GET', '/party-profile-changes?status=submitted', 'admin')).json.data as Change[]).find(x => x.partyId === 'PTY-005')

describe('client sensitive profile change', () => {
  test('submit: stored as waiting with only what differs; staff told; validated; one waiting per party', async () => {
    const n0 = await notes('USR-002')
    const res = await call('POST', '/client/profile/changes', 'client', { npwp: '01.234.567.8-901.234', billingName: 'PT Java Bhakti Persada Tbk', name: 'PT Java Bhakti Persada Tbk' })
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data.pendingChange.changes).toMatchObject({ npwp: '01.234.567.8-901.234', billingName: 'PT Java Bhakti Persada Tbk', name: 'PT Java Bhakti Persada Tbk' })
    expect((await call('GET', '/client/profile', 'client')).json.data.pendingChange.status).toBe('submitted')
    expect(await notes('USR-002')).toBe(n0 + 1)
    expect((await call('POST', '/client/profile/changes', 'client', { paymentTerm: 'Net 45' })).status).toBe(422)
    expect((await pending())!.changes.npwp).toBe('01.234.567.8-901.234')
  })

  test('approve applies it and tells the client; reject needs a reason and changes nothing; other roles refused', async () => {
    const change = (await pending())!
    expect((await call('GET', '/party-profile-changes?status=submitted', 'finance')).status).toBe(403)
    expect((await call('GET', '/party-profile-changes?status=submitted', 'client')).status).toBe(403)
    const n0 = await notes('USR-021')
    const ok = await call('POST', `/party-profile-changes/${change.id}/approve`, 'admin', {})
    expect(ok.status, JSON.stringify(ok.json)).toBe(200)
    const party = (await call('GET', '/client/profile', 'client')).json.data as { npwp: string; billingName: string; name: string; pendingChange: unknown }
    expect(party).toMatchObject({ npwp: '01.234.567.8-901.234', billingName: 'PT Java Bhakti Persada Tbk', name: 'PT Java Bhakti Persada Tbk', pendingChange: null })
    expect(await notes('USR-021')).toBe(n0 + 1)
    expect((await call('POST', `/party-profile-changes/${change.id}/approve`, 'admin', {})).status).toBe(422)

    expect((await call('POST', '/client/profile/changes', 'client', { paymentTerm: 'Net 60' })).status).toBe(201)
    const next = (await pending())!
    expect((await call('POST', `/party-profile-changes/${next.id}/reject`, 'admin', { reason: ' ' })).status).toBe(400)
    expect((await call('POST', `/party-profile-changes/${next.id}/reject`, 'admin', { reason: 'Mohon lampirkan surat persetujuan direksi' })).status).toBe(200)
    expect(((await call('GET', '/client/profile', 'client')).json.data as { paymentTerm: string | null }).paymentTerm).not.toBe('Net 60')
  })

  test('invalid NPWP, non-sensitive fields and no actual change are refused', async () => {
    expect((await call('POST', '/client/profile/changes', 'client', { npwp: '123' })).status).toBe(400)
    expect((await call('POST', '/client/profile/changes', 'client', { city: 'Bandung' })).status).toBe(400)
    const current = (await call('GET', '/client/profile', 'client')).json.data as { billingName: string }
    expect((await call('POST', '/client/profile/changes', 'client', { billingName: current.billingName })).status).toBe(400)
    expect((await call('POST', '/client/profile/changes', 'admin', { paymentTerm: 'Net 30' })).status).toBe(403)
  })
})
