# Backend alur Project Order & tim (S3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Status/alur Project Order (handover, maju step, ready, tutup finance, tutup project, batal) dan tim project disimpan di server; aturan yang datanya di server ditegakkan server.

**Architecture:** Kolom alur di `projects` + endpoint perintah di modul `core` (pola S0: capability, validasi, audit). Hambatan Finance dan fakta DP dihitung dari `projectFinanceSummary`. Frontend mengambil status/alur/tim dari server lewat `projects-sync.ts`, dan mutator alur menjadi async memanggil server setelah gate lokal lolos.

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vue 3 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-project-workflow-backend-design.md`

## Global Constraints

- `bun` di `backend/`, `pnpm` di `frontend/`. Verifikasi backend: `bun test --timeout 30000 <file>` / `bun run test` (bukan `bun test` polos).
- Pesan Bahasa Indonesia; aturan bisnis 422 `RULE_VIOLATION` (`rule()` lokal seperti di `project-writes.ts`); validasi 400.
- `recordAudit` di transaksi yang sama. Capability yang dipakai sudah ada di kedua RBAC (`project-order.accept-handover`, `.advance-step`, `.close`, `.request-cancellation`) — **tidak** ada capability baru.
- Bentuk response berubah → `frontend/app/types/api.ts` + `lib/api/endpoints.ts` di commit yang sama.
- Migrasi baru `0020_project_workflow.up/down.sql`.
- File frontend CRLF: edit dengan tool Edit atau normalisasi `\r` di skrip.
- `pnpm typecheck` tidak memeriksa apa pun — pakai `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` dan saring file yang disentuh (abaikan pola lama `on type 'unknown'`).
- Commit tiap task, lokal (jangan push).

## Review Focus

1. Admin menekan "Lanjut" dua kali cepat di step Drafting (draft → planning → confirmed berantai) → status akhir tetap `confirmed`, tidak error setengah jalan. (Task 4 test rantai; server menolak transisi kedua yang sudah terjadi dengan pesan jelas, frontend memuat ulang project.)
2. Finance mencatat pembatalan project dari status `completed` → kasus tercatat, status tidak berubah, UI memberi tahu. (Task 2 test.)
3. Gate lokal belum lolos (mis. traveler kurang) → tombol tetap memblokir dan server tidak dipanggil. (Task 4 test.)
4. Menutup project tanpa catatan akhir → ditolak di UI dan di server. (Task 1 test; Task 5 dialog.)
5. Muat ulang setelah handover/ready/tutup → status dan step tetap (dari server). (Task 3 test sinkron.)

---

### Task 1: Migrasi 0020, view alur, dan endpoint perintah alur + tim

**Files:**
- Create: `backend/migrations/0020_project_workflow.up.sql`, `.down.sql`
- Create: `backend/src/modules/core/project-workflow.ts`
- Modify: `backend/src/modules/core/repository.ts` (ProjectRow, ProjectInternalView, projectView, PROJECT_SELECT)
- Modify: `backend/src/modules/core/routes.ts`
- Modify: `backend/src/modules/finance/summaries.ts` (export `projectFinanceBlockers`)
- Modify: `backend/src/db/seed-demo.ts`, `backend/scripts/extract-demo-core.ts`, regenerate `demo-core.json`
- Test: `backend/test/project-workflow.test.ts`

**Interfaces:**
- Produces: kolom `handover_accepted_at, handover_accepted_by, handover_returned_at, handover_return_reason, ready_at, finance_settled_at, finance_settled_by, closed_at, closed_by, final_note, client_feedback`. View internal tambahan (tanggal `YYYY-MM-DD` atau null): `handoverAcceptedAt, handoverAcceptedBy, handoverReturnedAt, handoverReturnReason, readyAt, financeSettledAt, financeSettledBy, closedAt, closedBy, finalNote, clientFeedback`. `STATUS_TRANSITIONS: Record<string, string[]>`. `projectFinanceBlockers(db, projectId): Promise<string[]>`. Endpoint: `POST /projects/:id/handover/accept`, `/handover/return {reason}`, `/transition {to, reason?}`, `/ready`, `/finance-close`, `/close {finalNote, clientFeedback?}`, `PUT/DELETE /projects/:id/members/:userId` — semua mengembalikan `getProject(...)`.

- [ ] **Step 1: Test gagal** — `backend/test/project-workflow.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const newProject = async (over: Record<string, unknown> = {}) => (await t.call('POST', '/api/v1/projects', {
  cookie: c.admin, headers: { 'idempotency-key': `wf-key-${++n}-abcdef` },
  body: { name: `Alur ${n}`, partyId: 'PTY-002', destination: 'Bali', travelStartDate: '2027-06-01', travelEndDate: '2027-06-04', serviceScope: ['hotel'], travelerCount: 4, contractValueMinor: '100000000', ...over }
})).json.data.id as string
const act = (who: string, path: string, body: unknown = {}, method = 'POST') => t.call(method, `/api/v1/projects/${path}`, { cookie: c[who], body })

describe('handover and transitions', () => {
  test('planning needs an accepted handover; transitions follow the map; audit keeps before/after', async () => {
    const id = await newProject()
    const early = await act('admin', `${id}/transition`, { to: 'planning' })
    expect(early.status).toBe(422)
    expect((await act('admin', `${id}/handover/accept`)).json.data.handoverAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((await act('admin', `${id}/handover/accept`)).status).toBe(422)
    expect((await act('admin', `${id}/transition`, { to: 'planning' })).json.data.status).toBe('planning')
    expect((await act('admin', `${id}/transition`, { to: 'completed' })).status).toBe(422)
    expect((await act('admin', `${id}/transition`, { to: 'on-hold' })).status).toBe(400)
    expect((await act('admin', `${id}/transition`, { to: 'on-hold', reason: 'Klien menunda' })).json.data.status).toBe('on-hold')
    const [audit] = await t.db.query<{ before: { status: string }; after: { status: string }; reason: string }>(
      "select before, after, reason from audit_events where action = 'project.status_changed' and entity_id = $1 order by id desc limit 1", [id]
    )
    expect(audit).toMatchObject({ before: { status: 'planning' }, after: { status: 'on-hold' }, reason: 'Klien menunda' })
  })

  test('return handover needs a reason; finance cannot advance; cancellation capability is separate', async () => {
    const id = await newProject()
    expect((await act('admin', `${id}/handover/return`, {})).status).toBe(400)
    expect((await act('admin', `${id}/handover/return`, { reason: 'Data quotation kurang' })).json.data.handoverReturnReason).toBe('Data quotation kurang')
    expect((await act('finance', `${id}/handover/accept`)).status).toBe(403)
    expect((await act('finance', `${id}/transition`, { to: 'planning' })).status).toBe(403)
    expect((await act('finance', `${id}/transition`, { to: 'cancelled', reason: 'Dibatalkan klien' })).json.data.status).toBe('cancelled')
    expect((await act('admin', 'PRJ-999/transition', { to: 'planning' })).status).toBe(404)
  })
})

describe('ready, finance close and close', () => {
  test('ready needs the DP invoiced and paid; finance close needs no blockers; close needs completed + note', async () => {
    const id = await newProject({ contractValueMinor: '50000000' })
    await act('admin', `${id}/handover/accept`)
    await act('admin', `${id}/transition`, { to: 'planning' })
    await act('admin', `${id}/transition`, { to: 'confirmed' })
    expect((await act('admin', `${id}/ready`)).status).toBe(422)

    const accounts = (await t.call('GET', '/api/v1/finance/accounts', { cookie: c.finance })).json.data
    let accountId = accounts[0]?.id as string | undefined
    if (!accountId) {
      accountId = (await t.call('POST', '/api/v1/finance/accounts', { cookie: c.finance, body: { code: 'BCA-WF', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '1234567890' } })).json.data.id
      await t.call('POST', `/api/v1/finance/accounts/${accountId}/opening`, { cookie: c.finance, body: { amountMinor: '1000000000', openingDate: '2026-01-01' } })
      await t.call('POST', `/api/v1/finance/accounts/${accountId}/opening/verify`, { cookie: c.superAdmin, body: { balanceMinor: '1000000000', openingDate: '2026-01-01' } })
    }
    const dp = (await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId: id, invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '20000000' }], dueDate: '2027-05-01' } })).json.data
    await t.call('POST', `/api/v1/finance/customer-invoices/${dp.id}/issue`, { cookie: c.finance, body: {} })
    expect((await act('admin', `${id}/ready`)).status).toBe(422)
    await t.call('POST', '/api/v1/finance/receipts', {
      cookie: c.finance, headers: { 'idempotency-key': `wf-rcpt-${id}-abcdef` },
      body: { bankAccountId: accountId, amountMinor: '20000000', effectiveDate: '2026-02-01', partyId: 'PTY-002', projectId: id, allocations: [{ invoiceId: dp.id, amountMinor: '20000000' }] }
    })
    expect((await act('admin', `${id}/ready`)).json.data.readyAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await act('admin', `${id}/transition`, { to: 'in-progress' })
    await act('admin', `${id}/transition`, { to: 'completed' })
    const blocked = await act('admin', `${id}/finance-close`)
    expect(blocked.status).toBe(422)
    expect(blocked.json.error.message).toContain('belum seluruhnya ditagih')
    expect((await act('admin', `${id}/close`, { finalNote: 'Selesai' })).status).toBe(422)

    const fin = (await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId: id, invoiceType: 'final', lines: [{ description: 'Pelunasan', amountMinor: '30000000' }], dueDate: '2027-05-20' } })).json.data
    await t.call('POST', `/api/v1/finance/customer-invoices/${fin.id}/issue`, { cookie: c.finance, body: {} })
    await t.call('POST', '/api/v1/finance/receipts', {
      cookie: c.finance, headers: { 'idempotency-key': `wf-rcpt2-${id}-abcdef` },
      body: { bankAccountId: accountId, amountMinor: '30000000', effectiveDate: '2026-02-02', partyId: 'PTY-002', projectId: id, allocations: [{ invoiceId: fin.id, amountMinor: '30000000' }] }
    })
    expect((await act('admin', `${id}/finance-close`)).json.data.financeSettledAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((await act('admin', `${id}/close`, {})).status).toBe(400)
    const closed = await act('admin', `${id}/close`, { finalNote: 'Trip lancar', clientFeedback: 'Puas' })
    expect(closed.json.data).toMatchObject({ closedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), finalNote: 'Trip lancar', clientFeedback: 'Puas' })
    expect((await act('admin', `${id}/close`, { finalNote: 'Lagi' })).status).toBe(422)
  }, 30_000)
})

describe('team', () => {
  test('add and remove members; the owner stays; unknown user 400', async () => {
    const id = await newProject()
    const added = await act('admin', `${id}/members/USR-003`, {}, 'PUT')
    expect(added.json.data.teamUserIds).toContain('USR-003')
    expect((await act('admin', `${id}/members/USR-003`, {}, 'DELETE')).json.data.teamUserIds).not.toContain('USR-003')
    const owner = added.json.data.ownerUserId as string
    expect((await act('admin', `${id}/members/${owner}`, {}, 'DELETE')).status).toBe(422)
    expect((await act('admin', `${id}/members/USR-999`, {}, 'PUT')).status).toBe(400)
    expect((await act('finance', `${id}/members/USR-003`, {}, 'PUT')).status).toBe(403)
  })
})
```

> Implementer: cek bentuk body akun/saldo pembuka/receipt di `test/finance-arap.test.ts` atau `finance-acceptance.test.ts` dan sesuaikan helper akun di atas (bila seed test tidak punya rekening). Bila `makeTestApp` tidak membuat rekening, blok `if (!accountId)` yang membuatnya.

- [ ] **Step 2:** `cd backend && bun test --timeout 30000 test/project-workflow.test.ts` → FAIL (404 route).

- [ ] **Step 3: Migrasi** `0020_project_workflow.up.sql`:

```sql
-- Project Order workflow (S3b): handover, ready, finance close and close move to the server with the status.
alter table projects
  add column handover_accepted_at   timestamptz,
  add column handover_accepted_by   text references users (id),
  add column handover_returned_at   timestamptz,
  add column handover_return_reason text,
  add column ready_at               timestamptz,
  add column finance_settled_at     timestamptz,
  add column finance_settled_by     text references users (id),
  add column closed_at              timestamptz,
  add column closed_by              text references users (id),
  add column final_note             text,
  add column client_feedback        text;
```

`.down.sql`: `alter table projects drop column if exists …` untuk ke-11 kolom.

- [ ] **Step 4: Repository** — `ProjectRow` + `ProjectInternalView` + `projectView` mendapat 11 field (camelCase seperti Interfaces). `PROJECT_SELECT` menambah, untuk tiap timestamptz `x`: `to_char(p.x at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as x`, plus `p.handover_accepted_by, p.handover_return_reason, p.finance_settled_by, p.closed_by, p.final_note, p.client_feedback`.

- [ ] **Step 5: Hambatan Finance** — `summaries.ts`:

```ts
/** What still blocks closing a project's finance (same list as the Finance panel in the UI). */
export async function projectFinanceBlockers(db: Db, projectId: string): Promise<string[]> {
  const f = await projectFinanceSummary(db, projectId, true)
  if (f.view !== 'full') return []
  const out: string[] = []
  const open = f.invoices.filter(i => i.status === 'issued' && BigInt(i.outstandingMinor) > 0n).length
  if (open) out.push(`${open} invoice customer masih punya sisa tagihan.`)
  if (f.receivable.draftCount) out.push(`${f.receivable.draftCount} draft invoice belum diterbitkan atau dihapus.`)
  if (BigInt(f.receivable.scheduledNotInvoicedMinor) > 0n) out.push('Masih ada rencana tagihan yang belum ditagih atau dibatalkan.')
  else if (f.receivable.uninvoicedMinor !== null && BigInt(f.receivable.uninvoicedMinor) > 0n) out.push('Nilai kontrak belum seluruhnya ditagih.')
  if (f.payable.pendingReviewCount) out.push(`${f.payable.pendingReviewCount} invoice vendor belum direview.`)
  if (BigInt(f.payable.outstandingMinor) > 0n) out.push('Masih ada utang vendor yang belum dibayar.')
  if (f.refunds.openCount) out.push(`${f.refunds.openCount} kasus refund belum selesai.`)
  return out
}
```

(Cek nama field persis di objek return `projectFinanceSummary`/`invoiceRowDto`; sesuaikan.)

- [ ] **Step 6: `project-workflow.ts`**:

```ts
import { ROLE_DEFINITIONS, type Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { projectFinanceBlockers, projectFinanceSummary } from '../finance/summaries'

/** Project Order workflow commands (S3b). Gates whose data lives in the frontend (travelers, itinerary, …) stay in the UI. */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['planning', 'on-hold', 'cancelled'],
  planning: ['confirmed', 'on-hold', 'cancelled'],
  confirmed: ['in-progress', 'on-hold', 'cancelled'],
  'in-progress': ['ongoing-trip', 'completed', 'on-hold', 'cancelled'],
  'ongoing-trip': ['completed', 'on-hold', 'cancelled'],
  completed: [],
  'on-hold': ['planning', 'confirmed', 'in-progress', 'cancelled'],
  cancelled: []
}

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
type Row = { status: string; handover_accepted_at: string | null; ready_at: string | null; finance_settled_at: string | null; closed_at: string | null; owner_user_id: string | null }

async function lock(tx: Queryable, id: string): Promise<Row> {
  const [row] = await tx.query<Row>('select status, handover_accepted_at, ready_at, finance_settled_at, closed_at, owner_user_id from projects where id = $1 for update', [id])
  if (!row) throw errors.notFound('Project')
  return row
}
const audit = (tx: Queryable, actor: Actor, id: string, requestId: string, action: string, extra: { before?: unknown; after?: unknown; reason?: string | null } = {}) =>
  recordAudit(tx, { action, actorUserId: actor.userId, entityType: 'project', entityId: id, requestId, ...extra })

export async function acceptHandover(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const p = await lock(tx, id)
  if (p.status !== 'draft' || p.handover_accepted_at) throw rule('Handover hanya bisa diterima sekali, saat project masih Draft.')
  await tx.query('update projects set handover_accepted_at = now(), handover_accepted_by = $2, updated_at = now() where id = $1', [id, actor.userId])
  await audit(tx, actor, id, requestId, 'project.handover_accepted')
}

export async function returnHandover(tx: Queryable, actor: Actor, id: string, reason: unknown, requestId: string) {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (!text) throw errors.validation({ reason: ['Alasan pengembalian wajib diisi.'] })
  const p = await lock(tx, id)
  if (p.status !== 'draft' || p.handover_accepted_at) throw rule('Handover hanya bisa dikembalikan sebelum diterima, saat project masih Draft.')
  await tx.query('update projects set handover_returned_at = now(), handover_return_reason = $2, updated_at = now() where id = $1', [id, text])
  await audit(tx, actor, id, requestId, 'project.handover_returned', { reason: text })
}

/** Moves the status along the transition map; returns the previous status. */
export async function transition(tx: Queryable, actor: Actor, id: string, to: unknown, reason: unknown, requestId: string): Promise<string> {
  if (typeof to !== 'string' || !(to in STATUS_TRANSITIONS)) throw errors.validation({ to: ['Status tujuan tidak dikenal.'] })
  const text = typeof reason === 'string' ? reason.trim() : ''
  if ((to === 'on-hold' || to === 'cancelled') && !text) throw errors.validation({ reason: ['Alasan wajib diisi untuk On Hold atau Batal.'] })
  const p = await lock(tx, id)
  if (!STATUS_TRANSITIONS[p.status]!.includes(to)) throw rule(`Status tidak bisa berubah dari "${p.status}" ke "${to}".`)
  if (p.status === 'draft' && to === 'planning' && !p.handover_accepted_at) throw rule('Terima handover dulu sebelum project masuk Planning.')
  await tx.query('update projects set status = $2, updated_at = now() where id = $1', [id, to])
  await audit(tx, actor, id, requestId, 'project.status_changed', { before: { status: p.status }, after: { status: to }, reason: text || null })
  return p.status
}

export async function markReady(db: Db, actor: Actor, id: string, requestId: string) {
  const facts = await projectFinanceSummary(db, id, false)
  if (!facts.dpInvoiced || !facts.dpReceived) throw rule('Project baru bisa Ready setelah invoice DP terbit dan pembayaran DP diterima Finance.')
  await db.transaction(async (tx) => {
    const p = await lock(tx, id)
    if (p.status !== 'confirmed' || p.ready_at) throw rule('Hanya project Confirmed yang belum Ready yang bisa ditandai Ready.')
    await tx.query('update projects set ready_at = now(), updated_at = now() where id = $1', [id])
    await audit(tx, actor, id, requestId, 'project.ready')
  })
}

export async function closeFinance(db: Db, actor: Actor, id: string, requestId: string) {
  const blockers = await projectFinanceBlockers(db, id)
  if (blockers.length) throw rule(`Finance project belum bisa ditutup: ${blockers.join(' ')}`)
  await db.transaction(async (tx) => {
    const p = await lock(tx, id)
    if (p.finance_settled_at) throw rule('Finance project ini sudah ditutup.')
    await tx.query('update projects set finance_settled_at = now(), finance_settled_by = $2, updated_at = now() where id = $1', [id, actor.userId])
    await audit(tx, actor, id, requestId, 'project.finance_closed')
  })
}

export async function closeProject(tx: Queryable, actor: Actor, id: string, input: { finalNote?: unknown; clientFeedback?: unknown }, requestId: string) {
  const note = typeof input.finalNote === 'string' ? input.finalNote.trim() : ''
  if (!note) throw errors.validation({ finalNote: ['Catatan akhir wajib diisi sebelum menutup project.'] })
  const feedback = typeof input.clientFeedback === 'string' ? input.clientFeedback.trim() || null : null
  const p = await lock(tx, id)
  if (p.closed_at) throw rule('Project ini sudah ditutup.')
  if (p.status !== 'completed') throw rule('Project baru bisa ditutup setelah berstatus Completed.')
  if (!p.finance_settled_at) throw rule('Tutup finance project dulu sebelum menutup project.')
  await tx.query('update projects set closed_at = now(), closed_by = $2, final_note = $3, client_feedback = $4, updated_at = now() where id = $1', [id, actor.userId, note, feedback])
  await audit(tx, actor, id, requestId, 'project.closed', { after: { finalNote: note, clientFeedback: feedback } })
}

export async function addMember(tx: Queryable, actor: Actor, id: string, userId: string, requestId: string) {
  await lock(tx, id)
  const [u] = await tx.query<{ role: string; status: string }>('select role, status from users where id = $1', [userId])
  if (!u || u.status !== 'active' || ROLE_DEFINITIONS[u.role as keyof typeof ROLE_DEFINITIONS]?.kind !== 'internal') throw errors.validation({ userId: ['User internal aktif tidak ditemukan.'] })
  const added = await tx.query('insert into project_members (project_id, user_id) values ($1, $2) on conflict do nothing returning user_id', [id, userId])
  if (added.length) await audit(tx, actor, id, requestId, 'project.member_added', { after: { userId } })
}

export async function removeMember(tx: Queryable, actor: Actor, id: string, userId: string, requestId: string) {
  const p = await lock(tx, id)
  if (p.owner_user_id === userId) throw rule('Owner project tidak bisa dikeluarkan dari tim.')
  const removed = await tx.query('delete from project_members where project_id = $1 and user_id = $2 returning user_id', [id, userId])
  if (removed.length) await audit(tx, actor, id, requestId, 'project.member_removed', { before: { userId } })
}
```

- [ ] **Step 7: Routes** — import fungsi di atas; tulis tiap route eksplisit (ikuti gaya file):

```ts
    .post('/projects/:id/handover/accept', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => acceptHandover(tx, actor, id, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    })
    .post('/projects/:id/handover/return', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => returnHandover(tx, actor, id, (body as Record<string, unknown>)?.reason, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/projects/:id/transition', async ({ request, params, body }) => {
      const b = (body ?? {}) as Record<string, unknown>
      const actor = await auth.requireCapability(request, b.to === 'cancelled' ? 'project-order.request-cancellation' : 'project-order.advance-step')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => transition(tx, actor, id, b.to, b.reason, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/projects/:id/ready', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.advance-step')
      const id = await visibleProject(actor, params.id)
      await markReady(db, actor, id, requestIdOf(request))
      return ok(request, await getProject(db, actor, id))
    })
    .post('/projects/:id/finance-close', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.close')
      const id = await visibleProject(actor, params.id)
      await closeFinance(db, actor, id, requestIdOf(request))
      return ok(request, await getProject(db, actor, id))
    })
    .post('/projects/:id/close', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'project-order.close')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => closeProject(tx, actor, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .put('/projects/:id/members/:userId', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => addMember(tx, actor, id, assertIdParam(params.userId, 'User'), requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    })
    .delete('/projects/:id/members/:userId', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => removeMember(tx, actor, id, assertIdParam(params.userId, 'User'), requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    })
```

dengan, di dalam `coreRoutes` sebelum `return new Elysia…`:

```ts
  async function visibleProject(actor: SessionActor, raw: string): Promise<string> {
    const id = assertIdParam(raw, 'Project')
    if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
    return id
  }
```

(import `type SessionActor` dari `../../auth/context`.) **Catatan rbac:** cek bahwa role `finance` punya `project-order.request-cancellation` (ya, ['admin','finance']) — test mengharapkan Finance boleh membatalkan tapi tidak memajukan.

- [ ] **Step 8: Seed** — `DemoCoreSeed.projects[]` tambah opsional `handoverAcceptedAt, handoverAcceptedBy, readyAt, closedAt, closedBy, financeSettledAt, finalNote, clientFeedback` (`string | null`). Extract: `handoverAcceptedAt: dateOnly(p.handoverAcceptedAt)`, `handoverAcceptedBy: p.handoverAcceptedBy ?? null`, `readyAt: dateOnly(p.readyAt)`, `closedAt: dateOnly(p.closedAt)`, `closedBy: p.closedBy ?? null`, `financeSettledAt: p.closureChecklist?.financeSettled ? (dateOnly(p.closedAt) ?? dateOnly(p.travelEndDate)) : null`, `finalNote: p.closureChecklist?.finalNote ?? null`, `clientFeedback: p.closureChecklist?.clientFeedback ?? null`. Upsert project menambah kolom-kolom ini; kolom `*_by` hanya diisi bila user ada di seed users (kalau tidak → null + warning di extract). `bun run seed:extract`.

- [ ] **Step 9:** `bun test --timeout 30000 test/project-workflow.test.ts test/project-writes.test.ts test/db.test.ts test/core-scope.test.ts && bun run typecheck` → PASS.

- [ ] **Step 10: Commit** `feat(core): alur Project Order dan tim di server (S3b)`.

---

### Task 2: Pembatalan project lewat Finance mengubah status

**Files:** Modify `backend/src/modules/finance/refunds.ts`; Test `backend/test/project-workflow.test.ts`.

- [ ] **Step 1: Test gagal:**

```ts
describe('cancellation through Finance', () => {
  test('a project-level case cancels the project; from completed the status stays', async () => {
    const id = await newProject()
    const res = await t.call('POST', '/api/v1/finance/cancellations', {
      cookie: c.finance, headers: { 'idempotency-key': `wf-cxl-${id}-abcdef` },
      body: { subjectType: 'project', subjectId: id, cancelDate: '2026-02-01', reason: 'Klien membatalkan', calculation: 'manual' }
    })
    expect(res.status).toBe(201)
    expect((await t.call('GET', `/api/v1/projects/${id}`, { cookie: c.admin })).json.data.status).toBe('cancelled')
    const [audit] = await t.db.query<{ reason: string }>("select reason from audit_events where action = 'project.status_changed' and entity_id = $1 order by id desc limit 1", [id])
    expect(audit!.reason).toBe('Klien membatalkan')

    const done = await newProject()
    await t.db.query("update projects set status = 'completed' where id = $1", [done])
    const late = await t.call('POST', '/api/v1/finance/cancellations', {
      cookie: c.finance, headers: { 'idempotency-key': `wf-cxl-${done}-abcdef` },
      body: { subjectType: 'project', subjectId: done, cancelDate: '2026-02-01', reason: 'Batal setelah selesai', calculation: 'manual' }
    })
    expect(late.status).toBe(201)
    expect((await t.call('GET', `/api/v1/projects/${done}`, { cookie: c.admin })).json.data.status).toBe('completed')
  })
})
```

> Cek body `POST /finance/cancellations` di `test/finance-refunds.test.ts` (nama field, wajib policy?) dan sesuaikan; inti assertion tetap.

- [ ] **Step 2:** FAIL (status tetap draft). **Step 3:** di `createCancellation`, setelah `recordAudit(... 'finance.cancellation_recorded' ...)`:

```ts
  // S3b: a whole-project cancellation also cancels the project, when its status still allows it.
  if (subject.type === 'project') {
    const [p] = await tx.query<{ status: string }>('select status from projects where id = $1 for update', [subject.projectId])
    if (p && STATUS_TRANSITIONS[p.status]?.includes('cancelled')) {
      await tx.query("update projects set status = 'cancelled', updated_at = now() where id = $1", [subject.projectId])
      await recordAudit(tx, { action: 'project.status_changed', actorUserId: actor.userId, entityType: 'project', entityId: subject.projectId, requestId, reason, before: { status: p.status }, after: { status: 'cancelled' } })
    }
  }
```

(import `STATUS_TRANSITIONS` dari `../core/project-workflow`; bila impor melingkar, pindahkan `STATUS_TRANSITIONS` ke `src/modules/core/statuses.ts` dan impor dari sana di kedua tempat.)
- [ ] **Step 4:** `bun test --timeout 30000 test/project-workflow.test.ts test/finance-refunds.test.ts` → PASS. **Step 5: Commit** `feat(finance): pembatalan project ikut mengubah status project`.

---

### Task 3: Frontend — tipe, endpoint, dan sinkron status/alur/tim dari server

**Files:** Modify `app/types/api.ts`, `app/lib/api/endpoints.ts`, `app/data/projects-sync.ts`, `app/data/projects-sync.test.ts`, `app/data/projects-sync.test-utils.ts`.

**Interfaces:**
- Produces: `ProjectInternalDto` + 11 field alur; endpoint `api.core.acceptHandover(id)`, `returnHandover(id, reason)`, `transitionProject(id, to, reason?)`, `markProjectReady(id)`, `closeProjectFinance(id)`, `closeProject(id, { finalNote, clientFeedback? })`, `addProjectMember(id, userId)`, `removeProjectMember(id, userId)` — semua `Promise<ApiSuccess<ProjectDetailDto>>`. `serverFields` memetakan field alur; `status`/`teamUserIds` dari server untuk objek yang ada juga.

- [ ] **Step 1: Test** — ubah test `projects-sync.test.ts` "upsert project yang sudah ada tidak menimpa status dan tim lokal" menjadi:

```ts
  it('status, alur, dan tim diambil dari server (S3b); flag closure lokal lain tetap', () => {
    const local = PROJECTS.find(p => p.id === 'PRJ-101')!
    local.status = 'confirmed'
    local.closureChecklist = { financeSettled: false, servicesCompleted: false, documentsComplete: true, unresolvedIssuesHandled: false, feedbackCollected: true }
    upsertServerProject(serverProjectDto({ id: 'PRJ-101', status: 'completed', teamUserIds: ['USR-010'], readyAt: '2026-07-01', financeSettledAt: '2026-08-01', closedAt: '2026-08-02', closedBy: 'USR-002', finalNote: 'Selesai', handoverAcceptedAt: '2026-06-01', handoverAcceptedBy: 'USR-002' }))
    expect(local).toMatchObject({ status: 'completed', teamUserIds: ['USR-010'], readyAt: '2026-07-01', closedAt: '2026-08-02', closedBy: 'USR-002', handoverAcceptedAt: '2026-06-01' })
    expect(local.closureChecklist).toMatchObject({ financeSettled: true, finalNote: 'Selesai', documentsComplete: true, feedbackCollected: true })
  })
```

dan `serverProjectDto` default menambah 11 field bernilai null. Cek tipe `ProjectClosureChecklist` (field wajib) dan sesuaikan objek uji.
- [ ] **Step 2:** FAIL. **Step 3:** tipe + endpoint (`client.post<ProjectDetailDto>(\`/projects/${seg(id)}/transition\`, { to, reason })`, dst.; members `client.put`/`client.delete` — cek `client.delete` ada di `lib/api/client.ts`, bila tidak pakai `client.request('DELETE', …)`). `serverFields`: `status: dto.status`, `teamUserIds: [...dto.teamUserIds]`, `handoverAcceptedAt/By`, `handoverReturnedAt`, `handoverReturnReason`, `readyAt`, `closedAt/By` (null → undefined), dan `closureChecklist: dto.financeSettledAt || dto.finalNote || local?.closureChecklist ? { ...(local?.closureChecklist ?? DEFAULT_CLOSURE), financeSettled: !!dto.financeSettledAt, finalNote: dto.finalNote ?? undefined, clientFeedback: dto.clientFeedback ?? undefined } : undefined` (`DEFAULT_CLOSURE` = semua flag false, sesuai tipe). Hapus komentar "status workflow and team still live in the frontend".
- [ ] **Step 4:** tests + real vue-tsc saringan + eslint. **Step 5: Commit** `feat(frontend): status dan tim project dari server`.

---

### Task 4: Frontend — maju step, handover, tutup finance, tim lewat server

**Files:** Modify `app/data/projects-sync.ts`, `app/data/project-order-workflow.ts`, `app/data/index.ts`, `app/pages/project-orders/[id]/index.vue`, `app/data/project-order-workflow.test.ts`.

**Interfaces:**
- Produces: `advanceProjectOrderOnServer(api, projectId, options?): Promise<AdvanceProjectOrderResult>` (menggantikan `advanceProjectOrder`), `acceptHandoverOnServer(api, id)`, `closeFinanceOnServer(api, id)`, `addTeamMemberOnServer(api, id, userId)`, `removeTeamMemberOnServer(api, id, userId)`, `reloadProjectFromServer(api, id)`.

- [ ] **Step 1: Test gagal** — di `project-order-workflow.test.ts` ganti test `advanceProjectOrder` dengan:

```ts
describe('advanceProjectOrderOnServer', () => {
  it('gate lokal belum lolos: server tidak dipanggil, status tetap', async () => {
    let calls = 0
    const api = { core: { transitionProject: () => { calls++; return Promise.reject(new Error('x')) } } }
    const before = project('PRJ-102').status
    const result = await advanceProjectOrderOnServer(api as never, 'PRJ-102')
    expect(result.success).toBe(false)
    expect(calls).toBe(0)
    expect(project('PRJ-102').status).toBe(before)
  })

  it('step Drafting dari draft memanggil transition planning lalu confirmed, menerapkan jawaban server', async () => {
    const created = createProject({ partyId: 'PTY-001', name: 'Uji Alur', destination: 'Bali', travelStartDate: '2027-03-20', travelEndDate: '2027-03-23', travelerCount: 1, serviceScope: ['flight'], quotationAmountIdr: 1 })
    created.handoverAcceptedAt = '2026-07-01'
    const sent: string[] = []
    const api = { core: { transitionProject: (id: string, to: string) => { sent.push(to); return Promise.resolve({ data: serverProjectDto({ id, status: to as never, handoverAcceptedAt: '2026-07-01' }) }) } } }
    const result = await advanceProjectOrderOnServer(api as never, created.id, {}, () => ({ ready: true, blockers: [] }) as never)
    expect(sent).toEqual(['planning', 'confirmed'])
    expect(result.success).toBe(true)
    expect(project(created.id).status).toBe('confirmed')
  })

  it('step Done tanpa catatan akhir ditolak tanpa memanggil server', async () => {
    const created = createProject({ partyId: 'PTY-001', name: 'Uji Tutup', destination: 'Bali', travelStartDate: '2026-05-01', travelEndDate: '2026-05-03', travelerCount: 1, serviceScope: ['flight'], quotationAmountIdr: 1 })
    created.status = 'completed'
    let calls = 0
    const api = { core: { closeProject: () => { calls++; return Promise.reject(new Error('x')) } } }
    const result = await advanceProjectOrderOnServer(api as never, created.id, {}, () => ({ ready: true, blockers: [] }) as never)
    expect(result.success).toBe(false)
    expect(result.blockers[0]).toContain('Catatan akhir')
    expect(calls).toBe(0)
  })
})
```

- [ ] **Step 2:** FAIL. **Step 3: Implementasi** di `projects-sync.ts`:

```ts
export async function advanceProjectOrderOnServer (api: Pick<ManovaApi, 'core'>, projectId: string, options: AdvanceProjectOrderOptions = {}, gateOf = evaluateProjectOrderStepGate): Promise<AdvanceProjectOrderResult> {
  const project = PROJECTS.find(p => p.id === projectId)
  if (!project) { return { success: false, blockers: ['Project Order tidak ditemukan.'] } }
  const stepKey = getProjectOrderStep(project)
  const step = getProjectOrderStepDef(stepKey)
  if (!step) { return { success: false, blockers: ['Step tidak dikenal.'] } }
  const gate = gateOf(projectId, stepKey)
  if (!gate.ready) { return { success: false, blockers: gate.blockers, stepKey } }
  if (step.sideEffect === 'closeProject') {
    const finalNote = options.finalNote?.trim()
    if (!finalNote) { return { success: false, blockers: ['Catatan akhir wajib diisi sebelum menutup Project Order.'], stepKey } }
    upsertServerProject((await api.core.closeProject(projectId, { finalNote, clientFeedback: options.clientFeedback?.trim() || undefined })).data)
    return { success: true, blockers: [], stepKey }
  }
  if (step.sideEffect === 'markReady') {
    upsertServerProject((await api.core.markProjectReady(projectId)).data)
    return { success: true, blockers: [], stepKey }
  }
  if (!step.targetStatus) { return { success: false, blockers: ['Step ini tidak punya aksi lanjut.'], stepKey } }
  const chain: ProjectStatus[] = project.status === 'draft' && step.targetStatus === 'confirmed' ? ['planning', step.targetStatus] : [step.targetStatus]
  for (const status of chain) {
    if (project.status === status) { continue }
    upsertServerProject((await api.core.transitionProject(projectId, status)).data)
  }
  return { success: true, blockers: [], stepKey }
}
```

(Ekspor `getProjectOrderStepDef` dari workflow bila belum; impor tipe yang diperlukan.) Error server dilempar (ditangkap halaman). Tambahkan `acceptHandoverOnServer`, `closeFinanceOnServer`, `addTeamMemberOnServer`, `removeTeamMemberOnServer`, `reloadProjectFromServer` (`upsertServerProject((await api.core.getProject(id)).data)`).
- [ ] **Step 4: Halaman** — `onAdvanceStep` async: bila step saat ini `done` buka dialog tutup project (Task 5) alih-alih memanggil langsung; selain itu `await advanceProjectOrderOnServer(...)` dalam try/catch (catch → toast `error.message`, lalu `reloadProjectFromServer`). `onAcceptHandover` → `acceptHandoverOnServer`. `submitCloseFinance` → `closeFinanceOnServer` (pesan server berisi daftar hambatan). `submitAddTeamMember`/`submitRemoveTeamMember` → server. `onFinanceCancelled` → `await reloadProjectFromServer` lalu toast sesuai status hasil (`cancelled` → "Project dibatalkan"; lainnya → peringatan "Pembatalan tercatat di Finance, status project tidak berubah dari status saat ini."). Semua dengan guard pending.
- [ ] **Step 5:** hapus mutator lokal yang tidak lagi dipanggil (`advanceProjectOrder`, `updateProjectStatus`, `acceptProjectHandover`, `markProjectReady`, `closeProject`, `closeProjectFinance`, `updateProjectClosureChecklist`, `addProjectTeamMember`, `removeProjectTeamMember`, `returnProjectHandover`, `getProjectOrderLateralTransitions`) **hanya** bila grep + vue-tsc (file disentuh) menunjukkan tanpa pemanggil di luar test; test yang menguji mutator lokal dihapus/diganti versi server.
- [ ] **Step 6:** `pnpm test`, vue-tsc tersaring, eslint delta 0. **Step 7: Commit** `feat(frontend): alur Project Order dan tim lewat server`.

---

### Task 5: Dialog tutup project (perbaikan step Done)

**Files:** Modify `app/pages/project-orders/[id]/index.vue`.

- [ ] Dialog (Sheet/Dialog yang sudah dipakai di halaman) "Tutup Project Order": textarea/input Catatan akhir (wajib) + Feedback klien (opsional); tombol Simpan memanggil `advanceProjectOrderOnServer(financeApi, id, { finalNote, clientFeedback })`; pending guard; error → toast. Tombol "Lanjut" di step Done membuka dialog ini.
- [ ] Verifikasi: `pnpm test` + vue-tsc tersaring + eslint. **Commit** `fix(project-order): step Done bisa ditutup dengan catatan akhir`.

---

### Task 6: Dokumentasi, verifikasi penuh, uji API

- [ ] ADR-004 update S3b; spec status → diimplementasikan.
- [ ] `bun run typecheck && bun run test`; `pnpm test && pnpm build`; vue-tsc tersaring file disentuh (tanpa error baru).
- [ ] Migrasi DB lokal + `db:seed:demo` (backend mati). Smoke API di :3100 dengan salinan DB: handover → planning → confirmed → ready ditolak tanpa DP → pembatalan Finance mengubah status → anggota tim tambah/hapus. Hentikan & hapus salinan.
- [ ] Commit `docs: status backend alur Project Order (S3b)`.
