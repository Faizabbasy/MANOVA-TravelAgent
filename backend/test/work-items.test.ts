import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S7c: project tasks and milestones through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s7c-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('tasks', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    await call('POST', '/tasks', 'admin', { projectId: 'PRJ-103', title: 'Baca saya' }, key())
    const res = await call('GET', '/tasks?projectId=PRJ-103', 'finance')
    expect(res.status).toBe(200)
    expect((res.json.data as { projectId: string }[]).every(x => x.projectId === 'PRJ-103')).toBe(true)
    expect((res.json.data as unknown[]).length).toBeGreaterThan(0)
    expect((await call('GET', '/tasks', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/tasks')).status).toBe(401)
  })

  test('create is idempotent and validated; a task may have no project; finance cannot write', async () => {
    const k = key()
    const body = { projectId: 'PRJ-103', title: 'Siapkan name tag', dueAt: '2026-08-05', assignedTo: 'USR-002' }
    const res = await call('POST', '/tasks', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', title: 'Siapkan name tag', status: 'not-started', dueAt: '2026-08-05', assignedTo: 'USR-002', isBlocked: false, blockedReason: null, isMilestone: false })
    expect((await call('POST', '/tasks', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    expect((await call('POST', '/tasks', 'admin', { title: 'Tugas umum' }, key())).json.data.projectId).toBeNull()
    const other = (await call('POST', '/tasks', 'admin', { projectId: 'PRJ-101', title: 'Task project lain' }, key())).json.data.id as string
    const bad = async (b: unknown) => (await call('POST', '/tasks', 'admin', b, key())).status
    expect(await bad({ title: ' ' })).toBe(400)
    expect(await bad({ title: 'X', status: 'archived' })).toBe(400)
    expect(await bad({ title: 'X', dueAt: '05-08-2026' })).toBe(400)
    expect(await bad({ title: 'X', projectId: 'PRJ-999' })).toBe(400)
    expect(await bad({ title: 'X', assignedTo: 'USR-999' })).toBe(400)
    expect(await bad({ projectId: 'PRJ-103', title: 'X', dependsOnTaskId: other })).toBe(400) // other project's task
    expect((await call('POST', '/tasks', 'finance', body, key())).status).toBe(403)
  })

  test('patch changes status and assignee, null clears; block needs a reason and toggles once', async () => {
    const id = (await call('POST', '/tasks', 'admin', { projectId: 'PRJ-103', title: 'Konfirmasi bus', assignedTo: 'USR-002', dueAt: '2026-08-06' }, key())).json.data.id as string
    expect((await call('PATCH', `/tasks/${id}`, 'admin', { status: 'in-progress', assignedTo: null, dueAt: null })).json.data)
      .toMatchObject({ status: 'in-progress', assignedTo: null, dueAt: null })
    expect((await call('PATCH', `/tasks/${id}`, 'admin', { projectId: 'PRJ-101' })).status).toBe(400)
    expect((await call('PATCH', `/tasks/${id}`, 'admin', { dependsOnTaskId: id })).status).toBe(400)
    expect((await call('PATCH', `/tasks/${id}`, 'admin', { isBlocked: true })).status).toBe(400)
    expect((await call('POST', `/tasks/${id}/unblock`, 'admin')).status).toBe(422)
    expect((await call('POST', `/tasks/${id}/block`, 'admin', { reason: ' ' })).status).toBe(400)
    expect((await call('POST', `/tasks/${id}/block`, 'admin', { reason: 'Menunggu vendor' })).json.data).toMatchObject({ isBlocked: true, blockedReason: 'Menunggu vendor' })
    expect((await call('POST', `/tasks/${id}/block`, 'admin', { reason: 'Lagi' })).status).toBe(422)
    expect((await call('POST', `/tasks/${id}/unblock`, 'admin')).json.data).toMatchObject({ isBlocked: false, blockedReason: null })
    expect((await call('PATCH', `/tasks/${id}`, 'finance', { title: 'X' })).status).toBe(403)
    expect((await call('PATCH', '/tasks/TSK-99999', 'admin', { title: 'X' })).status).toBe(404)
  })
})
