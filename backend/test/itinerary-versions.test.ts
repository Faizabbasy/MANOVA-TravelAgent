import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12c-4: itinerary versions the client approves, and trip announcements the client confirms. Client USR-021 (PTY-005). */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: { 'idempotency-key': `itv-${++n}-${Date.now()}` } })
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const owner = async (projectId: string) => (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [projectId]))[0]!.owner_user_id
const foreignProject = async () => (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
type Version = { id: string; versionNumber: number; status: string; items: Record<string, unknown>[]; revisionComment: string | null }

describe('itinerary versions', () => {
  test('staff publish a snapshot of the client-visible items (no vendor data); a new one supersedes the old; the client is told', async () => {
    expect((await call('POST', '/projects/PRJ-201/itinerary-items', 'admin', { date: '2026-10-13', title: 'City tour Seoul', visibleToClient: true })).status).toBe(201)
    await t.db.query("update itinerary_items set vendor_id = (select id from vendors order by id limit 1), vendor_amount_minor = 5000000 where title = 'City tour Seoul'")
    await call('POST', '/projects/PRJ-201/itinerary-items', 'admin', { date: '2026-10-13', title: 'Briefing internal vendor', visibleToClient: false })
    const before = await notes('USR-021')
    const first = await call('POST', '/projects/PRJ-201/itinerary-versions', 'admin', { note: 'Draft awal' })
    expect(first.status, JSON.stringify(first.json)).toBe(201)
    const v1 = first.json.data as Version
    expect(v1).toMatchObject({ status: 'waiting-approval', versionNumber: 1 })
    expect(v1.items.some(i => i.title === 'City tour Seoul')).toBe(true)
    expect(v1.items.some(i => i.title === 'Briefing internal vendor')).toBe(false)
    expect(JSON.stringify(v1.items)).not.toContain('vendor')
    expect(await notes('USR-021')).toBe(before + 1)

    const v2 = (await call('POST', '/projects/PRJ-201/itinerary-versions', 'admin', {})).json.data as Version
    expect(v2.versionNumber).toBe(2)
    const list = (await call('GET', '/client/itinerary-versions', 'client')).json.data as (Version & { projectId: string })[]
    expect(list.find(v => v.id === v1.id)?.status).toBe('superseded')
    expect(list.find(v => v.id === v2.id)?.status).toBe('waiting-approval')
  })

  test('the client approves the waiting version or asks a revision (comment); the owner is told; decided once', async () => {
    const v = (await call('POST', '/projects/PRJ-201/itinerary-versions', 'admin', {})).json.data as Version
    expect((await call('POST', `/client/itinerary-versions/${v.id}/request-revision`, 'client', {})).status).toBe(400)
    const ownerId = await owner('PRJ-201')
    const before = await notes(ownerId)
    const revised = await call('POST', `/client/itinerary-versions/${v.id}/request-revision`, 'client', { comment: 'Tambah free time hari 2' })
    expect(revised.json.data).toMatchObject({ status: 'revision-requested', revisionComment: 'Tambah free time hari 2' })
    expect(await notes(ownerId)).toBe(before + 1)
    expect((await call('POST', `/client/itinerary-versions/${v.id}/approve`, 'client', {})).status).toBe(422)
    const next = (await call('POST', '/projects/PRJ-201/itinerary-versions', 'admin', {})).json.data as Version
    expect((await call('POST', `/client/itinerary-versions/${next.id}/approve`, 'client', {})).json.data.status).toBe('approved')
  })

  test('nothing visible → 422; other parties 404; roles', async () => {
    const foreign = await foreignProject()
    await t.db.query('update itinerary_items set visible_to_client = false where project_id = $1', [foreign])
    expect((await call('POST', `/projects/${foreign}/itinerary-versions`, 'admin', {})).status).toBe(422)
    await t.db.query('update itinerary_items set visible_to_client = true where project_id = $1', [foreign])
    await call('POST', `/projects/${foreign}/itinerary-items`, 'admin', { date: '2026-11-01', title: 'Hari 1', visibleToClient: true })
    const other = (await call('POST', `/projects/${foreign}/itinerary-versions`, 'admin', {})).json.data as Version
    expect((await call('POST', `/client/itinerary-versions/${other.id}/approve`, 'client', {})).status).toBe(404)
    expect(((await call('GET', '/client/itinerary-versions', 'client')).json.data as Version[]).some(v => v.id === other.id)).toBe(false)
    expect((await call('POST', '/projects/PRJ-201/itinerary-versions', 'finance', {})).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-201/itinerary-versions', 'client', {})).status).toBe(403)
    expect(((await call('GET', `/itinerary-versions?projectId=${foreign}`, 'admin')).json.data as Version[]).some(v => v.id === other.id)).toBe(true)
  })
})

describe('trip announcements', () => {
  test('staff publish; the client lists them, confirms once (idempotent); staff see who confirmed', async () => {
    const before = await notes('USR-021')
    const res = await call('POST', '/projects/PRJ-202/announcements', 'admin', { title: 'Titik kumpul pindah', message: 'Ballroom A', requiresConfirmation: true })
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(await notes('USR-021')).toBe(before + 1)
    const id = res.json.data.id as string
    const mine = ((await call('GET', '/client/announcements', 'client')).json.data as { id: string; confirmedByMe: boolean }[]).find(a => a.id === id)!
    expect(mine.confirmedByMe).toBe(false)
    expect((await call('POST', `/client/announcements/${id}/confirm`, 'client')).json.data.confirmedByMe).toBe(true)
    expect((await call('POST', `/client/announcements/${id}/confirm`, 'client')).status).toBe(200)
    const staff = ((await call('GET', '/announcements?projectId=PRJ-202', 'admin')).json.data as { id: string; confirmations: { userId: string }[] }[]).find(a => a.id === id)!
    expect(staff.confirmations.map(x => x.userId)).toEqual(['USR-021'])
  })

  test('info-only cannot be confirmed; validation; other parties; roles', async () => {
    const info = (await call('POST', '/projects/PRJ-201/announcements', 'admin', { title: 'Reminder paspor', message: 'H-30', requiresConfirmation: false })).json.data.id as string
    expect((await call('POST', `/client/announcements/${info}/confirm`, 'client')).status).toBe(422)
    expect((await call('POST', '/projects/PRJ-201/announcements', 'admin', { title: ' ', message: 'x' })).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-201/announcements', 'finance', { title: 'x', message: 'x' })).status).toBe(403)
    const other = (await call('POST', `/projects/${await foreignProject()}/announcements`, 'admin', { title: 'Lain', message: 'x', requiresConfirmation: true })).json.data.id as string
    expect((await call('POST', `/client/announcements/${other}/confirm`, 'client')).status).toBe(404)
    expect(((await call('GET', '/client/announcements', 'client')).json.data as { id: string }[]).some(a => a.id === other)).toBe(false)
  })
})
