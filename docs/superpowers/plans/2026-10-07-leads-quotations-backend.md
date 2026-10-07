# Lead, quotation client & Won lewat API (S6a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead B2B (CRUD, aktivitas/follow-up, qualify dengan customer server, merge duplikat), quotation client dengan riwayat per versi + approval, dan "Mark as Won" berjalan lewat server; UI sales dialihkan ke server.

**Architecture:** Migrasi 0024 (`leads`, `lead_activities`, `quotations`, `quotation_versions`, FK `projects` NOT VALID). Modul baru `backend/src/modules/sales/` (rules, repository, lead-writes, quotation-writes, won, routes) didaftarkan di `app.ts`. Won memanggil `createProject` S3a dalam satu transaksi. Frontend: namespace `api.sales`, `data/leads-sync.ts` (muat + tulis, server menang), lima file UI dialihkan, guard `no-local-sales.test.ts`.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (`backend/`), Nuxt 4 + Vue 3 + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-07-leads-quotations-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; jangan campur, jangan tambah lockfile.
- Uang = `bigint` minor di SQL, string (`…Minor`) di wire; frontend `…Idr` number.
- Pola tulis S0: `auth.requireCapability` → validasi `errors.validation` (400, Indonesia) / `rule()` 422 → perubahan + `recordAudit` satu transaksi → respons = bentuk GET. Create pakai `withIdempotency` + `requireIdempotencyKey`.
- ID dari `nextId(q, prefix)`; seed memanggil `syncIdSequences`.
- Hak akses: tulis lead/quotation `sales.manage-lead`; approve/reject `sales.approve-quotation`; Won `sales.mark-won`; aktivitas `crm.manage-follow-up`. Baca: peran internal (admin, finance, super-admin); client/vendor 403.
- Parameter JSON ke SQL: `$n::text::jsonb` + `JSON.stringify`.
- Perubahan bentuk API → update `frontend/app/types/api.ts` + `lib/api/endpoints.ts` di perubahan yang sama.
- File CRLF: Edit tool, atau `tr -d '\r'` → ubah → `perl -pe 's/\n$/\r\n/'`.
- Test backend: `bun run test`; filter `bun test --timeout 30000 test/<file> -t "<nama>"`. Bun `toMatchObject` menimpa field yang dicocokkan → ambil id dulu. Hindari apostrof di nama test.
- Frontend: vue-tsc `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` total ≤ 2000 (baseline 1980); lint error per file tidak bertambah vs HEAD; tanpa `void`; API palsu di test pakai `Promise.resolve/reject`.
- Commit tiap task, jangan push. Jangan dua `pnpm build` bersamaan.

## Rulings dari spec (saat menulis plan)

1. **Tanggal**: lead/aktivitas/quotation memakai kolom `date` (`created_on`, `last_updated_on`, `qualified_on`, `activity_date`, `due_on`, `done_on`, `sent_to_client_on`, versi `created_on`) — fixture & UI memakai tanggal, bukan jam. `created_at/updated_at timestamptz` tetap ada untuk audit teknis.
2. **Gate qualify** sama dengan `getLeadMissingQualification` untuk semua kategori; AE hanya wajib bila kategori ≠ `individual-travel` (spec bilang B2C "status + customer saja" — gate field tetap berlaku karena frontend memakai fungsi yang sama untuk keduanya).
3. **B2C `projectId` / `salesOrderId`**: banyak lead Group Trip menunjuk project yang sama (PRJ-205), jadi tidak bisa lewat `projects.lead_id`. Disimpan di `b2c` JSON (`b2c.projectId`, `b2c.salesOrderId`) apa adanya sampai S6b. Frontend hanya menulis field kualifikasi B2C ke server; SO lokal tetap lokal.
4. **Catatan otomatis**: qualify, submit/approve/reject menulis catatan seperti mutator lokal sekarang — `lead_activities` (qualify: "Lead Qualified", "Lead Assigned to Account Executive (…)") dan `party_activities` (lewat `createActivity` S1) bila lead punya customer.
5. **Revisi dari draft**: `POST /quotations/:id/revise` pada versi `draft` → 422 (spec). Frontend `reviseQuotationOnServer` mengirim PATCH bila versi terbaru masih draft (perilaku lokal "ubah nilai").
6. **Won** mengunci baris lead (`for update`) sebelum cek project — klik kedua menunggu lalu melihat project yang sudah ada. Respons `{ project, lead }`.
7. **Unqualify** butuh alasan: dialog UI mewajibkan catatan; Group Trip "not-qualified" mengirim catatan pengguna atau `'Hasil qualification Group Trip: tidak memenuhi syarat.'`.

## Review Focus

1. Qualify lead yang customer bernama sama sudah ada (beda huruf besar/kecil) → customer itu dipakai, tidak membuat customer kembar.
2. Revisi quotation yang sudah approved setelah Won → project tetap dengan nilai kontrak lama; versi baru `draft`; versi lama `superseded` dan isinya tidak berubah.
3. PATCH lead yang sudah Won atau diarsip → 422, tidak ada perubahan.
4. Approve oleh orang yang sama dengan pengaju → 200, audit `selfApproved: true`; oleh orang lain → `selfApproved: false`.
5. Seed ulang setelah pengguna merevisi QUO-010 → versi 2 milik pengguna tetap ada, status versi 1 tidak dikembalikan.

Tes: (1) Task 4, (2)(4) Task 5/6, (3) Task 3, (5) Task 7.

---

### Task 1: Migrasi 0024 + prefix ID

**Files:**
- Create: `backend/migrations/0024_leads_quotations.up.sql`, `.down.sql`
- Modify: `backend/src/shared/ids.ts`
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces: tabel `leads`, `lead_activities`, `quotations`, `quotation_versions`; `IdPrefix` + `'LED-' | 'LACT-' | 'QUO-'`.

- [ ] **Step 1: Test gagal** (describe `demo seed` di `db.test.ts`):

```ts
  test('leads and quotation versions exist after 0024', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into leads (id, name, source, owner_user_id) values ('LED-T1', 'Uji', 'website', 'USR-001')")
      await expect(db.query("insert into leads (id, name, source, owner_user_id) values ('LED-T2', 'Uji', 'fax', 'USR-001')")).rejects.toThrow()
      await expect(db.query("insert into leads (id, name, source, owner_user_id, travel_start_date, travel_end_date) values ('LED-T3', 'Uji', 'website', 'USR-001', '2026-10-05', '2026-10-01')")).rejects.toThrow()
      await db.query("insert into quotations (id, lead_id) values ('QUO-T1', 'LED-T1')")
      await expect(db.query("insert into quotations (id, lead_id) values ('QUO-T2', 'LED-T1')")).rejects.toThrow() // one per lead
      await db.query("insert into quotation_versions (quotation_id, version, amount_minor) values ('QUO-T1', 1, 1000)")
      await expect(db.query("insert into quotation_versions (quotation_id, version, amount_minor) values ('QUO-T1', 2, 0)")).rejects.toThrow()
      await expect(db.query("insert into quotation_versions (quotation_id, version, amount_minor, status) values ('QUO-T1', 3, 10, 'won')")).rejects.toThrow()
      await db.query("insert into lead_activities (id, lead_id, type, message, owner_user_id) values ('LACT-T1', 'LED-T1', 'call', 'Halo', 'USR-001')")
      // New projects are checked against leads; old rows are not (NOT VALID).
      await expect(db.query("update projects set lead_id = 'LED-NOPE' where id = 'PRJ-101'")).rejects.toThrow()
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('LED-','LACT-','QUO-') order by prefix")
      expect(seqs.map(s => s.prefix)).toEqual(['LACT-', 'LED-', 'QUO-'])
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `bun test --timeout 30000 test/db.test.ts -t "0024"` → FAIL (tabel `leads` tidak ada).

- [ ] **Step 3: up.sql**

```sql
-- S6a: leads, lead activities and client quotations with full content per version (API-owned).
create table leads (
  id                   text primary key check (id <> ''),
  name                 text not null check (name <> ''),
  company_name         text,
  title                text,
  source               text not null check (source in ('website', 'instagram', 'tiktok', 'whatsapp', 'referral', 'event', 'email', 'sales-outreach', 'client-portal', 'other')),
  stage                text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'unqualified')),
  owner_user_id        text not null references users (id),
  handed_over_to       text references users (id),
  phone                text,
  email                text,
  qualification_notes  text,
  expected_close_date  date,
  created_on           date not null default current_date,
  last_updated_on      date not null default current_date,
  archived             boolean not null default false,
  archive_reason       text,
  party_id             text references parties (id),
  qualified_on         date,
  unqualified_reason   text,
  merged_into          text references leads (id),
  service_category     text check (service_category in ('corporate-travel', 'group-travel', 'individual-travel', 'mice-event')),
  destination          text,
  travel_start_date    date,
  travel_end_date      date,
  traveler_estimate    integer check (traveler_estimate is null or traveler_estimate > 0),
  service_scope        jsonb not null default '[]'::jsonb check (jsonb_typeof(service_scope) = 'array'),
  requirement_summary  text,
  budget_range         text,
  date_flexible        boolean,
  decision_maker       text,
  urgency              text check (urgency in ('low', 'medium', 'high')),
  special_request_note text,
  b2c                  jsonb not null default '{}'::jsonb check (jsonb_typeof(b2c) = 'object'),
  provenance           text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date)
);
create index leads_stage on leads (stage);
create index leads_party on leads (party_id) where party_id is not null;

create table lead_activities (
  id            text primary key check (id <> ''),
  lead_id       text not null references leads (id),
  type          text not null check (type in ('call', 'meeting', 'email', 'note', 'follow-up')),
  message       text not null check (message <> ''),
  owner_user_id text not null references users (id),
  activity_date date not null default current_date,
  due_on        date,
  done_on       date,
  provenance    text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at    timestamptz not null default now()
);
create index lead_activities_lead on lead_activities (lead_id);

create table quotations (
  id                text primary key check (id <> ''),
  lead_id           text not null unique references leads (id),
  current_version   integer not null default 1 check (current_version >= 1),
  sent_to_client_on date,
  created_on        date not null default current_date,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table quotation_versions (
  quotation_id            text not null references quotations (id),
  version                 integer not null check (version >= 1),
  amount_minor            bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  discount_minor          bigint check (discount_minor is null or (discount_minor >= 0 and discount_minor <= 1000000000000000)),
  tax_minor               bigint check (tax_minor is null or (tax_minor >= 0 and tax_minor <= 1000000000000000)),
  markup_minor            bigint check (markup_minor is null or (markup_minor >= 0 and markup_minor <= 1000000000000000)),
  estimated_cost_minor    bigint check (estimated_cost_minor is null or (estimated_cost_minor >= 0 and estimated_cost_minor <= 1000000000000000)),
  estimated_margin_minor  bigint check (estimated_margin_minor is null or abs(estimated_margin_minor) <= 1000000000000000),
  currency                text not null default 'IDR',
  payment_terms           text,
  valid_until             date,
  terms_and_conditions    text,
  inclusions              text,
  exclusions              text,
  cancellation_policy     text,
  proposed_itinerary_note text,
  cost_sheet_id           text,
  service_breakdown       jsonb not null default '[]'::jsonb check (jsonb_typeof(service_breakdown) = 'array'),
  status                  text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'superseded')),
  submitted_by            text references users (id),
  submitted_at            timestamptz,
  decided_by              text references users (id),
  decided_at              timestamptz,
  decision_note           text,
  created_by              text references users (id),
  created_on              date not null default current_date,
  updated_at              timestamptz not null default now(),
  primary key (quotation_id, version)
);

-- Old staging rows may point at leads that only arrive with the S6a seed: checked for new rows only.
alter table projects add constraint projects_lead_fk foreign key (lead_id) references leads (id) not valid;
alter table projects add constraint projects_source_quotation_fk foreign key (source_quotation_id) references quotations (id) not valid;

insert into id_sequences (prefix, last_value) values ('LED-', 0), ('LACT-', 0), ('QUO-', 0) on conflict (prefix) do nothing;
```

down.sql:

```sql
delete from id_sequences where prefix in ('LED-', 'LACT-', 'QUO-');
alter table projects drop constraint if exists projects_source_quotation_fk;
alter table projects drop constraint if exists projects_lead_fk;
drop table if exists quotation_versions;
drop table if exists quotations;
drop table if exists lead_activities;
drop table if exists leads;
```

- [ ] **Step 4: ids.ts** — `IdPrefix` tambah `'LED-' | 'LACT-' | 'QUO-'`; `SOURCES` tambah `'LED-': { table: 'leads' }, 'LACT-': { table: 'lead_activities' }, 'QUO-': { table: 'quotations' }`.
- [ ] **Step 5:** test → PASS (baris `update projects set lead_id = 'LED-NOPE'` gagal karena FK dicek untuk baris yang diubah); `bun run typecheck` bersih.
- [ ] **Step 6:** Commit `feat(sales): migrasi 0024 lead, aktivitas & quotation per versi (S6a)`.

---

### Task 2: Modul sales — aturan, repository, GET

**Files:**
- Create: `backend/src/modules/sales/lead-rules.ts`, `backend/src/modules/sales/repository.ts`, `backend/src/modules/sales/routes.ts`
- Modify: `backend/src/app.ts` (`.use(salesRoutes(deps, auth))` setelah `coreRoutes`)
- Test: `backend/test/leads-quotations.test.ts` (baru)

**Interfaces:**
- Produces:
  - `lead-rules.ts`: `LEAD_SOURCES`, `LEAD_STAGES`, `SERVICE_CATEGORIES`, `URGENCIES` (readonly tuples); `missingQualification(lead: LeadRow): string[]`; `type LeadRow` (baris `leads` mentah).
  - `repository.ts`: `listLeads(db: Queryable, filter?: { id?: string }): Promise<LeadView[]>`, `listSalesQuotations(db: Queryable, filter?: { id?: string; leadId?: string }): Promise<QuotationView[]>`, `wonProjectId(q: Queryable, leadId: string): Promise<string | null>`.
  - `routes.ts`: `salesRoutes(deps, auth)`; helper internal `readActor(request)` (403 untuk portal).
  - Bentuk wire `LeadView`:
    `{ id, name, companyName, title, source, stage, ownerUserId, handedOverTo, phone, email, qualificationNotes, expectedCloseDate, createdOn, lastUpdatedOn, archived, archiveReason, partyId, qualifiedOn, unqualifiedReason, mergedInto, serviceCategory, destination, travelStartDate, travelEndDate, travelerEstimate, serviceScope: string[], requirementSummary, budgetRange, dateFlexible, decisionMaker, urgency, specialRequestNote, b2c: Record<string, unknown>, wonProjectId, quotationId, activities: { id, leadId, type, message, ownerUserId, activityDate, dueOn, doneOn }[] }` (nilai kosong = `null`).
  - Bentuk wire `QuotationView`:
    `{ id, leadId, currentVersion, status, sentToClientOn, createdOn, amountMinor, discountMinor, taxMinor, markupMinor, estimatedCostMinor, estimatedMarginMinor, currency, paymentTerms, validUntil, termsAndConditions, inclusions, exclusions, cancellationPolicy, proposedItineraryNote, costSheetId, serviceBreakdown: { service, description?, amountMinor }[], submittedBy, submittedAt, decidedBy, decidedAt, decisionNote, versions: { version, status, amountMinor, createdOn, submittedBy, decidedBy, decidedAt, decisionNote }[] }` — field isi dari versi `current_version`.

- [ ] **Step 1: Test gagal** — `backend/test/leads-quotations.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S6a: leads, client quotations and Won through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s6a-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('lead reads', () => {
  test('internal roles read leads with activities and won project; portals 403; anonymous 401; unknown 404', async () => {
    const list = await call('GET', '/leads', 'finance')
    expect(list.status).toBe(200)
    const won = (list.json.data as { id: string; wonProjectId: string | null; quotationId: string | null; activities: unknown[] }[]).find(l => l.id === 'LED-009')!
    expect(won.wonProjectId).toBe('PRJ-101')
    expect(won.quotationId).toBe('QUO-001')
    const one = (await call('GET', '/leads/LED-001', 'admin')).json.data
    expect(one.activities.length).toBeGreaterThanOrEqual(3)
    expect(one.serviceScope).toEqual(['mice', 'hotel', 'transportation'])
    expect((await call('GET', '/leads', 'client')).status).toBe(403)
    expect((await call('GET', '/leads', 'vendor')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/leads')).status).toBe(401)
    expect((await call('GET', '/leads/LED-999', 'admin')).status).toBe(404)
  })

  test('quotations show the current version and the version history', async () => {
    const q = (await call('GET', '/quotations/QUO-005', 'admin')).json.data
    expect(q).toMatchObject({ currentVersion: 2, status: 'submitted', amountMinor: '180000000' })
    expect(q.versions.map((v: { version: number; status: string; amountMinor: string }) => `${v.version}:${v.status}:${v.amountMinor}`)).toEqual(['1:superseded:150000000', '2:submitted:180000000'])
    expect((await call('GET', '/quotations?leadId=LED-020', 'finance')).json.data[0].serviceBreakdown).toHaveLength(2)
    expect((await call('GET', '/quotations', 'client')).status).toBe(403)
  })
})
```

Test ini membutuhkan seed lead/quotation (Task 7). Sampai Task 7, `describe('lead reads')` ditandai `describe.skip` dan Task 2 memakai test sementara di bawah ini (dihapus di Task 7, saat skip dicabut):

```ts
describe('lead reads (empty)', () => {
  test('lists answer for internal roles, 403 for portals, 401 anonymous, 404 unknown', async () => {
    expect((await call('GET', '/leads', 'finance')).status).toBe(200)
    expect((await call('GET', '/quotations', 'admin')).status).toBe(200)
    expect((await call('GET', '/leads', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/leads')).status).toBe(401)
    expect((await call('GET', '/leads/LED-999', 'admin')).status).toBe(404)
    expect((await call('GET', '/quotations/QUO-999', 'admin')).status).toBe(404)
  })
})
```

- [ ] **Step 2:** `bun test --timeout 30000 test/leads-quotations.test.ts` → FAIL (404 route tidak ada).

- [ ] **Step 3: `lead-rules.ts`**

```ts
/** Lead vocabulary and the qualification gate (S6a) — the same fields the frontend form requires. */

export const LEAD_SOURCES = ['website', 'instagram', 'tiktok', 'whatsapp', 'referral', 'event', 'email', 'sales-outreach', 'client-portal', 'other'] as const
export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'unqualified'] as const
export const SERVICE_CATEGORIES = ['corporate-travel', 'group-travel', 'individual-travel', 'mice-event'] as const
export const URGENCIES = ['low', 'medium', 'high'] as const

export interface LeadRow {
  id: string
  name: string
  company_name: string | null
  stage: string
  owner_user_id: string
  handed_over_to: string | null
  archived: boolean
  party_id: string | null
  service_category: string | null
  destination: string | null
  travel_start_date: string | null
  travel_end_date: string | null
  traveler_estimate: number | null
  service_scope: string[]
  requirement_summary: string | null
  title: string | null
}

/** Missing qualification fields, in the form's words. Individual travel (B2C) assigns no Account Executive here. */
export function missingQualification(lead: LeadRow): string[] {
  const missing: string[] = []
  if (!lead.service_category) missing.push('Jenis kebutuhan')
  if (!lead.destination) missing.push('Destinasi belum diisi')
  if (!lead.travel_start_date || !lead.travel_end_date) missing.push('Periode perjalanan belum diisi')
  if (!lead.traveler_estimate) missing.push('Estimasi traveler belum diisi')
  if (!lead.service_scope?.length) missing.push('Service scope belum dipilih')
  if (lead.service_category !== 'individual-travel' && !lead.handed_over_to) missing.push('Account Executive belum dipilih')
  if (!lead.requirement_summary) missing.push('Ringkasan kebutuhan belum diisi')
  return missing
}

/** `select` list for a `LeadRow` with dates as `YYYY-MM-DD`. */
export const LEAD_ROW_SQL = `id, name, company_name, title, stage, owner_user_id, handed_over_to, archived, party_id, service_category, destination,
  travel_start_date::text as travel_start_date, travel_end_date::text as travel_end_date, traveler_estimate, service_scope, requirement_summary`
```

- [ ] **Step 4: `repository.ts`**

```ts
import type { Queryable } from '../../db/client'

/** Reads for the sales module (S6a). Leads are internal: the routes refuse portals before calling these. */

export async function wonProjectId(q: Queryable, leadId: string): Promise<string | null> {
  const [p] = await q.query<{ id: string }>('select id from projects where lead_id = $1', [leadId])
  return p?.id ?? null
}

export async function listLeads(db: Queryable, filter: { id?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select l.id, l.name, l.company_name, l.title, l.source, l.stage, l.owner_user_id, l.handed_over_to, l.phone, l.email,
            l.qualification_notes, l.expected_close_date::text as expected_close_date, l.created_on::text as created_on,
            l.last_updated_on::text as last_updated_on, l.archived, l.archive_reason, l.party_id, l.qualified_on::text as qualified_on,
            l.unqualified_reason, l.merged_into, l.service_category, l.destination, l.travel_start_date::text as travel_start_date,
            l.travel_end_date::text as travel_end_date, l.traveler_estimate, l.service_scope, l.requirement_summary, l.budget_range,
            l.date_flexible, l.decision_maker, l.urgency, l.special_request_note, l.b2c,
            (select p.id from projects p where p.lead_id = l.id) as won_project_id,
            (select qq.id from quotations qq where qq.lead_id = l.id) as quotation_id
       from leads l where ($1::text is null or l.id = $1) order by l.id`,
    [filter.id ?? null]
  )
  const acts = await db.query<{ id: string; lead_id: string; type: string; message: string; owner_user_id: string; activity_date: string; due_on: string | null; done_on: string | null }>(
    `select id, lead_id, type, message, owner_user_id, activity_date::text as activity_date, due_on::text as due_on, done_on::text as done_on
       from lead_activities where ($1::text is null or lead_id = $1) order by activity_date, id`,
    [filter.id ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    companyName: r.company_name ?? null,
    title: r.title ?? null,
    source: r.source,
    stage: r.stage,
    ownerUserId: r.owner_user_id,
    handedOverTo: r.handed_over_to ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    qualificationNotes: r.qualification_notes ?? null,
    expectedCloseDate: r.expected_close_date ?? null,
    createdOn: r.created_on,
    lastUpdatedOn: r.last_updated_on,
    archived: r.archived,
    archiveReason: r.archive_reason ?? null,
    partyId: r.party_id ?? null,
    qualifiedOn: r.qualified_on ?? null,
    unqualifiedReason: r.unqualified_reason ?? null,
    mergedInto: r.merged_into ?? null,
    serviceCategory: r.service_category ?? null,
    destination: r.destination ?? null,
    travelStartDate: r.travel_start_date ?? null,
    travelEndDate: r.travel_end_date ?? null,
    travelerEstimate: r.traveler_estimate ?? null,
    serviceScope: (r.service_scope ?? []) as string[],
    requirementSummary: r.requirement_summary ?? null,
    budgetRange: r.budget_range ?? null,
    dateFlexible: r.date_flexible ?? null,
    decisionMaker: r.decision_maker ?? null,
    urgency: r.urgency ?? null,
    specialRequestNote: r.special_request_note ?? null,
    b2c: (r.b2c ?? {}) as Record<string, unknown>,
    wonProjectId: r.won_project_id ?? null,
    quotationId: r.quotation_id ?? null,
    activities: acts.filter(a => a.lead_id === r.id).map(a => ({
      id: a.id, leadId: a.lead_id, type: a.type, message: a.message, ownerUserId: a.owner_user_id,
      activityDate: a.activity_date, dueOn: a.due_on, doneOn: a.done_on
    }))
  }))
}

export type LeadView = Awaited<ReturnType<typeof listLeads>>[number]

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

export async function listSalesQuotations(db: Queryable, filter: { id?: string; leadId?: string } = {}) {
  const heads = await db.query<{ id: string; lead_id: string; current_version: number; sent_to_client_on: string | null; created_on: string }>(
    `select id, lead_id, current_version, sent_to_client_on::text as sent_to_client_on, created_on::text as created_on from quotations
      where ($1::text is null or id = $1) and ($2::text is null or lead_id = $2) order by id`,
    [filter.id ?? null, filter.leadId ?? null]
  )
  if (!heads.length) return []
  const versions = await db.query<Record<string, unknown>>(
    `select v.*, v.valid_until::text as valid_until_text, v.created_on::text as created_on_text from quotation_versions v
      where v.quotation_id in (select jsonb_array_elements_text($1::text::jsonb)) order by v.quotation_id, v.version`,
    [JSON.stringify(heads.map(h => h.id))]
  )
  return heads.map(h => {
    const own = versions.filter(v => v.quotation_id === h.id)
    const cur = own.find(v => Number(v.version) === h.current_version)!
    return {
      id: h.id,
      leadId: h.lead_id,
      currentVersion: h.current_version,
      status: cur.status as string,
      sentToClientOn: h.sent_to_client_on,
      createdOn: h.created_on,
      amountMinor: String(cur.amount_minor),
      discountMinor: str(cur.discount_minor),
      taxMinor: str(cur.tax_minor),
      markupMinor: str(cur.markup_minor),
      estimatedCostMinor: str(cur.estimated_cost_minor),
      estimatedMarginMinor: str(cur.estimated_margin_minor),
      currency: cur.currency as string,
      paymentTerms: str(cur.payment_terms),
      validUntil: str(cur.valid_until_text),
      termsAndConditions: str(cur.terms_and_conditions),
      inclusions: str(cur.inclusions),
      exclusions: str(cur.exclusions),
      cancellationPolicy: str(cur.cancellation_policy),
      proposedItineraryNote: str(cur.proposed_itinerary_note),
      costSheetId: str(cur.cost_sheet_id),
      serviceBreakdown: cur.service_breakdown as { service: string; description?: string; amountMinor: string }[],
      submittedBy: str(cur.submitted_by),
      submittedAt: cur.submitted_at ? new Date(cur.submitted_at as string).toISOString() : null,
      decidedBy: str(cur.decided_by),
      decidedAt: cur.decided_at ? new Date(cur.decided_at as string).toISOString() : null,
      decisionNote: str(cur.decision_note),
      versions: own.map(v => ({
        version: Number(v.version), status: v.status as string, amountMinor: String(v.amount_minor), createdOn: v.created_on_text as string,
        submittedBy: str(v.submitted_by), decidedBy: str(v.decided_by),
        decidedAt: v.decided_at ? new Date(v.decided_at as string).toISOString() : null, decisionNote: str(v.decision_note)
      }))
    }
  })
}

export type QuotationView = Awaited<ReturnType<typeof listSalesQuotations>>[number]
```

- [ ] **Step 5: `routes.ts`** (GET saja; tulis ditambah di task berikut)

```ts
import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok } from '../../http/envelope'
import { errors } from '../../http/errors'
import { isPortalActor } from '../core/scope'
import { listLeads, listSalesQuotations } from './repository'

/** Sales (S6a): leads, client quotations and Won. Internal roles read; Sales (admin) writes; portals never see leads. */
export function salesRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function readActor(request: Request): Promise<SessionActor> {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }

  async function leadResponse(id: string) {
    const [lead] = await listLeads(db, { id })
    if (!lead) throw errors.notFound('Lead')
    return lead
  }

  async function quotationResponse(id: string) {
    const [q] = await listSalesQuotations(db, { id })
    if (!q) throw errors.notFound('Quotation')
    return q
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/leads', async ({ request }) => {
      await readActor(request)
      return ok(request, await listLeads(db))
    })
    .get('/leads/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await leadResponse(assertIdParam(params.id, 'Lead')))
    })
    .get('/quotations', async ({ request, query }) => {
      await readActor(request)
      if (query.leadId && !ID_PATTERN.test(query.leadId)) throw errors.validation({ leadId: ['ID tidak valid.'] })
      return ok(request, await listSalesQuotations(db, { leadId: query.leadId }))
    }, { query: t.Object({ leadId: t.Optional(t.String()) }) })
    .get('/quotations/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await quotationResponse(assertIdParam(params.id, 'Quotation')))
    })
}
```

`isPortalActor` (`core/scope.ts`) = peran berjenis portal (client, vendor).

- [ ] **Step 6:** `app.ts`: `import { salesRoutes } from './modules/sales/routes'` dan `.use(salesRoutes(deps, auth))` setelah `.use(coreRoutes(deps, auth))`.
- [ ] **Step 7:** test (`lead reads (empty)`) → PASS; `bun run typecheck` bersih.
- [ ] **Step 8:** Commit `feat(sales): modul sales — baca lead & quotation (S6a)`.

---

### Task 3: Lead — buat, ubah, arsip/buka, unqualify, merge, aktivitas

**Files:**
- Create: `backend/src/modules/sales/lead-writes.ts`
- Modify: `backend/src/modules/sales/routes.ts`
- Test: `backend/test/leads-quotations.test.ts`

**Interfaces:**
- Consumes: `LEAD_SOURCES`, `LEAD_STAGES`, `SERVICE_CATEGORIES`, `URGENCIES`, `wonProjectId`.
- Produces (`lead-writes.ts`):
  - `createLead(tx, actor, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }>`
  - `updateLead(tx, actor, id, input, today, requestId): Promise<void>`
  - `archiveLead(tx, actor, id, reason: unknown, today, requestId)`, `reopenLead(tx, actor, id, today, requestId)`
  - `unqualifyLead(tx, actor, id, reason: unknown, today, requestId)`
  - `mergeLead(tx, actor, id, intoLeadId: unknown, today, requestId)`
  - `addLeadActivity(tx, actor, leadId, input, today, requestId): Promise<{ id: string }>`, `completeLeadActivity(tx, actor, leadId, activityId, today, requestId)`
  - `insertLeadActivity(tx, leadId, type, message, ownerUserId, today): Promise<string>` (dipakai Task 4–6)
  - `lockLead(tx, id): Promise<LeadRow & { archived: boolean }>` (404 bila tidak ada) dan `touchLead(tx, id, today)`.
- Routes: `POST /leads`, `PATCH /leads/:id`, `POST /leads/:id/{archive,reopen,unqualify,merge}`, `POST /leads/:id/activities`, `POST /leads/:id/activities/:activityId/done`. Semua menjawab `LeadView`.

- [ ] **Step 1: Test gagal** (tambah ke file test):

```ts
describe('lead writes', () => {
  test('create is idempotent, validates, and needs sales.manage-lead', async () => {
    const k = key()
    const body = { name: 'PT Uji Coba', companyName: 'PT Uji Coba', source: 'website', phone: '0811-1', serviceScope: ['flight'] }
    const first = await call('POST', '/leads', 'admin', body, k)
    expect(first.status).toBe(201)
    expect(first.json.data).toMatchObject({ stage: 'new', archived: false, serviceScope: ['flight'] })
    const again = await call('POST', '/leads', 'admin', body, k)
    expect(again.json.data.id).toBe(first.json.data.id)
    expect((await call('POST', '/leads', 'admin', { name: '', source: 'fax' }, key())).status).toBe(400)
    expect((await call('POST', '/leads', 'admin', body)).status).toBe(400) // Idempotency-Key required
    expect((await call('POST', '/leads', 'finance', body, key())).status).toBe(403)
  })

  test('patch edits requirements, stage new to contacted only; won or archived leads refuse with 422', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Lead Patch', source: 'email' }, key())).json.data.id as string
    const patched = await call('PATCH', `/leads/${id}`, 'admin', { destination: 'Bali', travelStartDate: '2026-12-01', travelEndDate: '2026-12-03', stage: 'contacted', b2c: { b2cAdultCount: 2 } })
    expect(patched.json.data).toMatchObject({ destination: 'Bali', stage: 'contacted', b2c: { b2cAdultCount: 2 } })
    expect((await call('PATCH', `/leads/${id}`, 'admin', { stage: 'qualified' })).status).toBe(400)
    expect((await call('PATCH', `/leads/${id}`, 'admin', { partyId: 'PTY-001' })).status).toBe(400)
    expect((await call('PATCH', `/leads/${id}`, 'admin', { travelStartDate: '2026-12-09' })).status).toBe(400) // after end
    expect((await call('PATCH', '/leads/LED-009', 'admin', { destination: 'X' })).status).toBe(422) // won
    expect((await call('POST', `/leads/${id}/archive`, 'admin', { reason: 'Tidak responsif' })).json.data.archived).toBe(true)
    expect((await call('PATCH', `/leads/${id}`, 'admin', { destination: 'X' })).status).toBe(422)
    expect((await call('POST', `/leads/${id}/reopen`, 'admin')).json.data.archived).toBe(false)
    expect((await call('POST', '/leads/LED-009/archive', 'admin', {})).status).toBe(422)
  })

  test('unqualify needs a reason; merge archives the duplicate and notes both leads', async () => {
    const a = (await call('POST', '/leads', 'admin', { name: 'Dup A', source: 'whatsapp' }, key())).json.data.id as string
    const b = (await call('POST', '/leads', 'admin', { name: 'Dup B', source: 'whatsapp' }, key())).json.data.id as string
    expect((await call('POST', `/leads/${a}/unqualify`, 'admin', {})).status).toBe(400)
    const unq = (await call('POST', `/leads/${a}/unqualify`, 'admin', { reason: 'Budget tidak cocok' })).json.data
    expect(unq).toMatchObject({ stage: 'unqualified', unqualifiedReason: 'Budget tidak cocok' })
    expect((await call('POST', `/leads/${a}/merge`, 'admin', { intoLeadId: a })).status).toBe(422)
    const merged = (await call('POST', `/leads/${a}/merge`, 'admin', { intoLeadId: b })).json.data
    expect(merged).toMatchObject({ archived: true, mergedInto: b })
    expect(merged.activities.at(-1).message).toContain(b)
    const target = (await call('GET', `/leads/${b}`, 'admin')).json.data
    expect(target.activities.at(-1).message).toContain(a)
    expect((await call('POST', `/leads/${b}/merge`, 'admin', { intoLeadId: a })).status).toBe(422) // target archived
  })

  test('activities and follow-ups: add, mark done; finance 403', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Lead Aktivitas', source: 'event' }, key())).json.data.id as string
    const withAct = (await call('POST', `/leads/${id}/activities`, 'admin', { type: 'follow-up', message: 'Telepon lagi', dueOn: '2026-11-01' })).json.data
    const act = withAct.activities[0]
    expect(act).toMatchObject({ type: 'follow-up', dueOn: '2026-11-01', doneOn: null })
    expect((await call('POST', `/leads/${id}/activities/${act.id}/done`, 'admin')).json.data.activities[0].doneOn).toBeTruthy()
    expect((await call('POST', `/leads/${id}/activities`, 'admin', { type: 'gossip', message: 'x' })).status).toBe(400)
    expect((await call('POST', `/leads/${id}/activities`, 'finance', { type: 'call', message: 'x' })).status).toBe(403)
  })
})
```

- [ ] **Step 2:** `bun test --timeout 30000 test/leads-quotations.test.ts -t "lead writes"` → FAIL (404).

- [ ] **Step 3: `lead-writes.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { SERVICE_TYPES } from '../core/booking-rules'
import { LEAD_ROW_SQL, LEAD_SOURCES, SERVICE_CATEGORIES, URGENCIES, type LeadRow } from './lead-rules'
import { wonProjectId } from './repository'

/**
 * Lead writes (S6a). A lead that became a project (Won) or is archived is read-only; stage moves beyond
 * new ↔ contacted only through qualify / unqualify.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'note', 'follow-up'] as const

/** API field → column, with its kind. `stage` is limited separately. */
const FIELDS: Record<string, { column: string; kind: 'text' | 'longtext' | 'date' | 'int' | 'bool' | 'user' | 'source' | 'category' | 'urgency' | 'scope' | 'b2c' }> = {
  name: { column: 'name', kind: 'text' },
  companyName: { column: 'company_name', kind: 'text' },
  title: { column: 'title', kind: 'text' },
  source: { column: 'source', kind: 'source' },
  handedOverTo: { column: 'handed_over_to', kind: 'user' },
  phone: { column: 'phone', kind: 'text' },
  email: { column: 'email', kind: 'text' },
  qualificationNotes: { column: 'qualification_notes', kind: 'longtext' },
  expectedCloseDate: { column: 'expected_close_date', kind: 'date' },
  serviceCategory: { column: 'service_category', kind: 'category' },
  destination: { column: 'destination', kind: 'text' },
  travelStartDate: { column: 'travel_start_date', kind: 'date' },
  travelEndDate: { column: 'travel_end_date', kind: 'date' },
  travelerEstimate: { column: 'traveler_estimate', kind: 'int' },
  serviceScope: { column: 'service_scope', kind: 'scope' },
  requirementSummary: { column: 'requirement_summary', kind: 'longtext' },
  budgetRange: { column: 'budget_range', kind: 'text' },
  dateFlexible: { column: 'date_flexible', kind: 'bool' },
  decisionMaker: { column: 'decision_maker', kind: 'text' },
  urgency: { column: 'urgency', kind: 'urgency' },
  specialRequestNote: { column: 'special_request_note', kind: 'longtext' },
  b2c: { column: 'b2c', kind: 'b2c' }
}

async function clean(tx: Queryable, input: Record<string, unknown>, problems: FieldErrors): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(FIELDS)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null || v === '') {
      if (field === 'name' || field === 'source') problems[field] = ['Wajib diisi.']
      else out[spec.column] = spec.kind === 'scope' ? '[]' : spec.kind === 'b2c' ? '{}' : null
      continue
    }
    switch (spec.kind) {
      case 'text':
      case 'longtext': {
        const max = spec.kind === 'text' ? 200 : 2000
        if (typeof v !== 'string' || v.trim().length > max) problems[field] = [`Harus teks, maksimal ${max} karakter.`]
        else out[spec.column] = v.trim() || null
        break
      }
      case 'date':
        if (typeof v !== 'string' || !isIsoDate(v)) problems[field] = ['Tanggal harus format YYYY-MM-DD.']
        else out[spec.column] = v
        break
      case 'int':
        if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 100_000) problems[field] = ['Minimal 1.']
        else out[spec.column] = v
        break
      case 'bool':
        if (typeof v !== 'boolean') problems[field] = ['Harus ya/tidak.']
        else out[spec.column] = v
        break
      case 'user': {
        const ok = typeof v === 'string' && ID_PATTERN.test(v) && (await tx.query("select 1 from users where id = $1 and role in ('admin', 'super-admin') and status = 'active'", [v])).length > 0
        if (!ok) problems[field] = ['Pengguna tidak ditemukan.']
        else out[spec.column] = v
        break
      }
      case 'source':
        if (!(LEAD_SOURCES as readonly unknown[]).includes(v)) problems[field] = ['Sumber lead tidak dikenal.']
        else out[spec.column] = v
        break
      case 'category':
        if (!(SERVICE_CATEGORIES as readonly unknown[]).includes(v)) problems[field] = ['Jenis kebutuhan tidak dikenal.']
        else out[spec.column] = v
        break
      case 'urgency':
        if (!(URGENCIES as readonly unknown[]).includes(v)) problems[field] = ['Urgensi tidak dikenal.']
        else out[spec.column] = v
        break
      case 'scope': {
        const scope = Array.isArray(v) ? [...new Set(v)] : null
        if (!scope || scope.some(s => !(SERVICE_TYPES as readonly unknown[]).includes(s))) problems[field] = [`Layanan harus salah satu dari: ${SERVICE_TYPES.join(', ')}.`]
        else out[spec.column] = JSON.stringify(scope)
        break
      }
      case 'b2c':
        if (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > 4000) problems[field] = ['Data B2C tidak valid.']
        else out[spec.column] = JSON.stringify(v)
        break
    }
  }
  return out
}

const JSON_COLUMNS = new Set(['service_scope', 'b2c'])
const placeholder = (column: string, i: number) => (JSON_COLUMNS.has(column) ? `$${i}::text::jsonb` : `$${i}`)

export async function lockLead(tx: Queryable, id: string): Promise<LeadRow & { merged_into: string | null }> {
  const [lead] = await tx.query<LeadRow & { merged_into: string | null }>(`select ${LEAD_ROW_SQL}, merged_into from leads where id = $1 for update`, [id])
  if (!lead) throw errors.notFound('Lead')
  return lead
}

export async function touchLead(tx: Queryable, id: string, today: string) {
  await tx.query('update leads set last_updated_on = $2, updated_at = now() where id = $1', [id, today])
}

async function assertOpen(tx: Queryable, lead: LeadRow, what: string) {
  const won = await wonProjectId(tx, lead.id)
  if (won) throw rule(`Lead ini sudah menjadi project ${won} — tidak bisa ${what}.`)
  if (lead.archived) throw rule(`Lead ini diarsip — buka kembali sebelum ${what}.`)
}

export async function insertLeadActivity(tx: Queryable, leadId: string, type: string, message: string, ownerUserId: string, today: string, dueOn: string | null = null): Promise<string> {
  const id = await nextId(tx, 'LACT-')
  await tx.query('insert into lead_activities (id, lead_id, type, message, owner_user_id, activity_date, due_on) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, leadId, type, message, ownerUserId, today, dueOn])
  return id
}

export async function createLead(tx: Queryable, actor: Actor, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama lead wajib diisi.']
  if (input.source === undefined) problems.source = ['Sumber lead wajib diisi.']
  if (input.stage !== undefined && input.stage !== 'new' && input.stage !== 'contacted') problems.stage = ['Lead baru hanya bisa new atau contacted.']
  const values = await clean(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const start = values.travel_start_date as string | undefined
  const end = values.travel_end_date as string | undefined
  if (start && end && start > end) throw errors.validation({ travelEndDate: ['Tanggal selesai tidak boleh sebelum tanggal mulai.'] })

  const id = await nextId(tx, 'LED-')
  const cols = ['id', 'owner_user_id', 'stage', 'created_on', 'last_updated_on', ...Object.keys(values)]
  const vals = [id, actor.userId, input.stage ?? 'new', today, today, ...Object.values(values)]
  await tx.query(`insert into leads (${cols.join(', ')}) values (${cols.map((c, i) => placeholder(c, i + 1)).join(', ')})`, vals)
  await recordAudit(tx, { action: 'lead.created', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { name: values.name, source: values.source } })
  return { id }
}

const FORBIDDEN_PATCH = ['id', 'partyId', 'archived', 'mergedInto', 'ownerUserId', 'qualifiedOn', 'unqualifiedReason', 'archiveReason']

export async function updateLead(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, today: string, requestId: string): Promise<void> {
  const problems: FieldErrors = {}
  for (const k of FORBIDDEN_PATCH) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat edit lead.']
  if (input.stage !== undefined && input.stage !== 'new' && input.stage !== 'contacted') problems.stage = ['Stage hanya bisa diubah antara new dan contacted; pakai Qualify / Unqualify.']
  const values = await clean(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const lead = await lockLead(tx, id)
  await assertOpen(tx, lead, 'diubah')
  if (input.stage !== undefined && lead.stage !== 'new' && lead.stage !== 'contacted') throw rule('Stage lead yang sudah qualified/unqualified diubah lewat Qualify / Unqualify.')
  const start = (values.travel_start_date ?? lead.travel_start_date) as string | null
  const end = (values.travel_end_date ?? lead.travel_end_date) as string | null
  if (start && end && start > end) throw errors.validation({ travelEndDate: ['Tanggal selesai tidak boleh sebelum tanggal mulai.'] })
  if (input.stage !== undefined) values.stage = input.stage
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(
    `update leads set ${cols.map((c, i) => `${c} = ${placeholder(c, i + 2)}`).join(', ')}, last_updated_on = $${cols.length + 2}, updated_at = now() where id = $1`,
    [id, ...Object.values(values), today]
  )
  await recordAudit(tx, { action: 'lead.updated', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: Object.fromEntries(Object.keys(input).map(k => [k, input[k]])) })
}

function reasonOf(value: unknown, required: boolean): string | null {
  const s = typeof value === 'string' ? value.trim().slice(0, 1000) : ''
  if (!s && required) throw errors.validation({ reason: ['Alasan wajib diisi.'] })
  return s || null
}

export async function archiveLead(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, today: string, requestId: string) {
  const reason = reasonOf(reasonInput, false)
  const lead = await lockLead(tx, id)
  await assertOpen(tx, lead, 'diarsip')
  await tx.query('update leads set archived = true, archive_reason = $2, last_updated_on = $3, updated_at = now() where id = $1', [id, reason, today])
  await recordAudit(tx, { action: 'lead.archived', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, reason })
}

export async function reopenLead(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const lead = await lockLead(tx, id)
  if (!lead.archived) return
  if (lead.merged_into) throw rule(`Lead ini duplikat dari ${lead.merged_into} — buka lead itu.`)
  await tx.query('update leads set archived = false, archive_reason = null, last_updated_on = $2, updated_at = now() where id = $1', [id, today])
  await recordAudit(tx, { action: 'lead.reopened', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId })
}

export async function unqualifyLead(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, today: string, requestId: string) {
  const reason = reasonOf(reasonInput, true)!
  const lead = await lockLead(tx, id)
  await assertOpen(tx, lead, 'di-unqualify')
  await tx.query("update leads set stage = 'unqualified', unqualified_reason = $2, last_updated_on = $3, updated_at = now() where id = $1", [id, reason, today])
  await insertLeadActivity(tx, id, 'note', `Lead ditandai Unqualified. Catatan: ${reason}`, actor.userId, today)
  await recordAudit(tx, { action: 'lead.unqualified', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, reason })
}

export async function mergeLead(tx: Queryable, actor: Actor, id: string, intoInput: unknown, today: string, requestId: string) {
  if (typeof intoInput !== 'string' || !ID_PATTERN.test(intoInput)) throw errors.validation({ intoLeadId: ['Pilih lead tujuan.'] })
  if (intoInput === id) throw rule('Lead tidak bisa digabung ke dirinya sendiri.')
  const dup = await lockLead(tx, id)
  const into = await lockLead(tx, intoInput)
  await assertOpen(tx, dup, 'digabung')
  if (into.archived) throw rule('Lead tujuan diarsip — pilih lead yang aktif.')
  await tx.query('update leads set archived = true, merged_into = $2, archive_reason = $3, last_updated_on = $4, updated_at = now() where id = $1',
    [id, into.id, `Duplikat dari ${into.id}`, today])
  await insertLeadActivity(tx, id, 'note', `Ditandai sebagai duplikat, digabung ke ${into.id} (${into.name}).`, actor.userId, today)
  await insertLeadActivity(tx, into.id, 'note', `Menerima merge dari lead duplikat ${id} (${dup.name}).`, actor.userId, today)
  await touchLead(tx, into.id, today)
  await recordAudit(tx, { action: 'lead.merged', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { mergedInto: into.id } })
}

export async function addLeadActivity(tx: Queryable, actor: Actor, leadId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (!(ACTIVITY_TYPES as readonly unknown[]).includes(input.type)) problems.type = ['Jenis aktivitas tidak dikenal.']
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) problems.message = ['Isi aktivitas wajib diisi.']
  else if (message.length > 2000) problems.message = ['Maksimal 2000 karakter.']
  let dueOn: string | null = null
  if (input.dueOn !== undefined && input.dueOn !== null) {
    if (typeof input.dueOn !== 'string' || !isIsoDate(input.dueOn)) problems.dueOn = ['Tanggal harus format YYYY-MM-DD.']
    else dueOn = input.dueOn
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  await lockLead(tx, leadId)
  const id = await insertLeadActivity(tx, leadId, input.type as string, message, actor.userId, today, dueOn)
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'lead.activity_added', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId, after: { activityId: id, type: input.type, dueOn } })
  return { id }
}

export async function completeLeadActivity(tx: Queryable, actor: Actor, leadId: string, activityId: string, today: string, requestId: string) {
  const done = await tx.query<{ id: string }>('update lead_activities set done_on = coalesce(done_on, $3) where id = $1 and lead_id = $2 returning id', [activityId, leadId, today])
  if (!done.length) throw errors.notFound('Aktivitas')
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'lead.activity_done', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId, after: { activityId } })
}
```

Cek dulu: `isIsoDate` ada di `src/shared/dates.ts` (dipakai project-writes). AE = pengguna aktif berperan `admin`/`super-admin` (`users.role` ∈ super-admin, admin, finance, client, vendor sejak migrasi 0004).

- [ ] **Step 4: routes** — tambah ke `salesRoutes` (import `requestIdOf` dari envelope, `businessDateOf` dari `shared/dates`, `requireIdempotencyKey, withIdempotency` dari `shared/idempotency`, fungsi dari `./lead-writes`):

```ts
    .post('/leads', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /leads', key, body }, tx =>
        createLead(tx, actor, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await leadResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/leads/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => updateLead(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/leads/:id/:action', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      const b = (body ?? {}) as Record<string, unknown>
      const today = businessDateOf(new Date())
      const rid = requestIdOf(request)
      switch (params.action) {
        case 'archive': await db.transaction(tx => archiveLead(tx, actor, id, b.reason, today, rid)); break
        case 'reopen': await db.transaction(tx => reopenLead(tx, actor, id, today, rid)); break
        case 'unqualify': await db.transaction(tx => unqualifyLead(tx, actor, id, b.reason, today, rid)); break
        case 'merge': await db.transaction(tx => mergeLead(tx, actor, id, b.intoLeadId, today, rid)); break
        default: throw errors.notFound('Aksi')
      }
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/activities', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-follow-up')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => addLeadActivity(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      set.status = 201
      return ok(request, await leadResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/leads/:id/activities/:activityId/done', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-follow-up')
      const id = assertIdParam(params.id, 'Lead')
      const activityId = assertIdParam(params.activityId, 'Aktivitas')
      await db.transaction(tx => completeLeadActivity(tx, actor, id, activityId, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

Catatan: route `/leads/:id/:action` didaftarkan **setelah** `/leads/:id/activities` agar Elysia mencocokkan rute spesifik dulu; Task 4 dan 6 menambah `qualify` dan `won` sebagai rute spesifik sendiri (sebelum `:action`), bukan di `switch`. Bila Elysia bentrok (`activities` tertangkap `:action`), pindahkan aksi ke rute eksplisit `/leads/:id/archive` dst. dan ledger sebagai ruling.

- [ ] **Step 5:** test `lead writes` → PASS; `bun run typecheck` bersih.
- [ ] **Step 6:** Commit `feat(sales): tulis lead — buat, ubah, arsip, unqualify, merge, aktivitas (S6a)`.

---

### Task 4: Qualify lead + customer

**Files:**
- Create: `backend/src/modules/sales/qualify.ts`
- Modify: `backend/src/modules/sales/routes.ts`
- Test: `backend/test/leads-quotations.test.ts`

**Interfaces:**
- Consumes: `lockLead`, `insertLeadActivity`, `touchLead`, `missingQualification`, `wonProjectId`; `createParty`, `createActivity` (`core/party-writes`).
- Produces: `qualifyLead(tx, actor, id, input: { customerKind?: unknown; partyId?: unknown }, today, requestId): Promise<void>`; route `POST /leads/:id/qualify` → `LeadView`.

- [ ] **Step 1: Test gagal**

```ts
describe('qualify', () => {
  const full = (extra: Record<string, unknown> = {}) => ({
    serviceCategory: 'corporate-travel', destination: 'Tokyo', travelStartDate: '2026-12-01', travelEndDate: '2026-12-05',
    travelerEstimate: 12, serviceScope: ['flight', 'hotel'], requirementSummary: 'Kunjungan bisnis', handedOverTo: 'USR-001', ...extra
  })

  test('missing fields answer 422 with the list; complete lead links a new prospect customer and notes', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Budi', companyName: 'PT Qualify Baru S6', source: 'referral' }, key())).json.data.id as string
    const refused = await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.details.missing).toContain('Destinasi belum diisi')
    await call('PATCH', `/leads/${id}`, 'admin', full())
    const lead = (await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })).json.data
    expect(lead.stage).toBe('qualified')
    expect(lead.qualifiedOn).toBeTruthy()
    const party = (await call('GET', `/parties/${lead.partyId}`, 'admin')).json.data
    expect(party).toMatchObject({ name: 'PT Qualify Baru S6', lifecycleStatus: 'prospect', partyType: 'company', accountOwnerUserId: 'USR-001' })
    expect(lead.activities.map((a: { message: string }) => a.message)).toContain('Lead Qualified')
    // Qualify again: unchanged, no second customer.
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })).json.data.partyId).toBe(lead.partyId)
  })

  test('an existing customer with the same name (any case) is reused', async () => {
    const existing = (await call('GET', '/parties/PTY-001', 'admin')).json.data as { id: string; name: string }
    const id = (await call('POST', '/leads', 'admin', { name: 'Kontak', companyName: existing.name.toUpperCase(), source: 'email', ...full() }, key())).json.data.id as string
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })).json.data.partyId).toBe('PTY-001')
  })

  test('B2C individual travel needs no Account Executive and creates a client; finance 403; unknown partyId 400', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Ibu Sinta Qualify', source: 'instagram', ...full({ serviceCategory: 'individual-travel', handedOverTo: null }) }, key())).json.data.id as string
    expect((await call('POST', `/leads/${id}/qualify`, 'finance', { customerKind: 'individual' })).status).toBe(403)
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual', partyId: 'PTY-999' })).status).toBe(400)
    const lead = (await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual' })).json.data
    expect((await call('GET', `/parties/${lead.partyId}`, 'admin')).json.data).toMatchObject({ partyType: 'individual', lifecycleStatus: 'client' })
  })
})
```

- [ ] **Step 2:** `-t "qualify"` → FAIL (404 / aksi tidak dikenal).

- [ ] **Step 3: `qualify.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { createActivity, createParty } from '../core/party-writes'
import { missingQualification } from './lead-rules'
import { insertLeadActivity, lockLead } from './lead-writes'
import { wonProjectId } from './repository'

/**
 * Qualify (S6a): the same required fields as the form, then the customer — the one named, else one with the same
 * name and kind, else a new one (company → prospect, individual → client) owned by the Account Executive.
 * B2C sales orders stay local until S6b; the server records the stage and the customer.
 */
export async function qualifyLead(tx: Queryable, actor: Actor, id: string, input: { customerKind?: unknown; partyId?: unknown }, today: string, requestId: string): Promise<void> {
  const lead = await lockLead(tx, id)
  if (lead.stage === 'qualified' && lead.party_id) return
  if (await wonProjectId(tx, id)) throw new AppError(422, 'RULE_VIOLATION', 'Lead ini sudah menjadi project.')
  if (lead.archived) throw new AppError(422, 'RULE_VIOLATION', 'Lead ini diarsip — buka kembali sebelum qualify.')
  const kind = input.customerKind ?? (lead.service_category === 'individual-travel' ? 'individual' : 'company')
  if (kind !== 'company' && kind !== 'individual') throw errors.validation({ customerKind: ['Pilih perusahaan atau individu.'] })
  const missing = missingQualification(lead)
  if (missing.length) {
    throw new AppError(422, 'RULE_VIOLATION', `Lengkapi data qualification dulu: ${missing.join(', ')}.`, { details: { missing } })
  }

  let partyId: string
  if (input.partyId !== undefined && input.partyId !== null) {
    const found = typeof input.partyId === 'string' && ID_PATTERN.test(input.partyId)
      ? (await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId]))[0] : undefined
    if (!found) throw errors.validation({ partyId: ['Customer tidak ditemukan.'] })
    partyId = found.id
  } else {
    const name = (kind === 'company' ? lead.company_name || lead.name : lead.name).trim()
    const [same] = await tx.query<{ id: string }>(
      `select id from parties where lower(name) = lower($1) and ${kind === 'company' ? "coalesce(party_type, 'company') <> 'individual'" : "party_type = 'individual'"} order by id limit 1`,
      [name]
    )
    partyId = same?.id ?? (await createParty(tx, actor, {
      name, partyType: kind, lifecycleStatus: kind === 'individual' ? 'client' : 'prospect',
      accountOwnerUserId: lead.handed_over_to ?? lead.owner_user_id
    }, requestId)).id
  }

  await tx.query("update leads set stage = 'qualified', party_id = $2, qualified_on = $3, unqualified_reason = null, last_updated_on = $3, updated_at = now() where id = $1",
    [id, partyId, today])
  const ae = lead.handed_over_to ?? lead.owner_user_id
  await insertLeadActivity(tx, id, 'note', 'Lead Qualified', ae, today)
  if (lead.handed_over_to) {
    const [user] = await tx.query<{ name: string }>('select name from users where id = $1', [lead.handed_over_to])
    await insertLeadActivity(tx, id, 'note', `Lead Assigned to Account Executive (${user?.name ?? lead.handed_over_to})`, ae, today)
  }
  if (lead.service_category !== 'individual-travel') {
    await createActivity(tx, actor, partyId, { type: 'note', message: `Lead ${id} qualified — siap dibuatkan Quotation.`, leadId: id }, today, requestId)
  }
  await recordAudit(tx, { action: 'lead.qualified', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { partyId, customerKind: kind } })
}
```

Cek `AppError` menerima `{ details }` sebagai argumen ke-4 (dipakai S4b untuk 409); cek `createParty` menerima `accountOwnerUserId` (dikirim `ensureCustomerForLead` frontend ke API yang sama).

- [ ] **Step 4: route** (didaftarkan sebelum `/leads/:id/:action`):

```ts
    .post('/leads/:id/qualify', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => qualifyLead(tx, actor, id, { customerKind: b.customerKind, partyId: b.partyId }, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

- [ ] **Step 5:** test `qualify` → PASS; seluruh file test PASS; typecheck.
- [ ] **Step 6:** Commit `feat(sales): qualify lead dengan customer server (S6a)`.

---

### Task 5: Quotation client — versi & approval

**Files:**
- Create: `backend/src/modules/sales/quotation-writes.ts`
- Modify: `backend/src/modules/sales/routes.ts`
- Test: `backend/test/leads-quotations.test.ts`

**Interfaces:**
- Consumes: `lockLead`, `wonProjectId`, `insertLeadActivity`, `createActivity`.
- Produces:
  - `createQuotation(tx, actor, leadId, input, today, requestId): Promise<{ id: string }>`
  - `updateQuotation(tx, actor, id, input, requestId)`, `reviseQuotation(tx, actor, id, input, today, requestId)`
  - `submitQuotation(tx, actor, id, today, requestId)`, `withdrawQuotation(tx, actor, id, requestId)`
  - `decideQuotation(tx, actor, id, decision: 'approve' | 'reject', note: unknown, today, requestId)`
  - `sendQuotation(tx, actor, id, today, requestId)`
  - Routes: `POST /leads/:id/quotation`, `PATCH /quotations/:id`, `POST /quotations/:id/{revise,submit,withdraw,approve,reject,send}` → `QuotationView`.
  - Body isi (create/PATCH/revise): `amountMinor, discountMinor, taxMinor, markupMinor, estimatedCostMinor, estimatedMarginMinor` (string | null), `currency, paymentTerms, validUntil, termsAndConditions, inclusions, exclusions, cancellationPolicy, proposedItineraryNote, costSheetId` (string | null), `serviceBreakdown: { service, description?, amountMinor }[]`.

- [ ] **Step 1: Test gagal**

```ts
async function qualifiedLead(name: string): Promise<string> {
  const id = (await call('POST', '/leads', 'admin', {
    name, companyName: name, source: 'website', serviceCategory: 'corporate-travel', destination: 'Bali', travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-03', travelerEstimate: 10, serviceScope: ['flight'], requirementSummary: 'Outing', handedOverTo: 'USR-001'
  }, key())).json.data.id as string
  await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })
  return id
}

describe('client quotations', () => {
  test('create v1 draft (one per lead, idempotent); edit only while draft; submit, withdraw, resubmit', async () => {
    const lead = await qualifiedLead('PT Quotation Satu S6')
    const k = key()
    const created = await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '50000000', serviceBreakdown: [{ service: 'flight', amountMinor: '50000000' }] }, k)
    expect(created.status).toBe(201)
    const q = created.json.data.id as string
    expect(created.json.data).toMatchObject({ currentVersion: 1, status: 'draft', amountMinor: '50000000' })
    expect((await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1' }, k)).json.data.id).toBe(q)
    expect((await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1' }, key())).status).toBe(409)
    expect((await call('PATCH', `/quotations/${q}`, 'admin', { paymentTerms: 'DP 30%', amountMinor: '0' })).status).toBe(400)
    expect((await call('PATCH', `/quotations/${q}`, 'admin', { paymentTerms: 'DP 30%' })).json.data.paymentTerms).toBe('DP 30%')
    expect((await call('POST', `/quotations/${q}/submit`, 'adminSales')).json.data.status).toBe('submitted')
    expect((await call('PATCH', `/quotations/${q}`, 'admin', { paymentTerms: 'Lunas' })).status).toBe(422)
    expect((await call('POST', `/quotations/${q}/withdraw`, 'admin')).json.data.status).toBe('draft')
    expect((await call('POST', `/quotations/${q}/submit`, 'adminSales')).json.data.submittedBy).toBeTruthy()
  })

  test('approve by someone else and self-approval are both recorded; reject needs a note; finance 403', async () => {
    const lead = await qualifiedLead('PT Quotation Dua S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '70000000' }, key())).json.data.id as string
    await call('POST', `/quotations/${q}/submit`, 'adminSales')
    expect((await call('POST', `/quotations/${q}/approve`, 'finance')).status).toBe(403)
    expect((await call('POST', `/quotations/${q}/reject`, 'adminMgmt', {})).status).toBe(400)
    const rejected = (await call('POST', `/quotations/${q}/reject`, 'adminMgmt', { note: 'Margin terlalu tipis' })).json.data
    expect(rejected).toMatchObject({ status: 'rejected', decisionNote: 'Margin terlalu tipis' })
    const v2 = (await call('POST', `/quotations/${q}/revise`, 'adminSales', { amountMinor: '75000000' })).json.data
    expect(v2.versions.map((v: { version: number; status: string }) => `${v.version}:${v.status}`)).toEqual(['1:rejected', '2:draft'])
    await call('POST', `/quotations/${q}/submit`, 'adminSales')
    expect((await call('POST', `/quotations/${q}/approve`, 'adminSales', { note: 'OK' })).json.data.status).toBe('approved')
    const [audit] = await t.db.query<{ details: { selfApproved: boolean } }>(
      "select details from audit_events where action = 'quotation.approved' and entity_id = $1 order by id desc limit 1", [q])
    expect(audit!.details.selfApproved).toBe(true)
  })

  test('revise locks the old version; send needs an approved latest version; revise from draft is 422', async () => {
    const lead = await qualifiedLead('PT Quotation Tiga S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '10000000', inclusions: 'Tiket' }, key())).json.data.id as string
    expect((await call('POST', `/quotations/${q}/revise`, 'admin')).status).toBe(422)
    expect((await call('POST', `/quotations/${q}/send`, 'admin')).status).toBe(422)
    await call('POST', `/quotations/${q}/submit`, 'admin')
    await call('POST', `/quotations/${q}/approve`, 'adminMgmt')
    expect((await call('POST', `/quotations/${q}/send`, 'admin')).json.data.sentToClientOn).toBeTruthy()
    const revised = (await call('POST', `/quotations/${q}/revise`, 'admin')).json.data
    expect(revised).toMatchObject({ currentVersion: 2, status: 'draft', inclusions: 'Tiket', sentToClientOn: null })
    expect(revised.versions[0]).toMatchObject({ version: 1, status: 'superseded', amountMinor: '10000000' })
  })

  test('only qualified non-B2C leads get a quotation', async () => {
    const lead = (await call('POST', '/leads', 'admin', { name: 'Belum Qualify', source: 'website' }, key())).json.data.id as string
    expect((await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1000' }, key())).status).toBe(422)
  })
})
```

`t.db` = DB test (`makeTestApp` mengembalikannya); audit ada di tabel `audit_events` (kolom `details` jsonb).

- [ ] **Step 2:** `-t "client quotations"` → FAIL.

- [ ] **Step 3: `quotation-writes.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { SERVICE_TYPES } from '../core/booking-rules'
import { createActivity } from '../core/party-writes'
import { lockLead, touchLead } from './lead-writes'

/**
 * Client quotations (S6a). Every version keeps its own full content; only the latest version can change and only
 * while it is a draft. Submitting locks it; a revision copies it into a new draft. Self-approval is allowed and
 * recorded. After Won the project keeps its contract value — later revisions never touch it.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

const MONEY: Record<string, string> = {
  amountMinor: 'amount_minor', discountMinor: 'discount_minor', taxMinor: 'tax_minor', markupMinor: 'markup_minor',
  estimatedCostMinor: 'estimated_cost_minor', estimatedMarginMinor: 'estimated_margin_minor'
}
const TEXT: Record<string, string> = {
  currency: 'currency', paymentTerms: 'payment_terms', termsAndConditions: 'terms_and_conditions', inclusions: 'inclusions',
  exclusions: 'exclusions', cancellationPolicy: 'cancellation_policy', proposedItineraryNote: 'proposed_itinerary_note', costSheetId: 'cost_sheet_id'
}
const CONTENT_COLUMNS = [...Object.values(MONEY), ...Object.values(TEXT), 'valid_until', 'service_breakdown']

function content(input: Record<string, unknown>, problems: FieldErrors): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, column] of Object.entries(MONEY)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null && field !== 'amountMinor') { out[column] = null; continue }
    try {
      const value = field === 'estimatedMarginMinor' && typeof v === 'string' && v.startsWith('-')
        ? -parseAmountMinor(v.slice(1), field, { allowZero: true })
        : parseAmountMinor(v as string, field, { allowZero: field !== 'amountMinor' })
      out[column] = value.toString()
    } catch {
      problems[field] = [field === 'amountMinor' ? 'Nilai quotation harus lebih dari 0.' : 'Harus angka rupiah.']
    }
  }
  for (const [field, column] of Object.entries(TEXT)) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && (typeof v !== 'string' || v.length > 4000)) { problems[field] = ['Harus teks, maksimal 4000 karakter.']; continue }
    out[column] = column === 'currency' ? ((v as string | null)?.trim() || 'IDR') : ((v as string | null)?.trim() || null)
  }
  if (input.validUntil !== undefined) {
    if (input.validUntil === null) out.valid_until = null
    else if (typeof input.validUntil !== 'string' || !isIsoDate(input.validUntil)) problems.validUntil = ['Tanggal harus format YYYY-MM-DD.']
    else out.valid_until = input.validUntil
  }
  if (input.serviceBreakdown !== undefined) {
    const rows = Array.isArray(input.serviceBreakdown) ? input.serviceBreakdown as Record<string, unknown>[] : null
    const cleaned = rows?.map((r) => {
      if (!r || !(SERVICE_TYPES as readonly unknown[]).includes(r.service)) return null
      try {
        const amountMinor = parseAmountMinor(r.amountMinor as string, 'amountMinor', { allowZero: true }).toString()
        return typeof r.description === 'string' && r.description.trim() ? { service: r.service, description: r.description.trim().slice(0, 500), amountMinor } : { service: r.service, amountMinor }
      } catch { return null }
    })
    if (!cleaned || cleaned.includes(null)) problems.serviceBreakdown = ['Rincian layanan tidak valid.']
    else out.service_breakdown = JSON.stringify(cleaned)
  }
  return out
}

const ph = (column: string, i: number) => (column === 'service_breakdown' ? `$${i}::text::jsonb` : `$${i}`)

async function lockQuotation(tx: Queryable, id: string) {
  const [q] = await tx.query<{ id: string; lead_id: string; current_version: number }>('select id, lead_id, current_version from quotations where id = $1 for update', [id])
  if (!q) throw errors.notFound('Quotation')
  const [v] = await tx.query<{ status: string; submitted_by: string | null; amount_minor: string }>(
    'select status, submitted_by, amount_minor from quotation_versions where quotation_id = $1 and version = $2', [id, q.current_version])
  return { ...q, status: v!.status, submittedBy: v!.submitted_by, amountMinor: v!.amount_minor }
}

/** A note on the customer timeline, as the local mutators wrote it. */
async function partyNote(tx: Queryable, actor: Actor, leadId: string, message: string, today: string, requestId: string) {
  const [lead] = await tx.query<{ party_id: string | null }>('select party_id from leads where id = $1', [leadId])
  if (lead?.party_id) await createActivity(tx, actor, lead.party_id, { type: 'note', message, leadId }, today, requestId)
}

export async function createQuotation(tx: Queryable, actor: Actor, leadId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.amountMinor === undefined) problems.amountMinor = ['Nilai quotation harus lebih dari 0.']
  const values = content(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const lead = await lockLead(tx, leadId)
  if (lead.stage !== 'qualified') throw rule('Qualify lead dulu sebelum membuat quotation.')
  if (lead.service_category === 'individual-travel') throw rule('Lead Individual Travel (B2C) langsung menjadi Sales Order, tanpa quotation.')
  if (lead.archived) throw rule('Lead ini diarsip.')
  const [existing] = await tx.query<{ id: string }>('select id from quotations where lead_id = $1', [leadId])
  if (existing) throw new AppError(409, 'CONFLICT', `Lead ini sudah punya quotation ${existing.id}.`, { details: { quotationId: existing.id } })

  const id = await nextId(tx, 'QUO-')
  await tx.query('insert into quotations (id, lead_id, created_on) values ($1, $2, $3)', [id, leadId, today])
  const cols = ['quotation_id', 'version', 'created_by', 'created_on', ...Object.keys(values)]
  await tx.query(`insert into quotation_versions (${cols.join(', ')}) values (${cols.map((c, i) => ph(c, i + 1)).join(', ')})`,
    [id, 1, actor.userId, today, ...Object.values(values)])
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'quotation.created', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { leadId, amountMinor: values.amount_minor } })
  return { id }
}

export async function updateQuotation(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const values = content(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const q = await lockQuotation(tx, id)
  if (q.status !== 'draft') throw rule('Ajukan revisi untuk mengubah quotation yang sudah diajukan.')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update quotation_versions set ${cols.map((c, i) => `${c} = ${ph(c, i + 3)}`).join(', ')}, updated_at = now() where quotation_id = $1 and version = $2`,
    [id, q.current_version, ...Object.values(values)])
  await tx.query('update quotations set updated_at = now() where id = $1', [id])
  await recordAudit(tx, { action: 'quotation.updated', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version, ...values } })
}

export async function reviseQuotation(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, today: string, requestId: string) {
  const problems: FieldErrors = {}
  const values = content(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const q = await lockQuotation(tx, id)
  if (q.status === 'draft') throw rule('Versi terbaru masih draft — ubah langsung, tidak perlu revisi.')
  const next = q.current_version + 1
  await tx.query(
    `insert into quotation_versions (quotation_id, version, created_by, created_on, ${CONTENT_COLUMNS.join(', ')})
     select quotation_id, $3, $4, $5, ${CONTENT_COLUMNS.join(', ')} from quotation_versions where quotation_id = $1 and version = $2`,
    [id, q.current_version, next, actor.userId, today]
  )
  if (q.status !== 'rejected') {
    await tx.query("update quotation_versions set status = 'superseded', updated_at = now() where quotation_id = $1 and version = $2", [id, q.current_version])
  }
  const cols = Object.keys(values)
  if (cols.length) {
    await tx.query(`update quotation_versions set ${cols.map((c, i) => `${c} = ${ph(c, i + 3)}`).join(', ')} where quotation_id = $1 and version = $2`,
      [id, next, ...Object.values(values)])
  }
  await tx.query('update quotations set current_version = $2, sent_to_client_on = null, updated_at = now() where id = $1', [id, next])
  await recordAudit(tx, { action: 'quotation.revised', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: next, from: q.current_version, ...values } })
}

export async function submitQuotation(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const q = await lockQuotation(tx, id)
  if (q.status !== 'draft') throw rule('Hanya quotation draft yang bisa diajukan.')
  await tx.query("update quotation_versions set status = 'submitted', submitted_by = $3, submitted_at = now(), decided_by = null, decided_at = null, decision_note = null, updated_at = now() where quotation_id = $1 and version = $2",
    [id, q.current_version, actor.userId])
  await partyNote(tx, actor, q.lead_id, `Quotation ${id} (Rp ${Number(q.amountMinor).toLocaleString('id-ID')}) diajukan untuk commercial approval.`, today, requestId)
  await recordAudit(tx, { action: 'quotation.submitted', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version } })
}

export async function withdrawQuotation(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const q = await lockQuotation(tx, id)
  if (q.status !== 'submitted') throw rule('Hanya quotation yang sedang diajukan yang bisa ditarik.')
  await tx.query("update quotation_versions set status = 'draft', submitted_by = null, submitted_at = null, updated_at = now() where quotation_id = $1 and version = $2", [id, q.current_version])
  await recordAudit(tx, { action: 'quotation.withdrawn', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version } })
}

export async function decideQuotation(tx: Queryable, actor: Actor, id: string, decision: 'approve' | 'reject', noteInput: unknown, today: string, requestId: string) {
  const note = typeof noteInput === 'string' && noteInput.trim() ? noteInput.trim().slice(0, 2000) : null
  if (decision === 'reject' && !note) throw errors.validation({ note: ['Catatan penolakan wajib diisi.'] })
  const q = await lockQuotation(tx, id)
  if (q.status !== 'submitted') throw rule('Hanya quotation yang sedang diajukan yang bisa disetujui atau ditolak.')
  const status = decision === 'approve' ? 'approved' : 'rejected'
  await tx.query('update quotation_versions set status = $3, decided_by = $4, decided_at = now(), decision_note = $5, updated_at = now() where quotation_id = $1 and version = $2',
    [id, q.current_version, status, actor.userId, note])
  await partyNote(tx, actor, q.lead_id, decision === 'approve'
    ? `Quotation ${id} disetujui (Commercial Approval).${note ? ` Catatan: ${note}` : ''}`
    : `Quotation ${id} ditolak (dikembalikan untuk revisi). Catatan: ${note}`, today, requestId)
  await recordAudit(tx, {
    action: `quotation.${status}`, actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, reason: note,
    details: { version: q.current_version, submittedBy: q.submittedBy, selfApproved: q.submittedBy === actor.userId }
  })
}

export async function sendQuotation(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const q = await lockQuotation(tx, id)
  if (q.status !== 'approved') throw rule('Hanya quotation yang sudah disetujui yang bisa dikirim ke client.')
  await tx.query('update quotations set sent_to_client_on = $2, updated_at = now() where id = $1', [id, today])
  await recordAudit(tx, { action: 'quotation.sent', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version } })
}
```

Cek: `parseAmountMinor(value, field, { allowZero })` melempar untuk nilai ≤ 0 tanpa `allowZero` dan untuk non-angka (dipakai project-writes); `recordAudit` menerima `details` (dipakai project-writes `party.promoted_to_client`).

- [ ] **Step 4: routes**

```ts
    .post('/leads/:id/quotation', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const leadId = assertIdParam(params.id, 'Lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /leads/:id/quotation', key, body: { leadId, ...(body as object) } }, tx =>
        createQuotation(tx, actor, leadId, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await quotationResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/quotations/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Quotation')
      await db.transaction(tx => updateQuotation(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await quotationResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/quotations/:id/:action', async ({ request, params, body }) => {
      const decision = params.action === 'approve' || params.action === 'reject'
      const actor = await auth.requireCapability(request, decision ? 'sales.approve-quotation' : 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Quotation')
      const b = (body ?? {}) as Record<string, unknown>
      const today = businessDateOf(new Date())
      const rid = requestIdOf(request)
      switch (params.action) {
        case 'revise': await db.transaction(tx => reviseQuotation(tx, actor, id, b, today, rid)); break
        case 'submit': await db.transaction(tx => submitQuotation(tx, actor, id, today, rid)); break
        case 'withdraw': await db.transaction(tx => withdrawQuotation(tx, actor, id, rid)); break
        case 'approve': await db.transaction(tx => decideQuotation(tx, actor, id, 'approve', b.note, today, rid)); break
        case 'reject': await db.transaction(tx => decideQuotation(tx, actor, id, 'reject', b.note, today, rid)); break
        case 'send': await db.transaction(tx => sendQuotation(tx, actor, id, today, rid)); break
        default: throw errors.notFound('Aksi')
      }
      return ok(request, await quotationResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

Rute `/leads/:id/quotation` didaftarkan sebelum `/leads/:id/:action`.

- [ ] **Step 5:** test `client quotations` → PASS; seluruh file PASS; typecheck.
- [ ] **Step 6:** Commit `feat(sales): quotation client per versi + approval (S6a)`.

---

### Task 6: Mark as Won

**Files:**
- Create: `backend/src/modules/sales/won.ts`
- Modify: `backend/src/modules/sales/routes.ts`
- Test: `backend/test/leads-quotations.test.ts`

**Interfaces:**
- Consumes: `lockLead`, `insertLeadActivity`, `touchLead`, `wonProjectId`, `createProject` (`core/project-writes`), `getProject` (`core/repository`).
- Produces: `markLeadWon(tx, actor, leadId, today, requestId): Promise<{ projectId: string; created: boolean }>`; route `POST /leads/:id/won` → `{ project: <bentuk GET /projects/:id>, lead: LeadView }`, 201 bila dibuat, 200 bila sudah ada.

- [ ] **Step 1: Test gagal**

```ts
describe('won', () => {
  test('creates the project with the approved value; second click returns it; later revisions keep the contract value', async () => {
    const lead = await qualifiedLead('PT Won S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '123000000' }, key())).json.data.id as string
    expect((await call('POST', `/leads/${lead}/won`, 'admin', {}, key())).status).toBe(422) // draft
    await call('POST', `/quotations/${q}/submit`, 'admin')
    await call('POST', `/quotations/${q}/approve`, 'adminMgmt')
    expect((await call('POST', `/leads/${lead}/won`, 'finance', {}, key())).status).toBe(403)
    const won = await call('POST', `/leads/${lead}/won`, 'admin', {}, key())
    expect(won.status).toBe(201)
    const projectId = won.json.data.project.id as string
    expect(won.json.data.project).toMatchObject({ contractValueMinor: '123000000', leadId: lead, sourceQuotationId: q })
    expect(won.json.data.lead.wonProjectId).toBe(projectId)
    const party = (await call('GET', `/parties/${won.json.data.project.partyId}`, 'admin')).json.data
    expect(party.lifecycleStatus).toBe('client')
    const again = await call('POST', `/leads/${lead}/won`, 'admin', {}, key())
    expect(again.status).toBe(200)
    expect(again.json.data.project.id).toBe(projectId)
    await call('POST', `/quotations/${q}/revise`, 'admin', { amountMinor: '999000000' })
    expect((await call('GET', `/projects/${projectId}`, 'admin')).json.data.contractValueMinor).toBe('123000000')
  })

  test('missing travel data answers 422 with the list', async () => {
    const lead = await qualifiedLead('PT Won Kurang S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1000000' }, key())).json.data.id as string
    await call('POST', `/quotations/${q}/submit`, 'admin')
    await call('POST', `/quotations/${q}/approve`, 'admin')
    await t.db.query("update leads set destination = null where id = $1", [lead])
    const refused = await call('POST', `/leads/${lead}/won`, 'admin', {}, key())
    expect(refused.status).toBe(422)
    expect(refused.json.error.details.missing).toContain('Destinasi belum diisi')
  })
})
```

- [ ] **Step 2:** `-t "won"` → FAIL.

- [ ] **Step 3: `won.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { createProject } from '../core/project-writes'
import { insertLeadActivity, lockLead, touchLead } from './lead-writes'
import { wonProjectId } from './repository'

/**
 * Mark as Won (S6a): the lead row is locked first, so a second click waits and then finds the project. The project
 * is created through the S3a path with the approved version's value as its contract value.
 */
export async function markLeadWon(tx: Queryable, actor: Actor, leadId: string, today: string, requestId: string): Promise<{ projectId: string; created: boolean }> {
  const lead = await lockLead(tx, leadId)
  const existing = await wonProjectId(tx, leadId)
  if (existing) return { projectId: existing, created: false }

  const [q] = await tx.query<{ id: string; status: string; amount_minor: string }>(
    `select q.id, v.status, v.amount_minor from quotations q join quotation_versions v on v.quotation_id = q.id and v.version = q.current_version where q.lead_id = $1`,
    [leadId]
  )
  const missing: string[] = []
  if (lead.stage !== 'qualified') missing.push('Lead belum qualified')
  if (!lead.party_id) missing.push('Customer belum ditautkan')
  if (!q) missing.push('Quotation belum dibuat')
  else if (q.status !== 'approved') missing.push('Quotation versi terbaru belum disetujui')
  if (!lead.destination) missing.push('Destinasi belum diisi')
  if (!lead.travel_start_date || !lead.travel_end_date) missing.push('Periode perjalanan belum diisi')
  if (!lead.traveler_estimate) missing.push('Estimasi traveler belum diisi')
  if (!lead.service_scope?.length) missing.push('Service scope belum dipilih')
  if (lead.archived) missing.push('Lead diarsip')
  if (missing.length) throw new AppError(422, 'RULE_VIOLATION', `Lead belum bisa Won: ${missing.join(', ')}.`, { details: { missing } })

  const { id: projectId } = await createProject(tx, actor, {
    partyId: lead.party_id!,
    leadId,
    sourceQuotationId: q!.id,
    name: lead.title ?? lead.company_name ?? lead.name,
    destination: lead.destination!,
    travelStartDate: lead.travel_start_date!,
    travelEndDate: lead.travel_end_date!,
    characteristic: 'normal',
    serviceScope: lead.service_scope,
    travelerCount: lead.traveler_estimate!,
    contractValueMinor: q!.amount_minor
  }, requestId)
  await insertLeadActivity(tx, leadId, 'note', `Lead Won — project ${projectId} dibuat dari quotation ${q!.id}.`, actor.userId, today)
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'lead.won', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId, after: { projectId, quotationId: q!.id, contractValueMinor: q!.amount_minor } })
  return { projectId, created: true }
}
```

- [ ] **Step 4: route** (sebelum `/leads/:id/:action`; import `getProject` dari `../core/repository`):

```ts
    .post('/leads/:id/won', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.mark-won')
      const leadId = assertIdParam(params.id, 'Lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /leads/:id/won', key, body: { leadId, ...((body ?? {}) as object) } }, tx =>
        markLeadWon(tx, actor, leadId, businessDateOf(new Date()), requestIdOf(request)))
      set.status = result.data.created && !result.replayed ? 201 : 200
      return ok(request, { project: await getProject(db, actor, result.data.projectId), lead: await leadResponse(leadId) })
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
```

- [ ] **Step 5:** test `won` → PASS; seluruh suite backend `bun run test` PASS; typecheck.
- [ ] **Step 6:** Commit `feat(sales): Mark as Won lewat server dari quotation yang disetujui (S6a)`.

---

### Task 7: Seed & extract

**Files:**
- Modify: `backend/scripts/extract-demo-core.ts`, `backend/src/db/seed-demo.ts`, `backend/src/db/seeds/demo-core.json` (dibuat ulang), `backend/test/leads-quotations.test.ts` (cabut `describe.skip`, hapus `lead reads (empty)`), `backend/test/db.test.ts`

**Interfaces:**
- Produces: `DemoCoreSeed.leads?`, `leadActivities?`, `quotations?` (bentuk di bawah); seed menulis tabel S6a.

- [ ] **Step 1: Test gagal** — cabut `.skip` dari `describe('lead reads')` (Task 2) dan tambah ke `db.test.ts`:

```ts
  test('demo leads and quotations are seeded; a re-seed keeps user versions and stages', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from leads')
      expect(n).toBe(31)
      const v = await db.query<{ version: number; status: string }>("select version, status from quotation_versions where quotation_id = 'QUO-005' order by version")
      expect(v.map(r => `${r.version}:${r.status}`)).toEqual(['1:superseded', '2:submitted'])
      await db.query("update quotation_versions set status = 'superseded' where quotation_id = 'QUO-010' and version = 1")
      await db.query("insert into quotation_versions (quotation_id, version, amount_minor) values ('QUO-010', 2, 80000000)")
      await db.query("update quotations set current_version = 2 where id = 'QUO-010'")
      await db.query("update leads set stage = 'unqualified' where id = 'LED-002'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const after = await db.query<{ version: number; status: string }>("select version, status from quotation_versions where quotation_id = 'QUO-010' order by version")
      expect(after.map(r => `${r.version}:${r.status}`)).toEqual(['1:superseded', '2:draft'])
      expect((await db.query<{ current_version: number }>("select current_version from quotations where id = 'QUO-010'"))[0]!.current_version).toBe(2)
      expect((await db.query<{ stage: string }>("select stage from leads where id = 'LED-002'"))[0]!.stage).toBe('unqualified')
    } finally {
      await cleanup()
    }
  })
```

- [ ] **Step 2:** `bun test --timeout 30000 test/db.test.ts -t "demo leads"` → FAIL (0 lead).

- [ ] **Step 3: `DemoCoreSeed`** — tambah:

```ts
  /** Sales (S6a): leads with their requirement and B2C fields, lead activities, client quotations (version rows). */
  leads?: {
    id: string; name: string; companyName: string | null; title: string | null; source: string; stage: string; ownerUserId: string
    handedOverTo: string | null; phone: string | null; email: string | null; qualificationNotes: string | null; expectedCloseDate: string | null
    createdOn: string; lastUpdatedOn: string; archived: boolean; partyId: string | null; qualifiedOn: string | null
    serviceCategory: string | null; destination: string | null; travelStartDate: string | null; travelEndDate: string | null
    travelerEstimate: number | null; serviceScope: string[]; requirementSummary: string | null; budgetRange: string | null
    dateFlexible: boolean | null; decisionMaker: string | null; urgency: string | null; specialRequestNote: string | null; b2c: Record<string, unknown>
  }[]
  leadActivities?: { id: string; leadId: string; type: string; message: string; ownerUserId: string; activityDate: string; dueOn: string | null }[]
  quotations?: {
    id: string; leadId: string; createdOn: string; sentToClientOn: string | null
    versions: { version: number; status: string; amountMinor: string; decidedBy: string | null; decisionNote: string | null; content: Record<string, unknown> }[]
  }[]
```

- [ ] **Step 4: extractor** — impor `LEADS, LEAD_ACTIVITIES` dari `../../frontend/app/data/leads` dan `QUOTATIONS` dari `../../frontend/app/data/quotations`; tambah ke objek `seed`:

```ts
  leads: [...LEADS].sort(byId).map(l => ({
    id: l.id, name: l.name, companyName: l.companyName ?? null, title: l.title ?? null, source: l.source, stage: l.stage,
    ownerUserId: seededUser(l.ownerId, `lead ${l.id} owner`) ?? 'USR-001', handedOverTo: seededUser(l.handedOverTo, `lead ${l.id} AE`),
    phone: l.phone ?? null, email: l.email ?? null, qualificationNotes: l.qualificationNotes ?? null, expectedCloseDate: dateOnly(l.expectedCloseDate),
    createdOn: dateOnly(l.createdAt)!, lastUpdatedOn: dateOnly(l.lastUpdatedAt)!, archived: l.archived, partyId: l.partyId ?? null,
    qualifiedOn: dateOnly(l.qualifiedAt), serviceCategory: l.serviceCategory ?? null, destination: l.destination ?? null,
    travelStartDate: dateOnly(l.travelStartDate), travelEndDate: dateOnly(l.travelEndDate), travelerEstimate: l.travelerEstimate ?? null,
    serviceScope: l.serviceScope ?? [], requirementSummary: l.requirementSummary ?? null, budgetRange: l.budgetRange ?? null,
    dateFlexible: l.dateFlexible ?? null, decisionMaker: l.decisionMaker ?? null, urgency: l.urgency ?? null, specialRequestNote: l.specialRequestNote ?? null,
    // B2C / Group Trip fields stay as they are until S6b; the group-trip project and local sales order ride along.
    b2c: Object.fromEntries(Object.entries({
      groupTripProjectId: l.groupTripProjectId, b2cAdultCount: l.b2cAdultCount, b2cChildCount: l.b2cChildCount, b2cInfantCount: l.b2cInfantCount,
      b2cPriceAcceptance: l.b2cPriceAcceptance, b2cBookingReadiness: l.b2cBookingReadiness, b2cQualificationResult: l.b2cQualificationResult,
      b2cNextFollowUpDate: l.b2cNextFollowUpDate,
      projectId: l.serviceCategory === 'individual-travel' && !PROJECTS.some(p => p.leadId === l.id) ? l.projectId : undefined,
      salesOrderId: l.salesOrderId
    }).filter(([, v]) => v !== undefined))
  })),
  leadActivities: [...LEAD_ACTIVITIES].sort(byId).map(a => ({
    id: a.id, leadId: a.leadId, type: a.type, message: a.message, ownerUserId: seededUser(a.ownerId, `lead activity ${a.id}`) ?? 'USR-001',
    activityDate: dateOnly(a.createdAt)!, dueOn: dateOnly(a.dueAt)
  })),
  quotations: [...QUOTATIONS].sort(byId).map((q) => {
    const status = q.approvalStatus ?? 'draft'
    const content = Object.fromEntries(Object.entries({
      discountMinor: q.discountIdr, taxMinor: q.taxIdr, markupMinor: q.markupIdr, estimatedCostMinor: q.estimatedCostIdr, estimatedMarginMinor: q.estimatedMarginIdr,
      currency: q.currency, paymentTerms: q.paymentTerms, validUntil: q.validUntil, termsAndConditions: q.termsAndConditions, inclusions: q.inclusions,
      exclusions: q.exclusions, cancellationPolicy: q.cancellationPolicy, proposedItineraryNote: q.proposedItineraryNote, costSheetId: q.costSheetId,
      serviceBreakdown: q.serviceBreakdown?.map(s => ({ service: s.service, ...(s.description ? { description: s.description } : {}), amountMinor: String(s.amountIdr) }))
    }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]))
    const latest = { version: q.version, status, amountMinor: String(q.amountIdr), decidedBy: seededUser(q.approvedBy, `quotation ${q.id} approver`), decisionNote: q.approvalNote ?? null, content }
    // The fixture keeps only the previous amount of a revised quotation: earlier versions are rebuilt as superseded.
    const earlier = Array.from({ length: q.version - 1 }, (_, i) => ({
      version: i + 1, status: 'superseded', amountMinor: String(i === q.version - 2 && q.supersededAmountIdr ? q.supersededAmountIdr : q.amountIdr),
      decidedBy: null, decisionNote: null, content
    }))
    return { id: q.id, leadId: q.leadId, createdOn: dateOnly(q.createdAt)!, sentToClientOn: dateOnly(q.sentToClientAt), versions: [...earlier, latest] }
  }),
```

(`PROJECTS` sudah diimpor di extractor.) Jalankan `bun run seed:extract`; periksa diff `demo-core.json`: 31 lead, 9 aktivitas, 10 quotation, QUO-005 punya dua versi.

- [ ] **Step 5: seed-demo** — setelah blok `projects` (lead mereferensikan parties/users; projects dulu agar FK `projects.lead_id` NOT VALID tidak masalah; baris seed project yang diubah ulang dicek FK — jadi **lead diseed sebelum projects**: letakkan blok lead tepat setelah update `account_owner_user_id`, sebelum loop `seed.projects`; quotation juga sebelum projects karena `source_quotation_id`):

```ts
    // S6a: leads before projects (projects.lead_id / source_quotation_id reference them). A re-seed refreshes the
    // fixture text but never a lead's stage, archive state or customer, nor quotation versions/status — the API owns those.
    for (const l of seed.leads ?? []) {
      await tx.query(
        `insert into leads (id, name, company_name, title, source, stage, owner_user_id, handed_over_to, phone, email, qualification_notes,
           expected_close_date, created_on, last_updated_on, archived, party_id, qualified_on, service_category, destination, travel_start_date,
           travel_end_date, traveler_estimate, service_scope, requirement_summary, budget_range, date_flexible, decision_maker, urgency,
           special_request_note, b2c, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::text::jsonb,
                 $24, $25, $26, $27, $28, $29, $30::text::jsonb, $31)
         on conflict (id) do update set name = excluded.name, company_name = excluded.company_name, title = excluded.title,
           source = excluded.source, phone = excluded.phone, email = excluded.email
         where leads.provenance = 'demo-fixture'`,
        [l.id, l.name, l.companyName, l.title, l.source, l.stage, l.ownerUserId, l.handedOverTo, l.phone, l.email, l.qualificationNotes,
          l.expectedCloseDate, l.createdOn, l.lastUpdatedOn, l.archived, l.partyId, l.qualifiedOn, l.serviceCategory, l.destination,
          l.travelStartDate, l.travelEndDate, l.travelerEstimate, JSON.stringify(l.serviceScope), l.requirementSummary, l.budgetRange,
          l.dateFlexible, l.decisionMaker, l.urgency, l.specialRequestNote, JSON.stringify(l.b2c), P]
      )
    }
    for (const a of seed.leadActivities ?? []) {
      await tx.query(
        `insert into lead_activities (id, lead_id, type, message, owner_user_id, activity_date, due_on, provenance) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set message = excluded.message, due_on = excluded.due_on where lead_activities.provenance = 'demo-fixture'`,
        [a.id, a.leadId, a.type, a.message, a.ownerUserId, a.activityDate, a.dueOn, P]
      )
    }
    const MONEY_KEYS = ['discountMinor', 'taxMinor', 'markupMinor', 'estimatedCostMinor', 'estimatedMarginMinor'] as const
    for (const q of seed.quotations ?? []) {
      const latest = q.versions[q.versions.length - 1]!
      const inserted = await tx.query<{ id: string }>(
        `insert into quotations (id, lead_id, current_version, sent_to_client_on, created_on, provenance) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing returning id`,
        [q.id, q.leadId, latest.version, q.sentToClientOn, q.createdOn, P]
      )
      if (!inserted.length) continue // existing quotation: its versions belong to the API now
      for (const v of q.versions) {
        const c = v.content as Record<string, unknown>
        await tx.query(
          `insert into quotation_versions (quotation_id, version, amount_minor, discount_minor, tax_minor, markup_minor, estimated_cost_minor, estimated_margin_minor,
             currency, payment_terms, valid_until, terms_and_conditions, inclusions, exclusions, cancellation_policy, proposed_itinerary_note, cost_sheet_id,
             service_breakdown, status, decided_by, decided_at, decision_note, created_on)
           values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'IDR'), $10, $11, $12, $13, $14, $15, $16, $17, $18::text::jsonb, $19, $20,
                   case when $20::text is null then null else now() end, $21, $22)`,
          [q.id, v.version, v.amountMinor, ...MONEY_KEYS.map(k => c[k] ?? null), c.currency ?? null, c.paymentTerms ?? null, c.validUntil ?? null,
            c.termsAndConditions ?? null, c.inclusions ?? null, c.exclusions ?? null, c.cancellationPolicy ?? null, c.proposedItineraryNote ?? null,
            c.costSheetId ?? null, JSON.stringify(c.serviceBreakdown ?? []), v.status, v.decidedBy, v.decisionNote, q.createdOn]
        )
      }
    }
```

`SeedResult` tambah `leads: number; quotations: number` dan isi dari `seed.leads?.length ?? 0` / `seed.quotations?.length ?? 0` (ikuti pola field lain di return). `syncIdSequences` sudah dipanggil di akhir seed (mengenal prefix baru dari Task 1).

- [ ] **Step 6:** test `demo leads` + `lead reads` (sekarang tanpa skip) → PASS; hapus `describe('lead reads (empty)')`; `bun run test` seluruhnya PASS (termasuk `year-demo-seed`, `finance-demo-seed`); typecheck.
- [ ] **Step 7:** Commit `feat(sales): seed demo lead, aktivitas & quotation per versi (S6a)`.

---

### Task 8: Frontend — tipe, endpoint, `leads-sync`

**Files:**
- Modify: `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`, `frontend/app/types/quotation.ts` (field `versions?`), `frontend/app/layouts/dashboard.vue`, `frontend/app/pages/settings.vue` (reset), `frontend/app/data/projects-sync.ts` (hapus `markLeadWonOnServer` lama), `frontend/app/data/parties-sync.ts` (hapus `ensureCustomerForLead`), test terkait
- Create: `frontend/app/data/leads-sync.ts`, `frontend/app/data/leads-sync.test.ts`

**Interfaces:**
- Produces (`types/api.ts`): `LeadDto`, `LeadActivityDto`, `SalesQuotationDto`, `SalesQuotationVersionDto`, `LeadWriteInput` (= field PATCH, semua opsional + `name`, `source`), `QuotationContentInput`, `LeadWonDto = { project: ProjectDetailDto; lead: LeadDto }` — bentuk persis `LeadView` / `QuotationView` Task 2.
- Produces (`endpoints.ts`, namespace baru `sales`):
  `listLeads()`, `getLead(id)`, `createLead(input, key)`, `updateLead(id, patch)`, `qualifyLead(id, { customerKind })`, `unqualifyLead(id, reason)`, `archiveLead(id, reason?)`, `reopenLead(id)`, `mergeLead(id, intoLeadId)`, `addLeadActivity(id, { type, message, dueOn? })`, `completeLeadActivity(id, activityId)`, `listQuotations(query?)`, `createQuotation(leadId, input, key)`, `updateQuotation(id, input)`, `reviseQuotation(id, input?)`, `submitQuotation(id)`, `withdrawQuotation(id)`, `approveQuotation(id, note?)`, `rejectQuotation(id, note)`, `sendQuotation(id)`, `markLeadWon(leadId, key)`.
- Produces (`leads-sync.ts`, `type SalesApi = Pick<ManovaApi, 'core' | 'sales'>`):
  - `leadFromServer(d: LeadDto, local?: Lead): Lead`, `quotationFromServer(d: SalesQuotationDto, wonLeadIds: Set<string>): Quotation`
  - `upsertServerLead(d): Lead`, `upsertServerQuotation(d): Quotation`, `mergeServerLeads(leads, quotations)`
  - `loadServerLeads(api)`, `useLeadsSync()` (`state`, `load(force?)`)
  - Tulis (semua mengembalikan objek lokal yang sudah diperbarui): `createLeadOnServer(api, input, key?)`, `patchLeadOnServer(api, id, patch)`, `archiveLeadOnServer(api, id, reason?)`, `reopenLeadOnServer(api, id)`, `unqualifyLeadOnServer(api, id, reason)`, `mergeLeadOnServer(api, id, intoId)`, `addLeadActivityOnServer(api, id, input)`, `completeLeadActivityOnServer(api, id, activityId)`, `qualifyLeadOnServer(api, id, customerKind)`, `createQuotationOnServer(api, leadId, input, key?)`, `updateQuotationOnServer(api, id, input)`, `reviseQuotationOnServer(api, id, input?)`, `submitQuotationOnServer(api, id)`, `withdrawQuotationOnServer(api, id)`, `approveQuotationOnServer(api, id, note?)`, `rejectQuotationOnServer(api, id, note)`, `sendQuotationOnServer(api, id, actorId)`, `markLeadWonOnServer(api, leadId, approverId, key?): Promise<Project>`
  - Konversi: `quotationInputFromLocal(patch: Partial<Quotation>): QuotationContentInput` (`…Idr` → `…Minor` string, `serviceBreakdown.amountIdr` → `amountMinor`).

- [ ] **Step 1: Test gagal** — `leads-sync.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { LEADS, LEAD_ACTIVITIES } from './leads'
import { QUOTATIONS } from './quotations'
import { leadFromServer, mergeServerLeads, quotationFromServer, reviseQuotationOnServer, qualifyLeadOnServer, markLeadWonOnServer } from './leads-sync'
import type { LeadDto, SalesQuotationDto } from '~/types/api'

const lead = (over: Partial<LeadDto> = {}): LeadDto => ({
  id: 'LED-001', name: 'CV Nirmala', companyName: 'CV Nirmala', title: null, source: 'website', stage: 'qualified', ownerUserId: 'USR-001',
  handedOverTo: 'USR-001', phone: null, email: null, qualificationNotes: null, expectedCloseDate: null, createdOn: '2026-07-10',
  lastUpdatedOn: '2026-07-22', archived: false, archiveReason: null, partyId: 'PTY-004', qualifiedOn: '2026-07-22', unqualifiedReason: null,
  mergedInto: null, serviceCategory: 'mice-event', destination: 'Yogyakarta', travelStartDate: '2026-09-20', travelEndDate: '2026-09-22',
  travelerEstimate: 150, serviceScope: ['mice'], requirementSummary: 'x', budgetRange: null, dateFlexible: null, decisionMaker: null,
  urgency: null, specialRequestNote: null, b2c: {}, wonProjectId: null, quotationId: null,
  activities: [{ id: 'LACT-001', leadId: 'LED-001', type: 'call', message: 'Halo', ownerUserId: 'USR-001', activityDate: '2026-07-11', dueOn: null, doneOn: null }],
  ...over
})
const quo = (over: Partial<SalesQuotationDto> = {}): SalesQuotationDto => ({
  id: 'QUO-005', leadId: 'LED-005', currentVersion: 2, status: 'submitted', sentToClientOn: null, createdOn: '2026-07-18', amountMinor: '180000000',
  discountMinor: null, taxMinor: null, markupMinor: null, estimatedCostMinor: null, estimatedMarginMinor: null, currency: 'IDR', paymentTerms: null,
  validUntil: null, termsAndConditions: null, inclusions: null, exclusions: null, cancellationPolicy: null, proposedItineraryNote: null, costSheetId: null,
  serviceBreakdown: [{ service: 'hotel', amountMinor: '180000000' }], submittedBy: 'USR-001', submittedAt: null, decidedBy: null, decidedAt: null, decisionNote: null,
  versions: [
    { version: 1, status: 'superseded', amountMinor: '150000000', createdOn: '2026-07-10', submittedBy: null, decidedBy: null, decidedAt: null, decisionNote: null },
    { version: 2, status: 'submitted', amountMinor: '180000000', createdOn: '2026-07-18', submittedBy: 'USR-001', decidedBy: null, decidedAt: null, decisionNote: null }
  ],
  ...over
})

describe('leads-sync mapping', () => {
  it('maps a lead: dates, won project, B2C project from b2c, activities', () => {
    const l = leadFromServer(lead({ wonProjectId: 'PRJ-101', quotationId: 'QUO-001' }))
    expect(l).toMatchObject({ id: 'LED-001', createdAt: '2026-07-10', lastUpdatedAt: '2026-07-22', projectId: 'PRJ-101', quotationId: 'QUO-001', partyId: 'PTY-004', qualifiedAt: '2026-07-22' })
    const b2c = leadFromServer(lead({ serviceCategory: 'individual-travel', b2c: { groupTripProjectId: 'PRJ-205', projectId: 'PRJ-205', b2cAdultCount: 2 } }))
    expect(b2c).toMatchObject({ projectId: 'PRJ-205', groupTripProjectId: 'PRJ-205', b2cAdultCount: 2 })
  })

  it('maps a quotation: approval fields, previous amount, version list, accepted when the lead is won', () => {
    const q = quotationFromServer(quo(), new Set(['LED-005']))
    expect(q).toMatchObject({ id: 'QUO-005', amountIdr: 180_000_000, version: 2, approvalStatus: 'submitted', supersededAmountIdr: 150_000_000, accepted: true })
    expect(q.serviceBreakdown).toEqual([{ service: 'hotel', amountIdr: 180_000_000 }])
    expect(q.versions).toHaveLength(2)
  })

  it('merge replaces leads, activities and quotations with the server lists, keeping object identity', () => {
    const before = LEADS.find(l => l.id === 'LED-001')!
    mergeServerLeads([lead({ name: 'Nama Baru' })], [quo()])
    expect(LEADS).toHaveLength(1)
    expect(LEADS[0]).toBe(before)
    expect(LEADS[0]!.name).toBe('Nama Baru')
    expect(LEAD_ACTIVITIES.map(a => a.id)).toEqual(['LACT-001'])
    expect(QUOTATIONS.map(q => q.id)).toEqual(['QUO-005'])
  })
})

describe('leads-sync writes', () => {
  beforeEach(() => { mergeServerLeads([lead()], [quo()]) })

  it('revise sends a PATCH while the latest version is still a draft, a revision otherwise', async () => {
    const calls: string[] = []
    const api = { sales: {
      updateQuotation: (id: string) => { calls.push(`patch ${id}`); return Promise.resolve({ data: quo({ status: 'draft' }) }) },
      reviseQuotation: (id: string) => { calls.push(`revise ${id}`); return Promise.resolve({ data: quo({ currentVersion: 3, status: 'draft' }) }) }
    } } as never
    await reviseQuotationOnServer(api, 'QUO-005', { amountIdr: 200_000_000 })
    expect(calls).toEqual(['revise QUO-005'])
    await reviseQuotationOnServer(api, 'QUO-005', { amountIdr: 210_000_000 })
    expect(calls).toEqual(['revise QUO-005', 'patch QUO-005'])
  })

  it('qualify takes the server lead and reloads its customer', async () => {
    const parties: string[] = []
    const api = {
      sales: { qualifyLead: () => Promise.resolve({ data: lead({ partyId: 'PTY-001' }) }) },
      core: { getParty: (id: string) => { parties.push(id); return Promise.reject(new Error('offline')) } }
    } as never
    const l = await qualifyLeadOnServer(api, 'LED-001', 'company')
    expect(l.partyId).toBe('PTY-001')
    expect(parties).toEqual(['PTY-001'])
  })

  it('won registers the server project and links the lead', async () => {
    const api = {
      sales: { markLeadWon: () => Promise.resolve({ data: { project: { id: 'PRJ-901', partyId: 'PTY-004' }, lead: lead({ wonProjectId: 'PRJ-901' }) } }) },
      core: { getParty: () => Promise.reject(new Error('offline')) }
    } as never
    const p = await markLeadWonOnServer(api, 'LED-001', 'USR-003')
    expect(p.id).toBe('PRJ-901')
    expect(LEADS.find(l => l.id === 'LED-001')!.projectId).toBe('PRJ-901')
  })
})
```

(`project` minimal di test Won: `registerNewServerProject` di `projects-sync.ts` membaca bentuk `ProjectDetailDto`; bila butuh field lain, lengkapi objek di test dengan field wajib dari `projects-sync.test.ts` yang sudah ada.)

- [ ] **Step 2:** `pnpm vitest run app/data/leads-sync.test.ts` → FAIL (modul tidak ada).

- [ ] **Step 3: tipe + endpoint** — `types/api.ts` (dekat tipe S4b):

```ts
/** Sales (S6a) — `GET /leads`, `GET /quotations`. Dates are `YYYY-MM-DD`; money is minor units as a string. */
export interface LeadActivityDto { id: string; leadId: string; type: 'call' | 'meeting' | 'email' | 'note' | 'follow-up'; message: string; ownerUserId: string; activityDate: string; dueOn: string | null; doneOn: string | null }
export interface LeadDto {
  id: string; name: string; companyName: string | null; title: string | null; source: string; stage: 'new' | 'contacted' | 'qualified' | 'unqualified'
  ownerUserId: string; handedOverTo: string | null; phone: string | null; email: string | null; qualificationNotes: string | null
  expectedCloseDate: string | null; createdOn: string; lastUpdatedOn: string; archived: boolean; archiveReason: string | null; partyId: string | null
  qualifiedOn: string | null; unqualifiedReason: string | null; mergedInto: string | null; serviceCategory: string | null; destination: string | null
  travelStartDate: string | null; travelEndDate: string | null; travelerEstimate: number | null; serviceScope: string[]; requirementSummary: string | null
  budgetRange: string | null; dateFlexible: boolean | null; decisionMaker: string | null; urgency: 'low' | 'medium' | 'high' | null
  specialRequestNote: string | null; b2c: Record<string, unknown>; wonProjectId: string | null; quotationId: string | null; activities: LeadActivityDto[]
}
export type LeadWriteInput = Partial<Pick<LeadDto, 'name' | 'companyName' | 'title' | 'source' | 'handedOverTo' | 'phone' | 'email' | 'qualificationNotes'
  | 'expectedCloseDate' | 'serviceCategory' | 'destination' | 'travelStartDate' | 'travelEndDate' | 'travelerEstimate' | 'serviceScope'
  | 'requirementSummary' | 'budgetRange' | 'dateFlexible' | 'decisionMaker' | 'urgency' | 'specialRequestNote' | 'b2c'>> & { stage?: 'new' | 'contacted' }
export interface SalesQuotationVersionDto { version: number; status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'superseded'; amountMinor: string; createdOn: string; submittedBy: string | null; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null }
export interface QuotationContentInput {
  amountMinor?: string; discountMinor?: string | null; taxMinor?: string | null; markupMinor?: string | null; estimatedCostMinor?: string | null
  estimatedMarginMinor?: string | null; currency?: string | null; paymentTerms?: string | null; validUntil?: string | null; termsAndConditions?: string | null
  inclusions?: string | null; exclusions?: string | null; cancellationPolicy?: string | null; proposedItineraryNote?: string | null; costSheetId?: string | null
  serviceBreakdown?: { service: string; description?: string; amountMinor: string }[]
}
export interface SalesQuotationDto extends Required<Omit<QuotationContentInput, 'serviceBreakdown' | 'amountMinor' | 'currency'>> {
  id: string; leadId: string; currentVersion: number; status: SalesQuotationVersionDto['status']; sentToClientOn: string | null; createdOn: string
  amountMinor: string; currency: string; serviceBreakdown: { service: string; description?: string; amountMinor: string }[]
  submittedBy: string | null; submittedAt: string | null; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null
  versions: SalesQuotationVersionDto[]
}
export interface LeadWonDto { project: ProjectDetailDto; lead: LeadDto }
```

`endpoints.ts` — namespace `sales` setelah `core`:

```ts
    sales: {
      listLeads: () => client.get<LeadDto[]>('/leads'),
      getLead: (id: string) => client.get<LeadDto>(`/leads/${seg(id)}`),
      createLead: (input: LeadWriteInput & { name: string; source: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<LeadDto>('/leads', input, { idempotencyKey }),
      updateLead: (id: string, patch: LeadWriteInput) => client.patch<LeadDto>(`/leads/${seg(id)}`, patch),
      qualifyLead: (id: string, input: { customerKind: 'company' | 'individual'; partyId?: string }) => client.post<LeadDto>(`/leads/${seg(id)}/qualify`, input),
      unqualifyLead: (id: string, reason: string) => client.post<LeadDto>(`/leads/${seg(id)}/unqualify`, { reason }),
      archiveLead: (id: string, reason?: string) => client.post<LeadDto>(`/leads/${seg(id)}/archive`, reason ? { reason } : {}),
      reopenLead: (id: string) => client.post<LeadDto>(`/leads/${seg(id)}/reopen`, {}),
      mergeLead: (id: string, intoLeadId: string) => client.post<LeadDto>(`/leads/${seg(id)}/merge`, { intoLeadId }),
      addLeadActivity: (id: string, input: { type: LeadActivityDto['type']; message: string; dueOn?: string }) =>
        client.post<LeadDto>(`/leads/${seg(id)}/activities`, input),
      completeLeadActivity: (id: string, activityId: string) => client.post<LeadDto>(`/leads/${seg(id)}/activities/${seg(activityId)}/done`, {}),
      listQuotations: (query: { leadId?: string } = {}) => client.get<SalesQuotationDto[]>('/quotations', { query: { ...query } }),
      createQuotation: (leadId: string, input: QuotationContentInput & { amountMinor: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<SalesQuotationDto>(`/leads/${seg(leadId)}/quotation`, input, { idempotencyKey }),
      updateQuotation: (id: string, input: QuotationContentInput) => client.patch<SalesQuotationDto>(`/quotations/${seg(id)}`, input),
      reviseQuotation: (id: string, input: QuotationContentInput = {}) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/revise`, input),
      submitQuotation: (id: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/submit`, {}),
      withdrawQuotation: (id: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/withdraw`, {}),
      approveQuotation: (id: string, note?: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/approve`, note ? { note } : {}),
      rejectQuotation: (id: string, note: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/reject`, { note }),
      sendQuotation: (id: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/send`, {}),
      markLeadWon: (leadId: string, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<LeadWonDto>(`/leads/${seg(leadId)}/won`, {}, { idempotencyKey })
    },
```

`types/quotation.ts`: tambah ke `Quotation`:

```ts
  /** S6a — riwayat versi dari server (versi lama terkunci; `superseded` = digantikan revisi). */
  versions?: { version: number; status: QuotationApprovalStatus | 'superseded'; amountIdr: number; createdAt: string; submittedBy?: ID; decidedBy?: ID; decisionNote?: string }[]
```

- [ ] **Step 4: `leads-sync.ts`**

```ts
import { LEADS, LEAD_ACTIVITIES } from './leads'
import { QUOTATIONS } from './quotations'
import { applyLeadWon } from './index'
import { registerNewServerProject } from './projects-sync'
import { upsertServerParty } from './parties-sync'
import type { Lead, LeadActivity } from '~/types/lead'
import type { Quotation, QuotationServiceItem } from '~/types/quotation'
import type { Project, ServiceTypeKey } from '~/types/project'
import type { LeadDto, LeadWriteInput, QuotationContentInput, SalesQuotationDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `LEADS`, `LEAD_ACTIVITIES`, `QUOTATIONS` (S6a). The server owns leads, their activities, client quotations
 * (one row per version) and Won. Writes go to the server first; its answer replaces the local object in place.
 * B2C sales orders stay local until S6b: a lead's local `salesOrderId`/`projectId` survives a merge when the server has none.
 */

type SalesApi = Pick<ManovaApi, 'core' | 'sales'>
const idr = (minor: string | null | undefined) => (minor === null || minor === undefined ? undefined : Number(minor))
const minor = (value: number | undefined | null) => (value === undefined || value === null ? null : String(Math.round(value)))
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function activityFromServer (a: LeadDto['activities'][number]): LeadActivity {
  const out: LeadActivity = { id: a.id, leadId: a.leadId, type: a.type, message: a.message, ownerId: a.ownerUserId, createdAt: a.activityDate }
  if (a.dueOn) { out.dueAt = a.dueOn }
  return out
}

export function leadFromServer (d: LeadDto, local?: Lead): Lead {
  const b2c = d.b2c as Partial<Lead> & { projectId?: string; salesOrderId?: string }
  return {
    id: d.id,
    name: d.name,
    companyName: opt(d.companyName),
    title: opt(d.title),
    source: d.source as Lead['source'],
    stage: d.stage,
    ownerId: d.ownerUserId,
    handedOverTo: opt(d.handedOverTo),
    phone: opt(d.phone),
    email: opt(d.email),
    qualificationNotes: opt(d.qualificationNotes),
    expectedCloseDate: opt(d.expectedCloseDate),
    createdAt: d.createdOn,
    lastUpdatedAt: d.lastUpdatedOn,
    archived: d.archived,
    partyId: opt(d.partyId),
    qualifiedAt: opt(d.qualifiedOn),
    quotationId: opt(d.quotationId),
    projectId: d.wonProjectId ?? b2c.projectId ?? local?.projectId,
    salesOrderId: b2c.salesOrderId ?? local?.salesOrderId,
    serviceCategory: opt(d.serviceCategory) as Lead['serviceCategory'],
    destination: opt(d.destination),
    travelStartDate: opt(d.travelStartDate),
    travelEndDate: opt(d.travelEndDate),
    travelerEstimate: opt(d.travelerEstimate),
    serviceScope: d.serviceScope as ServiceTypeKey[],
    requirementSummary: opt(d.requirementSummary),
    budgetRange: opt(d.budgetRange),
    dateFlexible: opt(d.dateFlexible),
    decisionMaker: opt(d.decisionMaker),
    urgency: opt(d.urgency),
    specialRequestNote: opt(d.specialRequestNote),
    groupTripProjectId: b2c.groupTripProjectId,
    b2cAdultCount: b2c.b2cAdultCount,
    b2cChildCount: b2c.b2cChildCount,
    b2cInfantCount: b2c.b2cInfantCount,
    b2cPriceAcceptance: b2c.b2cPriceAcceptance,
    b2cBookingReadiness: b2c.b2cBookingReadiness,
    b2cQualificationResult: b2c.b2cQualificationResult,
    b2cNextFollowUpDate: b2c.b2cNextFollowUpDate
  }
}

export function quotationFromServer (d: SalesQuotationDto, wonLeadIds: Set<string>): Quotation {
  const previous = d.versions.find(v => v.version === d.currentVersion - 1)
  return {
    id: d.id,
    leadId: d.leadId,
    amountIdr: Number(d.amountMinor),
    createdAt: d.versions.find(v => v.version === d.currentVersion)?.createdOn ?? d.createdOn,
    accepted: wonLeadIds.has(d.leadId),
    version: d.currentVersion,
    supersededAmountIdr: idr(previous?.amountMinor),
    approvalStatus: d.status === 'superseded' ? 'draft' : d.status,
    approvedBy: opt(d.decidedBy),
    approvalNote: opt(d.decisionNote),
    discountIdr: idr(d.discountMinor),
    estimatedCostIdr: idr(d.estimatedCostMinor),
    estimatedMarginIdr: idr(d.estimatedMarginMinor),
    paymentTerms: opt(d.paymentTerms),
    serviceBreakdown: d.serviceBreakdown.map(s => ({ service: s.service as ServiceTypeKey, ...(s.description ? { description: s.description } : {}), amountIdr: Number(s.amountMinor) })),
    taxIdr: idr(d.taxMinor),
    markupIdr: idr(d.markupMinor),
    currency: d.currency,
    validUntil: opt(d.validUntil),
    termsAndConditions: opt(d.termsAndConditions),
    inclusions: opt(d.inclusions),
    exclusions: opt(d.exclusions),
    sentToClientAt: opt(d.sentToClientOn),
    cancellationPolicy: opt(d.cancellationPolicy),
    proposedItineraryNote: opt(d.proposedItineraryNote),
    costSheetId: opt(d.costSheetId),
    versions: d.versions.map(v => ({ version: v.version, status: v.status, amountIdr: Number(v.amountMinor), createdAt: v.createdOn, submittedBy: opt(v.submittedBy), decidedBy: opt(v.decidedBy), decisionNote: opt(v.decisionNote) }))
  }
}

/** Local → server content (form patches use the frontend `…Idr` fields). */
export function quotationInputFromLocal (patch: Partial<Quotation>): QuotationContentInput {
  const out: QuotationContentInput = {}
  if (patch.amountIdr !== undefined) { out.amountMinor = minor(patch.amountIdr)! }
  if ('discountIdr' in patch) { out.discountMinor = minor(patch.discountIdr) }
  if ('taxIdr' in patch) { out.taxMinor = minor(patch.taxIdr) }
  if ('markupIdr' in patch) { out.markupMinor = minor(patch.markupIdr) }
  if ('estimatedCostIdr' in patch) { out.estimatedCostMinor = minor(patch.estimatedCostIdr) }
  if ('estimatedMarginIdr' in patch) { out.estimatedMarginMinor = minor(patch.estimatedMarginIdr) }
  for (const k of ['currency', 'paymentTerms', 'validUntil', 'termsAndConditions', 'inclusions', 'exclusions', 'cancellationPolicy', 'proposedItineraryNote', 'costSheetId'] as const) {
    if (k in patch) { out[k] = patch[k] || null }
  }
  if (patch.serviceBreakdown) {
    out.serviceBreakdown = patch.serviceBreakdown.map((s: QuotationServiceItem) => ({ service: s.service, ...(s.description ? { description: s.description } : {}), amountMinor: minor(s.amountIdr)! }))
  }
  return out
}

const wonLeads = () => new Set(LEADS.filter(l => l.projectId && l.serviceCategory !== 'individual-travel').map(l => l.id))

export function upsertServerLead (d: LeadDto): Lead {
  const local = LEADS.find(l => l.id === d.id)
  const value = leadFromServer(d, local)
  for (let i = LEAD_ACTIVITIES.length - 1; i >= 0; i--) {
    if (LEAD_ACTIVITIES[i]!.leadId === d.id) { LEAD_ACTIVITIES.splice(i, 1) }
  }
  LEAD_ACTIVITIES.push(...d.activities.map(activityFromServer))
  if (!local) {
    LEADS.push(value)
    return LEADS[LEADS.length - 1]!
  }
  for (const k of Object.keys(local) as (keyof Lead)[]) {
    if (!(k in value)) { delete local[k] }
  }
  Object.assign(local, value)
  return local
}

export function upsertServerQuotation (d: SalesQuotationDto): Quotation {
  const value = quotationFromServer(d, wonLeads())
  const local = QUOTATIONS.find(q => q.id === d.id)
  const lead = LEADS.find(l => l.id === d.leadId)
  if (lead) { lead.quotationId = d.id }
  if (!local) {
    QUOTATIONS.push(value)
    return QUOTATIONS[QUOTATIONS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerLeads (leads: LeadDto[], quotations: SalesQuotationDto[]): void {
  const keep = new Set(leads.map(l => l.id))
  for (let i = LEADS.length - 1; i >= 0; i--) {
    if (!keep.has(LEADS[i]!.id)) { LEADS.splice(i, 1) }
  }
  LEAD_ACTIVITIES.splice(0, LEAD_ACTIVITIES.length)
  for (const l of leads) { upsertServerLead(l) }
  const keepQ = new Set(quotations.map(q => q.id))
  for (let i = QUOTATIONS.length - 1; i >= 0; i--) {
    if (!keepQ.has(QUOTATIONS[i]!.id)) { QUOTATIONS.splice(i, 1) }
  }
  for (const q of quotations) { upsertServerQuotation(q) }
}

export async function loadServerLeads (api: SalesApi): Promise<void> {
  const [leads, quotations] = await Promise.all([api.sales.listLeads(), api.sales.listQuotations()])
  mergeServerLeads(leads.data, quotations.data)
}

async function reloadParty (api: SalesApi, partyId: string | undefined) {
  if (!partyId) { return }
  try {
    upsertServerParty((await api.core.getParty(partyId)).data)
  } catch {
    // The next customer sync brings it.
  }
}

export async function createLeadOnServer (api: SalesApi, input: LeadWriteInput & { name: string; source: string }, key: string = newIdempotencyKey()): Promise<Lead> {
  return upsertServerLead((await api.sales.createLead(input, key)).data)
}
export async function patchLeadOnServer (api: SalesApi, id: string, patch: LeadWriteInput): Promise<Lead> {
  return upsertServerLead((await api.sales.updateLead(id, patch)).data)
}
export async function archiveLeadOnServer (api: SalesApi, id: string, reason?: string): Promise<Lead> {
  return upsertServerLead((await api.sales.archiveLead(id, reason)).data)
}
export async function reopenLeadOnServer (api: SalesApi, id: string): Promise<Lead> {
  return upsertServerLead((await api.sales.reopenLead(id)).data)
}
export async function unqualifyLeadOnServer (api: SalesApi, id: string, reason: string): Promise<Lead> {
  return upsertServerLead((await api.sales.unqualifyLead(id, reason)).data)
}
export async function mergeLeadOnServer (api: SalesApi, id: string, intoId: string): Promise<Lead> {
  const dup = upsertServerLead((await api.sales.mergeLead(id, intoId)).data)
  upsertServerLead((await api.sales.getLead(intoId)).data)
  return dup
}
export async function addLeadActivityOnServer (api: SalesApi, id: string, input: { type: LeadActivity['type']; message: string; dueOn?: string }): Promise<Lead> {
  return upsertServerLead((await api.sales.addLeadActivity(id, input)).data)
}
export async function completeLeadActivityOnServer (api: SalesApi, id: string, activityId: string): Promise<Lead> {
  return upsertServerLead((await api.sales.completeLeadActivity(id, activityId)).data)
}
/** Qualify: the server checks the form fields and links (or creates) the customer; that customer is reloaded. */
export async function qualifyLeadOnServer (api: SalesApi, id: string, customerKind: 'company' | 'individual'): Promise<Lead> {
  const lead = upsertServerLead((await api.sales.qualifyLead(id, { customerKind })).data)
  await reloadParty(api, lead.partyId)
  return lead
}

export async function createQuotationOnServer (api: SalesApi, leadId: string, input: Partial<Quotation> & { amountIdr: number }, key: string = newIdempotencyKey()): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.createQuotation(leadId, quotationInputFromLocal(input) as QuotationContentInput & { amountMinor: string }, key)).data)
}
export async function updateQuotationOnServer (api: SalesApi, id: string, patch: Partial<Quotation>): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.updateQuotation(id, quotationInputFromLocal(patch))).data)
}
/** "Revisi": a draft latest version is edited in place; a submitted/decided one gets a new draft version. */
export async function reviseQuotationOnServer (api: SalesApi, id: string, patch: Partial<Quotation> = {}): Promise<Quotation> {
  const current = QUOTATIONS.find(q => q.id === id)
  const input = quotationInputFromLocal(patch)
  const res = !current?.approvalStatus || current.approvalStatus === 'draft'
    ? await api.sales.updateQuotation(id, input)
    : await api.sales.reviseQuotation(id, input)
  return upsertServerQuotation(res.data)
}
export async function submitQuotationOnServer (api: SalesApi, id: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.submitQuotation(id)).data)
}
export async function withdrawQuotationOnServer (api: SalesApi, id: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.withdrawQuotation(id)).data)
}
export async function approveQuotationOnServer (api: SalesApi, id: string, note?: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.approveQuotation(id, note)).data)
}
export async function rejectQuotationOnServer (api: SalesApi, id: string, note: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.rejectQuotation(id, note)).data)
}
/** Send: the server records the date; the client portal login stays local (portal hidden, ADR-006). */
export async function sendQuotationOnServer (api: SalesApi, id: string, actorId: string, ensureLocalClientLogin: (leadId: string, actorId: string) => unknown = () => undefined): Promise<Quotation> {
  const q = upsertServerQuotation((await api.sales.sendQuotation(id)).data)
  ensureLocalClientLogin(q.leadId, actorId)
  return q
}
/** Mark as Won: the server creates (or returns) the project; the local activity entry and client login follow. */
export async function markLeadWonOnServer (api: SalesApi, leadId: string, approverId: string, key: string = newIdempotencyKey()): Promise<Project> {
  const res = (await api.sales.markLeadWon(leadId, key)).data
  const project = registerNewServerProject(res.project)
  upsertServerLead(res.lead)
  applyLeadWon(leadId, project, approverId)
  const q = QUOTATIONS.find(x => x.leadId === leadId)
  if (q) { q.accepted = true }
  await reloadParty(api, project.partyId)
  return project
}

export interface LeadsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads leads and quotations once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useLeadsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<LeadsSyncState>('manova-leads-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerLeads(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Lead & quotation belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
```

Catatan: `applyLeadWon` diekspor dari `data/index.ts` (cek impor sirkular — bila `index.ts` mengimpor `leads-sync`, impor `applyLeadWon` langsung dari modul yang mendefinisikannya). `registerNewServerProject` & `upsertServerParty` sudah diekspor (dipakai `markLeadWonOnServer` lama). Pengguna portal (client) mendapat 403 dari `/leads` → state `error`; `dashboard.vue` hanya memuat leads bila peran internal: `if (!['client', 'vendor'].includes(currentUser.value.role)) leadsSync.load(force)`.

- [ ] **Step 5: hapus pendahulu** — `projects-sync.ts`: hapus `markLeadWonOnServer` lama (dan `prepareLeadWon` dari `data/index.ts` bila tidak dipakai lagi; `toServerInput` tetap bila dipakai fungsi lain); pindahkan/ubah test lama yang memanggilnya di `projects-sync.test.ts` (hapus kasus Won lama — kini diuji di `leads-sync.test.ts`). `parties-sync.ts`: hapus `ensureCustomerForLead` + test-nya di `parties-sync.test.ts`. `layouts/dashboard.vue`: `useLeadsSync`, `leadsSync.load(force)` di `loadServerData`, label `'lead & quotation'` di `unsyncedLabel`, pesan di `unsyncedMessage`. `settings.vue` reset: panggil `useLeadsSync().load(true)` seperti sync lain.
- [ ] **Step 6:** `pnpm vitest run app/data/leads-sync.test.ts` → PASS; `pnpm test` PASS; vue-tsc total ≤ 2000; lint per file tidak bertambah.
- [ ] **Step 7:** Commit `feat(frontend): api.sales + leads-sync — lead & quotation dari server (S6a)`.

---

### Task 9: Frontend — UI sales lewat server + guard

**Files:**
- Modify: `frontend/app/components/sales/LeadDetailSheet.vue`, `frontend/app/pages/crm/leads/[id]/index.vue`, `frontend/app/components/sales/SalesLeadsPanel.vue`, `frontend/app/components/sales/SalesQuotationsPanel.vue`, `frontend/app/pages/lead-intake/index.vue`, `frontend/app/pages/project-orders/[id]/index.vue`
- Create: `frontend/app/no-local-sales.test.ts`

**Interfaces:**
- Consumes: semua fungsi tulis `leads-sync.ts` (Task 8).

Peta pengganti (lokal → server). Setiap handler menjadi `async`, menahan dobel klik dengan flag `isSaving`, menampilkan `showToast('… Gagal', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')` saat gagal, dan menutup dialog / toast sukses hanya setelah server menjawab:

| Lokal | Server |
|---|---|
| `createLead(input)` (+ `updateLeadQualification` sesudahnya di lead-intake) | `createLeadOnServer(api, { ...input tanpa ownerId, ...qualification })` (`ownerId` diambil server dari aktor) |
| `updateLeadContact(id, patch)`, `updateLeadQualification(id, patch)` | `patchLeadOnServer(api, id, patch)` (B2C: hanya field `b2c…` + `groupTripProjectId` dibungkus `{ b2c: {...lead.b2c lama, ...patch} }`) |
| `archiveLead(id)` / `reopenLead(id)` | `archiveLeadOnServer(api, id)` / `reopenLeadOnServer(api, id)` |
| `markLeadUnqualified(id, note)` | `unqualifyLeadOnServer(api, id, note)` — dialog: tombol nonaktif bila catatan kosong; Group Trip: `note || 'Hasil qualification Group Trip: tidak memenuhi syarat.'` |
| `mergeLeadAsDuplicate(dup, into, actor)` | `mergeLeadOnServer(api, dup, into)` |
| `createLeadActivity({ leadId, type, message, dueAt })` | `addLeadActivityOnServer(api, leadId, { type, message, dueOn: dueAt })` |
| `ensureCustomerForLead` + `qualifyLeadForQuotation` | `qualifyLeadOnServer(api, id, 'company')` |
| `ensureCustomerForLead('individual')` + `qualifyLeadAndCreateSalesOrder` | `qualifyLeadOnServer(api, id, 'individual')` lalu `qualifyLeadAndCreateSalesOrder` lokal (tetap) |
| `qualifyGroupTripLead(id, …)` hasil `qualified` | `qualifyLeadOnServer(api, id, 'individual')` lalu `qualifyGroupTripLead` lokal; field B2C disimpan dengan `patchLeadOnServer` |
| `createQuotation(leadId, amount)` | `createQuotationOnServer(api, leadId, { amountIdr })` |
| `reviseQuotation(id, amount)` | `reviseQuotationOnServer(api, id, { amountIdr })` |
| `duplicateQuotationVersion(id)` | `reviseQuotationOnServer(api, id)` |
| `updateQuotationDetails(id, patch)` | `updateQuotationOnServer(api, id, patch)` |
| `submitQuotationForApproval(id)` / `withdrawQuotationSubmission(id)` | `submitQuotationOnServer` / `withdrawQuotationOnServer` |
| `approveQuotation(id, actor, note)` / `rejectQuotation(id, actor, note)` | `approveQuotationOnServer(api, id, note)` / `rejectQuotationOnServer(api, id, note)` |
| `sendQuotationToClient(id, actor)` | `sendQuotationOnServer(api, id, actor, (leadId, a) => { const l = getLeadById(leadId); if (l) { ensureClientLoginAccount(l, a) } })` (ekspor `ensureClientLoginAccount` dari `data/index.ts` bila belum) |
| `markLeadWonOnServer` (projects-sync) | `markLeadWonOnServer` (leads-sync), tanda tangan sama |

- [ ] **Step 1: Test gagal** — `no-local-sales.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Leads, their activities and client quotations live on the server (S6a): screens never call the local mutators. */
const FORBIDDEN = [
  'createLead(', 'updateLeadContact(', 'updateLeadQualification(', 'archiveLead(', 'reopenLead(', 'markLeadUnqualified(', 'mergeLeadAsDuplicate(',
  'createLeadActivity(', 'qualifyLeadForQuotation(', 'ensureCustomerForLead(', 'createQuotation(', 'reviseQuotation(', 'duplicateQuotationVersion(',
  'updateQuotationDetails(', 'submitQuotationForApproval(', 'withdrawQuotationSubmission(', 'approveQuotation(', 'rejectQuotation(', 'sendQuotationToClient('
]
const ROOTS = ['pages', 'components', 'composables', 'layouts']
const appDir = __dirname
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

function sources (dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { return sources(path) }
    return /\.(vue|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('no local sales mutators in screens (leads & quotations come from the server)', () => {
  const files = ROOTS.flatMap(root => sources(join(appDir, root))).map(file => ({ name: relative(appDir, file).replace(/\\/g, '/'), file }))

  it('ignores server calls with the same name', () => {
    expect(used('await api.sales.createQuotation(id, body)', 'createQuotation(')).toBe(false)
    expect(used('createQuotationOnServer(api, id, x)', 'createQuotation(')).toBe(false)
    expect(used('createQuotation(id, 5)', 'createQuotation(')).toBe(true)
  })

  it.each(files.map(({ name, file }) => [name, file]))('%s', (_name, file) => {
    expect(FORBIDDEN.filter(name => used(readFileSync(file, 'utf8'), name))).toEqual([])
  })
})
```

(Bila halaman client portal — `pages/client/**`, disembunyikan ADR-006 — memanggil salah satu mutator, kecualikan dengan pola `KNOWN_PORTAL = [/^pages\/client\//, /^components\/client\//]` seperti `no-mock-finance.test.ts` dan ledger sebagai ruling.)

- [ ] **Step 2:** `pnpm vitest run app/no-local-sales.test.ts` → FAIL (daftar file yang masih memanggil).
- [ ] **Step 3:** Alihkan `LeadDetailSheet.vue` sesuai peta. Contoh pola (handler Qualify B2B):

```ts
async function doQualify () {
  if (!selectedLead.value || qualificationMissing.value.length > 0 || isQualifying.value) { return }
  isQualifying.value = true
  try {
    await saveQualificationDraft()
    if (isIndividualTravel.value) {
      if (!qualifySalesOrderPriceIdr.value || qualifySalesOrderPriceIdr.value <= 0) { return }
      const lead = await qualifyLeadOnServer(api, selectedLead.value.id, 'individual')
      const order = qualifyLeadAndCreateSalesOrder(lead.id, { priceIdr: qualifySalesOrderPriceIdr.value, partyId: lead.partyId! })
      isQualifyDialogOpen.value = false
      if (order) { navigateTo(`/sales-orders/${order.id}`) }
      return
    }
    await qualifyLeadOnServer(api, selectedLead.value.id, 'company')
    isQualifyDialogOpen.value = false
    drawerTab.value = 'quotation'
  } catch (error) {
    showToast('Qualify Gagal', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
  } finally {
    isQualifying.value = false
  }
}
```

`saveQualificationDraft` menjadi `async` dan memanggil `patchLeadOnServer` (B2B: field kebutuhan; B2C: juga `b2c`). `qualifyLeadAndCreateSalesOrder` lokal membaca `lead.partyId`; karena lead sudah `qualified` dari server, cek syarat di dalam fungsi lokal itu (mis. `lead.stage !== 'qualified'`) — bila fungsi lokal menolak lead yang sudah qualified, longgarkan kondisi itu di `data/index.ts` (ruling). `wonApi` diganti satu `const api = useApi()`.

- [ ] **Step 4:** Alihkan `pages/crm/leads/[id]/index.vue` (quotation + Won, logika sama dengan sheet), `SalesLeadsPanel.vue` (create + B2C quick qualify), `SalesQuotationsPanel.vue` (approve/reject), `pages/lead-intake/index.vue` (create dengan field qualification sekaligus), `pages/project-orders/[id]/index.vue` (Group Trip: server qualify sebelum `qualifyGroupTripLead`).
- [ ] **Step 5:** Kartu quotation (sheet + halaman detail) menampilkan riwayat versi bila `quotation.versions?.length > 1`: daftar ringkas `v{version} · {formatCurrencyIdr(amountIdr)} · {status label}` dengan label `superseded` → "Digantikan", lainnya pakai label status approval yang sudah ada.
- [ ] **Step 6:** `pnpm vitest run app/no-local-sales.test.ts` → PASS; `pnpm test` PASS; vue-tsc ≤ 2000; lint per file tidak bertambah vs HEAD; `pnpm build` sukses.
- [ ] **Step 7:** Commit `feat(frontend): lead, quotation & Won lewat server di UI sales (S6a)`.

---

### Task 10: Dokumentasi, DB lokal, smoke

**Files:**
- Modify: `docs/manova-finance-implementation/adr/` (catatan S6a di ADR-004, pola S4b), spec status → "diimplementasikan", `CLAUDE.md` root bila daftar seed berubah (tidak berubah — lewati)

- [ ] **Step 1:** Catatan ADR-004: lead/quotation milik API (S6a), aturan seed ulang (stage & versi tidak ditimpa), FK `projects` NOT VALID.
- [ ] **Step 2:** DB lokal — hentikan backend dev (`bueo31yc0`) dulu (PGlite satu proses), lalu di `backend/`: `bun run db:migrate` dan `bun run db:seed:demo` (`.env` lokal menunjuk `.data/pglite-year`); jalankan ulang `bun run dev` di background.
- [ ] **Step 3: Smoke** pada salinan DB di port 3100: login admin → `GET /leads` (31), qualify lead baru, buat quotation, submit, approve, Won → project dengan nilai kontrak versi disetujui; login finance → `POST /leads` 403. Matikan dengan `taskkill //T //F //PID`.
- [ ] **Step 4:** Commit `docs: catatan S6a lead & quotation di ADR-004`.
