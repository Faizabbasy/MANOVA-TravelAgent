# Sales Order (B2C Individual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `SalesOrder` entity (lightweight B2C individual bookings) fully separate from the existing B2B `Project` order, exposed as a second pill-tab on the `/project-orders` page plus its own simple detail page.

**Architecture:** New type file + new data-fixture file, both following the exact structural pattern already used by `app/data/vendors.ts` (a `reactive([...])` array of plain objects, no local functions — selectors/mutators live centrally in `app/data/index.ts`). `Party` gets one new optional field (`partyType`) so individual customers reuse the existing Party/`getPartyById` plumbing instead of a parallel entity. UI reuses existing shared components (`StatsCard`, `SectionCard`, `Table`, `Dialog`, `StatusBadge`, `DetailMetadataList`, `EmptyState`) — no new shared components.

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup>` + TypeScript, Vitest for data-layer tests, Tailwind CSS, shadcn-nuxt components (all auto-imported, no explicit import needed in `.vue` files).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-sales-order-b2c-design.md` — every task below implements a section of it.
- Zero changes to any existing Project Order (B2B) file, type, data, or component (spec Non-Goals).
- No quotation/invoice/document generation for Sales Order this iteration (spec Non-Goals).
- ID prefix `SLO-` for `SalesOrder` (`SO-` is already taken by `ServiceOrder` in `app/data/index.ts:3568` — confirmed by direct grep, do not reuse it).
- Status flow is strictly linear + cancel: `draft → paid → ongoing → done`, `cancelled` reachable from `draft`/`paid`/`ongoing` only (spec Design §2).
- Permissions: reuse the page's existing `canView('operations')` / `canManage('operations')` gates as-is — no new module/capability key (spec Design §7, a documented judgment call the user already reviewed).
- Mutators that create data use `DEMO_REFERENCE_DATE` for timestamps, never `new Date()` (existing repo-wide convention, see `createParty` in `app/data/index.ts`).

---

### Task 1: Types — `SalesOrder`, `PartyType`, and `SALES_ORDER_STATUSES`

**Files:**
- Create: `app/types/sales-order.ts`
- Modify: `app/types/party.ts` (add `PartyType` export + `partyType?` field on `Party`)
- Modify: `app/constants/status.ts` (add import + `SALES_ORDER_STATUSES` export)

**Interfaces:**
- Produces: `SalesOrderStatus` (`'draft' | 'paid' | 'ongoing' | 'done' | 'cancelled'`), `SalesOrder` interface, `PartyType` (`'company' | 'individual'`), `SALES_ORDER_STATUSES: StatusOption<SalesOrderStatus>[]` — every later task imports these exact names.

- [ ] **Step 1: Create `app/types/sales-order.ts`**

```ts
import type { ID } from './common'

/** Sales Order (B2C individual) — status flow linear + cancel, jauh lebih ringan dari 6-step Project Order (lihat `docs/superpowers/specs/2026-08-11-sales-order-b2c-design.md`). */
export type SalesOrderStatus = 'draft' | 'paid' | 'ongoing' | 'done' | 'cancelled'

export interface SalesOrder {
  id: ID
  /** → `Party` dengan `partyType: 'individual'`. */
  customerId: ID
  destination: string
  travelStartDate: string
  travelEndDate: string
  travelerCount: number
  priceIdr: number
  status: SalesOrderStatus
  note?: string
  createdAt: string
}
```

- [ ] **Step 2: Add `PartyType` and `partyType` field to `app/types/party.ts`**

Open `app/types/party.ts`. After the existing `export type CompanyType = ...` line (line 6), add:

```ts
/** Sales Order (B2C) — default tersirat `'company'` saat absen; seluruh Party lama tidak berubah perilaku. */
export type PartyType = 'company' | 'individual'
```

Then inside the `Party` interface (after the `industry?: string` field, line 26), add:

```ts
  /** Sales Order (B2C individual) — Party dengan `partyType: 'individual'` dibuat lewat `createSalesOrder`. */
  partyType?: PartyType
```

- [ ] **Step 3: Add `SALES_ORDER_STATUSES` to `app/constants/status.ts`**

Add to the `import type` block at the top (after the `party.ts` import line, line 5):

```ts
import type { SalesOrderStatus } from '~/types/sales-order'
```

Add after the `PROJECT_ORDER_STATUSES` block (after line 68):

```ts
/** Sales Order (B2C individual, `docs/superpowers/specs/2026-08-11-sales-order-b2c-design.md`) — flow linear + cancel, terpisah total dari `PROJECT_ORDER_STATUSES`. */
export const SALES_ORDER_STATUSES: StatusOption<SalesOrderStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'paid', label: 'Dibayar', tone: 'info', order: 2 },
  { value: 'ongoing', label: 'Berjalan', tone: 'primary', order: 3 },
  { value: 'done', label: 'Selesai', tone: 'success', order: 4 },
  { value: 'cancelled', label: 'Dibatalkan', tone: 'destructive', order: 5 }
]
```

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors (existing pre-existing errors in unrelated files, if any, are not caused by this change — compare against a run before this task if unsure).

- [ ] **Step 5: Commit**

```bash
git add app/types/sales-order.ts app/types/party.ts app/constants/status.ts
git commit -m "feat: add SalesOrder types and PartyType for B2C individual customers"
```

---

### Task 2: Fixture data — individual `Party` seeds + `SALES_ORDERS`

**Files:**
- Modify: `app/data/parties.ts` (append 3 individual `Party` fixtures)
- Create: `app/data/sales-orders.ts`

**Interfaces:**
- Consumes: `SalesOrder` type from Task 1.
- Produces: `SALES_ORDERS: SalesOrder[]` (reactive array) — Task 3's selectors/mutators and Task 4/5's UI read this. Three new `Party` ids `PTY-006`, `PTY-007`, `PTY-008` (`partyType: 'individual'`) — Task 3's `createSalesOrder` test and Task 4/5 UI reference these as seed customers.

- [ ] **Step 1: Append 3 individual customers to `app/data/parties.ts`**

Open `app/data/parties.ts`. Inside the `PARTIES: Party[] = reactive([...])` array, after the last existing entry (`PTY-005`, before the closing `])`), add:

```ts
  ,
  { id: 'PTY-006', name: 'Andi Prasetyo', lifecycleStatus: 'client', createdAt: '2026-07-01', partyType: 'individual', phone: '0812-3456-7890', city: 'Jakarta' },
  { id: 'PTY-007', name: 'Sinta Wulandari', lifecycleStatus: 'client', createdAt: '2026-07-10', partyType: 'individual', phone: '0813-2345-6789', city: 'Bandung' },
  { id: 'PTY-008', name: 'Reza Hartono', lifecycleStatus: 'client', createdAt: '2026-07-15', partyType: 'individual', phone: '0857-1234-5678', city: 'Surabaya' }
```

(Adjust the leading comma/comma-placement to valid array syntax given the exact trailing character of the last existing entry — the intent is 3 new object literals appended before the closing `])`.)

- [ ] **Step 2: Create `app/data/sales-orders.ts`**

```ts
import { reactive } from 'vue'
import type { SalesOrder } from '~/types/sales-order'

/** Seed data Sales Order (B2C individual) — 5 baris, satu per status, terikat ke Party individual PTY-006..008 (`app/data/parties.ts`). */
export const SALES_ORDERS: SalesOrder[] = reactive([
  { id: 'SLO-001', customerId: 'PTY-006', destination: 'Bali', travelStartDate: '2026-08-20', travelEndDate: '2026-08-24', travelerCount: 2, priceIdr: 18_500_000, status: 'draft', createdAt: '2026-07-01' },
  { id: 'SLO-002', customerId: 'PTY-007', destination: 'Yogyakarta', travelStartDate: '2026-08-05', travelEndDate: '2026-08-08', travelerCount: 4, priceIdr: 12_000_000, status: 'paid', createdAt: '2026-07-10' },
  { id: 'SLO-003', customerId: 'PTY-008', destination: 'Raja Ampat', travelStartDate: '2026-07-25', travelEndDate: '2026-07-30', travelerCount: 1, priceIdr: 32_000_000, status: 'ongoing', createdAt: '2026-06-20' },
  { id: 'SLO-004', customerId: 'PTY-006', destination: 'Singapura', travelStartDate: '2026-06-10', travelEndDate: '2026-06-13', travelerCount: 2, priceIdr: 15_000_000, status: 'done', createdAt: '2026-05-15' },
  { id: 'SLO-005', customerId: 'PTY-007', destination: 'Lombok', travelStartDate: '2026-06-01', travelEndDate: '2026-06-04', travelerCount: 3, priceIdr: 14_000_000, status: 'cancelled', createdAt: '2026-05-01' }
])
```

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/data/parties.ts app/data/sales-orders.ts
git commit -m "feat: add Sales Order fixture data and individual customer seeds"
```

---

### Task 3: Data layer — selectors, mutators, and tests

**Files:**
- Modify: `app/data/index.ts` (import + re-export `SALES_ORDERS`; add selector/mutator functions)
- Test: `app/data/sales-orders.test.ts`

**Interfaces:**
- Consumes: `SALES_ORDERS` (Task 2), `SalesOrder`/`SalesOrderStatus` (Task 1), existing `createParty(input: { name: string; industry?: string }): Party` and `nextSequentialId(prefix, list)` (both already in `app/data/index.ts`), existing `DEMO_REFERENCE_DATE`.
- Produces (imported by Task 4/5 UI as `from '~/data'`):
  - `getSalesOrderById(id: string): SalesOrder | undefined`
  - `getSalesOrdersSummary(): { total: number; draft: number; paid: number; done: number }`
  - `getSalesOrderStatusTransitions(status: SalesOrderStatus): SalesOrderStatus[]`
  - `createSalesOrder(input: CreateSalesOrderInput): SalesOrder | undefined` where `CreateSalesOrderInput = { customerName: string; destination: string; travelStartDate: string; travelEndDate: string; travelerCount: number; priceIdr: number; note?: string }`
  - `updateSalesOrderStatus(id: string, status: SalesOrderStatus): SalesOrder | undefined`

- [ ] **Step 1: Write the failing test — `app/data/sales-orders.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  SALES_ORDERS, getSalesOrderById, getSalesOrdersSummary,
  getSalesOrderStatusTransitions, createSalesOrder, updateSalesOrderStatus
} from './index'

describe('Sales Order (B2C)', () => {
  it('status flow linear: draft -> paid -> ongoing -> done, cancel dari status non-terminal saja', () => {
    expect(getSalesOrderStatusTransitions('draft')).toEqual(['paid', 'cancelled'])
    expect(getSalesOrderStatusTransitions('paid')).toEqual(['ongoing', 'cancelled'])
    expect(getSalesOrderStatusTransitions('ongoing')).toEqual(['done', 'cancelled'])
    expect(getSalesOrderStatusTransitions('done')).toEqual([])
    expect(getSalesOrderStatusTransitions('cancelled')).toEqual([])
  })

  it('createSalesOrder menolak input tidak valid (nama kosong, tanggal terbalik, jumlah nol)', () => {
    expect(createSalesOrder({ customerName: '', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 1, priceIdr: 1_000_000 })).toBeUndefined()
    expect(createSalesOrder({ customerName: 'Test', destination: 'Bali', travelStartDate: '2026-09-05', travelEndDate: '2026-09-01', travelerCount: 1, priceIdr: 1_000_000 })).toBeUndefined()
    expect(createSalesOrder({ customerName: 'Test', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 0, priceIdr: 1_000_000 })).toBeUndefined()
    expect(createSalesOrder({ customerName: 'Test', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 1, priceIdr: 0 })).toBeUndefined()
  })

  it('createSalesOrder membuat Party individual baru dan SalesOrder berstatus draft', () => {
    const before = SALES_ORDERS.length
    const order = createSalesOrder({ customerName: 'Budi Santoso Test', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 2, priceIdr: 10_000_000 })
    expect(order).toBeDefined()
    expect(order!.status).toBe('draft')
    expect(order!.id.startsWith('SLO-')).toBe(true)
    expect(SALES_ORDERS.length).toBe(before + 1)
    expect(getSalesOrderById(order!.id)).toBe(order)
  })

  it('updateSalesOrderStatus menolak lompat step tapi menerima transisi valid', () => {
    const order = SALES_ORDERS.find(o => o.id === 'SLO-001')!
    expect(order.status).toBe('draft')
    expect(updateSalesOrderStatus(order.id, 'done')).toBeUndefined()
    expect(order.status).toBe('draft')
    expect(updateSalesOrderStatus(order.id, 'paid')).toBeDefined()
    expect(order.status).toBe('paid')
  })

  it('getSalesOrdersSummary menghitung total dan per-status dengan benar', () => {
    const summary = getSalesOrdersSummary()
    expect(summary.total).toBe(SALES_ORDERS.length)
    expect(summary.draft).toBe(SALES_ORDERS.filter(o => o.status === 'draft').length)
    expect(summary.paid).toBe(SALES_ORDERS.filter(o => o.status === 'paid').length)
    expect(summary.done).toBe(SALES_ORDERS.filter(o => o.status === 'done').length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/data/sales-orders.test.ts`
Expected: FAIL — `SALES_ORDERS`/`getSalesOrderById`/etc. not exported from `./index` yet.

- [ ] **Step 3: Wire up re-export and write the selectors/mutators in `app/data/index.ts`**

Add near the other entity imports (after the `./vendors` import, currently line 5):

```ts
import { SALES_ORDERS } from './sales-orders'
```

Add near the other `import type` lines (after the `~/types/vendor` import):

```ts
import type { SalesOrder, SalesOrderStatus } from '~/types/sales-order'
```

Add `SALES_ORDERS` into the existing combined `export { ... }` block (insert on its own line right after the `VENDORS, VENDOR_CONTACTS, ...` line):

```ts
  SALES_ORDERS,
```

Add the following functions anywhere in `app/data/index.ts` alongside the other selector/mutator exports (e.g. near `createParty`):

```ts
export function getSalesOrderById (id: string): SalesOrder | undefined {
  return SALES_ORDERS.find(order => order.id === id)
}

export interface SalesOrdersSummary {
  total: number
  draft: number
  paid: number
  done: number
}

export function getSalesOrdersSummary (): SalesOrdersSummary {
  return {
    total: SALES_ORDERS.length,
    draft: SALES_ORDERS.filter(order => order.status === 'draft').length,
    paid: SALES_ORDERS.filter(order => order.status === 'paid').length,
    done: SALES_ORDERS.filter(order => order.status === 'done').length
  }
}

/** Flow linear + cancel (`docs/superpowers/specs/2026-08-11-sales-order-b2c-design.md`) — jauh lebih ringan dari gerbang milestone Project Order, sengaja tanpa syarat tambahan apa pun selain urutan status. */
const SALES_ORDER_FLOW: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ['paid', 'cancelled'],
  paid: ['ongoing', 'cancelled'],
  ongoing: ['done', 'cancelled'],
  done: [],
  cancelled: []
}

export function getSalesOrderStatusTransitions (status: SalesOrderStatus): SalesOrderStatus[] {
  return SALES_ORDER_FLOW[status]
}

export interface CreateSalesOrderInput {
  customerName: string
  destination: string
  travelStartDate: string
  travelEndDate: string
  travelerCount: number
  priceIdr: number
  note?: string
}

/** Membuat Party individual baru (reuse `createParty`, lalu ditandai `partyType: 'individual'`) sekaligus SalesOrder berstatus `draft` — satu langkah, konsisten dengan pola `issueDebitNote` (validasi di data layer, bukan cuma di UI). */
export function createSalesOrder (input: CreateSalesOrderInput): SalesOrder | undefined {
  if (!input.customerName.trim() || !input.destination.trim()) { return undefined }
  if (!input.travelStartDate || !input.travelEndDate || input.travelStartDate > input.travelEndDate) { return undefined }
  if (!(input.travelerCount > 0) || !(input.priceIdr > 0)) { return undefined }

  const customer = createParty({ name: input.customerName.trim() })
  customer.partyType = 'individual'
  customer.lifecycleStatus = 'client'

  const order: SalesOrder = {
    id: nextSequentialId('SLO-', SALES_ORDERS),
    customerId: customer.id,
    destination: input.destination.trim(),
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    travelerCount: input.travelerCount,
    priceIdr: input.priceIdr,
    status: 'draft',
    note: input.note?.trim() || undefined,
    createdAt: DEMO_REFERENCE_DATE
  }
  SALES_ORDERS.push(order)
  return order
}

export function updateSalesOrderStatus (id: string, status: SalesOrderStatus): SalesOrder | undefined {
  const order = SALES_ORDERS.find(item => item.id === id)
  if (!order) { return undefined }
  if (!getSalesOrderStatusTransitions(order.status).includes(status)) { return undefined }
  order.status = status
  return order
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/data/sales-orders.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npm run test`
Expected: PASS — same pass count as before this task, plus the 5 new tests.

- [ ] **Step 6: Commit**

```bash
git add app/data/index.ts app/data/sales-orders.test.ts
git commit -m "feat: add Sales Order data layer (selectors, mutators, status flow) with tests"
```

---

### Task 4: Sales Orders pill-tab — list, stats, and create dialog

**Files:**
- Modify: `app/pages/project-orders/index.vue`

**Interfaces:**
- Consumes: `SALES_ORDERS`, `getSalesOrdersSummary`, `createSalesOrder`, `getPartyById` (already imported on this page), `SALES_ORDER_STATUSES`, `findStatusOption` (already imported) — all from Task 1-3.
- Produces: nothing new consumed elsewhere (this is the outermost UI layer for the list).

- [ ] **Step 1: Add imports and tab state**

In the `<script setup>` block of `app/pages/project-orders/index.vue`, add to the existing `from '~/data'` import (currently `PROJECTS, getPartyById, getUserById, getProjectOrderStatus`):

```ts
import {
  PROJECTS, getPartyById, getUserById, getProjectOrderStatus,
  SALES_ORDERS, getSalesOrdersSummary, createSalesOrder
} from '~/data'
```

Add to the existing `from '~/constants/status'` import:

```ts
import { PROJECT_ORDER_STATUSES, PROJECT_CHARACTERISTICS, SALES_ORDER_STATUSES, findStatusOption } from '~/constants/status'
```

Add to the existing lucide-vue-next import (currently `Search, FolderKanban, AlertTriangle, CheckCircle2, Clock`):

```ts
import { Search, FolderKanban, AlertTriangle, CheckCircle2, Clock, Plus, Users } from 'lucide-vue-next'
```

After the existing `const hasAccess = computed(...)` line, add:

```ts
/** Pill-tab: Project Orders (B2B, tabel yang sudah ada, tidak berubah) vs Sales Orders (B2C individual, baru). */
const activeOrderTab = ref<'project-orders' | 'sales-orders'>('project-orders')

const salesOrderRows = computed(() => SALES_ORDERS.map(order => ({
  order,
  customer: getPartyById(order.customerId)
})))

const salesOrderSearch = ref('')
const filteredSalesOrderRows = computed(() => {
  if (!salesOrderSearch.value.trim()) { return salesOrderRows.value }
  const query = salesOrderSearch.value.toLowerCase()
  return salesOrderRows.value.filter(row =>
    row.order.destination.toLowerCase().includes(query) ||
    (row.customer?.name ?? '').toLowerCase().includes(query))
})

const salesOrdersSummary = computed(() => getSalesOrdersSummary())
```

- [ ] **Step 2: Add create-dialog state and submit function**

Add after `salesOrdersSummary`:

```ts
/* Buat Sales Order */
const isCreateSalesOrderOpen = ref(false)
const newCustomerName = ref('')
const newDestination = ref('')
const newTravelStartDate = ref('')
const newTravelEndDate = ref('')
const newTravelerCount = ref<number | null>(null)
const newPriceIdr = ref<number | null>(null)
const newNote = ref('')

function resetSalesOrderForm () {
  newCustomerName.value = ''
  newDestination.value = ''
  newTravelStartDate.value = ''
  newTravelEndDate.value = ''
  newTravelerCount.value = null
  newPriceIdr.value = null
  newNote.value = ''
}

function submitSalesOrder () {
  if (!newCustomerName.value.trim() || !newDestination.value.trim() || !newTravelStartDate.value || !newTravelEndDate.value || !newTravelerCount.value || !newPriceIdr.value) { return }
  const order = createSalesOrder({
    customerName: newCustomerName.value.trim(),
    destination: newDestination.value.trim(),
    travelStartDate: newTravelStartDate.value,
    travelEndDate: newTravelEndDate.value,
    travelerCount: newTravelerCount.value,
    priceIdr: newPriceIdr.value,
    note: newNote.value.trim() || undefined
  })
  if (!order) { return }
  resetSalesOrderForm()
  isCreateSalesOrderOpen.value = false
}
```

- [ ] **Step 3: Add the pill-tab buttons to the template**

In the `<template>`, immediately after the closing `</div>` of the existing `<PageHeader ... />` block (right before `<RoleAccessState v-if="!hasAccess" ... />`), add:

```vue
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="cn(
          'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
          activeOrderTab === 'project-orders' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
        )"
        @click="activeOrderTab = 'project-orders'"
      >
        Project Orders
      </button>
      <button
        type="button"
        :class="cn(
          'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
          activeOrderTab === 'sales-orders' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
        )"
        @click="activeOrderTab = 'sales-orders'"
      >
        Sales Orders
      </button>
    </div>
```

- [ ] **Step 4: Wrap the existing Project Orders content in `v-if`**

Find the `<RoleAccessState v-if="!hasAccess" .../>` line and the `<template v-else>...</template>` block that follows it (containing the stats grid, filters, step pills, and the `SectionCard` with the table — everything currently on the page). Change the opening of that `<template v-else>` to also require the B2B tab:

```vue
    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else-if="activeOrderTab === 'project-orders'">
```

(Everything inside stays exactly as-is — only the wrapping condition changes, from `v-else` to `v-else-if="activeOrderTab === 'project-orders'"`.)

- [ ] **Step 5: Add the Sales Orders tab body**

Immediately after the closing `</template>` from Step 4 (the end of the Project Orders tab body), and still before the existing detail dialogs (if any) or the root `</div>`, add:

```vue
    <template v-else-if="activeOrderTab === 'sales-orders'">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Sales Order" :value="String(salesOrdersSummary.total)" :icon="Users" />
        <StatsCard title="Draft" :value="String(salesOrdersSummary.draft)" :icon="Clock" />
        <StatsCard title="Dibayar" :value="String(salesOrdersSummary.paid)" :icon="CheckCircle2" icon-color="primary" />
        <StatsCard title="Selesai" :value="String(salesOrdersSummary.done)" :icon="CheckCircle2" icon-color="success" />
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mt-4">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="salesOrderSearch" placeholder="Cari customer atau destinasi..." class="pl-9" />
        </div>
        <Dialog v-model:open="isCreateSalesOrderOpen">
          <DialogTrigger as-child>
            <Button size="sm" class="ml-auto">
              <Plus class="h-4 w-4 mr-1.5" />Buat Sales Order
            </Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Sales Order Baru</DialogTitle>
              <DialogDescription>Booking individual (B2C) — customer baru otomatis dibuat, status awal "Draft".</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="so-customer">Nama Customer</Label>
                <Input id="so-customer" v-model="newCustomerName" placeholder="mis. Budi Santoso" />
              </div>
              <div class="space-y-1.5">
                <Label for="so-destination">Destinasi</Label>
                <Input id="so-destination" v-model="newDestination" placeholder="mis. Bali" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="so-start">Tanggal Berangkat</Label>
                  <Input id="so-start" v-model="newTravelStartDate" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="so-end">Tanggal Pulang</Label>
                  <Input id="so-end" v-model="newTravelEndDate" type="date" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="so-travelers">Jumlah Traveler</Label>
                  <Input id="so-travelers" v-model.number="newTravelerCount" type="number" min="1" />
                </div>
                <div class="space-y-1.5">
                  <Label for="so-price">Harga (Rp)</Label>
                  <CurrencyInput id="so-price" v-model="newPriceIdr" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="so-note">Catatan (opsional)</Label>
                <Input id="so-note" v-model="newNote" placeholder="Catatan tambahan" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateSalesOrderOpen = false">
                Batal
              </Button>
              <Button :disabled="!newCustomerName.trim() || !newDestination.trim() || !newTravelStartDate || !newTravelEndDate || !newTravelerCount || !newPriceIdr" @click="submitSalesOrder">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SectionCard class="mt-4">
        <Table v-if="filteredSalesOrderRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Destinasi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Traveler</TableHead>
              <TableHead class="text-right">
                Harga
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredSalesOrderRows"
              :key="row.order.id"
              class="cursor-pointer"
              @click="$router.push(`/sales-orders/${row.order.id}`)"
            >
              <TableCell class="text-sm font-medium text-foreground">
                {{ row.customer?.name ?? '—' }}
              </TableCell>
              <TableCell class="text-sm text-foreground">
                {{ row.order.destination }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDateRange(row.order.travelStartDate, row.order.travelEndDate) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ row.order.travelerCount }}
              </TableCell>
              <TableCell class="text-right text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(row.order.priceIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(SALES_ORDER_STATUSES, row.order.status).label" :tone="findStatusOption(SALES_ORDER_STATUSES, row.order.status).tone" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState
          v-else
          :icon="Users"
          title="Belum ada Sales Order"
          description="Ubah kata kunci atau buat Sales Order baru."
        />
      </SectionCard>
    </template>
```

- [ ] **Step 6: Confirm `cn` is imported**

This page does not currently import `cn` (the pill buttons in Step 3 and the existing step-filter pills already on the page use it). Check the top of the `<script setup>` block — if there is no `import { cn } from '~/lib/utils'` line, add one. (The existing step-filter pill buttons on this page already use `cn(...)`, so this import likely already exists — verify, don't duplicate.)

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open `/project-orders`.
Expected: "Project Orders" tab shows exactly the same content as before this task (stats, filters, step pills, table, row-click to `/project-orders/[id]`). Clicking "Sales Orders" swaps to the new stats row + table with the 5 seed rows. "+ Buat Sales Order" opens the dialog; submitting a valid form adds a new row with status "Draft" and closes the dialog. Search filters by customer name or destination.

- [ ] **Step 8: Lint and typecheck**

Run: `npx eslint app/pages/project-orders/index.vue`
Expected: no errors.
Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add app/pages/project-orders/index.vue
git commit -m "feat: add Sales Orders pill-tab (list, stats, create dialog) to Project page"
```

---

### Task 5: Sales Order detail page

**Files:**
- Create: `app/pages/sales-orders/[id]/index.vue`

**Interfaces:**
- Consumes: `getSalesOrderById`, `getPartyById`, `updateSalesOrderStatus`, `getSalesOrderStatusTransitions` (Task 3), `SALES_ORDER_STATUSES` (Task 1), `DetailMetadataList` (existing shared component, `{ label: string; value: string }[]` prop shape).

- [ ] **Step 1: Create the page**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getSalesOrderById, getPartyById, updateSalesOrderStatus, getSalesOrderStatusTransitions } from '~/data'
import { SALES_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate } from '~/utils/format'
import type { SalesOrderStatus } from '~/types/sales-order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
const hasAccess = computed(() => canView('operations'))
const canManageOrder = computed(() => canManage('operations'))

const order = computed(() => getSalesOrderById(String(route.params.id)))
const customer = computed(() => (order.value ? getPartyById(order.value.customerId) : undefined))

useHead({ title: computed(() => order.value ? `Sales Order ${order.value.id}` : 'Sales Order Tidak Ditemukan') })

const summaryMetadata = computed(() => {
  if (!order.value) { return [] }
  return [
    { label: 'Customer', value: customer.value?.name ?? '—' },
    { label: 'Telepon', value: customer.value?.phone ?? '—' },
    { label: 'Destinasi', value: order.value.destination },
    { label: 'Tanggal', value: formatDateRange(order.value.travelStartDate, order.value.travelEndDate) },
    { label: 'Jumlah Traveler', value: String(order.value.travelerCount) },
    { label: 'Harga', value: formatCurrencyIdr(order.value.priceIdr) },
    { label: 'Dibuat', value: formatDate(order.value.createdAt) }
  ]
})

const nextStatuses = computed(() => (order.value ? getSalesOrderStatusTransitions(order.value.status) : []))

function advanceTo (status: SalesOrderStatus) {
  if (!order.value) { return }
  updateSalesOrderStatus(order.value.id, status)
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!order">
      <PageHeader title="Sales Order Tidak Ditemukan" :breadcrumb="[{ label: 'Project', to: '/project-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Sales Order tidak ditemukan"
          :description="`Sales Order dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/project-orders')">
            Kembali ke Daftar
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else>
      <PageHeader
        :title="`Sales Order ${order.id}`"
        :breadcrumb="[{ label: 'Project', to: '/project-orders' }, { label: order.id }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(SALES_ORDER_STATUSES, order.status).label" :tone="findStatusOption(SALES_ORDER_STATUSES, order.status).tone" />
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList :items="summaryMetadata" />
        <p v-if="order.note" class="text-sm text-muted-foreground mt-4">
          {{ order.note }}
        </p>
      </SectionCard>

      <SectionCard v-if="canManageOrder && nextStatuses.length" title="Ubah Status">
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="status in nextStatuses"
            :key="status"
            size="sm"
            :variant="status === 'cancelled' ? 'destructive' : 'default'"
            @click="advanceTo(status)"
          >
            {{ findStatusOption(SALES_ORDER_STATUSES, status).label }}
          </Button>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, navigate from `/project-orders` → "Sales Orders" tab → click `SLO-001`.
Expected: detail page loads at `/sales-orders/SLO-001`, shows customer/destination/dates/price, status badge "Draft", and buttons "Dibayar"/"Dibatalkan". Clicking "Dibayar" updates the badge to "Dibayar" and the button row now shows "Berjalan"/"Dibatalkan". Navigate to a `SLO-004` (status `done`) — no status-change buttons shown (empty `nextStatuses`). Navigate to a nonexistent id (`/sales-orders/SLO-999`) — shows the not-found empty state with a working "Kembali ke Daftar" button.

- [ ] **Step 3: Lint and typecheck**

Run: `npx eslint app/pages/sales-orders/[id]/index.vue`
Expected: no errors.
Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/pages/sales-orders/[id]/index.vue"
git commit -m "feat: add Sales Order detail page with status transitions"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Design §1 (Party) → Task 1. §2 (SalesOrder type/status) → Task 1. §3 (data layer) → Task 3. §4 (UI pill-tab) → Task 4. §5 (detail page) → Task 5. §6 (create dialog) → Task 4 Step 5. §7 (permissions) → Task 4/5 reuse `canView('operations')`/`canManage('operations')` throughout, no new capability added. Error Handling section (validation, linear transitions, empty state) → Task 3 Step 3 (`createSalesOrder`/`updateSalesOrderStatus` validation) and Task 4 Step 5 (`EmptyState`).
- **Type consistency check:** `SalesOrderStatus`/`SalesOrder`/`CreateSalesOrderInput` names match exactly across Tasks 1, 3, 4, 5. `SALES_ORDER_STATUSES` name matches across Tasks 1, 4, 5. `getSalesOrderStatusTransitions`/`createSalesOrder`/`updateSalesOrderStatus`/`getSalesOrderById`/`getSalesOrdersSummary` names match exactly between their Task 3 definition and Task 4/5 usage.
- **Prefix collision check:** confirmed via direct grep that `SO-` is already used by `ServiceOrder` (`app/data/index.ts:3568`) — this plan uses `SLO-` throughout, no collision.
