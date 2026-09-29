import type { Queryable } from '../../db/client'
import { AppError } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'

/** Shared rules and row shapes for the Finance money foundation (Phase 2). */

export const IN_KINDS = ['customer_receipt', 'vendor_refund', 'other_income', 'transfer_in'] as const
export const OUT_KINDS = ['vendor_payment', 'refund_settlement', 'expense', 'transfer_out', 'transfer_fee'] as const
export const TRANSACTION_KINDS = [...IN_KINDS, ...OUT_KINDS] as const
export type TransactionKind = (typeof TRANSACTION_KINDS)[number]
export const TRANSFER_KINDS: readonly TransactionKind[] = ['transfer_in', 'transfer_out', 'transfer_fee']

export const EXPENSE_CATEGORIES = ['payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other'] as const

/** Today's business date in Asia/Jakarta — actual cash cannot be dated after this. */
export function todayBusinessDate(): string {
  return businessDateOf(new Date())
}

export interface AccountRow extends Record<string, unknown> {
  id: string
  code: string
  bank_name: string
  holder_name: string
  account_number: string
  currency: string
  is_active: boolean
  opening_status: 'unset' | 'pending' | 'verified'
  opening_balance_minor: string | null
  opening_date: string | null
  opening_note: string | null
  opening_submitted_by: string | null
  opening_submitted_at: Date | null
  opening_verified_by: string | null
  opening_verified_at: Date | null
  provenance: string
  created_at: Date
  updated_at: Date
}

export const ACCOUNT_COLUMNS = `id, code, bank_name, holder_name, account_number, currency, is_active, opening_status,
  opening_balance_minor, opening_date, opening_note, opening_submitted_by, opening_submitted_at,
  opening_verified_by, opening_verified_at, provenance, created_at, updated_at`

/** Net movement (in − out) per account over every posted row, reversals included. */
export async function netMovements(q: Queryable, accountIds?: string[]): Promise<Map<string, bigint>> {
  const params: unknown[] = []
  let where = ''
  if (accountIds) {
    params.push(accountIds)
    where = 'where bank_account_id = any($1::text[])'
  }
  const rows = await q.query<{ bank_account_id: string; net: string }>(
    `select bank_account_id, coalesce(sum(case when direction = 'in' then amount_minor else -amount_minor end), 0)::bigint as net
       from financial_transactions ${where} group by bank_account_id`,
    params
  )
  return new Map(rows.map(r => [r.bank_account_id, BigInt(r.net)]))
}

/** Current balance, or null while the opening balance is not verified (never a fake zero). */
export function currentBalance(account: AccountRow, net: bigint | undefined): bigint | null {
  if (account.opening_status !== 'verified' || account.opening_balance_minor === null) return null
  return BigInt(account.opening_balance_minor) + (net ?? 0n)
}

export function maskAccountNumber(number: string): string {
  const digits = number.replace(/\D/g, '')
  return `•••• ${digits.slice(-4)}`
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

export const rule = (message: string, details?: Record<string, unknown>) =>
  new AppError(422, 'RULE_VIOLATION', message, details ? { details } : {})
