# Itinerary Harian ke Backend (S7b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Item itinerary harian project (`ITINERARY_ITEMS`) dimiliki server; layar internal menulis lewat API.

**Architecture:** Tabel `itinerary_items` (migrasi 0028), modul `backend/src/modules/core/itinerary.ts` + `itinerary-routes.ts`
mengikuti pola S0/S7a (capability, validasi, audit dalam transaksi, idempotency untuk create). Frontend
`data/itinerary-sync.ts` memuat dan menulis server-first; tab itinerary project order dan "Tambah Acara" kalender dialihkan.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vue 3 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-itinerary-items-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/` (jalankan dari folder itu); jangan tambah lockfile.
- Uang: `bigint` minor di SQL, string desimal di wire (`vendorAmountMinor`).
- Tulis: `project-order.manage-operations`; baca: peran internal, portal 403.
- Pesan error bahasa Indonesia; `errors.validation` 400, `rule` 422, `errors.notFound` 404.
- Jangan ubah migrasi yang sudah diterapkan (0001–0027).
- vue-tsc ≤ 2000 error (baseline 1983); eslint tidak naik per file vs HEAD.

## Review Focus

1. PATCH yang mengosongkan vendor harus ikut mengosongkan nominal (bukan 400/422) — dites di Task 2.
2. PATCH yang mengisi nominal tanpa vendor yang tersimpan → 400 — dites di Task 2.
3. `groupId` dari project lain → 400 — dites di Task 2.
4. Seed ulang tidak menimpa item yang `changed_by_api_at`-nya terisi — dites di Task 3.
5. Gagal simpan di layar tidak menutup form dan tidak mengubah data lokal — dites di Task 4 (sync tidak mengubah `ITINERARY_ITEMS` bila API menolak).

---

### Task 1: Migrasi 0028 + ID prefix

**Files:**
- Create: `backend/migrations/0028_itinerary_items.up.sql`, `backend/migrations/0028_itinerary_items.down.sql`
- Modify: `backend/src/shared/ids.ts` (IdPrefix + SOURCES `'ITIN-': { table: 'itinerary_items' }`)
- Test: `backend/test/db.test.ts`

- [ ] **Step 1: test gagal** — di `db.test.ts`:

```ts
  test('itinerary items exist after 0028', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into itinerary_items (id, project_id, date, title, time) values ('ITIN-T1', 'PRJ-101', '2026-08-01', 'Uji', '09:30')")
      await expect(db.query("insert into itinerary_items (id, project_id, date, title, time) values ('ITIN-T2', 'PRJ-101', '2026-08-01', 'Uji', '25:00')")).rejects.toThrow()
      await expect(db.query("insert into itinerary_items (id, project_id, date, title, vendor_amount_minor) values ('ITIN-T3', 'PRJ-101', '2026-08-01', 'Uji', 1000)")).rejects.toThrow() // amount needs a vendor
      await expect(db.query("insert into itinerary_items (id, project_id, date, title, service_type) values ('ITIN-T4', 'PRJ-101', '2026-08-01', 'Uji', 'cruise')")).rejects.toThrow()
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix = 'ITIN-'")
      expect(seqs).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `cd backend; bun test test/db.test.ts -t "0028"` → FAIL (relation tidak ada).
- [ ] **Step 3: migrasi**

```sql
-- S7b: daily itinerary items (API-owned). Versions and comments stay in the hidden client portal (ADR-006).
create table itinerary_items (
  id                  text primary key check (id <> ''),
  project_id          text not null references projects (id),
  date                date not null,
  time                text check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title               text not null check (title <> ''),
  description         text,
  service_type        text check (service_type in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  group_id            text references traveler_groups (id),
  timezone            text,
  location            text,
  visible_to_client   boolean not null default true,
  vendor_id           text references vendors (id),
  vendor_amount_minor bigint check (vendor_amount_minor >= 0),
  changed_by_api_at   timestamptz,
  provenance          text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (vendor_amount_minor is null or vendor_id is not null)
);
create index itinerary_items_project_date on itinerary_items (project_id, date);

insert into id_sequences (prefix, last_value) values ('ITIN-', 0) on conflict (prefix) do nothing;
```

Down: `delete from id_sequences where prefix = 'ITIN-'; drop table if exists itinerary_items;`

- [ ] **Step 4:** test → PASS; `bun run test` hijau.
- [ ] **Step 5:** commit `feat(core): tabel itinerary_items (S7b)`.

### Task 2: API itinerary

**Files:**
- Create: `backend/src/modules/core/itinerary.ts`, `backend/src/modules/core/itinerary-routes.ts`, `backend/test/itinerary.test.ts`
- Modify: `backend/src/app.ts` (`.use(itineraryRoutes(deps, auth))` setelah `travelerRoutes`)

**Interfaces — Produces:**
- `listItineraryItems(db, { id?, projectId? }): Promise<ItineraryItemView[]>` dengan
  `{ id, projectId, date, time, title, description, serviceType, groupId, timezone, location, visibleToClient, vendorId, vendorAmountMinor }` (nullable = `null`)
- `createItineraryItem(tx, actor, projectId, input, requestId): Promise<{ id }>`, `updateItineraryItem(tx, actor, id, input, requestId)`, `deleteItineraryItem(tx, actor, id, requestId)`
- Routes: `GET /itinerary-items?projectId=`, `POST /projects/:id/itinerary-items`, `PATCH /itinerary-items/:id`, `DELETE /itinerary-items/:id`

- [ ] **Step 1: test gagal** `backend/test/itinerary.test.ts` (pola `travelers.test.ts`):

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S7b: daily itinerary items through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s7b-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('itinerary items', () => {
  test('internal roles read in day order; portals 403; anonymous 401', async () => {
    const res = await call('GET', '/itinerary-items?projectId=PRJ-103', 'finance')
    expect(res.status).toBe(200)
    const items = res.json.data as { id: string; date: string; time: string | null; projectId: string; visibleToClient: boolean }[]
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(x => x.projectId === 'PRJ-103')).toBe(true)
    const keys = items.map(x => `${x.date} ${x.time ?? ''}`)
    expect([...keys].sort()).toEqual(keys)
    expect((await call('GET', '/itinerary-items', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/itinerary-items')).status).toBe(401)
  })

  test('create is idempotent and validated; finance cannot write; unknown project 404', async () => {
    const k = key()
    const body = { date: '2026-08-11', time: '08:30', title: 'City tour', serviceType: 'transportation', groupId: 'GRP-001', location: 'Palu' }
    const res = await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', title: 'City tour', time: '08:30', visibleToClient: true, vendorId: null, vendorAmountMinor: null })
    expect((await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    const bad = async (b: unknown) => (await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', b, key())).status
    expect(await bad({ title: 'Tanpa tanggal' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: '  ' })).toBe(400)
    expect(await bad({ date: '11-08-2026', title: 'X' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', time: '8:30' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', serviceType: 'cruise' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', groupId: 'GRP-004' })).toBe(400) // other project's group
    expect(await bad({ date: '2026-08-11', title: 'X', vendorId: 'VND-999' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', vendorAmountMinor: '1000' })).toBe(400) // amount without vendor
    expect(await bad({ date: '2026-08-11', title: 'X', vendorId: 'VND-001', vendorAmountMinor: '-5' })).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/itinerary-items', 'finance', body, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/itinerary-items', 'admin', body, key())).status).toBe(404)
  })

  test('patch toggles visibility, sets and clears a vendor with its amount; delete', async () => {
    const id = (await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', { date: '2026-08-12', title: 'Gala dinner' }, key())).json.data.id as string
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { visibleToClient: false })).json.data.visibleToClient).toBe(false)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { vendorAmountMinor: '500000' })).status).toBe(400)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { vendorId: 'VND-001', vendorAmountMinor: '500000' })).json.data)
      .toMatchObject({ vendorId: 'VND-001', vendorAmountMinor: '500000' })
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { vendorId: null })).json.data).toMatchObject({ vendorId: null, vendorAmountMinor: null })
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { time: null, description: 'Ballroom' })).json.data).toMatchObject({ time: null, description: 'Ballroom' })
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { projectId: 'PRJ-101' })).status).toBe(400)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { title: '' })).status).toBe(400)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'finance', { title: 'X' })).status).toBe(403)
    expect((await call('DELETE', `/itinerary-items/${id}`, 'admin')).status).toBe(200)
    expect((await call('DELETE', `/itinerary-items/${id}`, 'admin')).status).toBe(404)
    expect((await call('PATCH', '/itinerary-items/ITIN-999', 'admin', { title: 'X' })).status).toBe(404)
  })
})
```

(Vendor `VND-001` dan grup `GRP-004` milik project lain — cek di fixture sebelum menjalankan; sesuaikan bila beda dan catat Ruling.)

- [ ] **Step 2:** `bun test test/itinerary.test.ts` → FAIL (404 route).
- [ ] **Step 3: implementasi** `itinerary.ts`:

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { PG_BIGINT_MAX } from '../../shared/money'

/**
 * Daily itinerary items (S7b). The server owns them; versions, comments and client approval stay in the hidden
 * client portal (ADR-006). A vendor amount only exists next to its vendor: clearing the vendor clears the amount.
 */

const SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional']
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const MINOR = /^(0|[1-9][0-9]{0,18})$/
const TEXT: Record<string, string> = { description: 'description', timezone: 'timezone', location: 'location' }
const FORBIDDEN = ['id', 'projectId']
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

export async function listItineraryItems(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, date::text as date, time, title, description, service_type, group_id, timezone, location,
            visible_to_client, vendor_id, vendor_amount_minor::text as vendor_amount_minor
       from itinerary_items where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
      order by date, time nulls first, id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    date: r.date as string,
    time: str(r.time),
    title: r.title as string,
    description: str(r.description),
    serviceType: str(r.service_type),
    groupId: str(r.group_id),
    timezone: str(r.timezone),
    location: str(r.location),
    visibleToClient: r.visible_to_client as boolean,
    vendorId: str(r.vendor_id),
    vendorAmountMinor: str(r.vendor_amount_minor)
  }))
}

export type ItineraryItemView = Awaited<ReturnType<typeof listItineraryItems>>[number]

const exists = async (tx: Queryable, sql: string, params: unknown[]) => (await tx.query(sql, params)).length > 0

async function cleanItem(tx: Queryable, projectId: string, input: Record<string, unknown>, problems: FieldErrors): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const k of FORBIDDEN) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat item itinerary.']
  const v = input
  if (v.date !== undefined) {
    if (typeof v.date !== 'string' || !isIsoDate(v.date)) problems.date = ['Tanggal wajib diisi dengan format YYYY-MM-DD.']
    else out.date = v.date
  }
  if (v.title !== undefined) {
    const title = typeof v.title === 'string' ? v.title.trim() : ''
    if (!title) problems.title = ['Judul wajib diisi.']
    else if (title.length > 200) problems.title = ['Judul maksimal 200 karakter.']
    else out.title = title
  }
  if (v.time !== undefined) {
    if (v.time === null || v.time === '') out.time = null
    else if (typeof v.time !== 'string' || !TIME.test(v.time)) problems.time = ['Jam harus format HH:MM (00:00–23:59).']
    else out.time = v.time
  }
  for (const [field, column] of Object.entries(TEXT)) {
    const x = v[field]
    if (x === undefined) continue
    if (x === null) out[column] = null
    else if (typeof x !== 'string' || x.trim().length > 500) problems[field] = ['Harus teks, maksimal 500 karakter.']
    else out[column] = x.trim() || null
  }
  if (v.serviceType !== undefined) {
    if (v.serviceType === null || v.serviceType === '') out.service_type = null
    else if (typeof v.serviceType !== 'string' || !SERVICE_TYPES.includes(v.serviceType)) problems.serviceType = ['Jenis layanan tidak dikenal.']
    else out.service_type = v.serviceType
  }
  if (v.groupId !== undefined) {
    if (v.groupId === null || v.groupId === '') out.group_id = null
    else if (typeof v.groupId !== 'string' || !ID_PATTERN.test(v.groupId) || !(await exists(tx, 'select 1 from traveler_groups where id = $1 and project_id = $2', [v.groupId, projectId])))
      problems.groupId = ['Grup tidak ditemukan di project ini.']
    else out.group_id = v.groupId
  }
  if (v.visibleToClient !== undefined) {
    if (typeof v.visibleToClient !== 'boolean') problems.visibleToClient = ['Harus ya/tidak.']
    else out.visible_to_client = v.visibleToClient
  }
  if (v.vendorId !== undefined) {
    if (v.vendorId === null || v.vendorId === '') out.vendor_id = null
    else if (typeof v.vendorId !== 'string' || !ID_PATTERN.test(v.vendorId) || !(await exists(tx, 'select 1 from vendors where id = $1', [v.vendorId])))
      problems.vendorId = ['Vendor tidak ditemukan.']
    else out.vendor_id = v.vendorId
  }
  if (v.vendorAmountMinor !== undefined) {
    if (v.vendorAmountMinor === null || v.vendorAmountMinor === '') out.vendor_amount_minor = null
    else if (typeof v.vendorAmountMinor !== 'string' || !MINOR.test(v.vendorAmountMinor) || BigInt(v.vendorAmountMinor) > PG_BIGINT_MAX)
      problems.vendorAmountMinor = ['Nominal vendor harus angka bulat ≥ 0, dikirim sebagai teks (contoh "1500000").']
    else out.vendor_amount_minor = v.vendorAmountMinor
  }
  return out
}

/** A vendor amount needs a vendor; clearing the vendor clears its amount. */
function checkVendor(values: Record<string, unknown>, current: { vendor_id: string | null; vendor_amount_minor: string | null }, problems: FieldErrors) {
  const vendor = 'vendor_id' in values ? values.vendor_id : current.vendor_id
  if (vendor === null && 'vendor_id' in values) values.vendor_amount_minor = null
  const amount = 'vendor_amount_minor' in values ? values.vendor_amount_minor : current.vendor_amount_minor
  if (amount !== null && vendor === null) problems.vendorAmountMinor = ['Nominal vendor hanya bisa diisi bila vendor dipilih.']
}

export async function createItineraryItem(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.date === undefined) problems.date = ['Tanggal wajib diisi dengan format YYYY-MM-DD.']
  if (input.title === undefined) problems.title = ['Judul wajib diisi.']
  const values = await cleanItem(tx, projectId, input, problems)
  checkVendor(values, { vendor_id: null, vendor_amount_minor: null }, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'ITIN-')
  const cols = ['id', 'project_id', ...Object.keys(values)]
  await tx.query(`insert into itinerary_items (${cols.join(', ')}, changed_by_api_at) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, now())`,
    [id, projectId, ...Object.values(values)])
  await recordAudit(tx, { action: 'itinerary_item.created', actorUserId: actor.userId, entityType: 'itinerary_item', entityId: id, requestId, after: { projectId, ...values } })
  return { id }
}

async function lockItem(tx: Queryable, id: string) {
  const [row] = await tx.query<{ project_id: string; vendor_id: string | null; vendor_amount_minor: string | null }>(
    'select project_id, vendor_id, vendor_amount_minor::text as vendor_amount_minor from itinerary_items where id = $1 for update', [id])
  if (!row) throw errors.notFound('Item itinerary')
  return row
}

export async function updateItineraryItem(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const current = await lockItem(tx, id)
  const problems: FieldErrors = {}
  const values = await cleanItem(tx, current.project_id, input, problems)
  checkVendor(values, current, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update itinerary_items set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'itinerary_item.updated', actorUserId: actor.userId, entityType: 'itinerary_item', entityId: id, requestId, after: values })
}

export async function deleteItineraryItem(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const current = await lockItem(tx, id)
  await tx.query('delete from itinerary_items where id = $1', [id])
  await recordAudit(tx, { action: 'itinerary_item.deleted', actorUserId: actor.userId, entityType: 'itinerary_item', entityId: id, requestId, before: { projectId: current.project_id } })
}
```

`itinerary-routes.ts` — sama dengan pola `traveler-routes.ts` (readActor, visibleProject, projectQuery), CAP
`'project-order.manage-operations'`, create memakai `withIdempotency` route `'POST /projects/:id/itinerary-items'`,
respons = `listItineraryItems(db, { id })[0]`; delete → `{ id, deleted: true }`.

- [ ] **Step 4:** `bun test test/itinerary.test.ts` → PASS; `bun run test` dan `bun run typecheck` hijau.
- [ ] **Step 5:** commit `feat(core): API item itinerary harian (S7b)`.

### Task 3: Seed demo itinerary

**Files:**
- Modify: `backend/scripts/extract-demo-core.ts` (`itineraryItems` dari `ITINERARY_ITEMS`), `backend/src/db/seeds/demo-core.json` (regenerate `bun run seed:extract`), `backend/src/db/seed-demo.ts` (tipe + upsert setelah blok kamar S7a)
- Test: `backend/test/db.test.ts`

- [ ] **Step 1: test gagal**

```ts
  test('demo itinerary items are seeded; a re-seed keeps API edits', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      expect((await db.query<{ n: number }>('select count(*)::int as n from itinerary_items'))[0]!.n).toBe(42)
      await db.query("update itinerary_items set title = 'Diubah', changed_by_api_at = now() where id = 'ITIN-1031'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      expect((await db.query<{ t: string }>("select title as t from itinerary_items where id = 'ITIN-1031'"))[0]!.t).toBe('Diubah')
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** FAIL (0 item).
- [ ] **Step 3:** extract: `itineraryItems: [...ITINERARY_ITEMS].sort(byId).map(i => ({ id, projectId, date: i.date, time: i.time ?? null, title, description ?? null, serviceType ?? null, groupId ?? null, timezone ?? null, location ?? null, visibleToClient: i.visibleToClient !== false, vendorId ?? null, vendorAmountMinor: i.vendorAmountIdr == null ? null : String(Math.round(i.vendorAmountIdr)) }))`; seed:

```ts
    // S7b: daily itinerary items. A re-seed refreshes fixture rows the API never changed.
    const ITINERARY_COLUMNS = ['date', 'time', 'title', 'description', 'service_type', 'group_id', 'timezone', 'location', 'visible_to_client', 'vendor_id', 'vendor_amount_minor'] as const
    for (const i of seed.itineraryItems ?? []) {
      await tx.query(
        `insert into itinerary_items (id, project_id, ${ITINERARY_COLUMNS.join(', ')}, provenance)
         values ($1, $2, ${ITINERARY_COLUMNS.map((_, n) => `$${n + 3}`).join(', ')}, $${ITINERARY_COLUMNS.length + 3})
         on conflict (id) do update set ${ITINERARY_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where itinerary_items.provenance = 'demo-fixture' and itinerary_items.changed_by_api_at is null`,
        [i.id, i.projectId, i.date, i.time, i.title, i.description, i.serviceType, i.groupId, i.timezone, i.location, i.visibleToClient, i.vendorId, i.vendorAmountMinor, P]
      )
    }
```

- [ ] **Step 4:** PASS; `bun run test` hijau.
- [ ] **Step 5:** commit `feat(core): seed itinerary demo (S7b)`.

### Task 4: Frontend sync + API client

**Files:**
- Modify: `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts` (namespace `core`)
- Create: `frontend/app/data/itinerary-sync.ts`, `frontend/app/data/itinerary-sync.test.ts`
- Modify: `frontend/app/layouts/dashboard.vue`, `frontend/app/pages/settings.vue` (muat/ulang)

**Produces:** `itineraryItemFromServer(d)`, `mergeServerItinerary(list)`, `loadServerItinerary(api)`,
`itineraryInput(patch)` (vendorAmountIdr → vendorAmountMinor), `createItineraryItemOnServer(api, projectId, input, key?)`,
`updateItineraryItemOnServer(api, id, input)`, `deleteItineraryItemOnServer(api, id)`, `useItinerarySync()`.

Tipe:

```ts
export interface ItineraryItemDto {
  id: string; projectId: string; date: string; time: string | null; title: string; description: string | null
  serviceType: ServiceTypeKey | null; groupId: string | null; timezone: string | null; location: string | null
  visibleToClient: boolean; vendorId: string | null; vendorAmountMinor: string | null
}
export type ItineraryItemInput = Partial<{ date: string; time: string | null; title: string; description: string | null; serviceType: ServiceTypeKey | null;
  groupId: string | null; timezone: string | null; location: string | null; visibleToClient: boolean; vendorId: string | null; vendorAmountMinor: string | null }>
```

- [ ] **Step 1: test gagal** `itinerary-sync.test.ts`: mapping null→undefined & `vendorAmountMinor '500000'` → `vendorAmountIdr 500000`; merge menjaga identitas objek dan membuang item yang tidak ada; `itineraryInput({ vendorAmountIdr: 1500.4, time: undefined })` → `{ vendorAmountMinor: '1500', time: null }`; create menambah item; delete menghapus; update yang ditolak API tidak mengubah item lokal.
- [ ] **Step 2:** `pnpm vitest run app/data/itinerary-sync.test.ts` → FAIL.
- [ ] **Step 3:** implementasi (pola `travelers-sync.ts`).
- [ ] **Step 4:** PASS; `pnpm test` hijau.
- [ ] **Step 5:** commit `feat(frontend): sinkron item itinerary dari server (S7b)`.

### Task 5: Layar menulis ke server + guard

**Files:**
- Modify: `frontend/app/pages/project-orders/[id]/index.vue` (toggle, submit, hapus → `*OnServer`, flag `isSavingItinerary`, tombol disabled), `frontend/app/components/operations/BookingCalendarPanel.vue` (`submitAddEvent` async), `frontend/app/no-local-sales.test.ts` (FORBIDDEN + `createItineraryItem(`, `updateItineraryItem(`, `removeItineraryItem(`)
- Modify: `frontend/app/data/index.ts` — komentar mutator lokal: hanya untuk portal/tes.

- [ ] **Step 1:** tambah nama ke FORBIDDEN → `pnpm vitest run app/no-local-sales.test.ts` FAIL di 2 file.
- [ ] **Step 2:** rewire kedua file; payload form dikirim lewat `itineraryInput` (field kosong → `null` saat edit agar bisa mengosongkan).
- [ ] **Step 3:** guard PASS; `pnpm test` hijau; vue-tsc ≤ 2000; eslint per file tidak naik.
- [ ] **Step 4:** commit `feat(frontend): itinerary project order & kalender menulis ke server (S7b)`.

### Task 6: Dokumentasi + verifikasi akhir

- Modify: ADR-004 (catatan S7b), spec status "diimplementasikan", memory progress.
- Smoke test API pada salinan DB (port 3100): login admin, POST/PATCH/DELETE item, finance 403.
- `pnpm build` (background) OK.
- Commit `docs: catatan S7b itinerary di ADR-004`.
