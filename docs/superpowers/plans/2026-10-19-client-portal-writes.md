# Portal client — aksi tulis (S12b-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal client menulis peserta & kamar, dokumen & pesan, profil & kontak, dan sengketa invoice ke server lewat endpoint `/api/v1/client/*`, bukan lagi mutasi array lokal.

**Architecture:** Backend: modul `core/client-writes.ts` (cek kepemilikan party + batas status, whitelist field, log aktivitas & notifikasi) memanggil fungsi tulis internal yang ada; `core/client-write-routes.ts` memasang endpoint (hanya role client, party dari sesi). Frontend: `data/client-portal-writes.ts` memanggil endpoint lalu meng-upsert hasil ke array lokal dengan mapper yang ada; komponen portal memakai `createSaveGate` (server-first).

**Tech Stack:** Bun + Elysia + PGlite/PostgreSQL (backend, `bun test`), Nuxt 4 + Vue 3 + Vitest (frontend, pnpm).

**Spec:** `docs/superpowers/specs/2026-10-19-client-portal-writes-design.md`

## Global Constraints

- pnpm hanya di `frontend/`, bun hanya di `backend/`; tidak ada lockfile baru.
- Tanpa migrasi skema.
- Endpoint hanya role client: role lain 403, tanpa sesi 401; party dari sesi (`actor.partyId ?? '__no-party__'`), tidak pernah dari request.
- Milik party lain → 404 (tidak membocorkan keberadaan).
- Status project terkunci untuk peserta & kamar: `ongoing-trip`, `completed`, `cancelled` → 422 "Project sudah berjalan, selesai atau dibatalkan — ajukan perubahan peserta lewat change request."
- Field staf traveler (`isVip`, verifikasi dokumen, pembatalan, link order) ditolak 400; field profil sensitif (nama, NPWP, no. registrasi, nama & alamat billing, termin bayar, AE) ditolak 422 "Perubahan data registrasi/pajak/billing diajukan lewat verifikasi."
- Dokumen client selalu `access_level = 'client'`, `verified = false`.
- Pesan client: kanal `client-message`, tanpa mention.
- Notifikasi tidak pernah ke pengirimnya sendiri (`notify` sudah menjamin).
- Commit tiap task; jangan `git add docs` atau root — stage path eksplisit. Trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Tes backend: `bun test <file> --timeout 30000`; suite penuh ±15 menit (jalankan di background). Frontend: `pnpm exec vitest run <file>`, `pnpm test`, `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` (baseline 1983), eslint per file vs HEAD.

## Review Focus

1. Body dokumen/pesan yang menyebut `projectId`/`entityId` milik party lain → 404, bukan dokumen tersimpan di project orang lain (tes di Task 2).
2. Pengulangan create dengan `Idempotency-Key` yang sama → satu baris, tanpa notifikasi ganda (tes di Task 1).
3. Import ke project terkunci → 422 tanpa satu pun peserta dibuat (tes di Task 1).
4. Sengketa invoice yang sudah lunas → 422; invoice void/draft/party lain → 404 (tes di Task 3).
5. Project tanpa owner / party tanpa account owner → aksi tetap berhasil, tanpa notifikasi dan tanpa error FK (tes di Task 2).

---

### Task 1: Backend — fondasi client-writes + peserta & kamar

**Files:**
- Create: `backend/src/modules/core/client-writes.ts`
- Create: `backend/src/modules/core/client-write-routes.ts`
- Modify: `backend/src/app.ts` (import + `.use(clientWriteRoutes(deps, auth))` setelah `clientCommerceRoutes`)
- Test: `backend/test/client-portal-writes.test.ts`

**Interfaces:**
- Consumes: `createTraveler`, `updateTraveler`, `cancelTraveler`, `replaceTraveler`, `importTravelers`, `createRoom`, `setRoomTravelers`, `rule` dari `./travelers`; `recordProjectActivity`, `actorName` dari `./activities`; `notify` dari `./notifications`; `clientTraveler` dari `./client-scope`; `listTravelers`, `listRoomAssignments` dari `./travelers`.
- Produces (dipakai Task 2–3):
  - `LOCKED_PROJECT_STATUSES: string[]`, `LOCKED_MESSAGE: string`
  - `type OwnProject = { id: string; name: string; status: string; ownerUserId: string | null }`
  - `ownProject(tx: Queryable, partyId: string, projectId: unknown, opts?: { lockedTravelers?: boolean }): Promise<OwnProject>`
  - `notifyInternal(tx: Queryable, actor: Actor, userId: string | null, n: { type: string; title: string; body: string; entityType: string; entityId: string }): Promise<void>` — hanya bila user internal ada
  - `tellProject(tx, actor, project: OwnProject, a: { type: 'change' | 'document' | 'message'; title: string; message: string; sourceAction: string; sourceEntityId: string }): Promise<void>`
  - route helper `clientActor(request) → { actor, partyId }` di routes file
  - fungsi `clientCreateTraveler`, `clientUpdateTraveler`, `clientCancelTraveler`, `clientReplaceTraveler`, `clientImportTravelers`, `clientCreateRoom`, `clientSetRoomTravelers`

- [ ] **Step 1: Tulis tes yang gagal**

`backend/test/client-portal-writes.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12b-1: client portal writes through /client/* — participants & rooms, documents & messages, profile & contacts,
 * invoice disputes. Client USR-021, party PTY-005 (PRJ-201 planning = open, PRJ-202 ongoing-trip = locked).
 */

let t: TestApp
const c: Record<string, string> = {}
let other = ''
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
  other = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' and status not in ('ongoing-trip', 'completed', 'cancelled') order by id limit 1"))[0]!.id
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': key } : {} })
const k = () => `k-${++n}-${Date.now()}`
const owner = async (projectId: string) => (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [projectId]))[0]!.owner_user_id
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const activities = async (projectId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from project_activities where project_id = $1', [projectId]))[0]!.n)

describe('client participants', () => {
  test('add, edit, cancel, replace and import on an open project; staff is told; staff-only fields refused', async () => {
    const ownerId = await owner('PRJ-201')
    const [n0, a0] = [await notes(ownerId), await activities('PRJ-201')]
    const key = k()
    const created = await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Peserta Client', passportNumber: 'X1234567' }, key)
    expect(created.status, JSON.stringify(created.json)).toBe(201)
    const id = created.json.data.id as string
    expect(created.json.data.documentsVerifiedBy).toBeNull()
    // Same key again: the same traveler, no second notification.
    const replay = await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Peserta Client', passportNumber: 'X1234567' }, key)
    expect(replay.json.data.id).toBe(id)
    expect(await notes(ownerId)).toBe(n0 + 1)
    expect(await activities('PRJ-201')).toBe(a0 + 1)

    expect((await call('PATCH', `/client/travelers/${id}`, 'client', { dietaryRestrictions: 'Vegetarian' })).json.data.dietaryRestrictions).toBe('Vegetarian')
    expect((await call('PATCH', `/client/travelers/${id}`, 'client', { isVip: true })).status).toBe(400)
    expect((await call('POST', `/client/projects/PRJ-201/travelers`, 'client', { name: 'VIP', isVip: true }, k())).status).toBe(400)

    const replaced = await call('POST', `/client/travelers/${id}/replace`, 'client', { name: 'Pengganti Client' })
    expect(replaced.status, JSON.stringify(replaced.json)).toBe(200)
    const newId = replaced.json.data.id as string
    expect(newId).not.toBe(id)
    expect((await call('POST', `/client/travelers/${newId}/cancel`, 'client', { reason: 'Tidak jadi berangkat' })).json.data.cancelled).toBe(true)
    expect((await call('POST', `/client/travelers/${newId}/cancel`, 'client', {})).status).toBe(400)

    const imported = await call('POST', '/client/projects/PRJ-201/travelers/import', 'client', { rows: [{ name: 'Impor Satu' }, { name: '' }] }, k())
    expect(imported.status).toBe(201)
    expect(imported.json.data.created.length).toBe(1)
    expect(imported.json.data.rejected.length).toBe(1)
    expect(await notes(ownerId)).toBeGreaterThan(n0 + 1)
  })

  test('locked project (ongoing-trip) refuses every participant write, import creates nothing', async () => {
    const before = Number((await t.db.query<{ n: string }>("select count(*)::text as n from travelers where project_id = 'PRJ-202'"))[0]!.n)
    const add = await call('POST', '/client/projects/PRJ-202/travelers', 'client', { name: 'Telat' }, k())
    expect(add.status).toBe(422)
    expect(add.json.error.message).toContain('change request')
    expect((await call('POST', '/client/projects/PRJ-202/travelers/import', 'client', { rows: [{ name: 'Telat Impor' }] }, k())).status).toBe(422)
    const after = Number((await t.db.query<{ n: string }>("select count(*)::text as n from travelers where project_id = 'PRJ-202'"))[0]!.n)
    expect(after).toBe(before)
    const locked = (await t.db.query<{ id: string }>("select id from travelers where project_id = 'PRJ-202' and not cancelled order by id limit 1"))[0]
    if (locked) expect((await call('PATCH', `/client/travelers/${locked.id}`, 'client', { specialRequest: 'x' })).status).toBe(422)
  })

  test('another party’s project or traveler is not found; other roles are refused', async () => {
    expect((await call('POST', `/client/projects/${other}/travelers`, 'client', { name: 'Bukan Milik' }, k())).status).toBe(404)
    const foreign = (await t.db.query<{ id: string }>('select id from travelers where project_id = $1 order by id limit 1', [other]))[0]
    if (foreign) expect((await call('PATCH', `/client/travelers/${foreign.id}`, 'client', { specialRequest: 'x' })).status).toBe(404)
    for (const who of ['admin', 'finance', 'vendor']) expect((await call('POST', '/client/projects/PRJ-201/travelers', who, { name: 'X' }, k())).status, who).toBe(403)
    expect((await t.call('POST', '/api/v1/client/projects/PRJ-201/travelers', { body: { name: 'X' }, headers: { 'idempotency-key': k() } })).status).toBe(401)
  })

  test('rooms: create with members and set members, only travelers of the project', async () => {
    const group = (await t.db.query<{ id: string }>("select id from traveler_groups where project_id = 'PRJ-201' order by id limit 1"))[0]
      ?? (await t.db.query<{ id: string }>("insert into traveler_groups (id, project_id, name, pax_count) values ('GRP-T12B', 'PRJ-201', 'Grup Client', 2) returning id"))[0]!
    const a = (await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Kamar A' }, k())).json.data.id as string
    const b = (await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Kamar B' }, k())).json.data.id as string
    const room = await call('POST', '/client/projects/PRJ-201/room-assignments', 'client', { groupId: group.id, roomLabel: 'Kamar 101', roomType: 'twin', travelerIds: [a] }, k())
    expect(room.status, JSON.stringify(room.json)).toBe(201)
    const set = await call('PUT', `/client/room-assignments/${room.json.data.id}/travelers`, 'client', { travelerIds: [a, b] })
    expect(set.json.data.travelerIds).toEqual([a, b])
    const foreign = (await t.db.query<{ id: string }>('select id from travelers where project_id = $1 order by id limit 1', [other]))[0]
    if (foreign) expect((await call('PUT', `/client/room-assignments/${room.json.data.id}/travelers`, 'client', { travelerIds: [foreign.id] })).status).toBe(400)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && bun test test/client-portal-writes.test.ts --timeout 30000`
Expected: FAIL — 404 untuk semua route `/client/...` (route belum ada).

- [ ] **Step 3: Implementasi `client-writes.ts` (fondasi + peserta)**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { actorName, recordProjectActivity } from './activities'
import { notify } from './notifications'
import { cancelTraveler, createRoom, createTraveler, importTravelers, replaceTraveler, rule, setRoomTravelers, updateTraveler } from './travelers'

/**
 * Client portal writes (S12b-1). The party comes from the session; anything of another party is "not found". The
 * internal write functions do the work; this layer checks ownership, the participant status lock and the fields a
 * client may send, then logs the change on the project and tells the staff who own it.
 */

export const LOCKED_PROJECT_STATUSES = ['ongoing-trip', 'completed', 'cancelled']
export const LOCKED_MESSAGE = 'Project sudah berjalan, selesai atau dibatalkan — ajukan perubahan peserta lewat change request.'

export type OwnProject = { id: string; name: string; status: string; ownerUserId: string | null }

export async function ownProject(tx: Queryable, partyId: string, projectId: unknown, opts: { lockedTravelers?: boolean } = {}): Promise<OwnProject> {
  if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) throw errors.notFound('Project')
  const [p] = await tx.query<{ id: string; name: string; status: string; owner_user_id: string | null }>(
    'select id, name, status, owner_user_id from projects where id = $1 and party_id = $2', [projectId, partyId])
  if (!p) throw errors.notFound('Project')
  if (opts.lockedTravelers && LOCKED_PROJECT_STATUSES.includes(p.status)) throw rule(LOCKED_MESSAGE)
  return { id: p.id, name: p.name, status: p.status, ownerUserId: p.owner_user_id }
}

/** Notifies one internal user (owner, account owner, Finance); nobody when the user is missing or a portal user. */
export async function notifyInternal(tx: Queryable, actor: Actor, userId: string | null, n: { type: string; title: string; body: string; entityType: string; entityId: string }) {
  if (!userId) return
  const [u] = await tx.query("select 1 from users where id = $1 and role not in ('client', 'vendor') and status = 'active'", [userId])
  if (!u) return
  await notify(tx, { userId, actorUserId: actor.userId, ...n })
}

/** The project's activity log line plus a notification to the project owner. */
export async function tellProject(tx: Queryable, actor: Actor, project: OwnProject, a: { type: 'change' | 'document' | 'message'; title: string; message: string; sourceAction: string; sourceEntityId: string }) {
  await recordProjectActivity(tx, { projectId: project.id, actorUserId: actor.userId, sourceAction: a.sourceAction, sourceEntityId: a.sourceEntityId, message: a.message })
  await notifyInternal(tx, actor, project.ownerUserId, { type: a.type, title: a.title, body: a.message, entityType: 'project', entityId: project.id })
}

/* ---------- participants & rooms ---------- */

const STAFF_FIELDS = ['isVip', 'documentsVerified', 'documentsVerifiedOn', 'documentsVerifiedBy', 'cancelled', 'cancelReason', 'salesOrderId', 'leadId', 'partyId']

function refuseStaffFields(input: Record<string, unknown>) {
  const bad = Object.keys(input).filter(key => STAFF_FIELDS.includes(key))
  if (bad.length) throw errors.validation(Object.fromEntries(bad.map(key => [key, ['Hanya bisa diubah tim MANOVA.']])))
}

async function travelerOf(tx: Queryable, partyId: string, travelerId: string) {
  const [r] = await tx.query<{ project_id: string; name: string }>(
    'select t.project_id, t.name from travelers t join projects p on p.id = t.project_id where t.id = $1 and p.party_id = $2', [travelerId, partyId])
  if (!r) throw errors.notFound('Traveler')
  return { projectId: r.project_id, name: r.name }
}

const by = async (tx: Queryable, actor: Actor) => `client ${await actorName(tx, actor.userId)}`

export async function clientCreateTraveler(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  refuseStaffFields(input)
  const project = await ownProject(tx, partyId, projectId, { lockedTravelers: true })
  const { id } = await createTraveler(tx, actor, project.id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.created', sourceEntityId: id, title: `Peserta baru di ${project.name}`,
    message: `Peserta ${String(input.name).trim()} (${id}) ditambahkan oleh ${await by(tx, actor)}.` })
  return { id }
}

export async function clientUpdateTraveler(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  refuseStaffFields(input)
  const tr = await travelerOf(tx, partyId, id)
  const project = await ownProject(tx, partyId, tr.projectId, { lockedTravelers: true })
  await updateTraveler(tx, actor, id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.updated', sourceEntityId: id, title: `Data peserta diubah di ${project.name}`,
    message: `Data peserta ${tr.name} (${id}) diperbarui oleh ${await by(tx, actor)}.` })
}

export async function clientCancelTraveler(tx: Queryable, actor: Actor, partyId: string, id: string, reason: unknown, requestId: string) {
  const tr = await travelerOf(tx, partyId, id)
  const project = await ownProject(tx, partyId, tr.projectId, { lockedTravelers: true })
  await cancelTraveler(tx, actor, id, reason, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.cancelled', sourceEntityId: id, title: `Peserta dibatalkan di ${project.name}`,
    message: `Peserta ${tr.name} (${id}) dibatalkan oleh ${await by(tx, actor)}: ${String(reason).trim()}` })
}

export async function clientReplaceTraveler(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  refuseStaffFields(input)
  const tr = await travelerOf(tx, partyId, id)
  const project = await ownProject(tx, partyId, tr.projectId, { lockedTravelers: true })
  const { id: newId } = await replaceTraveler(tx, actor, id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.replaced', sourceEntityId: newId, title: `Peserta diganti di ${project.name}`,
    message: `Peserta ${tr.name} (${id}) digantikan oleh ${String(input.name).trim()} (${newId}) — ${await by(tx, actor)}.` })
  return { id: newId }
}

export async function clientImportTravelers(tx: Queryable, actor: Actor, partyId: string, projectId: string, rows: unknown, requestId: string) {
  const project = await ownProject(tx, partyId, projectId, { lockedTravelers: true })
  const result = await importTravelers(tx, actor, project.id, rows, requestId)
  if (result.created.length) {
    await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.imported', sourceEntityId: project.id, title: `Impor peserta di ${project.name}`,
      message: `${result.created.length} peserta diimpor oleh ${await by(tx, actor)}.` })
  }
  return result
}

export async function clientCreateRoom(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  const project = await ownProject(tx, partyId, projectId, { lockedTravelers: true })
  const { id } = await createRoom(tx, actor, project.id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'room.created', sourceEntityId: id, title: `Kamar baru di ${project.name}`,
    message: `Kamar ${String(input.roomLabel).trim()} (${id}) dibuat oleh ${await by(tx, actor)}.` })
  return { id }
}

export async function clientSetRoomTravelers(tx: Queryable, actor: Actor, partyId: string, roomId: string, travelerIds: unknown, requestId: string) {
  const [room] = await tx.query<{ project_id: string; room_label: string }>(
    'select r.project_id, r.room_label from room_assignments r join projects p on p.id = r.project_id where r.id = $1 and p.party_id = $2', [roomId, partyId])
  if (!room) throw errors.notFound('Kamar')
  const project = await ownProject(tx, partyId, room.project_id, { lockedTravelers: true })
  await setRoomTravelers(tx, actor, roomId, travelerIds, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'room.travelers_set', sourceEntityId: roomId, title: `Penghuni kamar diubah di ${project.name}`,
    message: `Penghuni kamar ${room.room_label} (${roomId}) diubah oleh ${await by(tx, actor)}.` })
}
```

- [ ] **Step 4: Implementasi `client-write-routes.ts` + daftarkan di `app.ts`**

```ts
import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { clientTraveler } from './client-scope'
import {
  clientCancelTraveler, clientCreateRoom, clientCreateTraveler, clientImportTravelers, clientReplaceTraveler, clientSetRoomTravelers, clientUpdateTraveler
} from './client-writes'
import { listRoomAssignments, listTravelers } from './travelers'

/** Client portal writes (S12b-1): only a client, only its own party (from the session). */
export function clientWriteRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const body = { body: t.Record(t.String(), t.Unknown()) }

  async function clientActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'client') throw errors.forbidden()
    return { actor, partyId: actor.partyId ?? '__no-party__' }
  }
  const travelerView = async (id: string) => clientTraveler((await listTravelers(db, { id }))[0]!)
  const roomView = async (id: string) => (await listRoomAssignments(db, { id }))[0]!

  return new Elysia({ prefix: '/api/v1/client' })
    .post('/projects/:id/travelers', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/travelers', key, body: { projectId, ...(body as object) } }, tx =>
        clientCreateTraveler(tx, actor, partyId, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await travelerView(result.data.id))
    }, body)
    .patch('/travelers/:id', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => clientUpdateTraveler(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerView(id))
    }, body)
    .post('/travelers/:id/cancel', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => clientCancelTraveler(tx, actor, partyId, id, (body as Record<string, unknown>).reason, requestIdOf(request)))
      return ok(request, await travelerView(id))
    }, body)
    .post('/travelers/:id/replace', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Traveler')
      const created = await db.transaction(tx => clientReplaceTraveler(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerView(created.id))
    }, body)
    .post('/projects/:id/travelers/import', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/travelers/import', key, body: { projectId, ...(body as object) } }, tx =>
        clientImportTravelers(tx, actor, partyId, projectId, (body as Record<string, unknown>).rows, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, result.data)
    }, body)
    .post('/projects/:id/room-assignments', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/room-assignments', key, body: { projectId, ...(body as object) } }, tx =>
        clientCreateRoom(tx, actor, partyId, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await roomView(result.data.id))
    }, body)
    .put('/room-assignments/:id/travelers', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Kamar')
      await db.transaction(tx => clientSetRoomTravelers(tx, actor, partyId, id, (body as Record<string, unknown>).travelerIds, requestIdOf(request)))
      return ok(request, await roomView(id))
    }, body)
}
```

`app.ts`: `import { clientWriteRoutes } from './modules/core/client-write-routes'` dan `.use(clientWriteRoutes(deps, auth))` tepat setelah `.use(clientCommerceRoutes(deps, auth))`.

Catatan: bila `withIdempotency` tidak menjalankan callback dalam transaksi, cek implementasi di `shared/idempotency.ts` dan sesuaikan (internal route memakai pola yang sama, jadi seharusnya sudah).

- [ ] **Step 5: Jalankan tes, pastikan lolos**

Run: `cd backend && bun test test/client-portal-writes.test.ts --timeout 30000`
Expected: PASS (4 tes).

- [ ] **Step 6: Typecheck + commit**

Run: `cd backend && bun run typecheck` — Expected: tanpa error.

```bash
git add backend/src/modules/core/client-writes.ts backend/src/modules/core/client-write-routes.ts backend/src/app.ts backend/test/client-portal-writes.test.ts
git commit -m "feat(core): portal client menambah/mengubah/membatalkan/mengganti/impor peserta & atur kamar — batas status, log & notifikasi owner (S12b-1)"
```

---

### Task 2: Backend — dokumen & pesan

**Files:**
- Modify: `backend/src/modules/core/client-writes.ts` (dokumen, ganti versi, pesan, tandai dibaca)
- Modify: `backend/src/modules/core/client-write-routes.ts`
- Modify: `backend/src/modules/core/documents.ts` (teks aktivitas pesan dari client)
- Test: `backend/test/client-portal-writes.test.ts`

**Interfaces:**
- Consumes: `ownProject`, `tellProject`, `notifyInternal` (Task 1); `createDocument`, `sendMessage`, `listDocuments`, `listMessages` dari `./documents`; `clientDocument`, `clientMessage` dari `./client-scope`.
- Produces: `clientCreateDocument(tx, actor, partyId, input): Promise<{ id }>`, `clientReplaceDocument(tx, actor, partyId, id, input, requestId): Promise<{ id }>`, `clientSendMessage(tx, actor, partyId, input, requestId): Promise<{ id }>`, `clientMarkMessagesRead(tx, actor, partyId, projectId): Promise<{ updated: number }>`; route `POST /client/documents`, `POST /client/documents/:id/replace`, `POST /client/messages`, `POST /client/projects/:id/messages/read`.

- [ ] **Step 1: Tulis tes yang gagal** (tambahkan ke file tes)

```ts
describe('client documents & messages', () => {
  test('upload to own project, traveler or company: always client-level and unverified; another party is not found', async () => {
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const res = await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: 'PRJ-201', name: 'Rundown Final', category: 'Rundown', accessLevel: 'internal' }, k())
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data).toMatchObject({ accessLevel: 'client', verified: false, projectId: 'PRJ-201', uploadedBy: null })
    expect(await notes(ownerId)).toBe(n0 + 1)
    const tr = (await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Dok Peserta' }, k())).json.data.id as string
    const trDoc = await call('POST', '/client/documents', 'client', { entityType: 'traveler', entityId: tr, name: 'Paspor', category: 'Paspor', projectId: other }, k())
    expect(trDoc.json.data.projectId).toBe('PRJ-201')
    const company = await call('POST', '/client/documents', 'client', { entityType: 'party', entityId: 'PTY-005', name: 'Akta', category: 'Legal' }, k())
    expect(company.status).toBe(201)
    expect(company.json.data.projectId).toBeNull()
    expect((await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: other, name: 'X', category: 'X' }, k())).status).toBe(404)
    expect((await call('POST', '/client/documents', 'client', { entityType: 'party', entityId: 'PTY-001', name: 'X', category: 'X' }, k())).status).toBe(404)
    expect((await call('POST', '/client/documents', 'client', { entityType: 'invoice', entityId: 'X', name: 'X', category: 'X' }, k())).status).toBe(400)
    expect((await call('POST', '/client/documents', 'admin', { entityType: 'project', entityId: 'PRJ-201', name: 'X', category: 'X' }, k())).status).toBe(403)
  })

  test('replace: new version supersedes the old; generated, superseded and foreign documents refused', async () => {
    const first = (await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: 'PRJ-201', name: 'Daftar Hadir', category: 'Lainnya' }, k())).json.data
    const v2 = await call('POST', `/client/documents/${first.id}/replace`, 'client', { name: 'Daftar Hadir v2' }, k())
    expect(v2.status, JSON.stringify(v2.json)).toBe(201)
    expect(v2.json.data).toMatchObject({ version: first.version + 1, supersedesId: first.id, name: 'Daftar Hadir v2', category: 'Lainnya', accessLevel: 'client' })
    expect((await call('POST', `/client/documents/${first.id}/replace`, 'client', {}, k())).status).toBe(422)
    const generated = (await t.db.query<{ id: string }>("select d.id from documents d join projects p on p.id = d.project_id where p.party_id = 'PTY-005' and d.access_level = 'client' and d.source_type = 'generated' limit 1"))[0]
    if (generated) expect((await call('POST', `/client/documents/${generated.id}/replace`, 'client', {}, k())).status).toBe(422)
    const foreign = (await t.db.query<{ id: string }>("select d.id from documents d join projects p on p.id = d.project_id where p.party_id <> 'PTY-005' limit 1"))[0]
    if (foreign) expect((await call('POST', `/client/documents/${foreign.id}/replace`, 'client', {}, k())).status).toBe(404)
  })

  test('messages: client-message only, no mentions, own project; read marks only that project’s client messages', async () => {
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const sent = await call('POST', '/client/messages', 'client', { projectId: 'PRJ-201', body: 'Mohon info jadwal check-in.', channel: 'internal-note' }, k())
    expect(sent.status, JSON.stringify(sent.json)).toBe(201)
    expect(sent.json.data).toMatchObject({ channel: 'client-message', projectId: 'PRJ-201', mentions: [], readBy: [] })
    expect(await notes(ownerId)).toBe(n0 + 1)
    const act = await t.db.query<{ message: string }>("select message from project_activities where source_action = 'message.sent' and source_entity_id = $1", [sent.json.data.id])
    expect(act[0]!.message).toContain('dari client')
    expect((await call('POST', '/client/messages', 'client', { projectId: 'PRJ-201', body: 'Halo', mentions: ['USR-002'] }, k())).status).toBe(400)
    expect((await call('POST', '/client/messages', 'client', { projectId: other, body: 'Halo' }, k())).status).toBe(404)

    await t.db.query("insert into messages (id, entity_type, entity_id, project_id, channel, sender_id, body, mentions, delivery_status, read_by) values ('MSG-T12B1', 'project', 'PRJ-201', 'PRJ-201', 'client-message', 'USR-002', 'Dari staf', '[]'::jsonb, 'delivered', '[\"USR-002\"]'::jsonb), ('MSG-T12B2', 'project', 'PRJ-201', 'PRJ-201', 'internal-note', 'USR-002', 'Internal', '[]'::jsonb, 'sent', '[\"USR-002\"]'::jsonb)")
    const read = await call('POST', '/client/projects/PRJ-201/messages/read', 'client', {})
    expect(read.status).toBe(200)
    expect(read.json.data.updated).toBeGreaterThan(0)
    const rows = await t.db.query<{ id: string; read_by: string[] }>("select id, read_by from messages where id in ('MSG-T12B1', 'MSG-T12B2') order by id")
    expect(rows[0]!.read_by).toContain('USR-021')
    expect(rows[1]!.read_by).not.toContain('USR-021')
    expect((await call('POST', '/client/projects/PRJ-201/messages/read', 'client', {})).json.data.updated).toBe(0)
  })

  test('a project without an owner: the write succeeds without a notification', async () => {
    await t.db.query("update projects set owner_user_id = null where id = 'PRJ-204'")
    const res = await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: 'PRJ-204', name: 'Tanpa Owner', category: 'Lainnya' }, k())
    expect(res.status, JSON.stringify(res.json)).toBe(201)
  })
})
```

Catatan untuk eksekutor: cek kolom `messages` (`delivery_status` dkk.) di migrasi 0032 sebelum menjalankan insert tes; sesuaikan daftar kolom bila ada kolom wajib lain.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && bun test test/client-portal-writes.test.ts --timeout 30000`
Expected: 4 tes baru FAIL (404 route), tes Task 1 tetap PASS.

- [ ] **Step 3: Implementasi di `client-writes.ts`**

Tambahkan import: `import { createDocument, listDocuments, sendMessage } from './documents'`, `import { rule } from './travelers'` (sudah), dan:

```ts
/* ---------- documents & messages ---------- */

const accountOwnerOf = async (tx: Queryable, partyId: string) =>
  (await tx.query<{ account_owner_user_id: string | null }>('select account_owner_user_id from parties where id = $1', [partyId]))[0]?.account_owner_user_id ?? null

/** Where a client document goes: its own project, a traveler of its projects, or its own company (party). */
async function documentTarget(tx: Queryable, partyId: string, input: Record<string, unknown>) {
  if (input.entityType === 'project') {
    const project = await ownProject(tx, partyId, input.entityId)
    return { entityType: 'project', entityId: project.id, project }
  }
  if (input.entityType === 'traveler') {
    if (typeof input.entityId !== 'string' || !ID_PATTERN.test(input.entityId)) throw errors.notFound('Traveler')
    const tr = await travelerOf(tx, partyId, input.entityId)
    return { entityType: 'traveler', entityId: input.entityId, project: await ownProject(tx, partyId, tr.projectId) }
  }
  if (input.entityType === 'party') {
    if (input.entityId !== partyId) throw errors.notFound('Customer')
    return { entityType: 'party', entityId: partyId, project: null }
  }
  throw errors.validation({ entityType: ['Dokumen client hanya untuk project, peserta, atau perusahaan.'] })
}

async function tellDocument(tx: Queryable, actor: Actor, partyId: string, project: OwnProject | null, id: string, name: string, verb: string) {
  const message = `Dokumen ${name} (${id}) ${verb} oleh ${await by(tx, actor)} — menunggu verifikasi.`
  if (project) await tellProject(tx, actor, project, { type: 'document', sourceAction: 'document.created', sourceEntityId: id, title: `Dokumen client di ${project.name}`, message })
  else await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'document', title: 'Dokumen perusahaan dari client', body: message, entityType: 'party', entityId: partyId })
}

export async function clientCreateDocument(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const target = await documentTarget(tx, partyId, input)
  const { id } = await createDocument(tx, actor, {
    entityType: target.entityType, entityId: target.entityId, projectId: target.project?.id ?? null,
    name: input.name, category: input.category, expiresOn: input.expiresOn, accessLevel: 'client'
  }, requestId)
  await tellDocument(tx, actor, partyId, target.project, id, String(input.name).trim(), 'diunggah')
  return { id }
}

/** A new version of a client document: same entity, version + 1, `supersedes_id` the old one. */
export async function clientReplaceDocument(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  const [old] = await listDocuments(tx, { id, partyId })
  if (!old) throw errors.notFound('Dokumen')
  await tx.query('select id from documents where id = $1 for update', [id])
  if (old.sourceType !== 'uploaded') throw rule('Dokumen buatan sistem tidak bisa diganti dari portal.')
  if ((await tx.query('select 1 from documents where supersedes_id = $1', [id])).length) throw rule('Dokumen ini sudah digantikan versi yang lebih baru.')
  const { id: newId } = await createDocument(tx, actor, {
    entityType: old.entityType, entityId: old.entityId, projectId: old.projectId,
    name: input.name ?? old.name, category: input.category ?? old.category, expiresOn: input.expiresOn ?? old.expiresAt, accessLevel: 'client'
  }, requestId)
  await tx.query('update documents set version = $2, supersedes_id = $3 where id = $1', [newId, old.version + 1, id])
  const project = old.projectId ? await ownProject(tx, partyId, old.projectId) : null
  await tellDocument(tx, actor, partyId, project, newId, String(input.name ?? old.name).trim(), `(versi ${old.version + 1}) diunggah`)
  return { id: newId }
}

export async function clientSendMessage(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const mentions = input.mentions
  if (mentions !== undefined && mentions !== null && !(Array.isArray(mentions) && mentions.length === 0)) throw errors.validation({ mentions: ['Client tidak bisa me-mention.'] })
  const project = await ownProject(tx, partyId, input.projectId)
  const { id } = await sendMessage(tx, actor, {
    entityType: 'project', entityId: project.id, projectId: project.id, channel: 'client-message', body: input.body, attachmentName: input.attachmentName
  }, requestId)
  await notifyInternal(tx, actor, project.ownerUserId, { type: 'message', title: `Pesan client di ${project.name}`, body: String(input.body).trim(), entityType: 'project', entityId: project.id })
  return { id }
}

export async function clientMarkMessagesRead(tx: Queryable, actor: Actor, partyId: string, projectId: string) {
  const project = await ownProject(tx, partyId, projectId)
  const rows = await tx.query<{ id: string }>(
    `update messages set read_by = read_by || $2::text::jsonb
      where project_id = $1 and channel = 'client-message' and not (read_by ? $3) returning id`,
    [project.id, JSON.stringify([actor.userId]), actor.userId])
  return { updated: rows.length }
}
```

`sendMessage` sudah mencatat aktivitas project; ubah teksnya di `documents.ts` (blok `if (projectId && !internal)`) supaya pengirim client disebut:

```ts
  if (projectId && !internal) {
    const fromClient = actor.role === 'client'
    await recordProjectActivity(tx, { projectId, actorUserId: actor.userId, sourceAction: 'message.sent', sourceEntityId: id,
      message: fromClient
        ? `Pesan ${id} dari client dikirim oleh ${await actorName(tx, actor.userId)}.`
        : `Pesan ${id} ke ${input.channel === 'client-message' ? 'client' : 'supplier'} dikirim oleh ${await actorName(tx, actor.userId)} (${deliveryChannel}).` })
  }
```

- [ ] **Step 4: Route**

Di `client-write-routes.ts` tambahkan import `clientDocument, clientMessage` (client-scope), `listDocuments, listMessages` (documents), fungsi-fungsi baru, dan:

```ts
  const documentView = async (id: string) => clientDocument((await listDocuments(db, { id }))[0]!)
  const messageView = async (id: string) => clientMessage((await listMessages(db, { id }))[0]!)
```

```ts
    .post('/documents', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/documents', key, body }, tx =>
        clientCreateDocument(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await documentView(result.data.id))
    }, body)
    .post('/documents/:id/replace', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Dokumen')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/documents/:id/replace', key, body: { id, ...(body as object) } }, tx =>
        clientReplaceDocument(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await documentView(result.data.id))
    }, body)
    .post('/messages', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/messages', key, body }, tx =>
        clientSendMessage(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await messageView(result.data.id))
    }, body)
    .post('/projects/:id/messages/read', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      return ok(request, await db.transaction(tx => clientMarkMessagesRead(tx, actor, partyId, projectId)))
    })
```

Catatan: `clientMessage` mengosongkan `readBy` — tes `readBy: []` sesuai itu.

- [ ] **Step 5: Jalankan tes, pastikan lolos**

Run: `cd backend && bun test test/client-portal-writes.test.ts test/documents.test.ts --timeout 30000`
Expected: PASS semua (tes dokumen internal tetap lolos dengan teks aktivitas internal yang tidak berubah).

- [ ] **Step 6: Typecheck + commit**

```bash
git add backend/src/modules/core/client-writes.ts backend/src/modules/core/client-write-routes.ts backend/src/modules/core/documents.ts backend/test/client-portal-writes.test.ts
git commit -m "feat(core): portal client mengunggah & mengganti versi dokumen, mengirim pesan dan menandai dibaca (S12b-1)"
```

---

### Task 3: Backend — profil, kontak, sengketa invoice

**Files:**
- Modify: `backend/src/modules/core/party-writes.ts` (`updateContact`, `deleteContact`)
- Modify: `backend/src/modules/core/client-writes.ts`
- Modify: `backend/src/modules/core/client-write-routes.ts`
- Test: `backend/test/client-portal-writes.test.ts`

**Interfaces:**
- Consumes: `updateParty`, `createContact`, `createActivity` (party-writes); `getParty`, `listContacts` (repository); `setInvoiceDispute` (`../finance/receivables`); `getClientInvoice` (`./client-commerce`); `businessDateOf` (`../../shared/dates`); `notifyInternal` (Task 1).
- Produces: `updateContact(tx, actor, partyId, id, input, requestId): Promise<void>`, `deleteContact(tx, actor, partyId, id, requestId): Promise<void>`; `clientUpdateProfile`, `clientCreateContact`, `clientUpdateContact`, `clientDeleteContact`, `clientDisputeInvoice`; routes `GET/PATCH /client/profile`, `GET/POST /client/contacts`, `PATCH/DELETE /client/contacts/:id`, `POST /client/invoices/:id/dispute`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
describe('client profile, contacts & disputes', () => {
  test('profile: non-sensitive fields saved and logged; sensitive fields refused for verification; unknown refused', async () => {
    const got = await call('GET', '/client/profile', 'client')
    expect(got.status).toBe(200)
    expect(got.json.data.id).toBe('PTY-005')
    const res = await call('PATCH', '/client/profile', 'client', { address: 'Jl. Sudirman 1', city: 'Jakarta', travelPreferences: 'Window seat' })
    expect(res.status, JSON.stringify(res.json)).toBe(200)
    expect(res.json.data).toMatchObject({ address: 'Jl. Sudirman 1', city: 'Jakarta' })
    const act = await t.db.query("select 1 from party_activities where party_id = 'PTY-005' and message = 'Company Profile diperbarui oleh Client.'")
    expect(act.length).toBeGreaterThan(0)
    const sensitive = await call('PATCH', '/client/profile', 'client', { npwp: '012345678901234', city: 'Bandung' })
    expect(sensitive.status).toBe(422)
    expect(sensitive.json.error.message).toContain('verifikasi')
    expect((await call('PATCH', '/client/profile', 'client', { creditLimitMinor: '1' })).status).toBe(400)
    expect((await call('GET', '/client/profile', 'admin')).status).toBe(403)
  })

  test('contacts: own party add, edit, delete; another party’s contact is not found', async () => {
    const add = await call('POST', '/client/contacts', 'client', { name: 'Rina', title: 'HR Manager', email: 'rina@java-bhakti.example' }, k())
    expect(add.status, JSON.stringify(add.json)).toBe(201)
    const id = add.json.data.id as string
    expect((await call('GET', '/client/contacts', 'client')).json.data.some((x: { id: string }) => x.id === id)).toBe(true)
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { phone: '0812' })).json.data.phone).toBe('0812')
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { email: 'bukan-email' })).status).toBe(400)
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { name: '' })).status).toBe(400)
    const foreign = (await t.db.query<{ id: string }>("select id from party_contacts where party_id <> 'PTY-005' order by id limit 1"))[0]!
    expect((await call('PATCH', `/client/contacts/${foreign.id}`, 'client', { phone: '1' })).status).toBe(404)
    expect((await call('DELETE', `/client/contacts/${foreign.id}`, 'client')).status).toBe(404)
    expect((await call('DELETE', `/client/contacts/${id}`, 'client')).status).toBe(200)
    expect((await call('GET', '/client/contacts', 'client')).json.data.some((x: { id: string }) => x.id === id)).toBe(false)
  })

  test('dispute: own issued unpaid invoice once, Finance told; paid, already disputed, draft and foreign refused', async () => {
    const own = 'PRJ-201'
    const invoice = async (projectId: string, amount: string, issue = true) => {
      const res = await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId, invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: amount }], dueDate: '2026-12-01' } })
      expect(res.status, JSON.stringify(res.json)).toBe(201)
      const id = res.json.data.id as string
      if (issue) expect((await t.call('POST', `/api/v1/finance/customer-invoices/${id}/issue`, { cookie: c.finance, body: {} })).status).toBe(200)
      return id
    }
    const open = await invoice(own, '5000000')
    const draft = await invoice(own, '1000000', false)
    const foreign = await invoice(other, '2000000')
    const finance = (await t.db.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id limit 1"))[0]!.id
    const n0 = await notes(finance)
    const res = await call('POST', `/client/invoices/${open}/dispute`, 'client', { reason: 'Jumlah peserta tidak sesuai' })
    expect(res.status, JSON.stringify(res.json)).toBe(200)
    expect(res.json.data).toMatchObject({ id: open, isDisputed: true, disputeReason: 'Jumlah peserta tidak sesuai' })
    expect(await notes(finance)).toBe(n0 + 1)
    expect((await call('POST', `/client/invoices/${open}/dispute`, 'client', { reason: 'Lagi dan lagi' })).status).toBe(422)
    expect((await call('POST', `/client/invoices/${draft}/dispute`, 'client', { reason: 'Draft invoice' })).status).toBe(404)
    expect((await call('POST', `/client/invoices/${foreign}/dispute`, 'client', { reason: 'Bukan milik' })).status).toBe(404)
    // A fully paid invoice cannot be disputed from the portal.
    const paid = await invoice(own, '3000000')
    await t.db.query("update customer_invoices set is_disputed = false where id = $1", [paid])
    const settled = await t.call('GET', `/api/v1/client/invoices/${paid}`, { cookie: c.client })
    expect(settled.status).toBe(200)
    await t.db.query('alter table customer_invoices disable trigger user')
    await t.db.query("update customer_invoices set paid_minor = total_minor where id = $1", [paid])
    await t.db.query('alter table customer_invoices enable trigger user')
    expect((await call('POST', `/client/invoices/${paid}/dispute`, 'client', { reason: 'Sudah lunas' })).status).toBe(422)
  })
})
```

Catatan untuk eksekutor: cara "membuat invoice lunas" di tes harus mengikuti skema nyata — cek apakah `paid_minor` kolom tersimpan atau dihitung dari alokasi (`allocations`). Bila dihitung, catat penerimaan lewat `POST /api/v1/finance/receipts` dengan Finance (cari pola di `test/finance-*.test.ts`) alih-alih update langsung; ganti 3 baris trigger/update di atas dengan pola itu. Ledger-kan sebagai Ruling.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && bun test test/client-portal-writes.test.ts --timeout 30000`
Expected: 3 tes baru FAIL (404 route).

- [ ] **Step 3: `party-writes.ts` — update/delete kontak**

```ts
export async function updateContact(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  const [current] = await tx.query<{ id: string }>('select id from party_contacts where id = $1 and party_id = $2 for update', [id, partyId])
  if (!current) throw errors.notFound('Kontak')
  const problems: FieldErrors = {}
  const out: Record<string, string | null> = {}
  for (const [field, label] of [['name', 'Nama kontak'], ['title', 'Jabatan']] as const) {
    if (input[field] === undefined) continue
    const v = typeof input[field] === 'string' ? (input[field] as string).trim() : ''
    if (!v) problems[field] = [`${label} wajib diisi.`]
    else if (v.length > 200) problems[field] = ['Maksimal 200 karakter.']
    else out[field] = v
  }
  const email = cleanText(input.email, 'email', problems, 200)
  if (email !== undefined) { if (email && !EMAIL.test(email)) problems.email = ['Format email tidak valid.']; else out.email = email }
  const phone = cleanText(input.phone, 'phone', problems, 50)
  if (phone !== undefined) out.phone = phone
  if (Object.keys(problems).length) throw errors.validation(problems)
  const keys = Object.keys(out)
  if (!keys.length) return
  await tx.query(`update party_contacts set ${keys.map((key, i) => `${key} = $${i + 2}`).join(', ')} where id = $1`, [id, ...Object.values(out)])
  await recordAudit(tx, { action: 'party.contact_updated', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { contactId: id, ...out } })
}

export async function deleteContact(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string): Promise<void> {
  const done = await tx.query<{ name: string }>('delete from party_contacts where id = $1 and party_id = $2 returning name', [id, partyId])
  if (!done.length) throw errors.notFound('Kontak')
  await recordAudit(tx, { action: 'party.contact_deleted', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, before: { contactId: id, name: done[0]!.name } })
}
```

- [ ] **Step 4: `client-writes.ts` — profil, kontak, sengketa**

Import tambahan: `createActivity, createContact, deleteContact, updateContact, updateParty` dari `./party-writes`; `setInvoiceDispute` dari `../finance/receivables`.

```ts
/* ---------- profile, contacts & disputes ---------- */

const CLIENT_PROFILE_FIELDS = ['industry', 'size', 'address', 'city', 'province', 'country', 'postalCode', 'phone', 'website', 'email', 'companyType', 'poRequired', 'travelPreferences']
const SENSITIVE_PROFILE_FIELDS = ['name', 'npwp', 'registrationNumber', 'billingName', 'billingAddress', 'paymentTerm', 'accountOwnerUserId']

export async function clientUpdateProfile(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, today: string, requestId: string) {
  if (Object.keys(input).some(key => SENSITIVE_PROFILE_FIELDS.includes(key))) throw rule('Perubahan data registrasi/pajak/billing diajukan lewat verifikasi.')
  const unknown = Object.keys(input).filter(key => !CLIENT_PROFILE_FIELDS.includes(key))
  if (unknown.length) throw errors.validation(Object.fromEntries(unknown.map(key => [key, ['Tidak bisa diubah dari portal.']])))
  if (!Object.keys(input).length) return
  await updateParty(tx, actor, partyId, input, requestId)
  await createActivity(tx, actor, partyId, { type: 'note', message: 'Company Profile diperbarui oleh Client.' }, today, requestId)
  await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'change', title: 'Company Profile diperbarui client', body: `Field: ${Object.keys(input).join(', ')}.`, entityType: 'party', entityId: partyId })
}

export async function clientCreateContact(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const { id } = await createContact(tx, actor, partyId, input, requestId)
  await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'change', title: 'Kontak baru dari client', body: `${String(input.name).trim()} (${id}) ditambahkan.`, entityType: 'party', entityId: partyId })
  return { id }
}

export const clientUpdateContact = (tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) =>
  updateContact(tx, actor, partyId, id, input, requestId)

export async function clientDeleteContact(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  await deleteContact(tx, actor, partyId, id, requestId)
  await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'change', title: 'Kontak dihapus client', body: `Kontak ${id} dihapus.`, entityType: 'party', entityId: partyId })
}

/** The caller has checked the invoice is the party's, issued and not settled (`getClientInvoice`). */
export async function clientDisputeInvoice(tx: Queryable, actor: Actor, partyId: string, id: string, reason: unknown, requestId: string) {
  await setInvoiceDispute(tx, actor, id, { disputed: true, reason: reason as string }, requestId)
  const finance = await tx.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id")
  for (const u of finance) {
    await notifyInternal(tx, actor, u.id, { type: 'reminder', title: `Invoice ${id} disengketakan client`, body: String(reason).trim(), entityType: 'invoice', entityId: id })
  }
}
```

- [ ] **Step 5: Route**

Import: `getParty, listContacts` (`./repository`), `getClientInvoice` (`./client-commerce`), `businessDateOf` (`../../shared/dates`), fungsi baru.

```ts
    .get('/profile', async ({ request }) => {
      const { actor, partyId } = await clientActor(request)
      const party = await getParty(db, actor, partyId)
      if (!party) throw errors.notFound('Customer')
      return ok(request, party)
    })
    .patch('/profile', async ({ request, body }) => {
      const { actor, partyId } = await clientActor(request)
      await db.transaction(tx => clientUpdateProfile(tx, actor, partyId, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await getParty(db, actor, partyId))
    }, body)
    .get('/contacts', async ({ request }) => {
      const { partyId } = await clientActor(request)
      return ok(request, await listContacts(db, partyId))
    })
    .post('/contacts', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/contacts', key, body }, tx =>
        clientCreateContact(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listContacts(db, partyId)).find(x => x.id === result.data.id))
    }, body)
    .patch('/contacts/:id', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Kontak')
      await db.transaction(tx => clientUpdateContact(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, (await listContacts(db, partyId)).find(x => x.id === id))
    }, body)
    .delete('/contacts/:id', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Kontak')
      await db.transaction(tx => clientDeleteContact(tx, actor, partyId, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
    .post('/invoices/:id/dispute', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Invoice')
      const current = await getClientInvoice(db, partyId, id)
      if (current.status !== 'issued') throw errors.notFound('Invoice')
      if (current.outstandingMinor === '0') throw rule('Invoice ini sudah lunas — tidak bisa disengketakan.')
      await db.transaction(tx => clientDisputeInvoice(tx, actor, partyId, id, (body as Record<string, unknown>).reason, requestIdOf(request)))
      return ok(request, await getClientInvoice(db, partyId, id))
    }, body)
```

(`rule` di-import dari `./travelers`.) `getClientInvoice` sudah melempar 404 untuk draft/party lain (S12a-2).

- [ ] **Step 6: Jalankan tes, pastikan lolos**

Run: `cd backend && bun test test/client-portal-writes.test.ts test/customers.test.ts --timeout 30000` (nama file tes customer/party: cek `ls backend/test | grep -i part`)
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

```bash
git add backend/src/modules/core/party-writes.ts backend/src/modules/core/client-writes.ts backend/src/modules/core/client-write-routes.ts backend/test/client-portal-writes.test.ts
git commit -m "feat(core): portal client mengubah profil non-sensitif, mengelola kontak dan mengajukan sengketa invoice (S12b-1)"
```

---

### Task 4: Frontend — endpoint, tipe, modul `client-portal-writes`, muat profil & kontak

**Files:**
- Modify: `frontend/app/types/api.ts` (`ClientDocumentInput`, `ClientMessageInput`, `ClientContactInput`)
- Modify: `frontend/app/lib/api/endpoints.ts` (`core.client*`)
- Create: `frontend/app/data/client-portal-writes.ts`
- Create: `frontend/app/data/client-portal-writes.test.ts`
- Modify: `frontend/app/data/client-commerce-sync.ts` (muat profil & kontak; snapshot `PARTIES` dan `CONTACTS`)

**Interfaces:**
- Consumes: `upsertServerTraveler`, `upsertServerRoom`, `reloadProjectTravelers` (travelers-sync); `documentFromServer`, `messageFromServer` (documents-sync); `upsertServerParty`, `contactFromServer` (parties-sync); `invoiceFromClientServer` (client-commerce-sync); `DOCUMENT_RECORDS`, `MESSAGE_RECORDS`, `CONTACTS`, `INVOICES` (data/index).
- Produces (Task 5–6): 
  - `clientAddTraveler(api, projectId, input): Promise<Traveler>`
  - `clientEditTraveler(api, id, input): Promise<Traveler>`
  - `clientCancelTraveler(api, projectId, id, reason): Promise<void>`
  - `clientReplaceTraveler(api, projectId, id, input): Promise<Traveler>`
  - `clientImportTravelers(api, projectId, rows): Promise<{ created: string[]; rejected: { index: number; errors: string[] }[] }>`
  - `clientCreateRoom(api, projectId, input): Promise<RoomAssignment>`
  - `clientSetRoomTravelers(api, id, travelerIds): Promise<RoomAssignment>`
  - `clientUploadDocument(api, input: ClientDocumentInput): Promise<Document>`
  - `clientReplaceDocument(api, id, input): Promise<Document>`
  - `clientSendMessage(api, input: ClientMessageInput): Promise<Message>`
  - `clientMarkMessagesRead(api, projectId, userId): Promise<void>`
  - `clientUpdateProfile(api, input): Promise<Party>`
  - `clientAddContact(api, input) / clientEditContact(api, id, input) / clientRemoveContact(api, id)`
  - `clientDisputeInvoice(api, partyId, id, reason): Promise<Invoice>`

- [ ] **Step 1: Tipe & endpoint**

`types/api.ts`:

```ts
/** S12b-1: client portal writes. */
export interface ClientDocumentInput { entityType: 'project' | 'traveler' | 'party'; entityId: string; name: string; category: string; expiresOn?: string }
export interface ClientMessageInput { projectId: string; body: string; attachmentName?: string }
export interface ClientContactInput { name?: string; title?: string; email?: string | null; phone?: string | null }
```

`endpoints.ts` di blok `core` (dekat `listClientQuotations`):

```ts
      clientCreateTraveler: (projectId: string, input: TravelerInput & { name: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerDto>(`/client/projects/${seg(projectId)}/travelers`, input, { idempotencyKey }),
      clientUpdateTraveler: (id: string, input: TravelerInput) => client.patch<TravelerDto>(`/client/travelers/${seg(id)}`, input),
      clientCancelTraveler: (id: string, reason: string) => client.post<TravelerDto>(`/client/travelers/${seg(id)}/cancel`, { reason }),
      clientReplaceTraveler: (id: string, input: TravelerInput & { name: string }) => client.post<TravelerDto>(`/client/travelers/${seg(id)}/replace`, input),
      clientImportTravelers: (projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[], idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerImportResultDto>(`/client/projects/${seg(projectId)}/travelers/import`, { rows }, { idempotencyKey }),
      clientCreateRoom: (projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<RoomAssignmentDto>(`/client/projects/${seg(projectId)}/room-assignments`, input, { idempotencyKey }),
      clientSetRoomTravelers: (id: string, travelerIds: string[]) => client.put<RoomAssignmentDto>(`/client/room-assignments/${seg(id)}/travelers`, { travelerIds }),
      clientCreateDocument: (input: ClientDocumentInput, idempotencyKey: string = newIdempotencyKey()) => client.post<DocumentDto>('/client/documents', input, { idempotencyKey }),
      clientReplaceDocument: (id: string, input: { name?: string; category?: string; expiresOn?: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<DocumentDto>(`/client/documents/${seg(id)}/replace`, input, { idempotencyKey }),
      clientSendMessage: (input: ClientMessageInput, idempotencyKey: string = newIdempotencyKey()) => client.post<MessageDto>('/client/messages', input, { idempotencyKey }),
      clientMarkMessagesRead: (projectId: string) => client.post<{ updated: number }>(`/client/projects/${seg(projectId)}/messages/read`, {}),
      getClientProfile: () => client.get<PartyDto>('/client/profile'),
      updateClientProfile: (input: PartyProfileInput) => client.patch<PartyDto>('/client/profile', input),
      listClientContacts: () => client.get<PartyContactDto[]>('/client/contacts'),
      clientCreateContact: (input: ClientContactInput & { name: string; title: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<PartyContactDto>('/client/contacts', input, { idempotencyKey }),
      clientUpdateContact: (id: string, input: ClientContactInput) => client.patch<PartyContactDto>(`/client/contacts/${seg(id)}`, input),
      clientDeleteContact: (id: string) => client.delete<{ id: string; deleted: true }>(`/client/contacts/${seg(id)}`),
      clientDisputeInvoice: (id: string, reason: string) => client.post<ClientInvoiceDto>(`/client/invoices/${seg(id)}/dispute`, { reason }),
```

Tambahkan import tipe yang belum ada di `endpoints.ts` (`ClientDocumentInput`, `ClientMessageInput`, `ClientContactInput`, `PartyProfileInput`, `ClientInvoiceDto`).

- [ ] **Step 2: Tulis tes modul yang gagal**

`data/client-portal-writes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { CONTACTS, DOCUMENT_RECORDS, INVOICES, MESSAGE_RECORDS, TRAVELERS } from './index'
import {
  clientAddContact, clientAddTraveler, clientDisputeInvoice, clientEditContact, clientMarkMessagesRead, clientRemoveContact, clientSendMessage, clientUploadDocument
} from './client-portal-writes'
import type { ManovaApi } from '~/lib/api/endpoints'

const ok = <T>(data: T) => Promise.resolve({ data })
const fail = () => Promise.reject(Object.assign(new Error('Project sudah berjalan'), { status: 422 }))
const apiWith = (core: Record<string, unknown>) => ({ core } as unknown as Pick<ManovaApi, 'core'>)

const traveler = { id: 'TRV-900', projectId: 'PRJ-201', partyId: null, leadId: null, salesOrderId: null, groupId: null, name: 'Peserta Server', passportNumber: null, passportExpiryDate: null, idNumber: null, visaNumber: null, visaExpiryDate: null, emergencyContactName: null, emergencyContactPhone: null, specialRequest: null, dietaryRestrictions: null, accessibilityNeeds: null, companionOfTravelerId: null, isVip: false, cancelled: false, cancelReason: null, replacedByTravelerId: null, replacesTravelerId: null, documentsVerifiedOn: null, documentsVerifiedBy: null }

describe('client portal writes (S12b-1)', () => {
  it('a server traveler is added locally; a refused write changes nothing', async () => {
    const t = await clientAddTraveler(apiWith({ clientCreateTraveler: () => ok(traveler) }), 'PRJ-201', { name: 'Peserta Server' })
    expect(t.id).toBe('TRV-900')
    expect(TRAVELERS.some(x => x.id === 'TRV-900')).toBe(true)
    const before = TRAVELERS.length
    await expect(clientAddTraveler(apiWith({ clientCreateTraveler: fail }), 'PRJ-202', { name: 'Telat' })).rejects.toThrow()
    expect(TRAVELERS.length).toBe(before)
  })

  it('documents and messages land in the local lists with server ids', async () => {
    const doc = { id: 'DOC-900', entityType: 'project', entityId: 'PRJ-201', projectId: 'PRJ-201', name: 'Rundown', category: 'Rundown', version: 1, accessLevel: 'client', sourceType: 'uploaded', previewRoute: null, uploadedBy: null, uploadedAt: '2026-10-19', generatedAt: null, expiresAt: null, supersedesId: null, verified: false, verifiedBy: null, verifiedAt: null }
    await clientUploadDocument(apiWith({ clientCreateDocument: () => ok(doc) }), { entityType: 'project', entityId: 'PRJ-201', name: 'Rundown', category: 'Rundown' })
    expect(DOCUMENT_RECORDS.find(d => d.id === 'DOC-900')).toBeTruthy()
    const msg = { id: 'MSG-900', entityType: 'project', entityId: 'PRJ-201', projectId: 'PRJ-201', channel: 'client-message', senderId: 'USR-021', body: 'Halo', mentions: [], deliveryStatus: 'delivered', deliveryChannel: 'email', attachmentName: null, readBy: [], createdAt: '2026-10-19T00:00:00.000Z' }
    await clientSendMessage(apiWith({ clientSendMessage: () => ok(msg) }), { projectId: 'PRJ-201', body: 'Halo' })
    expect(MESSAGE_RECORDS.find(m => m.id === 'MSG-900')).toBeTruthy()
    const mark = vi.fn(() => ok({ updated: 1 }))
    await clientMarkMessagesRead(apiWith({ clientMarkMessagesRead: mark }), 'PRJ-201', 'USR-021')
    expect(mark).toHaveBeenCalledWith('PRJ-201')
    expect(MESSAGE_RECORDS.filter(m => m.projectId === 'PRJ-201' && m.channel === 'client-message').every(m => m.readBy.includes('USR-021'))).toBe(true)
  })

  it('contacts and disputes follow the server', async () => {
    await clientAddContact(apiWith({ clientCreateContact: () => ok({ id: 'CP-900', partyId: 'PTY-005', name: 'Rina', title: 'HR', email: null, phone: null }) }), { name: 'Rina', title: 'HR' })
    expect(CONTACTS.find(x => x.id === 'CP-900')?.name).toBe('Rina')
    await clientEditContact(apiWith({ clientUpdateContact: () => ok({ id: 'CP-900', partyId: 'PTY-005', name: 'Rina', title: 'HR', email: null, phone: '0812' }) }), 'CP-900', { phone: '0812' })
    expect(CONTACTS.find(x => x.id === 'CP-900')?.phone).toBe('0812')
    await clientRemoveContact(apiWith({ clientDeleteContact: () => ok({ id: 'CP-900', deleted: true }) }), 'CP-900')
    expect(CONTACTS.some(x => x.id === 'CP-900')).toBe(false)

    const inv = { id: 'CINV-950', number: 'INV-950', project: { id: 'PRJ-201', name: 'P' }, invoiceType: 'dp', status: 'issued', settlement: 'open', overdue: false, daysOverdue: 0, currency: 'IDR', totalMinor: '1000', paidMinor: '0', creditedMinor: '0', outstandingMinor: '1000', issueDate: '2026-10-01', dueDate: '2026-10-30', isDisputed: true, disputeReason: 'Salah', voidReason: null, billingSnapshot: null, lines: [], payments: [], creditNotes: [] }
    INVOICES.push({ id: 'CINV-950', projectId: 'PRJ-201', label: 'INV-950', amountIdr: 1000, issuedAt: '2026-10-01', dueAt: '2026-10-30', status: 'unpaid' } as never)
    const result = await clientDisputeInvoice(apiWith({ clientDisputeInvoice: () => ok(inv) }), 'PTY-005', 'CINV-950', 'Salah')
    expect(result.status).toBe('disputed')
    expect(INVOICES.find(i => i.id === 'CINV-950')?.disputeReason).toBe('Salah')
  })
})
```

(Sesuaikan bentuk DTO uji dengan `TravelerDto`/`DocumentDto`/`MessageDto` nyata di `types/api.ts`; field yang tidak ada di tipe dihapus, yang wajib ditambah.)

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm exec vitest run app/data/client-portal-writes.test.ts`
Expected: FAIL — modul `./client-portal-writes` belum ada.

- [ ] **Step 4: Implementasi `data/client-portal-writes.ts`**

```ts
import { CONTACTS, DOCUMENT_RECORDS, INVOICES, MESSAGE_RECORDS } from './index'
import { reloadProjectTravelers, upsertServerRoom, upsertServerTraveler } from './travelers-sync'
import { documentFromServer, messageFromServer } from './documents-sync'
import { contactFromServer, upsertServerParty } from './parties-sync'
import { invoiceFromClientServer } from './client-commerce-sync'
import type { ManovaApi } from '~/lib/api/endpoints'
import type { ClientContactInput, ClientDocumentInput, ClientMessageInput, PartyProfileInput, TravelerInput } from '~/types/api'

/**
 * Client portal writes (S12b-1): every action goes to /client/* first and only the server's answer changes the local
 * lists — a refused write (locked project, another party, staff-only field) leaves them as they were.
 */

type CoreApi = Pick<ManovaApi, 'core'>

const upsert = <T extends { id: string }>(list: T[], row: T): T => {
  const i = list.findIndex(x => x.id === row.id)
  if (i === -1) { list.push(row) } else { list.splice(i, 1, row) }
  return row
}

/* participants & rooms */
export const clientAddTraveler = async (api: CoreApi, projectId: string, input: TravelerInput & { name: string }) =>
  upsertServerTraveler((await api.core.clientCreateTraveler(projectId, input)).data)
export const clientEditTraveler = async (api: CoreApi, id: string, input: TravelerInput) =>
  upsertServerTraveler((await api.core.clientUpdateTraveler(id, input)).data)
export async function clientCancelTraveler (api: CoreApi, projectId: string, id: string, reason: string): Promise<void> {
  await api.core.clientCancelTraveler(id, reason)
  await reloadProjectTravelers(api, projectId) // the traveler also leaves its room
}
export async function clientReplaceTraveler (api: CoreApi, projectId: string, id: string, input: TravelerInput & { name: string }) {
  const created = (await api.core.clientReplaceTraveler(id, input)).data
  await reloadProjectTravelers(api, projectId) // old one cancelled, room handed over
  return upsertServerTraveler(created)
}
export async function clientImportTravelers (api: CoreApi, projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[]) {
  const result = (await api.core.clientImportTravelers(projectId, rows)).data
  await reloadProjectTravelers(api, projectId)
  return result
}
export const clientCreateRoom = async (api: CoreApi, projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }) =>
  upsertServerRoom((await api.core.clientCreateRoom(projectId, input)).data)
export async function clientSetRoomTravelers (api: CoreApi, projectId: string, id: string, travelerIds: string[]) {
  const room = upsertServerRoom((await api.core.clientSetRoomTravelers(id, travelerIds)).data)
  await reloadProjectTravelers(api, projectId) // travelers moved out of their other rooms
  return room
}

/* documents & messages */
export const clientUploadDocument = async (api: CoreApi, input: ClientDocumentInput) =>
  upsert(DOCUMENT_RECORDS, documentFromServer((await api.core.clientCreateDocument(input)).data))
export const clientReplaceDocument = async (api: CoreApi, id: string, input: { name?: string; category?: string; expiresOn?: string }) =>
  upsert(DOCUMENT_RECORDS, documentFromServer((await api.core.clientReplaceDocument(id, input)).data))
export const clientSendMessage = async (api: CoreApi, input: ClientMessageInput) =>
  upsert(MESSAGE_RECORDS, messageFromServer((await api.core.clientSendMessage(input)).data))
export async function clientMarkMessagesRead (api: CoreApi, projectId: string, userId: string): Promise<void> {
  await api.core.clientMarkMessagesRead(projectId)
  for (const m of MESSAGE_RECORDS) {
    if (m.projectId === projectId && m.channel === 'client-message' && !m.readBy.includes(userId)) { m.readBy.push(userId) }
  }
}

/* profile, contacts & disputes */
export const clientUpdateProfile = async (api: CoreApi, input: PartyProfileInput) => upsertServerParty((await api.core.updateClientProfile(input)).data)
export const clientAddContact = async (api: CoreApi, input: ClientContactInput & { name: string; title: string }) =>
  upsert(CONTACTS, contactFromServer((await api.core.clientCreateContact(input)).data))
export const clientEditContact = async (api: CoreApi, id: string, input: ClientContactInput) =>
  upsert(CONTACTS, contactFromServer((await api.core.clientUpdateContact(id, input)).data))
export async function clientRemoveContact (api: CoreApi, id: string): Promise<void> {
  await api.core.clientDeleteContact(id)
  const i = CONTACTS.findIndex(x => x.id === id)
  if (i !== -1) { CONTACTS.splice(i, 1) }
}
export const clientDisputeInvoice = async (api: CoreApi, partyId: string, id: string, reason: string) =>
  upsert(INVOICES, invoiceFromClientServer((await api.core.clientDisputeInvoice(id, reason)).data, partyId))
```

(Nama array `DOCUMENT_RECORDS`/`MESSAGE_RECORDS` dan tipe `readBy` mengikuti `data/index.ts`; cek dan sesuaikan bila berbeda. Bila `messageFromServer` memberi `readBy` dari DTO yang dikosongkan untuk client, itu sesuai.)

- [ ] **Step 5: Muat profil & kontak untuk client; snapshot ikut `PARTIES` & `CONTACTS`**

Di `client-commerce-sync.ts`:
- snapshot ditambah `parties: copy(PARTIES)`, `contacts: copy(CONTACTS)` dan dipulihkan di `resetClientCommerce`.
- `loadClientCommerce` ikut memanggil `api.core.getClientProfile()` dan `api.core.listClientContacts()`; hasilnya: `takeSnapshot()` lalu `upsertServerParty(profile.data)` dan ganti kontak party itu saja:

```ts
export function mergeClientContacts (partyId: string, list: PartyContactDto[]): void {
  takeSnapshot()
  for (let i = CONTACTS.length - 1; i >= 0; i--) { if (CONTACTS[i]!.partyId === partyId) { CONTACTS.splice(i, 1) } }
  CONTACTS.push(...list.map(contactFromServer))
}
```

Tambah tes di `client-commerce-sync.test.ts`: `mergeClientContacts` mengganti kontak party itu saja, dan `resetClientCommerce` memulihkan `CONTACTS`.

- [ ] **Step 6: Jalankan tes, pastikan lolos**

Run: `cd frontend && pnpm exec vitest run app/data/client-portal-writes.test.ts app/data/client-commerce-sync.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/types/api.ts frontend/app/lib/api/endpoints.ts frontend/app/data/client-portal-writes.ts frontend/app/data/client-portal-writes.test.ts frontend/app/data/client-commerce-sync.ts frontend/app/data/client-commerce-sync.test.ts
git commit -m "feat(frontend): modul aksi tulis portal client ke /client/* + muat profil & kontak client dari server (S12b-1)"
```

---

### Task 5: Frontend — peserta & kamar di portal server-first

**Files:**
- Modify: `frontend/app/components/client/ParticipantsListPanel.vue` (tambah, batal massal, impor; tombol VIP massal dihapus)
- Modify: `frontend/app/pages/client/participants/[id]/index.vue` (edit, VIP dihapus, batal, ganti, buat kamar, tambah roommate/assign)
- Modify: `frontend/app/pages/client/project-orders/[id]/index.vue` (tambah/edit peserta di dialog project)
- Create: `frontend/app/client-portal-writes.guard.test.ts`

**Interfaces:**
- Consumes: fungsi Task 4; `createSaveGate` (`~/lib/save-gate`); `useApi()`.

Pola untuk setiap handler (contoh tambah peserta di `ParticipantsListPanel.vue`):

```ts
const api = useApi()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))

async function submitAdd () {
  if (!addProjectId.value || !addName.value.trim()) { return }
  const name = addName.value.trim()
  const created = await gate.run('Peserta Gagal Ditambahkan', () => clientAddTraveler(api, addProjectId.value, { name }))
  if (!created) { return }
  addName.value = ''
  isAddDialogOpen.value = false
  showToast('Peserta Ditambahkan', `${name} berhasil ditambahkan.`, 'success')
}
```

Pemetaan handler → fungsi (baca tiap file dulu; pertahankan validasi & teks toast yang ada, ganti hanya pemanggilan mutator lokal):

| Lokasi | Mutator lokal lama | Pengganti |
|---|---|---|
| `ParticipantsListPanel.vue` `submitAdd` | `createTraveler` | `clientAddTraveler(api, projectId, { name })` |
| `ParticipantsListPanel.vue` `bulkMarkVip` + tombolnya | `setTravelerVip` | dihapus (VIP hak staf) |
| `ParticipantsListPanel.vue` `submitBulkCancel` | `cancelTraveler` per id | loop `await clientCancelTraveler(api, tr.projectId, id, reason)` dalam satu `gate.run`; hitung yang berhasil |
| `ParticipantsListPanel.vue` `submitImport` | `commitTravelerImport` | `clientImportTravelers(api, projectId, rows.map(r => ({ name: r.name, passportNumber: r.passportNumber || undefined })))`; toast memakai `created.length` / `rejected.length` |
| `participants/[id]` simpan edit | `updateTraveler` | `clientEditTraveler(api, id, patch)` |
| `participants/[id]` VIP toggle | `setTravelerVip` | tombol/handler dihapus |
| `participants/[id]` batal | `cancelTraveler` | `clientCancelTraveler(api, projectId, id, reason)` |
| `participants/[id]` ganti | `replaceTraveler` | `clientReplaceTraveler(api, projectId, id, input)` lalu navigasi ke peserta baru bila halaman sebelumnya begitu |
| `participants/[id]` buat kamar | `createRoomAssignment` | `clientCreateRoom(api, projectId, { groupId, roomLabel, roomType, travelerIds })` |
| `participants/[id]` `addRoommate` / `assignToRoom` | `setRoomAssignmentTravelers` | `clientSetRoomTravelers(api, projectId, roomId, ids)` |
| `project-orders/[id]` tambah/edit peserta | `createTraveler` / `updateTraveler` | `clientAddTraveler` / `clientEditTraveler` |

Tombol tulis peserta dinonaktifkan (dengan teks bantuan "Project sudah berjalan — ajukan lewat change request.") bila status project `ongoing-trip`, `completed`, atau `cancelled` (status frontend: cek nilai `project.status` di tipe `Project`; petakan ke yang setara).

- [ ] **Step 1: Tulis guard test yang gagal**

`frontend/app/client-portal-writes.guard.test.ts` (pola sama `no-local-sales.test.ts` — baca file itu dulu dan tiru cara membaca file):

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** S12b-1: these portal screens write through /client/* — the local mutators must not come back. */
const FILES = [
  'components/client/ParticipantsListPanel.vue',
  'pages/client/participants/[id]/index.vue',
  'pages/client/project-orders/[id]/index.vue'
]
const FORBIDDEN = ['createTraveler(', 'updateTraveler(', 'cancelTraveler(', 'replaceTraveler(', 'commitTravelerImport(', 'setTravelerVip(', 'createRoomAssignment(', 'setRoomAssignmentTravelers(']

describe('client portal writes go to the server (S12b-1)', () => {
  for (const file of FILES) {
    it(file, () => {
      const source = readFileSync(resolve(__dirname, file), 'utf8')
      for (const call of FORBIDDEN) {
        // `clientCancelTraveler(` etc. are the server versions; only the bare local names are refused.
        expect(new RegExp(`(?<![A-Za-z])${call.replace('(', '\\(')}`).test(source), `${file} still calls ${call}`).toBe(false)
      }
    })
  }
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm exec vitest run app/client-portal-writes.guard.test.ts`
Expected: FAIL — tiga file masih memanggil mutator lokal.

- [ ] **Step 3: Ganti handler di tiga file sesuai tabel**

- [ ] **Step 4: Jalankan guard + suite**

Run: `cd frontend && pnpm exec vitest run app/client-portal-writes.guard.test.ts && pnpm test`
Expected: PASS semua.

- [ ] **Step 5: vue-tsc & eslint per file**

Run: `cd frontend && pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json 2>&1 | grep -c "error TS"` — Expected: ≤ 1983.
Run: `pnpm exec eslint <tiga file> app/client-portal-writes.guard.test.ts` dan bandingkan dengan HEAD (`git stash -q -- app`) — Expected: tidak bertambah.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/client/ParticipantsListPanel.vue "frontend/app/pages/client/participants/[id]/index.vue" "frontend/app/pages/client/project-orders/[id]/index.vue" frontend/app/client-portal-writes.guard.test.ts
git commit -m "feat(frontend): peserta & kamar di portal client lewat server; VIP disembunyikan, project berjalan dikunci (S12b-1)"
```

---

### Task 6: Frontend — dokumen, pesan, profil, kontak, sengketa server-first

**Files:**
- Modify: `frontend/app/components/client/DocumentsListPanel.vue` (upload, ganti versi)
- Modify: `frontend/app/pages/client/messages/[projectId]/index.vue` (kirim, tandai dibaca saat mount)
- Modify: `frontend/app/pages/client/company-profile/index.vue` (simpan profil non-sensitif, dokumen perusahaan, tambah/edit/hapus kontak)
- Modify: `frontend/app/components/client/DashboardOverviewPanel.vue` (tambah kontak)
- Modify: `frontend/app/pages/client/billing/invoices/[id]/index.vue` (sengketa)
- Modify: `frontend/app/client-portal-writes.guard.test.ts`

| Lokasi | Mutator lokal lama | Pengganti |
|---|---|---|
| `DocumentsListPanel.vue` upload | `createClientDocument` | `clientUploadDocument(api, { entityType: 'project', entityId: projectId, name, category, expiresOn })` |
| `DocumentsListPanel.vue` ganti versi | `replaceClientDocument` | `clientReplaceDocument(api, doc.id, { name, category, expiresOn })` |
| `messages/[projectId]` kirim | `sendMessage` (mention lokal) | `clientSendMessage(api, { projectId, body, attachmentName })`; UI mention dihapus/disembunyikan untuk client |
| `messages/[projectId]` mount | `markProjectMessagesRead` | `clientMarkMessagesRead(api, projectId, currentUser.value.id)` (tanpa toast bila gagal; cukup diam) |
| `company-profile` simpan non-sensitif | `updateCompanyProfile` | `clientUpdateProfile(api, patch)` — patch hanya field non-sensitif yang ada di `PartyProfileInput`; field lokal tanpa kolom server (`preferredCurrency`, `logoFileName`) tetap disimpan lokal setelah server sukses |
| `company-profile` dokumen perusahaan | `createCompanyDocument` | `clientUploadDocument(api, { entityType: 'party', entityId: partyId, name, category, expiresOn })` |
| `company-profile` / `DashboardOverviewPanel` tambah kontak | `createContact` | `clientAddContact(api, { name, title, email, phone })` |
| `company-profile` edit / hapus kontak | `updateContact` / `deleteContact` | `clientEditContact` / `clientRemoveContact` |
| `billing/invoices/[id]` sengketa | `raiseInvoiceDispute` | `clientDisputeInvoice(api, partyId, invoiceId, reason)` |

`submitSensitiveCompanyProfileChange`, `runCompanyProfileVerificationMock`, `submitPaymentProof`, `runPaymentVerificationMock`, `markInvoiceViewed` tetap lokal (S12c).

- [ ] **Step 1: Perluas guard test (gagal dulu)**

Tambah ke `FILES`: lima file di atas. Tambah ke `FORBIDDEN`: `'createClientDocument('`, `'replaceClientDocument('`, `'createCompanyDocument('`, `'sendMessage('`, `'markProjectMessagesRead('`, `'updateCompanyProfile('`, `'createContact('`, `'updateContact('`, `'deleteContact('`, `'raiseInvoiceDispute('`. Regex lookbehind `(?<![A-Za-z])` sudah membedakan `clientSendMessage(`.

Run: `cd frontend && pnpm exec vitest run app/client-portal-writes.guard.test.ts` — Expected: FAIL untuk lima file baru.

- [ ] **Step 2: Ganti handler sesuai tabel** (pola `gate.run` sama dengan Task 5)

- [ ] **Step 3: Jalankan guard + suite + vue-tsc + eslint**

Run: `pnpm exec vitest run app/client-portal-writes.guard.test.ts && pnpm test` — Expected: PASS.
vue-tsc ≤ 1983; eslint tidak bertambah vs HEAD.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/client/DocumentsListPanel.vue "frontend/app/pages/client/messages/[projectId]/index.vue" frontend/app/pages/client/company-profile/index.vue frontend/app/components/client/DashboardOverviewPanel.vue "frontend/app/pages/client/billing/invoices/[id]/index.vue" frontend/app/client-portal-writes.guard.test.ts
git commit -m "feat(frontend): dokumen, pesan, profil, kontak & sengketa invoice di portal client lewat server (S12b-1)"
```

---

### Task 7: Dokumentasi + verifikasi

**Files:**
- Modify: `docs/manova-finance-implementation/adr/ADR-004-core-reference-bridge-and-cutover.md` (catatan S12b-1)
- Modify: `docs/manova-finance-implementation/adr/ADR-006-*.md` (portal client kini menulis sebagian data ke server)
- Modify: `docs/superpowers/specs/2026-10-19-client-portal-writes-design.md` (status → diimplementasikan)

- [ ] **Step 1: Smoke test**

Salin DB dev ke `backend/.data/pglite-s12b1`, jalankan `APP_ENV=development PORT=3100 DATABASE_URL=pglite://.data/pglite-s12b1 APP_ORIGINS=http://localhost:8080 bun src/index.ts`, login demo client, lalu curl: tambah peserta PRJ-201 (201), PRJ-202 (422), upload dokumen (201, access client), kirim pesan (201), PATCH profil kota (200) + NPWP (422), tambah/hapus kontak, sengketa invoice issued (200); admin ke `/client/profile` 403. Matikan server, hapus salinan DB.

- [ ] **Step 2: Suite penuh**

Run (background): `cd backend && bun test --timeout 30000`; `bun run typecheck`; `cd frontend && pnpm test`; vue-tsc; `pnpm build` (background).
Expected: semua lolos; vue-tsc ≤ 1983; build "Build complete!".

- [ ] **Step 3: Dokumen + commit**

ADR-004 tambahkan:

```markdown
## Update 2026-10-19 — Portal client menulis (S12b-1)

Endpoint khusus client di `/api/v1/client/*` (`core/client-write-routes.ts`, `core/client-writes.ts`): peserta
(tambah/edit/batal/ganti/impor) & kamar (buat/atur penghuni) — hanya project milik party client dan belum berangkat
(`ongoing-trip`/`completed`/`cancelled` → 422, lewat change request); dokumen (project/peserta/perusahaan, selalu akses
client & belum terverifikasi; ganti versi) dan pesan `client-message` tanpa mention + tandai dibaca; profil non-sensitif
(sensitif → 422, verifikasi = S12c) dan kontak (tambah/edit/hapus); sengketa invoice issued yang belum lunas. Log aktivitas
project & notifikasi owner/account owner/Finance dibuat server. Frontend `data/client-portal-writes.ts`; guard
`app/client-portal-writes.guard.test.ts`. Change request & respons quotation = S12b-2.
```

ADR-006: satu paragraf "Update 2026-10-19 — portal client menulis peserta, dokumen & pesan, profil & kontak, sengketa ke server (S12b-1); entitas khusus portal tetap lokal (S12c)." Spec: status → `diimplementasikan (plan 2026-10-19-client-portal-writes)`.

```bash
git add docs/manova-finance-implementation/adr/ADR-004-core-reference-bridge-and-cutover.md docs/manova-finance-implementation/adr/ADR-006-*.md docs/superpowers/specs/2026-10-19-client-portal-writes-design.md
git commit -m "docs: ADR-004/ADR-006 & status spec S12b-1"
```
