# Layanan project & booking lewat API (S4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layanan project dan booking flight/hotel/transport/MICE dibuat, diubah, dan berganti status lewat API, sehingga Finance melihat booking yang sama dengan Operasional.

**Architecture:** Tabel `booking_refs` diperluas menjadi tabel booking penuh (kolom inti + `details` JSONB), `project_services` mendapat label/status/budget/referensi. Aturan murni (transisi, mapping status, validasi details, harga & tanggal turunan) di `core/booking-rules.ts` dipakai server dan script extract. Frontend memuat lewat `bookings-sync.ts`; tulis = server dulu, lalu efek samping lokal yang tetap (aktivitas, service order, payment gate).

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (`backend/`), Nuxt 4 + Vue 3 + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-06-services-bookings-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan campur, jangan tambah lockfile.
- Uang = `bigint` minor di SQL, string desimal (`…Minor`) di wire; frontend mengonversi ke `…Idr` number.
- Pola tulis S0: `auth.requireActor` → validasi → cek capability → `errors.validation` (400, pesan Indonesia) / `rule()` 422 `RULE_VIOLATION` → perubahan + `recordAudit` satu transaksi → respons = bentuk GET. Create pakai `withIdempotency` + `requireIdempotencyKey`.
- ID dari `nextId(q, prefix)` (`src/shared/ids.ts`); seed memanggil `syncIdSequences`.
- Di luar scope → 404; portal (client/vendor) tidak bisa menulis.
- Capability tulis: `project-order.manage-service.<flight|hotel|transportation|mice|additional>` (sudah ada, admin; super-admin lolos lewat `hasCapability`).
- `booking_type` memakai `transport`; `service_type` memakai `transportation`. Terjemahan hanya di `booking-rules.ts`.
- Perubahan bentuk API → update `frontend/app/types/api.ts` + `lib/api/endpoints.ts` di perubahan yang sama.
- File CRLF: edit dengan tool Edit atau normalisasi `tr -d '\r'` → ubah → `perl -pe 's/\n$/\r\n/'`.
- Test backend: `bun run test` (timeout 30 s). Filter: `bun test --timeout 30000 test/<file> -t "<nama>"`.
- vue-tsc: `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` — baseline 2010 error, tidak boleh bertambah; abaikan pola "on type 'unknown'".
- Commit tiap task, jangan push.

## Rulings dari spec (dibuat saat menulis plan)

1. **Blok Finance hanya untuk transisi ke `cancelled`.** `refunded` hanya bisa dari `cancelled` (flight), jadi pembatalannya sudah lewat; memblok `refunded` akan membuat flight yang dibatalkan lewat Finance tak pernah bisa ditandai refunded. `no-show` bukan pembatalan (customer tetap bayar) → tidak diblok.
2. **Booking yang tak bisa diedit** mengikuti guard frontend sekarang: flight `refunded`; hotel/transport `completed/cancelled/no-show`; MICE `completed/cancelled` (spec menulis "cancelled/refunded"; flight `cancelled` di frontend masih bisa diedit untuk catatan refund).
3. **Harga MICE di body** (`sellAmountMinor`/`netCostMinor`) → 400 "Harga MICE dihitung dari BOQ." (bukan diabaikan diam-diam).
4. **Referensi booking** (PNR/konfirmasi) disalin ke `project_services.booking_reference` setiap kali berubah (perilaku frontend sekarang).

## Review Focus

1. Booking dengan `serviceId` milik project/jenis lain → harus 400, bukan menautkan lintas project (FK komposit akan 500 bila lolos).
2. Ganti vendor layanan saat invoice vendor menunjuk **service order** layanan itu (bukan booking) → harus 422.
3. Turunkan harga jual ke `null` (kosongkan) saat sudah ada tagihan → harus 422 seperti menurunkan ke angka kecil.
4. `details` berisi field inti (`status`, `sellPriceIdr`, `id`) → dibuang, tidak menimpa kolom.
5. Pembatalan lewat Finance untuk booking yang statusnya terminal (mis. hotel `completed`) → kasus tetap tercatat, status booking tidak dipaksa.

Masing-masing punya test di task pemiliknya (Task 4: 1, 3, 4; Task 3: 2; Task 5: 5).

---

### Task 1: Migrasi 0022 + sumber `id_sequences` umum

**Files:**
- Create: `backend/migrations/0022_services_bookings.up.sql`, `backend/migrations/0022_services_bookings.down.sql`
- Modify: `backend/src/shared/ids.ts`
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces: kolom `project_services.label/status/booking_reference/budget_minor/updated_at`; `booking_refs.status/net_cost_minor/reference/status_reason/details/created_at/updated_at`; `IdPrefix` tambah `'SVC-' | 'FLT-' | 'HTL-' | 'TRN-' | 'MICE-'`.

- [ ] **Step 1: Test gagal di `db.test.ts`** (tambah di describe migrasi/seed yang ada):

```ts
test('services and bookings carry label, status and details after 0022', async () => {
  const [svc] = await db.query<{ label: string; status: string }>("select label, status from project_services where id = 'SVC-1011'")
  expect(svc!.label).not.toBe('')
  expect(svc!.status).toMatch(/^(not-started|sourcing|quoted|pending-confirmation|confirmed|changed|completed|cancelled)$/)
  const [b] = await db.query<{ status: string; details: unknown }>("select status, details from booking_refs where booking_type = 'flight' and booking_id = 'FLT-1011'")
  expect(typeof b!.status).toBe('string')
  expect(typeof b!.details).toBe('object')
  await expect(db.query("update booking_refs set status = 'issued' where booking_type = 'hotel' and booking_id = 'HTL-1033'")).rejects.toThrow()
  const seqs = await db.query<{ prefix: string; last_value: number }>("select prefix, last_value from id_sequences where prefix in ('SVC-','FLT-','HTL-','TRN-','MICE-') order by prefix")
  expect(seqs.map(s => s.prefix)).toEqual(['FLT-', 'HTL-', 'MICE-', 'SVC-', 'TRN-'])
  expect(seqs.every(s => s.last_value > 0)).toBe(true)
})
```

- [ ] **Step 2:** `bun test --timeout 30000 test/db.test.ts -t "0022"` → FAIL (kolom tidak ada).

- [ ] **Step 3: `0022_services_bookings.up.sql`**

```sql
-- S4a: project services and bookings are written by the API (Booking module owns booking_refs commercials).
alter table project_services
  add column label text,
  add column status text not null default 'not-started'
    check (status in ('not-started', 'sourcing', 'quoted', 'pending-confirmation', 'confirmed', 'changed', 'completed', 'cancelled')),
  add column booking_reference text,
  add column budget_minor bigint check (budget_minor is null or (budget_minor >= 0 and budget_minor <= 1000000000000000)),
  add column updated_at timestamptz not null default now();
update project_services set label = case service_type
  when 'flight' then 'Flight' when 'hotel' then 'Hotel' when 'transportation' then 'Transportation'
  when 'mice' then 'MICE' else 'Additional' end;
alter table project_services alter column label set not null, add constraint project_services_label check (btrim(label) <> '');

alter table booking_refs
  add column status text,
  add column net_cost_minor bigint check (net_cost_minor is null or (net_cost_minor >= 0 and net_cost_minor <= 1000000000000000)),
  add column reference text,
  add column status_reason text,
  add column details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint booking_refs_sell_max check (sell_amount_minor is null or sell_amount_minor <= 1000000000000000);
update booking_refs set status = case when booking_type = 'mice' then 'planning' else 'requested' end;
alter table booking_refs alter column status set not null, add constraint booking_refs_status check (
  (booking_type = 'flight' and status in ('requested', 'hold', 'confirmed', 'issued', 'reissued', 'cancelled', 'refunded')) or
  (booking_type = 'hotel' and status in ('requested', 'quoted', 'confirmed', 'amended', 'completed', 'cancelled', 'no-show')) or
  (booking_type = 'transport' and status in ('requested', 'quoted', 'assigned', 'confirmed', 'completed', 'cancelled', 'no-show')) or
  (booking_type = 'mice' and status in ('planning', 'confirmed', 'in-progress', 'completed', 'cancelled')));
create index booking_refs_service on booking_refs (service_id) where service_id is not null;

insert into id_sequences (prefix, last_value)
select 'SVC-', coalesce(max(substring(id from '^SVC-([0-9]+)$')::integer), 0) from project_services
on conflict (prefix) do nothing;
insert into id_sequences (prefix, last_value)
select p.prefix, coalesce(max(substring(b.booking_id from '^' || p.prefix || '([0-9]+)$')::integer), 0)
  from (values ('FLT-', 'flight'), ('HTL-', 'hotel'), ('TRN-', 'transport'), ('MICE-', 'mice')) as p(prefix, booking_type)
  left join booking_refs b on b.booking_type = p.booking_type
 group by p.prefix
on conflict (prefix) do nothing;
```

`0022_services_bookings.down.sql`:

```sql
delete from id_sequences where prefix in ('SVC-', 'FLT-', 'HTL-', 'TRN-', 'MICE-');
drop index if exists booking_refs_service;
alter table booking_refs
  drop constraint if exists booking_refs_status, drop constraint if exists booking_refs_sell_max,
  drop column if exists status, drop column if exists net_cost_minor, drop column if exists reference,
  drop column if exists status_reason, drop column if exists details, drop column if exists created_at, drop column if exists updated_at;
alter table project_services
  drop constraint if exists project_services_label,
  drop column if exists label, drop column if exists status, drop column if exists booking_reference,
  drop column if exists budget_minor, drop column if exists updated_at;
```

- [ ] **Step 4: `ids.ts` — sumber umum**

```ts
export type IdPrefix = 'PRJ-' | 'PTY-' | 'CP-' | 'PACT-' | 'VND-' | 'VCT-' | 'VPR-' | 'VDOC-' | 'SVC-' | 'FLT-' | 'HTL-' | 'TRN-' | 'MICE-'

/** Where each prefix's IDs live: table, ID column and an optional fixed filter (bookings share one table). */
const SOURCES: Record<IdPrefix, { table: string; column?: string; where?: string }> = {
  'PRJ-': { table: 'projects' }, 'PTY-': { table: 'parties' }, 'CP-': { table: 'party_contacts' }, 'PACT-': { table: 'party_activities' },
  'VND-': { table: 'vendors' }, 'VCT-': { table: 'vendor_contacts' }, 'VPR-': { table: 'vendor_products' }, 'VDOC-': { table: 'vendor_documents' },
  'SVC-': { table: 'project_services' },
  'FLT-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'flight'" },
  'HTL-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'hotel'" },
  'TRN-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'transport'" },
  'MICE-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'mice'" }
}
```

dan `syncIdSequences`:

```ts
  for (const [prefix, source] of Object.entries(SOURCES)) {
    const column = source.column ?? 'id'
    await q.query(
      `insert into id_sequences (prefix, last_value)
       select $1, coalesce(max(substring(${column} from '^' || $2 || '([0-9]+)$')::integer), 0) from ${source.table}
       ${source.where ? `where ${source.where}` : ''}
       on conflict (prefix) do update set last_value = greatest(id_sequences.last_value, excluded.last_value)`,
      [prefix, prefix]
    )
  }
```

- [ ] **Step 5:** test Step 2 → PASS; `bun run typecheck` bersih.
- [ ] **Step 6:** Commit `feat(core): migrasi 0022 layanan & booking (S4a)`.

---

### Task 2: Aturan murni `booking-rules.ts`

**Files:**
- Create: `backend/src/modules/core/booking-rules.ts`, `backend/test/booking-rules.test.ts`

**Interfaces:**
- Produces:
  - `BOOKING_STATUSES: Record<BookingType, readonly string[]>`, `BOOKING_TRANSITIONS: Record<BookingType, Record<string, readonly string[]>>`, `BOOKING_INITIAL_STATUS`, `BOOKING_LOCKED_FOR_EDIT: Record<BookingType, readonly string[]>`
  - `SERVICE_TYPES`, `SERVICE_STATUSES`, `type ServiceType`, `type ServiceStatus`
  - `serviceTypeOf(type: BookingType): ServiceType`, `defaultServiceLabel(t: ServiceType): string`
  - `serviceStatusFor(type: BookingType, status: string): ServiceStatus`
  - `cleanDetails(type: BookingType, raw: unknown, problems: FieldErrors): Record<string, unknown> | undefined`
  - `departureDateOf(type: BookingType, details: Record<string, unknown>): string | null`
  - `miceTotals(details: Record<string, unknown>): { sellMinor: string | null; netMinor: string | null }`
  - `CORE_BOOKING_KEYS: readonly string[]`

- [ ] **Step 1: Test gagal** `test/booking-rules.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { FieldErrors } from '../src/http/errors'
import { BOOKING_TRANSITIONS, cleanDetails, departureDateOf, miceTotals, serviceStatusFor, serviceTypeOf } from '../src/modules/core/booking-rules'

describe('booking rules', () => {
  test('transitions match the frontend maps', () => {
    expect(BOOKING_TRANSITIONS.flight.requested).toEqual(['hold', 'confirmed', 'cancelled'])
    expect(BOOKING_TRANSITIONS.flight.cancelled).toEqual(['refunded'])
    expect(BOOKING_TRANSITIONS.hotel.confirmed).toEqual(['amended', 'completed', 'cancelled', 'no-show'])
    expect(BOOKING_TRANSITIONS.transport.quoted).toEqual(['assigned', 'cancelled'])
    expect(BOOKING_TRANSITIONS.mice['in-progress']).toEqual(['completed', 'cancelled'])
  })

  test('service status follows the booking status', () => {
    expect(serviceStatusFor('flight', 'issued')).toBe('confirmed')
    expect(serviceStatusFor('flight', 'reissued')).toBe('changed')
    expect(serviceStatusFor('flight', 'hold')).toBe('pending-confirmation')
    expect(serviceStatusFor('hotel', 'quoted')).toBe('quoted')
    expect(serviceStatusFor('hotel', 'no-show')).toBe('cancelled')
    expect(serviceStatusFor('transport', 'assigned')).toBe('pending-confirmation')
    expect(serviceStatusFor('mice', 'in-progress')).toBe('confirmed')
    expect(serviceTypeOf('transport')).toBe('transportation')
  })

  test('details: object only, core keys dropped, typed arrays, size limit', () => {
    const p: FieldErrors = {}
    const clean = cleanDetails('flight', { status: 'issued', sellPriceIdr: 1, id: 'X', pnr: 'ABC', segments: [{ origin: 'CGK', destination: 'MNL', departureAt: '2026-08-20T08:00' }], fareRules: 'NR' }, p)
    expect(p).toEqual({})
    expect(clean).toEqual({ segments: [{ origin: 'CGK', destination: 'MNL', departureAt: '2026-08-20T08:00' }], fareRules: 'NR' })
    for (const bad of [null, [], 'x', { segments: 'no' }, { segments: [{ departureAt: 5 }] }, { x: 'a'.repeat(70_000) }]) {
      const q: FieldErrors = {}
      cleanDetails('flight', bad, q)
      expect(Object.keys(q), JSON.stringify(bad).slice(0, 40)).toEqual(['details'])
    }
    const m: FieldErrors = {}
    cleanDetails('mice', { boqItems: [{ description: 'Sound', sellPriceIdr: -1 }] }, m)
    expect(m.details).toBeDefined()
  })

  test('departure date and MICE totals are derived from details', () => {
    expect(departureDateOf('flight', { segments: [{ departureAt: '2026-08-22T10:00' }, { departureAt: '2026-08-20T08:00' }] })).toBe('2026-08-20')
    expect(departureDateOf('hotel', { checkInDate: '2026-08-10' })).toBe('2026-08-10')
    expect(departureDateOf('transport', { legs: [] })).toBeNull()
    expect(departureDateOf('mice', { sessions: [{ startAt: '2026-09-01T09:00' }] })).toBe('2026-09-01')
    expect(miceTotals({ boqItems: [{ sellPriceIdr: 1000, netCostIdr: 800 }, { sellPriceIdr: 500 }, { description: 'x' }] })).toEqual({ sellMinor: '1500', netMinor: '800' })
    expect(miceTotals({ boqItems: [] })).toEqual({ sellMinor: null, netMinor: null })
  })
})
```

- [ ] **Step 2:** `bun test --timeout 30000 test/booking-rules.test.ts` → FAIL (module tidak ada).

- [ ] **Step 3: `booking-rules.ts`**

```ts
import type { FieldErrors } from '../../http/errors'
import type { BookingType } from './repository'

/**
 * Booking rules shared by the API and the demo extract (S4a): status maps (same as the frontend
 * `*_TRANSITIONS`), booking → service status, `details` checks, and the derived departure date / MICE totals.
 */

export const SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional'] as const
export type ServiceType = typeof SERVICE_TYPES[number]
export const SERVICE_STATUSES = ['not-started', 'sourcing', 'quoted', 'pending-confirmation', 'confirmed', 'changed', 'completed', 'cancelled'] as const
export type ServiceStatus = typeof SERVICE_STATUSES[number]

export const BOOKING_TRANSITIONS: Record<BookingType, Record<string, readonly string[]>> = {
  flight: { requested: ['hold', 'confirmed', 'cancelled'], hold: ['confirmed', 'cancelled'], confirmed: ['issued', 'cancelled'], issued: ['reissued', 'cancelled'], reissued: ['cancelled'], cancelled: ['refunded'], refunded: [] },
  hotel: { requested: ['quoted', 'cancelled'], quoted: ['confirmed', 'cancelled'], confirmed: ['amended', 'completed', 'cancelled', 'no-show'], amended: ['completed', 'cancelled', 'no-show'], completed: [], cancelled: [], 'no-show': [] },
  transport: { requested: ['quoted', 'cancelled'], quoted: ['assigned', 'cancelled'], assigned: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled', 'no-show'], completed: [], cancelled: [], 'no-show': [] },
  mice: { planning: ['confirmed', 'cancelled'], confirmed: ['in-progress', 'cancelled'], 'in-progress': ['completed', 'cancelled'], completed: [], cancelled: [] }
}
export const BOOKING_STATUSES: Record<BookingType, readonly string[]> = Object.fromEntries(
  Object.entries(BOOKING_TRANSITIONS).map(([type, map]) => [type, Object.keys(map)])
) as Record<BookingType, readonly string[]>
export const BOOKING_INITIAL_STATUS: Record<BookingType, string> = { flight: 'requested', hotel: 'requested', transport: 'requested', mice: 'planning' }
/** Same guards as the frontend `update*` mutators. */
export const BOOKING_LOCKED_FOR_EDIT: Record<BookingType, readonly string[]> = {
  flight: ['refunded'], hotel: ['completed', 'cancelled', 'no-show'], transport: ['completed', 'cancelled', 'no-show'], mice: ['completed', 'cancelled']
}

export const serviceTypeOf = (type: BookingType): ServiceType => (type === 'transport' ? 'transportation' : type)
const LABELS: Record<ServiceType, string> = { flight: 'Flight', hotel: 'Hotel', transportation: 'Transportation', mice: 'MICE', additional: 'Additional' }
export const defaultServiceLabel = (t: ServiceType) => LABELS[t]

export function serviceStatusFor(type: BookingType, status: string): ServiceStatus {
  if (status === 'cancelled' || status === 'refunded' || status === 'no-show') return 'cancelled'
  if (status === 'completed') return 'completed'
  if (status === 'quoted' && (type === 'hotel' || type === 'transport')) return 'quoted'
  if (status === 'reissued' || (type === 'hotel' && status === 'amended')) return 'changed'
  if (status === 'confirmed' || (type === 'flight' && status === 'issued') || (type === 'mice' && status === 'in-progress')) return 'confirmed'
  return 'pending-confirmation'
}

/** Columns of the booking itself — never stored inside `details`. */
export const CORE_BOOKING_KEYS = ['id', 'projectId', 'serviceId', 'status', 'statusReason', 'netCostIdr', 'sellPriceIdr', 'pnr', 'confirmationNumber', 'createdAt', 'updatedAt'] as const
const MAX_DETAILS_BYTES = 64 * 1024
const MAX_PRICE = 1_000_000_000_000_000
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/
/** Arrays the server reads, and the date field inside each item. */
const ARRAYS: Record<BookingType, Record<string, string | null>> = {
  flight: { options: null, segments: 'departureAt', travelerIds: null },
  hotel: { options: null, travelerIds: null },
  transport: { options: null, legs: 'scheduledAt', travelerIds: null },
  mice: { sessions: 'startAt', participantCategories: null, boqItems: null, staffAssignments: null, checklist: null, deliverables: null }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPrice = (v: unknown) => v === undefined || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_PRICE)

export function cleanDetails(type: BookingType, raw: unknown, problems: FieldErrors): Record<string, unknown> | undefined {
  const fail = (message: string) => { problems.details = [message]; return undefined }
  if (!isObject(raw)) return fail('Detail booking harus berupa objek.')
  const details: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (!(CORE_BOOKING_KEYS as readonly string[]).includes(k)) details[k] = v
  if (new TextEncoder().encode(JSON.stringify(details)).length > MAX_DETAILS_BYTES) return fail('Detail booking terlalu besar (maks 64 KB).')
  for (const [key, dateField] of Object.entries(ARRAYS[type])) {
    const list = details[key]
    if (list === undefined) continue
    if (!Array.isArray(list)) return fail(`${key} harus berupa daftar.`)
    for (const item of list) {
      if (key === 'travelerIds' ? typeof item !== 'string' : !isObject(item)) return fail(`Isi ${key} tidak valid.`)
      if (dateField && isObject(item) && item[dateField] !== undefined && !(typeof item[dateField] === 'string' && DATE_PREFIX.test(item[dateField] as string))) {
        return fail(`${key}.${dateField} harus tanggal (YYYY-MM-DD…).`)
      }
      if (key === 'boqItems' && isObject(item) && !(isPrice(item.sellPriceIdr) && isPrice(item.netCostIdr))) return fail('Harga BOQ harus bilangan bulat ≥ 0.')
    }
  }
  if (type === 'hotel' && details.checkInDate !== undefined && !(typeof details.checkInDate === 'string' && DATE_PREFIX.test(details.checkInDate))) {
    return fail('checkInDate harus tanggal (YYYY-MM-DD).')
  }
  return details
}

const earliest = (values: unknown[]): string | null =>
  values.filter((v): v is string => typeof v === 'string' && DATE_PREFIX.test(v)).map(v => v.slice(0, 10)).sort()[0] ?? null
const field = (list: unknown, name: string) => (Array.isArray(list) ? list.map(i => (isObject(i) ? i[name] : undefined)) : [])

export function departureDateOf(type: BookingType, details: Record<string, unknown>): string | null {
  if (type === 'flight') return earliest(field(details.segments, 'departureAt'))
  if (type === 'hotel') return earliest([details.checkInDate])
  if (type === 'transport') return earliest(field(details.legs, 'scheduledAt'))
  return earliest(field(details.sessions, 'startAt'))
}

/** MICE price lives on BOQ lines (same rule as the frontend `getMiceBoqTotals`). */
export function miceTotals(details: Record<string, unknown>): { sellMinor: string | null; netMinor: string | null } {
  const sum = (name: string) => {
    const priced = field(details.boqItems, name).filter((v): v is number => typeof v === 'number')
    return priced.length ? String(priced.reduce((s, v) => s + Math.round(v), 0)) : null
  }
  return { sellMinor: sum('sellPriceIdr'), netMinor: sum('netCostIdr') }
}
```

- [ ] **Step 4:** test → PASS; `bun run typecheck`.
- [ ] **Step 5:** Commit `feat(core): aturan booking bersama (S4a)`.

---

### Task 3: API layanan project

**Files:**
- Create: `backend/src/modules/core/service-writes.ts`, `backend/test/services-bookings.test.ts` (bagian layanan)
- Modify: `backend/src/modules/core/repository.ts` (view + list), `backend/src/modules/core/routes.ts`

**Interfaces:**
- Consumes: Task 1 kolom, Task 2 `SERVICE_TYPES`, `SERVICE_STATUSES`, `defaultServiceLabel`.
- Produces:
  - `listProjectServices(db, actor, filter: { projectId?: string }): Promise<ServiceView[]>`, `getProjectService(db, actor, id): Promise<ServiceView | null>`
  - `ServiceView = { id, projectId, type, label, status, vendorId, bookingReference, budgetMinor, hasBookings, provenance }` (`budgetMinor` null bila tidak boleh lihat komersial)
  - `createService(tx, actor, projectId, input, requestId): Promise<{ id: string }>`, `updateService(tx, actor, id, input, requestId): Promise<void>`
  - `insertService(tx, { projectId, type, label, vendorId?, budgetMinor?, bookingReference?, status? }): Promise<string>` (dipakai Task 4)
  - Routes `GET /project-services`, `POST /projects/:id/services`, `PATCH /project-services/:id`.

- [ ] **Step 1: Test gagal** — buat `test/services-bookings.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S4a: project services and bookings written through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s4a-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('project services', () => {
  test('admin creates a service; idempotent; validation; finance 403; portal/no session', async () => {
    const k = key()
    const res = await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'additional', label: 'Asuransi perjalanan', budgetMinor: '2500000' }, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ id: expect.stringMatching(/^SVC-\d+$/), projectId: 'PRJ-101', type: 'additional', label: 'Asuransi perjalanan', status: 'not-started', budgetMinor: '2500000', vendorId: null, hasBookings: false })
    expect((await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'additional', label: 'Asuransi perjalanan', budgetMinor: '2500000' }, k)).json.data.id).toBe(res.json.data.id)
    expect((await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'additional', label: 'X' })).status).toBe(400) // no key
    const bad = await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'kapal', label: ' ', budgetMinor: '-1', vendorId: 'VND-999' }, key())
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['budgetMinor', 'label', 'type', 'vendorId'])
    expect((await call('POST', '/projects/PRJ-101/services', 'finance', { type: 'hotel', label: 'X' }, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/services', 'admin', { type: 'hotel', label: 'X' }, key())).status).toBe(404)
    expect((await t.call('POST', '/api/v1/projects/PRJ-101/services', { body: { type: 'hotel', label: 'X' }, headers: { 'idempotency-key': key() } })).status).toBe(401)
    const list = await call('GET', '/project-services?projectId=PRJ-101', 'finance')
    expect(list.json.data.some((s: { id: string }) => s.id === res.json.data.id)).toBe(true)
    expect((await call('GET', '/project-services', 'client')).status).toBe(403)
  })

  test('patch: label, budget, manual status only without bookings; type fixed; audit', async () => {
    const id = (await call('POST', '/projects/PRJ-102/services', 'admin', { type: 'hotel', label: 'Hotel cadangan' }, key())).json.data.id
    const res = await call('PATCH', `/project-services/${id}`, 'admin', { label: 'Hotel utama', budgetMinor: '9000000', status: 'sourcing', bookingReference: 'RSV-1' })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ label: 'Hotel utama', budgetMinor: '9000000', status: 'sourcing', bookingReference: 'RSV-1' })
    for (const body of [{ type: 'flight' }, { projectId: 'PRJ-101' }, { status: 'selesai' }]) {
      expect((await call('PATCH', `/project-services/${id}`, 'admin', body)).status, JSON.stringify(body)).toBe(400)
    }
    // SVC-1011 carries FLT-1011: its status follows the booking.
    expect((await call('PATCH', '/project-services/SVC-1011', 'admin', { status: 'completed' })).status).toBe(422)
    const [a] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'service.updated' and entity_id = $1", [id])
    expect(a!.n).toBe('1')
  })

  test('vendor change is refused once a vendor invoice points at the service (booking or service order)', async () => {
    // SVC-1011 (VND-001) carries FLT-1011.
    const inv = await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-001', vendorInvoiceNumber: 'S4A-1', booking: { type: 'flight', id: 'FLT-1011' }, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())
    expect(inv.status).toBe(201)
    const res = await call('PATCH', '/project-services/SVC-1011', 'admin', { vendorId: 'VND-002' })
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('invoice vendor')
    // A service order of the service counts too.
    const [so] = await t.db.query<{ id: string; vendor_id: string; service_id: string }>('select id, vendor_id, service_id from service_orders where service_id is not null order by id limit 1')
    const soInv = await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: so!.vendor_id, vendorInvoiceNumber: 'S4A-2', serviceOrderId: so!.id, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())
    expect(soInv.status).toBe(201)
    expect((await call('PATCH', `/project-services/${so!.service_id}`, 'admin', { vendorId: null })).status).toBe(422)
    // Without invoices the vendor can change.
    const free = (await call('POST', '/projects/PRJ-103/services', 'admin', { type: 'transportation', label: 'Bus', vendorId: 'VND-003' }, key())).json.data.id
    expect((await call('PATCH', `/project-services/${free}`, 'admin', { vendorId: 'VND-005' })).json.data.vendorId).toBe('VND-005')
  })
})
```

- [ ] **Step 2:** `bun test --timeout 30000 test/services-bookings.test.ts` → FAIL (404 route).

- [ ] **Step 3: repository** — tambah di `repository.ts` (setelah `getBookingRef`):

```ts
interface ServiceRow extends Record<string, unknown> {
  id: string; project_id: string; service_type: string; label: string; status: string; vendor_id: string | null
  booking_reference: string | null; budget_minor: string | null; has_bookings: boolean; provenance: string
}
const SERVICE_SELECT = `
  select ps.id, ps.project_id, ps.service_type, ps.label, ps.status, ps.vendor_id, ps.booking_reference, ps.budget_minor, ps.provenance,
         exists (select 1 from booking_refs b where b.service_id = ps.id) as has_bookings
    from project_services ps join projects p on p.id = ps.project_id`

const serviceView = (actor: Actor, r: ServiceRow) => ({
  id: r.id, projectId: r.project_id, type: r.service_type, label: r.label, status: r.status, vendorId: r.vendor_id,
  bookingReference: r.booking_reference, budgetMinor: canSeeCommercials(actor) ? r.budget_minor : null, hasBookings: r.has_bookings, provenance: r.provenance
})
export type ServiceView = ReturnType<typeof serviceView>

/** Services in the actor's project scope; a vendor sees only its own services. Clients are refused by the route. */
export async function listProjectServices(db: Db, actor: Actor, filter: { projectId?: string; id?: string }) {
  const params: unknown[] = []
  const where = [projectScopeSql(projectScopeOf(actor), params)]
  if (actor.role === 'vendor') { params.push(actor.vendorId); where.push(`ps.vendor_id = $${params.length}`) }
  if (filter.projectId) { params.push(filter.projectId); where.push(`ps.project_id = $${params.length}`) }
  if (filter.id) { params.push(filter.id); where.push(`ps.id = $${params.length}`) }
  const rows = await db.query<ServiceRow>(`${SERVICE_SELECT} where ${where.join(' and ')} order by ps.project_id, ps.id`, params)
  return rows.map(r => serviceView(actor, r))
}

export async function getProjectService(db: Db, actor: Actor, id: string) {
  return (await listProjectServices(db, actor, { id }))[0] ?? null
}
```

- [ ] **Step 4: `service-writes.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { SERVICE_STATUSES, SERVICE_TYPES, type ServiceStatus, type ServiceType } from './booking-rules'

/**
 * Project services (S4a): one row per service line of a project. Rows that carry a booking take their status
 * from the booking (booking-writes); the rest are set by hand. A vendor change is refused once Finance holds a
 * vendor invoice for the service, because payables checks invoice vendor = service vendor.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const MAX = 1_000_000_000_000_000n

function text(value: unknown, field: string, label: string, problems: FieldErrors, required: boolean, max = 200): string | null | undefined {
  if (value === undefined) { if (required) problems[field] = [`${label} wajib diisi.`]; return undefined }
  if (value === null && !required) return null
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) { if (required) { problems[field] = [`${label} wajib diisi.`]; return undefined } return null }
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s
}

export function money(value: unknown, field: string, problems: FieldErrors): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  try {
    const v = parseAmountMinor(value, field, { allowZero: true })
    if (v > MAX) { problems[field] = ['Nilai terlalu besar.']; return undefined }
    return v.toString()
  } catch {
    problems[field] = ['Harus angka rupiah ≥ 0.']
    return undefined
  }
}

async function vendorOk(tx: Queryable, vendorId: unknown, problems: FieldErrors): Promise<string | null | undefined> {
  if (vendorId === undefined) return undefined
  if (vendorId === null) return null
  if (typeof vendorId !== 'string' || !ID_PATTERN.test(vendorId) ||
    !(await tx.query("select 1 from vendors where id = $1 and status in ('active', 'pending')", [vendorId])).length) {
    problems.vendorId = ['Vendor tidak ditemukan atau tidak aktif.']
    return undefined
  }
  return vendorId
}

export async function insertService(tx: Queryable, s: { projectId: string; type: ServiceType; label: string; vendorId?: string | null; budgetMinor?: string | null; bookingReference?: string | null; status?: ServiceStatus }): Promise<string> {
  const id = await nextId(tx, 'SVC-')
  await tx.query(
    'insert into project_services (id, project_id, service_type, label, status, vendor_id, budget_minor, booking_reference) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, s.projectId, s.type, s.label, s.status ?? 'not-started', s.vendorId ?? null, s.budgetMinor ?? null, s.bookingReference ?? null]
  )
  return id
}

export async function createService(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const type = (SERVICE_TYPES as readonly unknown[]).includes(input.type) ? input.type as ServiceType : undefined
  if (!type) problems.type = ['Jenis layanan tidak dikenal.']
  const label = text(input.label, 'label', 'Nama layanan', problems, true)
  const budgetMinor = money(input.budgetMinor, 'budgetMinor', problems)
  const bookingReference = text(input.bookingReference, 'bookingReference', 'Referensi', problems, false, 100)
  const vendorId = await vendorOk(tx, input.vendorId, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await insertService(tx, { projectId, type: type!, label: label as string, vendorId, budgetMinor, bookingReference })
  await recordAudit(tx, { action: 'service.created', actorUserId: actor.userId, entityType: 'project_service', entityId: id, requestId, after: { projectId, type, label, vendorId: vendorId ?? null, budgetMinor: budgetMinor ?? null } })
  return { id }
}

const FORBIDDEN = ['id', 'projectId', 'type', 'serviceType', 'provenance']
const COLUMNS: Record<string, string> = { label: 'label', status: 'status', budgetMinor: 'budget_minor', bookingReference: 'booking_reference', vendorId: 'vendor_id' }

export async function updateService(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit layanan.']])))
  const [cur] = await tx.query<Record<string, unknown>>(
    `select label, status, budget_minor, booking_reference, vendor_id, exists (select 1 from booking_refs b where b.service_id = ps.id) as has_bookings
       from project_services ps where id = $1 for update`, [id])
  if (!cur) throw errors.notFound('Layanan')
  const problems: FieldErrors = {}
  const next: Record<string, unknown> = {}
  if (input.label !== undefined) next.label = text(input.label, 'label', 'Nama layanan', problems, true)
  if (input.status !== undefined) {
    if (!(SERVICE_STATUSES as readonly unknown[]).includes(input.status)) problems.status = ['Status layanan tidak dikenal.']
    else next.status = input.status
  }
  const budget = money(input.budgetMinor, 'budgetMinor', problems)
  if (budget !== undefined) next.budgetMinor = budget
  const ref = text(input.bookingReference, 'bookingReference', 'Referensi', problems, false, 100)
  if (ref !== undefined) next.bookingReference = ref
  const vendor = await vendorOk(tx, input.vendorId, problems)
  if (vendor !== undefined) next.vendorId = vendor
  if (Object.keys(problems).length) throw errors.validation(problems)
  // Drop values that do not change anything (no empty audit rows).
  for (const k of Object.keys(next)) if (String(next[k] ?? '') === String(cur[COLUMNS[k]!] ?? '')) delete next[k]
  const keys = Object.keys(next)
  if (!keys.length) return
  if (next.status !== undefined && cur.has_bookings) throw rule('Status layanan ini mengikuti booking-nya — ubah status di halaman booking.')
  if ('vendorId' in next) {
    const [used] = await tx.query(
      `select 1 from vendor_invoices v
        where v.status not in ('rejected', 'void')
          and ((v.booking_type, v.booking_id) in (select booking_type, booking_id from booking_refs where service_id = $1)
               or v.service_order_id in (select id from service_orders where service_id = $1))
        limit 1`, [id])
    if (used) throw rule('Vendor layanan ini tidak bisa diganti: sudah ada invoice vendor untuk layanan ini di Finance.')
  }
  await tx.query(`update project_services set ${keys.map((k, i) => `${COLUMNS[k]} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...keys.map(k => next[k])])
  await recordAudit(tx, {
    action: 'service.updated', actorUserId: actor.userId, entityType: 'project_service', entityId: id, requestId,
    before: Object.fromEntries(keys.map(k => [k, cur[COLUMNS[k]!] ?? null])), after: next
  })
}
```

- [ ] **Step 5: routes** — di `routes.ts`, import `hasCapability` dari `../../auth/rbac`, `SERVICE_TYPES`/`type ServiceType` dari `./booking-rules`, `createService`, `updateService` dari `./service-writes`, `getProjectService`, `listProjectServices` dari `./repository`. Helper dalam `coreRoutes`:

```ts
  function requireServiceCapability(actor: SessionActor, type: string) {
    const cap = `project-order.manage-service.${type}` as Parameters<typeof hasCapability>[1]
    if (isPortalActor(actor) || !(SERVICE_TYPES as readonly string[]).includes(type) || !hasCapability(actor.role, cap)) throw errors.forbidden()
  }
```

Rute (sebelum `.get('/service-orders/:id'`):

```ts
    .get('/project-services', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client') throw errors.forbidden()
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID project tidak valid.'] })
      return ok(request, await listProjectServices(db, actor, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/services', async ({ request, params, body, set }) => {
      const actor = await auth.requireActor(request)
      const b = body as Record<string, unknown>
      if (isPortalActor(actor)) throw errors.forbidden()
      // An unknown type is a validation error; a known type needs its capability.
      if ((SERVICE_TYPES as readonly unknown[]).includes(b.type)) requireServiceCapability(actor, b.type as string)
      else if (!SERVICE_TYPES.some(s => hasCapability(actor.role, `project-order.manage-service.${s}` as Parameters<typeof hasCapability>[1]))) throw errors.forbidden()
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: `POST /projects/${projectId}/services`, key, body }, tx =>
        createService(tx, actor, projectId, b, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getProjectService(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/project-services/:id', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Layanan')
      const current = isPortalActor(actor) ? null : await getProjectService(db, actor, id)
      if (!current) throw errors.notFound('Layanan')
      requireServiceCapability(actor, current.type)
      await db.transaction(tx => updateService(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getProjectService(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
```

Catatan: finance tidak punya `manage-service.*` → 403 sebelum validasi. Urutan di POST: 401 (requireActor) → 403 → 404 project → 400 key → 400 validasi.

- [ ] **Step 6:** test → PASS (3 test layanan); `bun run typecheck`.
- [ ] **Step 7:** Commit `feat(core): layanan project lewat API (S4a)`.

---

### Task 4: API booking

**Files:**
- Create: `backend/src/modules/core/booking-writes.ts`, `backend/src/modules/core/booking-status.ts`
- Modify: `backend/src/modules/core/repository.ts`, `backend/src/modules/core/routes.ts`, `backend/src/modules/finance/summaries.ts`
- Test: `backend/test/services-bookings.test.ts` (bagian booking)

**Interfaces:**
- Consumes: Task 2 semua ekspor; Task 3 `insertService`, `money`.
- Produces:
  - `listBookings(db, actor, filter: { projectId?: string; type?: BookingType; id?: string }): Promise<BookingView[]>`, `getBooking(db, actor, type, id)`
  - `BookingView = { type, id, projectId, serviceId, serviceType, vendorId, status, statusReason, reference, sellAmountMinor, netCostMinor, departureDate, details, createdAt, updatedAt }` (`sellAmountMinor`/`netCostMinor` null bila tak boleh lihat komersial; portal: hanya `{ type, id, projectId, status }`)
  - `bookingBilledNetMinor(q, type, id): Promise<bigint>` (summaries.ts)
  - `createBooking(tx, actor, type, projectId, input, requestId): Promise<{ id: string }>`, `updateBooking(tx, actor, type, id, input, requestId)`, `changeBookingStatus(tx, actor, type, id, to, reason, requestId)`
  - `booking-status.ts`: `setBookingStatus(tx, actor, type, id, from, to, reason, requestId)` (update booking + layanan + audit), `bookingHasFinance(tx, type, id): Promise<boolean>`
  - Routes `GET /bookings`, `POST /bookings/:type`, `PATCH /bookings/:type/:id`, `POST /bookings/:type/:id/status`.

- [ ] **Step 1: Test gagal** — tambah ke `services-bookings.test.ts`:

```ts
describe('bookings', () => {
  const flight = { departureAt: '2026-11-02T07:00' }
  test('create reuses an empty service or makes one; derived departure; idempotent; validation', async () => {
    const empty = (await call('POST', '/projects/PRJ-104/services', 'admin', { type: 'hotel', label: 'Hotel Bali' }, key())).json.data.id
    const k = key()
    const res = await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-104', reference: 'CONF-9', sellAmountMinor: '7000000', netCostMinor: '6000000', details: { checkInDate: '2026-11-03', options: [], travelerIds: [], status: 'completed', id: 'HTL-X' } }, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ type: 'hotel', id: expect.stringMatching(/^HTL-\d+$/), projectId: 'PRJ-104', serviceId: empty, status: 'requested', reference: 'CONF-9', sellAmountMinor: '7000000', netCostMinor: '6000000', departureDate: '2026-11-03' })
    expect(res.json.data.details).toEqual({ checkInDate: '2026-11-03', options: [], travelerIds: [] })
    const svc = (await call('GET', '/project-services?projectId=PRJ-104', 'admin')).json.data.find((s: { id: string }) => s.id === empty)
    expect(svc).toMatchObject({ status: 'pending-confirmation', bookingReference: 'CONF-9', hasBookings: true })
    expect((await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-104', reference: 'CONF-9', sellAmountMinor: '7000000', netCostMinor: '6000000', details: { checkInDate: '2026-11-03', options: [], travelerIds: [], status: 'completed', id: 'HTL-X' } }, k)).json.data.id).toBe(res.json.data.id)

    const made = await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', label: 'Flight Bali', details: { segments: [flight] } }, key())
    expect(made.status).toBe(201)
    expect(made.json.data).toMatchObject({ status: 'requested', departureDate: '2026-11-02', sellAmountMinor: null })
    const newSvc = (await call('GET', '/project-services?projectId=PRJ-104', 'admin')).json.data.find((s: { id: string }) => s.id === made.json.data.serviceId)
    expect(newSvc).toMatchObject({ type: 'flight', label: 'Flight Bali', status: 'pending-confirmation' })

    // A service of another project or another type is refused (no cross-project link).
    expect((await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', serviceId: 'SVC-1011', details: {} }, key())).status).toBe(400)
    expect((await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', serviceId: empty, details: {} }, key())).status).toBe(400)
    const bad = await call('POST', '/bookings/mice', 'admin', { projectId: 'PRJ-104', sellAmountMinor: '5', details: [] }, key())
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['details', 'sellAmountMinor'])
    expect((await call('POST', '/bookings/kapal', 'admin', { projectId: 'PRJ-104', details: {} }, key())).status).toBe(400)
    expect((await call('POST', '/bookings/flight', 'finance', { projectId: 'PRJ-104', details: {} }, key())).status).toBe(403)
    expect((await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', details: {} })).status).toBe(400) // no key
  })

  test('MICE price comes from the BOQ; list hides net cost from nobody internal and refuses clients', async () => {
    const res = await call('POST', '/bookings/mice', 'admin', { projectId: 'PRJ-105', details: { sessions: [{ startAt: '2026-12-01T09:00' }], boqItems: [{ description: 'Sound', sellPriceIdr: 3000000, netCostIdr: 2000000 }] } }, key())
    expect(res.json.data).toMatchObject({ status: 'planning', sellAmountMinor: '3000000', netCostMinor: '2000000', departureDate: '2026-12-01' })
    const list = await call('GET', '/bookings?projectId=PRJ-105&type=mice', 'finance')
    expect(list.json.data.find((b: { id: string }) => b.id === res.json.data.id)).toMatchObject({ netCostMinor: '2000000' })
    expect((await call('GET', '/bookings', 'client')).status).toBe(403)
  })

  test('patch: details, prices, reference; locked fields; not below what is billed (also when cleared)', async () => {
    const id = (await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-106', sellAmountMinor: '4000000', details: { legs: [{ pickupLocation: 'A', dropoffLocation: 'B', scheduledAt: '2026-10-20T08:00' }] } }, key())).json.data.id
    const res = await call('PATCH', `/bookings/transport/${id}`, 'admin', { details: { legs: [{ pickupLocation: 'A', dropoffLocation: 'C', scheduledAt: '2026-10-19T08:00' }], driverName: 'Udin' }, reference: 'TRF-1' })
    expect(res.json.data).toMatchObject({ departureDate: '2026-10-19', reference: 'TRF-1', details: { driverName: 'Udin' } })
    for (const body of [{ projectId: 'PRJ-101' }, { serviceId: 'SVC-1011' }, { status: 'confirmed' }, { type: 'hotel' }]) {
      expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', body)).status, JSON.stringify(body)).toBe(400)
    }
    const inv = await call('POST', '/finance/customer-invoices', 'finance', { projectId: 'PRJ-106', booking: { type: 'transport', id }, invoiceType: 'dp', lines: [{ description: 'DP bus', amountMinor: '3000000' }], dueDate: '2026-10-30' }, key())
    expect(inv.status).toBe(201)
    expect((await call('POST', `/finance/customer-invoices/${inv.json.data.id}/issue`, 'finance', {}, key())).status).toBe(200)
    const low = await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: '2500000' })
    expect(low.status).toBe(422)
    expect(low.json.error.message).toContain('3.000.000')
    expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: null })).status).toBe(422)
    expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: '3000000' })).status).toBe(200)
    expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: '5000000' })).status).toBe(200)
  })

  test('status: valid transitions, reason, service follows, locked after terminal; cancel refused with finance records', async () => {
    const id = (await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-107', details: { segments: [flight] } }, key())).json.data.id
    expect((await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'issued' })).status).toBe(422)
    const held = await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'confirmed' })
    expect(held.json.data.status).toBe('confirmed')
    const svc = (await call('GET', '/project-services?projectId=PRJ-107', 'admin')).json.data.find((s: { id: string }) => s.id === held.json.data.serviceId)
    expect(svc.status).toBe('confirmed')
    expect((await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'cancelled' })).status).toBe(400) // reason
    expect((await call('POST', `/bookings/flight/${id}/status`, 'finance', { to: 'issued' })).status).toBe(403)

    const [audit] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'booking.status_changed' and entity_id = $1", [id])
    expect(audit!.n).toBe('1')

    // With a vendor invoice on it, cancelling goes through Finance.
    const vendorId = (await call('GET', '/project-services?projectId=PRJ-107', 'admin')).json.data.find((s: { id: string }) => s.id === held.json.data.serviceId).vendorId ?? null
    const svcId = held.json.data.serviceId
    if (!vendorId) await call('PATCH', `/project-services/${svcId}`, 'admin', { vendorId: 'VND-001' })
    expect((await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: vendorId ?? 'VND-001', vendorInvoiceNumber: 'S4A-3', booking: { type: 'flight', id }, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())).status).toBe(201)
    const refused = await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'cancelled', reason: 'Customer batal' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('lewat Finance')

    // A booking without finance records cancels directly; then it is locked for edits only where the frontend locks it.
    const hotel = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-107', details: {} }, key())).json.data.id
    expect((await call('POST', `/bookings/hotel/${hotel}/status`, 'admin', { to: 'cancelled', reason: 'Ganti hotel' })).json.data).toMatchObject({ status: 'cancelled', statusReason: 'Ganti hotel' })
    expect((await call('PATCH', `/bookings/hotel/${hotel}`, 'admin', { reference: 'X' })).status).toBe(422)
  })
})
```

- [ ] **Step 2:** test booking → FAIL (404).

- [ ] **Step 3: `summaries.ts`** — ekstrak dan pakai ulang:

```ts
/** "Sudah ditagih" for one booking: issued invoices minus credit notes, cancellation write-offs still count as billed. */
export async function bookingBilledNetMinor(q: Queryable, type: string, id: string): Promise<bigint> {
  const invoices = await q.query<InvoiceBalanceRow>(
    `${INVOICES_WITH_BALANCE} where i.booking_type = $1 and i.booking_id = $2 and i.status = 'issued'`, [type, id]
  )
  return invoices.reduce((s, i) => s + BigInt(i.total_minor) - BigInt(i.credited_minor) + BigInt(i.cancel_writeoff_minor), 0n)
}
```

dan di `bookingFinanceSummary` ganti baris `const billedNet = invoices.filter(...)…` menjadi `const billedNet = await bookingBilledNetMinor(db, type, id)` (hasil sama: filter `issued`). Pastikan `Queryable` di-import.

- [ ] **Step 4: repository** — `listBookings`/`getBooking`:

```ts
interface BookingFullRow extends BookingRow {
  status: string; status_reason: string | null; reference: string | null; net_cost_minor: string | null
  details: Record<string, unknown>; created_at: string; updated_at: string
}

/** Full bookings in the actor's scope (vendors: only on their own services). Clients are refused by the route. */
export async function listBookings(db: Db, actor: Actor, filter: { projectId?: string; type?: BookingType; id?: string }) {
  const params: unknown[] = []
  const where = [projectScopeSql(projectScopeOf(actor), params)]
  if (actor.role === 'vendor') { params.push(actor.vendorId); where.push(`ps.vendor_id = $${params.length}`) }
  if (filter.projectId) { params.push(filter.projectId); where.push(`b.project_id = $${params.length}`) }
  if (filter.type) { params.push(filter.type); where.push(`b.booking_type = $${params.length}`) }
  if (filter.id) { params.push(filter.id); where.push(`b.booking_id = $${params.length}`) }
  const rows = await db.query<BookingFullRow>(
    `select b.booking_type, b.booking_id, b.project_id, b.service_id, ps.service_type, ps.vendor_id, b.sell_amount_minor, b.departure_date,
            b.status, b.status_reason, b.reference, b.net_cost_minor, b.details,
            to_char(b.created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as created_at, to_char(b.updated_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as updated_at
       from booking_refs b join projects p on p.id = b.project_id left join project_services ps on ps.id = b.service_id
      where ${where.join(' and ')} order by b.project_id, b.booking_type, b.booking_id`, params)
  return rows.map(r => {
    if (isPortalActor(actor)) return { type: r.booking_type, id: r.booking_id, projectId: r.project_id, status: r.status }
    const commercial = canSeeCommercials(actor)
    return {
      type: r.booking_type, id: r.booking_id, projectId: r.project_id, serviceId: r.service_id, serviceType: r.service_type, vendorId: r.vendor_id,
      status: r.status, statusReason: r.status_reason, reference: r.reference,
      sellAmountMinor: commercial ? r.sell_amount_minor : null, netCostMinor: commercial ? r.net_cost_minor : null,
      departureDate: r.departure_date, details: r.details, createdAt: r.created_at, updatedAt: r.updated_at
    }
  })
}
export type BookingView = Awaited<ReturnType<typeof listBookings>>[number]

export async function getBooking(db: Db, actor: Actor, type: BookingType, id: string) {
  return (await listBookings(db, actor, { type, id }))[0] ?? null
}
```

(`departure_date` keluar sebagai string `YYYY-MM-DD` — cek bentuk yang dipakai `getBookingRef`; samakan bila perlu dengan `to_char`.)

- [ ] **Step 5: `booking-status.ts`** (tanpa import summaries/refunds — dipakai refunds di Task 5):

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { recordAudit } from '../../shared/audit'
import { serviceStatusFor } from './booking-rules'
import type { BookingType } from './repository'

/** Booking status writes shared by the booking API and the Finance cancellation hook. */

export async function setBookingStatus(tx: Queryable, actor: Actor, type: BookingType, id: string, from: string, to: string, reason: string | null, requestId: string) {
  const [b] = await tx.query<{ service_id: string | null }>(
    `update booking_refs set status = $3, status_reason = coalesce($4, status_reason), updated_at = now()
      where booking_type = $1 and booking_id = $2 returning service_id`, [type, id, to, reason])
  if (b?.service_id) await tx.query('update project_services set status = $2, updated_at = now() where id = $1', [b.service_id, serviceStatusFor(type, to)])
  await recordAudit(tx, { action: 'booking.status_changed', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId, reason, before: { type, status: from }, after: { type, status: to } })
}

/** Any Finance record on the booking: such a booking is cancelled through Finance, not by Operations. */
export async function bookingHasFinance(tx: Queryable, type: string, id: string): Promise<boolean> {
  const [r] = await tx.query<{ blocked: boolean }>(
    `select exists (select 1 from customer_invoices where booking_type = $1 and booking_id = $2 and status <> 'void')
         or exists (select 1 from vendor_invoices where booking_type = $1 and booking_id = $2 and status not in ('rejected', 'void'))
         or exists (select 1 from financial_transactions where booking_type = $1 and booking_id = $2)
         or exists (select 1 from billing_schedule_items where booking_type = $1 and booking_id = $2 and status = 'planned')
         or exists (select 1 from refunds where subject_type = $1 and subject_id = $2 and status <> 'rejected') as blocked`, [type, id])
  return r!.blocked
}
```

- [ ] **Step 6: `booking-writes.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { bookingBilledNetMinor } from '../finance/summaries'
import { BOOKING_INITIAL_STATUS, BOOKING_LOCKED_FOR_EDIT, BOOKING_STATUSES, BOOKING_TRANSITIONS, cleanDetails, defaultServiceLabel, departureDateOf, miceTotals, serviceStatusFor, serviceTypeOf } from './booking-rules'
import { bookingHasFinance, setBookingStatus } from './booking-status'
import type { BookingType } from './repository'
import { insertService, money } from './service-writes'

/**
 * Bookings (S4a): flight/hotel/transport/MICE on `booking_refs`. Core columns + `details` (UI-owned shape).
 * Sell price, net cost and departure date are what Finance reads; MICE prices and every departure date are
 * derived from `details`. A booking always sits on a project service whose status follows the booking.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const PREFIX: Record<BookingType, 'FLT-' | 'HTL-' | 'TRN-' | 'MICE-'> = { flight: 'FLT-', hotel: 'HTL-', transport: 'TRN-', mice: 'MICE-' }
const rupiah = (v: bigint) => `Rp ${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

function reference(value: unknown, problems: FieldErrors): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems.reference = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > 100) { problems.reference = ['Maksimal 100 karakter.']; return undefined }
  return s || null
}

function prices(type: BookingType, input: Record<string, unknown>, problems: FieldErrors) {
  if (type === 'mice') {
    for (const k of ['sellAmountMinor', 'netCostMinor']) if (input[k] !== undefined) problems[k] = ['Harga MICE dihitung dari BOQ.']
    return { sell: undefined, net: undefined }
  }
  return { sell: money(input.sellAmountMinor, 'sellAmountMinor', problems), net: money(input.netCostMinor, 'netCostMinor', problems) }
}

export async function createBooking(tx: Queryable, actor: Actor, type: BookingType, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const details = cleanDetails(type, input.details ?? {}, problems)
  const ref = reference(input.reference, problems)
  const { sell, net } = prices(type, input, problems)
  const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 200) : defaultServiceLabel(serviceTypeOf(type))
  let serviceId: string | undefined
  if (input.serviceId !== undefined && input.serviceId !== null) {
    const [s] = typeof input.serviceId === 'string' && ID_PATTERN.test(input.serviceId)
      ? await tx.query<{ id: string }>('select id from project_services where id = $1 and project_id = $2 and service_type = $3 for update', [input.serviceId, projectId, serviceTypeOf(type)])
      : []
    if (!s) problems.serviceId = ['Layanan tidak ditemukan di project ini untuk jenis booking ini.']
    else serviceId = s.id
  }
  if (Object.keys(problems).length) throw errors.validation(problems)

  const status = BOOKING_INITIAL_STATUS[type]
  const serviceStatus = serviceStatusFor(type, status)
  let serviceCreated = false
  if (!serviceId) {
    const [reuse] = await tx.query<{ id: string }>(
      `select ps.id from project_services ps
        where ps.project_id = $1 and ps.service_type = $2 and ps.status = 'not-started' and ps.booking_reference is null
          and not exists (select 1 from booking_refs b where b.service_id = ps.id)
        order by ps.id limit 1 for update`, [projectId, serviceTypeOf(type)])
    if (reuse) serviceId = reuse.id
    else { serviceId = await insertService(tx, { projectId, type: serviceTypeOf(type), label, status: serviceStatus }); serviceCreated = true }
  }
  await tx.query('update project_services set status = $2, booking_reference = coalesce($3, booking_reference), updated_at = now() where id = $1', [serviceId, serviceStatus, ref ?? null])

  const derived = type === 'mice' ? miceTotals(details!) : { sellMinor: sell ?? null, netMinor: net ?? null }
  const id = await nextId(tx, PREFIX[type])
  await tx.query(
    `insert into booking_refs (booking_type, booking_id, project_id, service_id, status, reference, sell_amount_minor, net_cost_minor, departure_date, details)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text::jsonb)`,
    [type, id, projectId, serviceId, status, ref ?? null, derived.sellMinor, derived.netMinor, departureDateOf(type, details!), JSON.stringify(details)]
  )
  if (serviceCreated) await recordAudit(tx, { action: 'service.created', actorUserId: actor.userId, entityType: 'project_service', entityId: serviceId!, requestId, after: { projectId, type: serviceTypeOf(type), label, viaBooking: id } })
  await recordAudit(tx, { action: 'booking.created', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId, after: { type, projectId, serviceId, status, sellAmountMinor: derived.sellMinor } })
  return { id }
}

const FORBIDDEN = ['type', 'id', 'projectId', 'serviceId', 'status', 'statusReason', 'departureDate', 'provenance']

export async function updateBooking(tx: Queryable, actor: Actor, type: BookingType, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit booking.']])))
  const [cur] = await tx.query<{ status: string; service_id: string | null; reference: string | null; sell_amount_minor: string | null; net_cost_minor: string | null; details: Record<string, unknown> }>(
    'select status, service_id, reference, sell_amount_minor, net_cost_minor, details from booking_refs where booking_type = $1 and booking_id = $2 for update', [type, id])
  if (!cur) throw errors.notFound('Booking')
  if (BOOKING_LOCKED_FOR_EDIT[type].includes(cur.status)) throw rule(`Booking berstatus ${cur.status} tidak bisa diedit lagi.`)
  const problems: FieldErrors = {}
  const details = input.details === undefined ? cur.details : cleanDetails(type, input.details, problems)
  const ref = reference(input.reference, problems)
  const { sell, net } = prices(type, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const totals = type === 'mice' ? miceTotals(details!) : null
  const nextSell = totals ? totals.sellMinor : sell === undefined ? cur.sell_amount_minor : sell
  const nextNet = totals ? totals.netMinor : net === undefined ? cur.net_cost_minor : net
  if (nextSell !== cur.sell_amount_minor) {
    const billed = await bookingBilledNetMinor(tx, type, id)
    if (billed > 0n && BigInt(nextSell ?? 0) < billed) {
      throw rule(`Harga jual tidak boleh di bawah yang sudah ditagih (${rupiah(billed)}). Kalau harga memang turun, minta Finance membuat credit note dulu.`)
    }
  }
  const nextRef = ref === undefined ? cur.reference : ref
  await tx.query(
    `update booking_refs set details = $3::text::jsonb, reference = $4, sell_amount_minor = $5, net_cost_minor = $6, departure_date = $7, updated_at = now()
      where booking_type = $1 and booking_id = $2`,
    [type, id, JSON.stringify(details), nextRef, nextSell, nextNet, departureDateOf(type, details!)]
  )
  if (ref !== undefined && cur.service_id) await tx.query('update project_services set booking_reference = $2, updated_at = now() where id = $1', [cur.service_id, nextRef])
  await recordAudit(tx, {
    action: 'booking.updated', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId,
    before: { reference: cur.reference, sellAmountMinor: cur.sell_amount_minor, netCostMinor: cur.net_cost_minor },
    after: { reference: nextRef, sellAmountMinor: nextSell, netCostMinor: nextNet, detailsChanged: input.details !== undefined }
  })
}

export async function changeBookingStatus(tx: Queryable, actor: Actor, type: BookingType, id: string, to: unknown, reasonInput: unknown, requestId: string): Promise<void> {
  if (typeof to !== 'string' || !BOOKING_STATUSES[type].includes(to)) throw errors.validation({ to: [`Status harus salah satu dari: ${BOOKING_STATUSES[type].join(', ')}.`] })
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if ((to === 'cancelled' || to === 'refunded') && !reason) throw errors.validation({ reason: ['Alasan wajib diisi untuk pembatalan/refund.'] })
  const [cur] = await tx.query<{ status: string }>('select status from booking_refs where booking_type = $1 and booking_id = $2 for update', [type, id])
  if (!cur) throw errors.notFound('Booking')
  if (!BOOKING_TRANSITIONS[type][cur.status]?.includes(to)) throw rule(`Status booking tidak bisa diubah dari ${cur.status} ke ${to}.`)
  if (to === 'cancelled' && await bookingHasFinance(tx, type, id)) {
    throw rule('Booking ini sudah punya transaksi Finance — ajukan pembatalan lewat Finance.')
  }
  await setBookingStatus(tx, actor, type, id, cur.status, to, reason, requestId)
}
```

- [ ] **Step 7: routes** — import `changeBookingStatus, createBooking, updateBooking` dan `getBooking, listBookings`. Helper:

```ts
  function bookingType(raw: string): BookingType {
    if (!(BOOKING_TYPES as readonly string[]).includes(raw)) throw errors.validation({ type: [`Tipe booking harus salah satu dari: ${BOOKING_TYPES.join(', ')}.`] })
    return raw as BookingType
  }
  async function writableBooking(actor: SessionActor, rawType: string, rawId: string) {
    const type = bookingType(rawType)
    requireServiceCapability(actor, serviceTypeOf(type))
    const id = assertIdParam(rawId, 'Booking')
    if (!(await getBooking(db, actor, type, id))) throw errors.notFound('Booking')
    return { type, id }
  }
```

Rute (sebelum `.get('/bookings/:type/:id'`):

```ts
    .get('/bookings', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client') throw errors.forbidden()
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID project tidak valid.'] })
      return ok(request, await listBookings(db, actor, { projectId: query.projectId, type: query.type ? bookingType(query.type) : undefined }))
    }, { query: t.Object({ projectId: t.Optional(t.String()), type: t.Optional(t.String()) }) })
    .post('/bookings/:type', async ({ request, params, body, set }) => {
      const actor = await auth.requireActor(request)
      const type = bookingType(params.type)
      requireServiceCapability(actor, serviceTypeOf(type))
      const b = body as Record<string, unknown>
      if (typeof b.projectId !== 'string' || !b.projectId) throw errors.validation({ projectId: ['Project wajib diisi.'] })
      const projectId = await visibleProject(actor, b.projectId)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: `POST /bookings/${type}`, key, body }, tx =>
        createBooking(tx, actor, type, projectId, b, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getBooking(db, actor, type, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/bookings/:type/:id', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const { type, id } = await writableBooking(actor, params.type, params.id)
      await db.transaction(tx => updateBooking(tx, actor, type, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getBooking(db, actor, type, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/bookings/:type/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const { type, id } = await writableBooking(actor, params.type, params.id)
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeBookingStatus(tx, actor, type, id, b.to, b.reason, requestIdOf(request)))
      return ok(request, await getBooking(db, actor, type, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

- [ ] **Step 8:** test booking → PASS; seluruh `bun run test` (finance tetap hijau — `bookingFinanceSummary` refactor); `bun run typecheck`.
- [ ] **Step 9:** Commit `feat(core): booking flight/hotel/transport/MICE lewat API (S4a)`.

---

### Task 5: Hook pembatalan Finance untuk booking

**Files:**
- Modify: `backend/src/modules/finance/refunds.ts`
- Test: `backend/test/services-bookings.test.ts`

**Interfaces:**
- Consumes: `setBookingStatus` (Task 4), `BOOKING_TRANSITIONS`.

- [ ] **Step 1: Test gagal**:

```ts
describe('finance cancellation of a booking', () => {
  test('recording it cancels the booking; rejecting it restores the status; terminal bookings stay as they are', async () => {
    const id = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-108', sellAmountMinor: '8000000', details: { checkInDate: '2026-12-10' } }, key())).json.data.id
    await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to: 'quoted' })
    await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to: 'confirmed' })
    const kase = await call('POST', '/finance/cancellations', 'finance', { subjectType: 'hotel', subjectId: id, cancelDate: '2026-11-01', reason: 'Customer batal' }, key())
    expect(kase.status).toBe(201)
    const after = (await call('GET', `/bookings?projectId=PRJ-108&type=hotel`, 'admin')).json.data.find((b: { id: string }) => b.id === id)
    expect(after.status).toBe('cancelled')
    expect((await call('POST', `/finance/refunds/${kase.json.data.id}/reject`, 'finance', { reason: 'Batal tidak jadi' })).status).toBe(200)
    expect((await call('GET', `/bookings?projectId=PRJ-108&type=hotel`, 'admin')).json.data.find((b: { id: string }) => b.id === id).status).toBe('confirmed')

    const done = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-108', details: { checkInDate: '2026-12-11' } }, key())).json.data.id
    for (const to of ['quoted', 'confirmed', 'completed']) await call('POST', `/bookings/hotel/${done}/status`, 'admin', { to })
    expect((await call('POST', '/finance/cancellations', 'finance', { subjectType: 'hotel', subjectId: done, cancelDate: '2026-11-01', reason: 'Klaim' }, key())).status).toBe(201)
    expect((await call('GET', `/bookings?projectId=PRJ-108&type=hotel`, 'admin')).json.data.find((b: { id: string }) => b.id === done).status).toBe('completed')
  })
})
```

(Jika `POST /finance/cancellations` menolak subjek tanpa pembayaran/invoice, sesuaikan body dengan yang diterima `createCancellation` — cek `test/finance-refunds.test.ts` — dan catat ruling.)

- [ ] **Step 2:** → FAIL (status tetap `confirmed`).

- [ ] **Step 3: refunds.ts** — import `setBookingStatus` dari `../core/booking-status`, `BOOKING_TRANSITIONS` dari `../core/booking-rules`. Setelah blok `if (subject.type === 'project') {…}` di `createCancellation`:

```ts
  // S4a: a booking-level cancellation also cancels the booking, when its status still allows it.
  if (subject.type !== 'project') {
    const [b] = await tx.query<{ status: string }>('select status from booking_refs where booking_type = $1 and booking_id = $2 for update', [subject.type, subject.id])
    if (b && BOOKING_TRANSITIONS[subject.type]?.[b.status]?.includes('cancelled')) {
      await setBookingStatus(tx, actor, subject.type, subject.id, b.status, 'cancelled', reason, requestId)
    }
  }
```

Di `rejectRefund`, setelah blok project:

```ts
  // S4a: the booking this case cancelled goes back to the status it had before.
  if (subject.type !== 'project') {
    const [prev] = await tx.query<{ status: string }>(
      `select before->>'status' as status from audit_events
        where action = 'booking.status_changed' and entity_id = $1 and after->>'status' = 'cancelled' and after->>'type' = $2 order by id desc limit 1`,
      [subject.id, subject.type])
    const [b] = await tx.query<{ status: string }>('select status from booking_refs where booking_type = $1 and booking_id = $2 for update', [subject.type, subject.id])
    if (prev?.status && b?.status === 'cancelled') await setBookingStatus(tx, actor, subject.type, subject.id, 'cancelled', prev.status, reason, requestId)
  }
```

(`subject.type` bertipe `SubjectType`; bila bukan `'project'` ia adalah `BookingType` — cast bila TS minta.)

- [ ] **Step 4:** test → PASS; `bun run test` penuh (finance-refunds tetap hijau); typecheck.
- [ ] **Step 5:** Commit `feat(finance): pembatalan booking lewat Finance ikut mengubah status booking (S4a)`.

---

### Task 6: Seed & extract

**Files:**
- Modify: `backend/scripts/extract-demo-core.ts`, `backend/src/db/seed-demo.ts`, `backend/src/db/seeds/demo-core.json` (regenerate)
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Consumes: `departureDateOf`, `miceTotals`, `CORE_BOOKING_KEYS` (Task 2).
- Produces: `DemoCoreSeed.projectServices[]` + `label`, `status`, `bookingReference`, `budgetMinor`; `bookingRefs[]` + `status`, `reference`, `statusReason`, `netCostMinor`, `details`.

- [ ] **Step 1: Test gagal** `db.test.ts`:

```ts
test('seed fills services and bookings from the fixtures (S4a)', async () => {
  const [svc] = await db.query<{ label: string; status: string; booking_reference: string | null }>("select label, status, booking_reference from project_services where id = 'SVC-1011'")
  const fx = DEMO_CORE.projectServices.find(s => s.id === 'SVC-1011')!
  expect(svc).toEqual({ label: fx.label!, status: fx.status!, booking_reference: fx.bookingReference ?? null })
  const [b] = await db.query<{ status: string; reference: string | null; details: Record<string, unknown> }>("select status, reference, details from booking_refs where booking_type = 'flight' and booking_id = 'FLT-1011'")
  const fb = DEMO_CORE.bookingRefs.find(x => x.bookingId === 'FLT-1011')!
  expect(b!.status).toBe(fb.status!)
  expect(b!.reference).toBe(fb.reference ?? null)
  expect(Array.isArray(b!.details.segments)).toBe(true)
  expect('status' in b!.details).toBe(false)
  const [mice] = await db.query<{ sell_amount_minor: string | null }>("select sell_amount_minor from booking_refs where booking_type = 'mice' limit 1")
  expect(mice!.sell_amount_minor).toBe(DEMO_CORE.bookingRefs.find(x => x.bookingType === 'mice')!.sellAmountMinor)
})
```

- [ ] **Step 2:** → FAIL (fields undefined).

- [ ] **Step 3: extract** — services map tambah `label: s.label, status: s.status, bookingReference: s.bookingReference ?? null, budgetMinor: minor(s.budgetIdr)`. `bookingRef(...)` diganti agar menerima booking utuh:

```ts
import { CORE_BOOKING_KEYS, departureDateOf, miceTotals } from '../src/modules/core/booking-rules'

const detailsOf = (b: Record<string, unknown>) => Object.fromEntries(Object.entries(b).filter(([k]) => !(CORE_BOOKING_KEYS as readonly string[]).includes(k)))

function bookingRef(bookingType: DemoCoreSeed['bookingRefs'][number]['bookingType'], b: { id: string; projectId: string; serviceId?: string; status: string; statusReason?: string; netCostIdr?: number; sellPriceIdr?: number; pnr?: string; confirmationNumber?: string }) {
  let serviceId = b.serviceId ?? null
  if (serviceId && serviceProject.get(serviceId) !== b.projectId) {
    warnings.push(`${b.id}: service ${serviceId} belongs to ${serviceProject.get(serviceId) ?? 'no project'}, not ${b.projectId}; link dropped`)
    serviceId = null
  }
  const details = detailsOf(b as unknown as Record<string, unknown>)
  const totals = bookingType === 'mice' ? miceTotals(details) : { sellMinor: minor(b.sellPriceIdr), netMinor: minor(b.netCostIdr) }
  return {
    bookingType, bookingId: b.id, projectId: b.projectId, serviceId,
    sellAmountMinor: totals.sellMinor, departureDate: departureDateOf(bookingType, details),
    status: b.status, reference: b.pnr ?? b.confirmationNumber ?? null, statusReason: b.statusReason ?? null, netCostMinor: totals.netMinor, details
  }
}
```

dan pemanggilan menjadi `FLIGHT_BOOKINGS.map(b => bookingRef('flight', b))` dst. Hapus `earliestDate` dan `miceSell` lama bila tak terpakai lagi. Pastikan `sellAmountMinor`/`departureDate` hasil baru **sama** dengan JSON lama (diff `demo-core.json` hanya menambah field).

- [ ] **Step 4: seed-demo.ts** — tipe:

```ts
  projectServices: { id: string; projectId: string; serviceType: string; vendorId: string | null; label?: string; status?: string; bookingReference?: string | null; budgetMinor?: string | null }[]
  bookingRefs: {
    bookingType: 'flight' | 'hotel' | 'transport' | 'mice'
    bookingId: string
    projectId: string
    serviceId: string | null
    /** Owned by the Booking module. */
    sellAmountMinor: string | null
    departureDate: string | null
    status?: string
    reference?: string | null
    statusReason?: string | null
    netCostMinor?: string | null
    details?: Record<string, unknown>
  }[]
```

upsert layanan:

```ts
        `insert into project_services (id, project_id, service_type, vendor_id, provenance, label, status, booking_reference, budget_minor)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set project_id = excluded.project_id, service_type = excluded.service_type,
           vendor_id = excluded.vendor_id, label = excluded.label, status = excluded.status,
           booking_reference = excluded.booking_reference, budget_minor = excluded.budget_minor
         where project_services.provenance = 'demo-fixture'`,
        [s.id, s.projectId, s.serviceType, s.vendorId, P, s.label ?? defaultServiceLabel(s.serviceType as ServiceType), s.status ?? 'not-started', s.bookingReference ?? null, s.budgetMinor ?? null]
```

upsert booking:

```ts
        `insert into booking_refs (booking_type, booking_id, project_id, service_id, provenance, sell_amount_minor, departure_date, status, reference, status_reason, net_cost_minor, details)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text::jsonb)
         on conflict (booking_type, booking_id) do update set project_id = excluded.project_id, service_id = excluded.service_id,
           sell_amount_minor = excluded.sell_amount_minor, departure_date = excluded.departure_date, status = excluded.status,
           reference = excluded.reference, status_reason = excluded.status_reason, net_cost_minor = excluded.net_cost_minor, details = excluded.details
         where booking_refs.provenance = 'demo-fixture'`,
        [b.bookingType, b.bookingId, b.projectId, b.serviceId, P, b.sellAmountMinor, b.departureDate,
          b.status ?? BOOKING_INITIAL_STATUS[b.bookingType], b.reference ?? null, b.statusReason ?? null, b.netCostMinor ?? null, JSON.stringify(b.details ?? {})]
```

- [ ] **Step 5:** `cd backend && bun run seed:extract` (regenerate JSON; baca warning — harus sama dengan sebelumnya); test → PASS; `bun run test` penuh (year-demo & finance-demo seed tetap hijau); typecheck.
- [ ] **Step 6:** Commit `feat(core): seed demo layanan & booking lengkap (S4a)`.

---

### Task 7: Frontend — tipe, endpoint, `bookings-sync.ts`, layout

**Files:**
- Modify: `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`, `frontend/app/layouts/dashboard.vue`, `frontend/app/pages/settings.vue`
- Create: `frontend/app/data/bookings-sync.ts`, `frontend/app/data/bookings-sync.test.ts`

**Interfaces:**
- Consumes: bentuk respons Task 3/4.
- Produces:
  - DTO `ProjectServiceDto`, `BookingDto`, input `ServiceCreateInput`, `ServicePatchInput`, `BookingCreateInput`, `BookingPatchInput`
  - `api.core.listProjectServices(query)`, `createProjectService(projectId, input, key)`, `updateProjectService(id, input)`, `listBookings(query)`, `createBooking(type, input, key)`, `updateBooking(type, id, input)`, `changeBookingStatus(type, id, input)`
  - `bookings-sync.ts`: `serviceFromServer`, `bookingFromServer`, `bookingToServer(type, booking)`, `upsertServerService`, `upsertServerBooking`, `mergeServerServicesAndBookings`, `loadServerServicesAndBookings(api)`, `createServiceOnServer`, `patchServiceOnServer`, `createBookingOnServer`, `saveBookingOnServer`, `changeBookingStatusOnServer`, `useBookingsSync()`
  - `UiBookingType = 'flight' | 'hotel' | 'transportation' | 'mice'` ↔ `ApiBookingType` lewat `toApiBookingType` / `toUiBookingType`.

- [ ] **Step 1: Tipe** di `types/api.ts` (dekat `BookingRefDto`):

```ts
export interface ProjectServiceDto {
  id: string
  projectId: string
  type: ServiceTypeKey
  label: string
  status: ServiceStatus
  vendorId: string | null
  bookingReference: string | null
  budgetMinor: string | null
  hasBookings: boolean
  provenance: string
}
export interface ServiceCreateInput { type: ServiceTypeKey; label: string; vendorId?: string | null; budgetMinor?: string | null; bookingReference?: string | null }
export type ServicePatchInput = Partial<Pick<ProjectServiceDto, 'label' | 'status' | 'vendorId' | 'bookingReference' | 'budgetMinor'>>

export interface BookingDto {
  type: ApiBookingType
  id: string
  projectId: string
  serviceId: string | null
  serviceType: ServiceTypeKey | null
  vendorId: string | null
  status: string
  statusReason: string | null
  reference: string | null
  sellAmountMinor: string | null
  netCostMinor: string | null
  departureDate: string | null
  details: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
export interface BookingCreateInput { projectId: string; serviceId?: string; label?: string; reference?: string | null; sellAmountMinor?: string | null; netCostMinor?: string | null; details: Record<string, unknown> }
export interface BookingPatchInput { details?: Record<string, unknown>; reference?: string | null; sellAmountMinor?: string | null; netCostMinor?: string | null }
```

(Import `ServiceTypeKey`, `ServiceStatus` dari `~/types/project` bila belum.)

- [ ] **Step 2: Endpoint** di blok `core` (setelah `getBookingRef`):

```ts
      listProjectServices: (query: { projectId?: string } = {}) => client.get<ProjectServiceDto[]>('/project-services', { query: { ...query } }),
      createProjectService: (projectId: string, input: ServiceCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ProjectServiceDto>(`/projects/${seg(projectId)}/services`, input, { idempotencyKey }),
      updateProjectService: (id: string, input: ServicePatchInput) => client.patch<ProjectServiceDto>(`/project-services/${seg(id)}`, input),
      listBookings: (query: { projectId?: string; type?: ApiBookingType } = {}) => client.get<BookingDto[]>('/bookings', { query: { ...query } }),
      createBooking: (type: ApiBookingType, input: BookingCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<BookingDto>(`/bookings/${seg(type)}`, input, { idempotencyKey }),
      updateBooking: (type: ApiBookingType, id: string, input: BookingPatchInput) => client.patch<BookingDto>(`/bookings/${seg(type)}/${seg(id)}`, input),
      changeBookingStatus: (type: ApiBookingType, id: string, input: { to: string; reason?: string }) =>
        client.post<BookingDto>(`/bookings/${seg(type)}/${seg(id)}/status`, input)
```

(Cek `client.get` menerima `{ query }`; bila hanya `getList` yang menerima query, pakai pola yang sama dengan `listParties`/`listVendors`.)

- [ ] **Step 3: Test gagal** `bookings-sync.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { FLIGHT_BOOKINGS } from './ticketing'
import { MICE_EVENTS } from './mice'
import { PROJECT_SERVICES } from './projects'
import { bookingFromServer, bookingToServer, mergeServerServicesAndBookings } from './bookings-sync'
import type { BookingDto, ProjectServiceDto } from '~/types/api'

const svc = (over: Partial<ProjectServiceDto> = {}): ProjectServiceDto => ({ id: 'SVC-9001', projectId: 'PRJ-101', type: 'flight', label: 'Flight Manila', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR1', budgetMinor: '1000', hasBookings: true, provenance: 'manual', ...over })
const flightDto = (over: Partial<BookingDto> = {}): BookingDto => ({
  type: 'flight', id: 'FLT-9001', projectId: 'PRJ-101', serviceId: 'SVC-9001', serviceType: 'flight', vendorId: 'VND-001', status: 'issued', statusReason: null,
  reference: 'PNR1', sellAmountMinor: '95000000', netCostMinor: '80000000', departureDate: '2026-08-20',
  details: { segments: [{ origin: 'CGK', destination: 'MNL', departureAt: '2026-08-20T08:00' }], travelerIds: [], options: [] }, createdAt: '2026-10-06', updatedAt: '2026-10-06', ...over
})

describe('bookings-sync', () => {
  beforeEach(() => {
    mergeServerServicesAndBookings({ services: [svc()], bookings: [flightDto()] })
  })

  it('maps server bookings to the UI shape (pnr, prices in rupiah, details spread)', () => {
    const b = FLIGHT_BOOKINGS.find(x => x.id === 'FLT-9001')!
    expect(b).toMatchObject({ projectId: 'PRJ-101', serviceId: 'SVC-9001', status: 'issued', pnr: 'PNR1', sellPriceIdr: 95000000, netCostIdr: 80000000 })
    expect(b.segments[0]!.origin).toBe('CGK')
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')).toMatchObject({ label: 'Flight Manila', status: 'confirmed', budgetIdr: 1000, bookingReference: 'PNR1' })
  })

  it('removes what the server no longer has and keeps object identity on update', () => {
    const before = FLIGHT_BOOKINGS.find(x => x.id === 'FLT-9001')!
    mergeServerServicesAndBookings({ services: [svc()], bookings: [flightDto({ status: 'reissued' })] })
    expect(FLIGHT_BOOKINGS.find(x => x.id === 'FLT-9001')).toBe(before)
    expect(before.status).toBe('reissued')
    mergeServerServicesAndBookings({ services: [], bookings: [] })
    expect(FLIGHT_BOOKINGS.some(x => x.id === 'FLT-9001')).toBe(false)
    expect(PROJECT_SERVICES.some(s => s.id === 'SVC-9001')).toBe(false)
  })

  it('sends details without core fields and prices as minor strings; MICE without prices', () => {
    const b = bookingFromServer(flightDto()) as Record<string, unknown>
    const out = bookingToServer('flight', b)
    expect(out).toMatchObject({ reference: 'PNR1', sellAmountMinor: '95000000', netCostMinor: '80000000' })
    expect(Object.keys(out.details!)).not.toContain('status')
    expect(Object.keys(out.details!)).not.toContain('pnr')
    const mice = bookingToServer('mice', { id: 'MICE-1', projectId: 'PRJ-1', status: 'planning', boqItems: [{ sellPriceIdr: 5 }], sessions: [] })
    expect(mice.sellAmountMinor).toBeUndefined()
    expect(mice.details!.boqItems).toEqual([{ sellPriceIdr: 5 }])
    expect(MICE_EVENTS).toBeDefined()
  })
})
```

- [ ] **Step 4:** `pnpm exec vitest run app/data/bookings-sync.test.ts` → FAIL.

- [ ] **Step 5: `bookings-sync.ts`**

```ts
import { PROJECT_SERVICES } from './projects'
import { FLIGHT_BOOKINGS } from './ticketing'
import { HOTEL_BOOKINGS } from './accommodation'
import { TRANSPORT_BOOKINGS } from './transportation'
import { MICE_EVENTS } from './mice'
import type { ProjectService } from '~/types/project'
import type { ApiBookingType, BookingCreateInput, BookingDto, BookingPatchInput, ProjectServiceDto, ServiceCreateInput, ServicePatchInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `PROJECT_SERVICES` + the four booking arrays (S4a). The server owns services and bookings; the UI
 * keeps the booking objects (same shape as before: core fields + `details` spread) and updates them in place.
 * Writes go to the server first; local side effects (activity log, service orders, payment gate) run after.
 */

export type UiBookingType = 'flight' | 'hotel' | 'transportation' | 'mice'
export const toApiBookingType = (t: UiBookingType): ApiBookingType => (t === 'transportation' ? 'transport' : t)
type AnyBooking = Record<string, unknown> & { id: string }

const ARRAYS: Record<ApiBookingType, AnyBooking[]> = {
  flight: FLIGHT_BOOKINGS as unknown as AnyBooking[],
  hotel: HOTEL_BOOKINGS as unknown as AnyBooking[],
  transport: TRANSPORT_BOOKINGS as unknown as AnyBooking[],
  mice: MICE_EVENTS as unknown as AnyBooking[]
}
/** Same list as the server `CORE_BOOKING_KEYS`. */
const CORE_KEYS = ['id', 'projectId', 'serviceId', 'status', 'statusReason', 'netCostIdr', 'sellPriceIdr', 'pnr', 'confirmationNumber', 'createdAt', 'updatedAt']
const idr = (minor: string | null) => (minor === null ? undefined : Number(minor))
const minor = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : null)

export function serviceFromServer (d: ProjectServiceDto): ProjectService {
  return { id: d.id, projectId: d.projectId, type: d.type, label: d.label, status: d.status, vendorId: d.vendorId ?? undefined, bookingReference: d.bookingReference ?? undefined, budgetIdr: idr(d.budgetMinor) }
}

export function bookingFromServer (d: BookingDto): AnyBooking {
  const b: AnyBooking = {
    ...d.details,
    id: d.id,
    projectId: d.projectId,
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  }
  if (d.serviceId) { b.serviceId = d.serviceId }
  if (d.statusReason) { b.statusReason = d.statusReason }
  if (d.type !== 'mice') {
    if (d.sellAmountMinor !== null) { b.sellPriceIdr = Number(d.sellAmountMinor) }
    if (d.netCostMinor !== null) { b.netCostIdr = Number(d.netCostMinor) }
  }
  if (d.reference) {
    if (d.type === 'flight') { b.pnr = d.reference } else if (d.type === 'hotel') { b.confirmationNumber = d.reference }
  }
  if (d.type === 'mice') {
    b.sessions ??= []; b.participantCategories ??= []; b.boqItems ??= []; b.staffAssignments ??= []; b.checklist ??= []; b.deliverables ??= []
    b.clientApprovalStatus ??= 'draft'
  } else {
    b.options ??= []; b.travelerIds ??= []
    if (d.type === 'flight') { b.segments ??= [] }
    if (d.type === 'transport') { b.legs ??= [] }
  }
  return b
}

export function bookingToServer (type: ApiBookingType | UiBookingType, b: Record<string, unknown>): BookingPatchInput {
  const api = type === 'transportation' ? 'transport' : type
  const details = Object.fromEntries(Object.entries(b).filter(([k, v]) => !CORE_KEYS.includes(k) && v !== undefined))
  const reference = (api === 'flight' ? b.pnr : api === 'hotel' ? b.confirmationNumber : undefined) as string | undefined
  const out: BookingPatchInput = { details, reference: reference?.trim() || null }
  if (api !== 'mice') {
    out.sellAmountMinor = minor(b.sellPriceIdr)
    out.netCostMinor = minor(b.netCostIdr)
  }
  return out
}

function upsertInto<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) { list.push(value); return list[list.length - 1]! }
  for (const k of Object.keys(local)) { if (!(k in value)) { delete (local as Record<string, unknown>)[k] } }
  Object.assign(local, value)
  return local
}

export const upsertServerService = (d: ProjectServiceDto) => upsertInto(PROJECT_SERVICES, serviceFromServer(d))
export const upsertServerBooking = (d: BookingDto) => upsertInto(ARRAYS[d.type], bookingFromServer(d))

export function mergeServerServicesAndBookings (data: { services: ProjectServiceDto[]; bookings: BookingDto[] }): void {
  const keepServices = new Set(data.services.map(s => s.id))
  for (let i = PROJECT_SERVICES.length - 1; i >= 0; i--) { if (!keepServices.has(PROJECT_SERVICES[i]!.id)) { PROJECT_SERVICES.splice(i, 1) } }
  for (const s of data.services) { upsertServerService(s) }
  for (const [type, list] of Object.entries(ARRAYS) as [ApiBookingType, AnyBooking[]][]) {
    const keep = new Set(data.bookings.filter(b => b.type === type).map(b => b.id))
    for (let i = list.length - 1; i >= 0; i--) { if (!keep.has(list[i]!.id)) { list.splice(i, 1) } }
  }
  for (const b of data.bookings) { upsertServerBooking(b) }
}

export async function loadServerServicesAndBookings (api: Pick<ManovaApi, 'core'>): Promise<void> {
  const [services, bookings] = await Promise.all([api.core.listProjectServices(), api.core.listBookings()])
  mergeServerServicesAndBookings({ services: services.data, bookings: bookings.data })
}

export async function createServiceOnServer (api: Pick<ManovaApi, 'core'>, projectId: string, input: ServiceCreateInput, key: string = newIdempotencyKey()): Promise<ProjectService> {
  return upsertServerService((await api.core.createProjectService(projectId, input, key)).data)
}
export async function patchServiceOnServer (api: Pick<ManovaApi, 'core'>, id: string, input: ServicePatchInput): Promise<ProjectService> {
  return upsertServerService((await api.core.updateProjectService(id, input)).data)
}

/** Creates the booking; the server picks or makes its service — reload the project's services afterwards. */
export async function createBookingOnServer (api: Pick<ManovaApi, 'core'>, type: UiBookingType, input: BookingCreateInput, key: string = newIdempotencyKey()): Promise<AnyBooking> {
  const res = await api.core.createBooking(toApiBookingType(type), input, key)
  const services = await api.core.listProjectServices({ projectId: input.projectId })
  for (const s of services.data) { upsertServerService(s) }
  return upsertServerBooking(res.data)
}

/** Saves the whole local booking object (details + prices + reference) after a local edit. */
export async function saveBookingOnServer (api: Pick<ManovaApi, 'core'>, type: UiBookingType, booking: Record<string, unknown> & { id: string; projectId: string }): Promise<AnyBooking> {
  const res = await api.core.updateBooking(toApiBookingType(type), booking.id, bookingToServer(type, booking))
  const services = await api.core.listProjectServices({ projectId: booking.projectId })
  for (const s of services.data) { upsertServerService(s) }
  return upsertServerBooking(res.data)
}

export async function changeBookingStatusOnServer (api: Pick<ManovaApi, 'core'>, type: UiBookingType, id: string, to: string, reason?: string): Promise<BookingDto> {
  return (await api.core.changeBookingStatus(toApiBookingType(type), id, { to, ...(reason?.trim() ? { reason: reason.trim() } : {}) })).data
}

export interface BookingsSyncState { status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'; userId: string | null; message: string | null }

export function useBookingsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<BookingsSyncState>('manova-bookings-sync', () => ({ status: 'idle', userId: null, message: null }))
  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerServicesAndBookings(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Layanan & booking belum bisa dimuat dari server.' }
    }
  }
  return { state, load }
}
```

Catatan status: setelah `changeBookingStatusOnServer`, pemanggil menjalankan mutator lokal `update*Status` (efek samping: aktivitas, payment gate, supplier invoice lokal) lalu `upsertServerBooking(dto)` + reload layanan project. Satu helper untuk itu:

```ts
/** Server status change, then the local mutator for its side effects, then the server's version wins. */
export async function runBookingStatusChange (api: Pick<ManovaApi, 'core'>, type: UiBookingType, booking: { id: string; projectId: string }, to: string, reason: string | undefined, localSideEffects: () => unknown): Promise<void> {
  const dto = await changeBookingStatusOnServer(api, type, booking.id, to, reason)
  localSideEffects()
  upsertServerBooking(dto)
  const services = await api.core.listProjectServices({ projectId: booking.projectId })
  for (const s of services.data) { upsertServerService(s) }
}
```

- [ ] **Step 6: layout & settings** — `dashboard.vue`: `const bookingsSync = useBookingsSync()`, ikut di `loadServerData` (setelah projects sync, karena booking butuh project), tambah ke `unsyncedLabel` ("layanan & booking") dan `unsyncedMessage` (pola sama dengan vendorsSync). `settings.vue`: `bookingsSync.load(true)` di reset.

- [ ] **Step 7:** vitest file → PASS; `pnpm test` penuh; vue-tsc tanpa error baru; eslint file baru bersih (`pnpm exec eslint --fix` file baru).
- [ ] **Step 8:** Commit `feat(frontend): muat layanan & booking dari server (S4a)`.

---

### Task 8: Frontend — buat, edit, status booking lewat server

**Files (pemanggil, dari peta caller):**
- `frontend/app/pages/project-orders/[id]/index.vue` (create 4 jenis)
- `frontend/app/components/operations/{Ticketing,Accommodation,Transportation,Mice}ListPanel.vue` (create)
- `frontend/app/pages/ticketing/[id]/index.vue` (`updateFlightBooking`, `selectFlightOption`, `updateFlightBookingStatus`)
- `frontend/app/pages/accommodation/[id]/index.vue` (`updateHotelBooking`, `selectHotelOption`, `updateHotelBookingStatus`)
- `frontend/app/pages/transportation/[id]/index.vue` (`updateTransportBooking`, `selectTransportOption`, `updateTransportBookingStatus`)
- `frontend/app/pages/mice/[id]/index.vue` (`updateMiceEvent`, `updateMiceEventStatus`, `updateMiceClientApproval`, `toggleMiceChecklistItem`, `toggleMiceDeliverable`)
- `frontend/app/data/index.ts` (hapus `create*Booking`/`createMiceEvent` + `ensureProjectServiceForBooking` bila tak dipakai lagi)

**Interfaces:**
- Consumes: `createBookingOnServer`, `saveBookingOnServer`, `runBookingStatusChange` (Task 7).

Pola per jenis panggilan (diterapkan di setiap call site yang terdaftar):

**(a) Create** — ganti `const booking = createFlightBooking({ projectId, serviceId, segments, travelerIds, ticketingDeadline, fareRules })` menjadi:

```ts
const api = useApi()
const isCreatingBooking = ref(false)
async function createBooking (type: UiBookingType, input: { projectId: string; serviceId?: string; label?: string; details: Record<string, unknown> }) {
  if (isCreatingBooking.value) { return undefined }
  isCreatingBooking.value = true
  try {
    return await createBookingOnServer(api, type, { ...input, details: input.details })
  } catch (error) {
    showToast('Booking Gagal Dibuat', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return undefined
  } finally {
    isCreatingBooking.value = false
  }
}
```

dengan `label` = label lama (`Flight ${project.destination}` dst. — salin dari mutator lama) dan `details` = field input lama (segments, travelerIds, ticketingDeadline, fareRules / options / legs / sessions …). Navigasi ke `/<domain>/${booking.id}` hanya bila booking terbentuk; tombol `:disabled` tambah `isCreatingBooking`.

**(b) Edit detail / pilih opsi / MICE checklist, deliverable, approval** — pola "lokal dulu, simpan ke server, kembalikan bila gagal":

```ts
async function persistBooking (mutate: () => unknown) {
  if (!booking.value || isSavingBooking.value) { return false }
  const snapshot = structuredClone(toRaw(booking.value))
  if (mutate() === undefined) { return false } // local guard refused (same as before)
  isSavingBooking.value = true
  try {
    await saveBookingOnServer(api, '<jenis>', booking.value as never)
    return true
  } catch (error) {
    Object.assign(booking.value, snapshot)
    showToast('Booking Gagal Disimpan', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return false
  } finally {
    isSavingBooking.value = false
  }
}
```

lalu `updateFlightBooking(id, patch)` → `await persistBooking(() => updateFlightBooking(id, patch))`, dan dialog hanya ditutup bila `true`. Sama untuk `selectFlightOption`, `updateHotelBooking`, `selectHotelOption`, `updateTransportBooking`, `selectTransportOption`, `updateMiceEvent`, `updateMiceClientApproval`, `toggleMiceChecklistItem`, `toggleMiceDeliverable`. (`structuredClone` gagal pada proxy reaktif → `toRaw`; bila tetap gagal pakai `JSON.parse(JSON.stringify(...))`.)

**(c) Status** — ganti `updateFlightBookingStatus(id, to, actorId, reason)` menjadi:

```ts
try {
  await runBookingStatusChange(api, 'flight', booking.value, to, reason, () => updateFlightBookingStatus(booking.value!.id, to, currentUser.value.id, reason))
  // tutup dialog, toast sukses seperti sebelumnya
} catch (error) {
  showToast('Status Gagal Diubah', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
}
```

Pesan 422 "…ajukan pembatalan lewat Finance." tampil apa adanya dari server.

- [ ] **Step 1: Test gagal** — tambah ke `bookings-sync.test.ts` test `runBookingStatusChange` dengan api palsu: server dipanggil dulu, efek lokal jalan, versi server menang:

```ts
it('status change: server first, local side effects, server version wins', async () => {
  const calls: string[] = []
  const api = { core: {
    changeBookingStatus: async () => { calls.push('server'); return { data: flightDto({ status: 'cancelled', statusReason: 'x' }) } },
    listProjectServices: async () => ({ data: [svc({ status: 'cancelled' })] })
  } } as never
  await runBookingStatusChange(api, 'flight', { id: 'FLT-9001', projectId: 'PRJ-101' }, 'cancelled', 'x', () => { calls.push('local') })
  expect(calls).toEqual(['server', 'local'])
  expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('cancelled')
  expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.status).toBe('cancelled')
})

it('a refused status change leaves the local booking untouched', async () => {
  const api = { core: { changeBookingStatus: async () => { throw new Error('422') }, listProjectServices: async () => ({ data: [] }) } } as never
  let local = false
  await expect(runBookingStatusChange(api, 'flight', { id: 'FLT-9001', projectId: 'PRJ-101' }, 'cancelled', 'x', () => { local = true })).rejects.toThrow()
  expect(local).toBe(false)
  expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('issued')
})
```

- [ ] **Step 2:** jalankan → kedua test lulus bila Task 7 sudah lengkap (runBookingStatusChange ada di Task 7). Bila lulus langsung, catat di ledger bahwa test ini melindungi urutan, bukan fitur baru — lalu lanjut ke call site.
- [ ] **Step 3:** Terapkan (a) di Project Order + 4 ListPanel; (b) & (c) di 4 halaman domain `[id]`. Setelah tiap file: `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json 2>&1 | grep "<file>" | grep -v "on type 'unknown'"` tidak menambah error.
- [ ] **Step 4:** Hapus mutator create lokal yang tak lagi dipanggil (`grep -rn "createFlightBooking\|createHotelBooking\|createTransportBooking\|createMiceEvent\|ensureProjectServiceForBooking" app` hanya menyisakan definisi) beserta import tipe yang jadi tak terpakai.
- [ ] **Step 5:** `pnpm test`, vue-tsc total ≤ 2010, eslint delta per file 0 vs HEAD.
- [ ] **Step 6:** Commit `feat(frontend): booking dibuat, diedit, dan berganti status lewat server (S4a)`.

---

### Task 9: Frontend — layanan (status manual, budget, vendor) lewat server

**Files:**
- `frontend/app/pages/project-orders/[id]/index.vue` (`updateServiceStatus`, `setServiceVendor`, `assignServiceVendor`, `acceptVendorQuotation`)
- `frontend/app/pages/project-orders/index.vue`, `frontend/app/pages/crm/parties/[id]/index.vue`, `frontend/app/pages/customer-journey/customers/[id]/index.vue` (`ensureProjectServiceForBudget`, `updateProjectServiceBudget`)
- `frontend/app/pages/{ticketing,accommodation,transportation}/[id]/index.vue` (`assignServiceVendor`), `frontend/app/pages/mice/[id]/index.vue` + 4 `*ListPanel.vue` (`setServiceVendor`)

**Interfaces:**
- Consumes: `createServiceOnServer`, `patchServiceOnServer` (Task 7).
- Produces: `runServiceWrite(api, serverCall, localSideEffects)` di `bookings-sync.ts`.

- [ ] **Step 1: Test gagal** di `bookings-sync.test.ts`:

```ts
it('service write: server first; local side effects only after success', async () => {
  const calls: string[] = []
  const api = { core: { updateProjectService: async () => { calls.push('server'); return { data: svc({ vendorId: 'VND-002' }) } } } } as never
  await runServiceWrite(() => patchServiceOnServer(api, 'SVC-9001', { vendorId: 'VND-002' }), () => { calls.push('local') })
  expect(calls).toEqual(['server', 'local'])
  expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.vendorId).toBe('VND-002')
  const failing = { core: { updateProjectService: async () => { throw new Error('422') } } } as never
  await expect(runServiceWrite(() => patchServiceOnServer(failing, 'SVC-9001', { vendorId: 'VND-003' }), () => { calls.push('local2') })).rejects.toThrow()
  expect(calls).not.toContain('local2')
})
```

- [ ] **Step 2:** → FAIL (`runServiceWrite` tidak ada).
- [ ] **Step 3:** di `bookings-sync.ts`:

```ts
/** Service write: the server decides; local follow-ups (service order, supplier invoice, alerts) run only after it agreed. */
export async function runServiceWrite<T> (serverCall: () => Promise<T>, localSideEffects?: () => unknown): Promise<T> {
  const result = await serverCall()
  localSideEffects?.()
  return result
}
```

- [ ] **Step 4:** Terapkan di call site:
  - `updateServiceStatus(id, s)` → `runServiceWrite(() => patchServiceOnServer(api, id, { status: s }), () => updateServiceStatus(id, s))` (efek lokal: alert "changed", supplier invoice lokal). Karena server sudah set status, `updateServiceStatus` lokal hanya menulis nilai yang sama + efek samping.
  - `setServiceVendor(serviceId, vendorId)` → `runServiceWrite(() => patchServiceOnServer(api, serviceId, { vendorId }), () => setServiceVendor(serviceId, vendorId))` (service order & supplier invoice tetap lokal).
  - `assignServiceVendor(...)` / `acceptVendorQuotation(q)` → patch vendor ke server dulu (`vendorId` quotation), lalu mutator lokal (quotation lain ditolak, status confirmed lokal). Status `confirmed` layanan: bila layanan tanpa booking, sertakan `status: 'confirmed'` di patch yang sama.
  - `ensureProjectServiceForBudget(projectId, type)` → bila belum ada layanan jenis itu di `PROJECT_SERVICES`, `createServiceOnServer(api, projectId, { type, label: <label lama> }, key)`; `updateProjectServiceBudget(id, idr)` → `patchServiceOnServer(api, id, { budgetMinor: idr === undefined ? null : String(Math.round(idr)) })`.
  - Semua dengan guard `isSaving…` + toast `isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.'`; pesan 422 vendor ("sudah ada invoice vendor…") tampil apa adanya.
- [ ] **Step 5:** Hapus `ensureProjectServiceForBudget`/`updateProjectServiceBudget` lokal bila tak dipanggil lagi (grep).
- [ ] **Step 6:** `pnpm test`, vue-tsc ≤ 2010, eslint delta 0, `pnpm build`.
- [ ] **Step 7:** Commit `feat(frontend): layanan project (status, budget, vendor) lewat server (S4a)`.

---

### Task 10: Dokumentasi, DB lokal, smoke

**Files:**
- Modify: `docs/manova-finance-implementation/adr/ADR-004-core-reference-bridge-and-cutover.md`, `docs/superpowers/specs/2026-10-06-services-bookings-backend-design.md` (Status → diimplementasikan), `CLAUDE.md` root bila perintah berubah (tidak ada perintah baru → tidak diubah).

- [ ] **Step 1:** ADR-004: tambah "## Update 2026-10-06 — Layanan project & booking (S4a)" (ringkas: endpoint, `booking_refs` jadi tabel booking, blok batal & harga jual, hook Finance, tetap lokal, langkah cutover seed sekali).
- [ ] **Step 2:** Bila port 3000 kosong: `cd backend && bun run db:migrate && bun run db:seed:demo` (DB lokal `pglite-year`). Bila terpakai: catat & lewati (user yang menjalankan).
- [ ] **Step 3:** Smoke di :3100 dengan salinan DB (`cp -r .data/pglite-year .data/smoke-s4a`): login admin → `POST /bookings/flight` → status confirmed → `PATCH` details → `GET /bookings?projectId=…` → Finance `GET /bookings/flight/:id/finance-summary` 200 untuk booking baru (dulu 404). Matikan server, hapus salinan.
- [ ] **Step 4:** Commit `docs: ADR-004 catatan layanan & booking lewat API (S4a)`.
