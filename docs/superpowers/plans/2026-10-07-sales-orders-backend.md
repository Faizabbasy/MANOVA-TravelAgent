# Sales order B2C & Group Trip lewat API (S6b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sales order B2C (standalone + peserta Group Trip) dibuat, berpindah status, dan menahan kursi di server; qualify B2C/Group Trip membuat order di server; konfirmasi DP Finance menandai order `paid`.

**Architecture:** Migrasi 0025 memperluas `sales_order_refs` (status, detail perjalanan, lead, `status_changed_at`). Modul `backend/src/modules/sales/sales-orders.ts` (baca, buat, status, kursi) + rute di `sales/routes.ts`; `qualify.ts` diperluas (B2C dengan harga, endpoint group-trip). Finance `group-trip.ts` menandai `paid`. Frontend: `data/sales-orders-sync.ts`, kursi dihitung dari order tersinkron, layar sales order / LeadDetailSheet / project order dialihkan.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (`backend/`), Nuxt 4 + Vue 3 + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-07-sales-orders-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/` (jalankan pnpm **dari `frontend/`**, bukan root); jangan tambah lockfile.
- Uang `bigint` minor di SQL, string `…Minor` di wire; frontend `…Idr` number.
- Pola tulis S0: capability → validasi 400 (Indonesia) / 422 `RULE_VIOLATION` → perubahan + `recordAudit` satu transaksi → respons = bentuk GET. Create pakai `withIdempotency` + `requireIdempotencyKey`.
- Hak tulis sales order: `sales.manage-lead` (admin; super-admin lolos). Baca: peran internal; portal (`isPortalActor`) 403.
- ID `nextId(q, 'SLO-')`; seed memanggil `syncIdSequences`.
- JSON ke SQL: `$n::text::jsonb` + `JSON.stringify`. File CRLF: pakai Edit tool; heredoc bash merusak backslash — tulis file berisi regex/backtick lewat Write tool.
- Test backend `bun run test`; filter `bun test --timeout 30000 test/<file> -t "<nama>"`; hindari apostrof di nama test.
- Frontend: vue-tsc total ≤ 2000 (baseline 1983); lint error per file tidak bertambah vs HEAD; tanpa `void`; API palsu pakai `Promise.resolve/reject`.
- Commit tiap task, jangan push.

## Rulings dari spec (saat menulis plan)

1. **`confirm-dp` menerima order Group Trip yang belum dibatalkan** (bukan hanya `draft` seperti spec): fixture demo berstatus `paid` tanpa invoice (seed demo tidak punya data finance) dan test Finance yang ada mengonfirmasi DP SLO-006 (`paid`). Konfirmasi dobel tetap dicegah oleh cek invoice non-void. `draft` → `paid`; status lain tidak diubah.
2. **`status_changed_at timestamptz`** di `sales_order_refs`: diisi setiap API (status / confirm-dp) mengubah status. Seed hanya menulis `status/status_reason/paid_on` bila `status_changed_at is null` — baris lama di staging (default `draft` dari migrasi) mendapat status fixture pada seed pertama, perubahan pengguna tidak tertimpa.
3. **Kursi di frontend** dihitung dari `SALES_ORDERS` tersinkron dengan rumus server (filled = pax `paid/ongoing/done`, held = pax `draft`), menggantikan hitungan dari traveler lokal. `GET /projects/:id/seats` tetap ada sebagai sumber kebenaran server (dites di backend).
4. **Tidak ada layar pembuat order standalone** selain qualify B2C; `POST /sales-orders` tetap dibuat (spec) tetapi frontend hanya memakainya lewat API sync (tanpa UI baru).
5. **Invoice Finance manual untuk order standalone** (`createInvoiceDraft` dengan `salesOrderId` tanpa project) → 422, menutup celah yang muncul karena `project_id` kini nullable.

## Review Focus

1. Dua qualify Group Trip bersamaan untuk project yang tinggal 1 kursi → hanya satu order; yang lain `waitlist` (kunci project).
2. Membatalkan order Group Trip membebaskan kursinya: order berikutnya untuk project itu langsung lolos.
3. Lead yang sudah punya order aktif di-qualify Group Trip lagi → 409, tidak ada order kedua.
4. Seed ulang setelah pengguna membatalkan SLO-007 → tetap `cancelled` dengan alasannya.
5. `POST /sales-orders/:id/status { to: 'paid' }` untuk order Group Trip → 422 dan status tidak berubah.

Tes: (1)(3) Task 3, (2)(5) Task 2, (4) Task 5.

---

### Task 1: Migrasi 0025 + prefix `SLO-`

**Files:**
- Create: `backend/migrations/0025_sales_orders.up.sql`, `.down.sql`
- Modify: `backend/src/shared/ids.ts`
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces: kolom `sales_order_refs.status, status_reason, status_changed_at, destination, travel_start_date, travel_end_date, note, lead_id, paid_on, created_on, updated_at`; `project_id` nullable; `IdPrefix` + `'SLO-'`.

- [ ] **Step 1: Test gagal** (describe `demo seed`, sebelum test `leads and quotation versions exist after 0024`):

```ts
  test('sales orders carry status and trip details after 0025; standalone orders have no project', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into sales_order_refs (id, party_id, price_minor, traveler_count, destination, travel_start_date, travel_end_date) values ('SLO-T1', 'PTY-006', 1000, 2, 'Bali', '2026-12-01', '2026-12-03')")
      const [row] = await db.query<{ status: string; project_id: string | null }>("select status, project_id from sales_order_refs where id = 'SLO-T1'")
      expect(row).toEqual({ status: 'draft', project_id: null })
      await expect(db.query("update sales_order_refs set status = 'lost' where id = 'SLO-T1'")).rejects.toThrow()
      await expect(db.query("insert into sales_order_refs (id, party_id, price_minor, traveler_count, travel_start_date, travel_end_date) values ('SLO-T2', 'PTY-006', 1000, 1, '2026-12-05', '2026-12-01')")).rejects.toThrow()
      const [seq] = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix = 'SLO-'")
      expect(seq?.prefix).toBe('SLO-')
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `bun test --timeout 30000 test/db.test.ts -t "0025"` → FAIL (`null value in column "project_id"` atau kolom tidak ada).

- [ ] **Step 3: up.sql**

```sql
-- S6b: sales orders (B2C standalone + Group Trip participant bookings) owned by the Sales API.
alter table sales_order_refs
  alter column project_id drop not null,
  add column status text not null default 'draft' check (status in ('draft', 'paid', 'ongoing', 'done', 'cancelled')),
  add column status_reason text,
  -- Set whenever the API changes the status: a re-seed only writes fixture status while this is null.
  add column status_changed_at timestamptz,
  add column destination text,
  add column travel_start_date date,
  add column travel_end_date date,
  add column note text,
  add column lead_id text references leads (id),
  add column paid_on date,
  add column created_on date not null default current_date,
  add column updated_at timestamptz not null default now(),
  add constraint sales_order_refs_period check (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date);
create index sales_order_refs_lead on sales_order_refs (lead_id) where lead_id is not null;

insert into id_sequences (prefix, last_value)
select 'SLO-', coalesce(max(substring(id from '^SLO-([0-9]+)$')::integer), 0) from sales_order_refs
on conflict (prefix) do nothing;
```

down.sql:

```sql
delete from id_sequences where prefix = 'SLO-';
delete from sales_order_refs where project_id is null;
drop index if exists sales_order_refs_lead;
alter table sales_order_refs
  drop constraint if exists sales_order_refs_period,
  drop column if exists status, drop column if exists status_reason, drop column if exists status_changed_at,
  drop column if exists destination, drop column if exists travel_start_date, drop column if exists travel_end_date,
  drop column if exists note, drop column if exists lead_id, drop column if exists paid_on, drop column if exists created_on,
  drop column if exists updated_at,
  alter column project_id set not null;
```

- [ ] **Step 4: ids.ts** — `IdPrefix` tambah `| 'SLO-'`; `SOURCES` tambah `'SLO-': { table: 'sales_order_refs' }`.
- [ ] **Step 5:** test → PASS; `bun run typecheck`.
- [ ] **Step 6:** Commit `feat(sales): migrasi 0025 sales order lengkap (S6b)`.

---

### Task 2: Sales order — baca, buat, status, kursi

**Files:**
- Create: `backend/src/modules/sales/sales-orders.ts`
- Modify: `backend/src/modules/sales/routes.ts`
- Test: `backend/test/sales-orders.test.ts` (baru)

**Interfaces:**
- Produces (`sales-orders.ts`):
  - `listSalesOrders(db: Queryable, filter?: { id?: string; projectId?: string }): Promise<SalesOrderView[]>`; `SalesOrderView = { id, projectId: string|null, partyId, partyName, leadId: string|null, destination: string|null, travelStartDate: string|null, travelEndDate: string|null, travelerCount: number, priceMinor: string, status, statusReason: string|null, note: string|null, paidOn: string|null, createdOn: string, updatedAt: string }`
  - `projectSeats(q: Queryable, projectId: string, lock?: boolean): Promise<{ capacity: number; filled: number; held: number; available: number }>` (422 bila project bukan Group Trip, 404 bila tidak ada)
  - `insertSalesOrder(tx, actor, row: { partyId: string; projectId: string|null; leadId: string|null; destination: string; travelStartDate: string; travelEndDate: string; travelerCount: number; priceMinor: bigint; note: string|null }, today: string, requestId: string): Promise<{ id: string }>` — tanpa cek kursi (pemanggil yang mengunci)
  - `createSalesOrder(tx, actor, input: Record<string, unknown>, today, requestId): Promise<{ id: string }>` (standalone)
  - `changeSalesOrderStatus(tx, actor, id, to: unknown, reason: unknown, today, requestId): Promise<void>`
- Routes: `GET /sales-orders`, `GET /sales-orders/:id`, `POST /sales-orders`, `POST /sales-orders/:id/status`, `GET /projects/:id/seats`.

- [ ] **Step 1: Test gagal** — `backend/test/sales-orders.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S6b: B2C sales orders and Group Trip seats through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s6b-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

const standalone = (extra: Record<string, unknown> = {}) => ({
  customerName: 'Ibu Ratna S6b', destination: 'Bali', travelStartDate: '2026-12-01', travelEndDate: '2026-12-04',
  travelerCount: 2, priceMinor: '9000000', ...extra
})

describe('sales orders', () => {
  test('lists for internal roles; portals 403; anonymous 401; unknown 404', async () => {
    expect((await call('GET', '/sales-orders', 'finance')).status).toBe(200)
    expect((await call('GET', '/sales-orders', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/sales-orders')).status).toBe(401)
    expect((await call('GET', '/sales-orders/SLO-999', 'admin')).status).toBe(404)
  })

  test('create standalone with a new individual client customer; idempotent; validation; finance 403', async () => {
    const k = key()
    const res = await call('POST', '/sales-orders', 'admin', standalone(), k)
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    expect(res.json.data).toMatchObject({ projectId: null, status: 'draft', destination: 'Bali', travelerCount: 2, priceMinor: '9000000', partyName: 'Ibu Ratna S6b' })
    const party = (await call('GET', `/parties/${res.json.data.partyId}`, 'admin')).json.data
    expect(party).toMatchObject({ partyType: 'individual', lifecycleStatus: 'client' })
    expect((await call('POST', '/sales-orders', 'admin', standalone(), k)).json.data.id).toBe(id)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ priceMinor: '0' }), key())).status).toBe(400)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ travelEndDate: '2026-11-01' }), key())).status).toBe(400)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ customerName: undefined, partyId: 'PTY-999' }), key())).status).toBe(400)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ customerName: undefined, partyId: 'PTY-006' }), key())).json.data.partyId).toBe('PTY-006')
    expect((await call('POST', '/sales-orders', 'finance', standalone(), key())).status).toBe(403)
  })

  test('status follows draft to paid to ongoing to done; cancel needs a reason; done is final', async () => {
    const id = (await call('POST', '/sales-orders', 'admin', standalone(), key())).json.data.id as string
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'ongoing' })).status).toBe(422)
    const paid = (await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'paid' })).json.data
    expect(paid).toMatchObject({ status: 'paid' })
    expect(paid.paidOn).toBeTruthy()
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'cancelled' })).status).toBe(400)
    await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'ongoing' })
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'done' })).json.data.status).toBe('done')
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'cancelled', reason: 'x' })).status).toBe(422)
    expect((await call('POST', `/sales-orders/${id}/status`, 'finance', { to: 'done' })).status).toBe(403)
  })

  test('a Group Trip order cannot become paid by hand; it stays draft', async () => {
    const before = (await call('GET', '/sales-orders/SLO-007', 'admin')).json.data
    expect(before.status).toBe('draft')
    const refused = await call('POST', '/sales-orders/SLO-007/status', 'admin', { to: 'paid' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('Finance')
    expect((await call('GET', '/sales-orders/SLO-007', 'admin')).json.data.status).toBe('draft')
  })

  test('seats: paid fill, drafts hold, cancelling frees; non group trip 422', async () => {
    const seats = (await call('GET', '/projects/PRJ-205/seats', 'finance')).json.data
    expect(seats.capacity).toBeGreaterThan(0)
    expect(seats.filled).toBe(5) // SLO-006 (2) + SLO-009 (3)
    expect(seats.held).toBe(3) // SLO-007 (1) + SLO-008 (2)
    expect(seats.available).toBe(Math.max(0, seats.capacity - 8))
    await call('POST', '/sales-orders/SLO-008/status', 'admin', { to: 'cancelled', reason: 'Batal ikut' })
    expect((await call('GET', '/projects/PRJ-205/seats', 'admin')).json.data.held).toBe(1)
    expect((await call('GET', '/projects/PRJ-101/seats', 'admin')).status).toBe(422)
  })
})
```

Test ini membutuhkan status fixture Group Trip (SLO-006/009 `paid`, SLO-007/008 `draft`) dari seed — status itu baru diseed di Task 5. Sampai Task 5 dua test terakhir (`a Group Trip order…`, `seats…`) ditandai `test.skip`; Task 5 mencabut skip-nya.

- [ ] **Step 2:** `bun test --timeout 30000 test/sales-orders.test.ts` → FAIL (404 rute).

- [ ] **Step 3: `sales-orders.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { createParty } from '../core/party-writes'

/**
 * Sales orders (S6b): B2C standalone orders and Group Trip participant bookings. Status runs
 * draft → paid → ongoing → done (cancelled from any open status). A Group Trip order becomes paid only through the
 * Finance DP confirmation. Seats of a Group Trip: capacity − pax of paid/ongoing/done − pax of drafts.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
export const SALES_ORDER_STATUSES = ['draft', 'paid', 'ongoing', 'done', 'cancelled'] as const
const FLOW: Record<string, string[]> = { draft: ['paid', 'cancelled'], paid: ['ongoing', 'cancelled'], ongoing: ['done', 'cancelled'], done: [], cancelled: [] }

export async function listSalesOrders(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select s.id, s.project_id, s.party_id, p.name as party_name, s.lead_id, s.destination, s.travel_start_date::text as travel_start_date,
            s.travel_end_date::text as travel_end_date, s.traveler_count, s.price_minor, s.status, s.status_reason, s.note,
            s.paid_on::text as paid_on, s.created_on::text as created_on, s.updated_at
       from sales_order_refs s join parties p on p.id = s.party_id
      where ($1::text is null or s.id = $1) and ($2::text is null or s.project_id = $2) order by s.id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: (r.project_id ?? null) as string | null,
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    leadId: (r.lead_id ?? null) as string | null,
    destination: (r.destination ?? null) as string | null,
    travelStartDate: (r.travel_start_date ?? null) as string | null,
    travelEndDate: (r.travel_end_date ?? null) as string | null,
    travelerCount: Number(r.traveler_count),
    priceMinor: String(r.price_minor),
    status: r.status as string,
    statusReason: (r.status_reason ?? null) as string | null,
    note: (r.note ?? null) as string | null,
    paidOn: (r.paid_on ?? null) as string | null,
    createdOn: r.created_on as string,
    updatedAt: new Date(r.updated_at as string).toISOString()
  }))
}

export type SalesOrderView = Awaited<ReturnType<typeof listSalesOrders>>[number]

export async function projectSeats(q: Queryable, projectId: string, lock = false) {
  const [p] = await q.query<{ traveler_count: number; is_group_trip: boolean }>(
    `select traveler_count, is_group_trip from projects where id = $1${lock ? ' for update' : ''}`, [projectId])
  if (!p) throw errors.notFound('Project')
  if (!p.is_group_trip) throw rule('Project ini bukan Group Trip.')
  const [s] = await q.query<{ filled: string; held: string }>(
    `select coalesce(sum(traveler_count) filter (where status in ('paid', 'ongoing', 'done')), 0) as filled,
            coalesce(sum(traveler_count) filter (where status = 'draft'), 0) as held
       from sales_order_refs where project_id = $1`, [projectId])
  const capacity = Number(p.traveler_count)
  const filled = Number(s!.filled)
  const held = Number(s!.held)
  return { capacity, filled, held, available: Math.max(0, capacity - filled - held) }
}

export async function insertSalesOrder(tx: Queryable, actor: Actor, row: {
  partyId: string; projectId: string | null; leadId: string | null; destination: string; travelStartDate: string; travelEndDate: string
  travelerCount: number; priceMinor: bigint; note: string | null
}, today: string, requestId: string): Promise<{ id: string }> {
  const id = await nextId(tx, 'SLO-')
  await tx.query(
    `insert into sales_order_refs (id, project_id, party_id, lead_id, destination, travel_start_date, travel_end_date, traveler_count, price_minor, note, created_on)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, row.projectId, row.partyId, row.leadId, row.destination, row.travelStartDate, row.travelEndDate, row.travelerCount, row.priceMinor.toString(), row.note, today]
  )
  await recordAudit(tx, {
    action: 'sales_order.created', actorUserId: actor.userId, entityType: 'sales_order', entityId: id, requestId,
    after: { ...row, priceMinor: row.priceMinor.toString() }
  })
  return { id }
}

function text(v: unknown, field: string, problems: FieldErrors, label: string, max = 200): string | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) { problems[field] = [`${label} wajib diisi.`]; return undefined }
  if (s.length > max) { problems[field] = [`${label} maksimal ${max} karakter.`]; return undefined }
  return s
}

export async function createSalesOrder(tx: Queryable, actor: Actor, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const destination = text(input.destination, 'destination', problems, 'Destinasi')
  for (const f of ['travelStartDate', 'travelEndDate'] as const) {
    if (typeof input[f] !== 'string' || !isIsoDate(input[f] as string)) problems[f] = ['Tanggal harus format YYYY-MM-DD.']
  }
  if (!problems.travelEndDate && !problems.travelStartDate && (input.travelStartDate as string) > (input.travelEndDate as string)) {
    problems.travelEndDate = ['Tanggal selesai tidak boleh sebelum tanggal mulai.']
  }
  const pax = input.travelerCount
  if (!Number.isInteger(pax) || (pax as number) < 1 || (pax as number) > 10_000) problems.travelerCount = ['Jumlah traveler minimal 1.']
  let price = 0n
  try { price = parseAmountMinor(input.priceMinor, 'priceMinor') } catch { problems.priceMinor = ['Harga harus angka rupiah lebih dari 0.'] }
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  let partyId: string | undefined
  if (input.partyId !== undefined && input.partyId !== null) {
    const found = typeof input.partyId === 'string' && ID_PATTERN.test(input.partyId)
      ? (await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId]))[0] : undefined
    if (!found) problems.partyId = ['Customer tidak ditemukan.']
    else partyId = found.id
  } else if (typeof input.customerName !== 'string' || !input.customerName.trim()) {
    problems.customerName = ['Nama customer wajib diisi.']
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (!partyId) {
    partyId = (await createParty(tx, actor, { name: (input.customerName as string).trim(), partyType: 'individual', lifecycleStatus: 'client' }, requestId)).id
  }
  return insertSalesOrder(tx, actor, {
    partyId, projectId: null, leadId: null, destination: destination!, travelStartDate: input.travelStartDate as string,
    travelEndDate: input.travelEndDate as string, travelerCount: pax as number, priceMinor: price, note
  }, today, requestId)
}

export async function changeSalesOrderStatus(tx: Queryable, actor: Actor, id: string, to: unknown, reasonInput: unknown, today: string, requestId: string): Promise<void> {
  if (!(SALES_ORDER_STATUSES as readonly unknown[]).includes(to)) throw errors.validation({ to: [`Status harus salah satu dari: ${SALES_ORDER_STATUSES.join(', ')}.`] })
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if (to === 'cancelled' && !reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const [so] = await tx.query<{ status: string; project_id: string | null }>('select status, project_id from sales_order_refs where id = $1 for update', [id])
  if (!so) throw errors.notFound('Sales order')
  if (!FLOW[so.status]!.includes(to as string)) throw rule(`Status tidak bisa berpindah dari ${so.status} ke ${to as string}.`)
  if (to === 'paid' && so.project_id) throw rule('Booking Group Trip menjadi paid lewat konfirmasi DP di Finance.')
  const invoices = to === 'cancelled'
    ? (await tx.query<{ id: string }>("select id from customer_invoices where sales_order_id = $1 and status <> 'void'", [id])).map(r => r.id)
    : []
  await tx.query(
    `update sales_order_refs set status = $2, status_reason = $3, status_changed_at = now(), updated_at = now(),
       paid_on = case when $2 = 'paid' then $4::date else paid_on end
     where id = $1`,
    [id, to, to === 'cancelled' ? reason : null, today]
  )
  await recordAudit(tx, {
    action: 'sales_order.status_changed', actorUserId: actor.userId, entityType: 'sales_order', entityId: id, requestId, reason,
    before: { status: so.status }, after: { status: to }, details: invoices.length ? { invoiceIds: invoices } : undefined
  })
}
```

Cek: `createParty` menerima `{ name, partyType, lifecycleStatus }` (dipakai qualify S6a); `recordAudit` menerima `details` opsional (`undefined` aman — cek `AuditEntry`; bila wajib objek, kirim `{}`).

- [ ] **Step 4: routes** — tambah di `salesRoutes` (import fungsi dari `./sales-orders`):

```ts
    .get('/sales-orders', async ({ request, query }) => {
      await readActor(request)
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
      return ok(request, await listSalesOrders(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .get('/sales-orders/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await salesOrderResponse(assertIdParam(params.id, 'Sales order')))
    })
    .post('/sales-orders', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /sales-orders', key, body }, tx =>
        createSalesOrder(tx, actor, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await salesOrderResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/sales-orders/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Sales order')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeSalesOrderStatus(tx, actor, id, b.to, b.reason, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await salesOrderResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/projects/:id/seats', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await projectSeats(db, assertIdParam(params.id, 'Project')))
    })
```

dengan helper di dalam `salesRoutes`:

```ts
  async function salesOrderResponse(id: string) {
    const [so] = await listSalesOrders(db, { id })
    if (!so) throw errors.notFound('Sales order')
    return so
  }
```

Catatan: `GET /projects/:id/seats` tidak bentrok dengan rute core `/projects/:id` (segmen berbeda); bila Elysia bentrok, ledger sebagai ruling dan pindahkan ke `GET /sales-orders/seats?projectId=`.

- [ ] **Step 5:** test (tanpa dua yang di-skip) → PASS; typecheck.
- [ ] **Step 6:** Commit `feat(sales): sales order — baca, buat, status, kursi (S6b)`.

---

### Task 3: Qualify B2C membuat order; endpoint Group Trip

**Files:**
- Modify: `backend/src/modules/sales/qualify.ts`, `backend/src/modules/sales/routes.ts`
- Test: `backend/test/sales-orders.test.ts`

**Interfaces:**
- Consumes: `insertSalesOrder`, `projectSeats` (Task 2); `qualifyLead` (S6a).
- Produces:
  - `qualifyLead(tx, actor, id, input: { customerKind?; partyId?; priceMinor?; travelerCount? }, today, requestId): Promise<{ salesOrderId?: string }>`
  - `qualifyGroupTrip(tx, actor, leadId, input: Record<string, unknown>, today, requestId): Promise<{ outcome: 'qualified' | 'waitlist'; salesOrderId?: string }>`
  - Route `POST /leads/:id/group-trip` → `{ outcome, lead: LeadView, salesOrder: SalesOrderView | null }`.

- [ ] **Step 1: Test gagal** (tambah ke `sales-orders.test.ts`):

```ts
const b2cLead = async (name: string, extra: Record<string, unknown> = {}) => (await call('POST', '/leads', 'admin', {
  name, source: 'instagram', serviceCategory: 'individual-travel', destination: 'Bromo', travelStartDate: '2026-12-10',
  travelEndDate: '2026-12-12', travelerEstimate: 2, serviceScope: ['transportation'], requirementSummary: 'Liburan keluarga', ...extra
}, key())).json.data.id as string

describe('B2C qualify', () => {
  test('qualify with a price creates a standalone draft order linked to the lead', async () => {
    const id = await b2cLead('Pak Hadi S6b')
    const lead = (await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual', priceMinor: '5000000' })).json.data
    expect(lead.stage).toBe('qualified')
    const orderId = lead.b2c.salesOrderId as string
    expect((await call('GET', `/sales-orders/${orderId}`, 'admin')).json.data).toMatchObject({ leadId: id, partyId: lead.partyId, projectId: null, travelerCount: 2, priceMinor: '5000000', status: 'draft', destination: 'Bromo' })
  })

  test('group trip: enough seats qualifies with an order; too many pax is waitlisted without an order; a second try is 409', async () => {
    const seats = (await call('GET', '/projects/PRJ-205/seats', 'admin')).json.data as { available: number }
    const id = await b2cLead('Bu Nining S6b')
    const ok = (await call('POST', `/leads/${id}/group-trip`, 'admin', { projectId: 'PRJ-205', adultCount: 1, childCount: 0, infantCount: 0, priceMinor: '3500000', priceAcceptance: 'accept', bookingReadiness: 'ready' })).json.data
    expect(ok.outcome).toBe('qualified')
    expect(ok.salesOrder).toMatchObject({ projectId: 'PRJ-205', status: 'draft', travelerCount: 1, leadId: id })
    expect(ok.lead).toMatchObject({ stage: 'qualified', b2c: { b2cQualificationResult: 'qualified', projectId: 'PRJ-205', salesOrderId: ok.salesOrder.id } })
    expect((await call('GET', '/projects/PRJ-205/seats', 'admin')).json.data.available).toBe(Math.max(0, seats.available - 1))
    expect((await call('POST', `/leads/${id}/group-trip`, 'admin', { projectId: 'PRJ-205', adultCount: 1, childCount: 0, infantCount: 0, priceMinor: '3500000', priceAcceptance: 'accept', bookingReadiness: 'ready' })).status).toBe(409)
    const big = await b2cLead('Rombongan Besar S6b')
    const wait = (await call('POST', `/leads/${big}/group-trip`, 'admin', { projectId: 'PRJ-205', adultCount: 500, childCount: 0, infantCount: 0, priceMinor: '1000000', priceAcceptance: 'accept', bookingReadiness: 'ready' })).json.data
    expect(wait).toMatchObject({ outcome: 'waitlist', salesOrder: null })
    expect(wait.lead.stage).not.toBe('qualified')
    expect(wait.lead.b2c.b2cQualificationResult).toBe('waitlist')
    expect((await call('POST', `/leads/${big}/group-trip`, 'admin', { projectId: 'PRJ-101', adultCount: 1, childCount: 0, infantCount: 0, priceMinor: '1', priceAcceptance: 'accept', bookingReadiness: 'ready' })).status).toBe(422)
    expect((await call('POST', `/leads/${big}/group-trip`, 'finance', { projectId: 'PRJ-205', adultCount: 1, childCount: 0, infantCount: 0, priceMinor: '1', priceAcceptance: 'accept', bookingReadiness: 'ready' })).status).toBe(403)
  })

  test('two group trip qualifies for the last seat: one order, one waitlist', async () => {
    const seats = (await call('GET', '/projects/PRJ-502/seats', 'admin')).json.data as { available: number; capacity: number }
    // Fill PRJ-502 down to exactly one free seat with a throwaway order through the same endpoint.
    if (seats.available > 1) {
      const filler = await b2cLead('Pengisi Kursi S6b')
      await call('POST', `/leads/${filler}/group-trip`, 'admin', { projectId: 'PRJ-502', adultCount: seats.available - 1, childCount: 0, infantCount: 0, priceMinor: '1000000', priceAcceptance: 'accept', bookingReadiness: 'ready' })
    }
    const a = await b2cLead('Kursi Terakhir A S6b')
    const b = await b2cLead('Kursi Terakhir B S6b')
    const body = { projectId: 'PRJ-502', adultCount: 1, childCount: 0, infantCount: 0, priceMinor: '1000000', priceAcceptance: 'accept', bookingReadiness: 'ready' }
    const [ra, rb] = await Promise.all([call('POST', `/leads/${a}/group-trip`, 'admin', body), call('POST', `/leads/${b}/group-trip`, 'admin', body)])
    expect([ra.json.data.outcome, rb.json.data.outcome].sort()).toEqual(['qualified', 'waitlist'])
    expect((await call('GET', '/projects/PRJ-502/seats', 'admin')).json.data.available).toBe(0)
  })
})
```

(PRJ-502 kapasitas harus > pax order aktifnya; bila seed membuatnya penuh — `available = 0` — test mengambil project Group Trip lain dengan kursi kosong dari `GET /projects?…` atau membuat project Group Trip baru lewat `POST /projects { isGroupTrip: true, travelerCount: 10 }`; ledger sebagai ruling.)

- [ ] **Step 2:** `-t "B2C qualify"` → FAIL.

- [ ] **Step 3: `qualify.ts`** — tanda tangan `qualifyLead` menerima `priceMinor`, `travelerCount`; setelah lead di-qualify (dan juga bila lead sudah `qualified` tanpa order aktif), bila `input.priceMinor !== undefined`:

```ts
  if (input.priceMinor !== undefined) {
    if (lead.service_category !== 'individual-travel') throw errors.validation({ priceMinor: ['Harga order hanya untuk lead Individual Travel.'] })
    let price: bigint
    try { price = parseAmountMinor(input.priceMinor, 'priceMinor') } catch { throw errors.validation({ priceMinor: ['Harga harus angka rupiah lebih dari 0.'] }) }
    const pax = input.travelerCount ?? lead.traveler_estimate
    if (!Number.isInteger(pax) || (pax as number) < 1) throw errors.validation({ travelerCount: ['Jumlah traveler minimal 1.'] })
    await assertNoActiveOrder(tx, id)
    const { id: salesOrderId } = await insertSalesOrder(tx, actor, {
      partyId, projectId: null, leadId: id, destination: lead.destination!, travelStartDate: lead.travel_start_date!,
      travelEndDate: lead.travel_end_date!, travelerCount: pax as number, priceMinor: price, note: null
    }, today, requestId)
    await tx.query("update leads set b2c = b2c || jsonb_build_object('salesOrderId', $2::text) where id = $1", [id, salesOrderId])
    return { salesOrderId }
  }
  return {}
```

Restrukturisasi: early-return S6a `if (lead.stage === 'qualified' && lead.party_id) return` menjadi: bila sudah qualified, `partyId = lead.party_id` dan lewati langkah qualify (catatan, customer) — lanjut ke bagian order. Helper:

```ts
async function assertNoActiveOrder(tx: Queryable, leadId: string) {
  const [active] = await tx.query<{ id: string }>("select id from sales_order_refs where lead_id = $1 and status <> 'cancelled' limit 1", [leadId])
  if (active) throw new AppError(409, 'CONFLICT', `Lead ini sudah punya order ${active.id}.`, { details: { salesOrderId: active.id } })
}
```

`qualifyGroupTrip`:

```ts
const ACCEPTANCE = ['accept', 'need-discussion', 'not-suitable'] as const
const READINESS = ['ready', 'need-follow-up', 'still-considering'] as const

export async function qualifyGroupTrip(tx: Queryable, actor: Actor, leadId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ outcome: 'qualified' | 'waitlist'; salesOrderId?: string }> {
  const problems: FieldErrors = {}
  const counts = (['adultCount', 'childCount', 'infantCount'] as const).map((f) => {
    const v = input[f] ?? 0
    if (!Number.isInteger(v) || (v as number) < 0) { problems[f] = ['Jumlah harus angka ≥ 0.']; return 0 }
    return v as number
  })
  const pax = counts.reduce((a, b) => a + b, 0)
  if (!problems.adultCount && pax < 1) problems.adultCount = ['Minimal satu peserta.']
  if (!(ACCEPTANCE as readonly unknown[]).includes(input.priceAcceptance)) problems.priceAcceptance = ['Pilih penerimaan harga.']
  if (!(READINESS as readonly unknown[]).includes(input.bookingReadiness)) problems.bookingReadiness = ['Pilih kesiapan booking.']
  let price = 0n
  try { price = parseAmountMinor(input.priceMinor, 'priceMinor') } catch { problems.priceMinor = ['Harga harus angka rupiah lebih dari 0.'] }
  if (typeof input.projectId !== 'string' || !ID_PATTERN.test(input.projectId)) problems.projectId = ['Pilih project Group Trip.']
  if (Object.keys(problems).length) throw errors.validation(problems)

  const lead = await lockLead(tx, leadId)
  if (lead.service_category !== 'individual-travel') throw new AppError(422, 'RULE_VIOLATION', 'Hanya lead Individual Travel yang bisa ikut Group Trip.')
  if (lead.archived) throw new AppError(422, 'RULE_VIOLATION', 'Lead ini diarsip.')
  await assertNoActiveOrder(tx, leadId)
  const seats = await projectSeats(tx, input.projectId as string, true) // locks the project: concurrent qualifies queue here
  const [project] = await tx.query<{ destination: string; travel_start_date: string; travel_end_date: string }>(
    'select destination, travel_start_date::text as travel_start_date, travel_end_date::text as travel_end_date from projects where id = $1', [input.projectId])
  const answers = {
    groupTripProjectId: input.projectId, b2cAdultCount: counts[0], b2cChildCount: counts[1], b2cInfantCount: counts[2],
    b2cPriceAcceptance: input.priceAcceptance, b2cBookingReadiness: input.bookingReadiness
  }
  if (pax > seats.available) {
    await tx.query("update leads set b2c = b2c || $2::text::jsonb, last_updated_on = $3, updated_at = now() where id = $1",
      [leadId, JSON.stringify({ ...answers, b2cQualificationResult: 'waitlist' }), today])
    await recordAudit(tx, { action: 'lead.group_trip_waitlisted', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId, after: { projectId: input.projectId, pax, available: seats.available } })
    return { outcome: 'waitlist' }
  }
  // Seats are there: qualify (S6a rules, individual customer) and book.
  await tx.query("update leads set travel_start_date = coalesce(travel_start_date, $2::date), travel_end_date = coalesce(travel_end_date, $3::date), destination = coalesce(destination, $4), traveler_estimate = coalesce(traveler_estimate, $5) where id = $1",
    [leadId, project!.travel_start_date, project!.travel_end_date, project!.destination, pax])
  if (lead.stage !== 'qualified') await qualifyLead(tx, actor, leadId, { customerKind: 'individual' }, today, requestId)
  const [after] = await tx.query<{ party_id: string }>('select party_id from leads where id = $1', [leadId])
  const { id: salesOrderId } = await insertSalesOrder(tx, actor, {
    partyId: after!.party_id, projectId: input.projectId as string, leadId, destination: project!.destination,
    travelStartDate: project!.travel_start_date, travelEndDate: project!.travel_end_date, travelerCount: pax, priceMinor: price, note: null
  }, today, requestId)
  await tx.query("update leads set b2c = b2c || $2::text::jsonb, last_updated_on = $3, updated_at = now() where id = $1",
    [leadId, JSON.stringify({ ...answers, b2cQualificationResult: 'qualified', projectId: input.projectId, salesOrderId }), today])
  await insertLeadActivity(tx, leadId, 'note', `Booking ${salesOrderId} dibuat untuk Group Trip ${input.projectId as string}, status Awaiting DP`, actor.userId, today)
  return { outcome: 'qualified', salesOrderId }
}
```

(Imports tambahan di `qualify.ts`: `type FieldErrors`, `parseAmountMinor`, `insertSalesOrder`, `projectSeats`. `qualifyLead` dipanggil dari dalam transaksi yang sama — tidak ada transaksi bersarang.)

- [ ] **Step 4: routes** — `POST /leads/:id/qualify` meneruskan `priceMinor`, `travelerCount`; tambah (sebelum rute `/leads/:id/unqualify`):

```ts
    .post('/leads/:id/group-trip', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      const result = await db.transaction(tx => qualifyGroupTrip(tx, actor, id, (body ?? {}) as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, { outcome: result.outcome, lead: await leadResponse(id), salesOrder: result.salesOrderId ? await salesOrderResponse(result.salesOrderId) : null })
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

- [ ] **Step 5:** test `B2C qualify` → PASS; seluruh `leads-quotations.test.ts` tetap PASS; typecheck.
- [ ] **Step 6:** Commit `feat(sales): qualify B2C & Group Trip membuat sales order di server (S6b)`.

---

### Task 4: Finance — DP menandai paid; order tanpa project tidak bisa ditagih

**Files:**
- Modify: `backend/src/modules/finance/group-trip.ts`, `backend/src/modules/finance/receivables.ts`
- Test: `backend/test/finance-group-trip.test.ts`

**Interfaces:**
- Produces: `confirmGroupTripDp` mengubah `draft → paid` (+`paid_on`, `status_changed_at`); `salesOrderFinanceSummary(...)` menambah `orderStatus` di kedua bentuk.

- [ ] **Step 1: Test gagal** (tambah ke `finance-group-trip.test.ts`, pakai helper file itu — sesuaikan nama helper `post`/`get` dengan yang ada):

```ts
describe('S6b: DP confirmation and order status', () => {
  test('confirming the DP of a draft participant booking marks it paid with the DP date', async () => {
    const before = (await get('admin', '/sales-orders/SLO-007')).json.data
    expect(before.status).toBe('draft')
    const res = await post('finance', '/finance/sales-orders/SLO-007/confirm-dp', { bankAccountId: BANK, dpAmountMinor: '1050000', effectiveDate: '2026-08-16', dueDate: '2026-09-01' })
    expect(res.status).toBe(201)
    expect((await get('admin', '/sales-orders/SLO-007')).json.data).toMatchObject({ status: 'paid', paidOn: '2026-08-16' })
    expect((await get('finance', '/sales-orders/SLO-007/finance-summary')).json.data.orderStatus).toBe('paid')
  })

  test('standalone and cancelled orders cannot get a DP or a participant invoice', async () => {
    const standalone = await post('finance', '/finance/sales-orders/SLO-001/confirm-dp', { bankAccountId: BANK, dpAmountMinor: '6000000', effectiveDate: '2026-08-16', dueDate: '2026-09-01' })
    expect(standalone.status).toBe(422)
    const invoice = await post('finance', '/finance/customer-invoices', { salesOrderId: 'SLO-001', invoiceType: 'dp', dueDate: '2026-09-01', lines: [{ description: 'x', amountMinor: '1000' }] })
    expect(invoice.status).toBe(422)
    const cancelled = await post('finance', '/finance/sales-orders/SLO-010/confirm-dp', { bankAccountId: BANK, dpAmountMinor: '1050000', effectiveDate: '2026-08-16', dueDate: '2026-09-01' })
    expect(cancelled.status).toBe(422)
  })
})
```

`BANK` = rekening yang dipakai test lain di file itu; endpoint invoice manual = path yang dipakai test AR (`grep -n "customer-invoices" backend/test/*.ts`). Status `SLO-010 cancelled` dan `SLO-001` di seed berasal dari Task 5 — sampai Task 5 test ini `describe.skip`; Task 5 mencabutnya.

- [ ] **Step 2:** jalankan (sementara tanpa skip) → FAIL (status tetap draft / 201 untuk standalone).

- [ ] **Step 3: `group-trip.ts`** — `SalesOrderRow` tambah `status: string; project_id: string | null`; `readSalesOrder` memilih `status`; di `confirmGroupTripDp` sebelum validasi nominal:

```ts
  if (!so.project_id) throw rule('Sales order ini bukan booking Group Trip — DP peserta hanya untuk Group Trip.')
  if (so.status === 'cancelled') throw rule('Sales order ini sudah dibatalkan.')
```

setelah `postReceipt`:

```ts
  if (so.status === 'draft') {
    await tx.query("update sales_order_refs set status = 'paid', paid_on = $2::date, status_changed_at = now(), updated_at = now() where id = $1", [so.id, effectiveDate])
  }
```

`postReceipt` menerima `projectId: so.project_id!`. `salesOrderFinanceSummary`: tambahkan `orderStatus: so.status` ke kedua objek return.

- [ ] **Step 4: `receivables.ts`** — setelah `if (!salesOrder) throw …`:

```ts
    if (!salesOrder.project_id) throw rule('Sales order tanpa project (B2C standalone) belum bisa ditagih lewat Finance.')
```

(tipe `project_id: string | null`; `rule` diimpor dari `./common` bila belum.)

- [ ] **Step 5:** test → PASS; `bun run test` seluruhnya (Finance tests lama tetap hijau); typecheck.
- [ ] **Step 6:** Commit `feat(finance): konfirmasi DP menandai booking Group Trip paid; order standalone tidak ditagih (S6b)`.

---

### Task 5: Seed & extract — 13 order lengkap

**Files:**
- Modify: `backend/scripts/extract-demo-core.ts`, `backend/src/db/seed-demo.ts`, `backend/src/db/seeds/demo-core.json`, `backend/test/db.test.ts`, `backend/test/sales-orders.test.ts` (cabut skip), `backend/test/finance-group-trip.test.ts` (cabut skip)

- [ ] **Step 1: Test gagal** (`db.test.ts`):

```ts
  test('all demo sales orders are seeded with status; a re-seed keeps statuses the API changed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const rows = await db.query<{ id: string; status: string; project_id: string | null }>('select id, status, project_id from sales_order_refs order by id')
      expect(rows).toHaveLength(13)
      expect(rows.find(r => r.id === 'SLO-001')).toEqual({ id: 'SLO-001', status: 'draft', project_id: null })
      expect(rows.find(r => r.id === 'SLO-006')!.status).toBe('paid')
      await db.query("update sales_order_refs set status = 'cancelled', status_reason = 'Batal', status_changed_at = now() where id = 'SLO-007'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [after] = await db.query<{ status: string; status_reason: string }>("select status, status_reason from sales_order_refs where id = 'SLO-007'")
      expect(after).toEqual({ status: 'cancelled', status_reason: 'Batal' })
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `-t "all demo sales orders"` → FAIL (8 baris).
- [ ] **Step 3: `DemoCoreSeed.salesOrders`** menjadi:

```ts
  /** Sales orders (S6b): B2C standalone (no project) and Group Trip participant bookings. */
  salesOrders: { id: string; projectId: string | null; partyId: string; priceMinor: string; travelerCount: number; status: string; destination: string; travelStartDate: string; travelEndDate: string; note: string | null; createdOn: string; leadId: string | null }[]
```

- [ ] **Step 4: extractor** — ganti blok `salesOrders`:

```ts
  salesOrders: [...SALES_ORDERS].sort(byId).map(o => ({
    id: o.id,
    projectId: o.projectId ?? null,
    partyId: o.customerId,
    priceMinor: String(Math.round(o.priceIdr)),
    travelerCount: o.travelerCount,
    status: o.status,
    destination: o.destination,
    travelStartDate: dateOnly(o.travelStartDate)!,
    travelEndDate: dateOnly(o.travelEndDate)!,
    note: o.note ?? null,
    createdOn: dateOnly(o.createdAt)!,
    leadId: LEADS.find(l => l.salesOrderId === o.id)?.id ?? null
  }))
```

Jalankan `bun run seed:extract`; cek `salesOrders` = 13.

- [ ] **Step 5: seed-demo** — ganti loop `seed.salesOrders`:

```ts
    // S6b: trip details refresh; status only while the API never changed it (status_changed_at is null).
    for (const so of seed.salesOrders ?? []) {
      await tx.query(
        `insert into sales_order_refs (id, project_id, party_id, price_minor, traveler_count, status, destination, travel_start_date,
           travel_end_date, note, created_on, lead_id, paid_on, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, case when $6 in ('paid', 'ongoing', 'done') then $11::date end, $13)
         on conflict (id) do update set project_id = excluded.project_id, party_id = excluded.party_id, price_minor = excluded.price_minor,
           traveler_count = excluded.traveler_count, destination = excluded.destination, travel_start_date = excluded.travel_start_date,
           travel_end_date = excluded.travel_end_date, note = excluded.note, created_on = excluded.created_on, lead_id = excluded.lead_id,
           status = case when sales_order_refs.status_changed_at is null then excluded.status else sales_order_refs.status end,
           paid_on = case when sales_order_refs.status_changed_at is null then excluded.paid_on else sales_order_refs.paid_on end
         where sales_order_refs.provenance = 'demo-fixture'`,
        [so.id, so.projectId, so.partyId, so.priceMinor, so.travelerCount, so.status, so.destination, so.travelStartDate,
          so.travelEndDate, so.note, so.createdOn, so.leadId, P]
      )
    }
```

Pindahkan blok ini **setelah** blok leads (lead_id FK) — blok leads S6a sudah sebelum projects, dan sales orders butuh projects, jadi letakkan setelah loop `seed.projects`/services seperti posisi lama. Lead fixture `b2c.salesOrderId` sudah ada di JSON (S6a).

- [ ] **Step 6:** cabut `test.skip`/`describe.skip` di `sales-orders.test.ts` dan `finance-group-trip.test.ts`; test `all demo sales orders` + `sales-orders.test.ts` + `finance-group-trip.test.ts` → PASS; `bun run test` seluruhnya PASS (Review Focus 4 tercakup di Step 1).
- [ ] **Step 7:** Commit `feat(sales): seed 13 sales order dengan status (S6b)`.

---

### Task 6: Frontend — tipe, endpoint, `sales-orders-sync`, kursi dari order

**Files:**
- Modify: `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`, `frontend/app/data/index.ts` (kursi), `frontend/app/data/leads-sync.ts` (qualify B2C + group trip), `frontend/app/layouts/dashboard.vue`, `frontend/app/pages/settings.vue`, tests data terkait
- Create: `frontend/app/data/sales-orders-sync.ts`, `frontend/app/data/sales-orders-sync.test.ts`

**Interfaces:**
- Produces:
  - `SalesOrderDto` (= `SalesOrderView`), `ProjectSeatsDto`, `GroupTripQualifyDto = { outcome: 'qualified' | 'waitlist'; lead: LeadDto; salesOrder: SalesOrderDto | null }`, `SalesOrderCreateInput`.
  - `api.sales`: `listSalesOrders(query?)`, `getSalesOrder(id)`, `createSalesOrder(input, key)`, `changeSalesOrderStatus(id, { to, reason? })`, `projectSeats(projectId)`, `qualifyGroupTrip(leadId, input)`; `qualifyLead` input menerima `priceMinor?`, `travelerCount?`.
  - `sales-orders-sync.ts`: `salesOrderFromServer(d): SalesOrder`, `upsertServerSalesOrder(d)`, `mergeServerSalesOrders(list)`, `loadServerSalesOrders(api)`, `changeSalesOrderStatusOnServer(api, id, to, reason?)`, `reloadSalesOrder(api, id)`, `useSalesOrdersSync()`.
  - `leads-sync.ts`: `qualifyB2cLeadOnServer(api, leadId, priceIdr, travelerCount?): Promise<{ lead: Lead; order?: SalesOrder }>`, `qualifyGroupTripOnServer(api, leadId, input): Promise<{ outcome; lead: Lead; order?: SalesOrder }>`.
  - `data/index.ts`: `getProjectSeatsFilled(projectId)` = Σ pax order project berstatus `paid|ongoing|done` (bukan traveler); `getProjectSeatsPending` tetap (draft).
  - `SalesOrder` type tambah `leadId?: ID`, `statusReason?: string`, `paidOn?: string`.

- [ ] **Step 1: Test gagal** — `sales-orders-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SALES_ORDERS } from './sales-orders'
import { changeSalesOrderStatusOnServer, mergeServerSalesOrders, salesOrderFromServer } from './sales-orders-sync'
import { getProjectSeatsAvailable, getProjectSeatsFilled, getProjectSeatsPending } from './index'
import type { SalesOrderDto } from '~/types/api'

const dto = (over: Partial<SalesOrderDto> = {}): SalesOrderDto => ({
  id: 'SLO-006', projectId: 'PRJ-205', partyId: 'PTY-010', partyName: 'Peserta', leadId: 'LED-021', destination: 'Bromo & Ijen, Indonesia',
  travelStartDate: '2026-09-18', travelEndDate: '2026-09-21', travelerCount: 2, priceMinor: '7000000', status: 'paid', statusReason: null,
  note: null, paidOn: '2026-08-10', createdOn: '2026-08-10', updatedAt: '2026-08-10T00:00:00.000Z', ...over
})

describe('sales-orders-sync', () => {
  it('maps a server order to the local shape', () => {
    expect(salesOrderFromServer(dto())).toMatchObject({ id: 'SLO-006', customerId: 'PTY-010', projectId: 'PRJ-205', priceIdr: 7_000_000, status: 'paid', createdAt: '2026-08-10', leadId: 'LED-021', paidOn: '2026-08-10' })
    expect(salesOrderFromServer(dto({ projectId: null })).projectId).toBeUndefined()
  })

  it('merge replaces the list in place and seats follow the orders (paid fills, draft holds)', () => {
    const before = SALES_ORDERS.find(o => o.id === 'SLO-006')!
    mergeServerSalesOrders([dto(), dto({ id: 'SLO-007', status: 'draft', travelerCount: 1 }), dto({ id: 'SLO-010', status: 'cancelled', travelerCount: 1 })])
    expect(SALES_ORDERS.map(o => o.id)).toEqual(['SLO-006', 'SLO-007', 'SLO-010'])
    expect(SALES_ORDERS[0]).toBe(before)
    expect(getProjectSeatsFilled('PRJ-205')).toBe(2)
    expect(getProjectSeatsPending('PRJ-205')).toBe(1)
    expect(getProjectSeatsAvailable('PRJ-205')).toBeGreaterThanOrEqual(0)
  })

  it('status change takes the server answer', async () => {
    mergeServerSalesOrders([dto({ id: 'SLO-001', projectId: null, status: 'draft' })])
    const api = { sales: { changeSalesOrderStatus: (id: string, input: { to: string }) => Promise.resolve({ data: dto({ id, projectId: null, status: input.to as SalesOrderDto['status'] }) }) } } as never
    const order = await changeSalesOrderStatusOnServer(api, 'SLO-001', 'paid')
    expect(order.status).toBe('paid')
    expect(SALES_ORDERS.find(o => o.id === 'SLO-001')!.status).toBe('paid')
  })
})
```

- [ ] **Step 2:** `pnpm vitest run app/data/sales-orders-sync.test.ts` (dari `frontend/`) → FAIL.

- [ ] **Step 3: tipe + endpoint** — `types/api.ts`:

```ts
/** Sales orders (S6b) — B2C standalone (projectId null) and Group Trip participant bookings. */
export interface SalesOrderDto {
  id: string; projectId: string | null; partyId: string; partyName: string; leadId: string | null; destination: string | null
  travelStartDate: string | null; travelEndDate: string | null; travelerCount: number; priceMinor: string
  status: 'draft' | 'paid' | 'ongoing' | 'done' | 'cancelled'; statusReason: string | null; note: string | null; paidOn: string | null
  createdOn: string; updatedAt: string
}
export interface ProjectSeatsDto { capacity: number; filled: number; held: number; available: number }
export interface SalesOrderCreateInput { partyId?: string; customerName?: string; destination: string; travelStartDate: string; travelEndDate: string; travelerCount: number; priceMinor: string; note?: string }
export interface GroupTripQualifyInput { projectId: string; adultCount: number; childCount: number; infantCount: number; priceMinor: string; priceAcceptance: string; bookingReadiness: string }
export interface GroupTripQualifyDto { outcome: 'qualified' | 'waitlist'; lead: LeadDto; salesOrder: SalesOrderDto | null }
```

`endpoints.ts` (`sales`):

```ts
      listSalesOrders: (query: { projectId?: string } = {}) => client.get<SalesOrderDto[]>('/sales-orders', { query: { ...query } }),
      getSalesOrder: (id: string) => client.get<SalesOrderDto>(`/sales-orders/${seg(id)}`),
      createSalesOrder: (input: SalesOrderCreateInput, idempotencyKey: string = newIdempotencyKey()) => client.post<SalesOrderDto>('/sales-orders', input, { idempotencyKey }),
      changeSalesOrderStatus: (id: string, input: { to: string; reason?: string }) => client.post<SalesOrderDto>(`/sales-orders/${seg(id)}/status`, input),
      projectSeats: (projectId: string) => client.get<ProjectSeatsDto>(`/projects/${seg(projectId)}/seats`),
      qualifyGroupTrip: (leadId: string, input: GroupTripQualifyInput) => client.post<GroupTripQualifyDto>(`/leads/${seg(leadId)}/group-trip`, input),
```

dan `qualifyLead` input: `{ customerKind: 'company' | 'individual'; partyId?: string; priceMinor?: string; travelerCount?: number }`.

- [ ] **Step 4: `sales-orders-sync.ts`**

```ts
import { SALES_ORDERS } from './sales-orders'
import type { SalesOrder } from '~/types/sales-order'
import type { SalesOrderDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `SALES_ORDERS` (S6b). The server owns sales orders — standalone B2C and Group Trip bookings — their status
 * and the seats they hold. Travelers created after a DP stay local (S7).
 */

type SalesApi = Pick<ManovaApi, 'sales'>

export function salesOrderFromServer (d: SalesOrderDto): SalesOrder {
  return {
    id: d.id,
    customerId: d.partyId,
    destination: d.destination ?? '',
    travelStartDate: d.travelStartDate ?? '',
    travelEndDate: d.travelEndDate ?? '',
    travelerCount: d.travelerCount,
    priceIdr: Number(d.priceMinor),
    status: d.status,
    note: d.note ?? undefined,
    createdAt: d.createdOn,
    projectId: d.projectId ?? undefined,
    leadId: d.leadId ?? undefined,
    statusReason: d.statusReason ?? undefined,
    paidOn: d.paidOn ?? undefined
  }
}

export function upsertServerSalesOrder (d: SalesOrderDto): SalesOrder {
  const value = salesOrderFromServer(d)
  const local = SALES_ORDERS.find(o => o.id === d.id)
  if (!local) {
    SALES_ORDERS.push(value)
    return SALES_ORDERS[SALES_ORDERS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerSalesOrders (list: SalesOrderDto[]): void {
  const keep = new Set(list.map(o => o.id))
  for (let i = SALES_ORDERS.length - 1; i >= 0; i--) {
    if (!keep.has(SALES_ORDERS[i]!.id)) { SALES_ORDERS.splice(i, 1) }
  }
  for (const o of list) { upsertServerSalesOrder(o) }
}

export async function loadServerSalesOrders (api: SalesApi): Promise<void> {
  mergeServerSalesOrders((await api.sales.listSalesOrders()).data)
}

export async function reloadSalesOrder (api: SalesApi, id: string): Promise<SalesOrder> {
  return upsertServerSalesOrder((await api.sales.getSalesOrder(id)).data)
}

export async function changeSalesOrderStatusOnServer (api: SalesApi, id: string, to: SalesOrder['status'], reason?: string): Promise<SalesOrder> {
  return upsertServerSalesOrder((await api.sales.changeSalesOrderStatus(id, { to, ...(reason?.trim() ? { reason: reason.trim() } : {}) })).data)
}

export interface SalesOrdersSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads sales orders once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useSalesOrdersSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<SalesOrdersSyncState>('manova-sales-orders-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerSalesOrders(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Sales order belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
```

- [ ] **Step 5: `leads-sync.ts`** — tambah (impor `upsertServerSalesOrder` dari `./sales-orders-sync`):

```ts
/** B2C qualify (S6b): the server qualifies the lead, links the customer and creates the standalone order in one go. */
export async function qualifyB2cLeadOnServer (api: SalesApi, id: string, priceIdr: number, travelerCount?: number): Promise<{ lead: Lead; order?: SalesOrder }> {
  const lead = upsertServerLead((await api.sales.qualifyLead(id, { customerKind: 'individual', priceMinor: String(Math.round(priceIdr)), ...(travelerCount ? { travelerCount } : {}) })).data)
  await reloadParty(api, lead.partyId)
  const orderId = lead.salesOrderId
  const order = orderId ? upsertServerSalesOrder((await api.sales.getSalesOrder(orderId)).data) : undefined
  return { lead, order }
}

/** Group Trip qualify (S6b): the server checks the seats (locked per project) — qualified with an order, or waitlist. */
export async function qualifyGroupTripOnServer (api: SalesApi, id: string, input: { projectId: string; adultCount: number; childCount: number; infantCount: number; priceIdr: number; priceAcceptance: string; bookingReadiness: string }): Promise<{ outcome: 'qualified' | 'waitlist'; lead: Lead; order?: SalesOrder }> {
  const { priceIdr, ...rest } = input
  const res = (await api.sales.qualifyGroupTrip(id, { ...rest, priceMinor: String(Math.round(priceIdr)) })).data
  const lead = upsertServerLead(res.lead)
  const order = res.salesOrder ? upsertServerSalesOrder(res.salesOrder) : undefined
  if (order) { await reloadParty(api, lead.partyId) }
  return { outcome: res.outcome, lead, order }
}
```

- [ ] **Step 6: kursi** — `data/index.ts`:

```ts
/** Kapasitas Group Trip B2C (S6b): "seat terisi" = pax order project yang sudah DP (`paid/ongoing/done`), rumus yang sama
 * dengan server (`GET /projects/:id/seats`) — bukan lagi dari baris `Traveler` lokal. */
export const getProjectSeatsFilled = (projectId: string) =>
  getSalesOrdersByProject(projectId).filter(order => order.status === 'paid' || order.status === 'ongoing' || order.status === 'done').reduce((sum, order) => sum + order.travelerCount, 0)
```

(pindahkan `getSalesOrdersByProject` ke atas definisi ini bila perlu). Tipe `SalesOrder` tambah `leadId?: ID`, `statusReason?: string`, `paidOn?: string`. Perbaiki test data lama yang mengasumsikan kursi dari traveler (`group-trip-orders.test.ts` dll.) agar mengikuti rumus order — ledger tiap perubahan.

- [ ] **Step 7:** `dashboard.vue`: `useSalesOrdersSync` dimuat di `loadServerData` (hanya peran internal, sama dengan `loadLeads`), label `'sales order'` di `unsyncedLabel`/`unsyncedMessage`; `settings.vue` reset memanggil `load(true)`.
- [ ] **Step 8:** `pnpm vitest run app/data` → PASS; `pnpm test` PASS; vue-tsc ≤ 2000; lint per file tidak bertambah.
- [ ] **Step 9:** Commit `feat(frontend): sales order dari server + kursi dari order (S6b)`.

---

### Task 7: Frontend — layar sales order, qualify B2C/Group Trip, DP

**Files:**
- Modify: `frontend/app/pages/sales-orders/[id]/index.vue`, `frontend/app/components/sales/LeadDetailSheet.vue`, `frontend/app/pages/project-orders/[id]/index.vue`, `frontend/app/data/index.ts` (`markGroupTripOrderPaid`), `frontend/app/no-local-sales.test.ts`

- [ ] **Step 1: Test gagal** — tambah ke `FORBIDDEN` di `no-local-sales.test.ts`: `'createSalesOrder(', 'updateSalesOrderStatus(', 'qualifyLeadAndCreateSalesOrder(', 'qualifyGroupTripLead('`. `pnpm vitest run app/no-local-sales.test.ts` → FAIL (sales-orders page, LeadDetailSheet).

- [ ] **Step 2: `/sales-orders/[id]`** — `advanceTo` lewat server; batal membuka dialog alasan:

```ts
const api = useApi()
const isSaving = ref(false)
const isCancelOpen = ref(false)
const cancelReason = ref('')

async function advanceTo (status: SalesOrderStatus, reason?: string) {
  if (!order.value || isSaving.value) { return }
  if (status === 'cancelled' && !reason) { cancelReason.value = ''; isCancelOpen.value = true; return }
  isSaving.value = true
  try {
    const updated = await changeSalesOrderStatusOnServer(api, order.value.id, status, reason)
    isCancelOpen.value = false
    showToast('Status Diperbarui', `${updated.id} kini berstatus "${findStatusOption(SALES_ORDER_STATUSES, updated.status).label}".`, 'success')
  } catch (error) {
    showToast('Gagal Mengubah Status', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
  } finally {
    isSaving.value = false
  }
}
```

Tombol status: `:disabled="isSaving"`; untuk order Group Trip (`order.projectId`) tombol `paid` disembunyikan (filter `nextStatuses`: `s !== 'paid' || !order.projectId`) dengan teks bantu "Paid lewat konfirmasi DP di Finance". Dialog batal: `Input v-model="cancelReason"` + tombol "Batalkan Order" `:disabled="!cancelReason.trim() || isSaving"` `@click="advanceTo('cancelled', cancelReason.trim())"`. Bila order batal punya `statusReason`, tampilkan di metadata ("Alasan batal"). Hapus import `updateSalesOrderStatus`.

- [ ] **Step 3: `LeadDetailSheet.vue`** —
  - `doQualify` cabang B2C: ganti `saveQualificationDraft` + `qualifyLeadOnServer(…'individual')` + `qualifyLeadAndCreateSalesOrder` dengan:

```ts
    const result = await run('Qualify Gagal', async () => {
      await saveQualificationDraft()
      return await qualifyB2cLeadOnServer(api, id, price)
    })
    if (!result) { return }
    isQualifyDialogOpen.value = false
    if (result.order) { navigateTo(`/sales-orders/${result.order.id}`) }
    return
```

  - `doQualifyGroupTrip` cabang `qualified`/`waitlist`: ganti blok `needsCustomer` + `qualifyGroupTripLead` + `saveQualificationDraft` setelahnya dengan:

```ts
  const result = await run('Qualify Gagal', async () => {
    await saveQualificationDraft()
    return await qualifyGroupTripOnServer(api, id, {
      projectId: qualGroupTripProjectId.value,
      adultCount: qualAdultCount.value ?? 0,
      childCount: qualChildCount.value ?? 0,
      infantCount: qualInfantCount.value ?? 0,
      priceIdr: qualPackagePriceIdr.value ?? 0,
      priceAcceptance: qualPriceAcceptance.value || 'need-discussion',
      bookingReadiness: qualBookingReadiness.value || 'still-considering'
    })
  })
  if (!result) { return }
  if (result.outcome === 'waitlist') {
    showToast('Masuk Waitlist', 'Seat tidak cukup — Lead ditandai Waitlist untuk Project ini.', 'warning')
  } else {
    showToast('Qualified — Awaiting DP', `${result.order?.id ?? 'Booking'} dibuat, menunggu DP.`, 'success')
    emit('update:open', false)
  }
```

  - Hapus import `qualifyLeadAndCreateSalesOrder`, `qualifyGroupTripLead`, dan `getProjectSeatsAvailable` bila tidak dipakai lagi; impor `qualifyB2cLeadOnServer`, `qualifyGroupTripOnServer` dari `~/data/leads-sync`.

- [ ] **Step 4: project order DP** — `onDpConfirmed`:

```ts
async function onDpConfirmed () {
  if (!confirmDpOrder.value) { return }
  const id = confirmDpOrder.value.id
  try {
    await reloadSalesOrder(api, id) // the server marked it paid with the DP
  } catch {
    // The next sales order sync brings it.
  }
  markGroupTripOrderPaid(id) // local travelers only (S7)
  refreshStep()
  orderSummaries.refresh()
}
```

(`api` = `useApi()` yang sudah ada di halaman, atau tambahkan.) `markGroupTripOrderPaid` di `data/index.ts`: syarat menjadi `order.projectId && order.status === 'paid'` (status sudah dari server) dan tidak lagi mengubah status — hanya membuat traveler (idempoten); perbarui komentar dan test data terkait (`group-trip-orders.test.ts`).

- [ ] **Step 5:** `pnpm vitest run app/no-local-sales.test.ts` → PASS; `pnpm test` PASS; vue-tsc ≤ 2000; lint per file tidak bertambah; `pnpm build` sukses.
- [ ] **Step 6:** Commit `feat(frontend): sales order, qualify B2C/Group Trip & DP lewat server (S6b)`.

---

### Task 8: Dokumentasi, DB lokal, smoke

- [ ] **Step 1:** ADR-004 — catatan S6b: sales order milik API (status, kursi terkunci per project, DP menandai paid, standalone tidak ditagih Finance, seed hanya menulis status yang belum diubah API); spec status → "diimplementasikan".
- [ ] **Step 2:** DB lokal — hentikan backend dev (port 3000) dulu; `bun run db:migrate` lalu `bun run db:seed:demo`; nyalakan lagi `bun run dev` di background.
- [ ] **Step 3: Smoke** pada salinan DB di port 3100: login admin → `GET /sales-orders` (13), `GET /projects/PRJ-205/seats`, qualify Group Trip lead B2C baru → order draft, finance confirm DP → order paid, batal order standalone dengan alasan; finance `POST /sales-orders` 403. Matikan server & hapus salinan.
- [ ] **Step 4:** Commit `docs: catatan S6b sales order di ADR-004`.
