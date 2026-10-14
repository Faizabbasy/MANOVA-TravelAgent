import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S9: document metadata and messages through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s9-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('documents', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    expect((await call('GET', '/documents?projectId=PRJ-101', 'finance')).status).toBe(200)
    expect((await call('GET', '/documents', 'vendor')).status).toBe(403) // S12a: clients read their own (client-portal.test.ts); vendors stay refused
    expect((await t.call('GET', '/api/v1/documents')).status).toBe(401)
  })

  test('upload metadata (idempotent, validated); the uploader is the signed-in user; finance cannot upload', async () => {
    const k = key()
    const body = { entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', name: 'Rooming list.xlsx', category: 'Rooming', accessLevel: 'internal', expiresOn: '2026-12-31', uploadedBy: 'USR-999' }
    const res = await call('POST', '/documents', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', name: 'Rooming list.xlsx', version: 1, sourceType: 'uploaded', accessLevel: 'internal', expiresAt: '2026-12-31' })
    expect(res.json.data.id).toMatch(/^DOC-\d+$/)
    expect(res.json.data.uploadedBy).not.toBe('USR-999')
    expect((await call('POST', '/documents', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    const bad = async (b: unknown) => (await call('POST', '/documents', 'admin', b, key())).status
    expect(await bad({ ...body, name: ' ' })).toBe(400)
    expect(await bad({ ...body, accessLevel: 'public' })).toBe(400)
    expect(await bad({ ...body, entityType: 'spaceship' })).toBe(400)
    expect(await bad({ ...body, projectId: 'PRJ-999' })).toBe(400)
    expect(await bad({ ...body, expiresOn: '31-12-2026' })).toBe(400)
    expect((await call('POST', '/documents', 'finance', body, key())).status).toBe(403)
    expect(((await call('GET', '/documents?projectId=PRJ-103', 'admin')).json.data as { id: string }[]).some(d => d.id === res.json.data.id)).toBe(true)
  })
})

describe('messages', () => {
  type M = { id: string; senderId: string; channel: string; deliveryStatus: string; deliveryChannel: string | null; mentions: string[]; readBy: string[] }

  test('any internal role sends; the sender is the signed-in user; status follows the channel; portals 403', async () => {
    const k = key()
    const body = { entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', channel: 'internal-note', body: 'Cek ulang rooming @Budi', mentions: ['USR-002'], senderId: 'USR-999' }
    const res = await call('POST', '/messages', 'finance', body, k)
    expect(res.status).toBe(201)
    const m = res.json.data as M
    expect(m).toMatchObject({ channel: 'internal-note', deliveryStatus: 'sent', deliveryChannel: null, mentions: ['USR-002'] })
    expect(m.senderId).not.toBe('USR-999')
    expect(m.readBy).toEqual([m.senderId])
    expect((await call('POST', '/messages', 'finance', body, k)).json.data.id).toBe(m.id)
    const client = (await call('POST', '/messages', 'admin', { entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', channel: 'client-message', body: 'Jadwal final terlampir', attachmentName: 'jadwal.pdf' }, key())).json.data as M
    expect(client).toMatchObject({ deliveryStatus: 'delivered', deliveryChannel: 'email' })
    expect((await call('POST', '/messages', 'client', body, key())).status).toBe(403)
    expect((await call('GET', '/messages', 'vendor')).status).toBe(403) // S12a: clients read their own (client-portal.test.ts); vendors stay refused
    expect(((await call('GET', '/messages?projectId=PRJ-103', 'admin')).json.data as M[]).map(x => x.id)).toEqual(expect.arrayContaining([m.id, client.id]))
  })

  test('validation: channel, empty body, unknown mention, unknown project', async () => {
    const base = { entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', channel: 'internal-note', body: 'Halo' }
    const bad = async (b: unknown) => (await call('POST', '/messages', 'admin', b, key())).status
    expect(await bad({ ...base, channel: 'sms' })).toBe(400)
    expect(await bad({ ...base, body: ' ' })).toBe(400)
    expect(await bad({ ...base, mentions: ['USR-999'] })).toBe(400)
    expect(await bad({ ...base, projectId: 'PRJ-999' })).toBe(400)
    expect(await bad({ ...base, channel: 'client-message', deliveryChannel: 'fax' })).toBe(400)
  })

  test('a message to the client is written to the project activity log', async () => {
    const m = (await call('POST', '/messages', 'admin', { entityType: 'project', entityId: 'PRJ-101', projectId: 'PRJ-101', channel: 'client-message', body: 'Itinerary revisi dikirim' }, key())).json.data as M
    const log = (await call('GET', '/project-activities?projectId=PRJ-101', 'admin')).json.data as { sourceAction: string; message: string }[]
    expect(log.some(a => a.sourceAction === 'message.sent' && a.message.includes(m.id))).toBe(true)
  })
})
