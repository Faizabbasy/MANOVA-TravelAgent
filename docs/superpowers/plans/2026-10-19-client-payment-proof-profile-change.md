# Bukti bayar & profil sensitif client (S12c-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client mengirim bukti bayar dan pengajuan perubahan profil sensitif ke server; Finance memverifikasi bukti dengan mencatat penerimaan kas, Admin menyetujui/menolak perubahan profil.

**Architecture:** Migrasi 0040 (`payment_proofs`, `party_profile_changes`, `customer_invoices.client_viewed_at`). Backend: `finance/payment-proofs.ts` (submit, verify via `postReceipt`, reject, list), `core/profile-changes.ts` (submit, approve via `updateParty`, reject, list) + route client/Finance/CRM. Frontend: DTO & sync, layar portal, layar Finance & CRM.

**Tech Stack:** Bun + Elysia + PGlite (backend), Nuxt 4 + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-10-19-client-payment-proof-profile-change-design.md`

## Global Constraints

- Migrasi `0040_client_payment_proofs_profile_changes.{up,down}.sql`. pnpm di frontend, bun di backend.
- Nominal resmi penerimaan selalu dari Finance; alokasi ≤ sisa invoice; bukti hanya satu `submitted` per invoice; pengajuan profil hanya satu `submitted` per party.
- Capability: list/verify bukti → `finance.view-cash` / `finance.post-cash` (+ Idempotency-Key); reject bukti → `finance.manage-receivables`; profil → `crm.manage-party` (Super Admin lolos semua).
- Notifikasi: ke client pengaju lewat `notify`; ke staf lewat `notifyInternal`; tidak pernah ke pelaku.
- Commit tiap task, stage path eksplisit; trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verifikasi: `bun test <file> --timeout 30000`, typecheck, `pnpm test`, vue-tsc ≤ 1987, eslint vs HEAD, build.

## Review Focus

1. Dua bukti dikirim bersamaan untuk invoice yang sama → satu tersimpan, satu 422 (unique parsial) (Task 1).
2. Finance memverifikasi dengan nominal > sisa invoice → 422, tanpa penerimaan tercatat (Task 2).
3. Bukti yang sudah ditolak → client bisa mengirim bukti baru (Task 1).
4. Pengajuan profil berisi NPWP tidak valid → 400, tidak ada pengajuan (Task 3).
5. Approve pengajuan setelah data aktif berubah oleh staf → tetap menerapkan nilai yang diajukan (pengajuan menang, dicatat before/after) (Task 3).

---

### Task 1: Migrasi 0040 + client mengirim bukti bayar & menandai invoice dilihat

**Files:** Create `backend/migrations/0040_client_payment_proofs_profile_changes.up.sql` & `.down.sql`, `backend/src/modules/finance/payment-proofs.ts`; Modify `backend/src/shared/ids.ts` (SOURCES `PPF-`, `PPC-` bila pakai `nextId`), `backend/src/modules/core/client-commerce.ts`, `backend/src/modules/core/client-write-routes.ts`; Test `backend/test/client-payment-proofs.test.ts`.

**Interfaces — Produces:** `submitPaymentProof(tx, actor, partyId, invoiceId, input, today, requestId): Promise<{ id }>`, `listPaymentProofs(db, filter)`, `markInvoiceViewed(tx, partyId, invoiceId)`; DTO client invoice + `paymentProof`, `viewedAt`.

- [ ] **Step 1: Tes gagal** — `client-payment-proofs.test.ts` (setup seperti `client-portal-writes.test.ts`; buat invoice issued PRJ-201 lewat Finance):
  - kirim `{ reference: 'TRF-001', amountMinor: '4000000', transferDate: '2026-10-18', senderBank: 'BCA', fileName: 'bukti.jpg' }` → 201; `GET /client/invoices/:id` memuat `paymentProof.status = 'submitted'`; Finance (USR-008) +1 notifikasi;
  - kirim lagi saat masih menunggu → 422; nominal > sisa → 400/422; tanggal masa depan → 400; referensi kosong → 400;
  - invoice party lain → 404; invoice draft → 404; admin → 403;
  - setelah bukti ditolak (set DB `status='rejected'`, `rejection_reason`) → bisa kirim lagi (201);
  - `POST /client/invoices/:id/viewed` → 200, `viewedAt` terisi; panggilan kedua tidak mengubah waktu.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Migrasi**

```sql
-- S12c-1: payment proofs a client sends for an invoice (Finance verifies them by posting the receipt) and sensitive
-- company-profile changes a client proposes (staff approve or reject them).
create table payment_proofs (
  id                     text primary key check (id <> ''),
  customer_invoice_id    text not null references customer_invoices (id),
  party_id               text not null references parties (id),
  submitted_by           text not null references users (id),
  reference              text not null check (btrim(reference) <> ''),
  amount_minor           bigint not null check (amount_minor > 0),
  transfer_date          date not null,
  sender_bank            text,
  note                   text,
  file_name              text,
  status                 text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  reviewed_by            text references users (id),
  reviewed_at            timestamptz,
  rejection_reason       text,
  receipt_transaction_id text references financial_transactions (id),
  created_at             timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null),
  check (status <> 'verified' or receipt_transaction_id is not null)
);
create unique index payment_proofs_one_open on payment_proofs (customer_invoice_id) where status = 'submitted';
create index payment_proofs_party on payment_proofs (party_id);

alter table customer_invoices add column client_viewed_at timestamptz;

create table party_profile_changes (
  id               text primary key check (id <> ''),
  party_id         text not null references parties (id),
  submitted_by     text not null references users (id),
  changes          jsonb not null check (jsonb_typeof(changes) = 'object'),
  status           text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  reviewed_by      text references users (id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null)
);
create unique index party_profile_changes_one_open on party_profile_changes (party_id) where status = 'submitted';

insert into id_sequences (prefix, last_value) values ('PPF-', 0), ('PPC-', 0) on conflict (prefix) do nothing;
```
(Cek nama kolom `id_sequences` dan pola insert di migrasi sebelumnya, mis. 0036/0038, sesuaikan.)

`down.sql`:
```sql
delete from id_sequences where prefix in ('PPF-', 'PPC-');
drop table if exists party_profile_changes;
alter table customer_invoices drop column if exists client_viewed_at;
drop table if exists payment_proofs;
```
(Pastikan trigger freeze invoice issued tidak menolak update `client_viewed_at` — trigger 0009 hanya membekukan kolom tertentu.)

- [ ] **Step 4: `finance/payment-proofs.ts`**
```ts
/** S12c-1: a client's proof of payment for an invoice; Finance verifies it by posting the receipt (the official amount). */
export async function submitPaymentProof(tx: Queryable, actor: Actor, partyId: string, invoiceId: string, input: Record<string, unknown>, today: string, requestId: string) {
  const problems: FieldErrors = {}
  const reference = typeof input.reference === 'string' ? input.reference.trim() : ''
  if (!reference || reference.length > 120) problems.reference = ['Nomor referensi transfer wajib diisi (maks. 120 karakter).']
  let amount = 0n
  try { amount = parseAmountMinor(input.amountMinor, 'amountMinor') } catch { problems.amountMinor = ['Nominal harus angka rupiah > 0.'] }
  const transferDate = typeof input.transferDate === 'string' && isIsoDate(input.transferDate) ? input.transferDate : null
  if (!transferDate) problems.transferDate = ['Tanggal transfer harus YYYY-MM-DD.']
  else if (transferDate > today) problems.transferDate = ['Tanggal transfer tidak boleh di masa depan.']
  const opt = (v: unknown, field: string, max: number) => {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string' || v.trim().length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return null }
    return v.trim() || null
  }
  const senderBank = opt(input.senderBank, 'senderBank', 100)
  const note = opt(input.note, 'note', 1000)
  const fileName = opt(input.fileName, 'fileName', 200)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [inv] = await tx.query<{ id: string; number: string | null; project_id: string; outstanding_minor: string }>(
    `select i.id, i.number, i.project_id, b.total_minor - b.paid_minor - b.credited_minor as outstanding_minor
       from customer_invoices i join v_customer_invoice_balances b on b.id = i.id
      where i.id = $1 and i.party_id = $2 and i.status = 'issued' for update of i`, [invoiceId, partyId])
  if (!inv) throw errors.notFound('Invoice')
  if (BigInt(inv.outstanding_minor) <= 0n) throw rule('Invoice ini sudah lunas.')
  if (amount > BigInt(inv.outstanding_minor)) throw errors.validation({ amountMinor: [`Nominal melebihi sisa tagihan (${inv.outstanding_minor}).`] })
  if ((await tx.query("select 1 from payment_proofs where customer_invoice_id = $1 and status = 'submitted'", [invoiceId])).length)
    throw rule('Bukti pembayaran sebelumnya masih menunggu verifikasi.')
  const id = await nextId(tx, 'PPF-')
  await tx.query(
    `insert into payment_proofs (id, customer_invoice_id, party_id, submitted_by, reference, amount_minor, transfer_date, sender_bank, note, file_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, invoiceId, partyId, actor.userId, reference, amount.toString(), transferDate, senderBank, note, fileName])
  const finance = await tx.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id")
  for (const u of finance) {
    await notifyInternal(tx, actor, u.id, { type: 'reminder', title: `Bukti bayar ${inv.number ?? invoiceId} menunggu verifikasi`,
      body: `Ref. ${reference} — Rp ${amount.toString()} (transfer ${transferDate}).`, entityType: 'invoice', entityId: invoiceId })
  }
  await recordAudit(tx, { action: 'finance.payment_proof_submitted', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: invoiceId, requestId,
    after: { proofId: id, reference, amountMinor: amount.toString(), transferDate } })
  return { id }
}
```
(Cek nama kolom view `v_customer_invoice_balances` — `total_minor`, `paid_minor`, `credited_minor`, kolom kunci `id`/`invoice_id` — dan sesuaikan; `v_customer_invoice_balances` dipakai `invoiceRowDto`.)
  - `listPaymentProofs(db, { invoiceId?, partyId?, status? })` → DTO `{ id, invoiceId, invoiceNumber, partyId, partyName, projectId, submittedBy, submittedByName, reference, amountMinor, transferDate, senderBank, note, fileName, status, reviewedBy, reviewedAt, rejectionReason, receiptTransactionId, submittedAt }`.
  - `markInvoiceViewed(tx, partyId, invoiceId)`: `update customer_invoices set client_viewed_at = now() where id = $1 and party_id = $2 and status in ('issued','void') and client_viewed_at is null`; 404 bila invoice bukan milik party.
- [ ] **Step 5: DTO client** — `client-commerce.ts clientInvoice()` tambah `paymentProof` (bukti terbaru invoice dari `listPaymentProofs`, view client: tanpa `reviewedBy`/`submittedBy` id, tanpa `receiptTransactionId`) dan `viewedAt`.
- [ ] **Step 6: Route** (client-write-routes): `POST /invoices/:id/payment-proofs` (withIdempotency, 201, respons invoice client), `POST /invoices/:id/viewed` (transaksi, respons `{ viewedAt }`).
- [ ] **Step 7: PASS** + `db.test.ts` + typecheck. **Commit:** `feat(finance): client mengirim bukti bayar invoice & menandai invoice dilihat; migrasi 0040 (S12c-1)`

---

### Task 2: Finance memverifikasi / menolak bukti bayar

**Files:** `backend/src/modules/finance/payment-proofs.ts`, `routes-ar-ap.ts`, `receivables.ts` (`getInvoice` + `paymentProofs`); test `backend/test/client-payment-proofs.test.ts`.

**Interfaces — Produces:** `verifyPaymentProof(tx, actor, id, input, requestId): Promise<{ id, transactionId }>`, `rejectPaymentProof(tx, actor, id, reason, requestId)`; routes `GET /finance/payment-proofs`, `POST /finance/payment-proofs/:id/verify`, `POST /finance/payment-proofs/:id/reject`.

- [ ] **Step 1: Tes gagal** — Finance butuh rekening siap posting (pola `finance-arap.test.ts`: buat akun, opening, verify opening oleh super admin):
  - `GET /finance/payment-proofs?status=submitted` (finance) memuat bukti; admin/client → 403;
  - verify `{ bankAccountId, amountMinor: '4000000', effectiveDate: '2026-10-18' }` + key → 200/201; bukti `verified` dengan `receiptTransactionId`; invoice client `paidMinor` naik 4.000.000; client +1 notifikasi; replay key sama → transaksi sama;
  - verify bukti lain dengan nominal > sisa → 422 tanpa transaksi baru;
  - reject tanpa alasan → 400; dengan alasan → `rejected`, client melihat `paymentProof.status = 'rejected'` + alasan;
  - verify/reject bukti yang sudah diputuskan → 422; admin → 403.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi**
```ts
async function lockProof(tx: Queryable, id: string) {
  const [p] = await tx.query<{ id: string; customer_invoice_id: string; party_id: string; submitted_by: string; status: string; reference: string; project_id: string }>(
    `select pp.id, pp.customer_invoice_id, pp.party_id, pp.submitted_by, pp.status, pp.reference, i.project_id
       from payment_proofs pp join customer_invoices i on i.id = pp.customer_invoice_id where pp.id = $1 for update of pp`, [id])
  if (!p) throw errors.notFound('Bukti pembayaran')
  if (p.status !== 'submitted') throw rule('Bukti pembayaran ini sudah diputuskan.')
  return p
}

/** Finance verify a proof by posting the receipt it describes (Finance sets the official amount and account). */
export async function verifyPaymentProof(tx: Queryable, actor: Actor, id: string, input: { bankAccountId: string; amountMinor: string; effectiveDate: string; reference?: string }, requestId: string) {
  const p = await lockProof(tx, id)
  const receipt = await postReceipt(tx, actor, {
    bankAccountId: input.bankAccountId, amountMinor: input.amountMinor, effectiveDate: input.effectiveDate, partyId: p.party_id, projectId: p.project_id,
    reference: input.reference?.trim() || p.reference, memo: `Bukti bayar client ${id}`,
    allocations: [{ invoiceId: p.customer_invoice_id, amountMinor: input.amountMinor }]
  }, requestId)
  await tx.query("update payment_proofs set status = 'verified', reviewed_by = $2, reviewed_at = now(), receipt_transaction_id = $3 where id = $1", [id, actor.userId, receipt.transactionId])
  await notify(tx, { userId: p.submitted_by, actorUserId: actor.userId, type: 'reminder', title: 'Pembayaran Anda telah diverifikasi',
    body: `Bukti ${p.reference} untuk invoice ${p.customer_invoice_id} telah kami terima.`, entityType: 'invoice', entityId: p.customer_invoice_id })
  await recordAudit(tx, { action: 'finance.payment_proof_verified', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: p.customer_invoice_id, requestId,
    after: { proofId: id, transactionId: receipt.transactionId, amountMinor: input.amountMinor } })
  return { id, transactionId: receipt.transactionId }
}

export async function rejectPaymentProof(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan penolakan wajib diisi.'] })
  const p = await lockProof(tx, id)
  await tx.query("update payment_proofs set status = 'rejected', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3 where id = $1", [id, actor.userId, reason.slice(0, 1000)])
  await notify(tx, { userId: p.submitted_by, actorUserId: actor.userId, type: 'reminder', title: 'Bukti pembayaran Anda ditolak',
    body: reason, entityType: 'invoice', entityId: p.customer_invoice_id })
  await recordAudit(tx, { action: 'finance.payment_proof_rejected', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: p.customer_invoice_id, requestId, reason })
}
```
  (Alokasi melebihi sisa ditolak oleh `allocateToInvoices` — pastikan pesannya 400/422 dan tes menyesuaikan kode nyata.)
  - Routes di `routes-ar-ap.ts`: list (`finance.view-cash`), verify (`finance.post-cash`, `idempotent(...)`, body `{ bankAccountId, amountMinor, effectiveDate, reference? }`), reject (`finance.manage-receivables`, `inTx`).
  - `getInvoice` + `paymentProofs: await listPaymentProofs(db, { invoiceId: id })`.
- [ ] **Step 4: PASS** + `finance-arap.test.ts` + typecheck. **Commit:** `feat(finance): Finance memverifikasi bukti bayar client dengan mencatat penerimaan kas, atau menolaknya (S12c-1)`

---

### Task 3: Perubahan profil sensitif — client mengajukan, Admin meninjau

**Files:** Create `backend/src/modules/core/profile-changes.ts`; Modify `party-writes.ts` (ekspor validator profil), `client-writes.ts`/`client-write-routes.ts`, `routes.ts` (rute CRM); test `backend/test/client-profile-changes.test.ts`.

**Interfaces — Produces:** `submitProfileChange(tx, actor, partyId, input, today, requestId)`, `approveProfileChange(tx, actor, id, today, requestId)`, `rejectProfileChange(tx, actor, id, reason, today, requestId)`, `listProfileChanges(db, filter)`; `GET /client/profile` + `pendingChange`.

- [ ] **Step 1: Tes gagal**:
  - client `POST /client/profile/changes { npwp: '01.234.567.8-901.234', billingName: 'PT Java Bhakti Persada Tbk' }` → 201; GET profile memuat `pendingChange.changes`; account owner & admin aktif +1 notifikasi; aktivitas party baru;
  - kirim lagi saat menunggu → 422; NPWP salah → 400; field non-sensitif (`city`) → 400; tanpa perubahan (nilai sama dengan aktif) → 400; nama perusahaan diperbolehkan;
  - admin `GET /party-profile-changes?status=submitted` memuat pengajuan; finance/client → 403;
  - approve → party ter-update (npwp, billingName), status `approved`, client +1 notifikasi; approve lagi → 422;
  - pengajuan baru → reject tanpa alasan 400, dengan alasan → `rejected`, data aktif tidak berubah.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementasi** — ekspor dari `party-writes.ts`:
```ts
/** Validates profile fields without writing (S12c-1: a client's proposed change is checked when it is submitted). */
export async function checkPartyProfile(tx: Queryable, input: PartyInput & Record<string, unknown>) {
  const problems: FieldErrors = {}
  const p = await profile(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  return p
}
```
  `profile-changes.ts`:
```ts
export const SENSITIVE_FIELDS = ['name', 'npwp', 'registrationNumber', 'billingName', 'billingAddress', 'paymentTerm'] as const
const COLUMN: Record<string, string> = { name: 'name', npwp: 'npwp', registrationNumber: 'registration_number', billingName: 'billing_name', billingAddress: 'billing_address', paymentTerm: 'payment_term' }

export async function submitProfileChange(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, today: string, requestId: string) {
  const other = Object.keys(input).filter(k => !(SENSITIVE_FIELDS as readonly string[]).includes(k))
  if (other.length) throw errors.validation(Object.fromEntries(other.map(k => [k, ['Bukan data registrasi/pajak/billing — ubah lewat profil biasa.']])))
  const checked = await checkPartyProfile(tx, input)
  const [current] = await tx.query<Record<string, unknown>>('select * from parties where id = $1 for update', [partyId])
  if (!current) throw errors.notFound('Customer')
  const changes = Object.fromEntries(Object.entries(checked).filter(([k, v]) => (current[COLUMN[k]!] ?? null) !== (v ?? null)))
  if (!Object.keys(changes).length) throw errors.validation({ changes: ['Tidak ada perubahan dibanding data saat ini.'] })
  if ((await tx.query("select 1 from party_profile_changes where party_id = $1 and status = 'submitted'", [partyId])).length)
    throw rule('Masih ada perubahan data yang menunggu verifikasi.')
  const id = await nextId(tx, 'PPC-')
  await tx.query('insert into party_profile_changes (id, party_id, submitted_by, changes) values ($1, $2, $3, $4::text::jsonb)', [id, partyId, actor.userId, JSON.stringify(changes)])
  await createActivity(tx, actor, partyId, { type: 'note', message: `Perubahan data sensitif Company Profile (${Object.keys(changes).join(', ')}) diajukan client, menunggu verifikasi.` }, today, requestId)
  const reviewers = await tx.query<{ id: string }>(
    "select id from users where status = 'active' and (role in ('admin', 'super-admin') or id = (select account_owner_user_id from parties where id = $1)) order by id", [partyId])
  for (const r of reviewers) await notifyInternal(tx, actor, r.id, { type: 'change', title: 'Perubahan data perusahaan menunggu verifikasi', body: `${Object.keys(changes).join(', ')} — ${current.name as string}.`, entityType: 'party', entityId: partyId })
  await recordAudit(tx, { action: 'party.profile_change_submitted', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { changeId: id, changes } })
  return { id }
}
```
  - `approveProfileChange`: lock baris (`for update`, status `submitted` else 422) → `updateParty(tx, actor, party_id, changes, requestId)` → status `approved`, `reviewed_*` → aktivitas party "Perubahan data … disetujui" → `notify` pengaju.
  - `rejectProfileChange`: alasan wajib → `rejected` → aktivitas → `notify` pengaju.
  - `listProfileChanges(db, { partyId?, status? })` DTO `{ id, partyId, partyName, submittedBy, submittedByName, changes, status, reviewedBy, reviewedAt, rejectionReason, submittedAt }`.
  - Route client `POST /client/profile/changes` (transaksi, 201, respons profil + pendingChange); `GET /client/profile` tambah `pendingChange` (pengajuan `submitted` terakhir atau null; view client tanpa id staf). Route CRM di `routes.ts`: `GET /party-profile-changes` (`crm.manage-party`), `POST /party-profile-changes/:id/approve|reject`.
  - `client-writes.ts clientUpdateProfile`: pesan 422 sensitif tetap, tapi sebut "ajukan lewat 'Ajukan Perubahan Data'".
- [ ] **Step 4: PASS** + `party-writes.test.ts`, `client-portal-writes.test.ts` + typecheck. **Commit:** `feat(core): client mengajukan perubahan data sensitif perusahaan, Admin menyetujui/menolak (S12c-1)`

---

### Task 4: Frontend — tipe, endpoint, sync

**Files:** `types/api.ts` (`ClientPaymentProofDto`, `PaymentProofDto`, `ProfileChangeDto`, input), `types/finance.ts` (`Invoice.paymentProofStatus?`, `paymentProofRejectionReason?`, `paymentProofTransferDate?`, `paymentProofSenderBank?`, `paymentProofFileName?`), `types/party.ts` (pending sudah ada), `lib/api/endpoints.ts`, `data/client-commerce-sync.ts` (+test), `data/client-portal-writes.ts` (+test).

- [ ] **Step 1: Tes gagal**: `invoiceFromClientServer` dengan `paymentProof.status='submitted'` → `status: 'waiting-verification'` + field bukti; `rejected` → status asal + `paymentProofStatus: 'rejected'` + alasan; `viewedAt` dipetakan. Profil: `mergeClientProfile` (atau `upsertServerParty` + pending) memetakan `pendingChange` ke `pendingProfileChange*`. Modul: `clientSubmitPaymentProof`, `clientMarkInvoiceViewed`, `clientSubmitProfileChange` meng-upsert hasil server; error tidak mengubah apa pun.
- [ ] **Step 2–4:** implementasi, PASS, `pnpm test`, vue-tsc, eslint. **Commit:** `feat(frontend): tipe & sync bukti bayar dan pengajuan profil (S12c-1)`

---

### Task 5: Frontend — portal client

**Files:** `pages/client/billing/invoices/[id]/index.vue`, `pages/client/billing/index.vue`, `pages/client/company-profile/index.vue`, `client-portal-writes.guard.test.ts`.

- [ ] **Step 1: Guard gagal** — FILES + tiga halaman; FORBIDDEN + `'submitPaymentProof('`, `'runPaymentVerificationMock('`, `'markInvoiceViewed('`, `'submitSensitiveCompanyProfileChange('`, `'runCompanyProfileVerificationMock('`.
- [ ] **Step 2: Implementasi**: form bukti + tanggal transfer (default hari ini Jakarta), bank pengirim, nama file; kirim lewat `clientSubmitPaymentProof` dengan save gate; kartu bukti menampilkan status server (menunggu / ditolak + alasan); `onMounted` hanya `clientMarkInvoiceViewed` (diam bila gagal) — mock verifikasi dihapus di kedua halaman billing. Company profile: field sensitif (termasuk nama perusahaan, kini bisa diedit di bagian "Ajukan Perubahan Data") dikirim `clientSubmitProfileChange`; banner menunggu dari `pendingProfileChange` server; mock verifikasi dihapus.
- [ ] **Step 3:** guard PASS, `pnpm test`, vue-tsc, eslint. **Commit:** `feat(frontend): portal client mengirim bukti bayar & mengajukan perubahan profil ke server (S12c-1)`

---

### Task 6: Frontend — layar Finance & CRM

**Files:** `data/finance-proofs-sync.ts` (atau di modul Finance yang ada), `components/finance/FinanceInvoiceSheet.vue`, `pages/finance/receivables/index.vue`, `pages/crm/parties/[id]/index.vue`, endpoint Finance & CRM.

- [ ] **Step 1: Tes gagal** — mapper `paymentProofFromServer` & `profileChangeFromServer`; helper `proofVerifyDefaults(proof)` → `{ amountMinor, effectiveDate: transferDate, reference }`.
- [ ] **Step 2: Implementasi**:
  - Piutang: kartu "Bukti Bayar Masuk" (list `GET /finance/payment-proofs?status=submitted`: invoice, customer, referensi, nominal, tanggal, bank) dengan tombol Verifikasi/Tolak; muat saat halaman dibuka (Finance).
  - Invoice sheet: banner bila invoice punya bukti `submitted` dengan tombol yang sama.
  - Dialog Verifikasi: pilih rekening (daftar akun yang dipakai `FinanceReceiptDialog`), nominal (terisi dari bukti, bisa dikoreksi), tanggal (terisi tanggal transfer), referensi → `verify` (Idempotency-Key), sukses → muat ulang invoice & piutang. Dialog Tolak: alasan wajib.
  - CRM detail customer (`crm.manage-party`): kartu "Perubahan Data Menunggu Verifikasi" (field: nilai sekarang → diajukan) dengan Setujui / Tolak (alasan); sukses → muat ulang customer.
- [ ] **Step 3:** PASS, `pnpm test`, vue-tsc, eslint. **Commit:** `feat(frontend): Finance memverifikasi bukti bayar & Admin meninjau perubahan profil client (S12c-1)`

---

### Task 7: Dokumentasi + verifikasi

- [ ] Smoke (salinan DB dev dimigrasi ke 40): client kirim bukti untuk invoice issued PTY-005 → Finance list → verify dengan rekening yang ada (bila DB dev punya rekening aktif; bila tidak, uji reject) → client lihat status; client ajukan NPWP → admin approve → profil berubah.
- [ ] Suite penuh backend, `pnpm test`, vue-tsc, build.
- [ ] ADR-004/ADR-005 (catat: bukti bayar = metadata; file asli menunggu ADR-005)/ADR-006, status spec; commit docs.
