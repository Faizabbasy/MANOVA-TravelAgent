import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S8: change requests, incidents and non-Finance cancellations through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s8-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })
type Activity = { id: string; approvalStatus: string | null; sourceAction: string | null; message: string }
const activities = async (projectId: string) => (await call('GET', `/project-activities?projectId=${projectId}`, 'admin')).json.data as Activity[]

describe('change requests', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    expect((await call('GET', '/change-requests?projectId=PRJ-103', 'finance')).status).toBe(200)
    expect((await call('GET', '/change-requests', 'vendor')).status).toBe(403) // S12a: clients read their own (client-portal.test.ts); vendors stay refused
    expect((await t.call('GET', '/api/v1/change-requests')).status).toBe(401)
  })

  test('create (idempotent) opens a pending change entry; review, approve and implement decide it once', async () => {
    const k = key()
    // S12b-2: a client request with a cost goes through the client — this internal one is approved directly.
    const body = { source: 'internal', category: 'itinerary', beforeSummary: 'City tour 1 hari', afterSummary: 'City tour 2 hari', operationalImpact: 'Bus +1 hari', commercialImpactMinor: '2500000', requestedBy: 'USR-999' }
    const res = await call('POST', '/projects/PRJ-103/change-requests', 'admin', body, k)
    expect(res.status).toBe(201)
    const cr = res.json.data as { id: string; status: string; activityId: string; requestedBy: string; commercialImpactMinor: string }
    expect(cr).toMatchObject({ status: 'submitted', commercialImpactMinor: '2500000' })
    expect(cr.requestedBy).not.toBe('USR-999')
    expect((await call('POST', '/projects/PRJ-103/change-requests', 'admin', body, k)).json.data.id).toBe(cr.id)
    const entry = (await activities('PRJ-103')).find(a => a.id === cr.activityId)!
    expect(entry.approvalStatus).toBe('pending')
    expect((await call('POST', `/change-requests/${cr.id}/implement`, 'admin')).status).toBe(422)
    expect((await call('POST', `/change-requests/${cr.id}/review`, 'finance')).status).toBe(403)
    expect(((await call('POST', `/change-requests/${cr.id}/review`, 'admin')).json.data).status).toBe('under-review')
    expect((await call('POST', `/change-requests/${cr.id}/review`, 'admin')).status).toBe(422)
    expect(((await call('POST', `/change-requests/${cr.id}/approve`, 'admin')).json.data).status).toBe('approved')
    expect((await activities('PRJ-103')).find(a => a.id === cr.activityId)!.approvalStatus).toBe('approved')
    expect(((await call('POST', `/change-requests/${cr.id}/implement`, 'admin')).json.data).status).toBe('implemented')
    expect((await call('POST', `/change-requests/${cr.id}/approve`, 'admin')).status).toBe(422)
  })

  test('validation, reject needs a reason and rejects the change entry; finance cannot create; unknown project 404', async () => {
    const bad = async (b: unknown) => (await call('POST', '/projects/PRJ-103/change-requests', 'admin', b, key())).status
    expect(await bad({ source: 'partner', beforeSummary: 'A', afterSummary: 'B' })).toBe(400)
    expect(await bad({ source: 'internal', beforeSummary: ' ', afterSummary: 'B' })).toBe(400)
    expect(await bad({ source: 'internal', beforeSummary: 'A', afterSummary: 'B', commercialImpactMinor: '-1' })).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/change-requests', 'finance', { source: 'internal', beforeSummary: 'A', afterSummary: 'B' }, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/change-requests', 'admin', { source: 'internal', beforeSummary: 'A', afterSummary: 'B' }, key())).status).toBe(404)
    const cr = (await call('POST', '/projects/PRJ-103/change-requests', 'admin', { source: 'internal', beforeSummary: 'Hotel A', afterSummary: 'Hotel B' }, key())).json.data as { id: string; activityId: string }
    expect((await call('POST', `/change-requests/${cr.id}/reject`, 'admin', { reason: ' ' })).status).toBe(400)
    expect(((await call('POST', `/change-requests/${cr.id}/reject`, 'admin', { reason: 'Hotel B penuh' })).json.data)).toMatchObject({ status: 'rejected', rejectionReason: 'Hotel B penuh' })
    expect((await activities('PRJ-103')).find(a => a.id === cr.activityId)!.approvalStatus).toBe('rejected')
    expect((await call('POST', '/change-requests/CR-99999/approve', 'admin')).status).toBe(404)
  })
})

describe('incidents', () => {
  type I = { id: string; status: string; escalatedTo: string | null; communicationLog: { from: string; message: string }[]; resolutionNote: string | null; resolvedAt: string | null }

  test('create (idempotent, validated); finance cannot create; portals 403', async () => {
    const k = key()
    const body = { title: 'Bus terlambat', description: 'Bus hari ke-2 telat 2 jam', severity: 'high', ownerId: 'USR-002' }
    const res = await call('POST', '/projects/PRJ-103/incidents', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', status: 'open', severity: 'high', ownerId: 'USR-002', communicationLog: [] })
    expect((await call('POST', '/projects/PRJ-103/incidents', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    const bad = async (b: unknown) => (await call('POST', '/projects/PRJ-103/incidents', 'admin', b, key())).status
    expect(await bad({ ...body, severity: 'urgent' })).toBe(400)
    expect(await bad({ ...body, title: ' ' })).toBe(400)
    expect(await bad({ ...body, ownerId: 'USR-999' })).toBe(400)
    expect(await bad({ ...body, bookingType: 'hotel', bookingId: 'HTL-1011' })).toBe(400) // another project's booking
    expect((await call('POST', '/projects/PRJ-103/incidents', 'finance', body, key())).status).toBe(403)
    expect((await call('GET', '/incidents', 'vendor')).status).toBe(403) // S12a: clients read their own (client-portal.test.ts); vendors stay refused
    expect((await call('GET', '/incidents?projectId=PRJ-103', 'finance')).status).toBe(200)
  })

  test('status moves along the map; escalate, communicate and resolve; each step is in the activity log', async () => {
    const id = (await call('POST', '/projects/PRJ-103/incidents', 'admin', { title: 'Hotel overbook', description: 'Kamar kurang 2', severity: 'critical', ownerId: 'USR-002' }, key())).json.data.id as string
    expect((await call('POST', `/incidents/${id}/status`, 'admin', { to: 'closed' })).status).toBe(422)
    expect((await call('POST', `/incidents/${id}/status`, 'admin', { to: 'resolved' })).status).toBe(400) // resolve has its own endpoint
    expect(((await call('POST', `/incidents/${id}/status`, 'admin', { to: 'investigating' })).json.data as I).status).toBe('investigating')
    expect((await call('POST', `/incidents/${id}/escalate`, 'admin', {})).status).toBe(400)
    const escalated = (await call('POST', `/incidents/${id}/escalate`, 'admin', { to: 'USR-003', note: 'Perlu keputusan manajemen' })).json.data as I
    expect(escalated).toMatchObject({ status: 'escalated', escalatedTo: 'USR-003' })
    expect(escalated.communicationLog.at(-1)!.message).toContain('Perlu keputusan manajemen')
    expect((await call('POST', `/incidents/${id}/communications`, 'admin', { message: ' ' })).status).toBe(400)
    expect(((await call('POST', `/incidents/${id}/communications`, 'admin', { message: 'Hotel konfirmasi kamar pengganti' })).json.data as I).communicationLog).toHaveLength(2)
    expect((await call('POST', `/incidents/${id}/resolve`, 'admin', { note: '' })).status).toBe(400)
    const resolved = (await call('POST', `/incidents/${id}/resolve`, 'admin', { note: 'Pindah ke hotel sebelah' })).json.data as I
    expect(resolved).toMatchObject({ status: 'resolved', resolutionNote: 'Pindah ke hotel sebelah' })
    expect(resolved.resolvedAt).toBeTruthy()
    expect((await call('POST', `/incidents/${id}/resolve`, 'admin', { note: 'Lagi' })).status).toBe(422)
    expect(((await call('POST', `/incidents/${id}/status`, 'admin', { to: 'closed' })).json.data as I).status).toBe('closed')
    const log = (await activities('PRJ-103')).filter(a => a.message.includes(id))
    expect(log.length).toBeGreaterThanOrEqual(4)
    expect((await call('POST', '/incidents/INC-99999/status', 'admin', { to: 'investigating' })).status).toBe(404)
  })
})

describe('a change request decides its own change entry', () => {
  test('the entry a change request opened cannot be approved, rejected or reviewed on its own', async () => {
    const cr = (await call('POST', '/projects/PRJ-101/change-requests', 'admin', { source: 'internal', beforeSummary: 'A', afterSummary: 'B' }, key())).json.data as { id: string; activityId: string }
    for (const action of ['approve', 'reject']) {
      const res = await call('POST', `/project-activities/${cr.activityId}/${action}`, 'admin')
      expect(res.status).toBe(422)
      expect(res.json.error.message).toContain(cr.id)
    }
    expect((await activities('PRJ-101')).find(a => a.id === cr.activityId)!.approvalStatus).toBe('pending')
  })
})

describe('no-show / refunded cancellations and workflow gates', () => {
  test('a no-show keeps its penalty as a cancellation record; penalty is refused on other statuses; no record for cancelled', async () => {
    const b = (await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-204', details: {} }, key())).json.data as { id: string }
    for (const to of ['quoted', 'assigned', 'confirmed']) await call('POST', `/bookings/transport/${b.id}/status`, 'admin', { to })
    expect((await call('POST', `/bookings/transport/${b.id}/status`, 'admin', { to: 'completed', penaltyMinor: '1000' })).status).toBe(400)
    expect((await call('POST', `/bookings/transport/${b.id}/status`, 'admin', { to: 'no-show', reason: 'X', refundEligible: 'ya' })).status).toBe(400)
    const res = await call('POST', `/bookings/transport/${b.id}/status`, 'admin', { to: 'no-show', reason: 'Tamu tidak datang', penaltyMinor: '750000', refundEligible: true })
    expect(res.status).toBe(200)
    const list = (await call('GET', '/booking-cancellations?projectId=PRJ-204', 'finance')).json.data as { bookingId: string; outcome: string; penaltyMinor: string | null; reason: string; refundEligible: boolean }[]
    expect(list.find(x => x.bookingId === b.id)).toMatchObject({ outcome: 'no-show', penaltyMinor: '750000', reason: 'Tamu tidak datang', refundEligible: true })
    const other = (await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-204', details: {} }, key())).json.data as { id: string }
    await call('POST', `/bookings/transport/${other.id}/status`, 'admin', { to: 'cancelled', reason: 'Tidak jadi' })
    expect(((await call('GET', '/booking-cancellations?projectId=PRJ-204', 'admin')).json.data as { bookingId: string }[]).some(x => x.bookingId === other.id)).toBe(false)
    expect((await call('GET', '/booking-cancellations', 'vendor')).status).toBe(403) // S12a: clients read their own (client-portal.test.ts); vendors stay refused
  })

  test('an open incident blocks departure (→ ongoing-trip, like the screen); a pending change request blocks completion', async () => {
    // PRJ-103 is in progress; departure is → ongoing-trip.
    const inc = (await call('POST', '/projects/PRJ-103/incidents', 'admin', { title: 'Visa telat', description: 'Visa 2 traveler belum keluar', severity: 'high', ownerId: 'USR-002' }, key())).json.data.id as string
    const blocked = await call('POST', '/projects/PRJ-103/transition', 'admin', { to: 'ongoing-trip' })
    expect(blocked.status).toBe(422)
    expect(blocked.json.error.message).toContain('insiden')
    expect(blocked.json.error.message).toContain(inc)
    const open = ((await call('GET', '/incidents?projectId=PRJ-103', 'admin')).json.data as { id: string; status: string }[]).filter(x => ['open', 'escalated'].includes(x.status))
    for (const o of open) await call('POST', `/incidents/${o.id}/resolve`, 'admin', { note: 'Selesai untuk tes' })
    expect((await call('POST', '/projects/PRJ-103/transition', 'admin', { to: 'ongoing-trip' })).status).toBe(200)

    const cr = (await call('POST', '/projects/PRJ-103/change-requests', 'admin', { source: 'internal', beforeSummary: 'A', afterSummary: 'B' }, key())).json.data.id as string
    const done = await call('POST', '/projects/PRJ-103/transition', 'admin', { to: 'completed' })
    expect(done.status).toBe(422)
    expect(done.json.error.message).toContain('change request')
    await call('POST', `/change-requests/${cr}/approve`, 'admin')
    const pending = ((await call('GET', '/change-requests?projectId=PRJ-103', 'admin')).json.data as { id: string; status: string }[]).filter(x => ['submitted', 'under-review'].includes(x.status))
    for (const p of pending) await call('POST', `/change-requests/${p.id}/reject`, 'admin', { reason: 'Tutup untuk tes' })
    expect((await call('POST', '/projects/PRJ-103/transition', 'admin', { to: 'completed' })).status).toBe(200)
  })
})
