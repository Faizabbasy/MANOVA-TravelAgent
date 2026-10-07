# Quotation vendor, service order & orkestrasi booking lewat API (S4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quotation vendor, service order (otomatis + status), payment gate booking (dihitung dari Finance), log percobaan booking, dan tanda duplikat berjalan lewat server; supplier invoice otomatis lokal dihapus.

**Architecture:** Tabel baru `vendor_quotations` & `booking_attempts`, perluasan `service_orders` & `booking_refs` (migrasi 0023). Modul server: `core/service-orders.ts` (SO otomatis + status), `core/vendor-quotations.ts` (submit/accept/reject), `core/booking-orchestration.ts` (gate dihitung, attempts). Frontend: `procurement-sync.ts` (quotation + SO) dan perluasan `bookings-sync.ts` (gate/attempts/duplikat); pemanggil dialihkan ke server, efek lokal yang tak lagi benar dihapus.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (`backend/`), Nuxt 4 + Vue 3 + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-07-quotations-service-orders-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan campur, jangan tambah lockfile.
- Uang = `bigint` minor di SQL, string (`…Minor`) di wire; frontend `…Idr` number.
- Pola tulis S0: `auth.requireActor` → capability → validasi `errors.validation` (400, Indonesia) / `rule()` 422 → perubahan + `recordAudit` satu transaksi → respons = bentuk GET. Create pakai `withIdempotency` + `requireIdempotencyKey`.
- ID dari `nextId(q, prefix)`; seed memanggil `syncIdSequences`.
- Capability tulis: `project-order.manage-service.<flight|hotel|transportation|mice|additional>` (jenis layanan); SO tanpa layanan: `vendor.manage-vendor`. Finance baca. Portal tidak menulis. Di luar scope → 404.
- Parameter daftar ke SQL lewat JSON: `$n::text::jsonb` + `JSON.stringify` (backend/CLAUDE.md) — mis. `i.project_id in (select jsonb_array_elements_text($1::text::jsonb))`.
- `booking_type` `transport` ↔ layanan `transportation` hanya lewat `serviceTypeOf` (booking-rules).
- Perubahan bentuk API → update `frontend/app/types/api.ts` + `lib/api/endpoints.ts` di perubahan yang sama; bentuk lama SO (`id, vendorId, vendorName, projectId, serviceId`) tetap ada.
- File CRLF: Edit tool, atau `tr -d '\r'` → ubah → `perl -pe 's/\n$/\r\n/'`.
- Test backend: `bun run test`; filter `bun test --timeout 30000 test/<file> -t "<nama>"`. Bun `toMatchObject` menimpa field yang dicocokkan → ambil id sebelum `toMatchObject`.
- Frontend: vue-tsc `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` total ≤ 2010; lint error per file tidak bertambah vs HEAD; tanpa `void` (aturan `no-void`); API palsu di test pakai `Promise.resolve/reject` (`require-await`).
- Commit tiap task, jangan push.

## Rulings dari spec (saat menulis plan)

1. **Gate "cleared"** = status pembayaran (`derivePaymentStatus(invoices, today, moreToBill = true)`) ∈ `dp_received | up_to_date | paid`. Dengan `moreToBill = true` "semua tagihan yang terbit sudah lunas" muncul sebagai `dp_received`/`up_to_date` (bukan `paid`) — keduanya berarti pembayaran aman sejauh ini; tanpa query "masih ada yang perlu ditagih" per booking. `overdue`, `partially_paid`, `awaiting_payment`, `not_invoiced` → `pending`.
2. **Duplikat**: booking "aktif" = status bukan `cancelled|refunded|no-show|completed`. Konflik hanya mungkin bila `serviceId` dikirim eksplisit (layanan yang dipakai ulang S4a selalu tanpa booking; layanan baru juga).
3. **ID attempt fixture** (`BKO-002-ATT-1`) dipakai apa adanya oleh seed; attempt baru `BAT-`.
4. **Gate dihitung di route**, bukan di `repository.ts` (menghindari import `finance/summaries` dari repository).

## Review Focus

1. Menerima quotation untuk layanan yang vendornya terkunci invoice vendor lain → 422 dan **tidak ada** perubahan setengah jalan (quotation tetap `submitted`, pesaing tidak ditolak).
2. Ganti vendor bolak-balik A → B → A tanpa invoice → SO A lama tetap batal, SO A baru dibuat (unique index aktif per layanan+vendor tidak meledak).
3. Booking dengan tagihan sendiri yang belum dibayar padahal DP project sudah masuk → gate `pending` (basis booking, bukan project).
4. Membatalkan SO yang sudah ditagih vendor (invoice vendor `submitted`) → 422.
5. `POST /bookings` dengan `allowDuplicate: true` tapi tanpa konflik → booking normal, **tidak** ditandai duplikat.

Tes masing-masing ada di Task 3 (1), Task 2 (2, 4), Task 4 (3, 5).

---

### Task 1: Migrasi 0023 + prefix ID

**Files:**
- Create: `backend/migrations/0023_quotations_service_orders.up.sql`, `.down.sql`
- Modify: `backend/src/shared/ids.ts`
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces: tabel `vendor_quotations`, `booking_attempts`; kolom SO `status, net_cost_minor, line_items, source_quotation_id, status_reason, acknowledged_at, fulfilled_at, updated_at`; kolom booking `flagged_duplicate, duplicate_of, duplicate_note`; `IdPrefix` + `'VQ-' | 'SO-' | 'BAT-'`.

- [ ] **Step 1: Test gagal** (describe `demo seed` di `db.test.ts`):

```ts
  test('quotations, service order status and booking attempts exist after 0023', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [so] = await db.query<{ status: string; line_items: unknown }>("select status, line_items from service_orders where id = 'SO-101F'")
      expect(typeof so!.status).toBe('string')
      expect(Array.isArray(so!.line_items)).toBe(true)
      await expect(db.query("update service_orders set status = 'lost' where id = 'SO-101F'")).rejects.toThrow()
      await db.query("insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, submitted_on) values ('VQ-T1', 'VND-001', 'PRJ-101', 'SVC-1011', 'flight', 1000, '2026-10-01')")
      await expect(db.query("insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, submitted_on) values ('VQ-T2', 'VND-001', 'PRJ-102', 'SVC-1011', 'flight', 1000, '2026-10-01')")).rejects.toThrow() // service of another project
      await expect(db.query("insert into vendor_quotations (id, vendor_id, project_id, service_type, amount_minor, submitted_on) values ('VQ-T3', 'VND-001', 'PRJ-101', 'flight', 0, '2026-10-01')")).rejects.toThrow() // amount > 0
      await db.query("insert into booking_attempts (id, booking_type, booking_id, outcome) values ('BAT-T1', 'flight', 'FLT-1011', 'failed')")
      await expect(db.query("insert into booking_attempts (id, booking_type, booking_id, outcome) values ('BAT-T2', 'flight', 'FLT-1011', 'maybe')")).rejects.toThrow()
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('VQ-','SO-','BAT-') order by prefix")
      expect(seqs.map(s => s.prefix)).toEqual(['BAT-', 'SO-', 'VQ-'])
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `bun test --timeout 30000 test/db.test.ts -t "0023"` → FAIL (tabel tidak ada).

- [ ] **Step 3: up.sql**

```sql
-- S4b: vendor quotations, service orders with status, booking attempts and duplicate flags (API-owned).
create table vendor_quotations (
  id              text primary key check (id <> ''),
  vendor_id       text not null references vendors (id),
  project_id      text not null references projects (id),
  service_id      text,
  service_type    text not null check (service_type in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  amount_minor    bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  notes           text,
  status          text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  decision_reason text,
  submitted_on    date not null,
  decided_at      timestamptz,
  decided_by      text references users (id),
  provenance      text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at      timestamptz not null default now(),
  constraint vendor_quotations_service_fk foreign key (service_id, project_id) references project_services (id, project_id)
);
create index vendor_quotations_service on vendor_quotations (service_id);
create index vendor_quotations_project on vendor_quotations (project_id);
create unique index vendor_quotations_one_accepted on vendor_quotations (service_id) where status = 'accepted';

alter table service_orders
  add column status text not null default 'draft'
    check (status in ('draft', 'sent', 'acknowledged', 'amended', 'fulfilled', 'cancelled')),
  add column net_cost_minor bigint check (net_cost_minor is null or (net_cost_minor >= 0 and net_cost_minor <= 1000000000000000)),
  add column line_items jsonb not null default '[]'::jsonb check (jsonb_typeof(line_items) = 'array'),
  add column source_quotation_id text references vendor_quotations (id),
  add column status_reason text,
  add column acknowledged_at timestamptz,
  add column fulfilled_at timestamptz,
  add column updated_at timestamptz not null default now();
create unique index service_orders_one_active on service_orders (service_id, vendor_id)
  where status <> 'cancelled' and service_id is not null;

alter table booking_refs
  add column flagged_duplicate boolean not null default false,
  add column duplicate_of jsonb not null default '[]'::jsonb check (jsonb_typeof(duplicate_of) = 'array'),
  add column duplicate_note text;

create table booking_attempts (
  id            text primary key check (id <> ''),
  booking_type  text not null,
  booking_id    text not null,
  outcome       text not null check (outcome in ('success', 'failed', 'manual-fallback')),
  note          text,
  actor_user_id text references users (id),
  attempted_at  timestamptz not null default now(),
  provenance    text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  constraint booking_attempts_booking_fk foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id)
);
create index booking_attempts_booking on booking_attempts (booking_type, booking_id);

insert into id_sequences (prefix, last_value)
select 'SO-', coalesce(max(substring(id from '^SO-([0-9]+)$')::integer), 0) from service_orders
on conflict (prefix) do nothing;
insert into id_sequences (prefix, last_value) values ('VQ-', 0), ('BAT-', 0) on conflict (prefix) do nothing;
```

down.sql:

```sql
delete from id_sequences where prefix in ('VQ-', 'SO-', 'BAT-');
drop table if exists booking_attempts;
alter table booking_refs drop column if exists flagged_duplicate, drop column if exists duplicate_of, drop column if exists duplicate_note;
drop index if exists service_orders_one_active;
alter table service_orders
  drop column if exists status, drop column if exists net_cost_minor, drop column if exists line_items,
  drop column if exists source_quotation_id, drop column if exists status_reason, drop column if exists acknowledged_at,
  drop column if exists fulfilled_at, drop column if exists updated_at;
drop table if exists vendor_quotations;
```

- [ ] **Step 4: ids.ts** — `IdPrefix` tambah `'VQ-' | 'SO-' | 'BAT-'`; `SOURCES` tambah `'VQ-': { table: 'vendor_quotations' }, 'SO-': { table: 'service_orders' }, 'BAT-': { table: 'booking_attempts' }`.
- [ ] **Step 5:** test → PASS; `bun run typecheck`.
- [ ] **Step 6:** Commit `feat(core): migrasi 0023 quotation, service order & attempt booking (S4b)`.

---

### Task 2: Service order — otomatis saat ganti vendor + status

**Files:**
- Create: `backend/src/modules/core/service-orders.ts`, `backend/test/quotations-service-orders.test.ts`
- Modify: `backend/src/modules/core/service-writes.ts` (updateService), `backend/src/modules/core/repository.ts` (getServiceOrder → listServiceOrders), `backend/src/modules/core/routes.ts`

**Interfaces:**
- Produces:
  - `ensureServiceOrder(tx, actor, serviceId: string, vendorId: string | null, opts: { netCostMinor?: string; sourceQuotationId?: string }, requestId): Promise<string | null>` — returns SO id for the vendor (null when vendor null)
  - `changeServiceOrderStatus(tx, actor, id, to: unknown, reason: unknown, requestId): Promise<void>`
  - `listServiceOrders(db, actor, filter: { projectId?; vendorId?; serviceId?; id? })`, `getServiceOrder(db, actor, id)` (same view; old fields kept)
  - Routes `GET /service-orders`, `POST /service-orders/:id/status`

- [ ] **Step 1: Test gagal** — `test/quotations-service-orders.test.ts` (header seperti `services-bookings.test.ts`: `makeTestApp({ config: { portalLogin: true } })`, login semua `DEMO`, `key()`, `call()`):

```ts
describe('service orders', () => {
  test('assigning a vendor creates a draft SO; switching vendor cancels the old one; A→B→A works', async () => {
    const svc = (await call('POST', '/projects/PRJ-202/services', 'admin', { type: 'transportation', label: 'Bus' }, key())).json.data.id as string
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: 'VND-003' })
    const first = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ vendorId: 'VND-003', status: 'draft', projectId: 'PRJ-202', serviceId: svc })
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: 'VND-005' })
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: 'VND-003' })
    const all = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data as { vendorId: string; status: string; statusReason: string | null }[]
    expect(all.map(s => `${s.vendorId}:${s.status}`).sort()).toEqual(['VND-003:cancelled', 'VND-003:draft', 'VND-005:cancelled'])
    expect(all.find(s => s.status === 'cancelled')!.statusReason).toBe('Vendor layanan diganti.')
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: null })
    expect(((await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data as { status: string }[]).every(s => s.status === 'cancelled')).toBe(true)
  })

  test('status: draft→sent→acknowledged→fulfilled; invalid jumps 422; cancel needs a reason and is refused once billed', async () => {
    const svc = (await call('POST', '/projects/PRJ-203/services', 'admin', { type: 'hotel', label: 'Hotel', vendorId: 'VND-002' }, key())).json.data.id as string
    const so = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data[0].id as string
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'fulfilled' })).status).toBe(422)
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'sent' })).json.data.status).toBe('sent')
    const ack = await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'acknowledged' })
    expect(ack.json.data.acknowledgedAt).toBeTruthy()
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'cancelled' })).status).toBe(400)
    expect((await call('POST', `/service-orders/${so}/status`, 'finance', { to: 'fulfilled' })).status).toBe(403)
    // Billed by the vendor → cannot be cancelled.
    expect((await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-002', vendorInvoiceNumber: 'S4B-1', serviceOrderId: so, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())).status).toBe(201)
    const refused = await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'cancelled', reason: 'Batal' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('ditagih')
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'fulfilled' })).json.data.fulfilledAt).toBeTruthy()
  })

  test('list scope: finance reads, client 403, unknown 404; old single view keeps its fields', async () => {
    expect((await call('GET', '/service-orders', 'finance')).status).toBe(200)
    expect((await call('GET', '/service-orders', 'client')).status).toBe(403)
    expect((await call('GET', '/service-orders/SO-999', 'admin')).status).toBe(404)
    const one = (await call('GET', '/service-orders/SO-101F', 'finance')).json.data
    expect(one).toMatchObject({ id: 'SO-101F', vendorId: expect.any(String), vendorName: expect.any(String), projectId: 'PRJ-101', serviceId: 'SVC-1011' })
    expect(typeof one.status).toBe('string')
  })
})
```

- [ ] **Step 2:** → FAIL.

- [ ] **Step 3: `service-orders.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'

/**
 * Service orders (S4b): one active order per service + vendor, created when a vendor is assigned (quick assignment
 * or an accepted quotation) and cancelled when the vendor changes — never deleted, because Finance vendor invoices
 * point at them. Amendments and RFQ orders stay in procurement (S5).
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
export const SERVICE_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['sent', 'cancelled'], sent: ['acknowledged', 'cancelled'], acknowledged: ['fulfilled', 'cancelled'],
  amended: ['fulfilled', 'cancelled'], fulfilled: [], cancelled: []
}

const billedSql = "exists (select 1 from vendor_invoices v where v.service_order_id = so.id and v.status not in ('rejected', 'void'))"

async function cancelOrder(tx: Queryable, actor: Actor, id: string, from: string, reason: string, requestId: string) {
  await tx.query("update service_orders set status = 'cancelled', status_reason = $2, updated_at = now() where id = $1", [id, reason])
  await recordAudit(tx, { action: 'service_order.cancelled', actorUserId: actor.userId, entityType: 'service_order', entityId: id, requestId, reason, before: { status: from }, after: { status: 'cancelled' } })
}

/** Makes the service's active orders match its vendor; returns the active order of `vendorId` (null when none). */
export async function ensureServiceOrder(tx: Queryable, actor: Actor, serviceId: string, vendorId: string | null, opts: { netCostMinor?: string; sourceQuotationId?: string }, requestId: string): Promise<string | null> {
  const active = await tx.query<{ id: string; vendor_id: string; status: string; billed: boolean; net_cost_minor: string | null; source_quotation_id: string | null }>(
    `select so.id, so.vendor_id, so.status, ${billedSql} as billed, so.net_cost_minor, so.source_quotation_id
       from service_orders so where so.service_id = $1 and so.status <> 'cancelled' for update`, [serviceId])
  for (const so of active) {
    if (so.vendor_id !== vendorId && !so.billed) await cancelOrder(tx, actor, so.id, so.status, 'Vendor layanan diganti.', requestId)
  }
  if (!vendorId) return null
  const mine = active.find(so => so.vendor_id === vendorId)
  if (mine) {
    if ((opts.netCostMinor && !mine.net_cost_minor) || (opts.sourceQuotationId && !mine.source_quotation_id)) {
      await tx.query('update service_orders set net_cost_minor = coalesce(net_cost_minor, $2), source_quotation_id = coalesce(source_quotation_id, $3), updated_at = now() where id = $1',
        [mine.id, opts.netCostMinor ?? null, opts.sourceQuotationId ?? null])
    }
    return mine.id
  }
  const [svc] = await tx.query<{ project_id: string }>('select project_id from project_services where id = $1', [serviceId])
  const id = await nextId(tx, 'SO-')
  await tx.query(
    'insert into service_orders (id, vendor_id, project_id, service_id, status, net_cost_minor, source_quotation_id) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, vendorId, svc!.project_id, serviceId, 'draft', opts.netCostMinor ?? null, opts.sourceQuotationId ?? null])
  await recordAudit(tx, { action: 'service_order.created', actorUserId: actor.userId, entityType: 'service_order', entityId: id, requestId, after: { serviceId, vendorId, netCostMinor: opts.netCostMinor ?? null, sourceQuotationId: opts.sourceQuotationId ?? null } })
  return id
}

export async function changeServiceOrderStatus(tx: Queryable, actor: Actor, id: string, to: unknown, reasonInput: unknown, requestId: string): Promise<void> {
  const statuses = Object.keys(SERVICE_ORDER_TRANSITIONS)
  if (typeof to !== 'string' || !statuses.includes(to) || to === 'amended') throw errors.validation({ to: ['Status harus sent, acknowledged, fulfilled, atau cancelled.'] })
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if (to === 'cancelled' && !reason) throw errors.validation({ reason: ['Alasan wajib diisi untuk membatalkan service order.'] })
  const [so] = await tx.query<{ status: string; billed: boolean }>(`select so.status, ${billedSql} as billed from service_orders so where so.id = $1 for update`, [id])
  if (!so) throw errors.notFound('Service order')
  if (!SERVICE_ORDER_TRANSITIONS[so.status]?.includes(to)) throw rule(`Status service order tidak bisa diubah dari ${so.status} ke ${to}.`)
  if (to === 'cancelled') {
    if (so.billed) throw rule('Service order ini sudah ditagih vendor di Finance — tidak bisa dibatalkan.')
    await cancelOrder(tx, actor, id, so.status, reason!, requestId)
    return
  }
  await tx.query(
    `update service_orders set status = $2, updated_at = now(),
       acknowledged_at = case when $2 = 'acknowledged' then now() else acknowledged_at end,
       fulfilled_at = case when $2 = 'fulfilled' then now() else fulfilled_at end
     where id = $1`, [id, to])
  await recordAudit(tx, { action: 'service_order.status_changed', actorUserId: actor.userId, entityType: 'service_order', entityId: id, requestId, reason, before: { status: so.status }, after: { status: to } })
}
```

- [ ] **Step 4: service-writes.ts** — `updateService`: setelah `update project_services …` dan sebelum audit, bila `'vendorId' in next`:

```ts
  if ('vendorId' in next) await ensureServiceOrder(tx, actor, id, (next.vendorId as string | null) ?? null, {}, requestId)
```

dan `createService`: setelah insert, bila `vendorId`: `await ensureServiceOrder(tx, actor, id, vendorId, {}, requestId)`. (Import dari `./service-orders`.)

- [ ] **Step 5: repository** — ganti `getServiceOrder` dengan:

```ts
interface ServiceOrderRow extends Record<string, unknown> {
  id: string; vendor_id: string; vendor_name: string; project_id: string | null; service_id: string | null; service_type: string | null
  status: string; status_reason: string | null; net_cost_minor: string | null; line_items: unknown[]; source_quotation_id: string | null
  acknowledged_at: string | null; fulfilled_at: string | null; created_at: string; updated_at: string
}

/** Internal roles with vendor/finance access see any service order; a vendor only its own; clients none. */
export async function listServiceOrders(db: Db, actor: Actor, filter: { projectId?: string; vendorId?: string; serviceId?: string; id?: string }) {
  if (actor.role === 'client') return []
  const params: unknown[] = []
  const where: string[] = ['true']
  if (actor.role === 'vendor') { params.push(actor.vendorId); where.push(`so.vendor_id = $${params.length}`) }
  for (const [key, col] of [['projectId', 'so.project_id'], ['vendorId', 'so.vendor_id'], ['serviceId', 'so.service_id'], ['id', 'so.id']] as const) {
    if (filter[key]) { params.push(filter[key]); where.push(`${col} = $${params.length}`) }
  }
  const rows = await db.query<ServiceOrderRow>(
    `select so.id, so.vendor_id, v.name as vendor_name, so.project_id, so.service_id, ps.service_type, so.status, so.status_reason,
            so.net_cost_minor, so.line_items, so.source_quotation_id,
            to_char(so.acknowledged_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as acknowledged_at,
            to_char(so.fulfilled_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as fulfilled_at,
            to_char(so.created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as created_at,
            to_char(so.updated_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as updated_at
       from service_orders so join vendors v on v.id = so.vendor_id left join project_services ps on ps.id = so.service_id
      where ${where.join(' and ')} order by so.id`, params)
  const commercial = canSeeCommercials(actor)
  return rows.map(r => ({
    id: r.id, vendorId: r.vendor_id, vendorName: r.vendor_name, projectId: r.project_id, serviceId: r.service_id, serviceType: r.service_type,
    status: r.status, statusReason: r.status_reason, netCostMinor: commercial ? r.net_cost_minor : null, lineItems: r.line_items,
    sourceQuotationId: r.source_quotation_id, acknowledgedAt: r.acknowledged_at, fulfilledAt: r.fulfilled_at, createdAt: r.created_at, updatedAt: r.updated_at
  }))
}

export async function getServiceOrder(db: Db, actor: Actor, id: string) {
  return (await listServiceOrders(db, actor, { id }))[0] ?? null
}
```

(Hapus `getServiceOrder`/`ServiceOrderRow` lama; cek pemakainya dengan grep — `routes.ts` dan finance `payables` bila ada.)

- [ ] **Step 6: routes** — sebelum `.get('/service-orders/:id'`:

```ts
    .get('/service-orders', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client' || (!isPortalActor(actor) && !canListVendors(actor))) throw errors.forbidden()
      for (const k of ['projectId', 'vendorId', 'serviceId'] as const) {
        if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      }
      return ok(request, await listServiceOrders(db, actor, { projectId: query.projectId, vendorId: query.vendorId, serviceId: query.serviceId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()), vendorId: t.Optional(t.String()), serviceId: t.Optional(t.String()) }) })
    .post('/service-orders/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Service order')
      const so = isPortalActor(actor) ? null : await getServiceOrder(db, actor, id)
      if (!so) throw errors.notFound('Service order')
      if (so.serviceType) requireServiceCapability(actor, so.serviceType)
      else if (!hasCapability(actor.role, 'vendor.manage-vendor')) throw errors.forbidden()
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeServiceOrderStatus(tx, actor, id, b.to, b.reason, requestIdOf(request)))
      return ok(request, await getServiceOrder(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

- [ ] **Step 7:** test → PASS; `bun run test` penuh (finance payables/vendor-invoice tetap hijau); typecheck.
- [ ] **Step 8:** Commit `feat(core): service order otomatis & status lewat API (S4b)`.

---

### Task 3: Quotation vendor

**Files:**
- Create: `backend/src/modules/core/vendor-quotations.ts`
- Modify: `backend/src/modules/core/repository.ts` (listQuotations), `backend/src/modules/core/routes.ts`
- Test: `backend/test/quotations-service-orders.test.ts`

**Interfaces:**
- Consumes: `ensureServiceOrder` (Task 2), `updateService` (S4a).
- Produces: `submitQuotation(tx, actor, input, today, requestId): Promise<{ id }>`, `acceptQuotation(tx, actor, id, requestId)`, `rejectQuotation(tx, actor, id, reason, requestId)`; `listQuotations(db, actor, filter: { projectId?; serviceId?; vendorId?; id? })` → `{ id, vendorId, projectId, serviceId, serviceType, amountMinor, notes, status, decisionReason, submittedOn, decidedAt }`; routes `GET/POST /vendor-quotations`, `POST /vendor-quotations/:id/accept|reject`.

- [ ] **Step 1: Test gagal**:

```ts
describe('vendor quotations', () => {
  test('submit (idempotent, validation, 403/401); accept rejects competitors, sets vendor + confirmed + SO with the amount', async () => {
    const svc = (await call('POST', '/projects/PRJ-204/services', 'admin', { type: 'hotel', label: 'Hotel Malang' }, key())).json.data.id as string
    const k = key()
    const body = { vendorId: 'VND-002', projectId: 'PRJ-204', serviceId: svc, serviceType: 'hotel', amountMinor: '12000000', notes: 'Termasuk sarapan' }
    const a = await call('POST', '/vendor-quotations', 'admin', body, k)
    expect(a.status).toBe(201)
    const qa = a.json.data.id as string
    expect(qa).toMatch(/^VQ-\d+$/)
    expect((await call('POST', '/vendor-quotations', 'admin', body, k)).json.data.id).toBe(qa)
    const qb = (await call('POST', '/vendor-quotations', 'admin', { ...body, vendorId: 'VND-006', amountMinor: '11000000' }, key())).json.data.id as string
    const bad = await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-999', projectId: 'PRJ-204', serviceId: svc, serviceType: 'flight', amountMinor: '0' }, key())
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['amountMinor', 'serviceId', 'vendorId'])
    expect((await call('POST', '/vendor-quotations', 'finance', body, key())).status).toBe(403)
    expect((await t.call('POST', '/api/v1/vendor-quotations', { body, headers: { 'idempotency-key': key() } })).status).toBe(401)

    const acc = await call('POST', `/vendor-quotations/${qa}/accept`, 'admin', {})
    expect(acc.status).toBe(200)
    expect(acc.json.data.status).toBe('accepted')
    const list = (await call('GET', `/vendor-quotations?serviceId=${svc}`, 'finance')).json.data as { id: string; status: string }[]
    expect(list.find(q => q.id === qb)!.status).toBe('rejected')
    const service = (await call('GET', '/project-services?projectId=PRJ-204', 'admin')).json.data.find((s: { id: string }) => s.id === svc)
    expect(service).toMatchObject({ vendorId: 'VND-002', status: 'confirmed' })
    const so = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data[0]
    expect(so).toMatchObject({ vendorId: 'VND-002', status: 'draft', netCostMinor: '12000000', sourceQuotationId: qa })
    expect((await call('POST', `/vendor-quotations/${qa}/accept`, 'admin', {})).status).toBe(422) // already decided
    expect((await call('POST', `/vendor-quotations/${qb}/reject`, 'admin', {})).status).toBe(422)
  })

  test('accept on a service locked by another vendor invoice changes nothing; a quotation without service cannot be accepted', async () => {
    // SVC-1011 (VND-001) carries FLT-1011; a vendor invoice of VND-001 locks its vendor.
    expect((await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-001', vendorInvoiceNumber: 'S4B-LOCK', booking: { type: 'flight', id: 'FLT-1011' }, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())).status).toBe(201)
    const q = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-006', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountMinor: '5000' }, key())).json.data.id as string
    const other = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-001', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountMinor: '6000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${q}/accept`, 'admin', {})).status).toBe(422)
    const after = (await call('GET', '/vendor-quotations?serviceId=SVC-1011', 'admin')).json.data as { id: string; status: string }[]
    expect(after.find(x => x.id === q)!.status).toBe('submitted')
    expect(after.find(x => x.id === other)!.status).toBe('submitted')
    const loose = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-003', projectId: 'PRJ-202', serviceType: 'transportation', amountMinor: '7000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${loose}/accept`, 'admin', {})).status).toBe(422)
    expect((await call('POST', `/vendor-quotations/${loose}/reject`, 'admin', { reason: 'Terlalu mahal' })).json.data).toMatchObject({ status: 'rejected', decisionReason: 'Terlalu mahal' })
  })

  test('accepting for a service that already has a booking keeps the booking-driven status', async () => {
    const created = (await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-205', details: {} }, key())).json.data
    const q = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-001', projectId: 'PRJ-205', serviceId: created.serviceId, serviceType: 'flight', amountMinor: '8000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${q}/accept`, 'admin', {})).status).toBe(200)
    const service = (await call('GET', '/project-services?projectId=PRJ-205', 'admin')).json.data.find((s: { id: string }) => s.id === created.serviceId)
    expect(service).toMatchObject({ vendorId: 'VND-001', status: 'pending-confirmation' })
  })
})
```

- [ ] **Step 2:** → FAIL.

- [ ] **Step 3: `vendor-quotations.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { SERVICE_TYPES } from './booking-rules'
import { ensureServiceOrder } from './service-orders'
import { money, updateService } from './service-writes'

/**
 * Vendor quotations (S4b): recorded by Operations when a vendor quotes for a service. Accepting one is a single
 * transaction — competitors rejected, the service gets the vendor (S4a vendor rule applies) and `confirmed` when it
 * has no booking yet, and the service order carries the quoted amount.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

export async function submitQuotation(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const serviceType = (SERVICE_TYPES as readonly unknown[]).includes(input.serviceType) ? input.serviceType as string : undefined
  if (!serviceType) problems.serviceType = ['Jenis layanan tidak dikenal.']
  const vendorId = typeof input.vendorId === 'string' && ID_PATTERN.test(input.vendorId) &&
    (await tx.query("select 1 from vendors where id = $1 and status in ('active', 'pending')", [input.vendorId])).length ? input.vendorId : undefined
  if (!vendorId) problems.vendorId = ['Vendor tidak ditemukan atau tidak aktif.']
  const amount = money(input.amountMinor, 'amountMinor', problems)
  if (amount === undefined || amount === null || amount === '0') problems.amountMinor ??= ['Nilai quotation harus lebih dari 0.']
  let serviceId: string | null = null
  if (input.serviceId !== undefined && input.serviceId !== null) {
    const [s] = typeof input.serviceId === 'string' && ID_PATTERN.test(input.serviceId)
      ? await tx.query<{ id: string }>('select id from project_services where id = $1 and project_id = $2 and service_type = $3', [input.serviceId, projectId, serviceType ?? ''])
      : []
    if (!s) problems.serviceId = ['Layanan tidak ditemukan di project ini untuk jenis ini.']
    else serviceId = s.id
  }
  const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 1000) : null
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'VQ-')
  await tx.query(
    'insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, notes, submitted_on) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, vendorId, projectId, serviceId, serviceType, amount, notes, today])
  await recordAudit(tx, { action: 'quotation.submitted', actorUserId: actor.userId, entityType: 'vendor_quotation', entityId: id, requestId, after: { vendorId, projectId, serviceId, serviceType, amountMinor: amount } })
  return { id }
}

async function lockSubmitted(tx: Queryable, id: string) {
  const [q] = await tx.query<{ status: string; vendor_id: string; service_id: string | null; amount_minor: string }>(
    'select status, vendor_id, service_id, amount_minor from vendor_quotations where id = $1 for update', [id])
  if (!q) throw errors.notFound('Quotation')
  if (q.status !== 'submitted') throw rule(`Quotation ini sudah ${q.status === 'accepted' ? 'diterima' : 'ditolak'}.`)
  return q
}

export async function acceptQuotation(tx: Queryable, actor: Actor, id: string, requestId: string): Promise<void> {
  const q = await lockSubmitted(tx, id)
  if (!q.service_id) throw rule('Quotation ini belum terhubung ke layanan project — tidak bisa diterima.')
  const [svc] = await tx.query<{ has_bookings: boolean }>('select exists (select 1 from booking_refs b where b.service_id = $1) as has_bookings', [q.service_id])
  // The S4a vendor rule (422 when Finance holds another vendor's invoice) runs first: nothing below happens if it refuses.
  await updateService(tx, actor, q.service_id, svc!.has_bookings ? { vendorId: q.vendor_id } : { vendorId: q.vendor_id, status: 'confirmed' }, requestId)
  await ensureServiceOrder(tx, actor, q.service_id, q.vendor_id, { netCostMinor: q.amount_minor, sourceQuotationId: id }, requestId)
  await tx.query("update vendor_quotations set status = 'accepted', decided_at = now(), decided_by = $2 where id = $1", [id, actor.userId])
  const losers = await tx.query<{ id: string }>(
    "update vendor_quotations set status = 'rejected', decision_reason = 'Quotation lain diterima.', decided_at = now(), decided_by = $3 where service_id = $1 and id <> $2 and status = 'submitted' returning id",
    [q.service_id, id, actor.userId])
  await recordAudit(tx, { action: 'quotation.accepted', actorUserId: actor.userId, entityType: 'vendor_quotation', entityId: id, requestId, after: { serviceId: q.service_id, vendorId: q.vendor_id, rejected: losers.map(l => l.id) } })
}

export async function rejectQuotation(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string): Promise<void> {
  await lockSubmitted(tx, id)
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  await tx.query("update vendor_quotations set status = 'rejected', decision_reason = $2, decided_at = now(), decided_by = $3 where id = $1", [id, reason, actor.userId])
  await recordAudit(tx, { action: 'quotation.rejected', actorUserId: actor.userId, entityType: 'vendor_quotation', entityId: id, requestId, reason })
}
```

(Catatan: `updateService` tidak menulis apa pun bila vendor & status sudah sama — tidak ada audit kosong. Semua di satu `db.transaction`, jadi 422 dari aturan vendor membatalkan seluruh accept.)

- [ ] **Step 4: repository `listQuotations`**

```ts
export async function listQuotations(db: Db, actor: Actor, filter: { projectId?: string; serviceId?: string; vendorId?: string; id?: string }) {
  if (actor.role === 'client') return []
  const params: unknown[] = []
  const where = [projectScopeSql(projectScopeOf(actor), params)]
  if (actor.role === 'vendor') { params.push(actor.vendorId); where.push(`q.vendor_id = $${params.length}`) }
  for (const [key, col] of [['projectId', 'q.project_id'], ['serviceId', 'q.service_id'], ['vendorId', 'q.vendor_id'], ['id', 'q.id']] as const) {
    if (filter[key]) { params.push(filter[key]); where.push(`${col} = $${params.length}`) }
  }
  const rows = await db.query<Record<string, any>>(
    `select q.id, q.vendor_id, q.project_id, q.service_id, q.service_type, q.amount_minor, q.notes, q.status, q.decision_reason, q.submitted_on,
            to_char(q.decided_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as decided_at
       from vendor_quotations q join projects p on p.id = q.project_id
      where ${where.join(' and ')} order by q.id`, params)
  const commercial = canSeeCommercials(actor)
  return rows.map(r => ({
    id: r.id as string, vendorId: r.vendor_id as string, projectId: r.project_id as string, serviceId: r.service_id as string | null,
    serviceType: r.service_type as string, amountMinor: commercial ? r.amount_minor as string : null, notes: r.notes as string | null,
    status: r.status as string, decisionReason: r.decision_reason as string | null, submittedOn: r.submitted_on as string, decidedAt: r.decided_at as string | null
  }))
}
```

- [ ] **Step 5: routes**

```ts
    .get('/vendor-quotations', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client') throw errors.forbidden()
      for (const k of ['projectId', 'serviceId', 'vendorId'] as const) {
        if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      }
      return ok(request, await listQuotations(db, actor, { projectId: query.projectId, serviceId: query.serviceId, vendorId: query.vendorId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()), serviceId: t.Optional(t.String()), vendorId: t.Optional(t.String()) }) })
    .post('/vendor-quotations', async ({ request, body, set }) => {
      const actor = await auth.requireActor(request)
      const b = body as Record<string, unknown>
      if ((SERVICE_TYPES as readonly unknown[]).includes(b.serviceType)) requireServiceCapability(actor, b.serviceType as string)
      else if (isPortalActor(actor) || !SERVICE_TYPES.some(s => hasCapability(actor.role, serviceCapability(s)))) throw errors.forbidden()
      if (typeof b.projectId !== 'string' || !b.projectId) throw errors.validation({ projectId: ['Project wajib diisi.'] })
      const projectId = await visibleProject(actor, b.projectId)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /vendor-quotations', key, body }, tx =>
        submitQuotation(tx, actor, projectId, b, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listQuotations(db, actor, { id: result.data.id }))[0])
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/vendor-quotations/:id/accept', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      const q = await writableQuotation(actor, params.id)
      await db.transaction(tx => acceptQuotation(tx, actor, q.id, requestIdOf(request)))
      return ok(request, (await listQuotations(db, actor, { id: q.id }))[0])
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/vendor-quotations/:id/reject', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const q = await writableQuotation(actor, params.id)
      await db.transaction(tx => rejectQuotation(tx, actor, q.id, (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, (await listQuotations(db, actor, { id: q.id }))[0])
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

dengan helper dalam `coreRoutes`:

```ts
  async function writableQuotation(actor: SessionActor, raw: string) {
    const id = assertIdParam(raw, 'Quotation')
    const [q] = isPortalActor(actor) ? [] : await listQuotations(db, actor, { id })
    if (!q) throw errors.notFound('Quotation')
    requireServiceCapability(actor, q.serviceType)
    return q
  }
```

- [ ] **Step 6:** test → PASS; suite penuh; typecheck.
- [ ] **Step 7:** Commit `feat(core): quotation vendor lewat API (S4b)`.

---

### Task 4: Orkestrasi booking — gate, attempts, duplikat

**Files:**
- Create: `backend/src/modules/core/booking-orchestration.ts`
- Modify: `backend/src/modules/finance/summaries.ts` (export `derivePaymentStatus`), `backend/src/modules/core/booking-writes.ts` (createBooking duplicate check), `backend/src/modules/core/repository.ts` (booking view: duplicate fields), `backend/src/modules/core/routes.ts`
- Test: `backend/test/quotations-service-orders.test.ts`

**Interfaces:**
- Produces:
  - `withOrchestration(q, bookings: BookingView[]): Promise<(BookingView & { paymentGate: { status: 'not-required'|'pending'|'cleared'; basis: 'booking'|'project'|null }; attempts: { id; outcome; note; at; actorUserId }[] })[]>`
  - `logAttempt(tx, actor, type, id, input, requestId): Promise<void>`
  - Booking view (`listBookings`) gains `flaggedDuplicate: boolean`, `duplicateOf: {type,id}[]`, `duplicateNote: string | null`
  - `POST /bookings/:type/:id/attempts`; `POST /bookings/:type` accepts `allowDuplicate`, `duplicateNote`, may answer 409 `CONFLICT` with `details.conflicts`

- [ ] **Step 1: Test gagal**:

```ts
describe('booking orchestration', () => {
  test('payment gate: not-required before confirmed; project DP decides without own invoices; own unpaid invoice keeps it pending', async () => {
    const id = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-203', details: { checkInDate: '2026-12-01' } }, key())).json.data.id as string
    const gate = async () => (await call('GET', '/bookings?projectId=PRJ-203&type=hotel', 'admin')).json.data.find((b: { id: string }) => b.id === id).paymentGate
    expect(await gate()).toEqual({ status: 'not-required', basis: null })
    for (const to of ['quoted', 'confirmed']) await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to })
    const projectGate = await gate()
    expect(projectGate.basis).toBe('project')
    // Own invoice issued but unpaid → pending on the booking basis, whatever the project's DP says.
    const inv = await call('POST', '/finance/customer-invoices', 'finance', { projectId: 'PRJ-203', booking: { type: 'hotel', id }, invoiceType: 'dp', lines: [{ description: 'DP hotel', amountMinor: '1000000' }], dueDate: '2026-12-30' }, key())
    await call('POST', `/finance/customer-invoices/${inv.json.data.id}/issue`, 'finance', {}, key())
    expect(await gate()).toEqual({ status: 'pending', basis: 'booking' })
  })

  test('attempts are logged and listed newest first; outcome validated; finance 403', async () => {
    const id = (await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-204', details: {} }, key())).json.data.id as string
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'admin', { outcome: 'failed', note: 'GDS timeout' })).status).toBe(201)
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'admin', { outcome: 'manual-fallback' })).status).toBe(201)
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'admin', { outcome: 'maybe' })).status).toBe(400)
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'finance', { outcome: 'success' })).status).toBe(403)
    const b = (await call('GET', '/bookings?projectId=PRJ-204&type=flight', 'admin')).json.data.find((x: { id: string }) => x.id === id)
    expect(b.attempts.map((a: { outcome: string }) => a.outcome)).toEqual(['manual-fallback', 'failed'])
  })

  test('duplicate: an active booking on the same service gives 409; allowDuplicate flags it; allowDuplicate without conflict flags nothing', async () => {
    const first = (await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-205', details: {} }, key())).json.data
    const clash = await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-205', serviceId: first.serviceId, details: {} }, key())
    expect(clash.status).toBe(409)
    expect(clash.json.error.details.conflicts).toEqual([{ type: 'transport', id: first.id }])
    const dup = await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-205', serviceId: first.serviceId, allowDuplicate: true, duplicateNote: 'Dua bus terpisah', details: {} }, key())
    expect(dup.status).toBe(201)
    expect(dup.json.data).toMatchObject({ flaggedDuplicate: true, duplicateOf: [{ type: 'transport', id: first.id }], duplicateNote: 'Dua bus terpisah' })
    const plain = await call('POST', '/bookings/mice', 'admin', { projectId: 'PRJ-205', allowDuplicate: true, details: {} }, key())
    expect(plain.json.data).toMatchObject({ flaggedDuplicate: false, duplicateOf: [] })
  })
})
```

(Periksa format error 409 di `http/errors.ts`: bila `AppError` menaruh detail di `error.details`, pakai itu; sesuaikan asersi dan catat ruling bila nama field berbeda.)

- [ ] **Step 2:** → FAIL.

- [ ] **Step 3: summaries.ts** — ubah `function derivePaymentStatus(` menjadi `export function derivePaymentStatus(`.

- [ ] **Step 4: `booking-orchestration.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { todayBusinessDate } from '../finance/common'
import { derivePaymentStatus, INVOICES_WITH_BALANCE, type InvoiceBalanceRow } from '../finance/summaries'
import { serviceStatusFor } from './booking-rules'
import type { BookingType, BookingView } from './repository'

/**
 * Booking orchestration (S4b): the payment gate is computed from Finance (never stored), attempts are a log.
 * Gate: a booking that is not confirmed yet (or cancelled/no-show) needs nothing; a confirmed one is "cleared" once
 * its own invoices — or, without own invoices, the project's — are paid as far as billed (DP received or more).
 */

export type PaymentGate = { status: 'not-required' | 'pending' | 'cleared'; basis: 'booking' | 'project' | null }
const CLEARED = new Set(['dp_received', 'up_to_date', 'paid'])
const CONFIRMED = new Set(['confirmed', 'changed', 'completed'])
const OUTCOMES = ['success', 'failed', 'manual-fallback'] as const

export async function withOrchestration<T extends BookingView>(q: Queryable, bookings: T[]) {
  const full = bookings.filter((b): b is T & { status: string; projectId: string } => 'status' in b)
  const projectIds = [...new Set(full.map(b => b.projectId))]
  const invoices = projectIds.length
    ? await q.query<InvoiceBalanceRow>(`${INVOICES_WITH_BALANCE} where i.status <> 'void' and i.project_id in (select jsonb_array_elements_text($1::text::jsonb))`, [JSON.stringify(projectIds)])
    : []
  const keys = full.map(b => ({ type: b.type, id: b.id }))
  const attempts = keys.length
    ? await q.query<{ id: string; booking_type: string; booking_id: string; outcome: string; note: string | null; actor_user_id: string | null; at: string }>(
      `select a.id, a.booking_type, a.booking_id, a.outcome, a.note, a.actor_user_id, to_char(a.attempted_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI') as at
         from booking_attempts a
         join jsonb_to_recordset($1::text::jsonb) as k(type text, id text) on k.type = a.booking_type and k.id = a.booking_id
        order by a.attempted_at desc, a.id desc`, [JSON.stringify(keys)])
    : []
  const today = todayBusinessDate()
  return bookings.map((b) => {
    if (!('status' in b)) return b
    const confirmed = CONFIRMED.has(serviceStatusFor(b.type as BookingType, b.status as string))
    let paymentGate: PaymentGate = { status: 'not-required', basis: null }
    if (confirmed) {
      const own = invoices.filter(i => i.booking_type === b.type && i.booking_id === b.id)
      const basis = own.length ? 'booking' : 'project'
      const list = own.length ? own : invoices.filter(i => i.project_id === b.projectId)
      paymentGate = { status: CLEARED.has(derivePaymentStatus(list, today, true)) ? 'cleared' : 'pending', basis }
    }
    return {
      ...b,
      paymentGate,
      attempts: attempts.filter(a => a.booking_type === b.type && a.booking_id === b.id)
        .map(a => ({ id: a.id, outcome: a.outcome, note: a.note, at: a.at, actorUserId: a.actor_user_id }))
    }
  })
}

export async function logAttempt(tx: Queryable, actor: Actor, type: BookingType, id: string, input: Record<string, unknown>, requestId: string) {
  if (!(OUTCOMES as readonly unknown[]).includes(input.outcome)) throw errors.validation({ outcome: ['Hasil harus success, failed, atau manual-fallback.'] })
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  const attemptId = await nextId(tx, 'BAT-')
  await tx.query('insert into booking_attempts (id, booking_type, booking_id, outcome, note, actor_user_id) values ($1, $2, $3, $4, $5, $6)',
    [attemptId, type, id, input.outcome, note, actor.userId])
  await recordAudit(tx, { action: 'booking.attempt_logged', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId, after: { type, attemptId, outcome: input.outcome } })
}
```

(`serviceStatusFor` untuk `cancelled|refunded|no-show` → `cancelled`, sehingga tidak masuk `CONFIRMED` → `not-required`.)

- [ ] **Step 5: duplikat di `createBooking`** — setelah `serviceId` ditentukan dari body (sebelum blok reuse), bila `serviceId`:

```ts
  let duplicateOf: { type: string; id: string }[] = []
  if (serviceId) {
    duplicateOf = await tx.query<{ type: string; id: string }>(
      "select booking_type as type, booking_id as id from booking_refs where service_id = $1 and status not in ('cancelled', 'refunded', 'no-show', 'completed') order by booking_type, booking_id",
      [serviceId])
    if (duplicateOf.length && input.allowDuplicate !== true) {
      throw new AppError(409, 'CONFLICT', 'Sudah ada booking aktif untuk layanan ini.', { conflicts: duplicateOf })
    }
  }
  const duplicateNote = duplicateOf.length && typeof input.duplicateNote === 'string' && input.duplicateNote.trim() ? input.duplicateNote.trim().slice(0, 1000) : null
```

dan insert booking menambah kolom `flagged_duplicate, duplicate_of, duplicate_note` = `duplicateOf.length > 0, JSON.stringify(duplicateOf)` (`::text::jsonb`), `duplicateNote`. (Sesuaikan konstruktor `AppError` dengan signature sebenarnya di `http/errors.ts` — cari parameter `details`.)

- [ ] **Step 6: repository `listBookings`** — select `b.flagged_duplicate, b.duplicate_of, b.duplicate_note`; view (non-portal) menambah `flaggedDuplicate`, `duplicateOf`, `duplicateNote`.

- [ ] **Step 7: routes** — `GET /bookings` → `ok(request, await withOrchestration(db, await listBookings(...)))`; `POST /bookings/:type`, `PATCH`, `/status` → respons lewat helper `bookingResponse(actor, type, id)` = `(await withOrchestration(db, [await getBooking(...)]))[0]`; route baru:

```ts
    .post('/bookings/:type/:id/attempts', async ({ request, params, body, set }) => {
      const actor = await auth.requireActor(request)
      const { type, id } = await writableBooking(actor, params.type, params.id)
      await db.transaction(tx => logAttempt(tx, actor, type, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, await bookingResponse(actor, type, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

- [ ] **Step 8:** test → PASS; suite penuh (services-bookings tetap hijau — view booking bertambah field); typecheck.
- [ ] **Step 9:** Commit `feat(core): payment gate dari Finance, log percobaan & duplikat booking (S4b)`.

---

### Task 5: Seed & extract

**Files:** `backend/scripts/extract-demo-core.ts`, `backend/src/db/seed-demo.ts`, `backend/src/db/seeds/demo-core.json` (regenerate), `backend/test/db.test.ts`

**Interfaces:**
- Produces: `DemoCoreSeed.vendorQuotations?: { id; vendorId; projectId; serviceId: string | null; serviceType; amountMinor; status; notes: string | null; submittedOn }[]`; `serviceOrders[]` + `status?, netCostMinor?, lineItems?, statusReason?, acknowledgedAt?, fulfilledAt?`; `bookingAttempts?: { id; bookingType; bookingId; outcome; note: string | null; attemptedAt }[]`; `bookingRefs[]` + `flaggedDuplicate?`.

- [ ] **Step 1: Test gagal** (`db.test.ts`, describe demo seed):

```ts
  test('seed fills quotations, service order status and booking attempts (S4b)', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [counts] = await db.query<{ q: string; a: string }>('select (select count(*) from vendor_quotations) as q, (select count(*) from booking_attempts) as a')
      expect(counts).toEqual({ q: String(DEMO_CORE.vendorQuotations!.length), a: String(DEMO_CORE.bookingAttempts!.length) })
      expect(DEMO_CORE.vendorQuotations!.length).toBeGreaterThan(10)
      const [so] = await db.query<{ status: string; net_cost_minor: string }>("select status, net_cost_minor from service_orders where id = 'SO-101F'")
      expect(so).toEqual({ status: 'fulfilled', net_cost_minor: '90000000' })
      expect(await nextId(db, 'VQ-')).toBe(`VQ-${String(Math.max(...DEMO_CORE.vendorQuotations!.map(q => Number(q.id.slice(3)))) + 1).padStart(3, '0')}`)
    } finally {
      await cleanup()
    }
  })
```

Guard "no finance records": `amountMinor` (quotation, Procurement) dan `netCostMinor` (sudah ada) ditambah ke daftar nilai uang yang diizinkan, dengan komentar. `lineItems` tidak mengandung kunci uang.

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: extract** — import `VENDOR_QUOTATIONS` (`frontend/app/data/vendors`), `BOOKING_ORCHESTRATION_RECORDS` (`frontend/app/data/booking-orchestration`). Tambah:

```ts
  vendorQuotations: [...VENDOR_QUOTATIONS].sort(byId).flatMap(q => {
    const serviceId = q.serviceId && serviceProject.get(q.serviceId) === q.projectId ? q.serviceId : null
    if (q.serviceId && !serviceId) warnings.push(`${q.id}: service ${q.serviceId} not in ${q.projectId}; link dropped`)
    return [{ id: q.id, vendorId: q.vendorId, projectId: q.projectId, serviceId, serviceType: q.serviceType, amountMinor: String(Math.round(q.amountIdr)), status: q.status, notes: q.notes ?? null, submittedOn: q.submittedAt.slice(0, 10) }]
  }),
  bookingAttempts: BOOKING_ORCHESTRATION_RECORDS.flatMap(r => r.attemptLog.map(a => ({
    id: a.id, bookingType: r.bookingType === 'transportation' ? 'transport' : r.bookingType, bookingId: r.bookingId, outcome: a.outcome, note: a.note ?? null, attemptedAt: a.at
  }))).filter(a => bookingKeys.has(`${a.bookingType}:${a.bookingId}`)),
```

(`bookingKeys` = set dari `bookingRefs` yang sudah diekstrak; `BookingDomain` nilai `'transportation'` dipetakan ke `transport` — cek tipe `BookingDomain`.) `serviceOrders` map menambah `status: so.status, netCostMinor: minor(so.netCostIdr), lineItems: so.lineItems, statusReason: so.statusReason ?? null, acknowledgedAt: so.acknowledgedAt ?? null, fulfilledAt: so.fulfilledAt ?? null`. `bookingRef` menambah `flaggedDuplicate` dari record orchestration (`flaggedDuplicate ?? false`).

- [ ] **Step 4: seed-demo.ts** — tipe opsional baru; urutan upsert: quotation (sebelum service orders, karena FK `source_quotation_id` tidak diisi seed — tetap null), service orders menambah kolom, `booking_attempts` setelah booking; semua `where … provenance = 'demo-fixture'`; `flagged_duplicate` di upsert booking. Lalu `syncIdSequences`.
- [ ] **Step 5:** `bun run seed:extract`; bandingkan `sellAmountMinor`/`departureDate` tidak berubah (script banding seperti S4a); test → PASS; suite penuh; typecheck.
- [ ] **Step 6:** Commit `feat(core): seed demo quotation, service order & attempt booking (S4b)`.

---

### Task 6: Frontend — tipe, endpoint, sync

**Files:** `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`, Create `frontend/app/data/procurement-sync.ts` + `.test.ts`, Modify `frontend/app/data/bookings-sync.ts` (+ test), `frontend/app/layouts/dashboard.vue`, `frontend/app/pages/settings.vue`

**Interfaces:**
- Produces:
  - DTO `VendorQuotationDto`, `ServiceOrderDto` (superset of `ServiceOrderRefDto`), `BookingDto` + `paymentGate`, `attempts`, `flaggedDuplicate`, `duplicateOf`, `duplicateNote`; input `QuotationCreateInput`
  - endpoints `listVendorQuotations(q)`, `createVendorQuotation(input, key)`, `acceptVendorQuotation(id)`, `rejectVendorQuotation(id, reason?)`, `listServiceOrders(q)`, `changeServiceOrderStatus(id, { to, reason? })`, `logBookingAttempt(type, id, { outcome, note? })`; `createBooking` input + `allowDuplicate?`, `duplicateNote?`
  - `procurement-sync.ts`: `quotationFromServer`, `serviceOrderFromServer`, `mergeServerQuotations`, `mergeServerServiceOrders` (server is the source: rows not on the server are removed; a local `rfqId` is kept on rows the server also has), `loadServerProcurement(api)`, `submitQuotationOnServer`, `acceptQuotationOnServer`, `rejectQuotationOnServer`, `changeServiceOrderStatusOnServer`, `useProcurementSync()`
  - `bookings-sync.ts`: `orchestrationFromServer(dto)` merged into `BOOKING_ORCHESTRATION_RECORDS` during `upsertServerBooking` (keep local `dependsOn`), `logBookingAttemptOnServer`

- [ ] **Step 1: Test gagal** `procurement-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { VENDOR_QUOTATIONS } from './vendors'
import { SERVICE_ORDERS } from './procurement'
import { mergeServerQuotations, mergeServerServiceOrders, quotationFromServer } from './procurement-sync'
import type { ServiceOrderDto, VendorQuotationDto } from '~/types/api'

const q = (over: Partial<VendorQuotationDto> = {}): VendorQuotationDto => ({ id: 'VQ-900', vendorId: 'VND-001', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountMinor: '90000000', notes: null, status: 'submitted', decisionReason: null, submittedOn: '2026-10-01', decidedAt: null, ...over })
const so = (over: Partial<ServiceOrderDto> = {}): ServiceOrderDto => ({ id: 'SO-900', vendorId: 'VND-001', vendorName: 'Garuda', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', status: 'draft', statusReason: null, netCostMinor: '90000000', lineItems: [], sourceQuotationId: null, acknowledgedAt: null, fulfilledAt: null, createdAt: '2026-10-01', updatedAt: '2026-10-01', ...over })

describe('procurement-sync', () => {
  it('maps quotations (amount in rupiah) and replaces the local list with the server one', () => {
    expect(quotationFromServer(q())).toMatchObject({ id: 'VQ-900', amountIdr: 90_000_000, submittedAt: '2026-10-01', status: 'submitted' })
    mergeServerQuotations([q()])
    expect(VENDOR_QUOTATIONS.map(x => x.id)).toEqual(['VQ-900'])
  })

  it('merges service orders in place with net cost in rupiah', () => {
    mergeServerServiceOrders([so()])
    const local = SERVICE_ORDERS.find(x => x.id === 'SO-900')!
    mergeServerServiceOrders([so({ status: 'sent' })])
    expect(SERVICE_ORDERS.find(x => x.id === 'SO-900')).toBe(local)
    expect(local).toMatchObject({ status: 'sent', netCostIdr: 90_000_000, vendorId: 'VND-001' })
  })
})
```

dan di `bookings-sync.test.ts`:

```ts
  it('orchestration from the server: gate, attempts and duplicate flag; local dependsOn kept', () => {
    BOOKING_ORCHESTRATION_RECORDS.push({ id: 'BKO-T', bookingType: 'flight', bookingId: 'FLT-9001', projectId: 'PRJ-101', paymentGateStatus: 'not-required', attemptLog: [], dependsOn: [{ bookingType: 'hotel', bookingId: 'HTL-1' }] as never })
    mergeServerServicesAndBookings({ services: [svc()], bookings: [flightDto({ paymentGate: { status: 'cleared', basis: 'project' }, attempts: [{ id: 'BAT-1', outcome: 'failed', note: 'x', at: '2026-10-01T09:00', actorUserId: null }], flaggedDuplicate: true, duplicateOf: [], duplicateNote: null })] })
    const rec = BOOKING_ORCHESTRATION_RECORDS.find(r => r.bookingId === 'FLT-9001')!
    expect(rec).toMatchObject({ paymentGateStatus: 'cleared', flaggedDuplicate: true })
    expect(rec.attemptLog).toEqual([{ id: 'BAT-1', at: '2026-10-01T09:00', outcome: 'failed', note: 'x' }])
    expect(rec.dependsOn).toBeDefined()
  })
```

(`flightDto` di test S4a ditambah default `paymentGate: { status: 'not-required', basis: null }, attempts: [], flaggedDuplicate: false, duplicateOf: [], duplicateNote: null`.)

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** tipe, endpoint, `procurement-sync.ts` (pola `vendors-sync.ts`: `mergeServerQuotations` mengganti isi `VENDOR_QUOTATIONS`; `mergeServerServiceOrders` update in place + hapus yang tak ada di server; `useProcurementSync` load setelah `session.ensure()`), dan di `bookings-sync.ts` `upsertServerBooking` memanggil `upsertOrchestration(dto)` (record dicari per `bookingType` UI + `bookingId`; dibuat bila belum ada, id `BKO-<bookingId>`; `paymentGateStatus = dto.paymentGate.status`, `attemptLog = dto.attempts` dipetakan, `flaggedDuplicate = dto.flaggedDuplicate`; `dependsOn` lokal tidak disentuh). Layout + settings memuat `useProcurementSync` (banner "quotation & service order").
- [ ] **Step 4:** tes file → PASS; `pnpm test`; vue-tsc ≤ 2010; lint file baru bersih.
- [ ] **Step 5:** Commit `feat(frontend): muat quotation, service order & orkestrasi booking dari server (S4b)`.

---

### Task 7: Frontend — quotation & service order lewat server; hapus invoice otomatis

**Files (pemanggil):** `pages/vendors/[id]/index.vue` (submit), `pages/project-orders/[id]/index.vue` (accept/reject/assign), `pages/{ticketing,accommodation,transportation}/[id]/index.vue` (assign dengan nominal), `pages/procurement/service-orders/[id]/index.vue` + `pages/supplier/service-orders/[id]/index.vue` (status SO), `data/index.ts`, `data/bookings-sync.ts` (`assignServiceVendorOnServer`).

**Interfaces:**
- Consumes: Task 6.
- Produces: `assignServiceVendorOnServer(api, serviceId, vendorId, local?, { amountIdr? })` — dengan nominal: `submitQuotationOnServer` + `acceptQuotationOnServer`; tanpa: `PATCH` vendor; lalu reload SO & quotation project.

- [ ] **Step 1: Test gagal** (`bookings-sync.test.ts`):

```ts
  it('vendor assignment: with an amount it goes through a quotation; without, a plain vendor patch; both reload service orders', async () => {
    const calls: string[] = []
    const api = {
      core: {
        createVendorQuotation: () => { calls.push('quote'); return Promise.resolve({ data: { id: 'VQ-901' } }) },
        acceptVendorQuotation: () => { calls.push('accept'); return Promise.resolve({ data: { id: 'VQ-901', status: 'accepted' } }) },
        updateProjectService: () => { calls.push('patch'); return Promise.resolve({ data: svc({ vendorId: 'VND-002' }) }) },
        listProjectServices: () => Promise.resolve({ data: [svc({ vendorId: 'VND-002' })] }),
        listServiceOrders: () => { calls.push('orders'); return Promise.resolve({ data: [] }) },
        listVendorQuotations: () => Promise.resolve({ data: [] })
      }
    } as never
    await assignServiceVendorOnServer(api, 'SVC-9001', 'VND-002', undefined, { amountIdr: 5_000_000 })
    expect(calls).toEqual(['quote', 'accept', 'orders'])
    calls.length = 0
    await assignServiceVendorOnServer(api, 'SVC-9001', 'VND-002')
    expect(calls).toEqual(['patch', 'orders'])
  })
```
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Ubah `assignServiceVendorOnServer` sesuai Interfaces (hapus opsi `confirm` — server yang menentukan `confirmed` saat accept); panggilan lokal `assignServiceVendor`/`acceptVendorQuotation`/`setServiceVendor` di dalamnya dihapus (server kini membuat SO & menolak pesaing; aktivitas vendor lokal cukup `VENDOR_ACTIVITIES.push` lewat helper kecil yang tetap ada).
- [ ] **Step 4:** Pemanggil: `submitVendorQuotation` → `submitQuotationOnServer`; `handleAcceptQuotation` → `acceptQuotationOnServer`; `handleRejectQuotation` → `rejectQuotationOnServer`; `updateServiceOrderStatus` (procurement & supplier) → `changeServiceOrderStatusOnServer` (alasan wajib untuk cancel tetap dari dialog lama). Semua dengan guard + toast pola S4a.
- [ ] **Step 5:** Hapus di `data/index.ts`: `ensureSupplierInvoiceForConfirmedService` (+ semua pemanggilnya di mutator status booking & `updateServiceStatus` & `setServiceVendor`), `ensureServiceOrderForVendorAssignment`, `submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation`/`assignServiceVendor`/`setServiceVendor` bila tak lagi dipanggil (grep). Test lama yang bergantung pada invoice otomatis diperbarui: invoice otomatis memang tidak dibuat lagi (catat ruling).
- [ ] **Step 6:** `pnpm test`, vue-tsc ≤ 2010, lint delta 0, `pnpm build`.
- [ ] **Step 7:** Commit `feat(frontend): quotation & service order lewat server, supplier invoice otomatis dihapus (S4b)`.

---

### Task 8: Frontend — gate, attempts, duplikat

**Files:** `components/operations/BookingTimelinePanel.vue`, `components/operations/BookingExceptionsPanel.vue`, `components/operations/{Ticketing,Accommodation,Transportation}ListPanel.vue`, `pages/project-orders/[id]/index.vue` (gate), `data/bookings-sync.ts`, `data/index.ts`.

**Interfaces:**
- Consumes: Task 6 (`logBookingAttemptOnServer`, gate di record orchestration).
- Produces: `createBookingFromInput(api, type, input, key, { allowDuplicate?, duplicateNote? })` — 409 dilempar sebagai `ApiError` dengan `details.conflicts`; helper `bookingConflictsOf(error): { type; id }[] | null`.

- [ ] **Step 1: Test gagal** (`bookings-sync.test.ts`):

```ts
  it('duplicate flow: 409 conflicts are read from the error; allowDuplicate and the note are sent on the retry', async () => {
    const conflict = new ApiError({ status: 409, code: 'CONFLICT', message: 'Sudah ada booking aktif untuk layanan ini.', details: { conflicts: [{ type: 'flight', id: 'FLT-1' }] } } as never)
    expect(bookingConflictsOf(conflict)).toEqual([{ type: 'flight', id: 'FLT-1' }])
    expect(bookingConflictsOf(new Error('x'))).toBeNull()
    let sent: Record<string, unknown> | undefined
    const api = { core: { createBooking: (_t: string, input: Record<string, unknown>) => { sent = input; return Promise.resolve({ data: flightDto({ id: 'FLT-9100' }) }) }, listProjectServices: () => Promise.resolve({ data: [] }) } } as never
    await createBookingFromInput(api, 'flight', { projectId: 'PRJ-101', serviceId: 'SVC-9001' }, 'key-12345678', { allowDuplicate: true, duplicateNote: 'Grup kedua' })
    expect(sent).toMatchObject({ serviceId: 'SVC-9001', allowDuplicate: true, duplicateNote: 'Grup kedua' })
  })
```

(Sesuaikan konstruksi `ApiError` dengan konstruktor sebenarnya di `lib/api/errors.ts`.)
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** ListPanel: alur lama "cek konflik lokal → dialog peringatan → buat" diganti "buat → 409 → dialog peringatan (daftar konflik dari server) → buat lagi dengan `allowDuplicate` + catatan" (key idempoten baru untuk percobaan kedua). `findActiveBookingConflicts` & `flagBookingOrchestrationDuplicate` dihapus bila tak dipanggil.
- [ ] **Step 4:** BookingTimelinePanel: tombol "Set gate cleared" dihapus; badge gate + keterangan basis ("dari tagihan booking" / "dari DP project"); form attempt → `logBookingAttemptOnServer`. Project Order: `setBookingPaymentGateStatus` dihapus dari pemanggilnya. Hapus `setBookingPaymentGateStatus`, `appendBookingAttempt`, `syncBookingPaymentGateOnStatusChange` (+ pemanggilnya di mutator status) bila tak dipakai.
- [ ] **Step 5:** `pnpm test`, vue-tsc ≤ 2010, lint delta 0, `pnpm build`.
- [ ] **Step 6:** Commit `feat(frontend): payment gate dari Finance, log percobaan & duplikat booking lewat server (S4b)`.

---

### Task 9: Dokumentasi, DB lokal, smoke

- [ ] **Step 1:** ADR-004 "Update — Quotation, service order & orkestrasi booking (S4b)" (endpoint, SO otomatis, gate dihitung, invoice otomatis dihapus, tetap lokal, seed sekali setelah deploy). Spec → Status diimplementasikan.
- [ ] **Step 2:** Port 3000 kosong → `bun run db:migrate && bun run db:seed:demo`.
- [ ] **Step 3:** Smoke :3100 (salinan DB): quotation submit → accept → `GET /service-orders?serviceId=` ada SO draft bernilai → status `sent` → booking list punya `paymentGate` → attempt → duplikat 409/`allowDuplicate`. Matikan server, hapus salinan.
- [ ] **Step 4:** Commit `docs: ADR-004 catatan quotation, service order & orkestrasi booking (S4b)`.
