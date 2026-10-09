import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
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

describe('milestones', () => {
  const today = todayBusinessDate()
  type M = { id: string; name: string; plannedDate: string; status: string; actualDate: string | null; note: string | null; deliverables: { id: string; label: string; done: boolean }[] }

  test('internal roles read; create is idempotent and validated; finance cannot write', async () => {
    expect((await call('GET', '/milestones?projectId=PRJ-104', 'finance')).status).toBe(200)
    expect((await call('GET', '/milestones', 'client')).status).toBe(403)
    const k = key()
    const body = { name: 'Briefing Tim', plannedDate: '2026-11-01', ownerId: 'USR-002', budgetMinor: '1500000', note: 'Ruang rapat' }
    const res = await call('POST', '/projects/PRJ-104/milestones', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-104', name: 'Briefing Tim', status: 'not-started', budgetMinor: '1500000', actualDate: null, deliverables: [] })
    expect((await call('POST', '/projects/PRJ-104/milestones', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    const bad = async (b: unknown) => (await call('POST', '/projects/PRJ-104/milestones', 'admin', b, key())).status
    expect(await bad({ plannedDate: '2026-11-01' })).toBe(400)
    expect(await bad({ name: 'X' })).toBe(400)
    expect(await bad({ name: 'X', plannedDate: '2026-11-01', budgetMinor: '-1' })).toBe(400)
    expect(await bad({ name: 'X', plannedDate: '2026-11-01', ownerId: 'USR-999' })).toBe(400)
    expect((await call('POST', '/projects/PRJ-104/milestones', 'finance', body, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/milestones', 'admin', body, key())).status).toBe(404)
  })

  test('planned date is locked after Drafting; complete once; deliverables add, tick, remove', async () => {
    const draft = (await call('POST', '/projects/PRJ-104/milestones', 'admin', { name: 'Draft MS', plannedDate: '2026-11-02' }, key())).json.data.id as string
    expect((await call('PATCH', `/milestones/${draft}`, 'admin', { plannedDate: '2026-11-03', note: 'Catatan' })).json.data).toMatchObject({ plannedDate: '2026-11-03', note: 'Catatan' })
    expect((await call('PATCH', `/milestones/${draft}`, 'admin', { note: '' })).json.data.note).toBeNull()
    const confirmed = (await call('POST', '/projects/PRJ-101/milestones', 'admin', { name: 'Confirmed MS', plannedDate: '2026-08-01' }, key())).json.data.id as string
    expect((await call('PATCH', `/milestones/${confirmed}`, 'admin', { plannedDate: '2026-08-02' })).status).toBe(422)
    expect((await call('PATCH', `/milestones/${confirmed}`, 'admin', { name: 'Ganti Nama' })).status).toBe(200)
    expect((await call('POST', `/milestones/${confirmed}/complete`, 'admin')).json.data).toMatchObject({ status: 'completed', actualDate: today })
    expect((await call('POST', `/milestones/${confirmed}/complete`, 'admin')).status).toBe(422)
    const a = (await call('POST', `/milestones/${draft}/deliverables`, 'admin', { label: 'Daftar hadir' })).json.data as M
    expect(a.deliverables).toEqual([{ id: `PMD-${draft}-1`, label: 'Daftar hadir', done: false }])
    const b = (await call('POST', `/milestones/${draft}/deliverables`, 'admin', { label: 'Materi' })).json.data as M
    expect(b.deliverables.map(d => d.id)).toEqual([`PMD-${draft}-1`, `PMD-${draft}-2`])
    expect((await call('POST', `/milestones/${draft}/deliverables`, 'admin', { label: ' ' })).status).toBe(400)
    expect(((await call('PATCH', `/milestones/${draft}/deliverables/PMD-${draft}-1`, 'admin', { done: true })).json.data as M).deliverables[0]!.done).toBe(true)
    expect((await call('PATCH', `/milestones/${draft}/deliverables/PMD-${draft}-9`, 'admin', { done: true })).status).toBe(404)
    expect(((await call('DELETE', `/milestones/${draft}/deliverables/PMD-${draft}-1`, 'admin')).json.data as M).deliverables.map(d => d.id)).toEqual([`PMD-${draft}-2`])
    expect((await call('PATCH', '/milestones/PMS-99999', 'admin', { name: 'X' })).status).toBe(404)
  })

  test('replace swaps every milestone of the project atomically', async () => {
    const before = (await call('GET', '/milestones?projectId=PRJ-501', 'admin')).json.data as M[]
    expect((await call('POST', '/projects/PRJ-501/milestones/replace', 'admin', { milestones: [{ name: 'A', plannedDate: '2026-11-01' }, { name: '', plannedDate: '2026-11-02' }] })).status).toBe(400)
    expect(((await call('GET', '/milestones?projectId=PRJ-501', 'admin')).json.data as M[]).map(m => m.id)).toEqual(before.map(m => m.id))
    expect((await call('POST', '/projects/PRJ-501/milestones/replace', 'admin', { milestones: [] })).status).toBe(400)
    const res = await call('POST', '/projects/PRJ-501/milestones/replace', 'admin', { milestones: [{ name: 'Kickoff', plannedDate: '2026-11-01', stepKey: 'drafting' }, { name: 'Selesai', plannedDate: '2026-11-20' }] })
    expect(res.status).toBe(200)
    expect((res.json.data as M[]).map(m => m.name)).toEqual(['Kickoff', 'Selesai'])
    expect(((await call('GET', '/milestones?projectId=PRJ-501', 'admin')).json.data as M[]).map(m => m.name)).toEqual(['Kickoff', 'Selesai'])
  })

  test('a new project gets the eight default milestones, none planned in the past', async () => {
    const project = (await call('POST', '/projects', 'admin', {
      name: 'Trip Milestone S7c', isGroupTrip: true, destination: 'Bromo', travelStartDate: today, travelEndDate: today,
      serviceScope: ['transportation'], travelerCount: 2, contractValueMinor: '0'
    }, key())).json.data.id as string
    const list = (await call('GET', `/milestones?projectId=${project}`, 'admin')).json.data as M[]
    expect(list).toHaveLength(8)
    expect(list.every(m => m.plannedDate >= today && m.status === 'not-started')).toBe(true)
    expect(list.map(m => m.name)).toContain('Keberangkatan')
  })
})
