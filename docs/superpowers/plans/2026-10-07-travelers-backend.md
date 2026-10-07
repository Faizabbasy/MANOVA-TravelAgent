# Peserta (traveler, grup, rooming) lewat API (S7a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traveler, grup traveler, dan rooming list milik server; konfirmasi DP Group Trip membuat traveler otomatis, batal order membatalkan traveler-nya; tab peserta project order memakai server.

**Architecture:** Migrasi 0027 (`traveler_groups`, `travelers`, `room_assignments`). Modul `backend/src/modules/core/travelers.ts` (baca + tulis + hook order) dan `core/traveler-routes.ts` (Elysia baru, didaftarkan di `app.ts`). Hook dipanggil dari `finance/group-trip.ts` (DP) dan `sales/sales-orders.ts` (batal). Frontend `data/travelers-sync.ts`; tab peserta di `pages/project-orders/[id]/index.vue` dialihkan.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (`backend/`), Nuxt 4 + Vue 3 + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-07-travelers-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/` (jalankan pnpm **dari `frontend/`**); jangan tambah lockfile.
- Pola tulis S0: capability → validasi 400 (Indonesia) / 422 `RULE_VIOLATION` → perubahan + `recordAudit` satu transaksi → respons = bentuk GET. Create pakai `withIdempotency` + `requireIdempotencyKey`.
- Tulis: `project-order.manage-travelers` (admin; super-admin lolos). Baca: peran internal (data lengkap); portal (`isPortalActor`) 403.
- ID dari `nextId(q, prefix)`; seed memanggil `syncIdSequences`.
- JSON ke SQL: `$n::text::jsonb` + `JSON.stringify`. File CRLF: Edit tool; tulis file berisi regex/backtick/`$n` lewat Write tool, bukan heredoc/perl.
- Test backend `bun run test`; filter `bun test --timeout 30000 test/<file> -t "<nama>"`.
- Frontend: vue-tsc total ≤ 2000 (baseline 1983); lint per file tidak bertambah vs HEAD; tanpa `void`; API palsu `Promise.resolve/reject`.
- Commit tiap task, jangan push. Backend dev (port 3000) mati sendiri saat ada migrasi baru — nyalakan lagi di Task 7.

## Rulings dari spec (saat menulis plan)

1. **Prefix grup `GRP-`** (bukan `TG-` seperti spec): fixture memakai `GRP-001…`; ID harus sama dengan frontend/deep link.
2. **`changed_by_api_at` di ketiga tabel** (spec: hanya traveler; grup/kamar pakai `updated_at = created_at`): satu pola yang sama untuk seed — seed hanya memperbarui baris fixture yang belum pernah diubah API.
3. **UI VIP / batal / ganti / rooming hanya ada di portal client** (`pages/client/participants/**`, `components/client/ParticipantsListPanel.vue`, disembunyikan ADR-006). Endpoint server dibuat lengkap sesuai spec dan fungsi sync tersedia, tetapi portal tetap lokal dan dikecualikan dari guard. Layar internal (project order) memakai: tambah, ubah, hapus, verifikasi, buat grup, impor commit, dan muat ulang setelah DP.
4. **`markGroupTripOrderPaid` dihapus** (fungsi + test `group-trip-orders.test.ts`): traveler dibuat server saat DP; halaman memuat ulang traveler project setelah DP.

## Review Focus

1. Konfirmasi DP yang di-replay (Idempotency-Key sama) atau dua kali (invoice lama di-void lalu DP ulang) → traveler order tidak dobel.
2. Traveler yang dibatalkan masih ada di kamar → keluar dari kamar; memasukkannya kembali ke kamar → 422.
3. Mengisi kamar dengan traveler yang sedang di kamar lain → pindah, tidak tercatat di dua kamar.
4. Impor dengan dua baris paspor sama dalam satu batch → baris kedua ditolak, baris pertama dibuat.
5. Seed ulang setelah pengguna mengubah TRV-1012 → perubahan pengguna tetap.

Tes: (1) Task 4, (2)(3)(4) Task 3, (5) Task 5.

---

### Task 1: Migrasi 0027 + prefix

**Files:**
- Create: `backend/migrations/0027_travelers.up.sql`, `.down.sql`
- Modify: `backend/src/shared/ids.ts`
- Test: `backend/test/db.test.ts`

- [ ] **Step 1: Test gagal** (describe `demo seed`):

```ts
  test('travelers, groups and rooms exist after 0027', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into traveler_groups (id, project_id, name) values ('GRP-T1', 'PRJ-101', 'Tim A')")
      await db.query("insert into travelers (id, project_id, group_id, name) values ('TRV-T1', 'PRJ-101', 'GRP-T1', 'Uji')")
      await expect(db.query("insert into travelers (id, project_id, name, cancelled) values ('TRV-T2', 'PRJ-101', 'Uji', true)")).rejects.toThrow() // cancel needs a reason
      await db.query("insert into room_assignments (id, project_id, group_id, room_label, room_type, traveler_ids) values ('ROOM-T1', 'PRJ-101', 'GRP-T1', 'Twin 1', 'twin', '[\"TRV-T1\"]')")
      await expect(db.query("insert into room_assignments (id, project_id, group_id, room_label, room_type) values ('ROOM-T2', 'PRJ-101', 'GRP-T1', 'X', 'villa')")).rejects.toThrow()
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('GRP-','TRV-','ROOM-') order by prefix")
      expect(seqs.map(s => s.prefix)).toEqual(['GRP-', 'ROOM-', 'TRV-'])
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `bun test --timeout 30000 test/db.test.ts -t "0027"` → FAIL (relasi tidak ada).

- [ ] **Step 3: up.sql**

```sql
-- S7a: travelers, traveler groups and rooming list (API-owned). changed_by_api_at keeps demo re-seeds off user edits.
create table traveler_groups (
  id                text primary key check (id <> ''),
  project_id        text not null references projects (id),
  name              text not null check (name <> ''),
  pax_count         integer not null default 0 check (pax_count >= 0),
  rooming_note      text,
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index traveler_groups_project on traveler_groups (project_id);

create table travelers (
  id                     text primary key check (id <> ''),
  project_id             text not null references projects (id),
  group_id               text references traveler_groups (id),
  party_id               text references parties (id),
  lead_id                text references leads (id),
  sales_order_id         text references sales_order_refs (id),
  name                   text not null check (name <> ''),
  passport_number        text,
  passport_expiry_date   date,
  id_number              text,
  visa_number            text,
  visa_expiry_date       date,
  emergency_contact_name  text,
  emergency_contact_phone text,
  special_request        text,
  dietary_restrictions   text,
  accessibility_needs    text,
  companion_of           text references travelers (id),
  documents_verified_on  date,
  documents_verified_by  text references users (id),
  is_vip                 boolean not null default false,
  cancelled              boolean not null default false,
  cancel_reason          text,
  replaced_by            text references travelers (id),
  replaces               text references travelers (id),
  changed_by_api_at      timestamptz,
  provenance             text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (cancelled = (cancel_reason is not null))
);
create index travelers_project on travelers (project_id);
create index travelers_sales_order on travelers (sales_order_id) where sales_order_id is not null;

create table room_assignments (
  id                text primary key check (id <> ''),
  project_id        text not null references projects (id),
  group_id          text not null references traveler_groups (id),
  room_label        text not null check (room_label <> ''),
  room_type         text not null check (room_type in ('single', 'twin', 'suite')),
  traveler_ids      jsonb not null default '[]'::jsonb check (jsonb_typeof(traveler_ids) = 'array'),
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index room_assignments_project on room_assignments (project_id);

insert into id_sequences (prefix, last_value) values ('GRP-', 0), ('TRV-', 0), ('ROOM-', 0) on conflict (prefix) do nothing;
```

down.sql:

```sql
delete from id_sequences where prefix in ('GRP-', 'TRV-', 'ROOM-');
drop table if exists room_assignments;
drop table if exists travelers;
drop table if exists traveler_groups;
```

- [ ] **Step 4: ids.ts** — `IdPrefix` + `'GRP-' | 'TRV-' | 'ROOM-'`; `SOURCES` + `'GRP-': { table: 'traveler_groups' }, 'TRV-': { table: 'travelers' }, 'ROOM-': { table: 'room_assignments' }`.
- [ ] **Step 5:** test → PASS; `bun run typecheck`.
- [ ] **Step 6:** Commit `feat(core): migrasi 0027 traveler, grup & rooming (S7a)`.

---

### Task 2: Traveler & grup — baca, tambah, ubah, hapus, verifikasi, VIP

**Files:**
- Create: `backend/src/modules/core/travelers.ts`, `backend/src/modules/core/traveler-routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/test/travelers.test.ts` (baru)

**Interfaces:**
- Produces (`travelers.ts`):
  - `listTravelers(db, filter?: { id?: string; projectId?: string }): Promise<TravelerView[]>`; `TravelerView = { id, projectId, groupId, partyId, leadId, salesOrderId, name, passportNumber, passportExpiryDate, idNumber, visaNumber, visaExpiryDate, emergencyContactName, emergencyContactPhone, specialRequest, dietaryRestrictions, accessibilityNeeds, companionOfTravelerId, documentsVerifiedOn, documentsVerifiedBy, isVip: boolean, cancelled: boolean, cancelReason, replacedByTravelerId, replacesTravelerId }` (kosong = `null`)
  - `listTravelerGroups(db, projectId?)`: `{ id, projectId, name, paxCount, roomingNote }[]`; `listRoomAssignments(db, projectId?)`: `{ id, projectId, groupId, roomLabel, roomType, travelerIds: string[] }[]`
  - `createTraveler(tx, actor, projectId, input, requestId): Promise<{ id }>`, `updateTraveler(tx, actor, id, input, requestId)`, `deleteTraveler(tx, actor, id, requestId)`, `setVerified(tx, actor, id, verified: unknown, today, requestId)`, `setVip(tx, actor, id, isVip: unknown, requestId)`
  - `createGroup(tx, actor, projectId, input, requestId): Promise<{ id }>`, `updateGroup(tx, actor, id, input, requestId)`
  - `removeFromRooms(tx, projectId, travelerId)` (dipakai Task 3/4)
- Routes (`traveler-routes.ts`, prefix `/api/v1`): `GET /travelers`, `GET /travelers/:id`, `POST /projects/:id/travelers`, `PATCH /travelers/:id`, `DELETE /travelers/:id`, `POST /travelers/:id/verify`, `POST /travelers/:id/vip`, `GET /traveler-groups`, `POST /projects/:id/traveler-groups`, `PATCH /traveler-groups/:id`, `GET /room-assignments`.

- [ ] **Step 1: Test gagal** — `backend/test/travelers.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S7a: travelers, groups and rooming list through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s7a-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('travelers', () => {
  test('internal roles read full identity data; portals 403; anonymous 401; unknown 404', async () => {
    const list = await call('GET', '/travelers?projectId=PRJ-101', 'finance')
    expect(list.status).toBe(200)
    expect((list.json.data as { id: string; passportNumber: string }[]).find(x => x.id === 'TRV-1011')!.passportNumber).toBe('B1234561')
    expect((await call('GET', '/travelers', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/travelers')).status).toBe(401)
    expect((await call('GET', '/travelers/TRV-999', 'admin')).status).toBe(404)
    expect((await call('GET', '/traveler-groups?projectId=PRJ-103', 'admin')).json.data).toHaveLength(3)
    expect((await call('GET', '/room-assignments?projectId=PRJ-103', 'admin')).json.data).toHaveLength(3)
  })

  test('create (idempotent, validation), patch, verify, vip; finance 403 on writes', async () => {
    const k = key()
    const body = { name: 'Peserta Baru S7a', groupId: 'GRP-001', passportNumber: 'X1', passportExpiryDate: '2030-01-01' }
    const res = await call('POST', '/projects/PRJ-103/travelers', 'admin', body, k)
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', groupId: 'GRP-001', cancelled: false, isVip: false })
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', body, k)).json.data.id).toBe(id)
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: '' }, key())).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: 'X', groupId: 'GRP-004' }, key())).status).toBe(400) // other project's group
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: 'X', passportExpiryDate: '01-01-2030' }, key())).status).toBe(400)
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { dietaryRestrictions: 'Halal', companionOfTravelerId: 'TRV-1031' })).json.data).toMatchObject({ dietaryRestrictions: 'Halal', companionOfTravelerId: 'TRV-1031' })
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { salesOrderId: 'SLO-006' })).status).toBe(400)
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { companionOfTravelerId: 'TRV-1011' })).status).toBe(400) // other project
    const verified = (await call('POST', `/travelers/${id}/verify`, 'admin', { verified: true })).json.data
    expect(verified.documentsVerifiedOn).toBeTruthy()
    expect(verified.documentsVerifiedBy).toBeTruthy()
    expect((await call('POST', `/travelers/${id}/verify`, 'admin', { verified: false })).json.data.documentsVerifiedOn).toBeNull()
    expect((await call('POST', `/travelers/${id}/vip`, 'admin', { isVip: true })).json.data.isVip).toBe(true)
    expect((await call('POST', '/projects/PRJ-103/travelers', 'finance', body, key())).status).toBe(403)
  })

  test('delete is for input mistakes only: a booking traveler is refused; deleting leaves no room entry', async () => {
    const id = (await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: 'Salah Input' }, key())).json.data.id as string
    await call('PUT', '/room-assignments/ROOM-001/travelers', 'admin', { travelerIds: ['TRV-1032', 'TRV-1033', id] })
    expect((await call('DELETE', `/travelers/${id}`, 'admin')).status).toBe(200)
    expect((await call('GET', '/room-assignments?projectId=PRJ-103', 'admin')).json.data.find((r: { id: string }) => r.id === 'ROOM-001').travelerIds).not.toContain(id)
    const booked = (await call('GET', '/travelers?projectId=PRJ-205', 'admin')).json.data.find((x: { salesOrderId: string | null }) => x.salesOrderId)
    expect((await call('DELETE', `/travelers/${booked.id}`, 'admin')).status).toBe(422)
  })

  test('groups: create and patch; name required', async () => {
    const g = (await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: 'Rombongan S7a' }, key())).json.data
    expect(g).toMatchObject({ projectId: 'PRJ-101', name: 'Rombongan S7a', paxCount: 0 })
    expect((await call('PATCH', `/traveler-groups/${g.id}`, 'admin', { paxCount: 4, roomingNote: '2 twin' })).json.data).toMatchObject({ paxCount: 4, roomingNote: '2 twin' })
    expect((await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: ' ' }, key())).status).toBe(400)
  })
})
```

Test ini membutuhkan fixture peserta di seed (Task 5) dan `PUT /room-assignments/:id/travelers` (Task 3). Sampai Task 5 seluruh `describe('travelers')` ditandai `describe.skip` kecuali test sementara di bawah (dihapus di Task 5):

```ts
describe('travelers (empty)', () => {
  test('reads answer for internal roles, 403 for portals, 401 anonymous; create, patch, verify, vip, group', async () => {
    expect((await call('GET', '/travelers', 'finance')).status).toBe(200)
    expect((await call('GET', '/travelers', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/travelers')).status).toBe(401)
    const g = (await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: 'Grup Uji' }, key())).json.data.id as string
    const res = await call('POST', '/projects/PRJ-101/travelers', 'admin', { name: 'Uji S7a', groupId: g }, key())
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { specialRequest: 'Kursi lorong' })).json.data.specialRequest).toBe('Kursi lorong')
    expect((await call('POST', `/travelers/${id}/verify`, 'admin', { verified: true })).json.data.documentsVerifiedOn).toBeTruthy()
    expect((await call('POST', `/travelers/${id}/vip`, 'admin', { isVip: true })).json.data.isVip).toBe(true)
    expect((await call('DELETE', `/travelers/${id}`, 'admin')).status).toBe(200)
    expect((await call('GET', `/travelers/${id}`, 'admin')).status).toBe(404)
    expect((await call('POST', '/projects/PRJ-101/travelers', 'finance', { name: 'X' }, key())).status).toBe(403)
  })
})
```

- [ ] **Step 2:** `bun test --timeout 30000 test/travelers.test.ts` → FAIL (404 rute).

- [ ] **Step 3: `travelers.ts`** (bagian Task 2):

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'

/**
 * Travelers, traveler groups and the rooming list (S7a). Delete corrects an input mistake; cancel is the business
 * decision (soft, with a reason). Booking travelers (Group Trip) are created by the DP confirmation and cancelled
 * with their order. A traveler sits in at most one room per project.
 */

export const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

export async function listTravelers(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, group_id, party_id, lead_id, sales_order_id, name, passport_number, passport_expiry_date::text as passport_expiry_date,
            id_number, visa_number, visa_expiry_date::text as visa_expiry_date, emergency_contact_name, emergency_contact_phone, special_request,
            dietary_restrictions, accessibility_needs, companion_of, documents_verified_on::text as documents_verified_on, documents_verified_by,
            is_vip, cancelled, cancel_reason, replaced_by, replaces
       from travelers where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) order by id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    groupId: str(r.group_id),
    partyId: str(r.party_id),
    leadId: str(r.lead_id),
    salesOrderId: str(r.sales_order_id),
    name: r.name as string,
    passportNumber: str(r.passport_number),
    passportExpiryDate: str(r.passport_expiry_date),
    idNumber: str(r.id_number),
    visaNumber: str(r.visa_number),
    visaExpiryDate: str(r.visa_expiry_date),
    emergencyContactName: str(r.emergency_contact_name),
    emergencyContactPhone: str(r.emergency_contact_phone),
    specialRequest: str(r.special_request),
    dietaryRestrictions: str(r.dietary_restrictions),
    accessibilityNeeds: str(r.accessibility_needs),
    companionOfTravelerId: str(r.companion_of),
    documentsVerifiedOn: str(r.documents_verified_on),
    documentsVerifiedBy: str(r.documents_verified_by),
    isVip: r.is_vip as boolean,
    cancelled: r.cancelled as boolean,
    cancelReason: str(r.cancel_reason),
    replacedByTravelerId: str(r.replaced_by),
    replacesTravelerId: str(r.replaces)
  }))
}

export type TravelerView = Awaited<ReturnType<typeof listTravelers>>[number]

export async function listTravelerGroups(db: Queryable, projectId?: string) {
  const rows = await db.query<{ id: string; project_id: string; name: string; pax_count: number; rooming_note: string | null }>(
    'select id, project_id, name, pax_count, rooming_note from traveler_groups where ($1::text is null or project_id = $1) order by id', [projectId ?? null])
  return rows.map(r => ({ id: r.id, projectId: r.project_id, name: r.name, paxCount: Number(r.pax_count), roomingNote: r.rooming_note }))
}

export async function listRoomAssignments(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<{ id: string; project_id: string; group_id: string; room_label: string; room_type: string; traveler_ids: string[] }>(
    `select id, project_id, group_id, room_label, room_type, traveler_ids from room_assignments
      where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) order by id`, [filter.id ?? null, filter.projectId ?? null])
  return rows.map(r => ({ id: r.id, projectId: r.project_id, groupId: r.group_id, roomLabel: r.room_label, roomType: r.room_type, travelerIds: r.traveler_ids }))
}

/** API field → column for the editable traveler profile. */
const PROFILE: Record<string, { column: string; kind: 'text' | 'date' | 'group' | 'companion' }> = {
  name: { column: 'name', kind: 'text' },
  groupId: { column: 'group_id', kind: 'group' },
  passportNumber: { column: 'passport_number', kind: 'text' },
  passportExpiryDate: { column: 'passport_expiry_date', kind: 'date' },
  idNumber: { column: 'id_number', kind: 'text' },
  visaNumber: { column: 'visa_number', kind: 'text' },
  visaExpiryDate: { column: 'visa_expiry_date', kind: 'date' },
  emergencyContactName: { column: 'emergency_contact_name', kind: 'text' },
  emergencyContactPhone: { column: 'emergency_contact_phone', kind: 'text' },
  specialRequest: { column: 'special_request', kind: 'text' },
  dietaryRestrictions: { column: 'dietary_restrictions', kind: 'text' },
  accessibilityNeeds: { column: 'accessibility_needs', kind: 'text' },
  companionOfTravelerId: { column: 'companion_of', kind: 'companion' }
}

export async function cleanProfile(tx: Queryable, projectId: string, input: Record<string, unknown>, problems: FieldErrors, selfId?: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(PROFILE)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null || v === '') {
      if (field === 'name') problems.name = ['Nama traveler wajib diisi.']
      else out[spec.column] = null
      continue
    }
    if (spec.kind === 'text') {
      if (typeof v !== 'string' || v.trim().length > 500) problems[field] = ['Harus teks, maksimal 500 karakter.']
      else if (!v.trim() && field === 'name') problems.name = ['Nama traveler wajib diisi.']
      else out[spec.column] = v.trim() || null
    } else if (spec.kind === 'date') {
      if (typeof v !== 'string' || !isIsoDate(v)) problems[field] = ['Tanggal harus format YYYY-MM-DD.']
      else out[spec.column] = v
    } else {
      const table = spec.kind === 'group' ? 'traveler_groups' : 'travelers'
      const ok = typeof v === 'string' && ID_PATTERN.test(v) && v !== selfId &&
        (await tx.query(`select 1 from ${table} where id = $1 and project_id = $2`, [v, projectId])).length > 0
      if (!ok) problems[field] = [spec.kind === 'group' ? 'Grup tidak ditemukan di project ini.' : 'Traveler pendamping tidak ditemukan di project ini.']
      else out[spec.column] = v
    }
  }
  return out
}

export async function insertTraveler(tx: Queryable, projectId: string, values: Record<string, unknown>, links: { partyId?: string | null; leadId?: string | null; salesOrderId?: string | null; replaces?: string | null } = {}): Promise<string> {
  const id = await nextId(tx, 'TRV-')
  const cols = ['id', 'project_id', 'party_id', 'lead_id', 'sales_order_id', 'replaces', ...Object.keys(values)]
  const vals = [id, projectId, links.partyId ?? null, links.leadId ?? null, links.salesOrderId ?? null, links.replaces ?? null, ...Object.values(values)]
  await tx.query(`insert into travelers (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals)
  return id
}

export async function createTraveler(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama traveler wajib diisi.']
  const values = await cleanProfile(tx, projectId, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await insertTraveler(tx, projectId, values)
  await recordAudit(tx, { action: 'traveler.created', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: { projectId, name: values.name } })
  return { id }
}

const FORBIDDEN = ['id', 'projectId', 'partyId', 'leadId', 'salesOrderId', 'cancelled', 'cancelReason', 'replacedByTravelerId', 'replacesTravelerId', 'documentsVerifiedOn', 'documentsVerifiedBy', 'isVip']

export async function lockTraveler(tx: Queryable, id: string) {
  const [row] = await tx.query<{ id: string; project_id: string; cancelled: boolean; sales_order_id: string | null; replaced_by: string | null; replaces: string | null; group_id: string | null }>(
    'select id, project_id, cancelled, sales_order_id, replaced_by, replaces, group_id from travelers where id = $1 for update', [id])
  if (!row) throw errors.notFound('Traveler')
  return row
}

export async function updateTraveler(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  for (const k of FORBIDDEN) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat edit traveler.']
  const current = await lockTraveler(tx, id)
  const values = await cleanProfile(tx, current.project_id, input, problems, id)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (current.cancelled) throw rule('Traveler ini sudah dibatalkan.')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update travelers set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`, [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'traveler.updated', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: values })
}

export async function removeFromRooms(tx: Queryable, projectId: string, travelerId: string) {
  await tx.query(
    `update room_assignments set traveler_ids = traveler_ids - $2, changed_by_api_at = now(), updated_at = now()
      where project_id = $1 and traveler_ids ? $2`, [projectId, travelerId])
}

export async function deleteTraveler(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const current = await lockTraveler(tx, id)
  if (current.sales_order_id || current.replaced_by || current.replaces) throw rule('Traveler ini bagian dari booking atau penggantian — batalkan, jangan hapus.')
  await removeFromRooms(tx, current.project_id, id)
  await tx.query('update travelers set companion_of = null where companion_of = $1', [id])
  await tx.query('delete from travelers where id = $1', [id])
  await recordAudit(tx, { action: 'traveler.deleted', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, before: { projectId: current.project_id } })
}

export async function setVerified(tx: Queryable, actor: Actor, id: string, verified: unknown, today: string, requestId: string) {
  if (typeof verified !== 'boolean') throw errors.validation({ verified: ['Harus ya/tidak.'] })
  await lockTraveler(tx, id)
  await tx.query('update travelers set documents_verified_on = $2, documents_verified_by = $3, changed_by_api_at = now(), updated_at = now() where id = $1',
    [id, verified ? today : null, verified ? actor.userId : null])
  await recordAudit(tx, { action: verified ? 'traveler.verified' : 'traveler.unverified', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId })
}

export async function setVip(tx: Queryable, actor: Actor, id: string, isVip: unknown, requestId: string) {
  if (typeof isVip !== 'boolean') throw errors.validation({ isVip: ['Harus ya/tidak.'] })
  await lockTraveler(tx, id)
  await tx.query('update travelers set is_vip = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, isVip])
  await recordAudit(tx, { action: 'traveler.vip_set', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: { isVip } })
}

function groupValues(input: Record<string, unknown>, problems: FieldErrors, requireName: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.name !== undefined || requireName) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) problems.name = ['Nama grup wajib diisi.']
    else out.name = name.slice(0, 200)
  }
  if (input.paxCount !== undefined) {
    if (!Number.isInteger(input.paxCount) || (input.paxCount as number) < 0) problems.paxCount = ['Jumlah pax harus angka ≥ 0.']
    else out.pax_count = input.paxCount
  }
  if (input.roomingNote !== undefined) {
    out.rooming_note = typeof input.roomingNote === 'string' && input.roomingNote.trim() ? input.roomingNote.trim().slice(0, 500) : null
  }
  return out
}

export async function createGroup(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const values = groupValues(input, problems, true)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'GRP-')
  const cols = ['id', 'project_id', ...Object.keys(values)]
  await tx.query(`insert into traveler_groups (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, [id, projectId, ...Object.values(values)])
  await recordAudit(tx, { action: 'traveler_group.created', actorUserId: actor.userId, entityType: 'traveler_group', entityId: id, requestId, after: { projectId, ...values } })
  return { id }
}

export async function updateGroup(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const values = groupValues(input, problems, false)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [g] = await tx.query<{ id: string }>('select id from traveler_groups where id = $1 for update', [id])
  if (!g) throw errors.notFound('Grup')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update traveler_groups set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`, [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'traveler_group.updated', actorUserId: actor.userId, entityType: 'traveler_group', entityId: id, requestId, after: values })
}
```

- [ ] **Step 4: `traveler-routes.ts`**

```ts
import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { getProject } from './repository'
import { isPortalActor } from './scope'
import {
  createGroup, createTraveler, deleteTraveler, listRoomAssignments, listTravelerGroups, listTravelers, setVerified, setVip, updateGroup, updateTraveler
} from './travelers'

/** Travelers, groups and rooming (S7a). Internal roles read everything; `project-order.manage-travelers` writes. */
export function travelerRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'project-order.manage-travelers' as const

  async function readActor(request: Request): Promise<SessionActor> {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }

  async function visibleProject(actor: SessionActor, raw: string) {
    const id = assertIdParam(raw, 'Project')
    if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
    return id
  }

  const projectQuery = (projectId?: string) => {
    if (projectId && !ID_PATTERN.test(projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
    return projectId
  }

  async function travelerResponse(id: string) {
    const [tr] = await listTravelers(db, { id })
    if (!tr) throw errors.notFound('Traveler')
    return tr
  }

  async function groupResponse(id: string) {
    const g = (await listTravelerGroups(db)).find(x => x.id === id)
    if (!g) throw errors.notFound('Grup')
    return g
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/travelers', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listTravelers(db, { projectId: projectQuery(query.projectId) }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .get('/travelers/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await travelerResponse(assertIdParam(params.id, 'Traveler')))
    })
    .post('/projects/:id/travelers', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/travelers', key, body: { projectId, ...(body as object) } }, tx =>
        createTraveler(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await travelerResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/travelers/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => updateTraveler(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .delete('/travelers/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => deleteTraveler(tx, actor, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
    .post('/travelers/:id/verify', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => setVerified(tx, actor, id, (body as Record<string, unknown> | undefined)?.verified, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/travelers/:id/vip', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => setVip(tx, actor, id, (body as Record<string, unknown> | undefined)?.isVip, requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/traveler-groups', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listTravelerGroups(db, projectQuery(query.projectId)))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/traveler-groups', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/traveler-groups', key, body: { projectId, ...(body as object) } }, tx =>
        createGroup(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await groupResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/traveler-groups/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Grup')
      await db.transaction(tx => updateGroup(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await groupResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/room-assignments', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listRoomAssignments(db, { projectId: projectQuery(query.projectId) }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
}
```

`app.ts`: `import { travelerRoutes } from './modules/core/traveler-routes'` dan `.use(travelerRoutes(deps, auth))` setelah `coreRoutes`. Bila `withIdempotency` menolak replay karena `body` route berbeda (S6a pelajaran), kirim body identik di test.

- [ ] **Step 5:** test `travelers (empty)` → PASS; typecheck.
- [ ] **Step 6:** Commit `feat(core): traveler & grup — baca, tambah, ubah, hapus, verifikasi, VIP (S7a)`.

---

### Task 3: Batal, ganti peserta, rooming, impor

**Files:**
- Modify: `backend/src/modules/core/travelers.ts`, `backend/src/modules/core/traveler-routes.ts`
- Test: `backend/test/travelers.test.ts`

**Interfaces:**
- Produces: `cancelTraveler(tx, actor, id, reason: unknown, requestId)`, `replaceTraveler(tx, actor, id, input, requestId): Promise<{ id: string }>` (id baru), `createRoom(tx, actor, projectId, input, requestId): Promise<{ id }>`, `setRoomTravelers(tx, actor, roomId, travelerIds: unknown, requestId)`, `deleteRoom(tx, actor, roomId, requestId)`, `importTravelers(tx, actor, projectId, rows: unknown, requestId): Promise<{ created: string[]; rejected: { index: number; errors: string[] }[] }>`.
- Routes: `POST /travelers/:id/cancel`, `POST /travelers/:id/replace`, `POST /projects/:id/room-assignments`, `PUT /room-assignments/:id/travelers`, `DELETE /room-assignments/:id`, `POST /projects/:id/travelers/import`.

- [ ] **Step 1: Test gagal** (tambah ke `travelers.test.ts`, di luar `describe.skip`, membuat datanya sendiri di PRJ-101):

```ts
describe('cancel, replace, rooming, import', () => {
  const setup = async () => {
    const g = (await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: `Grup ${++n}` }, key())).json.data.id as string
    const a = (await call('POST', '/projects/PRJ-101/travelers', 'admin', { name: `A ${n}`, groupId: g, passportNumber: `PA${n}` }, key())).json.data.id as string
    const b = (await call('POST', '/projects/PRJ-101/travelers', 'admin', { name: `B ${n}`, groupId: g }, key())).json.data.id as string
    const room = (await call('POST', '/projects/PRJ-101/room-assignments', 'admin', { groupId: g, roomLabel: 'Twin 9', roomType: 'twin', travelerIds: [a] }, key())).json.data.id as string
    return { g, a, b, room }
  }

  test('rooming: a traveler moves instead of sitting in two rooms; other projects and cancelled travelers are refused', async () => {
    const { g, a, b, room } = await setup()
    const room2 = (await call('POST', '/projects/PRJ-101/room-assignments', 'admin', { groupId: g, roomLabel: 'Twin 10', roomType: 'twin' }, key())).json.data.id as string
    expect((await call('PUT', `/room-assignments/${room2}/travelers`, 'admin', { travelerIds: [a, b] })).json.data.travelerIds).toEqual([a, b])
    const rooms = (await call('GET', '/room-assignments?projectId=PRJ-101', 'admin')).json.data as { id: string; travelerIds: string[] }[]
    expect(rooms.find(r => r.id === room)!.travelerIds).toEqual([])
    expect((await call('PUT', `/room-assignments/${room}/travelers`, 'admin', { travelerIds: ['TRV-1031'] })).status).toBe(400) // other project
    await call('POST', `/travelers/${b}/cancel`, 'admin', { reason: 'Batal ikut' })
    expect((await call('GET', '/room-assignments?projectId=PRJ-101', 'admin')).json.data.find((r: { id: string }) => r.id === room2).travelerIds).toEqual([a])
    expect((await call('PUT', `/room-assignments/${room2}/travelers`, 'admin', { travelerIds: [a, b] })).status).toBe(422)
    expect((await call('DELETE', `/room-assignments/${room2}`, 'admin')).status).toBe(200)
    expect((await call('POST', '/projects/PRJ-101/room-assignments', 'admin', { groupId: g, roomLabel: 'X', roomType: 'villa' }, key())).status).toBe(400)
  })

  test('cancel needs a reason; replace is atomic and takes over the room', async () => {
    const { a, room } = await setup()
    expect((await call('POST', `/travelers/${a}/cancel`, 'admin', {})).status).toBe(400)
    const replaced = await call('POST', `/travelers/${a}/replace`, 'admin', { name: 'Pengganti S7a', passportNumber: 'PZ1' })
    expect(replaced.status).toBe(200)
    const newId = replaced.json.data.id as string
    expect(replaced.json.data).toMatchObject({ replacesTravelerId: a, cancelled: false })
    const old = (await call('GET', `/travelers/${a}`, 'admin')).json.data
    expect(old).toMatchObject({ cancelled: true, replacedByTravelerId: newId })
    expect(old.cancelReason).toContain('Pengganti S7a')
    expect((await call('GET', '/room-assignments?projectId=PRJ-101', 'admin')).json.data.find((r: { id: string }) => r.id === room).travelerIds).toEqual([newId])
    expect((await call('POST', `/travelers/${a}/replace`, 'admin', { name: 'Lagi' })).status).toBe(422)
    expect((await call('POST', `/travelers/${a}/cancel`, 'admin', { reason: 'x' })).status).toBe(422)
    expect((await call('DELETE', `/travelers/${a}`, 'admin')).status).toBe(422)
  })

  test('import validates again: empty name and duplicate passports (existing or in the batch) are rejected', async () => {
    const { a } = await setup()
    const existing = (await call('GET', `/travelers/${a}`, 'admin')).json.data.passportNumber as string
    const res = await call('POST', '/projects/PRJ-101/travelers/import', 'admin', { rows: [
      { name: 'Impor 1', passportNumber: 'IMP-1' },
      { name: '' },
      { name: 'Impor 3', passportNumber: existing },
      { name: 'Impor 4', passportNumber: 'IMP-1' },
      { name: 'Impor 5' }
    ] }, key())
    expect(res.status).toBe(201)
    expect(res.json.data.created).toHaveLength(2)
    expect(res.json.data.rejected.map((r: { index: number }) => r.index)).toEqual([1, 2, 3])
    expect((await call('POST', '/projects/PRJ-101/travelers/import', 'admin', { rows: 'x' }, key())).status).toBe(400)
  })
})
```

- [ ] **Step 2:** `-t "cancel, replace, rooming, import"` → FAIL.

- [ ] **Step 3: `travelers.ts`** — tambah:

```ts
const ROOM_TYPES = ['single', 'twin', 'suite'] as const

export async function cancelTraveler(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if (!reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const current = await lockTraveler(tx, id)
  if (current.cancelled) throw rule('Traveler ini sudah dibatalkan.')
  await tx.query('update travelers set cancelled = true, cancel_reason = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, reason])
  await removeFromRooms(tx, current.project_id, id)
  await recordAudit(tx, { action: 'traveler.cancelled', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, reason })
}

export async function replaceTraveler(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama traveler pengganti wajib diisi.']
  const current = await lockTraveler(tx, id)
  const values = await cleanProfile(tx, current.project_id, { ...input, groupId: undefined }, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (current.cancelled) throw rule('Traveler ini sudah dibatalkan — tidak bisa digantikan.')
  const newId = await insertTraveler(tx, current.project_id, { ...values, group_id: current.group_id }, { replaces: id })
  await tx.query('update travelers set changed_by_api_at = now() where id = $1', [newId])
  await tx.query('update travelers set cancelled = true, cancel_reason = $2, replaced_by = $3, changed_by_api_at = now(), updated_at = now() where id = $1',
    [id, `Digantikan oleh ${values.name as string} (${newId}).`, newId])
  // The replacement takes over the old traveler's room.
  await tx.query(
    `update room_assignments set traveler_ids = (select coalesce(jsonb_agg(case when x = $2 then $3 else x end), '[]'::jsonb) from jsonb_array_elements_text(traveler_ids) as x),
       changed_by_api_at = now(), updated_at = now()
     where project_id = $1 and traveler_ids ? $2`, [current.project_id, id, newId])
  await recordAudit(tx, { action: 'traveler.replaced', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: { replacedBy: newId } })
  return { id: newId }
}

async function cleanRoomTravelers(tx: Queryable, projectId: string, input: unknown, problems: FieldErrors): Promise<string[]> {
  if (!Array.isArray(input) || input.some(x => typeof x !== 'string' || !ID_PATTERN.test(x))) { problems.travelerIds = ['Daftar traveler tidak valid.']; return [] }
  const ids = [...new Set(input as string[])]
  if (!ids.length) return []
  const rows = await tx.query<{ id: string; cancelled: boolean }>(
    'select id, cancelled from travelers where project_id = $1 and id in (select jsonb_array_elements_text($2::text::jsonb))', [projectId, JSON.stringify(ids)])
  if (rows.length !== ids.length) problems.travelerIds = ['Ada traveler yang bukan dari project ini.']
  return rows.some(r => r.cancelled) ? ['__cancelled__'] : ids
}

export async function setRoomTravelers(tx: Queryable, actor: Actor, roomId: string, input: unknown, requestId: string) {
  const [room] = await tx.query<{ project_id: string }>('select project_id from room_assignments where id = $1 for update', [roomId])
  if (!room) throw errors.notFound('Kamar')
  const problems: FieldErrors = {}
  const ids = await cleanRoomTravelers(tx, room.project_id, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (ids[0] === '__cancelled__') throw rule('Traveler yang sudah dibatalkan tidak bisa ditempatkan di kamar.')
  // A traveler sits in one room per project: take them out of every other room first.
  for (const tid of ids) {
    await tx.query(`update room_assignments set traveler_ids = traveler_ids - $3, changed_by_api_at = now(), updated_at = now()
                     where project_id = $1 and id <> $2 and traveler_ids ? $3`, [room.project_id, roomId, tid])
  }
  await tx.query('update room_assignments set traveler_ids = $2::text::jsonb, changed_by_api_at = now(), updated_at = now() where id = $1', [roomId, JSON.stringify(ids)])
  await recordAudit(tx, { action: 'room.travelers_set', actorUserId: actor.userId, entityType: 'room_assignment', entityId: roomId, requestId, after: { travelerIds: ids } })
}

export async function createRoom(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const label = typeof input.roomLabel === 'string' ? input.roomLabel.trim() : ''
  if (!label) problems.roomLabel = ['Label kamar wajib diisi.']
  if (!(ROOM_TYPES as readonly unknown[]).includes(input.roomType)) problems.roomType = ['Tipe kamar: single, twin, atau suite.']
  const groupOk = typeof input.groupId === 'string' && ID_PATTERN.test(input.groupId) &&
    (await tx.query('select 1 from traveler_groups where id = $1 and project_id = $2', [input.groupId, projectId])).length > 0
  if (!groupOk) problems.groupId = ['Grup tidak ditemukan di project ini.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'ROOM-')
  await tx.query('insert into room_assignments (id, project_id, group_id, room_label, room_type) values ($1, $2, $3, $4, $5)', [id, projectId, input.groupId, label.slice(0, 100), input.roomType])
  await recordAudit(tx, { action: 'room.created', actorUserId: actor.userId, entityType: 'room_assignment', entityId: id, requestId, after: { projectId, label } })
  if (input.travelerIds !== undefined) await setRoomTravelers(tx, actor, id, input.travelerIds, requestId)
  return { id }
}

export async function deleteRoom(tx: Queryable, actor: Actor, roomId: string, requestId: string) {
  const done = await tx.query<{ id: string }>('delete from room_assignments where id = $1 returning id', [roomId])
  if (!done.length) throw errors.notFound('Kamar')
  await recordAudit(tx, { action: 'room.deleted', actorUserId: actor.userId, entityType: 'room_assignment', entityId: roomId, requestId })
}

export async function importTravelers(tx: Queryable, actor: Actor, projectId: string, rowsInput: unknown, requestId: string) {
  if (!Array.isArray(rowsInput) || rowsInput.length === 0 || rowsInput.length > 500) throw errors.validation({ rows: ['Kirim 1–500 baris peserta.'] })
  const existing = new Set((await tx.query<{ passport_number: string }>(
    'select passport_number from travelers where project_id = $1 and passport_number is not null', [projectId])).map(r => r.passport_number))
  const created: string[] = []
  const rejected: { index: number; errors: string[] }[] = []
  for (const [index, raw] of (rowsInput as Record<string, unknown>[]).entries()) {
    const row = raw && typeof raw === 'object' ? raw : {}
    const errs: string[] = []
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) errs.push('Nama kosong — wajib diisi')
    const passport = typeof row.passportNumber === 'string' && row.passportNumber.trim() ? row.passportNumber.trim() : null
    if (passport && existing.has(passport)) errs.push(`Nomor paspor ${passport} sudah dipakai traveler lain di project ini`)
    const problems: FieldErrors = {}
    const values = errs.length ? {} : await cleanProfile(tx, projectId, { name, passportNumber: passport, groupId: row.groupId ?? undefined }, problems)
    for (const list of Object.values(problems)) errs.push(...list)
    if (errs.length) { rejected.push({ index, errors: errs }); continue }
    created.push(await insertTraveler(tx, projectId, values))
    if (passport) existing.add(passport)
  }
  await recordAudit(tx, { action: 'traveler.imported', actorUserId: actor.userId, entityType: 'project', entityId: projectId, requestId, after: { created, rejected: rejected.length } })
  return { created, rejected }
}
```

- [ ] **Step 4: routes** — tambah ke `travelerRoutes` (impor fungsi baru):

```ts
    .post('/travelers/:id/cancel', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => cancelTraveler(tx, actor, id, (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/travelers/:id/replace', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      const result = await db.transaction(tx => replaceTraveler(tx, actor, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerResponse(result.id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/projects/:id/travelers/import', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/travelers/import', key, body: { projectId, ...(body as object) } }, tx =>
        importTravelers(tx, actor, projectId, (body as Record<string, unknown>).rows, requestIdOf(request)))
      set.status = 201
      const all = await listTravelers(db, { projectId })
      return ok(request, { created: all.filter(x => result.data.created.includes(x.id)), rejected: result.data.rejected })
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/projects/:id/room-assignments', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/room-assignments', key, body: { projectId, ...(body as object) } }, tx =>
        createRoom(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listRoomAssignments(db, { id: result.data.id }))[0])
    }, { body: t.Record(t.String(), t.Unknown()) })
    .put('/room-assignments/:id/travelers', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Kamar')
      await db.transaction(tx => setRoomTravelers(tx, actor, id, (body as Record<string, unknown> | undefined)?.travelerIds, requestIdOf(request)))
      return ok(request, (await listRoomAssignments(db, { id }))[0])
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .delete('/room-assignments/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Kamar')
      await db.transaction(tx => deleteRoom(tx, actor, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
```

- [ ] **Step 5:** test → PASS; seluruh `travelers.test.ts` (tanpa yang di-skip) PASS; typecheck.
- [ ] **Step 6:** Commit `feat(core): batal, ganti peserta, rooming & impor traveler (S7a)`.

---

### Task 4: Hook order — DP membuat traveler, batal order membatalkan traveler

**Files:**
- Modify: `backend/src/modules/core/travelers.ts`, `backend/src/modules/finance/group-trip.ts`, `backend/src/modules/sales/sales-orders.ts`
- Test: `backend/test/travelers.test.ts`

**Interfaces:**
- Produces: `createTravelersForOrder(tx, salesOrderId): Promise<string[]>` (idempoten), `cancelTravelersOfOrder(tx, salesOrderId, reason): Promise<void>`.

- [ ] **Step 1: Test gagal**:

```ts
describe('travelers from sales orders', () => {
  test('a confirmed DP creates one traveler per pax once; cancelling the order cancels them', async () => {
    const lead = (await call('POST', '/leads', 'admin', {
      name: 'Keluarga S7a', source: 'instagram', serviceCategory: 'individual-travel', destination: 'Bromo', travelStartDate: '2026-12-10',
      travelEndDate: '2026-12-12', travelerEstimate: 2, serviceScope: ['transportation'], requirementSummary: 'Trip'
    }, key())).json.data.id as string
    const so = (await call('POST', `/leads/${lead}/group-trip`, 'admin', { projectId: 'PRJ-205', adultCount: 2, childCount: 0, infantCount: 0, priceMinor: '7000000', priceAcceptance: 'accept', bookingReadiness: 'ready' })).json.data.salesOrder.id as string
    const bank = (await call('GET', '/finance/accounts', 'finance')).json.data[0].id as string
    const dpKey = key()
    const dpBody = { bankAccountId: bank, dpAmountMinor: '2100000', effectiveDate: '2026-10-07', dueDate: '2026-11-01' }
    expect((await call('POST', `/finance/sales-orders/${so}/confirm-dp`, 'finance', dpBody, dpKey)).status).toBe(201)
    expect((await call('POST', `/finance/sales-orders/${so}/confirm-dp`, 'finance', dpBody, dpKey)).status).toBe(201) // replay
    const mine = ((await call('GET', '/travelers?projectId=PRJ-205', 'admin')).json.data as { salesOrderId: string | null; name: string; leadId: string | null; cancelled: boolean }[]).filter(x => x.salesOrderId === so)
    expect(mine).toHaveLength(2)
    expect(mine.map(x => x.name)).toEqual(['Keluarga S7a (Pax 1)', 'Keluarga S7a (Pax 2)'])
    expect(mine.every(x => x.leadId === lead)).toBe(true)
    await call('POST', `/sales-orders/${so}/status`, 'admin', { to: 'cancelled', reason: 'Batal berangkat' })
    const after = ((await call('GET', '/travelers?projectId=PRJ-205', 'admin')).json.data as { salesOrderId: string | null; cancelled: boolean; cancelReason: string | null }[]).filter(x => x.salesOrderId === so)
    expect(after.every(x => x.cancelled && x.cancelReason === 'Order dibatalkan')).toBe(true)
  })
})
```

- [ ] **Step 2:** `-t "travelers from sales orders"` → FAIL (0 traveler).
- [ ] **Step 3: `travelers.ts`**:

```ts
/** S7a: a confirmed Group Trip DP turns the booking's pax into travelers (once per order). */
export async function createTravelersForOrder(tx: Queryable, salesOrderId: string): Promise<string[]> {
  const [so] = await tx.query<{ project_id: string | null; party_id: string; lead_id: string | null; traveler_count: number; party_name: string; lead_name: string | null }>(
    `select s.project_id, s.party_id, s.lead_id, s.traveler_count, p.name as party_name, l.name as lead_name
       from sales_order_refs s join parties p on p.id = s.party_id left join leads l on l.id = s.lead_id where s.id = $1`, [salesOrderId])
  if (!so?.project_id) return []
  const [{ n }] = await tx.query<{ n: number }>('select count(*)::int as n from travelers where sales_order_id = $1', [salesOrderId]) as [{ n: number }]
  if (n > 0) return []
  const base = so.lead_name ?? so.party_name
  const ids: string[] = []
  for (let i = 1; i <= Number(so.traveler_count); i++) {
    const name = so.traveler_count > 1 ? `${base} (Pax ${i})` : base
    ids.push(await insertTraveler(tx, so.project_id, { name }, { partyId: so.party_id, leadId: so.lead_id, salesOrderId }))
  }
  return ids
}

/** S7a: a cancelled Group Trip order takes its travelers out (soft cancel, out of every room). */
export async function cancelTravelersOfOrder(tx: Queryable, salesOrderId: string, reason: string): Promise<void> {
  const rows = await tx.query<{ id: string; project_id: string }>(
    `update travelers set cancelled = true, cancel_reason = $2, changed_by_api_at = now(), updated_at = now()
      where sales_order_id = $1 and not cancelled returning id, project_id`, [salesOrderId, reason])
  for (const r of rows) await removeFromRooms(tx, r.project_id, r.id)
}
```

(Tipe `n`: ganti destrukturisasi dengan `const [row] = …; if (Number(row!.n) > 0)` bila tsc menolak cast.)

- [ ] **Step 4:** `group-trip.ts` — setelah blok `if (so.status === 'draft') { … paid … }`: `await createTravelersForOrder(tx, so.id)` (import dari `../core/travelers`). `sales-orders.ts` `changeSalesOrderStatus` — setelah `update … status`: `if (to === 'cancelled') await cancelTravelersOfOrder(tx, id, 'Order dibatalkan')`.
- [ ] **Step 5:** test → PASS; `bun run test` seluruhnya PASS (finance-group-trip & sales-orders tetap hijau); typecheck.
- [ ] **Step 6:** Commit `feat(core): DP Group Trip membuat traveler, batal order membatalkan traveler (S7a)`.

---

### Task 5: Seed & extract

**Files:**
- Modify: `backend/scripts/extract-demo-core.ts`, `backend/src/db/seed-demo.ts`, `backend/src/db/seeds/demo-core.json`, `backend/test/db.test.ts`, `backend/test/travelers.test.ts` (cabut skip, hapus `travelers (empty)`)

- [ ] **Step 1: Test gagal** (`db.test.ts`):

```ts
  test('demo travelers, groups and rooms are seeded; a re-seed keeps user edits', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [counts] = await db.query<{ t: number; g: number; r: number }>('select (select count(*)::int from travelers) as t, (select count(*)::int from traveler_groups) as g, (select count(*)::int from room_assignments) as r')
      expect(counts).toEqual({ t: 44, g: 8, r: 8 })
      await db.query("update travelers set dietary_restrictions = 'Halal', changed_by_api_at = now() where id = 'TRV-1012'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      expect((await db.query<{ d: string }>("select dietary_restrictions as d from travelers where id = 'TRV-1012'"))[0]!.d).toBe('Halal')
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `-t "demo travelers"` → FAIL (0).
- [ ] **Step 3: `DemoCoreSeed`** tambah:

```ts
  /** Participants (S7a): traveler groups, travelers and the rooming list. */
  travelerGroups?: { id: string; projectId: string; name: string; paxCount: number; roomingNote: string | null }[]
  travelers?: {
    id: string; projectId: string; groupId: string | null; partyId: string | null; leadId: string | null; salesOrderId: string | null; name: string
    passportNumber: string | null; passportExpiryDate: string | null; idNumber: string | null; visaNumber: string | null; visaExpiryDate: string | null
    emergencyContactName: string | null; emergencyContactPhone: string | null; specialRequest: string | null; dietaryRestrictions: string | null
    accessibilityNeeds: string | null; companionOfTravelerId: string | null; documentsVerifiedOn: string | null; documentsVerifiedBy: string | null
    isVip: boolean; cancelReason: string | null; replacedByTravelerId: string | null; replacesTravelerId: string | null
  }[]
  roomAssignments?: { id: string; projectId: string; groupId: string; roomLabel: string; roomType: string; travelerIds: string[] }[]
```

- [ ] **Step 4: extractor** — impor `ROOM_ASSIGNMENTS, TRAVELERS, TRAVELER_GROUPS` dari `../../frontend/app/data/projects` (tambahkan ke impor `PROJECT_SERVICES, PROJECTS` yang sudah ada); tambah ke `seed`:

```ts
  travelerGroups: [...TRAVELER_GROUPS].sort(byId).map(g => ({ id: g.id, projectId: g.projectId, name: g.name, paxCount: g.paxCount, roomingNote: g.roomingNote ?? null })),
  travelers: [...TRAVELERS].sort(byId).map(tr => ({
    id: tr.id, projectId: tr.projectId, groupId: tr.groupId ?? null, partyId: tr.partyId ?? null, leadId: tr.leadId ?? null,
    salesOrderId: tr.salesOrderId ?? null, name: tr.name, passportNumber: tr.passportNumber ?? null, passportExpiryDate: dateOnly(tr.passportExpiryDate),
    idNumber: tr.idNumber ?? null, visaNumber: tr.visaNumber ?? null, visaExpiryDate: dateOnly(tr.visaExpiryDate),
    emergencyContactName: tr.emergencyContactName ?? null, emergencyContactPhone: tr.emergencyContactPhone ?? null,
    specialRequest: tr.specialRequest ?? null, dietaryRestrictions: tr.dietaryRestrictions ?? null, accessibilityNeeds: tr.accessibilityNeeds ?? null,
    companionOfTravelerId: tr.companionOfTravelerId ?? null, documentsVerifiedOn: dateOnly(tr.documentsVerifiedAt),
    documentsVerifiedBy: seededUser(tr.documentsVerifiedBy, `traveler ${tr.id} verifier`), isVip: tr.isVip ?? false,
    cancelReason: tr.cancelled ? (tr.cancelReason ?? 'Dibatalkan') : null, replacedByTravelerId: tr.replacedByTravelerId ?? null,
    replacesTravelerId: tr.replacesTravelerId ?? null
  })),
  roomAssignments: [...ROOM_ASSIGNMENTS].sort(byId).map(r => ({ id: r.id, projectId: r.projectId, groupId: r.groupId, roomLabel: r.roomLabel, roomType: r.roomType, travelerIds: r.travelerIds })),
```

`bun run seed:extract`; cek 44/8/8.

- [ ] **Step 5: seed-demo** — setelah blok sales orders (traveler merujuk lead & order):

```ts
    // S7a: participants. A re-seed refreshes fixture rows the API never changed (changed_by_api_at is null).
    for (const g of seed.travelerGroups ?? []) {
      await tx.query(
        `insert into traveler_groups (id, project_id, name, pax_count, rooming_note, provenance) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set name = excluded.name, pax_count = excluded.pax_count, rooming_note = excluded.rooming_note
         where traveler_groups.provenance = 'demo-fixture' and traveler_groups.changed_by_api_at is null`,
        [g.id, g.projectId, g.name, g.paxCount, g.roomingNote, P]
      )
    }
    const TRAVELER_COLUMNS = ['group_id', 'party_id', 'lead_id', 'sales_order_id', 'name', 'passport_number', 'passport_expiry_date', 'id_number',
      'visa_number', 'visa_expiry_date', 'emergency_contact_name', 'emergency_contact_phone', 'special_request', 'dietary_restrictions',
      'accessibility_needs', 'documents_verified_on', 'documents_verified_by', 'is_vip', 'cancelled', 'cancel_reason'] as const
    for (const tr of seed.travelers ?? []) {
      const vals = [tr.groupId, tr.partyId, tr.leadId, tr.salesOrderId, tr.name, tr.passportNumber, tr.passportExpiryDate, tr.idNumber, tr.visaNumber,
        tr.visaExpiryDate, tr.emergencyContactName, tr.emergencyContactPhone, tr.specialRequest, tr.dietaryRestrictions, tr.accessibilityNeeds,
        tr.documentsVerifiedOn, tr.documentsVerifiedBy, tr.isVip, tr.cancelReason !== null, tr.cancelReason]
      await tx.query(
        `insert into travelers (id, project_id, ${TRAVELER_COLUMNS.join(', ')}, provenance)
         values ($1, $2, ${TRAVELER_COLUMNS.map((_, i) => `$${i + 3}`).join(', ')}, $${TRAVELER_COLUMNS.length + 3})
         on conflict (id) do update set ${TRAVELER_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where travelers.provenance = 'demo-fixture' and travelers.changed_by_api_at is null`,
        [tr.id, tr.projectId, ...vals, P]
      )
    }
    // Self references once every traveler exists.
    for (const tr of seed.travelers ?? []) {
      await tx.query(
        `update travelers set companion_of = $2, replaced_by = $3, replaces = $4 where id = $1 and provenance = 'demo-fixture' and changed_by_api_at is null`,
        [tr.id, tr.companionOfTravelerId, tr.replacedByTravelerId, tr.replacesTravelerId]
      )
    }
    for (const r of seed.roomAssignments ?? []) {
      await tx.query(
        `insert into room_assignments (id, project_id, group_id, room_label, room_type, traveler_ids, provenance) values ($1, $2, $3, $4, $5, $6::text::jsonb, $7)
         on conflict (id) do update set room_label = excluded.room_label, room_type = excluded.room_type, traveler_ids = excluded.traveler_ids
         where room_assignments.provenance = 'demo-fixture' and room_assignments.changed_by_api_at is null`,
        [r.id, r.projectId, r.groupId, r.roomLabel, r.roomType, JSON.stringify(r.travelerIds), P]
      )
    }
```

- [ ] **Step 6:** cabut `describe.skip('travelers'` → `describe('travelers'`, hapus `travelers (empty)`; `db.test.ts` + `travelers.test.ts` PASS; `bun run test` seluruhnya PASS (penjaga seed "no finance records": field traveler tidak memuat kata uang — bila gagal, ledger + pengecualian seperti S6a).
- [ ] **Step 7:** Commit `feat(core): seed peserta demo (S7a)`.

---

### Task 6: Frontend — tipe, endpoint, `travelers-sync`, tab peserta

**Files:**
- Modify: `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`, `frontend/app/types/project.ts` (`Traveler.documentsVerifiedAt` tetap; sync memetakan dari `documentsVerifiedOn`), `frontend/app/layouts/dashboard.vue`, `frontend/app/pages/settings.vue`, `frontend/app/pages/project-orders/[id]/index.vue`, `frontend/app/data/index.ts` (hapus `markGroupTripOrderPaid`), `frontend/app/no-local-sales.test.ts`
- Create: `frontend/app/data/travelers-sync.ts`, `frontend/app/data/travelers-sync.test.ts`
- Delete: `frontend/app/data/group-trip-orders.test.ts`

**Interfaces:**
- Produces: `TravelerDto` (= `TravelerView`), `TravelerGroupDto`, `RoomAssignmentDto`, `TravelerImportResultDto = { created: TravelerDto[]; rejected: { index: number; errors: string[] }[] }`; `api.core`: `listTravelers(query?)`, `getTraveler(id)`, `createTraveler(projectId, input, key)`, `updateTraveler(id, input)`, `deleteTraveler(id)`, `verifyTraveler(id, verified)`, `setTravelerVip(id, isVip)`, `cancelTraveler(id, reason)`, `replaceTraveler(id, input)`, `importTravelers(projectId, rows, key)`, `listTravelerGroups(query?)`, `createTravelerGroup(projectId, input, key)`, `updateTravelerGroup(id, input)`, `listRoomAssignments(query?)`, `createRoomAssignment(projectId, input, key)`, `setRoomTravelers(id, travelerIds)`, `deleteRoomAssignment(id)`.
- `travelers-sync.ts`: `travelerFromServer`, `mergeServerTravelers(travelers, groups, rooms)`, `loadServerTravelers(api)`, `reloadProjectTravelers(api, projectId)`, `createTravelerOnServer`, `updateTravelerOnServer`, `deleteTravelerOnServer`, `verifyTravelerOnServer`, `setTravelerVipOnServer`, `cancelTravelerOnServer`, `replaceTravelerOnServer`, `importTravelersOnServer`, `createTravelerGroupOnServer`, `createRoomOnServer`, `setRoomTravelersOnServer`, `deleteRoomOnServer`, `useTravelersSync()`.

- [ ] **Step 1: Test gagal** — `travelers-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ROOM_ASSIGNMENTS, TRAVELERS, TRAVELER_GROUPS } from './projects'
import { deleteTravelerOnServer, importTravelersOnServer, mergeServerTravelers, travelerFromServer } from './travelers-sync'
import type { TravelerDto } from '~/types/api'

const dto = (over: Partial<TravelerDto> = {}): TravelerDto => ({
  id: 'TRV-1011', projectId: 'PRJ-101', groupId: null, partyId: null, leadId: null, salesOrderId: null, name: 'Hendra Wijaya',
  passportNumber: 'B1234561', passportExpiryDate: '2029-04-10', idNumber: null, visaNumber: null, visaExpiryDate: null,
  emergencyContactName: null, emergencyContactPhone: null, specialRequest: null, dietaryRestrictions: null, accessibilityNeeds: null,
  companionOfTravelerId: null, documentsVerifiedOn: '2026-07-15', documentsVerifiedBy: 'USR-002', isVip: false, cancelled: false,
  cancelReason: null, replacedByTravelerId: null, replacesTravelerId: null, ...over
})

describe('travelers-sync', () => {
  it('maps the server traveler to the local shape', () => {
    expect(travelerFromServer(dto())).toMatchObject({ id: 'TRV-1011', projectId: 'PRJ-101', passportNumber: 'B1234561', documentsVerifiedAt: '2026-07-15', documentsVerifiedBy: 'USR-002' })
    expect(travelerFromServer(dto()).groupId).toBeUndefined()
  })

  it('merge replaces travelers, groups and rooms in place', () => {
    const before = TRAVELERS.find(x => x.id === 'TRV-1011')!
    mergeServerTravelers([dto({ name: 'Nama Baru' })], [{ id: 'GRP-001', projectId: 'PRJ-103', name: 'Management', paxCount: 10, roomingNote: null }], [])
    expect(TRAVELERS).toHaveLength(1)
    expect(TRAVELERS[0]).toBe(before)
    expect(TRAVELERS[0]!.name).toBe('Nama Baru')
    expect(TRAVELER_GROUPS.map(g => g.id)).toEqual(['GRP-001'])
    expect(ROOM_ASSIGNMENTS).toHaveLength(0)
  })

  it('delete removes the traveler locally after the server answered; import adds the created rows', async () => {
    mergeServerTravelers([dto()], [], [{ id: 'ROOM-001', projectId: 'PRJ-101', groupId: 'GRP-001', roomLabel: 'Twin', roomType: 'twin', travelerIds: ['TRV-1011'] }])
    const api = {
      core: {
        deleteTraveler: () => Promise.resolve({ data: { id: 'TRV-1011', deleted: true } }),
        importTravelers: () => Promise.resolve({ data: { created: [dto({ id: 'TRV-2000', name: 'Impor' })], rejected: [{ index: 1, errors: ['Nama kosong'] }] } })
      }
    } as never
    await deleteTravelerOnServer(api, 'TRV-1011')
    expect(TRAVELERS.some(x => x.id === 'TRV-1011')).toBe(false)
    expect(ROOM_ASSIGNMENTS[0]!.travelerIds).toEqual([])
    const res = await importTravelersOnServer(api, 'PRJ-101', [{ name: 'Impor' }, { name: '' }])
    expect(res.created.map(x => x.id)).toEqual(['TRV-2000'])
    expect(res.rejected).toHaveLength(1)
    expect(TRAVELERS.some(x => x.id === 'TRV-2000')).toBe(true)
  })
})
```

- [ ] **Step 2:** `pnpm vitest run app/data/travelers-sync.test.ts` → FAIL.

- [ ] **Step 3: tipe** (`types/api.ts`, tulis lewat Write/append aman):

```ts
/** Participants (S7a) — travelers, groups and rooming list. Dates `YYYY-MM-DD`. */
export interface TravelerDto {
  id: string; projectId: string; groupId: string | null; partyId: string | null; leadId: string | null; salesOrderId: string | null; name: string
  passportNumber: string | null; passportExpiryDate: string | null; idNumber: string | null; visaNumber: string | null; visaExpiryDate: string | null
  emergencyContactName: string | null; emergencyContactPhone: string | null; specialRequest: string | null; dietaryRestrictions: string | null
  accessibilityNeeds: string | null; companionOfTravelerId: string | null; documentsVerifiedOn: string | null; documentsVerifiedBy: string | null
  isVip: boolean; cancelled: boolean; cancelReason: string | null; replacedByTravelerId: string | null; replacesTravelerId: string | null
}
export type TravelerInput = Partial<Pick<TravelerDto, 'name' | 'groupId' | 'passportNumber' | 'passportExpiryDate' | 'idNumber' | 'visaNumber'
  | 'visaExpiryDate' | 'emergencyContactName' | 'emergencyContactPhone' | 'specialRequest' | 'dietaryRestrictions' | 'accessibilityNeeds' | 'companionOfTravelerId'>>
export interface TravelerGroupDto { id: string; projectId: string; name: string; paxCount: number; roomingNote: string | null }
export interface RoomAssignmentDto { id: string; projectId: string; groupId: string; roomLabel: string; roomType: 'single' | 'twin' | 'suite'; travelerIds: string[] }
export interface TravelerImportResultDto { created: TravelerDto[]; rejected: { index: number; errors: string[] }[] }
```

endpoint (`core`):

```ts
      listTravelers: (query: { projectId?: string } = {}) => client.get<TravelerDto[]>('/travelers', { query: { ...query } }),
      getTraveler: (id: string) => client.get<TravelerDto>(`/travelers/${seg(id)}`),
      createTraveler: (projectId: string, input: TravelerInput & { name: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerDto>(`/projects/${seg(projectId)}/travelers`, input, { idempotencyKey }),
      updateTraveler: (id: string, input: TravelerInput) => client.patch<TravelerDto>(`/travelers/${seg(id)}`, input),
      deleteTraveler: (id: string) => client.delete<{ id: string; deleted: true }>(`/travelers/${seg(id)}`),
      verifyTraveler: (id: string, verified: boolean) => client.post<TravelerDto>(`/travelers/${seg(id)}/verify`, { verified }),
      setTravelerVip: (id: string, isVip: boolean) => client.post<TravelerDto>(`/travelers/${seg(id)}/vip`, { isVip }),
      cancelTraveler: (id: string, reason: string) => client.post<TravelerDto>(`/travelers/${seg(id)}/cancel`, { reason }),
      replaceTraveler: (id: string, input: TravelerInput & { name: string }) => client.post<TravelerDto>(`/travelers/${seg(id)}/replace`, input),
      importTravelers: (projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[], idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerImportResultDto>(`/projects/${seg(projectId)}/travelers/import`, { rows }, { idempotencyKey }),
      listTravelerGroups: (query: { projectId?: string } = {}) => client.get<TravelerGroupDto[]>('/traveler-groups', { query: { ...query } }),
      createTravelerGroup: (projectId: string, input: { name: string; paxCount?: number; roomingNote?: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerGroupDto>(`/projects/${seg(projectId)}/traveler-groups`, input, { idempotencyKey }),
      updateTravelerGroup: (id: string, input: { name?: string; paxCount?: number; roomingNote?: string | null }) => client.patch<TravelerGroupDto>(`/traveler-groups/${seg(id)}`, input),
      listRoomAssignments: (query: { projectId?: string } = {}) => client.get<RoomAssignmentDto[]>('/room-assignments', { query: { ...query } }),
      createRoomAssignment: (projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<RoomAssignmentDto>(`/projects/${seg(projectId)}/room-assignments`, input, { idempotencyKey }),
      setRoomTravelers: (id: string, travelerIds: string[]) => client.put<RoomAssignmentDto>(`/room-assignments/${seg(id)}/travelers`, { travelerIds }),
      deleteRoomAssignment: (id: string) => client.delete<{ id: string; deleted: true }>(`/room-assignments/${seg(id)}`),
```

- [ ] **Step 4: `travelers-sync.ts`**

```ts
import { ROOM_ASSIGNMENTS, TRAVELERS, TRAVELER_GROUPS } from './projects'
import type { RoomAssignment, Traveler, TravelerGroup } from '~/types/project'
import type { RoomAssignmentDto, TravelerDto, TravelerGroupDto, TravelerInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `TRAVELERS`, `TRAVELER_GROUPS`, `ROOM_ASSIGNMENTS` (S7a). The server owns participants, groups and the
 * rooming list; writes go to the server first and its answer replaces the local object in place. The hidden client
 * portal still edits locally (ADR-006).
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function travelerFromServer (d: TravelerDto): Traveler {
  return {
    id: d.id,
    projectId: d.projectId,
    groupId: opt(d.groupId),
    partyId: opt(d.partyId),
    leadId: opt(d.leadId),
    salesOrderId: opt(d.salesOrderId),
    name: d.name,
    passportNumber: opt(d.passportNumber),
    passportExpiryDate: opt(d.passportExpiryDate),
    idNumber: opt(d.idNumber),
    visaNumber: opt(d.visaNumber),
    visaExpiryDate: opt(d.visaExpiryDate),
    emergencyContactName: opt(d.emergencyContactName),
    emergencyContactPhone: opt(d.emergencyContactPhone),
    specialRequest: opt(d.specialRequest),
    dietaryRestrictions: opt(d.dietaryRestrictions),
    accessibilityNeeds: opt(d.accessibilityNeeds),
    companionOfTravelerId: opt(d.companionOfTravelerId),
    documentsVerifiedAt: opt(d.documentsVerifiedOn),
    documentsVerifiedBy: opt(d.documentsVerifiedBy),
    isVip: d.isVip,
    cancelled: d.cancelled,
    cancelReason: opt(d.cancelReason),
    replacedByTravelerId: opt(d.replacedByTravelerId),
    replacesTravelerId: opt(d.replacesTravelerId)
  }
}

const groupFromServer = (d: TravelerGroupDto): TravelerGroup => ({ id: d.id, projectId: d.projectId, name: d.name, paxCount: d.paxCount, roomingNote: opt(d.roomingNote) })
const roomFromServer = (d: RoomAssignmentDto): RoomAssignment => ({ id: d.id, projectId: d.projectId, groupId: d.groupId, roomLabel: d.roomLabel, roomType: d.roomType, travelerIds: [...d.travelerIds] })

function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) {
    list.push(value)
    return list[list.length - 1]!
  }
  Object.assign(local, value)
  return local
}

function replaceAll<T extends { id: string }> (list: T[], values: T[]) {
  const keep = new Set(values.map(v => v.id))
  for (let i = list.length - 1; i >= 0; i--) {
    if (!keep.has(list[i]!.id)) { list.splice(i, 1) }
  }
  for (const v of values) { upsert(list, v) }
}

export const upsertServerTraveler = (d: TravelerDto): Traveler => upsert(TRAVELERS, travelerFromServer(d))
export const upsertServerGroup = (d: TravelerGroupDto): TravelerGroup => upsert(TRAVELER_GROUPS, groupFromServer(d))
export const upsertServerRoom = (d: RoomAssignmentDto): RoomAssignment => upsert(ROOM_ASSIGNMENTS, roomFromServer(d))

export function mergeServerTravelers (travelers: TravelerDto[], groups: TravelerGroupDto[], rooms: RoomAssignmentDto[]): void {
  replaceAll(TRAVELERS, travelers.map(travelerFromServer))
  replaceAll(TRAVELER_GROUPS, groups.map(groupFromServer))
  replaceAll(ROOM_ASSIGNMENTS, rooms.map(roomFromServer))
}

export async function loadServerTravelers (api: CoreApi): Promise<void> {
  const [travelers, groups, rooms] = await Promise.all([api.core.listTravelers(), api.core.listTravelerGroups(), api.core.listRoomAssignments()])
  mergeServerTravelers(travelers.data, groups.data, rooms.data)
}

/** One project's participants as the server has them now (e.g. after a Group Trip DP created travelers). */
export async function reloadProjectTravelers (api: CoreApi, projectId: string): Promise<void> {
  const [travelers, rooms] = await Promise.all([api.core.listTravelers({ projectId }), api.core.listRoomAssignments({ projectId })])
  for (const t of travelers.data) { upsertServerTraveler(t) }
  for (const r of rooms.data) { upsertServerRoom(r) }
}

export async function createTravelerOnServer (api: CoreApi, projectId: string, input: TravelerInput & { name: string }, key: string = newIdempotencyKey()): Promise<Traveler> {
  return upsertServerTraveler((await api.core.createTraveler(projectId, input, key)).data)
}
export async function updateTravelerOnServer (api: CoreApi, id: string, input: TravelerInput): Promise<Traveler> {
  return upsertServerTraveler((await api.core.updateTraveler(id, input)).data)
}
export async function deleteTravelerOnServer (api: CoreApi, id: string): Promise<void> {
  await api.core.deleteTraveler(id)
  const index = TRAVELERS.findIndex(x => x.id === id)
  if (index !== -1) { TRAVELERS.splice(index, 1) }
  for (const room of ROOM_ASSIGNMENTS) { room.travelerIds = room.travelerIds.filter(x => x !== id) }
}
export async function verifyTravelerOnServer (api: CoreApi, id: string, verified: boolean): Promise<Traveler> {
  return upsertServerTraveler((await api.core.verifyTraveler(id, verified)).data)
}
export async function setTravelerVipOnServer (api: CoreApi, id: string, isVip: boolean): Promise<Traveler> {
  return upsertServerTraveler((await api.core.setTravelerVip(id, isVip)).data)
}
export async function cancelTravelerOnServer (api: CoreApi, id: string, reason: string): Promise<Traveler> {
  const traveler = upsertServerTraveler((await api.core.cancelTraveler(id, reason)).data)
  for (const room of ROOM_ASSIGNMENTS) { room.travelerIds = room.travelerIds.filter(x => x !== id) }
  return traveler
}
export async function replaceTravelerOnServer (api: CoreApi, id: string, input: TravelerInput & { name: string }): Promise<Traveler> {
  const replacement = upsertServerTraveler((await api.core.replaceTraveler(id, input)).data)
  await reloadProjectTravelers(api, replacement.projectId)
  return replacement
}
export async function importTravelersOnServer (api: CoreApi, projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[], key: string = newIdempotencyKey()) {
  const res = (await api.core.importTravelers(projectId, rows, key)).data
  return { created: res.created.map(upsertServerTraveler), rejected: res.rejected }
}
export async function createTravelerGroupOnServer (api: CoreApi, projectId: string, name: string, key: string = newIdempotencyKey()): Promise<TravelerGroup> {
  return upsertServerGroup((await api.core.createTravelerGroup(projectId, { name }, key)).data)
}
export async function createRoomOnServer (api: CoreApi, projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }, key: string = newIdempotencyKey()): Promise<RoomAssignment> {
  const room = upsertServerRoom((await api.core.createRoomAssignment(projectId, input, key)).data)
  await reloadProjectTravelers(api, projectId)
  return room
}
export async function setRoomTravelersOnServer (api: CoreApi, id: string, travelerIds: string[]): Promise<RoomAssignment> {
  const room = upsertServerRoom((await api.core.setRoomTravelers(id, travelerIds)).data)
  await reloadProjectTravelers(api, room.projectId) // other rooms of the project may have lost a traveler
  return room
}
export async function deleteRoomOnServer (api: CoreApi, id: string): Promise<void> {
  await api.core.deleteRoomAssignment(id)
  const index = ROOM_ASSIGNMENTS.findIndex(x => x.id === id)
  if (index !== -1) { ROOM_ASSIGNMENTS.splice(index, 1) }
}

export interface TravelersSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads participants once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useTravelersSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<TravelersSyncState>('manova-travelers-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerTravelers(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Peserta belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
```

(`RoomAssignment['roomType']` = `RoomType`; `client.delete` dan `client.put` sudah ada di `ApiClient` — dipakai endpoint project member/contract value.)

- [ ] **Step 5: layout & reset** — `dashboard.vue`: `useTravelersSync()`, dimuat di `loadLeads` (khusus peran internal, bersama leads/sales orders), label `'peserta'` di `unsyncedLabel`/`unsyncedMessage`; `settings.vue` reset memanggil `load(true)`.

- [ ] **Step 6: tab peserta project order** (`pages/project-orders/[id]/index.vue`) — `const api = financeApi` sudah ada (`useApi()`); tambah `isSavingTraveler = ref(false)` dan pola:

```ts
async function submitTraveler () {
  if (!project.value || !formName.value.trim() || isSavingTraveler.value) { return }
  const payload = {
    groupId: formGroupId.value || null,
    name: formName.value.trim(),
    passportNumber: formPassportNumber.value.trim() || null,
    passportExpiryDate: formPassportExpiryDate.value || null,
    idNumber: formIdNumber.value.trim() || null,
    visaNumber: formVisaNumber.value.trim() || null,
    visaExpiryDate: formVisaExpiryDate.value || null,
    emergencyContactName: formEmergencyContactName.value.trim() || null,
    emergencyContactPhone: formEmergencyContactPhone.value.trim() || null,
    dietaryRestrictions: formDietaryRestrictions.value.trim() || null,
    accessibilityNeeds: formAccessibilityNeeds.value.trim() || null,
    specialRequest: formSpecialRequest.value.trim() || null,
    companionOfTravelerId: formCompanionOfTravelerId.value || null
  }
  isSavingTraveler.value = true
  try {
    if (editingTravelerId.value) {
      await updateTravelerOnServer(financeApi, editingTravelerId.value, payload)
      showToast('Traveler Diperbarui', `${payload.name} berhasil diperbarui.`)
    } else {
      await createTravelerOnServer(financeApi, project.value.id, payload)
      showToast('Traveler Ditambahkan', `${payload.name} berhasil ditambahkan ke project.`)
    }
    isTravelerDialogOpen.value = false
  } catch (error) {
    showToast('Traveler Gagal Disimpan', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
  } finally {
    isSavingTraveler.value = false
  }
}
```

Sama untuk: `submitCreateGroup` → `createTravelerGroupOnServer`; `executeDeleteTraveler` → `deleteTravelerOnServer` (pesan error server mis. "batalkan, jangan hapus" ditampilkan); `toggleVerification` → `verifyTravelerOnServer(financeApi, traveler.id, !traveler.documentsVerifiedAt)`; `confirmImport` → `importTravelersOnServer(financeApi, project.value.id, importPreviewRows.value.map(r => ({ name: r.name, passportNumber: r.passportNumber, groupId: r.groupId })))` — baris yang ditolak server ditambahkan error-nya ke `importPreviewRows[index].errors`, jumlah dibuat = `created.length`. `onDpConfirmed`: ganti `markGroupTripOrderPaid(id)` dengan `await reloadProjectTravelers(financeApi, project.value.id)` (dalam try/catch yang sama dengan `reloadSalesOrder`). Hapus impor `createTraveler, updateTraveler, removeTraveler, createTravelerGroup, toggleTravelerVerification, commitTravelerImport, markGroupTripOrderPaid` dari `~/data`. Tombol simpan dialog `:disabled="isSavingTraveler"`.

- [ ] **Step 7: hapus `markGroupTripOrderPaid`** dari `data/index.ts` + `data/group-trip-orders.test.ts` (Rulings 4). Guard `no-local-sales.test.ts`: tambah ke `FORBIDDEN` `'createTraveler(', 'updateTraveler(', 'removeTraveler(', 'toggleTravelerVerification(', 'setTravelerVip(', 'cancelTraveler(', 'replaceTraveler(', 'createTravelerGroup(', 'createRoomAssignment(', 'setRoomAssignmentTravelers(', 'removeRoomAssignment(', 'commitTravelerImport(', 'markGroupTripOrderPaid('`; `KNOWN_PUBLIC` tambah `/^pages\/client\//, /^components\/client\//` (portal client tersembunyi — komentar disesuaikan). Catatan: `markGroupTripOrderPaid` sudah dihapus, entri guard mencegah kembalinya.
- [ ] **Step 8:** `pnpm vitest run app/data/travelers-sync.test.ts app/no-local-sales.test.ts` → PASS; `pnpm test` PASS; vue-tsc ≤ 2000; lint per file tidak bertambah; `pnpm build` sukses.
- [ ] **Step 9:** Commit `feat(frontend): peserta (traveler, grup, rooming) dari server di tab peserta project order (S7a)`.

---

### Task 7: Dokumentasi, DB lokal, smoke

- [ ] **Step 1:** ADR-004 — catatan S7a (peserta milik API, akses data identitas penuh untuk peran internal, DP membuat traveler, batal order membatalkan traveler, seed tidak menimpa perubahan API, portal tetap lokal); spec status → "diimplementasikan".
- [ ] **Step 2:** DB lokal — hentikan backend dev (port 3000), `bun run db:migrate`, `bun run db:seed:demo`, nyalakan lagi `bun run dev` di background.
- [ ] **Step 3: Smoke** pada salinan DB di port 3100: `GET /travelers?projectId=PRJ-101` (6), tambah traveler, isi kamar, batal; Group Trip qualify + confirm DP (rekening `BA-001`) → traveler order terbentuk; finance `GET /travelers` 200 & `POST` 403. Matikan server & hapus salinan.
- [ ] **Step 4:** Commit `docs: catatan S7a peserta di ADR-004`.
