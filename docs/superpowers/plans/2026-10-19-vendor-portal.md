# Portal vendor (S12d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor bisa acknowledge/fulfilled service order miliknya, portal vendor membaca SO/quotation/layanan/booking/profil dari server, dan produk vendor dibuat lewat server.

**Architecture:** Cabang vendor di `POST /service-orders/:id/status` (fungsi `vendorChangeServiceOrderStatus` di `core/vendor-portal.ts`); route baru `core/vendor-portal-routes.ts` (`/api/v1/vendor/products`). Frontend: sync plan vendor diperluas, `data/vendor-portal-sync.ts` memuat profil + produk dan menambah produk server-first.

**Tech Stack:** Bun + Elysia + PGlite (backend, `bun test`), Nuxt 4 + Vitest (frontend, pnpm).

**Spec:** `docs/superpowers/specs/2026-10-19-vendor-portal-design.md`

## Global Constraints

- pnpm hanya di `frontend/`, bun hanya di `backend/`. Tanpa migrasi.
- Vendor hanya `to: acknowledged | fulfilled`; selain itu 403 "Vendor hanya bisa mengonfirmasi atau menandai selesai."; SO vendor lain 404; client tetap 404; jalur internal tidak berubah.
- `/api/v1/vendor/*` hanya role vendor dengan `vendorId` (role lain 403); vendor dari sesi, tidak pernah dari request.
- Notifikasi tidak pernah ke pelaku; hanya user internal aktif.
- Commit tiap task, stage path eksplisit (jangan `git add docs`/root). Trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verifikasi: `bun test <file> --timeout 30000`, `bun run typecheck`, `pnpm test`, vue-tsc ≤ 1986, eslint vs HEAD, `pnpm build`.

## Review Focus

1. Vendor mengirim `to: cancelled` untuk SO miliknya yang belum ditagih → harus 403, bukan membatalkan (tes Task 1).
2. Vendor membuka/mengubah SO vendor lain → 404 tanpa bocor status (tes Task 1).
3. Setelah sesi vendor, user internal login di tab yang sama → SO/booking/vendor internal kembali lengkap (sync internal memuat ulang per user; dicek di Task 3 lewat sync plan & tes reset).
4. POST produk dengan `vendorId` lain di body → diabaikan, tetap milik vendor sesi (tes Task 2).
5. Replay `Idempotency-Key` produk → satu baris, satu notifikasi (tes Task 2).

---

### Task 1: Backend — vendor acknowledge/fulfilled service order

**Files:**
- Create: `backend/src/modules/core/vendor-portal.ts`
- Modify: `backend/src/modules/core/routes.ts` (route `POST /service-orders/:id/status`)
- Test: `backend/test/vendor-portal.test.ts`

**Interfaces:**
- Consumes: `changeServiceOrderStatus` (`./service-orders`), `notifyInternal` (`./client-writes`), `getServiceOrder` (`./repository`).
- Produces: `VENDOR_SO_TARGETS = ['acknowledged', 'fulfilled']`; `vendorChangeServiceOrderStatus(tx, actor, id, to, requestId): Promise<void>`.

- [ ] **Step 1: Tes yang gagal** — `backend/test/vendor-portal.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12d: the vendor portal (USR-015, VND-006) — service order status and the vendor's own products. */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': key } : {} })
const k = () => `vendor-key-${++n}-${Date.now()}`
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)

describe('vendor service order status', () => {
  test('own order: sent → acknowledged → fulfilled; project log and owner told', async () => {
    const so = (await t.db.query<{ id: string; project_id: string }>("select id, project_id from service_orders where vendor_id = 'VND-006' and project_id is not null order by id limit 1"))[0]!
    await t.db.query("update service_orders set status = 'sent' where id = $1", [so.id])
    const owner = (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [so.project_id]))[0]!.owner_user_id
    const n0 = await notes(owner)
    const ack = await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'acknowledged' })
    expect(ack.status, JSON.stringify(ack.json)).toBe(200)
    expect(ack.json.data.status).toBe('acknowledged')
    const done = await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'fulfilled' })
    expect(done.json.data.status).toBe('fulfilled')
    expect(await notes(owner)).toBe(n0 + 2)
    const log = await t.db.query("select 1 from project_activities where source_action = 'service_order.status_changed' and source_entity_id = $1", [so.id])
    expect(log.length).toBe(2)
    expect((await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'acknowledged' })).status).toBe(422)
  })

  test('cancel or re-send is staff only; another vendor’s order is not found; a client gets 404', async () => {
    const so = (await t.db.query<{ id: string }>("select id from service_orders where vendor_id = 'VND-006' order by id desc limit 1"))[0]!
    await t.db.query("update service_orders set status = 'sent' where id = $1", [so.id])
    expect((await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'cancelled', reason: 'Tidak sanggup' })).status).toBe(403)
    expect((await call('POST', `/service-orders/${so.id}/status`, 'vendor', { to: 'sent' })).status).toBe(403)
    expect((await t.db.query<{ status: string }>('select status from service_orders where id = $1', [so.id]))[0]!.status).toBe('sent')
    const foreign = (await t.db.query<{ id: string }>("select id from service_orders where vendor_id <> 'VND-006' order by id limit 1"))[0]!
    expect((await call('POST', `/service-orders/${foreign.id}/status`, 'vendor', { to: 'acknowledged' })).status).toBe(404)
    expect((await call('POST', `/service-orders/${so.id}/status`, 'client', { to: 'acknowledged' })).status).toBe(404)
  })
})
```

- [ ] **Step 2: Jalankan → FAIL** (`bun test test/vendor-portal.test.ts --timeout 30000`): vendor dapat 404 di tes pertama.

- [ ] **Step 3: `vendor-portal.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { notifyInternal } from './client-writes'
import { changeServiceOrderStatus } from './service-orders'

/**
 * Vendor portal (S12d). A vendor confirms (`acknowledged`) or completes (`fulfilled`) its own service orders; sending,
 * re-sending and cancelling stay with MANOVA staff. The caller has checked the order belongs to the vendor.
 */
export const VENDOR_SO_TARGETS = ['acknowledged', 'fulfilled']

export async function vendorChangeServiceOrderStatus(tx: Queryable, actor: Actor, id: string, to: unknown, requestId: string) {
  if (typeof to !== 'string' || !VENDOR_SO_TARGETS.includes(to)) throw new AppError(403, 'FORBIDDEN', 'Vendor hanya bisa mengonfirmasi atau menandai selesai.')
  await changeServiceOrderStatus(tx, actor, id, to, null, requestId)
  const [so] = await tx.query<{ project_id: string | null; owner_user_id: string | null; project_name: string | null }>(
    'select so.project_id, p.owner_user_id, p.name as project_name from service_orders so left join projects p on p.id = so.project_id where so.id = $1', [id])
  if (!so?.project_id) return
  await notifyInternal(tx, actor, so.owner_user_id, {
    type: 'change', title: `Service Order ${id} ${to === 'acknowledged' ? 'dikonfirmasi' : 'ditandai selesai'} vendor`,
    body: `Vendor mengubah status ${id} (${so.project_name}) menjadi ${to}.`, entityType: 'project', entityId: so.project_id
  })
}
```

(Cek `ErrorCode` di `http/errors.ts` punya `'FORBIDDEN'`; bila `errors.forbidden(message)` menerima pesan, pakai itu.)

- [ ] **Step 4: Route** — di `routes.ts` ganti awal handler `POST /service-orders/:id/status`:

```ts
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Service order')
      const b = (body ?? {}) as Record<string, unknown>
      // S12d: a vendor confirms or completes its own orders (the read is already scoped to its vendor).
      if (actor.role === 'vendor') {
        if (!(await getServiceOrder(db, actor, id))) throw errors.notFound('Service order')
        await db.transaction(tx => vendorChangeServiceOrderStatus(tx, actor, id, b.to, requestIdOf(request)))
        return ok(request, await getServiceOrder(db, actor, id))
      }
      const so = isPortalActor(actor) ? null : await getServiceOrder(db, actor, id)
```

dan hapus deklarasi `b` lama di bawah (pakai yang di atas). Import `vendorChangeServiceOrderStatus` dari `./vendor-portal`.

- [ ] **Step 5: Tes → PASS**, plus `bun test test/service-orders*.test.ts test/procurement*.test.ts --timeout 30000` (nama file: `ls backend/test | grep -i "order\|procure"`), `bun run typecheck`.

- [ ] **Step 6: Commit** `fix(core): vendor bisa konfirmasi & menandai selesai service order miliknya — dulu selalu 404 (S12d)`

---

### Task 2: Backend — produk vendor lewat `/vendor/products`

**Files:**
- Create: `backend/src/modules/core/vendor-portal-routes.ts`
- Modify: `backend/src/modules/core/vendor-portal.ts`, `backend/src/app.ts`
- Test: `backend/test/vendor-portal.test.ts`

**Interfaces:**
- Consumes: `createVendorProduct` (`./vendor-writes`), `listVendorProducts` (`./repository`), `notifyInternal`.
- Produces: `vendorCreateProduct(tx, actor, vendorId, input, requestId): Promise<{ id }>`; routes `GET/POST /api/v1/vendor/products`.

- [ ] **Step 1: Tes yang gagal** (tambahkan):

```ts
describe('vendor products', () => {
  test('list only own products; add one (idempotent), admins told; body vendorId ignored; validation; other roles refused', async () => {
    const list = await call('GET', '/vendor/products', 'vendor')
    expect(list.status).toBe(200)
    expect((list.json.data as { vendorId: string }[]).every(p => p.vendorId === 'VND-006')).toBe(true)
    const admin = (await t.db.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id limit 1"))[0]!.id
    const n0 = await notes(admin)
    const key = k()
    const body = { name: 'Paket Kamar Deluxe', category: 'hotel', priceMinor: '1200000', vendorId: 'VND-001' }
    const created = await call('POST', '/vendor/products', 'vendor', body, key)
    expect(created.status, JSON.stringify(created.json)).toBe(201)
    expect(created.json.data).toMatchObject({ vendorId: 'VND-006', name: 'Paket Kamar Deluxe', category: 'hotel', priceMinor: '1200000' })
    expect((await call('POST', '/vendor/products', 'vendor', body, key)).json.data.id).toBe(created.json.data.id)
    expect(await notes(admin)).toBe(n0 + 1)
    expect((await call('POST', '/vendor/products', 'vendor', { name: '', category: 'x' }, k())).status).toBe(400)
    for (const who of ['admin', 'client', 'finance']) expect((await call('GET', '/vendor/products', who)).status, who).toBe(403)
  })
})
```

- [ ] **Step 2: FAIL** (404 route).

- [ ] **Step 3: Implementasi** — `vendor-portal.ts` tambah:

```ts
import { createVendorProduct } from './vendor-writes'

/** A vendor adds a product to its own catalogue; MANOVA admins (vendor management) are told. */
export async function vendorCreateProduct(tx: Queryable, actor: Actor, vendorId: string, input: Record<string, unknown>, requestId: string) {
  const { id } = await createVendorProduct(tx, actor, vendorId, { ...input, vendorId: undefined }, requestId)
  const admins = await tx.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")
  for (const a of admins) {
    await notifyInternal(tx, actor, a.id, { type: 'change', title: 'Produk vendor baru', body: `${String(input.name).trim()} (${id}) ditambahkan vendor ${vendorId}.`, entityType: 'vendor', entityId: vendorId })
  }
  return { id }
}
```

`vendor-portal-routes.ts`:

```ts
import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { listVendorProducts } from './repository'
import { vendorCreateProduct } from './vendor-portal'

/** Vendor portal (S12d): only a vendor, only its own vendor (from the session). */
export function vendorPortalRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function vendorActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'vendor' || !actor.vendorId) throw errors.forbidden()
    return { actor, vendorId: actor.vendorId }
  }

  return new Elysia({ prefix: '/api/v1/vendor' })
    .get('/products', async ({ request }) => {
      const { vendorId } = await vendorActor(request)
      return ok(request, await listVendorProducts(db, vendorId))
    })
    .post('/products', async ({ request, body, set }) => {
      const { actor, vendorId } = await vendorActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /vendor/products', key, body }, tx =>
        vendorCreateProduct(tx, actor, vendorId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listVendorProducts(db, vendorId)).find(p => p.id === result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
}
```

`app.ts`: import + `.use(vendorPortalRoutes(deps, auth))` setelah `clientWriteRoutes`.

- [ ] **Step 4: PASS** + typecheck. **Step 5: Commit** `feat(core): vendor melihat & menambah produknya lewat /vendor/products (S12d)`

---

### Task 3: Frontend — data portal vendor dari server + produk server-first

**Files:**
- Modify: `frontend/app/data/sync-plan.ts`, `frontend/app/data/sync-plan.test.ts`
- Modify: `frontend/app/lib/api/endpoints.ts` (`listOwnVendorProducts`, `createOwnVendorProduct`)
- Create: `frontend/app/data/vendor-portal-sync.ts`, `frontend/app/data/vendor-portal-sync.test.ts`
- Modify: `frontend/app/layouts/dashboard.vue` (SYNCS `vendorPortal`)
- Modify: `frontend/app/components/supplier/MyProductsPanel.vue`

**Interfaces:**
- Consumes: `upsertServerVendor` (vendors-sync), mapper produk vendor di vendors-sync (cari fungsi yang dipakai `mergeServerVendorCatalog`, mis. `productFromServer`), `VENDOR_PRODUCTS`, `createSaveGate`.
- Produces: `mergeVendorProducts(vendorId, list)`, `loadVendorPortal(api, vendorId)`, `createOwnVendorProductOnServer(api, input)`, `useVendorPortalSync()` `{ state, load }`; SyncKey `'vendorPortal'`.

- [ ] **Step 1: Tes yang gagal**
  - `sync-plan.test.ts`: vendor → `['projects', 'notifications', 'procurement', 'bookings', 'vendorPortal']`.
  - `vendor-portal-sync.test.ts`: `mergeVendorProducts('VND-006', [dto])` mengganti produk VND-006 saja (vendor lain tetap); `createOwnVendorProductOnServer` dengan api mock → produk server masuk `VENDOR_PRODUCTS`, error → array tidak berubah; `loadVendorPortal` memanggil `getVendor('VND-006')` dan `listOwnVendorProducts()` lalu meng-upsert vendor.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi**
  - `sync-plan.ts`: `VENDOR = ['projects', 'notifications', 'procurement', 'bookings', 'vendorPortal']`, SyncKey + `'vendorPortal'`, komentar S12d.
  - endpoints: `listOwnVendorProducts: () => client.get<VendorProductDto[]>('/vendor/products')`, `createOwnVendorProduct: (input: { name: string; category: VendorDto['serviceType']; description?: string; priceMinor?: string }, idempotencyKey = newIdempotencyKey()) => client.post<VendorProductDto>('/vendor/products', input, { idempotencyKey })`.
  - `vendor-portal-sync.ts`: pola `useClientCommerceSync` (role `vendor` + `vendorId` dari `currentUser`; status idle/loading/ready/offline/error).
  - `dashboard.vue`: `vendorPortal: vendorPortalSync` di SYNCS.
  - `MyProductsPanel.vue`: `submitCreate` → `gate.run('Produk Gagal Disimpan', () => createOwnVendorProductOnServer(api, { name, category, description, priceMinor: newPrice != null ? String(newPrice) : undefined }))`; reset & tutup hanya bila sukses; toast sukses.
- [ ] **Step 4: PASS** + `pnpm test`, vue-tsc ≤ 1986, eslint vs HEAD.
- [ ] **Step 5: Commit** `feat(frontend): portal vendor memuat SO, quotation, layanan/booking & profil dari server; produk lewat server (S12d)`

---

### Task 4: Dokumentasi + verifikasi

- [ ] Smoke (salinan DB dev `pglite-year` di :3100): demo-login USR-015 → `GET /service-orders` (hanya VND-006), `POST /service-orders/SO-002/status {to:'fulfilled'}` 200, `{to:'cancelled'}` 403; `GET/POST /vendor/products`; admin `GET /vendor/products` 403.
- [ ] Suite penuh backend (background), `pnpm test`, vue-tsc, build.
- [ ] ADR-004 "Update 2026-10-19 — Portal vendor (S12d)", ADR-006 satu paragraf, status spec → diimplementasikan; commit docs.
