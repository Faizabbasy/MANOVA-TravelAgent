# Backend Customer (S1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customer (profil, kontak, aktivitas CRM) dibuat dan diubah di server; lead baru bisa di-qualify dan di-Won jadi project; limit kredit milik Finance.

**Architecture:** Backend memperluas `parties`, menambah `party_contacts` dan `party_activities`, dan endpoint tulis di modul `core` dengan pola S0 (capability, validasi, audit, idempotency, `nextId`). Frontend mengisi `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` dari server setelah sesi siap (pola `projects-sync.ts`), semua pembuatan customer lewat server, aktivitas dikirim optimistis lewat sink.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite (`bun run test`), Nuxt 4 + Vue 3 + Vitest (pnpm).

**Spec:** `docs/superpowers/specs/2026-10-06-customer-backend-design.md`

## Global Constraints

- `bun` di `backend/`, `pnpm` di `frontend/`.
- Uang `bigint` minor di SQL, string di API (`creditLimitMinor`); `parseAmountMinor` dari `src/shared/money.ts`.
- JSON param SQL `$n::text::jsonb`.
- Baca/tulis lewat `auth.requireActor`/`requireCapability`; scope `canListParties`/`getParty`; di luar scope → 404.
- Pesan Bahasa Indonesia; aturan bisnis → 422 `RULE_VIOLATION`; validasi → 400 `VALIDATION_FAILED`.
- `recordAudit` di transaksi yang sama.
- Capability baru di `backend/src/auth/rbac.ts` **dan** `frontend/app/data/rbac.ts` di commit yang sama.
- Bentuk response berubah → `frontend/app/types/api.ts` + `lib/api/endpoints.ts` di commit yang sama.
- Migrasi baru `0019_customer_writes.up/down.sql`; jangan ubah migrasi lama.
- Verifikasi backend: `cd backend && bun run test …` (timeout 30 dtk, sama dengan CI) — **bukan** `bun test` polos.
- File frontend memakai CRLF: edit dengan tool Edit, atau normalisasi `\r` saat memakai skrip.
- Commit tiap task (lokal; push = deploy, jangan push).

## Review Focus

1. Qualify lead B2B dengan nama perusahaan yang sudah ada di server → memakai customer itu, tidak membuat duplikat. (Task 6 test "party sudah ada".)
2. Server mati saat qualify/tambah customer → pesan jelas, lead tidak berubah setengah jalan. (Task 6 test error diteruskan, lead tetap belum qualified.)
3. Aktivitas gagal terkirim → tetap terlihat lokal dengan toast peringatan, tidak hilang diam-diam sebelum muat ulang. (Task 5 test sink gagal.)
4. Admin membuka customer → limit kredit terlihat tapi tidak bisa diubah; Finance bisa, wajib alasan. (Task 2 test 403/400; Task 7 tombol bergantung capability.)
5. Muat ulang setelah Won lead baru → customer tampil `client` (dari server), project dan customer tetap ada. (Task 3 test promosi; Task 6 sinkron ulang party setelah Won.)

---

## File Structure

**Backend**
- Create `backend/migrations/0019_customer_writes.up.sql`, `.down.sql`.
- Modify `backend/src/shared/ids.ts` (prefix `CP-`, `PACT-`).
- Create `backend/src/modules/core/party-writes.ts` (create/update/credit-limit/contact/activity).
- Modify `backend/src/modules/core/repository.ts` (party view + list contacts/activities), `routes.ts`, `project-writes.ts` (promosi prospect→client).
- Modify `backend/src/auth/rbac.ts`, `frontend/app/data/rbac.ts`.
- Modify `backend/src/db/seed-demo.ts`, `backend/scripts/extract-demo-core.ts`, regenerate `demo-core.json`; `backend/test/db.test.ts`.
- Create `backend/test/party-writes.test.ts`.

**Frontend**
- Modify `app/types/api.ts`, `app/lib/api/endpoints.ts`.
- Create `app/data/parties-sync.ts`, `app/data/parties-sync.test.ts`, `app/data/parties-sync.test-utils.ts`.
- Modify `app/data/index.ts` (qualify functions menerima `partyId`, sink aktivitas, `applyLeadWon`).
- Modify `app/layouts/dashboard.vue`, `app/pages/settings.vue`.
- Modify `app/pages/customer-journey/customers/index.vue`, `app/pages/customer-journey/customers/[id]/index.vue`, `app/pages/crm/parties/[id]/index.vue`, `app/components/sales/LeadDetailSheet.vue`, `app/data/projects-sync.ts` (sinkron party setelah Won).

---

### Task 1: Migrasi 0019, prefix ID baru, seed membawa profil/kontak/aktivitas

**Files:**
- Create: `backend/migrations/0019_customer_writes.up.sql`, `.down.sql`
- Modify: `backend/src/shared/ids.ts`, `backend/src/db/seed-demo.ts`, `backend/scripts/extract-demo-core.ts`, `backend/src/db/seeds/demo-core.json`
- Test: `backend/test/db.test.ts`

**Interfaces:**
- Produces: `IdPrefix = 'PRJ-' | 'PTY-' | 'CP-' | 'PACT-'`; kolom `parties.*` baru; tabel `party_contacts`, `party_activities`; `DemoCoreSeed.parties[]` field profil opsional, `DemoCoreSeed.partyContacts`, `DemoCoreSeed.partyActivities`.

- [ ] **Step 1: Test gagal** — di `backend/test/db.test.ts`, dalam `describe('demo seed', …)`, tambahkan:

```ts
  test('customer profile, contacts and activities follow the seed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [p] = await db.query<{ city: string | null; credit_limit_minor: string | null; account_owner_user_id: string | null }>(
        "select city, credit_limit_minor, account_owner_user_id from parties where id = 'PTY-001'"
      )
      const fixture = DEMO_CORE.parties.find(x => x.id === 'PTY-001')!
      expect(p).toEqual({ city: fixture.city ?? null, credit_limit_minor: fixture.creditLimitMinor ?? null, account_owner_user_id: fixture.accountOwnerUserId ?? null })
      const [counts] = await db.query<{ contacts: string; activities: string }>(
        'select (select count(*) from party_contacts) as contacts, (select count(*) from party_activities) as activities'
      )
      expect(counts).toEqual({ contacts: String(DEMO_CORE.partyContacts.length), activities: String(DEMO_CORE.partyActivities.length) })
      const seq = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('CP-', 'PACT-') order by prefix")
      expect(seq.map(s => s.prefix)).toEqual(['CP-', 'PACT-'])
      expect(await nextId(db, 'CP-')).toMatch(/^CP-\d{3,}$/)
    } finally {
      await cleanup()
    }
  })
```

Dan di test "carries operational reference values only", ganti assertion akhir menjadi:

```ts
    expect([...keys].filter(k => /minor/i.test(k)).sort()).toEqual(['contractValueMinor', 'creditLimitMinor', 'priceMinor', 'sellAmountMinor'])
```

- [ ] **Step 2:** `cd backend && bun run test test/db.test.ts -t "customer profile"` → FAIL (`partyContacts` undefined / kolom tidak ada).

- [ ] **Step 3: Migrasi** `0019_customer_writes.up.sql`:

```sql
-- Customer (S1): profile owned by CRM, credit limit owned by Finance, contacts and CRM activity log.
alter table parties
  add column industry text,
  add column company_type text check (company_type in ('private-company', 'bumn', 'government-agency', 'university', 'foundation', 'event-organizer', 'travel-agent', 'other')),
  add column size text,
  add column address text,
  add column city text,
  add column province text,
  add column country text,
  add column postal_code text,
  add column phone text,
  add column email text,
  add column website text,
  add column account_owner_user_id text references users (id),
  add column registration_number text,
  add column npwp text,
  add column billing_name text,
  add column billing_address text,
  add column payment_term text,
  add column po_required boolean not null default false,
  add column travel_preferences text,
  add column credit_limit_minor bigint check (credit_limit_minor >= 0 and credit_limit_minor <= 1000000000000000);

create table party_contacts (
  id         text primary key check (id <> ''),
  party_id   text not null references parties (id),
  name       text not null check (btrim(name) <> ''),
  title      text not null check (btrim(title) <> ''),
  email      text,
  phone      text,
  provenance text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at timestamptz not null default now()
);
create index party_contacts_party on party_contacts (party_id);

create table party_activities (
  id            text primary key check (id <> ''),
  party_id      text not null references parties (id),
  lead_id       text,
  type          text not null check (type in ('call', 'meeting', 'email', 'note', 'follow-up')),
  message       text not null check (btrim(message) <> ''),
  owner_user_id text not null references users (id),
  activity_date date not null,
  due_at        date,
  provenance    text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at    timestamptz not null default now()
);
create index party_activities_party on party_activities (party_id);
create index party_activities_lead on party_activities (lead_id) where lead_id is not null;

insert into id_sequences (prefix, last_value) values ('CP-', 0), ('PACT-', 0) on conflict (prefix) do nothing;
```

> Implementer: cek default `provenance` yang dipakai tabel lain di migrasi 0010 (`grep -n "manova.provenance" backend/migrations/*.sql`) dan salin ekspresinya persis bila berbeda.

`0019_customer_writes.down.sql`:

```sql
delete from id_sequences where prefix in ('CP-', 'PACT-');
drop table if exists party_activities;
drop table if exists party_contacts;
alter table parties
  drop column if exists industry, drop column if exists company_type, drop column if exists size,
  drop column if exists address, drop column if exists city, drop column if exists province,
  drop column if exists country, drop column if exists postal_code, drop column if exists phone,
  drop column if exists email, drop column if exists website, drop column if exists account_owner_user_id,
  drop column if exists registration_number, drop column if exists npwp, drop column if exists billing_name,
  drop column if exists billing_address, drop column if exists payment_term, drop column if exists po_required,
  drop column if exists travel_preferences, drop column if exists credit_limit_minor;
```

- [ ] **Step 4: ids.ts** — ubah `IdPrefix` menjadi `'PRJ-' | 'PTY-' | 'CP-' | 'PACT-'` dan `SOURCES` menjadi `{ 'PRJ-': 'projects', 'PTY-': 'parties', 'CP-': 'party_contacts', 'PACT-': 'party_activities' }`.

- [ ] **Step 5: Seed** — `seed-demo.ts`:
  - Tipe `DemoCoreSeed.parties[]` tambah opsional: `industry, companyType, size, address, city, province, country, postalCode, phone, email, website, accountOwnerUserId, registrationNumber, npwp, billingName, billingAddress, paymentTerm, poRequired, travelPreferences, creditLimitMinor` (semua `string | null` kecuali `poRequired?: boolean`).
  - Tambah `partyContacts: { id: string; partyId: string; name: string; title: string; email: string | null; phone: string | null }[]` dan `partyActivities: { id: string; partyId: string; leadId: string | null; type: string; message: string; ownerUserId: string; activityDate: string; dueAt: string | null }[]` (keduanya opsional `?` agar seed lain tetap valid).
  - Upsert party: tambah kolom-kolom di atas (`on conflict … do update … where parties.provenance = 'demo-fixture'`), nilai `?? null` / `?? false`.
  - **Urutan:** party di-upsert sebelum users (users punya FK party). `account_owner_user_id` FK ke users → setelah upsert users, jalankan `update parties set account_owner_user_id = $2 where id = $1 and provenance = 'demo-fixture'` per party yang punya `accountOwnerUserId` (hindari FK sebelum user ada).
  - Setelah projects, upsert `party_contacts` dan `party_activities` (`on conflict (id) do update … where <table>.provenance = 'demo-fixture'`), provenance `P`.
  - `syncIdSequences` sudah dipanggil di akhir (Task 1 S0) — kini mencakup `CP-`/`PACT-`.

- [ ] **Step 6: Extract** — `extract-demo-core.ts`: import `CONTACTS, PARTY_ACTIVITIES` dari `../../frontend/app/data/parties`; blok `parties` tambah field (`creditLimitMinor: minor(p.creditLimitIdr)`, `accountOwnerUserId: p.accountOwnerId ?? null`, sisanya `?? null`, `poRequired: p.poRequired ?? false`); tambah:

```ts
  partyContacts: [...CONTACTS].sort(byId).map(c => ({ id: c.id, partyId: c.partyId, name: c.name, title: c.title, email: c.email ?? null, phone: c.phone ?? null })),
  partyActivities: [...PARTY_ACTIVITIES].sort(byId).map(a => ({
    id: a.id, partyId: a.partyId, leadId: a.leadId ?? null, type: a.type, message: a.message,
    ownerUserId: a.ownerId, activityDate: dateOnly(a.createdAt)!, dueAt: dateOnly(a.dueAt)
  })),
```

Sebelum memakai `ownerUserId`, cek setiap `ownerId` aktivitas ada di `USERS` (yang di-seed); bila ada yang tidak, catat `warnings.push(...)` dan lewati aktivitas itu. Jalankan `bun run seed:extract`.

- [ ] **Step 7:** `cd backend && bun run test test/db.test.ts test/core-scope.test.ts test/year-demo-seed.test.ts test/project-writes.test.ts && bun run typecheck` → PASS.

- [ ] **Step 8: Commit** `feat(core): profil customer, kontak, dan aktivitas di database (S1)`.

---

### Task 2: API profil customer dan limit kredit

**Files:**
- Create: `backend/src/modules/core/party-writes.ts`
- Modify: `backend/src/modules/core/repository.ts`, `routes.ts`, `backend/src/auth/rbac.ts`, `frontend/app/data/rbac.ts`
- Test: `backend/test/party-writes.test.ts`, `backend/test/rbac.test.ts` (bila daftar capability finance eksplisit)

**Interfaces:**
- Consumes: `nextId`, `withIdempotency`, `recordAudit`, `parseAmountMinor`.
- Produces: capability `finance.edit-credit-limit` (finance), `crm.log-activity` (admin, finance). `createParty(tx, actor, input, requestId): Promise<{ id }>`, `updateParty(tx, actor, id, input, requestId)`, `setCreditLimit(tx, actor, id, { creditLimitMinor: string | null; reason }, requestId)`. Endpoint `POST /parties` (201), `PATCH /parties/:id`, `PUT /parties/:id/credit-limit` — body jawaban = view party. View internal: `id, name, lifecycleStatus, partyType, preferredCurrency, provenance, industry, companyType, size, address, city, province, country, postalCode, phone, email, website, accountOwnerUserId, registrationNumber, npwp, billingName, billingAddress, paymentTerm, poRequired, travelPreferences, creditLimitMinor (null bila !canViewFullFinancials), createdAt (YYYY-MM-DD)`.

- [ ] **Step 1: Test gagal** — `backend/test/party-writes.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO_CORE } from '../src/db/seed-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

const FIRST_PTY = `PTY-${String(Math.max(...DEMO_CORE.parties.map(p => Number(p.id.slice(4)))) + 1).padStart(3, '0')}`
let n = 0
const key = () => `party-key-${++n}-abcdef`
const post = (who: string, body: unknown, k: string | null = key()) =>
  t.call('POST', '/api/v1/parties', { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('POST /parties', () => {
  test('admin creates a prospect company with a server id', async () => {
    const res = await post('admin', { name: 'PT Uji Pelanggan', partyType: 'company', industry: 'Energi', city: 'Bandung', npwp: '01.234.567.8-901.000', accountOwnerUserId: 'USR-001' })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ id: FIRST_PTY, name: 'PT Uji Pelanggan', lifecycleStatus: 'prospect', partyType: 'company', city: 'Bandung', accountOwnerUserId: 'USR-001', provenance: 'manual', creditLimitMinor: null })
    const [a] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'party.created' and entity_id = $1", [FIRST_PTY])
    expect(a!.n).toBe('1')
  })

  test('same key = one customer; key required', async () => {
    const k = key()
    const a = await post('admin', { name: 'PT Sekali', partyType: 'company' }, k)
    const b = await post('admin', { name: 'PT Sekali', partyType: 'company' }, k)
    expect(b.json.data.id).toBe(a.json.data.id)
    expect((await post('admin', { name: 'PT Tanpa Kunci', partyType: 'company' }, null)).status).toBe(400)
  })

  test('validation names each bad field', async () => {
    const res = await post('admin', { name: ' ', partyType: 'robot', email: 'bukan-email', npwp: '123', companyType: 'pabrik', accountOwnerUserId: 'USR-999', creditLimitMinor: '5' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.json.error.fieldErrors).sort()).toEqual(['accountOwnerUserId', 'companyType', 'creditLimitMinor', 'email', 'name', 'npwp', 'partyType'])
  })

  test('individual customers can be clients from the start; finance 403; anonymous 401', async () => {
    const res = await post('admin', { name: 'Budi Wisatawan', partyType: 'individual', lifecycleStatus: 'client' })
    expect(res.json.data).toMatchObject({ partyType: 'individual', lifecycleStatus: 'client' })
    expect((await post('finance', { name: 'X', partyType: 'company' })).status).toBe(403)
    expect((await t.call('POST', '/api/v1/parties', { body: { name: 'X', partyType: 'company' }, headers: { 'idempotency-key': key() } })).status).toBe(401)
  })
})

describe('PATCH /parties/:id', () => {
  test('admin edits the profile; audit keeps before/after', async () => {
    const res = await t.call('PATCH', '/api/v1/parties/PTY-002', { cookie: c.admin, body: { city: 'Malang', billingName: 'PT Alam Raya Group Tbk', poRequired: true } })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ city: 'Malang', billingName: 'PT Alam Raya Group Tbk', poRequired: true })
    const [audit] = await t.db.query<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
      "select before, after from audit_events where action = 'party.updated' and entity_id = 'PTY-002' order by id desc limit 1"
    )
    expect(audit!.after).toMatchObject({ city: 'Malang', poRequired: true })
  })

  test('credit limit, lifecycle and id cannot be patched; unknown 404; finance 403', async () => {
    for (const body of [{ creditLimitMinor: '1' }, { lifecycleStatus: 'client' }, { id: 'PTY-X' }]) {
      expect((await t.call('PATCH', '/api/v1/parties/PTY-002', { cookie: c.admin, body })).status, JSON.stringify(body)).toBe(400)
    }
    expect((await t.call('PATCH', '/api/v1/parties/PTY-999', { cookie: c.admin, body: { city: 'X' } })).status).toBe(404)
    expect((await t.call('PATCH', '/api/v1/parties/PTY-002', { cookie: c.finance, body: { city: 'X' } })).status).toBe(403)
  })
})

describe('PUT /parties/:id/credit-limit', () => {
  test('finance sets and clears it with a reason; admin 403; reason required', async () => {
    const set = await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.finance, body: { creditLimitMinor: '900000000', reason: 'Review tahunan' } })
    expect(set.status).toBe(200)
    expect(set.json.data.creditLimitMinor).toBe('900000000')
    const cleared = await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.superAdmin, body: { creditLimitMinor: null, reason: 'Tanpa batas' } })
    expect(cleared.json.data.creditLimitMinor).toBeNull()
    expect((await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.finance, body: { creditLimitMinor: '1' } })).status).toBe(400)
    expect((await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.admin, body: { creditLimitMinor: '1', reason: 'x' } })).status).toBe(403)
    const [audit] = await t.db.query<{ reason: string }>("select reason from audit_events where action = 'party.credit_limit_changed' and entity_id = 'PTY-002' order by id limit 1")
    expect(audit!.reason).toBe('Review tahunan')
  })

  test('GET shows the profile; client sees itself without credit limit', async () => {
    const res = await t.call('GET', '/api/v1/parties/PTY-005', { cookie: c.client })
    expect(res.status).toBe(200)
    expect(res.json.data.creditLimitMinor ?? null).toBeNull()
  })
})
```

- [ ] **Step 2:** `bun run test test/party-writes.test.ts` → FAIL (route 404).

- [ ] **Step 3: RBAC** — `backend/src/auth/rbac.ts`: setelah `'crm.manage-follow-up': ['admin'],` tambah `'crm.log-activity': ['admin', 'finance'],`; setelah `'finance.edit-contract-value': ['finance']` tambah `,\n  /** Customer credit limit (ADR-007: Finance owns money figures). */\n  'finance.edit-credit-limit': ['finance']`. Frontend `data/rbac.ts` `SEED_CAPABILITIES`: tambah `'crm.log-activity': ['admin', 'finance'],` dan `'finance.edit-credit-limit': ['finance'],`. Jalankan `bun run test test/rbac.test.ts`; bila test "every finance.* capability is finance-only" atau "portal roles have no capabilities" menuntut daftar eksplisit, sesuaikan daftarnya (bukan logika).

- [ ] **Step 4: Repository** — `PartyRow` + `partyView` diperluas sesuai Produces; `PARTY_SELECT` konstanta baru dengan semua kolom + `to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as created_on`; `listParties`/`getParty` memakai `PARTY_SELECT`. `creditLimitMinor: canSeeCommercials(actor) ? r.credit_limit_minor : null`. Portal view tetap tanpa `provenance`.

- [ ] **Step 5: `party-writes.ts`** — pola sama `project-writes.ts`:

```ts
import { ROLE_DEFINITIONS, type Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/** Customer profile writes (S1). Lifecycle changes only through Won (project-writes) and credit limit only through Finance. */
export const COMPANY_TYPES = ['private-company', 'bumn', 'government-agency', 'university', 'foundation', 'event-organizer', 'travel-agent', 'other'] as const

const TEXT_FIELDS = {
  industry: 'industry', size: 'size', address: 'address', city: 'city', province: 'province', country: 'country',
  postalCode: 'postal_code', phone: 'phone', website: 'website', registrationNumber: 'registration_number',
  billingName: 'billing_name', billingAddress: 'billing_address', paymentTerm: 'payment_term', travelPreferences: 'travel_preferences'
} as const
type TextField = keyof typeof TEXT_FIELDS
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PartyInput = Partial<Record<TextField | 'name' | 'email' | 'npwp' | 'companyType' | 'accountOwnerUserId' | 'partyType' | 'lifecycleStatus', string | null>> & { poRequired?: boolean }

function cleanText(value: unknown, field: string, problems: FieldErrors, max = 500): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems[field] = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s || null
}

async function profile(tx: Queryable, input: PartyInput & Record<string, unknown>, problems: FieldErrors) {
  const out: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) problems.name = ['Nama customer wajib diisi.']
    else if (name.length > 200) problems.name = ['Maksimal 200 karakter.']
    else out.name = name
  }
  for (const f of Object.keys(TEXT_FIELDS) as TextField[]) {
    const v = cleanText(input[f], f, problems)
    if (v !== undefined) out[f] = v
  }
  const email = cleanText(input.email, 'email', problems, 200)
  if (email !== undefined) { if (email && !EMAIL.test(email)) problems.email = ['Format email tidak valid.']; else out.email = email }
  const npwp = cleanText(input.npwp, 'npwp', problems, 40)
  if (npwp !== undefined) {
    const digits = npwp?.replace(/[.\-\s]/g, '') ?? ''
    if (npwp && !/^\d{15,16}$/.test(digits)) problems.npwp = ['NPWP harus 15–16 digit.']
    else out.npwp = npwp
  }
  if (input.companyType !== undefined) {
    if (input.companyType === null || (COMPANY_TYPES as readonly string[]).includes(input.companyType)) out.companyType = input.companyType
    else problems.companyType = ['Jenis perusahaan tidak dikenal.']
  }
  if (input.poRequired !== undefined) {
    if (typeof input.poRequired === 'boolean') out.poRequired = input.poRequired
    else problems.poRequired = ['Harus ya/tidak.']
  }
  if (input.accountOwnerUserId !== undefined) {
    if (input.accountOwnerUserId === null) out.accountOwnerUserId = null
    else {
      const [u] = await tx.query<{ role: string }>('select role from users where id = $1', [input.accountOwnerUserId])
      if (!u || ROLE_DEFINITIONS[u.role as keyof typeof ROLE_DEFINITIONS]?.kind !== 'internal') problems.accountOwnerUserId = ['AE tidak dikenal.']
      else out.accountOwnerUserId = input.accountOwnerUserId
    }
  }
  return out
}

const COLUMN: Record<string, string> = {
  ...TEXT_FIELDS, name: 'name', email: 'email', npwp: 'npwp', companyType: 'company_type',
  poRequired: 'po_required', accountOwnerUserId: 'account_owner_user_id'
}

export async function createParty(tx: Queryable, actor: Actor, input: PartyInput & Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama customer wajib diisi.']
  if (input.partyType !== 'company' && input.partyType !== 'individual') problems.partyType = ['Pilih perusahaan atau individu.']
  const lifecycle = input.lifecycleStatus ?? 'prospect'
  if (lifecycle !== 'prospect' && lifecycle !== 'client') problems.lifecycleStatus = ['Status harus prospect atau client.']
  if (input.creditLimitMinor !== undefined) problems.creditLimitMinor = ['Limit kredit diatur Finance setelah customer dibuat.']
  const p = await profile(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const id = await nextId(tx, 'PTY-')
  const cols = ['id', 'party_type', 'lifecycle_status', ...Object.keys(p).map(k => COLUMN[k]!)]
  const vals = [id, input.partyType, lifecycle, ...Object.values(p)]
  await tx.query(`insert into parties (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals)
  await recordAudit(tx, { action: 'party.created', actorUserId: actor.userId, entityType: 'party', entityId: id, requestId, after: { partyType: input.partyType, lifecycleStatus: lifecycle, ...p } })
  return { id }
}

const FORBIDDEN_PATCH = ['id', 'creditLimitMinor', 'lifecycleStatus', 'partyType', 'provenance']

export async function updateParty(tx: Queryable, actor: Actor, id: string, input: PartyInput & Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN_PATCH.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit customer.']])))
  const [current] = await tx.query<Record<string, unknown>>('select * from parties where id = $1 for update', [id])
  if (!current) throw errors.notFound('Customer')
  const problems: FieldErrors = {}
  const p = await profile(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const keys = Object.keys(p)
  if (!keys.length) return
  await tx.query(
    `update parties set ${keys.map((k, i) => `${COLUMN[k]} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
    [id, ...Object.values(p)]
  )
  await recordAudit(tx, {
    action: 'party.updated', actorUserId: actor.userId, entityType: 'party', entityId: id, requestId,
    before: Object.fromEntries(keys.map(k => [k, current[COLUMN[k]!]])), after: p
  })
}

export async function setCreditLimit(tx: Queryable, actor: Actor, id: string, input: { creditLimitMinor?: string | null; reason?: string }, requestId: string): Promise<void> {
  const problems: FieldErrors = {}
  let value: bigint | null = null
  if (input.creditLimitMinor !== null) {
    try { value = parseAmountMinor(input.creditLimitMinor, 'creditLimitMinor', { allowZero: true }) } catch { problems.creditLimitMinor = ['Limit kredit harus angka rupiah ≥ 0, atau kosong untuk tanpa batas.'] }
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) problems.reason = ['Alasan perubahan wajib diisi.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [current] = await tx.query<{ credit_limit_minor: string | null }>('select credit_limit_minor from parties where id = $1 for update', [id])
  if (!current) throw errors.notFound('Customer')
  await tx.query('update parties set credit_limit_minor = $2, updated_at = now() where id = $1', [id, value?.toString() ?? null])
  await recordAudit(tx, {
    action: 'party.credit_limit_changed', actorUserId: actor.userId, entityType: 'party', entityId: id, requestId, reason,
    before: { creditLimitMinor: current.credit_limit_minor }, after: { creditLimitMinor: value?.toString() ?? null }
  })
}
```

> Implementer: `AppError` dipakai di Task 3 (`rule`); hapus impor bila lint mengeluh di task ini. Body `t.Record(t.String(), t.Unknown())` membuat `poRequired` boolean lolos; validasi sendiri di atas.

- [ ] **Step 6: Routes** — import `createParty, setCreditLimit, updateParty`; setelah `.get('/parties/:id', …)`:

```ts
    .post('/parties', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-party')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /parties', key, body }, tx =>
        createParty(tx, actor, body as Parameters<typeof createParty>[2], requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getParty(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/parties/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-party')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      await db.transaction(tx => updateParty(tx, actor, id, body as Parameters<typeof updateParty>[3], requestIdOf(request)))
      return ok(request, await getParty(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .put('/parties/:id/credit-limit', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.edit-credit-limit')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      await db.transaction(tx => setCreditLimit(tx, actor, id, body as Parameters<typeof setCreditLimit>[3], requestIdOf(request)))
      return ok(request, await getParty(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
```

- [ ] **Step 7:** `bun run test test/party-writes.test.ts test/rbac.test.ts test/core-scope.test.ts test/finance-permissions.test.ts && bun run typecheck` → PASS.

- [ ] **Step 8: Commit** `feat(core): buat dan edit customer lewat API, limit kredit oleh Finance`.

---

### Task 3: Kontak, aktivitas, dan promosi prospect → client saat Won

**Files:**
- Modify: `party-writes.ts`, `repository.ts`, `routes.ts`, `project-writes.ts`
- Test: `backend/test/party-writes.test.ts`

**Interfaces:**
- Produces: `createContact(tx, actor, partyId, input, requestId)`, `createActivity(tx, actor, partyId, input, today, requestId)`; `listContacts(db, partyId?)` (tanpa partyId = semua), `listActivities(db, { partyId?, leadId? })` — scope dicek di route. Endpoint: `GET/POST /parties/:id/contacts`, `GET /party-contacts` (semua kontak, internal `canListParties`), `POST /parties/:id/activities`, `GET /party-activities?partyId=&leadId=`. Contact view `{ id, partyId, name, title, email, phone }`; activity view `{ id, partyId, leadId, type, message, ownerUserId, activityDate, dueAt }`.

- [ ] **Step 1: Test gagal** — tambahkan ke `party-writes.test.ts`:

```ts
describe('contacts and activities', () => {
  test('admin adds a contact; list shows it; client of another company gets 404', async () => {
    const res = await t.call('POST', '/api/v1/parties/PTY-002/contacts', { cookie: c.admin, body: { name: 'Rina', title: 'Travel Manager', email: 'rina@alam.example' } })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ id: expect.stringMatching(/^CP-\d+$/), partyId: 'PTY-002', name: 'Rina', title: 'Travel Manager' })
    const list = await t.call('GET', '/api/v1/parties/PTY-002/contacts', { cookie: c.finance })
    expect(list.json.data.map((x: { name: string }) => x.name)).toContain('Rina')
    expect((await t.call('GET', '/api/v1/parties/PTY-002/contacts', { cookie: c.client })).status).toBe(404)
    expect((await t.call('POST', '/api/v1/parties/PTY-002/contacts', { cookie: c.admin, body: { name: '', title: '' } })).status).toBe(400)
    expect((await t.call('POST', '/api/v1/parties/PTY-002/contacts', { cookie: c.finance, body: { name: 'X', title: 'Y' } })).status).toBe(403)
    const all = await t.call('GET', '/api/v1/party-contacts', { cookie: c.finance })
    expect(all.json.data.length).toBeGreaterThan(1)
    expect((await t.call('GET', '/api/v1/party-contacts', { cookie: c.client })).status).toBe(403)
  })

  test('admin and finance log activities (owner = caller); list by lead', async () => {
    const a = await t.call('POST', '/api/v1/parties/PTY-002/activities', { cookie: c.admin, body: { type: 'call', message: 'Konfirmasi jadwal', leadId: 'LED-900' } })
    expect(a.status).toBe(201)
    expect(a.json.data).toMatchObject({ id: expect.stringMatching(/^PACT-\d+$/), type: 'call', leadId: 'LED-900', activityDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    const f = await t.call('POST', '/api/v1/parties/PTY-002/activities', { cookie: c.finance, body: { type: 'note', message: 'Tagihan dikirim' } })
    expect(f.status).toBe(201)
    expect(f.json.data.ownerUserId).not.toBe(a.json.data.ownerUserId)
    const byLead = await t.call('GET', '/api/v1/party-activities?leadId=LED-900', { cookie: c.finance })
    expect(byLead.json.data.map((x: { id: string }) => x.id)).toEqual([a.json.data.id])
    expect((await t.call('POST', '/api/v1/parties/PTY-002/activities', { cookie: c.admin, body: { type: 'gossip', message: 'x' } })).status).toBe(400)
  })
})

describe('won lead promotes the customer', () => {
  test('a project created from a lead turns a prospect into a client; finance can bill it', async () => {
    const party = await post('admin', { name: 'PT Prospek Baru', partyType: 'company' })
    const id = party.json.data.id as string
    const project = await t.call('POST', '/api/v1/projects', {
      cookie: c.admin, headers: { 'idempotency-key': key() },
      body: { name: 'Trip Prospek', partyId: id, leadId: 'LED-901', destination: 'Bali', travelStartDate: '2027-05-01', travelEndDate: '2027-05-04', serviceScope: ['hotel'], travelerCount: 5, contractValueMinor: '100000000' }
    })
    expect(project.status).toBe(201)
    expect((await t.call('GET', `/api/v1/parties/${id}`, { cookie: c.admin })).json.data.lifecycleStatus).toBe('client')
    const [audit] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'party.promoted_to_client' and entity_id = $1", [id])
    expect(audit!.n).toBe('1')
    const draft = await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId: project.json.data.id, invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '30000000' }], dueDate: '2027-04-01' } })
    expect(draft.status).toBe(201)
  })
})
```

- [ ] **Step 2:** `bun run test test/party-writes.test.ts` → FAIL (route 404 / masih prospect).

- [ ] **Step 3: Implementasi** — `party-writes.ts` tambah:

```ts
const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'note', 'follow-up'] as const

export async function createContact(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!name) problems.name = ['Nama kontak wajib diisi.']
  if (!title) problems.title = ['Jabatan wajib diisi.']
  const email = cleanText(input.email, 'email', problems, 200)
  if (email && !EMAIL.test(email)) problems.email = ['Format email tidak valid.']
  const phone = cleanText(input.phone, 'phone', problems, 50)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'CP-')
  await tx.query('insert into party_contacts (id, party_id, name, title, email, phone) values ($1, $2, $3, $4, $5, $6)', [id, partyId, name, title, email ?? null, phone ?? null])
  await recordAudit(tx, { action: 'party.contact_created', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { contactId: id, name, title } })
  return { id }
}

export async function createActivity(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (!(ACTIVITY_TYPES as readonly unknown[]).includes(input.type)) problems.type = ['Jenis aktivitas tidak dikenal.']
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) problems.message = ['Isi aktivitas wajib diisi.']
  else if (message.length > 2000) problems.message = ['Maksimal 2000 karakter.']
  const leadId = cleanText(input.leadId, 'leadId', problems, 64)
  const dueAt = input.dueAt === undefined || input.dueAt === null ? null : (typeof input.dueAt === 'string' && isIsoDate(input.dueAt) ? input.dueAt : (problems.dueAt = ['Tanggal harus YYYY-MM-DD.'], null))
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'PACT-')
  await tx.query(
    'insert into party_activities (id, party_id, lead_id, type, message, owner_user_id, activity_date, due_at) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, partyId, leadId ?? null, input.type, message, actor.userId, today, dueAt]
  )
  await recordAudit(tx, { action: 'party.activity_created', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { activityId: id, type: input.type } })
  return { id }
}
```

(import `isIsoDate` dari `../../shared/dates`; `today` dari `businessDateOf(new Date())` di route.)

`repository.ts` tambah `listContacts(db, actor, partyId)` dan `listActivities(db, actor, filter)` — keduanya memanggil `getParty`/`canListParties` untuk scope: internal dengan `canListParties` melihat semua; client hanya partyId sendiri (activities `where party_id = actor.partyId`); vendor → kosong/404. `listActivities` mengurutkan `activity_date, id`.

`routes.ts`:

```ts
    .get('/parties/:id/contacts', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListParties(actor)) throw errors.notFound('Customer')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      return ok(request, await listContacts(db, id))
    })
    .post('/parties/:id/contacts', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-party')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      const created = await db.transaction(tx => createContact(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listContacts(db, id)).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/party-contacts', async ({ request }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListParties(actor)) throw errors.forbidden()
      return ok(request, await listContacts(db))
    })
    .get('/party-activities', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListParties(actor)) throw errors.forbidden()
      for (const k of ['partyId', 'leadId'] as const) if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      return ok(request, await listActivities(db, { partyId: query.partyId, leadId: query.leadId }))
    }, { query: t.Object({ partyId: t.Optional(t.String()), leadId: t.Optional(t.String()) }) })
    .post('/parties/:id/activities', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.log-activity')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      const created = await db.transaction(tx => createActivity(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      set.status = 201
      return ok(request, (await listActivities(db, { partyId: id })).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
```

(Jadi `listContacts(db, partyId)` dan `listActivities(db, filter)` tanpa actor — scope sudah dicek di route. Sesuaikan Interfaces di ledger bila begitu.)

`project-writes.ts` `createProject`: setelah resolusi `partyId` (non group trip) dan sebelum insert project:

```ts
  if (input.leadId) {
    const promoted = await tx.query<{ id: string }>("update parties set lifecycle_status = 'client', updated_at = now() where id = $1 and lifecycle_status = 'prospect' returning id", [partyId])
    if (promoted.length) await recordAudit(tx, { action: 'party.promoted_to_client', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, details: { leadId: input.leadId } })
  }
```

(letakkan setelah pengecekan lead sudah jadi project, agar 409 tidak mempromosikan.)

- [ ] **Step 4:** `bun run test test/party-writes.test.ts test/project-writes.test.ts && bun run typecheck` → PASS.

- [ ] **Step 5: Commit** `feat(core): kontak dan aktivitas customer, Won menaikkan prospect jadi client`.

---

### Task 4: Tipe API frontend dan penggabungan customer

**Files:** Modify `app/types/api.ts`, `app/lib/api/endpoints.ts`; Create `app/data/parties-sync.ts`, `app/data/parties-sync.test-utils.ts`, `app/data/parties-sync.test.ts`.

**Interfaces:**
- Produces: `PartyDto` diperluas (semua field view Task 2, `createdAt`); `PartyContactDto`, `PartyActivityDto`, `PartyCreateInput`, `PartyPatchInput`, `CreditLimitInput`, `ContactCreateInput`, `ActivityCreateInput`. `api.core.createParty(input, key?)`, `updateParty(id, input)`, `setCreditLimit(id, input)`, `listContacts(partyId)`, `createContact(partyId, input)`, `listActivities(query)`, `createActivity(partyId, input)`. `upsertServerParty(dto): Party`, `mergeServerParties(list)`, `mergeServerContacts(list)`, `mergeServerActivities(list)`; test util `serverPartyDto(over)`.

- [ ] **Step 1: Tipe & endpoint** — tambahkan tipe sesuai view backend (camelCase sama persis) dan fungsi endpoint di blok `core` (POST party dengan `{ idempotencyKey }` seperti `createProject`).

- [ ] **Step 2: Test gagal** — `parties-sync.test.ts` (pola `projects-sync.test.ts`, restore `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` di `afterEach`):

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from './parties'
import { mergeServerActivities, mergeServerContacts, mergeServerParties, upsertServerParty } from './parties-sync'
import { serverPartyDto } from './parties-sync.test-utils'

const snap = <T>(a: T[]) => a.map(x => ({ ...x }))
const p0 = snap(PARTIES); const c0 = snap(CONTACTS); const a0 = snap(PARTY_ACTIVITIES)
afterEach(() => {
  PARTIES.splice(0, PARTIES.length, ...snap(p0)); CONTACTS.splice(0, CONTACTS.length, ...snap(c0)); PARTY_ACTIVITIES.splice(0, PARTY_ACTIVITIES.length, ...snap(a0))
})

describe('parties-sync', () => {
  it('update di tempat; field lokal (pendingProfileChange, logoFileName) tetap; limit kredit jadi creditLimitIdr', () => {
    const local = PARTIES.find(p => p.id === 'PTY-001')!
    local.logoFileName = 'logo.png'
    upsertServerParty(serverPartyDto({ id: 'PTY-001', city: 'Medan', creditLimitMinor: '750000000' }))
    expect(PARTIES.find(p => p.id === 'PTY-001')).toBe(local)
    expect(local).toMatchObject({ city: 'Medan', creditLimitIdr: 750_000_000, logoFileName: 'logo.png' })
  })

  it('creditLimitMinor null dari server berarti tanpa batas: creditLimitIdr dikosongkan', () => {
    const local = PARTIES.find(p => p.id === 'PTY-001')!
    local.creditLimitIdr = 5
    upsertServerParty(serverPartyDto({ id: 'PTY-001', creditLimitMinor: null }))
    expect(local.creditLimitIdr).toBeUndefined()
  })

  it('merge party menghapus yang tidak ada di server; kontak & aktivitas diganti daftar server', () => {
    mergeServerParties([serverPartyDto({ id: 'PTY-001' }), serverPartyDto({ id: 'PTY-050', name: 'Baru' })])
    expect(PARTIES.map(p => p.id)).toEqual(['PTY-001', 'PTY-050'])
    mergeServerContacts([{ id: 'CP-900', partyId: 'PTY-001', name: 'A', title: 'B', email: null, phone: null }])
    expect(CONTACTS.map(x => x.id)).toEqual(['CP-900'])
    mergeServerActivities([{ id: 'PACT-900', partyId: 'PTY-001', leadId: null, type: 'call', message: 'm', ownerUserId: 'USR-001', activityDate: '2026-10-01', dueAt: null }])
    expect(PARTY_ACTIVITIES[0]).toMatchObject({ id: 'PACT-900', ownerId: 'USR-001', createdAt: '2026-10-01' })
  })
})
```

> Catatan aturan limit kredit: server mengembalikan `creditLimitMinor: null` untuk peran internal hanya bila limit memang kosong (Admin/Finance/Super Admin punya `canViewFullFinancials`), jadi null = tanpa batas → `creditLimitIdr = undefined`.

- [ ] **Step 3:** `pnpm exec vitest run app/data/parties-sync.test.ts` → FAIL (modul tidak ada).

- [ ] **Step 4: `parties-sync.ts`** — `serverPartyFields(dto)` memetakan semua field (`accountOwnerUserId → accountOwnerId`, `creditLimitMinor → creditLimitIdr` (Number atau undefined), `createdAt`, `partyType ?? undefined`, `null → undefined`); `upsertServerParty` (Object.assign / push, pola `upsertServerProject`); `mergeServerParties` (hapus yang tidak ada, upsert semua); `mergeServerContacts`/`mergeServerActivities` (splice seluruh array, petakan `ownerUserId → ownerId`, `activityDate → createdAt`, null → undefined).

- [ ] **Step 5:** test PASS + `pnpm typecheck` + eslint file baru bersih.

- [ ] **Step 6: Commit** `feat(frontend): gabungkan customer, kontak, aktivitas dari server`.

---

### Task 5: Muat customer setelah login dan sink aktivitas

**Files:** Modify `app/data/parties-sync.ts`, `app/data/index.ts`, `app/layouts/dashboard.vue`, `app/pages/settings.vue`; Test `app/data/parties-sync.test.ts`.

**Interfaces:**
- Produces: `loadServerCustomers(api): Promise<void>` (semua halaman `GET /parties`, `GET /party-contacts`, `GET /party-activities`), `api.core.listAllContacts()`; `useCustomersSync()`; di `index.ts`: `setPartyActivitySink(fn: ((a: PartyActivity) => void) | null)`; `createPartyActivity` memanggil sink setelah push.

- [ ] **Step 1: Test gagal** (frontend):

```ts
describe('sink aktivitas', () => {
  it('createPartyActivity memanggil sink; sukses mengganti id lokal dengan id server', async () => {
    const sent: string[] = []
    setPartyActivitySink((a) => { sent.push(a.message) })
    const activity = createPartyActivity({ partyId: 'PTY-001', type: 'note', message: 'Halo', ownerId: 'USR-001' })
    expect(sent).toEqual(['Halo'])
    setPartyActivitySink(null)
    await applyServerActivityId(activity.id, 'PACT-777')
    expect(PARTY_ACTIVITIES.some(a => a.id === 'PACT-777' && a.message === 'Halo')).toBe(true)
  })

  it('sink gagal: aktivitas tetap ada dan notifikasi dipanggil', async () => {
    const warned: string[] = []
    const sink = makeActivitySink({ core: { createActivity: () => Promise.reject(new Error('down')) } } as never, msg => warned.push(msg))
    const activity = createPartyActivity({ partyId: 'PTY-001', type: 'call', message: 'Tes', ownerId: 'USR-001' })
    await sink(activity)
    expect(PARTY_ACTIVITIES.some(a => a.id === activity.id)).toBe(true)
    expect(warned).toHaveLength(1)
  })
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement:
  - `index.ts`: `let partyActivitySink: ((a: PartyActivity) => void) | null = null; export function setPartyActivitySink (fn) { partyActivitySink = fn }`; di `createPartyActivity` setelah push: `partyActivitySink?.(PARTY_ACTIVITIES[PARTY_ACTIVITIES.length - 1]!)`.
  - `parties-sync.ts`: `applyServerActivityId(localId, serverId)`; `makeActivitySink(api, warn)` → `async (a) => { try { const res = await api.core.createActivity(a.partyId, { type: a.type, message: a.message, leadId: a.leadId, dueAt: a.dueAt }); applyServerActivityId(a.id, res.data.id) } catch { warn('Aktivitas belum tersimpan ke server. Akan hilang setelah halaman dimuat ulang.') } }`.
  - `loadServerCustomers(api)`: semua halaman parties → `mergeServerParties`; `listAllContacts` → `mergeServerContacts`; `listActivities({})` → `mergeServerActivities`. Gagal → lempar (array tidak disentuh sampai semua sukses).
  - `useCustomersSync()` (pola `useProjectsSync`): setelah sukses `setPartyActivitySink(makeActivitySink(api, msg => showToast('Aktivitas', msg, 'warning')))`; gagal → `setPartyActivitySink(null)`.
  - Layout: panggil `customersSync.load()` bersama `projectsSync.load()`; banner tampil bila salah satu offline/error, pesan menyebut "customer" atau "project".
  - Settings reset: juga `customersSync.load(true)`.
- [ ] **Step 4:** test + typecheck + eslint. **Step 5: Commit** `feat(frontend): muat customer dari server dan kirim aktivitas di belakang`.

---

### Task 6: Pembuatan customer, qualify lead, dan kontak lewat server

**Files:** Modify `app/data/index.ts` (`qualifyLeadForQuotation(leadId, partyId)`, `qualifyLeadAndCreateSalesOrder(leadId, input & { partyId })`, `qualifyGroupTripLead(leadId, input & { partyId })` tidak lagi membuat party; `applyLeadWon` tidak mengubah lifecycle), `app/data/parties-sync.ts` (`createPartyOnServer`, `ensureCustomerForLead`, `createContactOnServer`), `app/data/projects-sync.ts` (`markLeadWonOnServer` memuat ulang party setelah Won), pages `customer-journey/customers/index.vue`, `crm/parties/[id]/index.vue`, `components/sales/LeadDetailSheet.vue`; Test `parties-sync.test.ts`.

**Interfaces:**
- Produces: `createPartyOnServer(api, input: PartyCreateInput, key?): Promise<Party>`; `ensureCustomerForLead(api, leadId, kind: 'company' | 'individual', key?): Promise<Party>` — cari party lokal (company: nama sama, case-insensitive; individual: `partyType === 'individual'` + nama lead) sebelum POST; `createContactOnServer(api, partyId, input): Promise<ContactPerson>`.

- [ ] **Step 1: Test gagal:**

```ts
describe('ensureCustomerForLead', () => {
  it('memakai party yang sudah ada (nama sama) tanpa memanggil API', async () => {
    const lead = LEADS.find(l => l.companyName && PARTIES.some(p => p.name.toLowerCase() === l.companyName!.toLowerCase()))!
    let calls = 0
    const party = await ensureCustomerForLead({ core: { createParty: () => { calls++; return Promise.reject(new Error('x')) } } } as never, lead.id, 'company')
    expect(party.name.toLowerCase()).toBe(lead.companyName!.toLowerCase())
    expect(calls).toBe(0)
  })

  it('membuat party di server bila belum ada; error diteruskan tanpa mengubah lead', async () => {
    const lead = LEADS.find(l => l.companyName && !PARTIES.some(p => p.name.toLowerCase() === l.companyName!.toLowerCase()))!
    const before = { ...lead }
    const created = await ensureCustomerForLead({ core: { createParty: (input: { name: string }) => Promise.resolve({ data: serverPartyDto({ id: 'PTY-060', name: input.name, lifecycleStatus: 'prospect' }) }) } } as never, lead.id, 'company')
    expect(created.id).toBe('PTY-060')
    await expect(ensureCustomerForLead({ core: { createParty: () => Promise.reject(new Error('down')) } } as never, LEADS.find(l => l.companyName && l.id !== lead.id && !PARTIES.some(p => p.name.toLowerCase() === l.companyName!.toLowerCase()))!.id, 'company')).rejects.toThrow('down')
    expect(lead.stage).toBe(before.stage)
  })
})
```

(Bila fixture tidak punya lead yang memenuhi syarat, buat lead uji lewat helper lead yang ada (`createLead`) di test.)

- [ ] **Step 2:** FAIL. **Step 3:** implement di `parties-sync.ts` dan ubah fungsi qualify di `index.ts`: parameter `partyId` wajib; hapus blok `nextSequentialId('PTY-', PARTIES)` di kedua fungsi; `qualifyLeadForQuotation(leadId, partyId)` memakai `getPartyById(partyId)` (return undefined bila tidak ada). `applyLeadWon`: hapus baris `if (party.lifecycleStatus === 'prospect') { party.lifecycleStatus = 'client' }` (server). `markLeadWonOnServer`: setelah `registerNewServerProject`, `await api.core.getParty(project.partyId)` → `upsertServerParty` (abaikan error).
- [ ] **Step 4: Halaman:**
  - `customer-journey/customers/index.vue`: `submitCreate` async → `createPartyOnServer(api, { name, partyType: 'company', industry }, key)`; tombol disabled saat pending; error → toast `error.message`.
  - `LeadDetailSheet.vue` `doQualify` async: B2C → `const party = await ensureCustomerForLead(api, id, 'individual')` lalu `qualifyLeadAndCreateSalesOrder(id, { priceIdr, partyId: party.id })`; B2B → `ensureCustomerForLead(api, id, 'company')` lalu `qualifyLeadForQuotation(id, party.id)`. `doQualifyGroupTrip` cabang qualified/waitlist: hanya bila `requestedPax <= getProjectSeatsAvailable(projectId)` panggil `ensureCustomerForLead(…, 'individual')` dan teruskan `partyId`; selain itu panggil tanpa party (fungsi mengembalikan waitlist sebelum butuh party — pastikan `qualifyGroupTripLead` mengecek seat sebelum memakai `partyId`). Semua dibungkus try/catch → toast pesan server; guard `isQualifying`.
  - `crm/parties/[id]/index.vue` `submitContact` async → `createContactOnServer`; aktivitas tetap `createPartyActivity` (sink mengirim).
- [ ] **Step 5:** `pnpm test && pnpm typecheck` + lint delta file yang diubah = 0 error baru. **Step 6: Commit** `feat(frontend): customer, qualify lead, dan kontak lewat server`.

---

### Task 7: Limit kredit oleh Finance

**Files:** Modify `app/pages/customer-journey/customers/[id]/index.vue`, `app/data/parties-sync.ts` (`setCreditLimitOnServer`), hapus `updatePartyCreditLimit` dari `index.ts` bila tidak dipakai lagi; Test `parties-sync.test.ts`.

- [ ] **Step 1: Test gagal** — `setCreditLimitOnServer(api, 'PTY-001', null, 'alasan')` mengirim `{ creditLimitMinor: null, reason }` dan menerapkan jawaban (creditLimitIdr undefined); nominal 500_000_000 dikirim sebagai `'500000000'`.
- [ ] **Step 2:** FAIL. **Step 3:** implement; halaman: `canManageCredit` = `session.can('finance.edit-credit-limit')` (pakai `useServerSession`), tambah field "Alasan perubahan" (Textarea wajib) di sheet, `submitEditCreditLimit` async dengan pending + toast error server.
- [ ] **Step 4:** test + typecheck + lint. **Step 5: Commit** `feat(frontend): limit kredit customer diubah Finance lewat server`.

---

### Task 8: Dokumentasi, verifikasi penuh, uji API

- [ ] ADR-007: catatan update "Limit kredit customer milik Finance (`finance.edit-credit-limit`), disimpan `parties.credit_limit_minor`". ADR-004: update S1 (customer ditulis lewat API). Spec status → diimplementasikan. `CLAUDE.md` root: sebut `db:seed:demo` kini membawa kontak & aktivitas.
- [ ] `cd backend && bun run typecheck && bun run test`; `cd frontend && pnpm typecheck && pnpm test && pnpm build` — semua lulus.
- [ ] Migrasi DB lokal (`bun run db:migrate && bun run db:seed:demo`, backend mati). Smoke API di backend sementara :3100 dengan salinan DB: buat customer, tambah kontak, aktivitas, limit kredit Finance/Admin, qualify→Won→project→invoice; hentikan & hapus salinan.
- [ ] Commit `docs: status backend customer (S1)`.
