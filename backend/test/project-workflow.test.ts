import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const newProject = async (over: Record<string, unknown> = {}) => (await t.call('POST', '/api/v1/projects', {
  cookie: c.admin, headers: { 'idempotency-key': `wf-key-${++n}-abcdef` },
  body: { name: `Alur ${n}`, partyId: 'PTY-002', destination: 'Bali', travelStartDate: '2027-06-01', travelEndDate: '2027-06-04', serviceScope: ['hotel'], travelerCount: 4, contractValueMinor: '100000000', ...over }
})).json.data.id as string
const act = (who: string, path: string, body: unknown = {}, method = 'POST') => t.call(method, `/api/v1/projects/${path}`, { cookie: c[who], body })

describe('handover and transitions', () => {
  test('planning needs an accepted handover; transitions follow the map; audit keeps before/after', async () => {
    const id = await newProject()
    const early = await act('admin', `${id}/transition`, { to: 'planning' })
    expect(early.status).toBe(422)
    expect((await act('admin', `${id}/handover/accept`)).json.data.handoverAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((await act('admin', `${id}/handover/accept`)).status).toBe(422)
    expect((await act('admin', `${id}/transition`, { to: 'planning' })).json.data.status).toBe('planning')
    expect((await act('admin', `${id}/transition`, { to: 'completed' })).status).toBe(422)
    expect((await act('admin', `${id}/transition`, { to: 'on-hold' })).status).toBe(400)
    expect((await act('admin', `${id}/transition`, { to: 'on-hold', reason: 'Klien menunda' })).json.data.status).toBe('on-hold')
    const [audit] = await t.db.query<{ before: { status: string }; after: { status: string }; reason: string }>(
      "select before, after, reason from audit_events where action = 'project.status_changed' and entity_id = $1 order by id desc limit 1", [id]
    )
    expect(audit).toMatchObject({ before: { status: 'planning' }, after: { status: 'on-hold' }, reason: 'Klien menunda' })
  })

  test('return handover needs a reason; finance cannot advance; cancellation capability is separate', async () => {
    const id = await newProject()
    expect((await act('admin', `${id}/handover/return`, {})).status).toBe(400)
    expect((await act('admin', `${id}/handover/return`, { reason: 'Data quotation kurang' })).json.data.handoverReturnReason).toBe('Data quotation kurang')
    expect((await act('finance', `${id}/handover/accept`)).status).toBe(403)
    expect((await act('finance', `${id}/transition`, { to: 'planning' })).status).toBe(403)
    expect((await act('finance', `${id}/transition`, { to: 'cancelled', reason: 'Dibatalkan klien' })).json.data.status).toBe('cancelled')
    expect((await act('admin', 'PRJ-999/transition', { to: 'planning' })).status).toBe(404)
  })
})

describe('ready, finance close and close', () => {
  test('ready needs the DP invoiced and paid; finance close needs no blockers; close needs completed + note', async () => {
    const id = await newProject({ contractValueMinor: '50000000' })
    await act('admin', `${id}/handover/accept`)
    await act('admin', `${id}/transition`, { to: 'planning' })
    await act('admin', `${id}/transition`, { to: 'confirmed' })
    expect((await act('admin', `${id}/ready`)).status).toBe(422)

    const accounts = (await t.call('GET', '/api/v1/finance/accounts', { cookie: c.finance })).json.data
    let accountId = accounts[0]?.id as string | undefined
    if (!accountId) {
      accountId = (await t.call('POST', '/api/v1/finance/accounts', { cookie: c.finance, body: { code: 'BCA-WF', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '1234567890' } })).json.data.id
      await t.call('POST', `/api/v1/finance/accounts/${accountId}/opening`, { cookie: c.finance, body: { amountMinor: '1000000000', openingDate: '2026-01-01' } })
      await t.call('POST', `/api/v1/finance/accounts/${accountId}/opening/verify`, { cookie: c.superAdmin, body: { balanceMinor: '1000000000', openingDate: '2026-01-01' } })
    }
    const dp = (await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId: id, invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '20000000' }], dueDate: '2027-05-01' } })).json.data
    await t.call('POST', `/api/v1/finance/customer-invoices/${dp.id}/issue`, { cookie: c.finance, body: {} })
    expect((await act('admin', `${id}/ready`)).status).toBe(422)
    await t.call('POST', '/api/v1/finance/receipts', {
      cookie: c.finance, headers: { 'idempotency-key': `wf-rcpt-${id}-abcdef` },
      body: { bankAccountId: accountId, amountMinor: '20000000', effectiveDate: '2026-02-01', partyId: 'PTY-002', projectId: id, allocations: [{ invoiceId: dp.id, amountMinor: '20000000' }] }
    })
    expect((await act('admin', `${id}/ready`)).json.data.readyAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await act('admin', `${id}/transition`, { to: 'in-progress' })
    await act('admin', `${id}/transition`, { to: 'completed' })
    const blocked = await act('admin', `${id}/finance-close`)
    expect(blocked.status).toBe(422)
    expect(blocked.json.error.message).toContain('belum seluruhnya ditagih')
    expect((await act('admin', `${id}/close`, { finalNote: 'Selesai' })).status).toBe(422)

    const fin = (await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId: id, invoiceType: 'final', lines: [{ description: 'Pelunasan', amountMinor: '30000000' }], dueDate: '2027-05-20' } })).json.data
    await t.call('POST', `/api/v1/finance/customer-invoices/${fin.id}/issue`, { cookie: c.finance, body: {} })
    await t.call('POST', '/api/v1/finance/receipts', {
      cookie: c.finance, headers: { 'idempotency-key': `wf-rcpt2-${id}-abcdef` },
      body: { bankAccountId: accountId, amountMinor: '30000000', effectiveDate: '2026-02-02', partyId: 'PTY-002', projectId: id, allocations: [{ invoiceId: fin.id, amountMinor: '30000000' }] }
    })
    expect((await act('admin', `${id}/finance-close`)).json.data.financeSettledAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((await act('admin', `${id}/close`, {})).status).toBe(400)
    const closed = await act('admin', `${id}/close`, { finalNote: 'Trip lancar', clientFeedback: 'Puas' })
    expect(closed.json.data).toMatchObject({ closedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), finalNote: 'Trip lancar', clientFeedback: 'Puas' })
    expect((await act('admin', `${id}/close`, { finalNote: 'Lagi' })).status).toBe(422)
  }, 30_000)
})

describe('team', () => {
  test('add and remove members; the owner stays; unknown user 400', async () => {
    const id = await newProject()
    const added = await act('admin', `${id}/members/USR-003`, {}, 'PUT')
    expect(added.json.data.teamUserIds).toContain('USR-003')
    expect((await act('admin', `${id}/members/USR-003`, {}, 'DELETE')).json.data.teamUserIds).not.toContain('USR-003')
    const owner = added.json.data.ownerUserId as string
    expect((await act('admin', `${id}/members/${owner}`, {}, 'DELETE')).status).toBe(422)
    expect((await act('admin', `${id}/members/USR-999`, {}, 'PUT')).status).toBe(400)
    expect((await act('finance', `${id}/members/USR-003`, {}, 'PUT')).status).toBe(403)
  })
})
