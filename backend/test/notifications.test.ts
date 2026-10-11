import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S9b: notifications created by the server inside the action, read per user. admin = USR-002, adminMgmt = USR-003, finance = USR-008. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s9b-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })
type N = { id: string; userId: string; type: string; title: string; entityId: string | null; read: boolean }
const mine = async (who: string) => (await call('GET', '/notifications', who)).json.data as N[]

describe('notifications', () => {
  test('a mention notifies the mentioned user, never the sender; a portal user cannot be mentioned', async () => {
    const before = (await mine('adminMgmt')).length
    const m = (await call('POST', '/messages', 'admin', { entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', channel: 'internal-note', body: 'Tolong cek, @Sari', mentions: ['USR-003', 'USR-002'] }, key())).json.data as { id: string }
    const list = await mine('adminMgmt')
    expect(list.length).toBe(before + 1)
    expect(list[0]).toMatchObject({ userId: 'USR-003', type: 'mention', read: false, entityId: 'PRJ-103' })
    expect((await mine('admin')).some(x => x.type === 'mention' && x.title.includes(m.id))).toBe(false)
    expect((await call('POST', '/messages', 'admin', { entityType: 'project', entityId: 'PRJ-103', channel: 'internal-note', body: 'X', mentions: ['USR-021'] }, key())).status).toBe(400)
  })

  test('assigning a task (on create and when the assignee changes) notifies the assignee, not the actor', async () => {
    const before = (await mine('finance')).length
    const task = (await call('POST', '/tasks', 'admin', { projectId: 'PRJ-103', title: 'Rekap DP peserta', assignedTo: 'USR-008' }, key())).json.data as { id: string }
    expect((await mine('finance')).length).toBe(before + 1)
    expect((await mine('finance'))[0]).toMatchObject({ type: 'assignment', entityId: 'PRJ-103' })
    await call('PATCH', `/tasks/${task.id}`, 'admin', { title: 'Rekap DP peserta (rev)' })
    expect((await mine('finance')).length).toBe(before + 1) // same assignee: no new notification
    const selfBefore = (await mine('admin')).length
    await call('PATCH', `/tasks/${task.id}`, 'admin', { assignedTo: 'USR-002' })
    expect((await mine('admin')).length).toBe(selfBefore) // the actor assigned themself
    await call('PATCH', `/tasks/${task.id}`, 'admin', { assignedTo: 'USR-003' })
    expect((await mine('adminMgmt'))[0]).toMatchObject({ type: 'assignment' })
  })

  test('escalating an incident notifies the user it goes to', async () => {
    const inc = (await call('POST', '/projects/PRJ-103/incidents', 'admin', { title: 'Bus mogok', description: 'Unit B mogok', severity: 'high', ownerId: 'USR-002' }, key())).json.data.id as string
    await call('POST', `/incidents/${inc}/escalate`, 'admin', { to: 'USR-003', note: 'Perlu keputusan' })
    expect((await mine('adminMgmt'))[0]).toMatchObject({ type: 'escalation', entityId: inc })
  })

  test('read, read-all and delete only touch your own notifications; anonymous 401', async () => {
    const own = (await mine('adminMgmt'))[0]!
    expect(((await call('POST', `/notifications/${own.id}/read`, 'adminMgmt')).json.data as N).read).toBe(true)
    expect((await call('POST', `/notifications/${own.id}/read`, 'finance')).status).toBe(404)
    expect((await call('DELETE', `/notifications/${own.id}`, 'finance')).status).toBe(404)
    await call('POST', '/notifications/read-all', 'adminMgmt')
    expect((await mine('adminMgmt')).every(x => x.read)).toBe(true)
    expect((await call('DELETE', `/notifications/${own.id}`, 'adminMgmt')).status).toBe(200)
    expect((await mine('adminMgmt')).some(x => x.id === own.id)).toBe(false)
    expect((await t.call('GET', '/api/v1/notifications')).status).toBe(401)
  })
})
