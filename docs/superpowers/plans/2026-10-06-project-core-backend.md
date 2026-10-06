# Backend Project inti + fondasi tulis (S0 + S3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project dibuat dan diedit di server (bukan lagi di array mock), langsung dikenal Finance, dengan nilai kontrak yang hanya bisa diubah Finance/Super Admin.

**Architecture:** Backend menambah kolom project, tabel `id_sequences` (ID `PRJ-341` dst. dari server), dan endpoint POST/PATCH/PUT di modul `core` dengan capability, audit, dan idempotency. Frontend mengisi array `PROJECTS` yang sudah ada dari `GET /projects` setelah sesi server siap (halaman tidak berubah), dan mutator buat/edit project memanggil API lalu menggabungkan hasilnya ke array.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (backend, `bun test`), Nuxt 4 + Vue 3 + Vitest (frontend, pnpm).

**Spec:** `docs/superpowers/specs/2026-10-06-project-core-backend-design.md`

## Global Constraints

- Package manager: `bun` di `backend/`, `pnpm` di `frontend/`. Jangan menambah lockfile lain.
- Uang: `bigint` minor unit di SQL, string desimal (`contractValueMinor`) di API; jangan `number` untuk uang di backend. Pakai `parseAmountMinor` dari `src/shared/money.ts`.
- JSON param SQL: `$n::text::jsonb` dengan `JSON.stringify(...)`.
- Setiap baca/tulis memakai `auth.requireActor` / `auth.requireCapability` dan scope dari `src/modules/core/scope.ts`. Di luar scope → 404.
- Error: `errors.*` / `AppError` dari `src/http/errors.ts`; aturan bisnis → 422 `RULE_VIOLATION`. Pesan Bahasa Indonesia untuk pengguna akhir.
- Audit perubahan dengan `recordAudit` di transaksi yang sama.
- Capability baru ditambahkan di `backend/src/auth/rbac.ts` **dan** `frontend/app/data/rbac.ts` dalam commit yang sama.
- Perubahan bentuk response API → perbarui `frontend/app/types/api.ts` dan `frontend/app/lib/api/endpoints.ts` di commit yang sama.
- Migrasi baru = pasangan `migrations/0017_project_core_writes.up.sql` + `.down.sql`; jangan mengubah migrasi lama.
- Test baru dengan SQL baru juga dijalankan di PostgreSQL (`TEST_DATABASE_URL`) bila tersedia.
- Komentar dan gaya kode mengikuti file di sekitarnya (komentar Inggris di backend, Indonesia/Inggris campuran di frontend sesuai file).
- Commit setiap task selesai (lokal; jangan push — push ke `production` = deploy).

## Review Focus

1. Admin membuat project untuk customer yang dibuat di UI (belum ada di server) → harus dapat pesan jelas "Customer belum tersimpan di server", bukan error generik. (Task 2 menguji 422 + `fieldErrors.partyId`; Task 6 menampilkan pesan server.)
2. Tombol "Buat project" diklik dua kali / jaringan lambat → satu project saja. (Task 2 menguji idempotency; Task 6 memakai satu `idempotencyKey` per pengisian form.)
3. Server mati saat halaman dibuka → daftar project tetap tampil dari data lokal dengan banner, bukan halaman kosong. (Task 5 menguji `load()` offline mempertahankan array.)
4. Finance menurunkan nilai kontrak di bawah yang sudah ditagih → ditolak dengan pesan yang menyebut nominal tertagih. (Task 3.)
5. Membuat project tepat setelah seed demo → ID tidak bentrok dengan fixture (PRJ-341, bukan PRJ-103). (Task 1 menguji `syncIdSequences` setelah seed; Task 2 menguji ID pertama `PRJ-341`.)

---

## File Structure

**Backend**
- Create `backend/migrations/0017_project_core_writes.up.sql` / `.down.sql` — kolom project + `id_sequences`.
- Create `backend/src/shared/ids.ts` — `nextId`, `syncIdSequences` (S0, dipakai ulang tahap berikutnya).
- Create `backend/src/modules/core/project-writes.ts` — validasi + create/update/contract-value project.
- Modify `backend/src/modules/core/repository.ts` — kolom baru di SELECT dan view internal.
- Modify `backend/src/modules/core/routes.ts` — POST/PATCH/PUT.
- Modify `backend/src/auth/rbac.ts` — `finance.edit-contract-value`.
- Modify `backend/src/db/seed-demo.ts`, `backend/scripts/extract-demo-core.ts`, regenerate `backend/src/db/seeds/demo-core.json`.
- Create `backend/test/project-writes.test.ts`; modify `backend/test/db.test.ts`, `backend/test/rbac.test.ts`.
- Modify `backend/CLAUDE.md` — pola endpoint tulis.

**Frontend**
- Modify `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`.
- Create `frontend/app/data/projects-sync.ts` (+ `projects-sync.test.ts`, `projects-sync.test-utils.ts`).
- Modify `frontend/app/data/index.ts` — hapus `createProject`/`markLeadWon` lokal, tambah `prepareLeadWon`/`applyLeadWon`, export `seedDefaultProjectMilestones`.
- Modify `frontend/app/layouts/dashboard.vue` — muat project dari server + banner.
- Modify pages: `project-orders/index.vue`, `crm/parties/[id]/index.vue`, `customer-journey/customers/[id]/index.vue`, `project-orders/[id]/index.vue`, `crm/leads/[id]/index.vue`, `client/quotations/[id]/index.vue`, `components/sales/LeadDetailSheet.vue`, `pages/settings.vue`.
- Create `frontend/app/components/finance/FinanceContractValueDialog.vue`; modify `FinanceProjectPanel.vue`.
- Modify `frontend/app/data/rbac.ts`; tests `project-order-workflow.test.ts`, `project-service-budget.test.ts`.

---

### Task 1: Migrasi, `id_sequences`, dan seed demo membawa kolom baru

**Files:**
- Create: `backend/migrations/0017_project_core_writes.up.sql`, `backend/migrations/0017_project_core_writes.down.sql`
- Create: `backend/src/shared/ids.ts`
- Modify: `backend/src/db/seed-demo.ts` (type `DemoCoreSeed.projects`, upsert project, akhir transaksi)
- Modify: `backend/scripts/extract-demo-core.ts` (blok `projects:`)
- Regenerate: `backend/src/db/seeds/demo-core.json`
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces: `nextId(q: Queryable, prefix: IdPrefix, width?: number): Promise<string>`; `syncIdSequences(q: Queryable): Promise<void>`; `type IdPrefix = 'PRJ-' | 'PTY-'`. Kolom `projects.characteristic`, `service_scope`, `traveler_count`, `is_group_trip`, `lead_id`, `source_quotation_id`, `tour_leader_name`, `tour_leader_phone`, `emergency_contact_name`, `emergency_contact_phone`, `meeting_point`.

- [ ] **Step 1: Tulis test yang gagal** — tambahkan di akhir `describe` seed demo di `backend/test/db.test.ts` (pakai helper `makeTestDb`/`migrateUp`/`seedDemo` yang sudah diimpor di file itu; cek nama import di atas file):

```ts
  test('project operational columns and id sequences follow the seed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [p] = await db.query<{ characteristic: string; service_scope: string[]; traveler_count: number }>(
        "select characteristic, service_scope, traveler_count from projects where id = 'PRJ-103'"
      )
      const fixture = DEMO_CORE.projects.find(x => x.id === 'PRJ-103')!
      expect(p).toEqual({ characteristic: fixture.characteristic, service_scope: fixture.serviceScope, traveler_count: fixture.travelerCount })
      const seq = await db.query<{ prefix: string; last_value: number }>('select prefix, last_value from id_sequences order by prefix')
      const maxOf = (ids: string[], prefix: string) => Math.max(...ids.filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length))))
      expect(seq).toEqual([
        { prefix: 'PRJ-', last_value: maxOf(DEMO_CORE.projects.map(x => x.id), 'PRJ-') },
        { prefix: 'PTY-', last_value: maxOf(DEMO_CORE.parties.map(x => x.id), 'PTY-') }
      ])
      expect(await nextId(db, 'PRJ-')).toBe(`PRJ-${seq[0]!.last_value + 1}`)
    } finally {
      await cleanup()
    }
  })
```

Tambahkan import di atas file: `import { nextId } from '../src/shared/ids'`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && bun test test/db.test.ts -t "id sequences"`
Expected: FAIL (`Cannot find module '../src/shared/ids'` atau kolom `characteristic` tidak ada).

- [ ] **Step 3: Migrasi**

`backend/migrations/0017_project_core_writes.up.sql`:

```sql
-- Project core moves to the server (S3a): operational header fields owned by the Project module, and
-- server-generated IDs that keep the legacy prefixes (PRJ-341 …) so deep links stay the same shape.
alter table projects
  add column characteristic text not null default 'normal' check (characteristic in ('normal', 'high-change', 'complex')),
  add column service_scope text[] not null default '{}'
    check (service_scope <@ array['flight', 'hotel', 'transportation', 'mice', 'additional']::text[]),
  add column traveler_count integer not null default 0 check (traveler_count >= 0),
  add column is_group_trip boolean not null default false,
  add column lead_id text,
  add column source_quotation_id text,
  add column tour_leader_name text,
  add column tour_leader_phone text,
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column meeting_point text;

-- One row per ID prefix; nextId() increments it under a row lock (insert … on conflict do update).
create table id_sequences (
  prefix     text primary key check (prefix ~ '^[A-Z]+-$'),
  last_value integer not null check (last_value >= 0)
);

insert into id_sequences (prefix, last_value)
select 'PRJ-', coalesce(max(substring(id from '^PRJ-([0-9]+)$')::integer), 0) from projects
union all
select 'PTY-', coalesce(max(substring(id from '^PTY-([0-9]+)$')::integer), 0) from parties;
```

`backend/migrations/0017_project_core_writes.down.sql`:

```sql
drop table if exists id_sequences;
alter table projects
  drop column if exists characteristic,
  drop column if exists service_scope,
  drop column if exists traveler_count,
  drop column if exists is_group_trip,
  drop column if exists lead_id,
  drop column if exists source_quotation_id,
  drop column if exists tour_leader_name,
  drop column if exists tour_leader_phone,
  drop column if exists emergency_contact_name,
  drop column if exists emergency_contact_phone,
  drop column if exists meeting_point;
```

- [ ] **Step 4: `backend/src/shared/ids.ts`**

```ts
import type { Queryable } from '../db/client'

/**
 * Server-generated IDs that keep the legacy text format of the frontend fixtures (PRJ-341, PTY-031 …), so
 * deep links and finance references look the same as before. One counter per prefix in `id_sequences`;
 * the upsert takes a row lock, so concurrent creates never get the same number.
 */
export type IdPrefix = 'PRJ-' | 'PTY-'

const SOURCES: Record<IdPrefix, string> = { 'PRJ-': 'projects', 'PTY-': 'parties' }

export async function nextId(q: Queryable, prefix: IdPrefix, width = 3): Promise<string> {
  const [row] = await q.query<{ last_value: number }>(
    `insert into id_sequences (prefix, last_value) values ($1, 1)
     on conflict (prefix) do update set last_value = id_sequences.last_value + 1
     returning last_value`,
    [prefix]
  )
  return `${prefix}${String(row!.last_value).padStart(width, '0')}`
}

/** Raises every counter to at least the highest ID already present (after a seed or an import). */
export async function syncIdSequences(q: Queryable): Promise<void> {
  for (const [prefix, table] of Object.entries(SOURCES)) {
    await q.query(
      `insert into id_sequences (prefix, last_value)
       select $1, coalesce(max(substring(id from '^' || $2 || '([0-9]+)$')::integer), 0) from ${table}
       on conflict (prefix) do update set last_value = greatest(id_sequences.last_value, excluded.last_value)`,
      [prefix, prefix]
    )
  }
}
```

- [ ] **Step 5: Seed demo** — di `backend/src/db/seed-demo.ts`:

Perluas tipe proyek di `DemoCoreSeed.projects` (setelah `contractValueMinor`):

```ts
    characteristic?: 'normal' | 'high-change' | 'complex'
    serviceScope?: string[]
    travelerCount?: number
    isGroupTrip?: boolean
    leadId?: string | null
    sourceQuotationId?: string | null
    tourLeaderName?: string | null
    tourLeaderPhone?: string | null
    emergencyContactName?: string | null
    emergencyContactPhone?: string | null
    meetingPoint?: string | null
```

Ganti query upsert project dengan:

```ts
      await tx.query(
        `insert into projects (id, name, party_id, destination, travel_start_date, travel_end_date, status, owner_user_id, provenance, contract_value_minor,
                               characteristic, service_scope, traveler_count, is_group_trip, lead_id, source_quotation_id,
                               tour_leader_name, tour_leader_phone, emergency_contact_name, emergency_contact_phone, meeting_point)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text($12::text::jsonb) as x), $13, $14, $15, $16, $17, $18, $19, $20, $21)
         on conflict (id) do update set name = excluded.name, party_id = excluded.party_id,
           destination = excluded.destination, travel_start_date = excluded.travel_start_date,
           travel_end_date = excluded.travel_end_date, status = excluded.status,
           owner_user_id = excluded.owner_user_id, contract_value_minor = excluded.contract_value_minor,
           characteristic = excluded.characteristic, service_scope = excluded.service_scope,
           traveler_count = excluded.traveler_count, is_group_trip = excluded.is_group_trip,
           lead_id = excluded.lead_id, source_quotation_id = excluded.source_quotation_id,
           tour_leader_name = excluded.tour_leader_name, tour_leader_phone = excluded.tour_leader_phone,
           emergency_contact_name = excluded.emergency_contact_name, emergency_contact_phone = excluded.emergency_contact_phone,
           meeting_point = excluded.meeting_point, updated_at = now()
         where projects.provenance = 'demo-fixture'`,
        [p.id, p.name, p.partyId, p.destination, p.travelStartDate, p.travelEndDate, p.status, p.ownerUserId, P, p.contractValueMinor,
          p.characteristic ?? 'normal', JSON.stringify(p.serviceScope ?? []), p.travelerCount ?? 0, p.isGroupTrip ?? false,
          p.leadId ?? null, p.sourceQuotationId ?? null, p.tourLeaderName ?? null, p.tourLeaderPhone ?? null,
          p.emergencyContactName ?? null, p.emergencyContactPhone ?? null, p.meetingPoint ?? null]
      )
```

Di akhir callback transaksi (sebelum `insert into audit_events … seed.demo_applied`), tambahkan `await syncIdSequences(tx)` dan import `import { syncIdSequences } from '../shared/ids'`.

- [ ] **Step 6: Extract** — di `backend/scripts/extract-demo-core.ts`, blok `projects:` tambahkan setelah `contractValueMinor: …`:

```ts
    characteristic: p.characteristic,
    serviceScope: [...p.serviceScope],
    travelerCount: p.travelerCount,
    isGroupTrip: p.isGroupTrip ?? false,
    leadId: p.leadId ?? null,
    sourceQuotationId: p.sourceQuotationId ?? null,
    tourLeaderName: p.tourLeaderName ?? null,
    tourLeaderPhone: p.tourLeaderPhone ?? null,
    emergencyContactName: p.emergencyContactName ?? null,
    emergencyContactPhone: p.emergencyContactPhone ?? null,
    meetingPoint: p.meetingPoint ?? null
```

Run: `cd backend && bun run seed:extract`
Expected: `projects=51` dan `demo-core.json` kini memuat `characteristic`/`serviceScope` per project. Pastikan test kunci uang `db.test.ts` ("carries operational reference values only") tetap lulus (tidak ada key `…Minor`/`…Idr` baru).

- [ ] **Step 7: Jalankan test**

Run: `cd backend && bun test test/db.test.ts test/core-scope.test.ts test/year-demo-seed.test.ts`
Expected: PASS semua.

- [ ] **Step 8: Commit**

```bash
git add backend/migrations/0017_project_core_writes.up.sql backend/migrations/0017_project_core_writes.down.sql backend/src/shared/ids.ts backend/src/db/seed-demo.ts backend/scripts/extract-demo-core.ts backend/src/db/seeds/demo-core.json backend/test/db.test.ts
git commit -m "feat(core): kolom operasional project dan id_sequences (S0)"
```

---

### Task 2: Buat dan edit project lewat API

**Files:**
- Create: `backend/src/modules/core/project-writes.ts`
- Modify: `backend/src/modules/core/repository.ts` (ProjectRow, ProjectInternalView, projectView, PROJECT_SELECT)
- Modify: `backend/src/modules/core/routes.ts`
- Test: `backend/test/project-writes.test.ts`

**Interfaces:**
- Consumes: `nextId` (Task 1), `getProject(db, actor, id)` (repository), `parseAmountMinor`, `isIsoDate`, `recordAudit`, `withIdempotency`/`requireIdempotencyKey`.
- Produces: `createProject(tx, actor, input: ProjectCreateInput, requestId): Promise<{ id: string }>`, `updateProject(tx, actor, id, input: ProjectPatchInput, requestId): Promise<void>`, `GROUP_TRIP_PARTY_NAME = 'MANOVA Group Trip (Internal)'`. Endpoint `POST /api/v1/projects` (201, body = project detail), `PATCH /api/v1/projects/:id` (200, body = project detail). Field DTO internal baru: `characteristic, serviceScope, travelerCount, isGroupTrip, leadId, sourceQuotationId, tourLeaderName, tourLeaderPhone, emergencyContactName, emergencyContactPhone, meetingPoint`.

- [ ] **Step 1: Tulis test yang gagal** — `backend/test/project-writes.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

let t: TestApp
const c: Record<string, string> = {}

beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let keyN = 0
const key = () => `test-key-${++keyN}-abcdef`
const valid = (over: Record<string, unknown> = {}) => ({
  name: 'Uji Coba Tokyo', partyId: 'PTY-002', destination: 'Tokyo, Jepang',
  travelStartDate: '2027-03-10', travelEndDate: '2027-03-15', characteristic: 'normal',
  serviceScope: ['flight', 'hotel'], travelerCount: 12, contractValueMinor: '450000000', ...over
})
const post = (who: string, body: unknown, k: string | null = key()) =>
  t.call('POST', '/api/v1/projects', { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('POST /projects', () => {
  test('admin creates a draft project with a server id after the fixtures', async () => {
    const res = await post('admin', valid())
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({
      id: 'PRJ-341', name: 'Uji Coba Tokyo', partyId: 'PTY-002', status: 'draft', provenance: 'manual',
      characteristic: 'normal', serviceScope: ['flight', 'hotel'], travelerCount: 12, contractValueMinor: '450000000',
      ownerUserId: expect.any(String), isGroupTrip: false
    })
    expect(res.json.data.teamUserIds).toEqual([res.json.data.ownerUserId])
    const [audit] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'project.created' and entity_id = 'PRJ-341'")
    expect(audit!.n).toBe('1')
  })

  test('the same idempotency key creates one project', async () => {
    const k = key()
    const a = await post('admin', valid({ name: 'Sekali Saja' }), k)
    const b = await post('admin', valid({ name: 'Sekali Saja' }), k)
    expect(b.status).toBe(201)
    expect(b.json.data.id).toBe(a.json.data.id)
    expect(b.headers.get('idempotent-replayed')).toBe('true')
  })

  test('idempotency key is required', async () => {
    const res = await post('admin', valid(), null)
    expect(res.status).toBe(400)
    expect(res.json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  test('validation names each bad field', async () => {
    const res = await post('admin', valid({ name: ' ', destination: '', travelStartDate: '2027-03-20', travelEndDate: '2027-03-10', travelerCount: 0, serviceScope: ['boat'], contractValueMinor: '-5', characteristic: 'wild' }))
    expect(res.status).toBe(400)
    expect(Object.keys(res.json.error.fieldErrors).sort()).toEqual(['characteristic', 'contractValueMinor', 'destination', 'name', 'serviceScope', 'travelEndDate', 'travelerCount'])
  })

  test('a customer that is not on the server is a 422 the UI can explain', async () => {
    const res = await post('admin', valid({ partyId: 'PTY-999' }))
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('Customer belum tersimpan di server')
  })

  test('group trip uses the placeholder party, created when missing', async () => {
    const res = await post('admin', valid({ partyId: undefined, isGroupTrip: true, name: 'Open Trip Bali' }))
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ partyId: 'PTY-009', isGroupTrip: true })
    await t.db.query("update projects set party_id = 'PTY-001' where party_id = 'PTY-009'")
    await t.db.query("update sales_order_refs set party_id = 'PTY-001' where party_id = 'PTY-009'")
    await t.db.query("delete from parties where id = 'PTY-009'")
    const again = await post('admin', valid({ partyId: undefined, isGroupTrip: true, name: 'Open Trip Lombok' }))
    expect(again.status).toBe(201)
    expect(again.json.data.partyId).toMatch(/^PTY-0[3-9][0-9]$/)
    const [party] = await t.db.query<{ name: string; party_type: string }>('select name, party_type from parties where id = $1', [again.json.data.partyId])
    expect(party).toEqual({ name: 'MANOVA Group Trip (Internal)', party_type: 'individual' })
  })

  test('finance cannot create projects; anonymous gets 401', async () => {
    expect((await post('finance', valid())).status).toBe(403)
    expect((await t.call('POST', '/api/v1/projects', { body: valid(), headers: { 'idempotency-key': key() } })).status).toBe(401)
  })
})

describe('PATCH /projects/:id', () => {
  test('admin edits header and field contacts; audit keeps before/after', async () => {
    const res = await t.call('PATCH', '/api/v1/projects/PRJ-101', {
      cookie: c.admin, body: { destination: 'Cebu, Filipina', travelerCount: 7, tourLeaderName: 'Andi', meetingPoint: 'Terminal 3' }
    })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ destination: 'Cebu, Filipina', travelerCount: 7, tourLeaderName: 'Andi', meetingPoint: 'Terminal 3' })
    const [audit] = await t.db.query<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
      "select before, after from audit_events where action = 'project.updated' and entity_id = 'PRJ-101' order by id desc limit 1"
    )
    expect(audit!.before).toMatchObject({ destination: 'Manila, Filipina' })
    expect(audit!.after).toMatchObject({ destination: 'Cebu, Filipina', travelerCount: 7 })
  })

  test('status, customer and contract value cannot be patched', async () => {
    for (const body of [{ status: 'confirmed' }, { partyId: 'PTY-002' }, { contractValueMinor: '1' }]) {
      const res = await t.call('PATCH', '/api/v1/projects/PRJ-101', { cookie: c.admin, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
  })

  test('dates stay ordered against the stored value', async () => {
    const res = await t.call('PATCH', '/api/v1/projects/PRJ-101', { cookie: c.admin, body: { travelEndDate: '2026-01-01' } })
    expect(res.status).toBe(400)
    expect(res.json.error.fieldErrors).toHaveProperty('travelEndDate')
  })

  test('finance 403, client outside scope 404', async () => {
    expect((await t.call('PATCH', '/api/v1/projects/PRJ-101', { cookie: c.finance, body: { name: 'X' } })).status).toBe(403)
    expect((await t.call('PATCH', '/api/v1/projects/PRJ-999', { cookie: c.admin, body: { name: 'X' } })).status).toBe(404)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && bun test test/project-writes.test.ts`
Expected: FAIL (404 ROUTE_NOT_FOUND untuk POST).

- [ ] **Step 3: View di repository** — di `backend/src/modules/core/repository.ts`:

Tambahkan ke `ProjectRow`:

```ts
  characteristic: string
  service_scope: string[]
  traveler_count: number
  is_group_trip: boolean
  lead_id: string | null
  source_quotation_id: string | null
  tour_leader_name: string | null
  tour_leader_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  meeting_point: string | null
```

Tambahkan ke `ProjectInternalView` (setelah `contractCurrency`):

```ts
  characteristic: string
  serviceScope: string[]
  travelerCount: number
  isGroupTrip: boolean
  leadId: string | null
  sourceQuotationId: string | null
  tourLeaderName: string | null
  tourLeaderPhone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  meetingPoint: string | null
```

Di `projectView`, objek internal tambahkan setelah `contractCurrency: r.contract_currency`:

```ts
    characteristic: r.characteristic,
    serviceScope: r.service_scope ?? [],
    travelerCount: r.traveler_count,
    isGroupTrip: r.is_group_trip,
    leadId: r.lead_id,
    sourceQuotationId: r.source_quotation_id,
    tourLeaderName: r.tour_leader_name,
    tourLeaderPhone: r.tour_leader_phone,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    meetingPoint: r.meeting_point
```

Di `PROJECT_SELECT`, tambahkan kolom setelah `p.contract_currency,`:

```sql
         p.characteristic, p.service_scope, p.traveler_count, p.is_group_trip, p.lead_id, p.source_quotation_id,
         p.tour_leader_name, p.tour_leader_phone, p.emergency_contact_name, p.emergency_contact_phone, p.meeting_point,
```

- [ ] **Step 4: `backend/src/modules/core/project-writes.ts`**

```ts
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { ID_PATTERN } from '../../http/envelope'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/**
 * Project header writes (S3a). Status, team, services and the contract value after creation are NOT
 * changed here: status/team/services still live in the frontend until their stage moves, and the contract
 * value has its own Finance-only command (`setContractValue`).
 */

export const GROUP_TRIP_PARTY_NAME = 'MANOVA Group Trip (Internal)'
export const CHARACTERISTICS = ['normal', 'high-change', 'complex'] as const
export const SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional'] as const
const CONTACT_FIELDS = ['tourLeaderName', 'tourLeaderPhone', 'emergencyContactName', 'emergencyContactPhone', 'meetingPoint'] as const
const CONTACT_COLUMNS: Record<(typeof CONTACT_FIELDS)[number], string> = {
  tourLeaderName: 'tour_leader_name',
  tourLeaderPhone: 'tour_leader_phone',
  emergencyContactName: 'emergency_contact_name',
  emergencyContactPhone: 'emergency_contact_phone',
  meetingPoint: 'meeting_point'
}

export interface ProjectCreateInput {
  name?: string
  partyId?: string
  isGroupTrip?: boolean
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  characteristic?: string
  serviceScope?: string[]
  travelerCount?: number
  contractValueMinor?: string
  leadId?: string
  sourceQuotationId?: string
}

export interface ProjectPatchInput {
  name?: string
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  characteristic?: string
  serviceScope?: string[]
  travelerCount?: number
  tourLeaderName?: string | null
  tourLeaderPhone?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  meetingPoint?: string | null
}

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

function text(value: unknown, field: string, problems: FieldErrors, label: string, max = 200): string | undefined {
  if (value === undefined) return undefined
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) { problems[field] = [`${label} wajib diisi.`]; return undefined }
  if (s.length > max) { problems[field] = [`${label} maksimal ${max} karakter.`]; return undefined }
  return s
}

function optionalText(value: unknown, field: string, problems: FieldErrors, max = 200): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems[field] = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s || null
}

function date(value: unknown, field: string, problems: FieldErrors): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !isIsoDate(value)) { problems[field] = ['Tanggal harus format YYYY-MM-DD.']; return undefined }
  return value
}

function header(input: ProjectCreateInput | ProjectPatchInput, problems: FieldErrors) {
  const out: Record<string, unknown> = {}
  out.name = text(input.name, 'name', problems, 'Nama project')
  out.destination = text(input.destination, 'destination', problems, 'Tujuan')
  out.travelStartDate = date(input.travelStartDate, 'travelStartDate', problems)
  out.travelEndDate = date(input.travelEndDate, 'travelEndDate', problems)
  if (input.characteristic !== undefined) {
    if ((CHARACTERISTICS as readonly string[]).includes(input.characteristic)) out.characteristic = input.characteristic
    else problems.characteristic = [`Harus salah satu dari: ${CHARACTERISTICS.join(', ')}.`]
  }
  if (input.serviceScope !== undefined) {
    const scope = Array.isArray(input.serviceScope) ? [...new Set(input.serviceScope)] : []
    if (!scope.length) problems.serviceScope = ['Pilih minimal satu layanan.']
    else if (scope.some(s => !(SERVICE_TYPES as readonly string[]).includes(s))) problems.serviceScope = [`Layanan harus salah satu dari: ${SERVICE_TYPES.join(', ')}.`]
    else out.serviceScope = scope
  }
  if (input.travelerCount !== undefined) {
    if (Number.isInteger(input.travelerCount) && input.travelerCount >= 1 && input.travelerCount <= 100_000) out.travelerCount = input.travelerCount
    else problems.travelerCount = ['Jumlah traveler minimal 1.']
  }
  return out
}

function checkDates(start: unknown, end: unknown, problems: FieldErrors) {
  if (typeof start === 'string' && typeof end === 'string' && start > end && !problems.travelEndDate) {
    problems.travelEndDate = ['Tanggal selesai tidak boleh sebelum tanggal mulai.']
  }
}

async function groupTripPartyId(tx: Queryable): Promise<string> {
  const [found] = await tx.query<{ id: string }>('select id from parties where name = $1 order by id limit 1', [GROUP_TRIP_PARTY_NAME])
  if (found) return found.id
  const id = await nextId(tx, 'PTY-')
  await tx.query(
    "insert into parties (id, name, lifecycle_status, party_type) values ($1, $2, 'client', 'individual')",
    [id, GROUP_TRIP_PARTY_NAME]
  )
  return id
}

export async function createProject(tx: Queryable, actor: Actor, input: ProjectCreateInput, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const h = header(input, problems)
  for (const [field, label] of [['name', 'Nama project'], ['destination', 'Tujuan'], ['travelStartDate', 'Tanggal mulai'], ['travelEndDate', 'Tanggal selesai']] as const) {
    if (input[field] === undefined) problems[field] = [`${label} wajib diisi.`]
  }
  if (input.serviceScope === undefined) problems.serviceScope = ['Pilih minimal satu layanan.']
  if (input.travelerCount === undefined) problems.travelerCount = ['Jumlah traveler minimal 1.']
  checkDates(h.travelStartDate, h.travelEndDate, problems)
  let contract: bigint | null = null
  try {
    contract = parseAmountMinor(input.contractValueMinor, 'contractValueMinor', { allowZero: true })
  } catch {
    problems.contractValueMinor = ['Nilai kontrak harus angka rupiah ≥ 0.']
  }
  if (!input.isGroupTrip && (!input.partyId || !ID_PATTERN.test(input.partyId))) problems.partyId = ['Pilih customer.']
  for (const ref of ['leadId', 'sourceQuotationId'] as const) {
    if (input[ref] !== undefined && !ID_PATTERN.test(input[ref]!)) problems[ref] = ['ID tidak valid.']
  }
  if (Object.keys(problems).length) throw errors.validation(problems)

  let partyId: string
  if (input.isGroupTrip) {
    partyId = await groupTripPartyId(tx)
  } else {
    const [party] = await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId])
    if (!party) throw rule('Customer belum tersimpan di server. Simpan customer ini dulu, lalu buat project lagi.')
    partyId = party.id
  }

  const id = await nextId(tx, 'PRJ-')
  await tx.query(
    `insert into projects (id, name, party_id, destination, travel_start_date, travel_end_date, status, owner_user_id,
                           contract_value_minor, characteristic, service_scope, traveler_count, is_group_trip, lead_id, source_quotation_id)
     values ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9,
             (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text($10::text::jsonb) as x),
             $11, $12, $13, $14)`,
    [id, h.name, partyId, h.destination, h.travelStartDate, h.travelEndDate, actor.userId, contract!.toString(),
      h.characteristic ?? 'normal', JSON.stringify(h.serviceScope), h.travelerCount, input.isGroupTrip === true,
      input.leadId ?? null, input.sourceQuotationId ?? null]
  )
  await tx.query('insert into project_members (project_id, user_id) values ($1, $2) on conflict do nothing', [id, actor.userId])
  await recordAudit(tx, {
    action: 'project.created', actorUserId: actor.userId, entityType: 'project', entityId: id, requestId,
    after: { name: h.name, partyId, destination: h.destination, travelStartDate: h.travelStartDate, travelEndDate: h.travelEndDate,
      serviceScope: h.serviceScope, travelerCount: h.travelerCount, contractValueMinor: contract!.toString(), isGroupTrip: input.isGroupTrip === true }
  })
  return { id }
}

const FORBIDDEN_PATCH = ['status', 'partyId', 'contractValueMinor', 'contractCurrency', 'isGroupTrip', 'ownerUserId', 'teamUserIds', 'id']

export async function updateProject(tx: Queryable, actor: Actor, id: string, input: ProjectPatchInput & Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN_PATCH.includes(k))
  if (blocked.length) {
    throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit project.']])))
  }
  const [current] = await tx.query<Record<string, any>>(
    `select name, destination, travel_start_date, travel_end_date, characteristic, service_scope, traveler_count,
            tour_leader_name, tour_leader_phone, emergency_contact_name, emergency_contact_phone, meeting_point
       from projects where id = $1 for update`,
    [id]
  )
  if (!current) throw errors.notFound('Project')
  const problems: FieldErrors = {}
  const h = header(input, problems)
  const contacts: Record<string, string | null | undefined> = {}
  for (const f of CONTACT_FIELDS) contacts[f] = optionalText(input[f], f, problems)
  checkDates(h.travelStartDate ?? current.travel_start_date, h.travelEndDate ?? current.travel_end_date, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const sets: string[] = []
  const params: unknown[] = [id]
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  const set = (column: string, field: string, value: unknown, old: unknown, sql = `$${params.length + 1}`) => {
    params.push(value)
    sets.push(`${column} = ${sql}`)
    before[field] = old
    after[field] = value
  }
  if (h.name !== undefined) set('name', 'name', h.name, current.name)
  if (h.destination !== undefined) set('destination', 'destination', h.destination, current.destination)
  if (h.travelStartDate !== undefined) set('travel_start_date', 'travelStartDate', h.travelStartDate, current.travel_start_date)
  if (h.travelEndDate !== undefined) set('travel_end_date', 'travelEndDate', h.travelEndDate, current.travel_end_date)
  if (h.characteristic !== undefined) set('characteristic', 'characteristic', h.characteristic, current.characteristic)
  if (h.travelerCount !== undefined) set('traveler_count', 'travelerCount', h.travelerCount, current.traveler_count)
  if (h.serviceScope !== undefined) {
    params.push(JSON.stringify(h.serviceScope))
    sets.push(`service_scope = (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text($${params.length}::text::jsonb) as x)`)
    before.serviceScope = current.service_scope
    after.serviceScope = h.serviceScope
  }
  for (const f of CONTACT_FIELDS) {
    if (contacts[f] !== undefined) set(CONTACT_COLUMNS[f], f, contacts[f], current[CONTACT_COLUMNS[f]])
  }
  if (!sets.length) return
  await tx.query(`update projects set ${sets.join(', ')}, updated_at = now() where id = $1`, params)
  await recordAudit(tx, { action: 'project.updated', actorUserId: actor.userId, entityType: 'project', entityId: id, requestId, before, after })
}
```

> Catatan implementer: periksa `parseAmountMinor` di `src/shared/money.ts` — bila ia sudah melempar `errors.validation` dengan nama field, `try/catch` di atas tetap benar (kita mengganti pesannya). Pastikan `projects` punya kolom `updated_at` (dipakai `seed-demo.ts`, jadi ada).

- [ ] **Step 5: Route** — di `backend/src/modules/core/routes.ts`, tambahkan import:

```ts
import { requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { createProject, updateProject } from './project-writes'
```

(gabungkan `requestIdOf` ke import `../../http/envelope` yang sudah ada). Ganti komentar header file menjadi: `Core references. Reads for every module; project header writes (S3a) — status, team and services stay in the frontend until their stage moves. Out-of-scope IDs return 404 exactly like missing ones.` Lalu setelah route `.get('/projects/:id', …)` tambahkan:

```ts
    .post('/projects', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'project-order.manage-operations')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects', key, body }, async tx =>
        createProject(tx, actor, body as Parameters<typeof createProject>[2], requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getProject(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/projects/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'project-order.manage-operations')
      const id = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
      await db.transaction(tx => updateProject(tx, actor, id, body as Parameters<typeof updateProject>[3], requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
```

- [ ] **Step 6: Jalankan test**

Run: `cd backend && bun test test/project-writes.test.ts`
Expected: PASS. Bila test group trip gagal karena FK lain ke `PTY-009` (mis. `users.party_id`), tambahkan `update users set party_id = null …` hanya bila ada baris; jangan ubah kode produksi untuk test.

- [ ] **Step 7: Test lama + typecheck**

Run: `cd backend && bun run typecheck && bun test test/core-scope.test.ts test/finance-arap.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/core/project-writes.ts backend/src/modules/core/repository.ts backend/src/modules/core/routes.ts backend/test/project-writes.test.ts
git commit -m "feat(core): buat dan edit project lewat API"
```

---

### Task 3: Ubah nilai kontrak (Finance) dan integrasi Finance

**Files:**
- Modify: `backend/src/auth/rbac.ts` (CAPABILITY_GRANTS)
- Modify: `frontend/app/data/rbac.ts` (SEED_CAPABILITIES)
- Modify: `backend/src/modules/core/project-writes.ts` (tambah `setContractValue`)
- Modify: `backend/src/modules/core/routes.ts`
- Test: `backend/test/project-writes.test.ts`, `backend/test/rbac.test.ts` (bila ada assertion daftar capability finance)

**Interfaces:**
- Consumes: `createProject` (Task 2), `projectFinanceSummary(db, projectId, full)` dari `src/modules/finance/summaries.ts`.
- Produces: capability `finance.edit-contract-value` (finance + super-admin); `setContractValue(tx, actor, id, input: { contractValueMinor?: string; reason?: string }, billedMinor: bigint, requestId): Promise<void>`; endpoint `PUT /api/v1/projects/:id/contract-value` (200, body = project detail).

- [ ] **Step 1: Tulis test yang gagal** — tambahkan ke `backend/test/project-writes.test.ts`:

```ts
describe('PUT /projects/:id/contract-value and finance', () => {
  test('a new project is billable at once; contract value cannot drop below what is billed', async () => {
    const created = await post('admin', valid({ name: 'Integrasi Finance', contractValueMinor: '200000000' }))
    const id = created.json.data.id as string
    const draft = await t.call('POST', '/api/v1/finance/customer-invoices', {
      cookie: c.finance, body: { projectId: id, invoiceType: 'dp', lines: [{ description: 'DP 50%', amountMinor: '100000000' }], dueDate: '2027-02-01' }
    })
    expect(draft.status).toBe(201)
    const issued = await t.call('POST', `/api/v1/finance/customer-invoices/${draft.json.data.id}/issue`, { cookie: c.finance, body: { dueDate: '2027-02-01' } })
    expect(issued.status).toBe(200)
    const summary = await t.call('GET', `/api/v1/projects/${id}/finance-summary`, { cookie: c.finance })
    expect(summary.json.data).toMatchObject({ contractValueMinor: '200000000', receivable: { invoicedMinor: '100000000', uninvoicedMinor: '100000000' } })

    const tooLow = await t.call('PUT', `/api/v1/projects/${id}/contract-value`, { cookie: c.finance, body: { contractValueMinor: '90000000', reason: 'Diskon' } })
    expect(tooLow.status).toBe(422)
    expect(tooLow.json.error.message).toContain('Rp')

    const ok = await t.call('PUT', `/api/v1/projects/${id}/contract-value`, { cookie: c.finance, body: { contractValueMinor: '150000000', reason: 'Peserta berkurang' } })
    expect(ok.status).toBe(200)
    expect(ok.json.data.contractValueMinor).toBe('150000000')
    const [audit] = await t.db.query<{ reason: string; before: Record<string, string>; after: Record<string, string> }>(
      "select reason, before, after from audit_events where action = 'project.contract_value_changed' and entity_id = $1", [id]
    )
    expect(audit).toEqual({ reason: 'Peserta berkurang', before: { contractValueMinor: '200000000' }, after: { contractValueMinor: '150000000' } })
  })

  test('reason is required; admin cannot change it; super-admin can', async () => {
    expect((await t.call('PUT', '/api/v1/projects/PRJ-104/contract-value', { cookie: c.finance, body: { contractValueMinor: '1000' } })).status).toBe(400)
    expect((await t.call('PUT', '/api/v1/projects/PRJ-104/contract-value', { cookie: c.admin, body: { contractValueMinor: '1000', reason: 'x' } })).status).toBe(403)
    expect((await t.call('PUT', '/api/v1/projects/PRJ-104/contract-value', { cookie: c.superAdmin, body: { contractValueMinor: '125000000', reason: 'Revisi kontrak' } })).status).toBe(200)
  })
})
```

> Implementer: cek bentuk body `issue` dan field `receivable` di test finance yang sudah ada (`test/finance-arap.test.ts`) dan sesuaikan bila nama berbeda; inti assertion (bisa ditagih, 422 di bawah tertagih, audit) tidak berubah.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && bun test test/project-writes.test.ts -t "contract-value"`
Expected: FAIL (404 route / capability tidak dikenal).

- [ ] **Step 3: Capability** — `backend/src/auth/rbac.ts`, di blok "Finance capability matrix" setelah `'finance.view-project-finance': ['finance']` tambahkan (dengan koma):

```ts
  /** Contract value after creation (ADR-007: owned by Project, corrected by Finance with a reason). */
  'finance.edit-contract-value': ['finance']
```

`frontend/app/data/rbac.ts`, di `SEED_CAPABILITIES` setelah baris `'finance.close-period': ['finance'],` tambahkan:

```ts
  'finance.edit-contract-value': ['finance'],
```

- [ ] **Step 4: `setContractValue`** — tambahkan ke `backend/src/modules/core/project-writes.ts`:

```ts
const formatRp = (minor: bigint) => `Rp ${minor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

export async function setContractValue(
  tx: Queryable, actor: Actor, id: string, input: { contractValueMinor?: string; reason?: string }, billedMinor: bigint, requestId: string
): Promise<void> {
  const problems: FieldErrors = {}
  let value: bigint | null = null
  try {
    value = parseAmountMinor(input.contractValueMinor, 'contractValueMinor', { allowZero: true })
  } catch {
    problems.contractValueMinor = ['Nilai kontrak harus angka rupiah ≥ 0.']
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) problems.reason = ['Alasan perubahan wajib diisi.']
  else if (reason.length > 500) problems.reason = ['Maksimal 500 karakter.']
  if (Object.keys(problems).length) throw errors.validation(problems)

  const [current] = await tx.query<{ contract_value_minor: string | null }>('select contract_value_minor from projects where id = $1 for update', [id])
  if (!current) throw errors.notFound('Project')
  if (value! < billedMinor) {
    throw rule(`Nilai kontrak tidak boleh di bawah yang sudah ditagih (${formatRp(billedMinor)}). Terbitkan credit note dulu bila tagihan memang turun.`)
  }
  await tx.query('update projects set contract_value_minor = $2, updated_at = now() where id = $1', [id, value!.toString()])
  await recordAudit(tx, {
    action: 'project.contract_value_changed', actorUserId: actor.userId, entityType: 'project', entityId: id, requestId, reason,
    before: { contractValueMinor: current.contract_value_minor }, after: { contractValueMinor: value!.toString() }
  })
}
```

- [ ] **Step 5: Route** — di `routes.ts` tambahkan import `import { projectFinanceSummary } from '../finance/summaries'` dan ubah import project-writes menjadi `import { createProject, setContractValue, updateProject } from './project-writes'`. Setelah route PATCH:

```ts
    .put('/projects/:id/contract-value', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.edit-contract-value')
      const id = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
      // "Sudah ditagih" exactly as the project finance summary shows it (issued − credit notes + write-offs).
      const summary = await projectFinanceSummary(db, id, true)
      const r = summary.view === 'full' ? summary.receivable : null
      const billed = r ? BigInt(r.invoicedMinor) - BigInt(r.creditedMinor) : 0n
      await db.transaction(tx => setContractValue(tx, actor, id, body, billed, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Object({ contractValueMinor: t.Optional(t.String()), reason: t.Optional(t.String()) }) })
```

> Implementer: bila `receivable` tidak punya `creditedMinor`, gunakan field yang dipakai `summaries.ts` untuk `billed` (`invoicedMinor − creditedMinor` di `projectFinanceSummary`). Bila ada import melingkar core↔finance, pindahkan perhitungan billed ke fungsi kecil di `summaries.ts` (`billedMinorOf(db, projectId)`) dan impor itu.

- [ ] **Step 6: Test RBAC** — jalankan `cd backend && bun test test/rbac.test.ts`. Bila test "every finance.* capability is finance-only" gagal karena daftar eksplisit, tambahkan `finance.edit-contract-value` ke daftar yang diharapkan di test itu.

- [ ] **Step 7: Jalankan test**

Run: `cd backend && bun test test/project-writes.test.ts test/rbac.test.ts test/finance-permissions.test.ts && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/auth/rbac.ts frontend/app/data/rbac.ts backend/src/modules/core/project-writes.ts backend/src/modules/core/routes.ts backend/test/project-writes.test.ts backend/test/rbac.test.ts
git commit -m "feat(core): nilai kontrak project diubah Finance dengan alasan"
```

---

### Task 4: Tipe API dan penggabungan project server ke `PROJECTS`

**Files:**
- Modify: `frontend/app/types/api.ts` (ProjectInternalDto + input types)
- Modify: `frontend/app/lib/api/endpoints.ts` (blok `core`)
- Modify: `frontend/app/data/index.ts` (export `seedDefaultProjectMilestones`)
- Create: `frontend/app/data/projects-sync.ts`
- Create: `frontend/app/data/projects-sync.test-utils.ts`
- Test: `frontend/app/data/projects-sync.test.ts`

**Interfaces:**
- Consumes: endpoint Task 2–3.
- Produces:
  - `api.core.createProject(input: ProjectCreateInput, idempotencyKey?: string)`, `api.core.updateProject(id, input: ProjectPatchInput)`, `api.core.setContractValue(id, input: ContractValueInput)` — semua `Promise<ApiSuccess<ProjectDetailDto>>`.
  - `upsertServerProject(dto: ProjectDto): Project | undefined`, `mergeServerProjects(list: ProjectDto[]): void`, `registerNewServerProject(dto: ProjectDto): Project`.
  - Test util `serverProjectDto(over?: Partial<ProjectInternalDto>): ProjectInternalDto`.

- [ ] **Step 1: Tipe** — di `frontend/app/types/api.ts`, tambahkan sebelum `ProjectInternalDto`:

```ts
export type ApiProjectCharacteristic = 'normal' | 'high-change' | 'complex'
export type ApiServiceType = 'flight' | 'hotel' | 'transportation' | 'mice' | 'additional'
```

Tambahkan ke `ProjectInternalDto` setelah `contractCurrency: string`:

```ts
  characteristic: ApiProjectCharacteristic
  serviceScope: ApiServiceType[]
  travelerCount: number
  isGroupTrip: boolean
  leadId: string | null
  sourceQuotationId: string | null
  tourLeaderName: string | null
  tourLeaderPhone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  meetingPoint: string | null
```

Setelah `export type ProjectDetailDto = …` tambahkan:

```ts
export interface ProjectCreateInput {
  name: string
  partyId?: string
  isGroupTrip?: boolean
  destination: string
  travelStartDate: IsoDate
  travelEndDate: IsoDate
  characteristic?: ApiProjectCharacteristic
  serviceScope: ApiServiceType[]
  travelerCount: number
  contractValueMinor: MoneyMinor
  leadId?: string
  sourceQuotationId?: string
}

export interface ProjectPatchInput {
  name?: string
  destination?: string
  travelStartDate?: IsoDate
  travelEndDate?: IsoDate
  characteristic?: ApiProjectCharacteristic
  serviceScope?: ApiServiceType[]
  travelerCount?: number
  tourLeaderName?: string | null
  tourLeaderPhone?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  meetingPoint?: string | null
}

export interface ContractValueInput {
  contractValueMinor: MoneyMinor
  reason: string
}
```

- [ ] **Step 2: Endpoint** — di `frontend/app/lib/api/endpoints.ts`, tambahkan `ContractValueInput, ProjectCreateInput, ProjectPatchInput` ke import tipe, lalu di blok `core` setelah `getProject`:

```ts
      createProject: (input: ProjectCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ProjectDetailDto>('/projects', input, { idempotencyKey }),
      updateProject: (id: string, input: ProjectPatchInput) => client.patch<ProjectDetailDto>(`/projects/${seg(id)}`, input),
      setContractValue: (id: string, input: ContractValueInput) => client.put<ProjectDetailDto>(`/projects/${seg(id)}/contract-value`, input),
```

- [ ] **Step 3: Export milestone default** — di `frontend/app/data/index.ts` ubah `function seedDefaultProjectMilestones (project: Project): void {` menjadi `export function seedDefaultProjectMilestones (project: Project): void {`.

- [ ] **Step 4: Test util** — `frontend/app/data/projects-sync.test-utils.ts`:

```ts
import type { ProjectInternalDto } from '~/types/api'

/** A server project as `GET /projects` returns it to internal roles (for tests only). */
export function serverProjectDto (over: Partial<ProjectInternalDto> = {}): ProjectInternalDto {
  return {
    id: 'PRJ-901',
    name: 'Project Uji',
    destination: 'Yogyakarta, Indonesia',
    travelStartDate: '2027-03-20',
    travelEndDate: '2027-03-23',
    status: 'draft',
    partyId: 'PTY-001',
    partyName: 'PT Cipta Distribusi Nusantara',
    ownerUserId: 'USR-002',
    teamUserIds: ['USR-002'],
    provenance: 'manual',
    contractValueMinor: '100000000',
    contractCurrency: 'IDR',
    characteristic: 'normal',
    serviceScope: ['flight'],
    travelerCount: 5,
    isGroupTrip: false,
    leadId: null,
    sourceQuotationId: null,
    tourLeaderName: null,
    tourLeaderPhone: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    meetingPoint: null,
    ...over
  }
}
```

- [ ] **Step 5: Tulis test yang gagal** — `frontend/app/data/projects-sync.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { PROJECTS } from './projects'
import { getProjectMilestones } from './project-order-workflow'
import { mergeServerProjects, registerNewServerProject, upsertServerProject } from './projects-sync'
import { serverProjectDto } from './projects-sync.test-utils'

const original = PROJECTS.map(p => ({ ...p }))
afterEach(() => { PROJECTS.splice(0, PROJECTS.length, ...original.map(p => ({ ...p }))) })

describe('projects-sync', () => {
  it('memperbarui project yang ada di tempat (objek sama) dan mempertahankan field lokal', () => {
    const before = PROJECTS.find(p => p.id === 'PRJ-101')!
    const budget = before.budgetIdr
    upsertServerProject(serverProjectDto({ id: 'PRJ-101', name: 'Manila Baru', destination: 'Cebu, Filipina', contractValueMinor: '99000000', tourLeaderName: 'Andi' }))
    const after = PROJECTS.find(p => p.id === 'PRJ-101')!
    expect(after).toBe(before)
    expect(after).toMatchObject({ name: 'Manila Baru', destination: 'Cebu, Filipina', quotationAmountIdr: 99_000_000, tourLeaderName: 'Andi', budgetIdr: budget })
  })

  it('nilai kontrak null (peran tanpa nominal) tidak menimpa nilai lokal', () => {
    const local = PROJECTS.find(p => p.id === 'PRJ-102')!.quotationAmountIdr
    upsertServerProject(serverProjectDto({ id: 'PRJ-102', contractValueMinor: null }))
    expect(PROJECTS.find(p => p.id === 'PRJ-102')!.quotationAmountIdr).toBe(local)
  })

  it('project baru dari server ditambahkan dengan default field lokal dan milestone standar', () => {
    const project = registerNewServerProject(serverProjectDto({ id: 'PRJ-950' }))
    expect(PROJECTS.at(-1)).toBe(project)
    expect(project).toMatchObject({ id: 'PRJ-950', status: 'draft', budgetIdr: 0, actualCostIdr: 0, quotationAmountIdr: 100_000_000, serviceScope: ['flight'] })
    expect(getProjectMilestones('PRJ-950')).toHaveLength(8)
  })

  it('merge menghapus project lokal yang tidak ada di server dan mengabaikan DTO portal', () => {
    mergeServerProjects([serverProjectDto({ id: 'PRJ-101' }), serverProjectDto({ id: 'PRJ-960' })])
    expect(PROJECTS.map(p => p.id)).toEqual(['PRJ-101', 'PRJ-960'])
    mergeServerProjects([{ id: 'PRJ-101', name: 'x', destination: null, travelStartDate: null, travelEndDate: null, status: 'draft' }])
    expect(PROJECTS.map(p => p.id)).toEqual(['PRJ-101', 'PRJ-960'])
  })
})
```

- [ ] **Step 6: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm exec vitest run app/data/projects-sync.test.ts`
Expected: FAIL (`./projects-sync` tidak ada).

- [ ] **Step 7: `frontend/app/data/projects-sync.ts`**

```ts
import { PROJECTS } from './projects'
import { resolveDestinationGeo } from './geo'
import { seedDefaultProjectMilestones } from './index'
import type { Project } from '~/types/project'
import { isInternalProject, type ProjectDto, type ProjectInternalDto } from '~/types/api'

/**
 * Server → `PROJECTS` (S3a, spec 2026-10-06-project-core-backend). The server owns the project header
 * (name, customer, dates, travelers, scope, contract value, field contacts); fields whose stage has not moved
 * yet (status workflow, handover, closure, budget, photo) stay in the local object. Objects are updated in
 * place so every page holding a reference keeps working.
 */

const DEFAULT_OWNER_ID = 'USR-002'

function serverFields (dto: ProjectInternalDto, local?: Project): Partial<Project> {
  const destination = dto.destination ?? local?.destination ?? ''
  return {
    id: dto.id,
    name: dto.name,
    partyId: dto.partyId,
    isGroupTrip: dto.isGroupTrip || undefined,
    leadId: dto.leadId ?? undefined,
    sourceQuotationId: dto.sourceQuotationId ?? undefined,
    destination,
    ...(destination !== local?.destination ? { destinationGeo: resolveDestinationGeo(destination) } : {}),
    travelStartDate: dto.travelStartDate ?? local?.travelStartDate ?? '',
    travelEndDate: dto.travelEndDate ?? local?.travelEndDate ?? '',
    characteristic: dto.characteristic,
    serviceScope: [...dto.serviceScope],
    travelerCount: dto.travelerCount,
    ownerId: dto.ownerUserId ?? local?.ownerId ?? DEFAULT_OWNER_ID,
    teamUserIds: dto.teamUserIds.length ? [...dto.teamUserIds] : local?.teamUserIds ?? [],
    status: dto.status,
    quotationAmountIdr: dto.contractValueMinor !== null ? Number(dto.contractValueMinor) : local?.quotationAmountIdr ?? 0,
    tourLeaderName: dto.tourLeaderName ?? undefined,
    tourLeaderPhone: dto.tourLeaderPhone ?? undefined,
    emergencyContactName: dto.emergencyContactName ?? undefined,
    emergencyContactPhone: dto.emergencyContactPhone ?? undefined,
    meetingPoint: dto.meetingPoint ?? undefined
  }
}

/** Updates (in place) or appends one server project. Portal DTOs carry no header fields and are ignored. */
export function upsertServerProject (dto: ProjectDto): Project | undefined {
  if (!isInternalProject(dto)) { return undefined }
  const local = PROJECTS.find(p => p.id === dto.id)
  if (local) {
    Object.assign(local, serverFields(dto, local))
    return local
  }
  const created = { budgetIdr: 0, actualCostIdr: 0, ...serverFields(dto) } as Project
  PROJECTS.push(created)
  return PROJECTS[PROJECTS.length - 1]
}

/** A project the user just created on the server: add it and give it the standard local milestones. */
export function registerNewServerProject (dto: ProjectDto): Project {
  const project = upsertServerProject(dto)
  if (!project) { throw new Error('Project baru harus berupa DTO internal.') }
  seedDefaultProjectMilestones(project)
  return project
}

/** The full server list replaces the local one (internal DTOs only; a portal list leaves the array alone). */
export function mergeServerProjects (list: ProjectDto[]): void {
  const internal = list.filter(isInternalProject)
  if (!internal.length && list.length) { return }
  const keep = new Set(internal.map(p => p.id))
  for (let i = PROJECTS.length - 1; i >= 0; i--) {
    if (!keep.has(PROJECTS[i]!.id)) { PROJECTS.splice(i, 1) }
  }
  for (const dto of internal) { upsertServerProject(dto) }
}
```

> Implementer: bila `PROJECTS.push` pada array `reactive()` mengembalikan proxy berbeda dari objek yang di-push, `PROJECTS[PROJECTS.length - 1]` sudah mengembalikan proxy — itu yang dipakai halaman. Pastikan `isInternalProject` dari `~/types/api` memeriksa `'partyId' in project`.

- [ ] **Step 8: Jalankan test**

Run: `cd frontend && pnpm exec vitest run app/data/projects-sync.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/types/api.ts frontend/app/lib/api/endpoints.ts frontend/app/data/index.ts frontend/app/data/projects-sync.ts frontend/app/data/projects-sync.test-utils.ts frontend/app/data/projects-sync.test.ts
git commit -m "feat(frontend): gabungkan project dari server ke PROJECTS"
```

---

### Task 5: Muat project dari server setelah sesi siap

**Files:**
- Modify: `frontend/app/data/projects-sync.ts` (tambah `useProjectsSync`)
- Modify: `frontend/app/layouts/dashboard.vue`
- Modify: `frontend/app/pages/settings.vue` (setelah Reset Demo Data)
- Test: `frontend/app/data/projects-sync.test.ts`

**Interfaces:**
- Consumes: `mergeServerProjects` (Task 4), `useServerSession().ensure()`, `useApi()`.
- Produces: `loadServerProjects(api: Pick<ManovaApi, 'core'>): Promise<number>` (jumlah project), `useProjectsSync(): { state: Ref<ProjectsSyncState>; load(force?: boolean): Promise<void> }`, `type ProjectsSyncState = { status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'; userId: string | null; message: string | null }`.

- [ ] **Step 1: Tulis test yang gagal** — tambahkan ke `projects-sync.test.ts` (import `loadServerProjects`):

```ts
describe('loadServerProjects', () => {
  it('mengambil semua halaman lalu menggabungkan', async () => {
    const pages = [
      { data: [serverProjectDto({ id: 'PRJ-101' })], meta: { pagination: { nextCursor: 'PRJ-101' } } },
      { data: [serverProjectDto({ id: 'PRJ-970' })], meta: { pagination: { nextCursor: null } } }
    ]
    const cursors: (string | undefined)[] = []
    const api = { core: { listProjects: async (q: { cursor?: string }) => { cursors.push(q.cursor); return pages.shift()! } } }
    expect(await loadServerProjects(api as never)).toBe(2)
    expect(cursors).toEqual([undefined, 'PRJ-101'])
    expect(PROJECTS.map(p => p.id)).toEqual(['PRJ-101', 'PRJ-970'])
  })

  it('server mati: array lokal tidak disentuh dan error diteruskan', async () => {
    const ids = PROJECTS.map(p => p.id)
    const api = { core: { listProjects: async () => { throw new Error('down') } } }
    await expect(loadServerProjects(api as never)).rejects.toThrow('down')
    expect(PROJECTS.map(p => p.id)).toEqual(ids)
  })
})
```

> Implementer: cek bentuk return `client.getList` di `lib/api/client.ts` (nama properti cursor, mis. `meta.pagination.nextCursor`) dan sesuaikan test + implementasi.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm exec vitest run app/data/projects-sync.test.ts`
Expected: FAIL (`loadServerProjects` tidak di-export).

- [ ] **Step 3: Implementasi** — tambahkan ke `projects-sync.ts`:

```ts
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/** Every page of `GET /projects`, merged only after the last page arrived (a failure leaves the array as is). */
export async function loadServerProjects (api: Pick<ManovaApi, 'core'>): Promise<number> {
  const all: ProjectDto[] = []
  let cursor: string | undefined
  for (let page = 0; page < 200; page++) {
    const res = await api.core.listProjects({ limit: 100, ...(cursor ? { cursor } : {}) })
    all.push(...res.data)
    const next = res.meta.pagination?.nextCursor ?? null
    if (!next) { break }
    cursor = next
  }
  mergeServerProjects(all)
  return all.length
}

export interface ProjectsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the projects once per signed-in user; the dashboard layout calls it, "Reset Demo Data" forces it. */
export function useProjectsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ProjectsSyncState>('manova-projects-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerProjects(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = {
        status: offline ? 'offline' : 'error',
        userId,
        message: isApiError(error) ? error.message : 'Daftar project belum bisa dimuat dari server.'
      }
    }
  }

  return { state, load }
}
```

> `useApi`, `useServerSession`, `useCurrentUser`, `useState` di-auto-import Nuxt di komposable; karena file ini di `app/data` (bukan `composables/`), impor eksplisit bila typecheck mengeluh: `import { useApi } from '~/composables/useApi'`, `import { useServerSession } from '~/composables/useServerSession'`, `import { useCurrentUser } from '~/composables/useCurrentUser'`, dan `useState` dari `#app`. Test hanya memakai `loadServerProjects` (tanpa Nuxt).

- [ ] **Step 4: Layout** — `frontend/app/layouts/dashboard.vue`:

```vue
<script setup lang="ts">
import { useProjectsSync } from '~/data/projects-sync'

const isMobile = useIsMobile()
const projectsSync = useProjectsSync()
const { currentUser } = useCurrentUser()
onMounted(() => { projectsSync.load() })
watch(() => currentUser.value.id, () => { projectsSync.load() })
</script>
```

Di template, tepat sebelum `<slot />` di dalam `<main>`:

```vue
        <div
          v-if="projectsSync.state.value.status === 'offline' || projectsSync.state.value.status === 'error'"
          role="status"
          class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <span>Daftar project belum tersinkron dengan server — yang tampil data lokal. {{ projectsSync.state.value.message }}</span>
          <Button size="sm" variant="outline" @click="projectsSync.load(true)">
            Coba lagi
          </Button>
        </div>
```

- [ ] **Step 5: Reset Demo Data** — di `frontend/app/pages/settings.vue`, cari handler yang memanggil `resetMockState()`; setelah panggilan itu tambahkan `useProjectsSync().load(true)` (simpan `const projectsSync = useProjectsSync()` di `<script setup>` dan panggil `projectsSync.load(true)`), import dari `~/data/projects-sync`.

- [ ] **Step 6: Verifikasi**

Run: `cd frontend && pnpm exec vitest run app/data/projects-sync.test.ts && pnpm typecheck && pnpm exec eslint app/data/projects-sync.ts app/layouts/dashboard.vue app/pages/settings.vue`
Expected: PASS, tanpa error lint baru di file yang diubah.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/data/projects-sync.ts frontend/app/data/projects-sync.test.ts frontend/app/layouts/dashboard.vue frontend/app/pages/settings.vue
git commit -m "feat(frontend): muat daftar project dari server setelah login"
```

---

### Task 6: Buat project dan Won lead lewat server

**Files:**
- Modify: `frontend/app/data/index.ts` (hapus `createProject`, ganti `markLeadWon` → `prepareLeadWon` + `applyLeadWon`)
- Modify: `frontend/app/data/projects-sync.ts` (`createProjectOnServer`, `markLeadWonOnServer`)
- Modify: `frontend/app/pages/project-orders/index.vue`, `frontend/app/pages/crm/parties/[id]/index.vue`, `frontend/app/pages/customer-journey/customers/[id]/index.vue`, `frontend/app/pages/crm/leads/[id]/index.vue`, `frontend/app/components/sales/LeadDetailSheet.vue`, `frontend/app/pages/client/quotations/[id]/index.vue`
- Modify tests: `frontend/app/data/project-order-workflow.test.ts`, `frontend/app/data/project-service-budget.test.ts`
- Test: `frontend/app/data/projects-sync.test.ts`

**Interfaces:**
- Consumes: `api.core.createProject` (Task 4), `registerNewServerProject` (Task 4), `CreateProjectInput` (sudah ada di `data/index.ts`).
- Produces: `createProjectOnServer(api: Pick<ManovaApi, 'core'>, input: CreateProjectInput, idempotencyKey: string): Promise<Project>`; `markLeadWonOnServer(api, leadId: string, approverId: string, idempotencyKey: string): Promise<Project>`; `prepareLeadWon(leadId): { existing: Project } | { input: CreateProjectInput & { leadId: string; sourceQuotationId: string } } | undefined`; `applyLeadWon(leadId, project, approverId): void`.

- [ ] **Step 1: Tulis test yang gagal** — tambahkan ke `projects-sync.test.ts` (import `createProjectOnServer`, `markLeadWonOnServer`; dan `LEADS`, `QUOTATIONS` dari `./index` atau file fixture-nya):

```ts
describe('createProjectOnServer', () => {
  it('mengirim nilai kontrak sebagai minor string dan mendaftarkan hasil server', async () => {
    const sent: unknown[] = []
    const api = { core: { createProject: async (input: unknown, key: string) => { sent.push({ input, key }); return { data: serverProjectDto({ id: 'PRJ-341', name: 'Trip Baru' }) } } } }
    const project = await createProjectOnServer(api as never, {
      partyId: 'PTY-002', name: 'Trip Baru', destination: 'Bali', travelStartDate: '2027-01-10', travelEndDate: '2027-01-12',
      travelerCount: 4, serviceScope: ['hotel'], quotationAmountIdr: 150_000_000
    }, 'key-abc-12345')
    expect(sent).toEqual([{ input: expect.objectContaining({ partyId: 'PTY-002', contractValueMinor: '150000000', serviceScope: ['hotel'] }), key: 'key-abc-12345' }])
    expect(project.id).toBe('PRJ-341')
    expect(PROJECTS.some(p => p.id === 'PRJ-341')).toBe(true)
  })

  it('error server diteruskan dan tidak ada project lokal yang dibuat', async () => {
    const count = PROJECTS.length
    const api = { core: { createProject: async () => { throw new Error('422') } } }
    await expect(createProjectOnServer(api as never, {
      partyId: 'PTY-999', name: 'X', destination: 'Y', travelStartDate: '2027-01-10', travelEndDate: '2027-01-12', travelerCount: 1, serviceScope: ['hotel'], quotationAmountIdr: 1
    }, 'key-abc-67890')).rejects.toThrow('422')
    expect(PROJECTS.length).toBe(count)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm exec vitest run app/data/projects-sync.test.ts`
Expected: FAIL (`createProjectOnServer` tidak ada).

- [ ] **Step 3: `data/index.ts`** — hapus seluruh fungsi `export function createProject (input: CreateProjectInput): Project | undefined { … }` (pertahankan `CreateProjectInput`, `GROUP_TRIP_PLACEHOLDER_PARTY_NAME`, `getOrCreateGroupTripPlaceholderParty`). Ganti `export function markLeadWon (…) { … }` dengan:

```ts
/**
 * "Mark as Won" (S3a): the project itself is created on the server (`markLeadWonOnServer`,
 * `app/data/projects-sync.ts`). `prepareLeadWon` checks the lead/quotation and builds the input;
 * `applyLeadWon` records the local side effects once the server answered. Duplicate prevention: a lead that
 * already has `projectId` returns that project.
 */
export function prepareLeadWon (leadId: string):
  | { existing: Project }
  | { input: CreateProjectInput & { leadId: string; sourceQuotationId: string } }
  | undefined {
  const lead = getLeadById(leadId)
  if (!lead || !lead.partyId) { return undefined }
  if (lead.projectId) {
    const existing = getProjectById(lead.projectId)
    return existing ? { existing } : undefined
  }
  if (!lead.quotationId || !lead.destination || !lead.travelStartDate || !lead.travelEndDate || !lead.travelerEstimate) { return undefined }
  const quotation = getQuotationById(lead.quotationId)
  if (!quotation || quotation.approvalStatus !== 'approved') { return undefined }
  if (!lead.serviceScope?.length) { return undefined }
  return {
    input: {
      partyId: lead.partyId,
      leadId: lead.id,
      sourceQuotationId: quotation.id,
      name: lead.title ?? lead.companyName ?? lead.name,
      destination: lead.destination,
      travelStartDate: lead.travelStartDate,
      travelEndDate: lead.travelEndDate,
      characteristic: 'normal',
      serviceScope: lead.serviceScope,
      travelerCount: lead.travelerEstimate,
      quotationAmountIdr: quotation.amountIdr
    }
  }
}

export function applyLeadWon (leadId: string, project: Project, approverId: string): void {
  const lead = getLeadById(leadId)
  if (!lead) { return }
  lead.projectId = project.id
  const party = lead.partyId ? getPartyById(lead.partyId) : undefined
  const accountExecutiveId = lead.handedOverTo ?? lead.ownerId
  project.budgetIdr = project.quotationAmountIdr
  if (party) {
    if (party.lifecycleStatus === 'prospect') { party.lifecycleStatus = 'client' }
    party.accountOwnerId = accountExecutiveId
    ensureClientLoginAccount(lead, accountExecutiveId)
  }
  const approver = getUserById(approverId)
  ACTIVITIES.push({
    id: `ACT-${project.id.replace('PRJ-', '')}1`,
    projectId: project.id,
    message: `Project ${project.id} dibuat dari Lead ${lead.id} (Won oleh ${approver?.name ?? approverId})`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
}
```

> Implementer: `serviceScope` kosong sebelumnya diizinkan lokal; server menolak scope kosong, jadi `prepareLeadWon` mengembalikan `undefined` dan UI menampilkan "Data belum lengkap" (pesan yang sudah ada). Hapus import `resolveDestinationGeo`/`nextSequentialId` hanya bila tidak dipakai lagi di file (masih dipakai fungsi lain — cek dengan typecheck/lint).

- [ ] **Step 4: `projects-sync.ts`** — tambahkan:

```ts
import { applyLeadWon, prepareLeadWon, type CreateProjectInput } from './index'
import { newIdempotencyKey } from '~/lib/api/client'

function toServerInput (input: CreateProjectInput & { leadId?: string; sourceQuotationId?: string }) {
  return {
    name: input.name.trim(),
    ...(input.isGroupTrip ? { isGroupTrip: true } : { partyId: input.partyId }),
    destination: input.destination.trim(),
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    characteristic: input.characteristic ?? 'normal',
    serviceScope: input.serviceScope,
    travelerCount: input.travelerCount,
    contractValueMinor: String(Math.round(input.quotationAmountIdr)),
    ...(input.leadId ? { leadId: input.leadId } : {}),
    ...(input.sourceQuotationId ? { sourceQuotationId: input.sourceQuotationId } : {})
  }
}

/** Creates the project on the server (one idempotency key per form fill), then adds it to `PROJECTS`. */
export async function createProjectOnServer (api: Pick<ManovaApi, 'core'>, input: CreateProjectInput, idempotencyKey: string = newIdempotencyKey()): Promise<Project> {
  const res = await api.core.createProject(toServerInput(input), idempotencyKey)
  const project = registerNewServerProject(res.data)
  project.budgetIdr = input.quotationAmountIdr
  return project
}

/** Mark as Won: undefined when the lead/quotation is incomplete; the existing project when already won. */
export async function markLeadWonOnServer (api: Pick<ManovaApi, 'core'>, leadId: string, approverId: string, idempotencyKey: string = newIdempotencyKey()): Promise<Project | undefined> {
  const prepared = prepareLeadWon(leadId)
  if (!prepared) { return undefined }
  if ('existing' in prepared) { return prepared.existing }
  const res = await api.core.createProject(toServerInput(prepared.input), idempotencyKey)
  const project = registerNewServerProject(res.data)
  applyLeadWon(leadId, project, approverId)
  return project
}
```

- [ ] **Step 5: Halaman buat project** — di tiga halaman (`project-orders/index.vue`, `crm/parties/[id]/index.vue`, `customer-journey/customers/[id]/index.vue`):

1. Hapus `createProject` dari import `~/data`; tambahkan `import { createProjectOnServer } from '~/data/projects-sync'` dan `import { newIdempotencyKey } from '~/lib/api/client'`, serta `import { isApiError } from '~/lib/api/errors'`.
2. Di `<script setup>`: `const api = useApi()`, `const isCreatingProject = ref(false)`, `let createProjectKey = newIdempotencyKey()`. Di fungsi reset form (`resetCreateProjectForm`) tambahkan `createProjectKey = newIdempotencyKey()`.
3. Ganti `function submitCreateProject () {` menjadi `async function submitCreateProject () {` dan blok pembuatan project menjadi (contoh `project-orders/index.vue`; dua halaman lain identik kecuali `partyId: party.value.id` dan tanpa `isGroupTrip`):

```ts
  if (!isNewProjectFormValid.value || isCreatingProject.value) { return }
  isCreatingProject.value = true
  let project
  try {
    project = await createProjectOnServer(api, {
      isGroupTrip: newProjectIsGroupTrip.value,
      partyId: newProjectIsGroupTrip.value ? undefined : newProjectPartyId.value,
      name: newProjectName.value.trim(),
      destination: newProjectDestination.value.trim(),
      travelStartDate: newProjectStartDate.value,
      travelEndDate: newProjectEndDate.value,
      travelerCount: newProjectTravelerCount.value!,
      serviceScope: newProjectServiceScope.value,
      quotationAmountIdr: newProjectAmountIdr.value!
    }, createProjectKey)
  } catch (error) {
    showToast('Gagal Membuat Project', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return
  } finally {
    isCreatingProject.value = false
  }
```

Sisa fungsi (loop budget layanan, `resetCreateProjectForm()`, tutup dialog, toast sukses) tidak berubah.

4. Di template, tombol submit dialog buat project: tambahkan `:disabled="… || isCreatingProject"` (gabungkan dengan kondisi disabled yang sudah ada) dan label `{{ isCreatingProject ? 'Menyimpan…' : '<label lama>' }}`.

- [ ] **Step 6: Won lead** — di `crm/leads/[id]/index.vue` dan `components/sales/LeadDetailSheet.vue`: ganti import `markLeadWon` dengan `import { markLeadWonOnServer } from '~/data/projects-sync'` + `import { isApiError } from '~/lib/api/errors'`; `const api = useApi()`; `const isMarkingWon = ref(false)`; ubah fungsi:

```ts
async function submitMarkAsWon () {
  if (!lead.value || !quotation.value || quotation.value.approvalStatus !== 'approved' || isMarkingWon.value) { return }
  isMarkingWon.value = true
  let project
  try {
    project = await markLeadWonOnServer(api, lead.value.id, quotation.value.approvedBy ?? currentUser.value.id)
  } catch (error) {
    showToast('Mark as Won Gagal', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return
  } finally {
    isMarkingWon.value = false
  }
  isMarkAsWonDialogOpen.value = false
  if (!project) {
    showToast('Mark as Won Gagal', 'Data belum lengkap atau lead sudah diproses sebelumnya.', 'error')
    return
  }
  // … sisa fungsi (clientUser, accountMessage, toast, navigasi) tidak berubah
}
```

(`LeadDetailSheet.vue` memakai `selectedLead` alih-alih `lead`, dan `emit('update:open', false)` + `navigateTo` di akhir — pertahankan.) Tombol konfirmasi Won di dialog: `:disabled="isMarkingWon"`.

- [ ] **Step 7: Portal client** — di `pages/client/quotations/[id]/index.vue`, portal client nonaktif (ADR-006) dan peran client tidak boleh membuat project di server. Hapus import `markLeadWon` dan ganti blok mulai `const project = markLeadWon(…)` sampai akhir fungsi dengan:

```ts
  approveNote.value = ''
  isApproveDialogOpen.value = false
  showToast('Quotation Dikonfirmasi', 'Terima kasih — tim kami akan segera memproses selanjutnya.', 'success')
}
```

- [ ] **Step 8: Test lama** — di `project-order-workflow.test.ts` dan `project-service-budget.test.ts`, ganti setiap `createProject({...})` dengan helper lokal di atas file:

```ts
import { registerNewServerProject } from './projects-sync'
import { serverProjectDto } from './projects-sync.test-utils'

let testProjectSeq = 800
function createProject (input: { partyId?: string; isGroupTrip?: boolean; name: string; destination: string; travelStartDate: string; travelEndDate: string; travelerCount: number; serviceScope: Project['serviceScope']; quotationAmountIdr: number }) {
  return registerNewServerProject(serverProjectDto({
    id: `PRJ-${++testProjectSeq}`,
    partyId: input.isGroupTrip ? 'PTY-009' : input.partyId!,
    isGroupTrip: !!input.isGroupTrip,
    name: input.name, destination: input.destination, travelStartDate: input.travelStartDate, travelEndDate: input.travelEndDate,
    travelerCount: input.travelerCount, serviceScope: input.serviceScope, contractValueMinor: String(input.quotationAmountIdr)
  }))
}
```

dan hapus `createProject` dari import `./index`. Test yang memeriksa `budgetIdr === quotationAmountIdr` setelah create: set `project.budgetIdr = input.quotationAmountIdr` di helper bila assertion itu ada.

- [ ] **Step 9: Verifikasi**

Run: `cd frontend && pnpm test && pnpm typecheck && pnpm exec eslint app/data/index.ts app/data/projects-sync.ts app/pages/project-orders/index.vue "app/pages/crm/parties/[id]/index.vue" "app/pages/customer-journey/customers/[id]/index.vue" "app/pages/crm/leads/[id]/index.vue" app/components/sales/LeadDetailSheet.vue "app/pages/client/quotations/[id]/index.vue"`
Expected: semua test PASS; tidak ada error lint **baru** dibanding sebelum perubahan (bandingkan jumlah error per file dengan `git stash`-free cara: jalankan eslint pada versi `HEAD` file lewat `git show HEAD:<path>` ke file sementara, seperti di riwayat sesi).

- [ ] **Step 10: Commit**

```bash
git add frontend/app/data/index.ts frontend/app/data/projects-sync.ts frontend/app/data/projects-sync.test.ts frontend/app/data/project-order-workflow.test.ts frontend/app/data/project-service-budget.test.ts frontend/app/pages/project-orders/index.vue "frontend/app/pages/crm/parties/[id]/index.vue" "frontend/app/pages/customer-journey/customers/[id]/index.vue" "frontend/app/pages/crm/leads/[id]/index.vue" frontend/app/components/sales/LeadDetailSheet.vue "frontend/app/pages/client/quotations/[id]/index.vue"
git commit -m "feat(frontend): buat project dan Won lead lewat server"
```

---

### Task 7: Edit jadwal dan kontak lapangan lewat server

**Files:**
- Modify: `frontend/app/data/projects-sync.ts` (`patchProjectOnServer`)
- Modify: `frontend/app/data/index.ts` (hapus `updateProjectSchedule`, `updateProjectFieldContacts`)
- Modify: `frontend/app/pages/project-orders/[id]/index.vue` (`submitSchedule`, `submitFieldContacts`)
- Test: `frontend/app/data/projects-sync.test.ts`

**Interfaces:**
- Consumes: `api.core.updateProject` (Task 4), `upsertServerProject` (Task 4).
- Produces: `patchProjectOnServer(api: Pick<ManovaApi, 'core'>, projectId: string, input: ProjectPatchInput): Promise<Project>`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
describe('patchProjectOnServer', () => {
  it('mengirim patch dan menerapkan jawaban server ke objek yang sama', async () => {
    const before = PROJECTS.find(p => p.id === 'PRJ-101')!
    const api = { core: { updateProject: async (id: string, input: Record<string, unknown>) => ({ data: serverProjectDto({ id, destination: input.destination as string, meetingPoint: 'Terminal 3' }) }) } }
    const project = await patchProjectOnServer(api as never, 'PRJ-101', { destination: 'Cebu, Filipina', meetingPoint: 'Terminal 3' })
    expect(project).toBe(before)
    expect(before).toMatchObject({ destination: 'Cebu, Filipina', meetingPoint: 'Terminal 3' })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm exec vitest run app/data/projects-sync.test.ts -t patchProjectOnServer`
Expected: FAIL.

- [ ] **Step 3: Implementasi** — `projects-sync.ts`:

```ts
import type { ProjectPatchInput } from '~/types/api'

export async function patchProjectOnServer (api: Pick<ManovaApi, 'core'>, projectId: string, input: ProjectPatchInput): Promise<Project> {
  const res = await api.core.updateProject(projectId, input)
  const project = upsertServerProject(res.data)
  if (!project) { throw new Error('Jawaban server tidak berisi data project.') }
  return project
}
```

Di `data/index.ts` hapus `updateProjectSchedule` dan `updateProjectFieldContacts` beserta komentar dokumentasinya (pindahkan inti komentarnya — gate step memakai tanggal & kontak lapangan — ke JSDoc `patchProjectOnServer`).

- [ ] **Step 4: Halaman detail** — `pages/project-orders/[id]/index.vue`: hapus dua mutator dari import `~/data`; tambahkan `import { patchProjectOnServer } from '~/data/projects-sync'`, `import { isApiError } from '~/lib/api/errors'`, `const api = useApi()` (bila belum ada di file — file ini sudah memakai `useApi()` untuk finance summary; pakai variabel yang ada), `const isSavingHeader = ref(false)`. Ganti dua fungsi:

```ts
async function submitSchedule () {
  if (!project.value || !editTravelStartDate.value || !editTravelEndDate.value || isSavingHeader.value) { return }
  isSavingHeader.value = true
  try {
    await patchProjectOnServer(api, project.value.id, {
      destination: editDestination.value.trim() || undefined,
      travelStartDate: editTravelStartDate.value,
      travelEndDate: editTravelEndDate.value
    })
  } catch (error) {
    showToast('Jadwal Gagal Disimpan', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return
  } finally {
    isSavingHeader.value = false
  }
  refreshStep()
  isScheduleDialogOpen.value = false
  showToast('Jadwal Diperbarui', 'Destinasi dan tanggal travel berhasil disimpan.', 'success')
}

async function submitFieldContacts () {
  if (!project.value || isSavingHeader.value) { return }
  isSavingHeader.value = true
  try {
    await patchProjectOnServer(api, project.value.id, {
      tourLeaderName: editTourLeaderName.value.trim() || null,
      tourLeaderPhone: editTourLeaderPhone.value.trim() || null,
      emergencyContactName: editEmergencyContactName.value.trim() || null,
      emergencyContactPhone: editEmergencyContactPhone.value.trim() || null,
      meetingPoint: editMeetingPoint.value.trim() || null
    })
  } catch (error) {
    showToast('Kontak Lapangan Gagal Disimpan', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return
  } finally {
    isSavingHeader.value = false
  }
  refreshStep()
  isFieldContactsDialogOpen.value = false
  showToast('Kontak Lapangan Disimpan', 'Tour leader dan kontak darurat berhasil diperbarui.', 'success')
}
```

Tombol simpan di kedua dialog: tambahkan `:disabled="isSavingHeader"`.

- [ ] **Step 5: Verifikasi**

Run: `cd frontend && pnpm test && pnpm typecheck`
Expected: PASS. `grep -rn "updateProjectSchedule\|updateProjectFieldContacts" frontend/app` → tidak ada hasil.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/data/projects-sync.ts frontend/app/data/projects-sync.test.ts frontend/app/data/index.ts "frontend/app/pages/project-orders/[id]/index.vue"
git commit -m "feat(frontend): jadwal dan kontak lapangan project disimpan ke server"
```

---

### Task 8: Dialog "Ubah nilai kontrak" di panel Finance project

**Files:**
- Create: `frontend/app/components/finance/FinanceContractValueDialog.vue`
- Modify: `frontend/app/components/finance/FinanceProjectPanel.vue`

**Interfaces:**
- Consumes: `api.core.setContractValue` (Task 4), `upsertServerProject` (Task 4), `useFinanceAction`, komponen `FinanceFormDialog`, `FinanceField`, `FinanceMoneyInput`, `FinanceTextarea`, capability `finance.edit-contract-value` via `session.can`.
- Produces: komponen `<FinanceContractValueDialog v-model:open :project-id :current-minor :billed-minor />`.

- [ ] **Step 1: Komponen** — `FinanceContractValueDialog.vue`:

```vue
<script setup lang="ts">
import { formatMoneyMinor } from '~/lib/money'
import { upsertServerProject } from '~/data/projects-sync'

/**
 * Finance corrects a project's contract value (ADR-007: owned by Project, set at creation). The server refuses
 * a value below what is already billed; the reason is kept in the audit trail.
 */
const props = defineProps<{ open: boolean; projectId: string; currentMinor: string | null; billedMinor: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const form = reactive({ amount: '', reason: '' })

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  Object.assign(form, { amount: props.currentMinor ?? '', reason: '' })
})

const belowBilled = computed(() => !!form.amount && BigInt(form.amount) < BigInt(props.billedMinor))
const action = useFinanceAction(() => api.core.setContractValue(props.projectId, { contractValueMinor: form.amount, reason: form.reason.trim() }))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  upsertServerProject(res.data)
  showToast('Nilai kontrak diperbarui', `${props.projectId}: ${formatMoneyMinor(form.amount)}.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Ubah nilai kontrak"
    :description="`Sudah ditagih ${formatMoneyMinor(billedMinor)}. Nilai kontrak tidak boleh di bawah angka itu.`"
    submit-label="Simpan"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.amount || !form.reason.trim() || belowBilled"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4">
      <FinanceField id="cv-amount" label="Nilai kontrak baru" :error="action.fieldError('contractValueMinor')">
        <FinanceMoneyInput id="cv-amount" v-model="form.amount" :invalid="belowBilled || !!action.fieldError('contractValueMinor')" />
        <p v-if="belowBilled" class="mt-1 text-xs font-medium text-destructive" role="alert">
          Di bawah yang sudah ditagih.
        </p>
      </FinanceField>
      <FinanceField id="cv-reason" label="Alasan perubahan" :error="action.fieldError('reason')" hint="Tercatat di audit trail.">
        <FinanceTextarea id="cv-reason" v-model="form.reason" :rows="3" maxlength="500" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
```

> Implementer: cek props `FinanceField` (punya `hint`?) dan `FinanceFormDialog` di folder yang sama; sesuaikan nama prop bila berbeda (lihat `FinanceGroupTripDpDialog.vue` sebagai rujukan pemakaian).

- [ ] **Step 2: Panel** — `FinanceProjectPanel.vue`: import ikon `Pencil` dari `lucide-vue-next`; `const showContractValue = ref(false)`; ubah `<dd>` nilai kontrak menjadi:

```vue
            <dd class="flex items-center gap-1.5">
              <FinanceAmount :value="full.contractValueMinor" unavailable-label="Belum diisi" class="font-semibold" />
              <Button
                v-if="session.can('finance.edit-contract-value')"
                size="icon"
                variant="ghost"
                class="h-6 w-6"
                aria-label="Ubah nilai kontrak"
                @click="showContractValue = true"
              >
                <Pencil class="h-3.5 w-3.5" />
              </Button>
            </dd>
```

dan di bawah dialog lain (setelah `<FinanceVendorInvoiceDialog … />`):

```vue
    <FinanceContractValueDialog
      v-if="full"
      v-model:open="showContractValue"
      :project-id="projectId"
      :current-minor="full.contractValueMinor"
      :billed-minor="(BigInt(full.receivable.invoicedMinor) - BigInt(full.receivable.creditedMinor)).toString()"
    />
```

(`BigInt` di template: bila lint/TS melarang, buat `const billedMinor = computed(() => full.value ? (BigInt(full.value.receivable.invoicedMinor) - BigInt(full.value.receivable.creditedMinor)).toString() : '0')` di script dan pakai `:billed-minor="billedMinor"`. Cek nama field `creditedMinor` di `ProjectFinanceSummaryDto`.)

- [ ] **Step 3: Verifikasi**

Run: `cd frontend && pnpm typecheck && pnpm exec eslint app/components/finance/FinanceContractValueDialog.vue app/components/finance/FinanceProjectPanel.vue && pnpm test`
Expected: PASS; tidak ada error lint baru.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/finance/FinanceContractValueDialog.vue frontend/app/components/finance/FinanceProjectPanel.vue
git commit -m "feat(finance): ubah nilai kontrak project dari panel Finance"
```

---

### Task 9: Dokumentasi, verifikasi penuh, dan uji di aplikasi

**Files:**
- Modify: `backend/CLAUDE.md` (pola endpoint tulis), `docs/superpowers/specs/2026-10-06-project-core-backend-design.md` (status)
- Modify: `docs/manova-finance-implementation/adr/ADR-004-core-reference-bridge-and-cutover.md` — tambahkan catatan "Update 2026-10-06: Project header write API (S3a) — project kini ditulis lewat API; status/tim/layanan masih modul frontend".

- [ ] **Step 1: `backend/CLAUDE.md`** — di bagian Rules tambahkan:

```markdown
- Write endpoints (S0 pattern, first used by `POST/PATCH /projects`): `auth.requireCapability`, validate into
  `errors.validation` with Indonesian messages, change + `recordAudit` in one transaction, `withIdempotency`
  for creates (`Idempotency-Key` required), IDs from `nextId(q, prefix)` (`src/shared/ids.ts`, legacy text
  format), respond with the same view as the GET (scope + ADR-007 money rules). Seeds call `syncIdSequences`.
```

- [ ] **Step 2: Status spec** — ganti baris status menjadi `Status: diimplementasikan`.

- [ ] **Step 3: Verifikasi penuh**

Run:
```bash
cd backend && bun run typecheck && bun test
cd ../frontend && pnpm typecheck && pnpm test && pnpm build
```
Expected: backend semua lulus (≥ 296 + test baru), frontend semua lulus, build sukses. Bila PostgreSQL lokal tersedia (`C:/Program Files/PostgreSQL/17/bin`), jalankan juga `TEST_DATABASE_URL=postgres://… bun test test/project-writes.test.ts test/db.test.ts` dan catat hasilnya.

- [ ] **Step 4: Uji di aplikasi** — database lokal `pglite://.data/pglite-year` perlu migrasi 0017: hentikan backend, jalankan `bun run db:migrate` lalu `bun run db:seed:demo` (meng-upsert kolom baru dan `id_sequences`), jalankan backend dan frontend. Login sebagai Admin (Doni Saputra): buat project untuk PTY-002 → muncul `PRJ-341`, refresh halaman → project tetap ada. Edit jadwal & kontak lapangan → refresh → tersimpan. Login Finance (Budi Santoso): buka project baru → tab Finance menampilkan nilai kontrak → buat invoice DP → ubah nilai kontrak di bawah tertagih (ditolak) dan di atasnya (berhasil). Matikan backend → buka `/project-orders` → banner "belum tersinkron" + daftar lokal tampil.

- [ ] **Step 5: Commit**

```bash
git add backend/CLAUDE.md docs/superpowers/specs/2026-10-06-project-core-backend-design.md docs/manova-finance-implementation/adr/ADR-004-core-reference-bridge-and-cutover.md
git commit -m "docs: pola endpoint tulis dan status backend project inti"
```
