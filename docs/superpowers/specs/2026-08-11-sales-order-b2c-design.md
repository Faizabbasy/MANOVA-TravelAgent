# Sales Order (B2C Individual) — New Entity + Pill-Tab on Project Page

Date: 2026-08-11
Status: Approved (pending spec review)

## Context

The user asked to rename "Project Orders" (sidebar label, page title, breadcrumbs, StatsCard/table/tab labels wherever it appears as user-facing text) to "Project" — done as a prerequisite, ahead of this spec, touching only display strings (`app/constants/navigation.ts`, `app/pages/project-orders/index.vue`, `app/pages/project-orders/[id]/index.vue` breadcrumbs, `app/components/sales/SalesFunnelPanel.vue`'s link card, and the "Project Orders" tab label on `app/pages/customer-journey/customers/[id]/index.vue`). No route paths, file names, component names, or code identifiers changed.

Separately, the user wants the `/project-orders` page ("Project") to hold two pill-tab sections: **Project Orders** (B2B, the existing table — untouched) and **Sales Orders** (B2C individual customers — new). Investigation confirmed the app currently has no B2C/individual-customer concept anywhere: `Party` (`app/types/party.ts:22`) always represents a company (`companyType`, `industry`, etc.), and `Project` (the existing "Project Order") is created only from a won `Opportunity` and carries a full 6-step corporate workflow (`Drafting → Confirmed → Start → Departure → On Progress → Done`, `app/types/project-order.ts:12`) with milestone gates and document folders — machinery that doesn't fit a lightweight individual booking.

## Goals

- A new `SalesOrder` entity, completely separate from `Project`, for lightweight individual (B2C) bookings.
- A "Sales Orders" pill tab on `/project-orders` next to the existing "Project Orders" tab, swapping both the stats row and the table body when switched (two different datasets, not a filter over one dataset).
- A simple detail page per Sales Order.
- Zero changes to any existing Project Order (B2B) file, type, data, or component.

## Non-Goals

- No quotation/invoice/document generation for Sales Order — just a price field and a payment/fulfillment status.
- No integration with the Opportunity/CRM pipeline — a Sales Order is created directly (manual form), not derived from a won Opportunity.
- No fine-grained "who can create vs. who can only view" permission split — this iteration reuses the same `operations` module gate the page already has (see Permissions below); splitting create-vs-view by role can be a later follow-up if needed.
- No change to `Project`/`ProjectOrderStatus`/`ProjectOrderStepKey` or any of the existing Project Order components (`ProjectOrderStatusWorkflowPanel.vue`, `ProjectOrderDocumentFolder.vue`, etc.).

## Design

### 1. Data model — `app/types/party.ts`

Add one optional field to the existing `Party` interface (additive, does not touch any existing Party record's behavior — every current fixture Party implicitly stays `'company'`):

```ts
export type PartyType = 'company' | 'individual'
// ...
export interface Party {
  // ...existing fields unchanged...
  /** Sales Order (B2C). Default treated as 'company' when absent — every existing fixture Party is unaffected. */
  partyType?: PartyType
}
```

Individual customers for Sales Order are `Party` records with `partyType: 'individual'`, `lifecycleStatus: 'client'`, and the company-only fields (`companyType`, `industry`, `accountOwnerId`) left undefined. This reuses the existing `getPartyById` and Party-linked plumbing without duplicating a parallel "Customer" concept.

### 2. Data model — `app/types/sales-order.ts` (new file)

```ts
export type SalesOrderStatus = 'draft' | 'paid' | 'ongoing' | 'done' | 'cancelled'

export interface SalesOrder {
  id: string
  customerId: string          // → Party (partyType: 'individual')
  destination: string
  travelStartDate: string     // ISO date
  travelEndDate: string       // ISO date
  travelerCount: number
  priceIdr: number
  status: SalesOrderStatus
  note?: string
  createdAt: string           // ISO date
}
```

Status order/tone (`app/constants/status.ts`, new `SALES_ORDER_STATUSES: StatusOption<SalesOrderStatus>[]`, same shape as `PROJECT_ORDER_STATUSES`):
`draft` (neutral) → `paid` (info) → `ongoing` (primary) → `done` (success); `cancelled` (destructive) reachable from `draft`/`paid`/`ongoing`.

### 3. Data layer — `app/data/sales-orders.ts` (new file, re-exported through `app/data/index.ts` following the existing `parties.ts`/`vendors.ts` module-split pattern)

- `SALES_ORDERS: SalesOrder[]` — a handful of seed rows across all 5 statuses, each linked to a new seed individual `Party`.
- `getSalesOrderById(id)`, `getSalesOrdersSummary()` (counts per status, used by the tab's stats row).
- `createSalesOrder(input: Omit<SalesOrder, 'id' | 'status' | 'createdAt'>): SalesOrder` — generates id via the same padded-prefix pattern as `nextSequentialId` (private helper in `app/data/index.ts`); uses prefix `'SLO-'` (`'SO-'` is already taken by `ServiceOrder`, confirmed at `app/data/index.ts:3568`), defaults `status: 'draft'`.
- `updateSalesOrderStatus(id, status): SalesOrder | undefined` — the only mutator the detail page needs; simple `Object.assign`, no gate logic (unlike Project Order's milestone gates — intentionally, per Non-Goals).

### 4. UI — `app/pages/project-orders/index.vue`

- New local `activeTab = ref<'project-orders' | 'sales-orders'>('project-orders')`, rendered as two pill buttons above the stats row, visually matching the existing step-filter pill buttons already on this page (`px-3 py-1.5 text-xs font-medium rounded-lg border`, active state `border-primary bg-primary/10 text-primary`) — same component language, no new visual pattern introduced.
- Everything currently on the page (stats row, search/filters, step-filter pills, table) becomes the **"Project Orders"** tab body — unchanged markup, just wrapped in `v-if="activeTab === 'project-orders'"`.
- **"Sales Orders"** tab body (`v-else`): its own stats row (Total Sales Order / Draft / Dibayar / Selesai, from `getSalesOrdersSummary()`), its own search input (customer name/destination), its own table (Customer, Destinasi, Tanggal, Traveler, Harga, Status) reading `SALES_ORDERS`. Row click → `/sales-orders/[id]`.
- Page title/breadcrumb ("Project") and the `canView('operations')` gate stay exactly as they are now — both tabs sit inside the same already-renamed page.

### 5. UI — `app/pages/sales-orders/[id]/index.vue` (new file)

Thin detail page, structurally modeled after `app/pages/vendors/[id]/index.vue` (tab-free single view, not the heavy multi-tab Project Order detail page): `PageHeader` with breadcrumb back to `/project-orders`, a `DetailMetadataList`-style summary (customer, destination, dates, traveler count, price), a `StatusBadge` + a small status-transition control (buttons for the next valid status per the linear flow, plus a "Batalkan" action gated the same way), and nothing else — no documents, no invoices, no milestones.

### 6. Create dialog

A single `Dialog` on the "Sales Orders" tab (`+ Buat Sales Order` button, gated `canManage('operations')` — same capability the page's existing "Project Orders" actions already use), modeled after the lightweight `CreditDebitNotesPanel.vue` create-dialog pattern (local `ref()`s, `resetForm()`, `submit()` calling `createSalesOrder` + `showToast`) — not the multi-step Project Order creation flow. Fields: nama customer (text — creates a new individual `Party` on submit), destinasi, tanggal berangkat/pulang, jumlah traveler, harga (Rp), catatan (optional).

### 7. Permissions

Reuses the page's existing `canView('operations')` / `canManage('operations')` gates as-is — no new module/capability key introduced in this iteration (see Non-Goals). This was a judgment call: the `sales` module's own description already mentions "sales order," which would be the more semantically precise gate, but the user asked for this to live on the Operations & Scheduling page specifically, so viewing/managing it follows that page's existing permission, consistent with how Project Order tracking already works there (created by Sales, fulfilled/tracked by Operations).

## Error Handling / Edge Cases

- `createSalesOrder` requires `destination`, valid `travelStartDate <= travelEndDate`, `travelerCount > 0`, and `priceIdr > 0` — submit is blocked (not silently dropped) if any are missing/invalid, same validation discipline as the existing Debit Note dialog.
- Status transitions are strictly linear (`draft → paid → ongoing → done`) plus `cancelled` from any non-terminal status — no skipping steps, no reopening `done`/`cancelled`.
- Empty state ("Belum ada Sales Order") on the Sales Orders tab, matching the existing `EmptyState` pattern already used elsewhere on this page.

## Testing / Verification

No automated test suite covers this page currently. Manual verification:
1. Open `/project-orders` — confirm "Project Orders" tab still renders exactly as before (stats, filters, table, row-click) with zero visual/behavioral change.
2. Switch to "Sales Orders" tab — confirm stats row and table swap to the new dataset.
3. Click "+ Buat Sales Order", submit a new order — confirm it appears in the table with status "Draft" and the new individual customer is created.
4. Open a Sales Order's detail page, advance its status through the linear flow to "Selesai" — confirm the badge updates and out-of-order transitions aren't offered.
5. Cancel a `draft`/`paid`/`ongoing` order — confirm it reaches `cancelled` and no further transitions are offered.
6. Confirm a role without `operations` view access sees the same `RoleAccessState` block the page already shows today (unaffected by this change).
