# CR & respons quotation client (S12b-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client mengajukan, menyetujui/menolak dampak dan membatalkan change request lewat server (alur status sederhana, persetujuan client hanya bila ada biaya), dan merespons quotation (setuju/tolak/minta revisi) yang tercatat di server.

**Architecture:** Migrasi 0039 memperluas `change_requests` dan `quotations`. `core/change-requests.ts` mendapat `sendChangeRequestToClient`, aturan approve, dan fungsi client (`clientCreateChangeRequest`, `clientDecideChangeRequest`, `clientCancelChangeRequest`); route client di `client-write-routes.ts`. Respons quotation di `sales/quotation-writes.ts` (`respondToQuotation`) dengan route client. Frontend: mapper/sync + layar portal & internal.

**Tech Stack:** Bun + Elysia + PGlite (backend), Nuxt 4 + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-10-19-client-change-requests-quotation-response-design.md`

## Global Constraints

- pnpm di `frontend/`, bun di `backend/`. Migrasi baru `0039_client_change_requests_quotation_response.{up,down}.sql`.
- Status CR server: `submitted`, `under-review`, `waiting-client-approval`, `approved`, `rejected`, `implemented`, `cancelled`.
- CR client dengan `commercial_impact_minor` > 0 atau `cancellation_fee_minor` > 0 tidak boleh di-approve staf langsung (422 "Change request ini punya biaya — kirim dampaknya ke client untuk disetujui.").
- Respons quotation: `accepted` | `rejected` | `revision-requested`; `rejected`/`revision-requested` wajib catatan; satu respons per versi.
- Notifikasi ke user internal lewat `notifyInternal` (client-writes); ke requester client lewat `notify` langsung (requester bisa portal user). Tidak pernah ke pelaku.
- Commit tiap task, stage path eksplisit. Trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verifikasi: `bun test <file> --timeout 30000`, `bun run typecheck`, `pnpm test`, vue-tsc ≤ 1987, eslint vs HEAD, `pnpm build`.

## Review Focus

1. Client menyetujui dampak CR milik party lain → 404; CR di status selain `waiting-client-approval` → 422 (Task 2).
2. Staf approve langsung CR client berbiaya → 422; CR internal berbiaya tetap boleh (Task 1).
3. Respons quotation versi lama setelah revisi → respons lama tidak tampil, client bisa merespons lagi (Task 3).
4. Project → completed saat ada CR `waiting-client-approval` → 422 (Task 1).
5. Sync ulang server tidak menghapus field baru (changeType, cancellationFee, cancelReason) dari CR lokal (Task 4 mapper).

---

### Task 1: Migrasi 0039 + alur staf CR (kirim ke client, aturan approve, gerbang)

**Files:**
- Create: `backend/migrations/0039_client_change_requests_quotation_response.up.sql`, `.down.sql`
- Modify: `backend/src/modules/core/change-requests.ts`, `change-routes.ts`, `project-workflow.ts`
- Test: `backend/test/client-change-requests.test.ts`

**Interfaces — Produces:** `listChangeRequests` + field `changeType`, `cancellationFeeMinor`, `clientDecidedBy`, `clientDecidedAt`, `cancelReason`, `cancelledAt`; `sendChangeRequestToClient(tx, actor, id, input, requestId)`; `CHANGE_TYPES`, `CHANGE_TYPE_CATEGORY`; `PENDING_CHANGE_STATUSES`.

- [ ] **Step 1: Tes gagal** — `backend/test/client-change-requests.test.ts` (setup seperti `client-portal-writes.test.ts`: `makeTestApp`, login DEMO, helper `call`, `k()`, `notes()`):
  - Staf (admin) membuat CR `source: 'client'` di PRJ-201 lewat `POST /projects/PRJ-201/change-requests`, lalu `POST /change-requests/:id/send-to-client` tanpa biaya → 400; dengan `{ commercialImpactMinor: '2500000', cancellationFeeMinor: '0', timelineImpactNote: 'Jadwal mundur 1 hari' }` → 200, status `waiting-client-approval`, `commercialImpactMinor: '2500000'`.
  - CR client berbiaya lain (send-to-client dulu tidak) dengan `commercialImpactMinor` di create = '1000000', lalu `approve` → 422 berisi "kirim dampaknya ke client"; CR `source: 'internal'` berbiaya → approve 200.
  - Gerbang: project PRJ-201 punya CR `waiting-client-approval` → `POST /projects/PRJ-201/transition { to: 'completed' }` (atau rute transisi yang ada; cek `project-workflow` test untuk bentuk body) → 422 menyebut id CR. (Bila PRJ-201 tidak bisa ke completed dari statusnya, uji fungsi gerbang lewat project yang statusnya diset `ongoing-trip` di DB.)
  - Migrasi turun-naik: jalankan pola tes migrasi yang ada (`grep -l "migrateDown\|down.sql" backend/test`) — bila tersedia, pastikan 0039 down mengembalikan CHECK lama; bila tidak ada pola, lewati dan catat Ruling.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Migrasi**

`0039_…up.sql`:
```sql
-- S12b-2: the client portal's change-request steps and quotation responses are API-owned.
alter table change_requests drop constraint if exists change_requests_status_check;
alter table change_requests add constraint change_requests_status_check
  check (status in ('submitted', 'under-review', 'waiting-client-approval', 'approved', 'rejected', 'implemented', 'cancelled'));
alter table change_requests
  add column change_type text check (change_type in ('add-participant', 'remove-participant', 'replace-participant', 'change-date', 'change-flight',
    'change-hotel', 'add-transportation', 'add-activity', 'upgrade-service', 'remove-service', 'change-itinerary', 'cancel-service', 'cancel-project')),
  add column cancellation_fee_minor bigint check (cancellation_fee_minor >= 0),
  add column client_decided_by text references users (id),
  add column client_decided_at timestamptz,
  add column cancel_reason text,
  add column cancelled_by text references users (id),
  add column cancelled_at timestamptz,
  add constraint change_requests_cancel_reason check (status <> 'cancelled' or cancel_reason is not null);

alter table quotations
  add column client_response text check (client_response in ('accepted', 'rejected', 'revision-requested')),
  add column client_response_note text,
  add column client_response_version integer,
  add column client_responded_by text references users (id),
  add column client_responded_at timestamptz,
  add constraint quotations_client_response_complete check ((client_response is null) = (client_response_version is null));
```

`0039_…down.sql`:
```sql
alter table quotations drop constraint if exists quotations_client_response_complete;
alter table quotations drop column if exists client_responded_at, drop column if exists client_responded_by,
  drop column if exists client_response_version, drop column if exists client_response_note, drop column if exists client_response;
alter table change_requests drop constraint if exists change_requests_cancel_reason;
update change_requests set status = 'under-review' where status = 'waiting-client-approval';
update change_requests set status = 'rejected', rejection_reason = coalesce(rejection_reason, cancel_reason, 'Dibatalkan') where status = 'cancelled';
alter table change_requests drop column if exists cancelled_at, drop column if exists cancelled_by, drop column if exists cancel_reason,
  drop column if exists client_decided_at, drop column if exists client_decided_by, drop column if exists cancellation_fee_minor, drop column if exists change_type;
alter table change_requests drop constraint if exists change_requests_status_check;
alter table change_requests add constraint change_requests_status_check
  check (status in ('submitted', 'under-review', 'approved', 'rejected', 'implemented'));
```

Cek bahwa nama constraint bawaan memang `change_requests_status_check` (`select conname from pg_constraint where conrelid = 'change_requests'::regclass`); sesuaikan bila beda.

- [ ] **Step 4: `change-requests.ts`**
  - `listChangeRequests` tambah: `changeType: str(r.change_type)`, `cancellationFeeMinor: str(r.cancellation_fee_minor)`, `clientDecidedBy: str(r.client_decided_by)`, `clientDecidedAt: iso(r.client_decided_at)`, `cancelReason: str(r.cancel_reason)`, `cancelledAt: iso(r.cancelled_at)`.
  - Konstanta:
```ts
export const CHANGE_TYPES = ['add-participant', 'remove-participant', 'replace-participant', 'change-date', 'change-flight', 'change-hotel',
  'add-transportation', 'add-activity', 'upgrade-service', 'remove-service', 'change-itinerary', 'cancel-service', 'cancel-project']
/** The change entry's category for a portal change type. */
export const CHANGE_TYPE_CATEGORY: Record<string, string> = {
  'add-participant': 'traveler', 'remove-participant': 'traveler', 'replace-participant': 'traveler', 'change-date': 'itinerary',
  'change-flight': 'service', 'change-hotel': 'service', 'add-transportation': 'service', 'add-activity': 'itinerary', 'upgrade-service': 'service',
  'remove-service': 'service', 'change-itinerary': 'itinerary', 'cancel-service': 'service', 'cancel-project': 'other'
}
/** Undecided requests: they block project completion. */
export const PENDING_CHANGE_STATUSES = ['submitted', 'under-review', 'waiting-client-approval']
```
  - `createChangeRequest`: terima `changeType` opsional (validasi `CHANGE_TYPES`), simpan ke `change_type`; bila `category` tak diberikan dan `changeType` ada, kategori = `CHANGE_TYPE_CATEGORY[changeType]`.
  - `lockRequest` ikut mengambil `source`, `requested_by`, `commercial_impact_minor`, `cancellation_fee_minor`.
  - Helper biaya: `const hasCost = (cr) => BigInt(cr.commercial_impact_minor ?? 0) > 0n || BigInt(cr.cancellation_fee_minor ?? 0) > 0n`.
  - `decideChangeRequest` (staf): bila `decision === 'approved'` dan `cr.source === 'client'` dan `hasCost(cr)` → `rule('Change request ini punya biaya — kirim dampaknya ke client untuk disetujui.')`. Setelah keputusan, bila `cr.source === 'client'` → `notify(tx, { userId: cr.requested_by, actorUserId: actor.userId, type: 'change', title: \`Change Request ${id} ${decision === 'approved' ? 'disetujui' : 'ditolak'}\`, body: reason || 'Perubahan akan kami laksanakan.', entityType: 'project', entityId: cr.project_id })`.
  - Fungsi baru:
```ts
const minor = (v: unknown, field: string, label: string, problems: FieldErrors): string | null => {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string' || !MINOR.test(v) || BigInt(v) > PG_BIGINT_MAX) { problems[field] = [`${label} harus angka bulat ≥ 0, dikirim sebagai teks.`]; return null }
  return v
}

/** Staff fill in the impact of a client's request and ask the client to approve it (only when it costs something). */
export async function sendChangeRequestToClient(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const commercial = minor(input.commercialImpactMinor, 'commercialImpactMinor', 'Dampak komersial', problems)
  const fee = minor(input.cancellationFeeMinor, 'cancellationFeeMinor', 'Biaya pembatalan', problems)
  const timeline = text(input.timelineImpactNote, 'timelineImpactNote', problems, false, 'Catatan dampak waktu')
  const operational = text(input.operationalImpact, 'operationalImpact', problems, false, 'Dampak operasional')
  const financial = text(input.financialImpactNote, 'financialImpactNote', problems, false, 'Catatan dampak finansial')
  if (!Object.keys(problems).length && BigInt(commercial ?? 0) === 0n && BigInt(fee ?? 0) === 0n)
    problems.commercialImpactMinor = ['Isi dampak komersial atau biaya pembatalan. Tanpa biaya, setujui langsung.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const cr = await lockRequest(tx, id)
  if (cr.source !== 'client') throw rule('Hanya change request dari client yang dikirim ke client untuk disetujui.')
  if (cr.status !== 'submitted' && cr.status !== 'under-review') throw rule('Change request ini sudah diputuskan atau sedang menunggu client.')
  await tx.query(
    `update change_requests set status = 'waiting-client-approval', commercial_impact_minor = $2, cancellation_fee_minor = $3,
            timeline_impact_note = coalesce($4, timeline_impact_note), operational_impact = coalesce($5, operational_impact),
            financial_impact_note = coalesce($6, financial_impact_note), changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, commercial, fee, timeline, operational, financial])
  await logStep(tx, actor, cr.project_id, id, 'dikirim ke client untuk disetujui', 'change_request.sent_to_client')
  await notify(tx, { userId: cr.requested_by, actorUserId: actor.userId, type: 'change', title: `Change Request ${id} menunggu persetujuan Anda`,
    body: `Dampak biaya telah dihitung${timeline ? ` — ${timeline}` : ''}. Mohon setujui atau tolak.`, entityType: 'project', entityId: cr.project_id })
  await recordAudit(tx, { action: 'change_request.sent_to_client', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId,
    after: { commercialImpactMinor: commercial, cancellationFeeMinor: fee } })
}
```
  (import `notify` dari `./notifications`.)
- [ ] **Step 5: Route + gerbang** — `change-routes.ts`: `.post('/change-requests/:id/send-to-client', …)` dengan `REVIEW`, body record, memanggil `sendChangeRequestToClient`, respons `requestResponse(id)`. `project-workflow.ts`: ganti `status in ('submitted', 'under-review')` dengan `status = any($2::text[])` dan `PENDING_CHANGE_STATUSES`.
- [ ] **Step 6: PASS** + `bun test test/client-change-requests.test.ts test/changes-incidents*.test.ts test/project-workflow*.test.ts --timeout 30000` (cek nama file), typecheck. **Commit:** `feat(core): CR — kirim dampak ke client, approve berbiaya lewat client, gerbang completed; migrasi 0039 (S12b-2)`

---

### Task 2: Client mengajukan, menyetujui/menolak dampak, membatalkan CR

**Files:** `backend/src/modules/core/change-requests.ts`, `client-write-routes.ts`; test `backend/test/client-change-requests.test.ts`.

**Interfaces — Produces:** `clientCreateChangeRequest(tx, actor, partyId, projectId, input, requestId)`, `clientDecideChangeRequest(tx, actor, partyId, id, decision, reason, requestId)`, `clientCancelChangeRequest(tx, actor, partyId, id, reason, requestId)`; routes `POST /client/projects/:id/change-requests`, `POST /client/change-requests/:id/{approve,reject,cancel}`.

- [ ] **Step 1: Tes gagal** (tambahkan):
  - Client membuat CR di PRJ-201 `{ changeType: 'change-hotel', beforeSummary: 'Hotel A', afterSummary: 'Hotel B' }` → 201, `source: 'client'`, `changeType: 'change-hotel'`, owner PRJ-201 +1 notifikasi; replay key sama → id sama. Project `completed` (PRJ-203) → 422; project party lain → 404; field `source: 'internal'` di body diabaikan (tetap client).
  - Staf send-to-client → client `approve` → 200, status `approved`, `clientDecidedBy: 'USR-021'`; entri CHG `approval_status = 'approved'`; owner +1 notifikasi.
  - CR lain: client `reject` tanpa alasan 400; dengan alasan → `rejected`, `rejectionReason` = alasan.
  - CR `submitted`: client `cancel` dengan alasan → `cancelled`, `cancelReason`; cancel lagi 422; approve CR `submitted` (belum dikirim) 422.
  - CR party lain → approve/reject/cancel 404; admin/vendor → 403.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi** di `change-requests.ts`:
```ts
async function clientRequest(tx: Queryable, partyId: string, id: string) {
  const [row] = await tx.query<{ project_id: string; status: string; activity_id: string | null; owner_user_id: string | null }>(
    `select cr.project_id, cr.status, cr.activity_id, p.owner_user_id from change_requests cr join projects p on p.id = cr.project_id
      where cr.id = $1 and p.party_id = $2 for update of cr`, [id, partyId])
  if (!row) throw errors.notFound('Change request')
  return row
}

export async function clientCreateChangeRequest(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  const [p] = await tx.query<{ status: string; owner_user_id: string | null; name: string }>('select status, owner_user_id, name from projects where id = $1 and party_id = $2', [projectId, partyId])
  if (!p) throw errors.notFound('Project')
  if (p.status === 'completed' || p.status === 'cancelled') throw rule('Project sudah selesai atau dibatalkan — tidak bisa mengajukan perubahan.')
  const { id } = await createChangeRequest(tx, actor, projectId, {
    source: 'client', changeType: input.changeType, beforeSummary: input.beforeSummary, afterSummary: input.afterSummary
  }, requestId)
  await notifyInternal(tx, actor, p.owner_user_id, { type: 'change', title: `Change Request baru dari client (${p.name})`, body: `${id}: ${String(input.afterSummary).trim()}`, entityType: 'project', entityId: projectId })
  return { id }
}

export async function clientDecideChangeRequest(tx: Queryable, actor: Actor, partyId: string, id: string, decision: 'approved' | 'rejected', reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (decision === 'rejected' && !reason) throw errors.validation({ reason: ['Alasan penolakan wajib diisi.'] })
  const cr = await clientRequest(tx, partyId, id)
  if (cr.status !== 'waiting-client-approval') throw rule('Change request ini tidak sedang menunggu persetujuan Anda.')
  await tx.query(
    `update change_requests set status = $2, client_decided_by = $3, client_decided_at = now(), rejection_reason = $4, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, decision, actor.userId, decision === 'rejected' ? reason.slice(0, 1000) : null])
  await decidePendingChange(tx, actor.userId, cr.activity_id, decision)
  await logStep(tx, actor, cr.project_id, id, decision === 'approved' ? 'disetujui client' : `ditolak client (${reason})`, `change_request.client_${decision}`)
  await notifyInternal(tx, actor, cr.owner_user_id, { type: 'change', title: `Change Request ${id} ${decision === 'approved' ? 'disetujui' : 'ditolak'} client`, body: reason || 'Client menyetujui dampak perubahan.', entityType: 'project', entityId: cr.project_id })
  await recordAudit(tx, { action: `change_request.client_${decision}`, actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId, reason: reason || null })
}

const CLIENT_CANCELLABLE = ['submitted', 'under-review', 'waiting-client-approval']

export async function clientCancelChangeRequest(tx: Queryable, actor: Actor, partyId: string, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const cr = await clientRequest(tx, partyId, id)
  if (!CLIENT_CANCELLABLE.includes(cr.status)) throw rule('Change request ini sudah diputuskan — tidak bisa dibatalkan.')
  await tx.query(
    `update change_requests set status = 'cancelled', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, reason.slice(0, 1000), actor.userId])
  await decidePendingChange(tx, actor.userId, cr.activity_id, 'rejected')
  await logStep(tx, actor, cr.project_id, id, `dibatalkan client (${reason})`, 'change_request.cancelled')
  await notifyInternal(tx, actor, cr.owner_user_id, { type: 'change', title: `Change Request ${id} dibatalkan client`, body: reason, entityType: 'project', entityId: cr.project_id })
  await recordAudit(tx, { action: 'change_request.cancelled', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId, reason })
}
```
  (import `notifyInternal` dari `./client-writes` — hindari import melingkar: bila client-writes mengimpor change-requests, pindahkan `notifyInternal` ke `./notifications` dan re-export dari client-writes; catat Ruling.)
  Route di `client-write-routes.ts`: create pakai `withIdempotency` (route `POST /client/projects/:id/change-requests`), approve/reject/cancel pakai `db.transaction`; respons `clientChangeRequest((await listChangeRequests(db, { id }))[0]!)`.
- [ ] **Step 4: PASS** + typecheck. **Commit:** `feat(core): client mengajukan, menyetujui/menolak dampak dan membatalkan change request (S12b-2)`

---

### Task 3: Respons quotation dari client

**Files:** `backend/src/modules/sales/quotation-writes.ts`, `sales/repository.ts`, `core/client-commerce.ts`, `core/client-commerce-routes.ts` (atau `client-write-routes.ts`); test `backend/test/client-quotation-response.test.ts`.

**Interfaces — Produces:** `respondToQuotation(tx, actor, partyId, id, input, requestId)`; DTO `clientResponse: { response, note, version, respondedAt } | null` di quotation internal dan `/client/quotations`; route `POST /client/quotations/:id/respond`.

- [ ] **Step 1: Tes gagal** — setup seperti `client-commerce.test.ts` (quotation lead PTY-005 dibuat terkirim: set `sent_to_client_on` + versi `approved`):
  - `respond { response: 'accepted' }` → 200; `GET /client/quotations` memuat `clientResponse.response = 'accepted'`, `version = current_version`; internal `GET /quotations?…` (rute list internal yang ada) juga memuat `clientResponse`; owner/handled-by lead +1 notifikasi; ada `party_activities` baru.
  - Respons kedua untuk versi sama → 422.
  - `rejected`/`revision-requested` tanpa note → 400.
  - Setelah staf `POST /quotations/:id/revise` (versi naik, `sent_to_client_on` null) lalu submit/approve/send lewat rute internal (atau set DB), `clientResponse` null dan client bisa merespons lagi.
  - Quotation belum dikirim → 404 (tidak terlihat client); lead sudah jadi project (insert project dengan `lead_id`) → 422; party lain → 404; admin → 403.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi** — `respondToQuotation` di `quotation-writes.ts`:
```ts
const CLIENT_RESPONSES = ['accepted', 'rejected', 'revision-requested']

/** S12b-2: the client answers the quotation it was sent — once per version; staff are told and act (Won / revise). */
export async function respondToQuotation(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, today: string, requestId: string) {
  const response = input.response
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 2000) : ''
  if (typeof response !== 'string' || !CLIENT_RESPONSES.includes(response)) throw errors.validation({ response: ['Pilih setuju, tolak, atau minta revisi.'] })
  if (response !== 'accepted' && !note) throw errors.validation({ note: ['Catatan wajib diisi.'] })
  const [q] = await tx.query<{ current_version: number; sent_to_client_on: string | null; client_response_version: number | null; lead_id: string; owner_user_id: string; handed_over_to: string | null; project_id: string | null }>(
    `select q.current_version, q.sent_to_client_on, q.client_response_version, q.lead_id, l.owner_user_id, l.handed_over_to,
            (select p.id from projects p where p.lead_id = l.id) as project_id
       from quotations q join leads l on l.id = q.lead_id where q.id = $1 and l.party_id = $2 for update of q`, [id, partyId])
  if (!q || !q.sent_to_client_on) throw errors.notFound('Quotation')
  if (q.project_id) throw rule('Quotation ini sudah menjadi project.')
  if (q.client_response_version === q.current_version) throw rule('Anda sudah merespons versi quotation ini.')
  await tx.query(
    `update quotations set client_response = $2, client_response_note = $3, client_response_version = current_version, client_responded_by = $4,
            client_responded_at = now(), updated_at = now() where id = $1`, [id, response, note || null, actor.userId])
  const label = response === 'accepted' ? 'menyetujui' : response === 'rejected' ? 'menolak' : 'meminta revisi'
  await createActivity(tx, actor, partyId, { type: 'note', leadId: q.lead_id, message: `Client ${label} quotation ${id} v${q.current_version}.${note ? ` Catatan: ${note}` : ''}` }, today, requestId)
  await notifyInternal(tx, actor, q.handed_over_to ?? q.owner_user_id, { type: 'change', title: `Client ${label} quotation ${id}`, body: note || `Versi ${q.current_version}.`, entityType: 'lead', entityId: q.lead_id })
  await recordAudit(tx, { action: `quotation.client_${response.replace('-', '_')}`, actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, reason: note || null, after: { version: q.current_version } })
}
```
  (import `createActivity` dari `../core/party-writes`, `notifyInternal` sesuai keputusan Task 2.)
  - `sales/repository.ts` quotation heads: ambil `client_response, client_response_note, client_response_version, client_responded_at`; DTO `clientResponse: h.client_response && h.client_response_version === h.current_version ? { response, note, version, respondedAt } : null`.
  - `client-commerce.ts listClientQuotations`: kolom & field `clientResponse` sama.
  - Route `POST /client/quotations/:id/respond` (client only, `db.transaction`, `businessDateOf(new Date())`), respons = quotation client itu dari `listClientQuotations`.
- [ ] **Step 4: PASS** + `bun test test/client-commerce.test.ts test/leads-quotations*.test.ts --timeout 30000` + typecheck. **Commit:** `feat(sales): client merespons quotation (setuju/tolak/minta revisi) — tercatat per versi, staf diberi tahu (S12b-2)`

---

### Task 4: Frontend — tipe, endpoint, sync CR & quotation; halaman CR internal

**Files:** `frontend/app/types/api.ts`, `types/change-incident.ts`, `types/quotation.ts`, `lib/api/endpoints.ts`, `data/changes-sync.ts` (+test), `data/client-commerce-sync.ts` (+test), `data/leads-sync.ts` (mapper quotation internal), `data/index.ts` (peta transisi `CHANGE_REQUEST_TRANSITIONS`), `pages/changes/[id]/index.vue`.

- [ ] **Step 1: Tes gagal**
  - `changes-sync.test.ts`: `changeRequestFromServer` memetakan `changeType`, `cancellationFeeMinor` → `cancellationFeeIdr`, `cancelReason`, `clientDecidedBy/At`, `commercialImpactMinor` → `commercialImpactIdr`, status `waiting-client-approval`/`cancelled` tetap.
  - `client-commerce-sync.test.ts`: `quotationFromClientServer` membawa `clientResponse` → `Quotation.clientResponse`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi**
  - `ChangeRequestDto` + field baru; status union + `waiting-client-approval` | `cancelled`.
  - Endpoint: `sendChangeRequestToClient(id, input)`, `clientCreateChangeRequest(projectId, input, key)`, `clientApproveChangeRequest(id)`, `clientRejectChangeRequest(id, reason)`, `clientCancelChangeRequest(id, reason)`, `respondToQuotation(id, input)`.
  - `CHANGE_REQUEST_TRANSITIONS` (peta tombol staf) mengikuti server: `submitted → under-review | waiting-client-approval | approved | rejected`, `under-review → waiting-client-approval | approved | rejected`, `approved → implemented`; status lain tanpa aksi staf.
  - `pages/changes/[id]`: aksi "Kirim Dampak ke Client" (dialog: dampak komersial Rp, biaya pembatalan Rp, catatan waktu) memanggil `sendChangeRequestToClientOnServer`; hanya tampil untuk CR `source = client` di `submitted`/`under-review`; error approve 422 tampil sebagai toast.
  - `Quotation.clientResponse?` di types; mapper internal (leads-sync) & client membawa field itu; halaman quotation internal (yang menampilkan status kirim) menampilkan badge respons client bila ada.
- [ ] **Step 4: PASS** + `pnpm test`, vue-tsc, eslint. **Commit:** `feat(frontend): tipe & sync CR/quotation S12b-2; staf mengirim dampak CR ke client`

---

### Task 5: Frontend — portal client CR & respons quotation lewat server

**Files:** `components/client/ChangeRequestsListPanel.vue`, `pages/client/project-orders/[id]/index.vue` (dialog cepat CR), `pages/client/change-requests/[id]/index.vue`, `pages/client/quotations/[id]/index.vue`, `data/client-portal-writes.ts` (+test), `client-portal-writes.guard.test.ts`.

- [ ] **Step 1: Tes gagal**
  - `client-portal-writes.test.ts`: `clientSubmitChangeRequest`, `clientApproveChangeImpact`, `clientRejectChangeImpact`, `clientCancelChangeRequestOnServer`, `clientRespondToQuotation` meng-upsert hasil server; error tidak mengubah array.
  - Guard: tambah file portal di atas; FORBIDDEN `'createChangeRequest('`, `'submitChangeRequestDraft('`, `'approveChangeRequestImpact('`, `'rejectChangeRequestImpact('`, `'cancelChangeRequest('`, `'requestQuotationRevision('`, `'runChangeRequestMockReview('`, dan `'createPartyActivity('` untuk halaman quotation client.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi**
  - Modul: fungsi di atas (pakai `changeRequestFromServer`/`upsert` dari changes-sync; quotation lewat `quotationFromClientServer` + ganti di `QUOTATIONS`).
  - Panel CR: "Kirim Sekarang" → simpan draft lokal tetap boleh, tapi submit memanggil `clientSubmitChangeRequest(api, projectId, { changeType, beforeSummary, afterSummary })` lalu hapus draft lokal bila sukses (`deleteChangeRequestDraft` tetap lokal — S12c). Filter status memakai status server.
  - Dialog cepat di project client: `clientSubmitChangeRequest` dengan `beforeSummary` 'Kondisi saat ini' dan `afterSummary` = detail.
  - Detail CR: langkah `EXECUTION_STEPS` = submitted → under-review → waiting-client-approval → approved → implemented; terminal rejected / cancelled; tombol Setujui/Tolak (hanya `waiting-client-approval`), Batalkan (submitted/under-review/waiting); kartu dampak menampilkan dampak komersial & biaya pembatalan (Rp) dan catatan waktu.
  - Quotation client: Setujui/Tolak/Minta Revisi → `clientRespondToQuotation`; tombol tampil hanya bila `clientResponse` null dan belum `accepted` (project); tampilkan status respons ("Anda menyetujui versi n", dst.); hapus teks lama "menyetujui = Won/Project dibuat".
- [ ] **Step 4: PASS** + `pnpm test`, vue-tsc ≤ 1987, eslint vs HEAD. **Commit:** `feat(frontend): portal client mengajukan & memutuskan CR dan merespons quotation lewat server (S12b-2)`

---

### Task 6: Dokumentasi + verifikasi

- [ ] Smoke (salinan DB dev, migrasi 0039 jalan): client buat CR → admin send-to-client → client approve; admin approve CR client berbiaya 422; client respond quotation (bila ada quotation terkirim untuk PTY-005 — bila tidak ada, uji 404 dan catat).
- [ ] Suite penuh backend, `pnpm test`, vue-tsc, build.
- [ ] ADR-004 + ADR-006 update, status spec → diimplementasikan; commit docs.
