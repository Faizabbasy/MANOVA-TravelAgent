import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { findAccount } from './accounts'
import {
  EXPENSE_CATEGORIES,
  IN_KINDS,
  isUniqueViolation,
  outflowHeadroom,
  parseMovementAmount,
  rule,
  todayBusinessDate,
  TRANSFER_KINDS,
  type AccountRow,
  type TransactionKind
} from './common'

/**
 * Money-moving commands. Each runs inside the caller's transaction (see withIdempotency) and follows:
 * validate → lock account(s) → check invariants → insert immutable row(s) → audit.
 * Receipts, vendor payments and refund settlements with allocations arrive in Phase 3/5; Phase 2 posts
 * other income, expenses and internal transfers.
 */

const MANUAL_KINDS = ['other_income', 'expense'] as const
export type ManualKind = (typeof MANUAL_KINDS)[number]
const BOOKING_TYPES = ['flight', 'hotel', 'transport', 'mice'] as const

function directionOf(kind: TransactionKind): 'in' | 'out' {
  return (IN_KINDS as readonly string[]).includes(kind) ? 'in' : 'out'
}

function validateEffectiveDate(value: unknown, field = 'effectiveDate'): string {
  if (typeof value !== 'string' || !isIsoDate(value)) throw errors.validation({ [field]: ['Tanggal harus berformat YYYY-MM-DD.'] })
  if (value > todayBusinessDate()) throw errors.validation({ [field]: ['Uang yang sudah terjadi tidak boleh bertanggal di masa depan.'] })
  return value
}

/** Locks the account row and checks it can take a posting dated `effectiveDate`. */
async function lockPostableAccount(tx: Queryable, accountId: string, effectiveDate: string, field = 'bankAccountId'): Promise<AccountRow> {
  if (!ID_PATTERN.test(accountId)) throw errors.validation({ [field]: ['Rekening tidak valid.'] })
  const account = await findAccount(tx, accountId, true)
  if (!account) throw errors.validation({ [field]: ['Rekening tidak ditemukan.'] })
  if (!account.is_active) throw rule(`Rekening ${account.code} nonaktif dan tidak bisa dipakai untuk transaksi baru.`)
  if (account.opening_status !== 'verified' || !account.opening_date) {
    throw new AppError(422, 'OPENING_BALANCE_UNVERIFIED', `Saldo pembuka rekening ${account.code} belum diverifikasi. Transaksi baru bisa dicatat setelah saldo pembuka disetujui.`)
  }
  if (effectiveDate < account.opening_date) {
    throw rule(`Tanggal transaksi sebelum tanggal saldo pembuka ${account.code} (${account.opening_date}). Transaksi sebelum cutover sudah tercakup di saldo pembuka.`)
  }
  return account
}

/** Refuses an outflow that would make the account negative on its date or at any later point. */
async function assertOutflowFits(tx: Queryable, account: AccountRow, date: string, needed: bigint): Promise<void> {
  const headroom = await outflowHeadroom(tx, account, date)
  if (headroom < needed) {
    throw new AppError(422, 'INSUFFICIENT_BALANCE', `Saldo ${account.code} tidak cukup untuk transaksi ini pada tanggal ${date} (atau sesudahnya).`, {
      details: { accountId: account.id, date, balanceMinor: headroom.toString(), requiredMinor: needed.toString() }
    })
  }
}

/** Reversals also move money, so they need an active account (a closed account must be reactivated first). */
function assertActiveForReversal(account: AccountRow | null): AccountRow {
  if (!account) throw errors.notFound('Rekening')
  if (!account.is_active) throw rule(`Rekening ${account.code} nonaktif. Aktifkan kembali rekeningnya sebelum membatalkan transaksi di rekening ini.`)
  return account
}

interface ReferenceIds {
  projectId: string | null
  bookingType: string | null
  bookingId: string | null
  partyId: string | null
  vendorId: string | null
}

/** Validates optional links; a booking implies its project, and a given project must match it. */
async function resolveReferences(
  tx: Queryable,
  input: { projectId?: string; booking?: { type: string; id: string }; partyId?: string; vendorId?: string }
): Promise<ReferenceIds> {
  const fieldErrors: Record<string, string[]> = {}
  let projectId = input.projectId ?? null
  let bookingType: string | null = null
  let bookingId: string | null = null

  if (input.booking) {
    if (!(BOOKING_TYPES as readonly string[]).includes(input.booking.type) || !ID_PATTERN.test(input.booking.id)) {
      fieldErrors.booking = ['Referensi booking tidak valid.']
    } else {
      const [b] = await tx.query<{ project_id: string }>('select project_id from booking_refs where booking_type = $1 and booking_id = $2', [input.booking.type, input.booking.id])
      if (!b) fieldErrors.booking = ['Booking tidak ditemukan.']
      else if (projectId && projectId !== b.project_id) fieldErrors.booking = [`Booking ini milik project ${b.project_id}, bukan ${projectId}.`]
      else {
        projectId = b.project_id
        bookingType = input.booking.type
        bookingId = input.booking.id
      }
    }
  }
  if (projectId && !fieldErrors.booking) {
    const ok = ID_PATTERN.test(projectId) && (await tx.query('select 1 from projects where id = $1', [projectId])).length > 0
    if (!ok) fieldErrors.projectId = ['Project tidak ditemukan.']
  }
  if (input.partyId && !(ID_PATTERN.test(input.partyId) && (await tx.query('select 1 from parties where id = $1', [input.partyId])).length)) {
    fieldErrors.partyId = ['Customer tidak ditemukan.']
  }
  if (input.vendorId && !(ID_PATTERN.test(input.vendorId) && (await tx.query('select 1 from vendors where id = $1', [input.vendorId])).length)) {
    fieldErrors.vendorId = ['Vendor tidak ditemukan.']
  }
  if (Object.keys(fieldErrors).length) throw errors.validation(fieldErrors)
  return { projectId, bookingType, bookingId, partyId: input.partyId ?? null, vendorId: input.vendorId ?? null }
}

const trimOrNull = (v: string | undefined, max = 500) => {
  const t = v?.trim()
  return t ? t.slice(0, max) : null
}

export interface ManualTransactionInput {
  bankAccountId: string
  kind: string
  amountMinor: string
  effectiveDate: string
  category?: string
  projectId?: string
  booking?: { type: string; id: string }
  partyId?: string
  vendorId?: string
  counterparty?: string
  reference?: string
  memo?: string
}

/** Other income (in) or an expense (out). Returns the new transaction id. */
export async function postManualTransaction(tx: Queryable, actor: Actor, input: ManualTransactionInput, requestId: string): Promise<{ transactionId: string }> {
  if (!(MANUAL_KINDS as readonly string[]).includes(input.kind)) {
    throw errors.validation({ kind: ['Jenis harus "other_income" (uang masuk lain) atau "expense" (pengeluaran). Pembayaran invoice dicatat dari menu Piutang/Utang.'] })
  }
  const kind = input.kind as ManualKind
  const amount = parseMovementAmount(input.amountMinor)
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  let category: string | null = null
  if (kind === 'expense') {
    if (!input.category || !(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
      throw errors.validation({ category: [`Kategori pengeluaran wajib: ${EXPENSE_CATEGORIES.join(', ')}.`] })
    }
    category = input.category
  }

  const refs = await resolveReferences(tx, input)
  const account = await lockPostableAccount(tx, input.bankAccountId, effectiveDate)
  const direction = directionOf(kind)
  if (direction === 'out') await assertOutflowFits(tx, account, effectiveDate, amount)

  const [row] = await tx.query<{ id: string }>(
    `insert into financial_transactions
       (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, booking_type, booking_id,
        party_id, vendor_id, counterparty, reference, memo, category, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning id`,
    [account.id, direction, amount.toString(), account.currency, kind, effectiveDate, refs.projectId, refs.bookingType, refs.bookingId,
      refs.partyId, refs.vendorId, trimOrNull(input.counterparty, 200), trimOrNull(input.reference, 120), trimOrNull(input.memo), category, actor.userId]
  )
  await recordAudit(tx, {
    action: 'finance.transaction_posted', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: row!.id, requestId,
    after: { accountId: account.id, direction, kind, amountMinor: amount.toString(), effectiveDate, projectId: refs.projectId }
  })
  return { transactionId: row!.id }
}

interface TxRow extends Record<string, unknown> {
  id: string
  bank_account_id: string
  direction: 'in' | 'out'
  amount_minor: string
  currency: string
  kind: TransactionKind
  project_id: string | null
  booking_type: string | null
  booking_id: string | null
  party_id: string | null
  vendor_id: string | null
  counterparty: string | null
  reference: string | null
  category: string | null
  transfer_id: string | null
  reversal_of_id: string | null
}

async function insertReversal(tx: Queryable, actor: Actor, original: TxRow, reason: string, effectiveDate: string): Promise<string> {
  try {
    const [row] = await tx.query<{ id: string }>(
      `insert into financial_transactions
         (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, booking_type, booking_id,
          party_id, vendor_id, counterparty, reference, memo, category, transfer_id, reversal_of_id, reversal_reason, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) returning id`,
      [original.bank_account_id, original.direction === 'in' ? 'out' : 'in', original.amount_minor, original.currency, original.kind,
        effectiveDate, original.project_id, original.booking_type, original.booking_id, original.party_id, original.vendor_id,
        original.counterparty, original.reference, `Pembatalan ${original.id}`, original.category, original.transfer_id,
        original.id, reason, actor.userId]
    )
    return row!.id
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'ALREADY_REVERSED', `Transaksi ${original.id} sudah dibatalkan sebelumnya.`)
    throw err
  }
}

function validateReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (text.length < 5) throw errors.validation({ reason: ['Tuliskan alasan pembatalan (minimal 5 karakter).'] })
  return text.slice(0, 500)
}

/** Compensating entry: the original stays visible; the reversal moves the same amount the other way, today. */
export async function reverseTransaction(tx: Queryable, actor: Actor, transactionId: string, reasonInput: unknown, requestId: string): Promise<{ reversalId: string }> {
  const reason = validateReason(reasonInput)
  const [original] = await tx.query<TxRow>('select * from financial_transactions where id = $1', [transactionId])
  if (!original) throw errors.notFound('Transaksi')
  if (original.reversal_of_id) throw rule('Transaksi pembatalan tidak bisa dibatalkan lagi.')
  if (TRANSFER_KINDS.includes(original.kind)) throw rule(`Transaksi ini bagian dari transfer ${original.transfer_id}. Batalkan transfernya, bukan satu sisinya.`)
  const [existing] = await tx.query('select id from financial_transactions where reversal_of_id = $1', [transactionId])
  if (existing) throw new AppError(409, 'ALREADY_REVERSED', `Transaksi ${transactionId} sudah dibatalkan sebelumnya.`)

  const today = todayBusinessDate()
  const account = assertActiveForReversal(await findAccount(tx, original.bank_account_id, true))
  // Undoing money that came in takes it out again, today.
  if (original.direction === 'in') await assertOutflowFits(tx, account, today, BigInt(original.amount_minor))
  const reversalId = await insertReversal(tx, actor, original, reason, today)
  await recordAudit(tx, {
    action: 'finance.transaction_reversed', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: transactionId, requestId,
    reason, after: { reversalId, amountMinor: original.amount_minor, direction: original.direction }
  })
  return { reversalId }
}

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  amountMinor: string
  feeMinor?: string
  effectiveDate: string
  memo?: string
}

/** One transfer = out from A + in to B (+ fee out from A), atomically. Company cash changes only by the fee. */
export async function postTransfer(tx: Queryable, actor: Actor, input: TransferInput, requestId: string): Promise<{ transferId: string; transactionIds: string[] }> {
  const amount = parseMovementAmount(input.amountMinor)
  const fee = input.feeMinor === undefined || input.feeMinor === '' ? 0n : parseMovementAmount(input.feeMinor, 'feeMinor', { allowZero: true })
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  if (input.fromAccountId === input.toAccountId) throw errors.validation({ toAccountId: ['Rekening tujuan harus berbeda dari rekening asal.'] })

  // Lock in a stable order so two opposite transfers cannot deadlock.
  const [firstId, secondId] = [input.fromAccountId, input.toAccountId].sort() as [string, string]
  const first = await lockPostableAccount(tx, firstId, effectiveDate, firstId === input.fromAccountId ? 'fromAccountId' : 'toAccountId')
  const second = await lockPostableAccount(tx, secondId, effectiveDate, secondId === input.fromAccountId ? 'fromAccountId' : 'toAccountId')
  const from = first.id === input.fromAccountId ? first : second
  const to = first.id === input.toAccountId ? first : second
  if (from.currency !== to.currency) throw rule('Transfer hanya antar rekening dengan mata uang yang sama.')

  await assertOutflowFits(tx, from, effectiveDate, amount + fee)

  const memo = trimOrNull(input.memo)
  const [transfer] = await tx.query<{ id: string }>(
    `insert into transfers (from_account_id, to_account_id, amount_minor, fee_minor, effective_date, memo, created_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [from.id, to.id, amount.toString(), fee.toString(), effectiveDate, memo, actor.userId]
  )
  const legs: [AccountRow, 'in' | 'out', TransactionKind, bigint, string][] = [
    [from, 'out', 'transfer_out', amount, `Transfer ke ${to.code}`],
    [to, 'in', 'transfer_in', amount, `Transfer dari ${from.code}`]
  ]
  if (fee > 0n) legs.push([from, 'out', 'transfer_fee', fee, `Biaya transfer ke ${to.code}`])

  const transactionIds: string[] = []
  for (const [account, direction, kind, value, label] of legs) {
    const [row] = await tx.query<{ id: string }>(
      `insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, memo, category, transfer_id, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [account.id, direction, value.toString(), account.currency, kind, effectiveDate, memo ? `${label} — ${memo}` : label,
        kind === 'transfer_fee' ? 'bank_fee' : null, transfer!.id, actor.userId]
    )
    transactionIds.push(row!.id)
  }
  await recordAudit(tx, {
    action: 'finance.transfer_posted', actorUserId: actor.userId, entityType: 'transfer', entityId: transfer!.id, requestId,
    after: { fromAccountId: from.id, toAccountId: to.id, amountMinor: amount.toString(), feeMinor: fee.toString(), effectiveDate }
  })
  return { transferId: transfer!.id, transactionIds }
}

/** Reverses every leg of a transfer together (never one side alone). */
export async function reverseTransfer(tx: Queryable, actor: Actor, transferId: string, reasonInput: unknown, requestId: string): Promise<{ reversalIds: string[] }> {
  const reason = validateReason(reasonInput)
  const [transfer] = await tx.query<{ id: string; from_account_id: string; to_account_id: string; amount_minor: string }>(
    'select id, from_account_id, to_account_id, amount_minor from transfers where id = $1', [transferId]
  )
  if (!transfer) throw errors.notFound('Transfer')
  const legs = await tx.query<TxRow>('select * from financial_transactions where transfer_id = $1 and reversal_of_id is null order by id', [transferId])
  const reversed = await tx.query('select 1 from financial_transactions where transfer_id = $1 and reversal_of_id is not null', [transferId])
  if (reversed.length) throw new AppError(409, 'ALREADY_REVERSED', `Transfer ${transferId} sudah dibatalkan sebelumnya.`)

  const [firstId, secondId] = [transfer.from_account_id, transfer.to_account_id].sort() as [string, string]
  assertActiveForReversal(await findAccount(tx, firstId, true))
  assertActiveForReversal(await findAccount(tx, secondId, true))
  const today = todayBusinessDate()
  // Undoing the incoming leg takes money out of the receiving account again, today.
  const to = await findAccount(tx, transfer.to_account_id)
  await assertOutflowFits(tx, to!, today, BigInt(transfer.amount_minor))

  const reversalIds: string[] = []
  for (const leg of legs) reversalIds.push(await insertReversal(tx, actor, leg, reason, today))
  await recordAudit(tx, {
    action: 'finance.transfer_reversed', actorUserId: actor.userId, entityType: 'transfer', entityId: transferId, requestId, reason,
    after: { reversalIds }
  })
  return { reversalIds }
}
