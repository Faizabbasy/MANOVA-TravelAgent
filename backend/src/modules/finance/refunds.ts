import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { isUniqueViolation, parseMovementAmount, rule, todayBusinessDate } from './common'
import { assertOutflowFits, lockPostableAccount, trimOrNull, validateEffectiveDate, validateReason } from './postings'
import { applyTier, daysBetween, effectiveAssignment, type PolicySnapshot, resolveSubject, type Subject, type SubjectType, type Tier, tierFor } from './policies'

/**
 * Cancellation → refund (Phase 5, docs/.../08).
 *
 *  1. Preview (no side effects): policy snapshot, H (days before departure, Asia/Jakarta), tier, basis = DP
 *     actually received on the subject's invoices (minus earlier refunds), refund/retained split per payment.
 *  2. Create (idempotent): the case is recorded once; unpaid receivables of the subject are written off with
 *     `reduce_receivable` credit notes and planned billing is cancelled — the customer no longer owes them.
 *  3. Approve / reject (finance.approve-refund). Approval does NOT move money: it books the refund as a
 *     `refund_liability` credit note (revenue down, outstanding untouched — never both effects at once).
 *     Rejecting VOIDS the case — "this cancellation does not stand": its credit notes are voided and the billing
 *     plan it cancelled is restored. Allowed while no refund money has gone out (also for approved cases).
 *  4. Settle (finance.settle-refund, idempotent): real money out (`refund_settlement`) allocated to the case;
 *     partial allowed. Reversing a settlement reopens the case (allocations of reversed payments stop counting).
 */

// ── Computation shared by preview and create ─────────────────────────────────────────────────────────

interface SubjectInvoice extends Record<string, unknown> {
  id: string
  number: string | null
  invoice_type: string
  issue_date: string | null
  total_minor: string
  paid_minor: string
  credited_minor: string
  refund_credited_minor: string
  outstanding_minor: string
}

/**
 * Invoices/billing a subject covers. A whole-project case leaves out bookings that already have their own live
 * case (they are settled there), so booking and project cases never count the same money.
 */
function invoiceScope(subject: Subject, alias = 'i'): { where: string; params: unknown[] } {
  return subject.type === 'project'
    ? {
        where: `${alias}.project_id = $1 and not (${alias}.booking_id is not null and exists (select 1 from refunds rb where rb.status <> 'rejected' and rb.subject_type = ${alias}.booking_type and rb.subject_id = ${alias}.booking_id))`,
        params: [subject.id]
      }
    : { where: `${alias}.booking_type = $1 and ${alias}.booking_id = $2`, params: [subject.type, subject.id] }
}

async function subjectInvoices(q: Queryable, subject: Subject, lock: boolean): Promise<SubjectInvoice[]> {
  const scope = invoiceScope(subject)
  if (lock) {
    await q.query(`select id from customer_invoices i where ${scope.where} and i.status = 'issued' order by id for update`, scope.params)
  }
  return q.query<SubjectInvoice>(
    `select i.id, i.number, i.invoice_type, i.issue_date, b.total_minor, b.paid_minor, b.credited_minor,
            coalesce((select sum(c.amount_minor) from credit_notes c where c.customer_invoice_id = i.id and c.status = 'issued' and c.effect = 'refund_liability'), 0) as refund_credited_minor,
            (b.total_minor - b.paid_minor - b.credited_minor) as outstanding_minor
       from customer_invoices i join v_customer_invoice_balances b on b.invoice_id = i.id
      where ${scope.where} and i.status = 'issued'
      order by (i.invoice_type = 'dp') desc, i.issue_date nulls last, i.id`,
    scope.params
  )
}

interface CaseFigures {
  subject: Subject
  cancelDate: string
  daysBefore: number | null
  policy: PolicySnapshot | null
  tier: Tier | null
  canCalculate: boolean
  blockers: { code: string; message: string; caseId?: string }[]
  invoices: SubjectInvoice[]
  basis: bigint
  otherPaid: bigint
  policyRefund: bigint
  retained: bigint
  /** Never refund more than was received on the subject's invoices minus earlier refunds. */
  maxRefundable: bigint
  sourcePayments: { transactionId: string; invoiceId: string; invoiceNumber: string | null; invoiceType: string; effectiveDate: string; amountMinor: string }[]
  writeOffs: { invoiceId: string; number: string | null; outstandingMinor: string }[]
  plannedBillingCount: number
  draftInvoiceCount: number
  unallocatedAdvance: bigint
  vendorOpen: { count: number; outstanding: bigint }
}

const refundable = (i: SubjectInvoice) => BigInt(i.paid_minor) - BigInt(i.refund_credited_minor)

async function computeCase(q: Queryable, subject: Subject, cancelDate: string, lock: boolean): Promise<CaseFigures> {
  const blockers: { code: string; message: string; caseId?: string }[] = []
  const [active] = await q.query<{ id: string }>("select id from refunds where subject_type = $1 and subject_id = $2 and status <> 'rejected'", [subject.type, subject.id])
  if (active) blockers.push({ code: 'ACTIVE_CASE', message: `Pembatalan ini sudah tercatat (${active.id}).`, caseId: active.id })
  if (subject.type !== 'project') {
    const [whole] = await q.query<{ id: string }>("select id from refunds where project_id = $1 and subject_type = 'project' and status <> 'rejected'", [subject.projectId])
    if (whole) blockers.push({ code: 'OVERLAPPING_CASE', message: `Seluruh project sudah dibatalkan (${whole.id}).`, caseId: whole.id })
  }

  const { assignment } = await effectiveAssignment(q, subject)
  const policy = assignment?.snapshot ?? null
  const daysBefore = subject.departureDate ? daysBetween(cancelDate, subject.departureDate) : null
  if (!policy) blockers.push({ code: 'NO_POLICY', message: 'Belum ada kebijakan pembatalan untuk ini, jadi refund tidak bisa dihitung otomatis. Tetapkan kebijakan, atau catat dengan nominal manual (disetujui Finance).' })
  if (daysBefore === null) blockers.push({ code: 'NO_DEPARTURE_DATE', message: 'Tanggal berangkat belum diisi, jadi H-x tidak bisa dihitung. Lengkapi tanggalnya, atau catat dengan nominal manual.' })
  const tier = policy && daysBefore !== null ? tierFor(policy.tiers, daysBefore) : null

  const invoices = await subjectInvoices(q, subject, lock)
  const dp = invoices.filter(i => i.invoice_type === 'dp')
  const other = invoices.filter(i => i.invoice_type !== 'dp')
  const basis = dp.reduce((s, i) => s + refundable(i), 0n)
  const otherPaid = other.reduce((s, i) => s + refundable(i), 0n)
  const split = tier ? applyTier(basis, tier) : { refund: 0n, retained: basis }

  const ids = invoices.map(i => i.id)
  const payments = ids.length
    ? await q.query<{ transaction_id: string; target_id: string; effective_date: string; amount_minor: string }>(
      `select a.transaction_id, a.target_id, t.effective_date, a.amount_minor from v_active_allocations a
         join financial_transactions t on t.id = a.transaction_id
        where a.target_type = 'customer_invoice' and a.target_id = any($1::text[]) order by t.effective_date, a.transaction_id`, [ids])
    : []
  const byId = new Map(invoices.map(i => [i.id, i]))

  const scope = invoiceScope(subject, 's')
  const [planned] = await q.query<{ n: string }>(`select count(*) as n from billing_schedule_items s where ${scope.where} and s.status = 'planned'`, scope.params)
  const draftScope = invoiceScope(subject, 'i')
  const [drafts] = await q.query<{ n: string }>(`select count(*) as n from customer_invoices i where ${draftScope.where} and i.status = 'draft'`, draftScope.params)
  const [advance] = await q.query<{ total: string }>(
    "select coalesce(sum(unallocated_minor), 0) as total from v_unallocated_payments where kind = 'customer_receipt' and project_id = $1", [subject.projectId]
  )
  const vScope = invoiceScope(subject, 'v')
  const [vendor] = await q.query<{ n: string; total: string }>(
    `select count(*) as n, coalesce(sum(b.total_minor - b.paid_minor), 0) as total from vendor_invoices v
       join v_vendor_invoice_balances b on b.vendor_invoice_id = v.id
      where ${vScope.where} and v.status = 'approved' and b.total_minor - b.paid_minor > 0`, vScope.params
  )

  return {
    subject,
    cancelDate,
    daysBefore,
    policy,
    tier,
    canCalculate: !!tier && !blockers.some(b => b.code === 'ACTIVE_CASE' || b.code === 'OVERLAPPING_CASE'),
    blockers,
    invoices,
    basis,
    otherPaid,
    policyRefund: split.refund,
    retained: split.retained,
    maxRefundable: basis + otherPaid,
    sourcePayments: payments.map(p => ({
      transactionId: p.transaction_id,
      invoiceId: p.target_id,
      invoiceNumber: byId.get(p.target_id)?.number ?? null,
      invoiceType: byId.get(p.target_id)?.invoice_type ?? 'other',
      effectiveDate: p.effective_date,
      amountMinor: p.amount_minor
    })),
    writeOffs: invoices.filter(i => BigInt(i.outstanding_minor) > 0n).map(i => ({ invoiceId: i.id, number: i.number, outstandingMinor: i.outstanding_minor })),
    plannedBillingCount: Number(planned!.n),
    draftInvoiceCount: Number(drafts!.n),
    unallocatedAdvance: BigInt(advance!.total),
    vendorOpen: { count: Number(vendor!.n), outstanding: BigInt(vendor!.total) }
  }
}

function subjectDto(s: Subject) {
  return { type: s.type, id: s.id, projectId: s.projectId, projectName: s.projectName, partyId: s.partyId, partyName: s.partyName, departureDate: s.departureDate }
}

const policyBrief = (p: PolicySnapshot | null) => (p ? { id: p.policyId, code: p.code, name: p.name, version: p.version, basis: p.basis, tiers: p.tiers } : null)

/** Full preview for Finance; status-only (no amounts) for roles without finance figures. */
function previewDto(f: CaseFigures, full: boolean) {
  const base = {
    subject: subjectDto(f.subject),
    cancelDate: f.cancelDate,
    daysBefore: f.daysBefore,
    policy: policyBrief(f.policy),
    tier: f.tier,
    canCalculate: f.canCalculate,
    blockers: f.blockers,
    plannedBillingCount: f.plannedBillingCount,
    draftInvoiceCount: f.draftInvoiceCount,
    writeOffInvoiceCount: f.writeOffs.length
  }
  if (!full) return { view: 'status' as const, ...base }
  return {
    view: 'full' as const,
    ...base,
    basisMinor: f.basis.toString(),
    otherPaidMinor: f.otherPaid.toString(),
    policyRefundMinor: f.policyRefund.toString(),
    retainedMinor: f.retained.toString(),
    maxRefundableMinor: f.maxRefundable.toString(),
    sourcePayments: f.sourcePayments,
    writeOffs: f.writeOffs,
    writeOffMinor: f.writeOffs.reduce((s, w) => s + BigInt(w.outstandingMinor), 0n).toString(),
    unallocatedAdvanceMinor: f.unallocatedAdvance.toString(),
    vendorOpenCount: f.vendorOpen.count,
    vendorOpenMinor: f.vendorOpen.outstanding.toString()
  }
}

function parseCancelDate(value: unknown): string {
  if (value === undefined || value === null || value === '') return todayBusinessDate()
  if (typeof value !== 'string' || !isIsoDate(value)) throw errors.validation({ cancelDate: ['Tanggal harus berformat YYYY-MM-DD.'] })
  if (value > todayBusinessDate()) throw errors.validation({ cancelDate: ['Tanggal pembatalan tidak boleh di masa depan.'] })
  return value
}

export async function previewCancellation(db: Db, input: { subjectType: SubjectType; subjectId: string; cancelDate?: string }, full: boolean) {
  const subject = await resolveSubject(db, input.subjectType, input.subjectId)
  return previewDto(await computeCase(db, subject, parseCancelDate(input.cancelDate), false), full)
}

// ── Create ────────────────────────────────────────────────────────────────────────────────────────────

export interface CancellationInput {
  subjectType: SubjectType
  subjectId: string
  cancelDate?: string
  reason: string
  calculation?: 'policy' | 'manual'
  /** Finance only: extra refund beyond the policy (e.g. from non-DP payments), with its own reason. */
  additionalRefundMinor?: string
  additionalReason?: string
  /** Finance only, manual cases: proposed amount (the approver sets the final one). */
  proposedRefundMinor?: string
}

export async function createCancellation(tx: Queryable, actor: Actor, input: CancellationInput, full: boolean, requestId: string) {
  const reason = validateReason(input.reason)
  const subject = await resolveSubject(tx, input.subjectType, input.subjectId)
  // One cancellation at a time per project (covers project- and booking-level cases).
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`cancel:${subject.projectId}`])
  const cancelDate = parseCancelDate(input.cancelDate)
  const f = await computeCase(tx, subject, cancelDate, true)
  const hard = f.blockers.find(b => b.code === 'ACTIVE_CASE' || b.code === 'OVERLAPPING_CASE')
  if (hard) throw new AppError(409, 'CONFLICT', hard.message)

  const calculation = input.calculation ?? (f.tier ? 'policy' : 'manual')
  if (calculation !== 'policy' && calculation !== 'manual') throw errors.validation({ calculation: ['Pilihan: policy atau manual.'] })
  if (calculation === 'policy' && !f.tier) throw rule(f.blockers.map(b => b.message).join(' '))

  let additional = 0n
  let additionalReason: string | null = null
  let refundableAmount: bigint
  if (calculation === 'policy') {
    if (input.additionalRefundMinor && input.additionalRefundMinor !== '0') {
      if (!full) throw errors.forbidden('Refund tambahan di luar kebijakan hanya bisa diajukan tim Finance.')
      additional = parseMovementAmount(input.additionalRefundMinor, 'additionalRefundMinor')
      additionalReason = trimOrNull(input.additionalReason, 500)
      if (!additionalReason || additionalReason.length < 5) throw errors.validation({ additionalReason: ['Jelaskan alasan refund tambahan (minimal 5 karakter).'] })
      if (f.policyRefund + additional > f.maxRefundable) {
        throw errors.validation({ additionalRefundMinor: [`Total refund melebihi uang yang diterima dari customer (maksimal tambahan ${f.maxRefundable - f.policyRefund}).`] })
      }
    }
    refundableAmount = f.policyRefund + additional
  } else {
    if (input.proposedRefundMinor && input.proposedRefundMinor !== '0' && !full) throw errors.forbidden('Nominal refund manual diisi oleh tim Finance saat menyetujui.')
    refundableAmount = input.proposedRefundMinor ? parseMovementAmount(input.proposedRefundMinor, 'proposedRefundMinor', { allowZero: true }) : 0n
    if (refundableAmount > f.maxRefundable) throw errors.validation({ proposedRefundMinor: [`Melebihi uang yang diterima dari customer (${f.maxRefundable}).`] })
  }

  const writeOffTotal = f.writeOffs.reduce((s, w) => s + BigInt(w.outstandingMinor), 0n)
  // Nothing to give back under the policy: the case is settled by definition, no approval step needed.
  const autoApproved = calculation === 'policy' && refundableAmount === 0n
  let row: { id: string } | undefined
  try {
    ;[row] = await tx.query<{ id: string }>(
      `insert into refunds (subject_type, subject_id, project_id, party_id, cancel_date, departure_date, days_before, calculation,
         policy_id, policy_version, policy_snapshot, tier, basis_minor, other_paid_minor, policy_refund_minor, additional_refund_minor, additional_reason,
         refundable_minor, retained_minor, written_off_minor, source_payments, reason, status, requested_by, decided_by, decided_at, decision_note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb, $12::text::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21::text::jsonb, $22,
         $23, $24, $25, $26, $27) returning id`,
      [subject.type, subject.id, subject.projectId, subject.partyId, cancelDate, subject.departureDate, f.daysBefore, calculation,
        calculation === 'policy' ? f.policy!.policyId : null, calculation === 'policy' ? f.policy!.version : null,
        calculation === 'policy' ? JSON.stringify(f.policy) : null, calculation === 'policy' ? JSON.stringify(f.tier) : null,
        f.basis.toString(), f.otherPaid.toString(), calculation === 'policy' ? f.policyRefund.toString() : '0', additional.toString(), additionalReason,
        refundableAmount.toString(), calculation === 'policy' ? f.retained.toString() : (f.basis > refundableAmount ? f.basis - refundableAmount : 0n).toString(),
        writeOffTotal.toString(), JSON.stringify(f.sourcePayments), reason,
        autoApproved ? 'approved' : 'requested', actor.userId, autoApproved ? actor.userId : null, autoApproved ? new Date() : null,
        autoApproved ? 'Tidak ada refund menurut kebijakan pembatalan.' : null]
    )
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'CONFLICT', 'Sudah ada kasus pembatalan untuk ini.')
    throw err
  }
  const caseId = row!.id
  const label = subject.type === 'project' ? `project ${subject.projectName}` : `booking ${subject.type} ${subject.id}`

  // The customer no longer owes what was billed but not paid.
  for (const w of f.writeOffs) {
    await tx.query(
      `insert into credit_notes (customer_invoice_id, effect, amount_minor, reason, refund_id, created_by) values ($1, 'reduce_receivable', $2, $3, $4, $5)`,
      [w.invoiceId, w.outstandingMinor, `Pembatalan ${label} (${caseId}): sisa tagihan dihapus`, caseId, actor.userId]
    )
  }
  const s = invoiceScope(subject, 'billing_schedule_items')
  await tx.query(
    `update billing_schedule_items set status = 'cancelled', cancelled_by_refund = $${s.params.length + 1}, updated_at = now() where ${s.where} and status = 'planned'`,
    [...s.params, caseId]
  )
  await recordAudit(tx, {
    action: 'finance.cancellation_recorded', actorUserId: actor.userId, entityType: 'refund', entityId: caseId, requestId, reason,
    after: {
      subject: { type: subject.type, id: subject.id }, cancelDate, daysBefore: f.daysBefore, calculation,
      policy: f.policy ? { id: f.policy.policyId, version: f.policy.version } : null, tier: f.tier,
      basisMinor: f.basis.toString(), refundableMinor: refundableAmount.toString(), writtenOffMinor: writeOffTotal.toString(),
      plannedCancelled: f.plannedBillingCount, autoApproved
    }
  })
  return getRefund(tx, caseId, full)
}

// ── Decide ────────────────────────────────────────────────────────────────────────────────────────────

async function lockRefund(tx: Queryable, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Kasus refund')
  const [r] = await tx.query<RefundRow>('select * from refunds where id = $1 for update', [id])
  if (!r) throw errors.notFound('Kasus refund')
  return r
}

export async function approveRefund(tx: Queryable, actor: Actor, id: string, input: { refundMinor?: string; note?: string }, requestId: string) {
  const r = await lockRefund(tx, id)
  if (r.status !== 'requested') throw rule('Kasus ini sudah diputuskan.')
  const subject = await resolveSubject(tx, r.subject_type, r.subject_id)
  const invoices = await subjectInvoices(tx, subject, true)
  const available = invoices.reduce((s, i) => s + refundable(i), 0n)

  let amount = BigInt(r.refundable_minor)
  if (r.calculation === 'manual') {
    if (input.refundMinor === undefined) throw errors.validation({ refundMinor: ['Tentukan nominal refund untuk kasus manual.'] })
    amount = parseMovementAmount(input.refundMinor, 'refundMinor', { allowZero: true })
  } else if (input.refundMinor !== undefined && input.refundMinor !== r.refundable_minor) {
    throw rule('Nominal refund kasus ini mengikuti kebijakan dan tidak bisa diubah. Tolak lalu catat ulang bila perlu.')
  }
  const dpNow = invoices.filter(i => i.invoice_type === 'dp').reduce((s, i) => s + refundable(i), 0n)
  if (r.calculation === 'policy' && BigInt(r.policy_refund_minor) > dpNow) {
    throw new AppError(409, 'PAYMENTS_CHANGED', `DP yang diterima berubah sejak kasus dicatat (sekarang ${dpNow}). Tolak kasus ini lalu catat ulang.`)
  }
  if (amount > available) {
    throw new AppError(409, 'PAYMENTS_CHANGED', `Uang yang diterima dari customer berubah sejak kasus dicatat; yang bisa di-refund sekarang ${available}. Tolak kasus ini lalu catat ulang.`)
  }

  // Book the refund against the invoices whose payments it comes from: DP first, then the rest.
  let left = amount
  for (const inv of invoices) {
    if (left === 0n) break
    const take = refundable(inv) < left ? refundable(inv) : left
    if (take <= 0n) continue
    await tx.query(
      `insert into credit_notes (customer_invoice_id, effect, amount_minor, reason, refund_id, created_by) values ($1, 'refund_liability', $2, $3, $4, $5)`,
      [inv.id, take.toString(), `Refund pembatalan (${r.id})`, r.id, actor.userId]
    )
    left -= take
  }
  const retained = BigInt(r.basis_minor) > amount ? BigInt(r.basis_minor) - amount : 0n
  await tx.query(
    `update refunds set status = 'approved', refundable_minor = $2, retained_minor = case when calculation = 'manual' then $3 else retained_minor end,
       decided_by = $4, decided_at = now(), decision_note = $5 where id = $1`,
    [r.id, amount.toString(), retained.toString(), actor.userId, trimOrNull(input.note, 500)]
  )
  await recordAudit(tx, { action: 'finance.refund_approved', actorUserId: actor.userId, entityType: 'refund', entityId: r.id, requestId, after: { refundableMinor: amount.toString() }, reason: input.note ?? null })
  return getRefund(tx, r.id, true)
}

/**
 * Voids the case: the cancellation does not stand. Its credit notes (write-offs and refund) are voided, so the
 * invoices owe again what they owed; the billing plan items it cancelled are planned again. Only while no refund
 * money is out (reverse the settlements first).
 */
export async function rejectRefund(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  const r = await lockRefund(tx, id)
  if (r.status === 'rejected') throw rule('Kasus ini sudah dibatalkan.')
  const [paid] = await tx.query<{ n: string }>("select count(*) as n from v_active_allocations where target_type = 'refund' and target_id = $1", [r.id])
  if (Number(paid!.n) > 0) throw rule('Sudah ada refund yang dibayar untuk kasus ini. Batalkan pembayarannya dulu di Mutasi Rekening.')
  const subject = await resolveSubject(tx, r.subject_type, r.subject_id)
  await subjectInvoices(tx, subject, true) // lock the invoices whose balance changes
  await tx.query("update refunds set status = 'rejected', reject_reason = $2, decided_by = $3, decided_at = now() where id = $1", [r.id, reason, actor.userId])
  const voided = await tx.query<{ id: string }>(
    "update credit_notes set status = 'void', void_reason = $2, voided_by = $3, voided_at = now() where refund_id = $1 and status = 'issued' returning id",
    [r.id, `Kasus pembatalan ${r.id} dibatalkan: ${reason}`.slice(0, 500), actor.userId]
  )
  const restored = await tx.query<{ id: string }>(
    "update billing_schedule_items set status = 'planned', cancelled_by_refund = null, updated_at = now() where cancelled_by_refund = $1 and status = 'cancelled' returning id", [r.id]
  )
  await recordAudit(tx, {
    action: 'finance.refund_rejected', actorUserId: actor.userId, entityType: 'refund', entityId: r.id, requestId, reason,
    before: { status: r.status }, after: { creditNotesVoided: voided.map(v => v.id), billingRestored: restored.map(x => x.id) }
  })
  return getRefund(tx, r.id, true)
}

// ── Settle (money out) ────────────────────────────────────────────────────────────────────────────────

export interface SettlementInput {
  bankAccountId: string
  amountMinor: string
  effectiveDate: string
  recipient?: string
  reference?: string
  memo?: string
}

export async function settleRefund(tx: Queryable, actor: Actor, id: string, input: SettlementInput, requestId: string) {
  const amount = parseMovementAmount(input.amountMinor)
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  const r = await lockRefund(tx, id)
  if (r.status !== 'approved') throw rule(r.status === 'requested' ? 'Kasus ini belum disetujui; refund baru bisa dibayar setelah disetujui.' : 'Kasus ini ditolak.')
  const [bal] = await tx.query<{ refundable_minor: string; settled_minor: string }>('select * from v_refund_balances where refund_id = $1', [r.id])
  const outstanding = BigInt(bal!.refundable_minor) - BigInt(bal!.settled_minor)
  if (outstanding <= 0n) throw rule('Refund kasus ini sudah dibayar penuh.')
  if (amount > outstanding) throw errors.validation({ amountMinor: [`Melebihi sisa refund (${outstanding}).`] })
  const account = await lockPostableAccount(tx, input.bankAccountId, effectiveDate)
  await assertOutflowFits(tx, account, effectiveDate, amount)
  const booking = r.subject_type === 'project' ? { type: null, id: null } : { type: r.subject_type, id: r.subject_id }
  const [row] = await tx.query<{ id: string }>(
    `insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, booking_type, booking_id,
       party_id, counterparty, reference, memo, created_by)
     values ($1, 'out', $2, $3, 'refund_settlement', $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
    [account.id, amount.toString(), account.currency, effectiveDate, r.project_id, booking.type, booking.id, r.party_id,
      trimOrNull(input.recipient, 200), trimOrNull(input.reference, 120), trimOrNull(input.memo) ?? `Refund ${r.id}`, actor.userId]
  )
  await tx.query('insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by) values ($1, $2, $3, $4, $5)',
    [row!.id, 'refund', r.id, amount.toString(), actor.userId])
  await recordAudit(tx, {
    action: 'finance.refund_settled', actorUserId: actor.userId, entityType: 'refund', entityId: r.id, requestId,
    after: { transactionId: row!.id, accountId: account.id, amountMinor: amount.toString(), effectiveDate }
  })
  return { transactionId: row!.id, refundId: r.id, amountMinor: amount.toString(), outstandingMinor: (outstanding - amount).toString() }
}

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────────

interface RefundRow extends Record<string, any> {
  id: string
  subject_type: SubjectType
  subject_id: string
  project_id: string
  party_id: string
  calculation: 'policy' | 'manual'
  status: 'requested' | 'approved' | 'rejected'
  basis_minor: string
  refundable_minor: string
}

const REFUND_SELECT = `
  select r.*, r.requested_at::text as requested_at_text, p.name as project_name, pa.name as party_name, u.name as requested_by_name, d.name as decided_by_name,
         b.settled_minor, (b.refundable_minor - b.settled_minor) as outstanding_minor
    from refunds r
    join projects p on p.id = r.project_id
    join parties pa on pa.id = r.party_id
    join users u on u.id = r.requested_by
    left join users d on d.id = r.decided_by
    join v_refund_balances b on b.refund_id = r.id`

export type RefundSettlementState = 'none' | 'unpaid' | 'partial' | 'settled' | null

function settlementOf(r: Record<string, any>): RefundSettlementState {
  if (r.status !== 'approved') return null
  if (BigInt(r.refundable_minor) === 0n) return 'none'
  if (BigInt(r.outstanding_minor) === 0n) return 'settled'
  return BigInt(r.settled_minor) > 0n ? 'partial' : 'unpaid'
}

export function refundDto(r: Record<string, any>, full: boolean) {
  const base = {
    id: r.id as string,
    subject: { type: r.subject_type as SubjectType, id: r.subject_id as string },
    project: { id: r.project_id as string, name: r.project_name as string },
    party: { id: r.party_id as string, name: r.party_name as string },
    cancelDate: r.cancel_date as string,
    departureDate: (r.departure_date ?? null) as string | null,
    daysBefore: (r.days_before ?? null) as number | null,
    calculation: r.calculation as 'policy' | 'manual',
    policy: r.policy_snapshot ? { id: r.policy_snapshot.policyId, code: r.policy_snapshot.code, name: r.policy_snapshot.name, version: r.policy_snapshot.version } : null,
    tier: (r.tier ?? null) as Tier | null,
    status: r.status as 'requested' | 'approved' | 'rejected',
    settlement: settlementOf(r),
    reason: r.reason as string,
    requestedBy: { id: r.requested_by as string, name: r.requested_by_name as string },
    requestedAt: (r.requested_at as Date).toISOString(),
    decidedBy: r.decided_by ? { id: r.decided_by as string, name: r.decided_by_name as string } : null,
    decidedAt: r.decided_at ? (r.decided_at as Date).toISOString() : null,
    decisionNote: (r.decision_note ?? null) as string | null,
    rejectReason: (r.reject_reason ?? null) as string | null
  }
  if (!full) return { view: 'status' as const, ...base }
  return {
    view: 'full' as const,
    ...base,
    basisMinor: r.basis_minor as string,
    otherPaidMinor: r.other_paid_minor as string,
    policyRefundMinor: r.policy_refund_minor as string,
    additionalRefundMinor: r.additional_refund_minor as string,
    additionalReason: (r.additional_reason ?? null) as string | null,
    refundableMinor: r.refundable_minor as string,
    retainedMinor: r.retained_minor as string,
    writtenOffMinor: r.written_off_minor as string,
    settledMinor: r.settled_minor as string,
    outstandingMinor: r.outstanding_minor as string,
    sourcePayments: r.source_payments as CaseFigures['sourcePayments']
  }
}

export async function getRefund(q: Queryable, id: string, full: boolean) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Kasus refund')
  const [r] = await q.query<Record<string, any>>(`${REFUND_SELECT} where r.id = $1`, [id])
  if (!r) throw errors.notFound('Kasus refund')
  const dto = refundDto(r, full)
  if (!full) return dto
  const settlements = await q.query<Record<string, any>>(
    `select t.id, t.effective_date, t.amount_minor, t.reference, t.counterparty, ba.id as account_id, ba.code as account_code,
            exists (select 1 from financial_transactions x where x.reversal_of_id = t.id) as reversed
       from payment_allocations a join financial_transactions t on t.id = a.transaction_id join bank_accounts ba on ba.id = t.bank_account_id
      where a.target_type = 'refund' and a.target_id = $1 order by t.effective_date, t.id`, [id]
  )
  const credits = await q.query<Record<string, any>>(
    `select c.id, c.effect, c.amount_minor, c.reason, c.status, i.id as invoice_id, i.number as invoice_number
       from credit_notes c join customer_invoices i on i.id = c.customer_invoice_id where c.refund_id = $1 order by c.created_at, c.id`, [id]
  )
  return {
    ...dto,
    settlements: settlements.map(s => ({
      transactionId: s.id, effectiveDate: s.effective_date, amountMinor: s.amount_minor, reference: s.reference, recipient: s.counterparty,
      account: { id: s.account_id, code: s.account_code }, reversed: s.reversed as boolean
    })),
    creditNotes: credits.map(c => ({
      id: c.id, effect: c.effect as 'reduce_receivable' | 'refund_liability', amountMinor: c.amount_minor, reason: c.reason, status: c.status,
      invoice: { id: c.invoice_id, number: c.invoice_number }
    }))
  }
}

/** Worklist of cases. `full` = Finance (amounts); otherwise the status view only (Admin, Changes screen). */
export async function listRefunds(db: Db, filter: { view?: string; projectId?: string; partyId?: string; limit: number; cursor?: string }, full = true) {
  const view = filter.view ?? 'open'
  const params: unknown[] = []
  const where: string[] = []
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.split('?').join(`$${params.length}`)) }
  switch (view) {
    case 'open': where.push("(r.status = 'requested' or (r.status = 'approved' and b.refundable_minor - b.settled_minor > 0))"); break
    case 'requested': where.push("r.status = 'requested'"); break
    case 'to_pay': where.push("r.status = 'approved' and b.refundable_minor - b.settled_minor > 0"); break
    case 'settled': where.push("r.status = 'approved' and b.refundable_minor - b.settled_minor = 0"); break
    case 'rejected': where.push("r.status = 'rejected'"); break
    case 'all': break
    default: throw errors.validation({ view: ['Pilihan: open, requested, to_pay, settled, rejected, all.'] })
  }
  if (filter.projectId) { if (!ID_PATTERN.test(filter.projectId)) throw errors.validation({ projectId: ['Project tidak valid.'] }); add('r.project_id = ?', filter.projectId) }
  if (filter.partyId) { if (!ID_PATTERN.test(filter.partyId)) throw errors.validation({ partyId: ['Customer tidak valid.'] }); add('r.party_id = ?', filter.partyId) }
  const base = where.length ? where.join(' and ') : 'true'
  const [summary] = await db.query<{ requested: string; to_pay: string; to_pay_minor: string }>(
    `select count(*) filter (where r.status = 'requested') as requested,
            count(*) filter (where r.status = 'approved' and b.refundable_minor - b.settled_minor > 0) as to_pay,
            coalesce(sum(b.refundable_minor - b.settled_minor) filter (where r.status = 'approved'), 0) as to_pay_minor
       from refunds r join v_refund_balances b on b.refund_id = r.id where ${base}`, params
  )
  const pageParams = [...params]
  let pageWhere = base
  if (filter.cursor) {
    let at: string, id: string
    try {
      const parsed = JSON.parse(Buffer.from(filter.cursor, 'base64url').toString('utf8'))
      if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || Number.isNaN(Date.parse(parsed[0].replace(' ', 'T'))) || !ID_PATTERN.test(parsed[1])) throw new Error()
      ;[at, id] = parsed
    } catch {
      throw errors.validation({ cursor: ['Cursor tidak valid.'] })
    }
    pageParams.push(at, id.length, id)
    const n = pageParams.length
    pageWhere += ` and (r.requested_at, length(r.id), r.id) < ($${n - 2}::timestamptz, $${n - 1}::int, $${n})`
  }
  pageParams.push(filter.limit + 1)
  const rows = await db.query<Record<string, any>>(
    `${REFUND_SELECT} where ${pageWhere} order by r.requested_at desc, length(r.id) desc, r.id desc limit $${pageParams.length}`, pageParams
  )
  const items = rows.slice(0, filter.limit)
  const last = items[items.length - 1]
  return {
    items: items.map(r => refundDto(r, full)),
    summary: { requestedCount: Number(summary!.requested), toPayCount: Number(summary!.to_pay), ...(full ? { toPayMinor: summary!.to_pay_minor } : {}) },
    pagination: {
      limit: filter.limit,
      // requested_at as text keeps microseconds (a Date would truncate to ms and skip rows in the same ms).
      nextCursor: rows.length > filter.limit && last ? Buffer.from(JSON.stringify([last.requested_at_text, last.id])).toString('base64url') : null
    }
  }
}

/** The live case that cancels this subject (itself, or its whole project for a booking), for summaries. */
export async function activeCaseFor(q: Queryable, subject: { type: SubjectType; id: string; projectId: string }) {
  const [r] = await q.query<Record<string, any>>(
    `${REFUND_SELECT} where r.status <> 'rejected' and ((r.subject_type = $1 and r.subject_id = $2) or ($1 <> 'project' and r.subject_type = 'project' and r.project_id = $3))
      order by r.requested_at desc limit 1`,
    [subject.type, subject.id, subject.projectId]
  )
  return r ?? null
}

/**
 * No new billing for something already cancelled: a project with a live whole-project case, or a booking with a
 * live case of its own (or of its project). The case's figures are a snapshot; money billed afterwards would sit
 * outside it.
 */
export async function assertBillable(q: Queryable, projectId: string, booking: { type: string | null; id: string | null } | null) {
  const [c] = await q.query<{ id: string; subject_type: string }>(
    `select id, subject_type from refunds where status <> 'rejected' and project_id = $1
        and (subject_type = 'project' or (subject_type = $2 and subject_id = $3)) limit 1`,
    [projectId, booking?.type ?? null, booking?.id ?? null]
  )
  if (c) {
    throw rule(c.subject_type === 'project'
      ? `Project ini sudah dibatalkan (${c.id}); tagihan baru tidak bisa dibuat. Batalkan kasusnya dulu bila pembatalan keliru.`
      : `Booking ini sudah dibatalkan (${c.id}); tagihan baru tidak bisa dibuat.`)
  }
}
