import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12b-2: the client answers a quotation it was sent — accepted / rejected / revision requested, once per version. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown) => t.call(method, `/api/v1${path}`, { cookie: c[who], body })
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
type ClientQuotation = { id: string; version: number; clientResponse: { response: string; note: string | null; version: number; respondedAt: string } | null }

/** A quotation of the client party, approved and sent, on a lead that is not a project yet. */
async function sentQuotation(): Promise<{ id: string; leadId: string; staff: string }> {
  const [q] = await t.db.query<{ id: string; lead_id: string }>(
    `select q.id, q.lead_id from quotations q where not exists (select 1 from projects p where p.lead_id = q.lead_id)
       and q.client_response is null order by q.id limit 1`)
  await t.db.query("update leads set party_id = 'PTY-005' where id = $1", [q!.lead_id])
  await t.db.query("update quotations set sent_to_client_on = '2026-10-01' where id = $1", [q!.id])
  await t.db.query("update quotation_versions v set status = 'approved' from quotations q where q.id = v.quotation_id and q.id = $1 and v.version = q.current_version", [q!.id])
  const [lead] = await t.db.query<{ owner_user_id: string; handed_over_to: string | null }>('select owner_user_id, handed_over_to from leads where id = $1', [q!.lead_id])
  return { id: q!.id, leadId: q!.lead_id, staff: lead!.handed_over_to ?? lead!.owner_user_id }
}
const clientView = async (id: string) => ((await call('GET', '/client/quotations', 'client')).json.data as ClientQuotation[]).find(x => x.id === id)!

describe('client quotation response', () => {
  test('accept once per version: stored, shown to the client and staff, staff told, party note written', async () => {
    const q = await sentQuotation()
    const n0 = await notes(q.staff)
    const notesBefore = Number((await t.db.query<{ n: string }>("select count(*)::text as n from party_activities where party_id = 'PTY-005'"))[0]!.n)
    const res = await call('POST', `/client/quotations/${q.id}/respond`, 'client', { response: 'accepted' })
    expect(res.status, JSON.stringify(res.json)).toBe(200)
    const mine = await clientView(q.id)
    expect(mine.clientResponse).toMatchObject({ response: 'accepted', version: mine.version })
    const internal = (await call('GET', `/quotations/${q.id}`, 'admin')).json.data as { clientResponse: { response: string } | null }
    expect(internal.clientResponse?.response).toBe('accepted')
    expect(await notes(q.staff)).toBe(n0 + 1)
    expect(Number((await t.db.query<{ n: string }>("select count(*)::text as n from party_activities where party_id = 'PTY-005'"))[0]!.n)).toBe(notesBefore + 1)
    expect((await call('POST', `/client/quotations/${q.id}/respond`, 'client', { response: 'rejected', note: 'Berubah pikiran' })).status).toBe(422)
  })

  test('reject and revision need a note; a new version sent later can be answered again', async () => {
    const q = await sentQuotation()
    expect((await call('POST', `/client/quotations/${q.id}/respond`, 'client', { response: 'revision-requested' })).status).toBe(400)
    expect((await call('POST', `/client/quotations/${q.id}/respond`, 'client', { response: 'maybe' })).status).toBe(400)
    expect((await call('POST', `/client/quotations/${q.id}/respond`, 'client', { response: 'revision-requested', note: 'Mohon kurangi 1 malam' })).status).toBe(200)
    // Staff revise; the new version is approved and sent again.
    await t.db.query("update quotations set current_version = current_version + 1, sent_to_client_on = '2026-10-05' where id = $1", [q.id])
    await t.db.query(
      `insert into quotation_versions (quotation_id, version, amount_minor, currency, service_breakdown, status, created_by)
       select quotation_id, version + 1, amount_minor, currency, service_breakdown, 'approved', created_by from quotation_versions
        where quotation_id = $1 and version = (select current_version - 1 from quotations where id = $1)`, [q.id])
    expect((await clientView(q.id)).clientResponse).toBeNull()
    expect((await call('POST', `/client/quotations/${q.id}/respond`, 'client', { response: 'accepted' })).status).toBe(200)
  })

  test('not sent, already a project or another party: refused; staff roles cannot answer for the client', async () => {
    const [unsent] = await t.db.query<{ id: string; lead_id: string }>("select q.id, q.lead_id from quotations q where q.sent_to_client_on is null and q.client_response is null order by q.id limit 1")
    if (unsent) {
      await t.db.query("update leads set party_id = 'PTY-005' where id = $1", [unsent.lead_id])
      expect((await call('POST', `/client/quotations/${unsent.id}/respond`, 'client', { response: 'accepted' })).status).toBe(404)
    }
    const [won] = await t.db.query<{ id: string; lead_id: string }>('select q.id, q.lead_id from quotations q join projects p on p.lead_id = q.lead_id order by q.id limit 1')
    await t.db.query("update leads set party_id = 'PTY-005' where id = $1", [won!.lead_id])
    await t.db.query("update quotations set sent_to_client_on = '2026-10-01' where id = $1", [won!.id])
    expect((await call('POST', `/client/quotations/${won!.id}/respond`, 'client', { response: 'accepted' })).status).toBe(422)
    const [foreign] = await t.db.query<{ id: string }>("select q.id from quotations q join leads l on l.id = q.lead_id where l.party_id is distinct from 'PTY-005' order by q.id limit 1")
    if (foreign) expect((await call('POST', `/client/quotations/${foreign.id}/respond`, 'client', { response: 'accepted' })).status).toBe(404)
    expect((await call('POST', `/client/quotations/${won!.id}/respond`, 'admin', { response: 'accepted' })).status).toBe(403)
  })
})
