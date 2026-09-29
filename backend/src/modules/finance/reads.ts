import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { isIsoDate } from '../../shared/dates'
import { findAccount } from './accounts'
import { ACCOUNT_COLUMNS, currentBalance, netMovements, rule, todayBusinessDate, TRANSACTION_KINDS, type AccountRow } from './common'

/**
 * Read models computed from financial_transactions — nothing here is stored separately:
 *  - Account Statement: posted movements across accounts, filterable
 *  - Account Ledger:    one account over a period — opening, movements with running balance, closing
 *  - Cash position:     verified cash per account and company total
 */

interface StatementRow extends Record<string, unknown> {
  id: string
  bank_account_id: string
  account_code: string
  bank_name: string
  direction: 'in' | 'out'
  amount_minor: string
  currency: string
  kind: string
  effective_date: string
  posted_at: Date
  project_id: string | null
  project_name: string | null
  booking_type: string | null
  booking_id: string | null
  party_id: string | null
  party_name: string | null
  vendor_id: string | null
  vendor_name: string | null
  counterparty: string | null
  reference: string | null
  memo: string | null
  category: string | null
  transfer_id: string | null
  reversal_of_id: string | null
  reversal_reason: string | null
  reversed_by_id: string | null
  created_by: string
  created_by_name: string
}

const STATEMENT_SELECT = `
  select t.id, t.bank_account_id, a.code as account_code, a.bank_name, t.direction, t.amount_minor, t.currency, t.kind,
         t.effective_date, t.posted_at, t.project_id, p.name as project_name, t.booking_type, t.booking_id,
         t.party_id, pa.name as party_name, t.vendor_id, v.name as vendor_name, t.counterparty, t.reference, t.memo,
         t.category, t.transfer_id, t.reversal_of_id, t.reversal_reason,
         (select r.id from financial_transactions r where r.reversal_of_id = t.id) as reversed_by_id,
         t.created_by, u.name as created_by_name
    from financial_transactions t
    join bank_accounts a on a.id = t.bank_account_id
    join users u on u.id = t.created_by
    left join projects p on p.id = t.project_id
    left join parties pa on pa.id = t.party_id
    left join vendors v on v.id = t.vendor_id`

export function movementDto(r: StatementRow) {
  return {
    id: r.id,
    account: { id: r.bank_account_id, code: r.account_code, bankName: r.bank_name },
    direction: r.direction,
    amountMinor: r.amount_minor,
    currency: r.currency,
    kind: r.kind,
    effectiveDate: r.effective_date,
    postedAt: r.posted_at.toISOString(),
    project: r.project_id ? { id: r.project_id, name: r.project_name } : null,
    booking: r.booking_id ? { type: r.booking_type, id: r.booking_id } : null,
    party: r.party_id ? { id: r.party_id, name: r.party_name } : null,
    vendor: r.vendor_id ? { id: r.vendor_id, name: r.vendor_name } : null,
    counterparty: r.counterparty,
    reference: r.reference,
    memo: r.memo,
    category: r.category,
    transferId: r.transfer_id,
    /** Internal moves between own accounts — excluded from operational in/out totals. */
    isInternalTransfer: r.kind === 'transfer_in' || r.kind === 'transfer_out',
    reversalOfId: r.reversal_of_id,
    reversalReason: r.reversal_reason,
    reversedById: r.reversed_by_id,
    createdBy: { id: r.created_by, name: r.created_by_name }
  }
}

export type MovementDto = ReturnType<typeof movementDto>

function validateRange(from: string | undefined, to: string | undefined, defaults: { from: string; to: string }) {
  const fieldErrors: Record<string, string[]> = {}
  const f = from ?? defaults.from
  const t = to ?? defaults.to
  if (!isIsoDate(f)) fieldErrors.from = ['Tanggal harus berformat YYYY-MM-DD.']
  if (!isIsoDate(t)) fieldErrors.to = ['Tanggal harus berformat YYYY-MM-DD.']
  if (!Object.keys(fieldErrors).length && f > t) fieldErrors.to = ['Tanggal akhir harus sama atau setelah tanggal awal.']
  if (Object.keys(fieldErrors).length) throw errors.validation(fieldErrors)
  return { from: f, to: t }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export interface StatementFilter {
  from?: string
  to?: string
  accountId?: string
  projectId?: string
  direction?: string
  kind?: string
  includeTransfers?: boolean
  cursor?: string
  limit: number
}

/**
 * Stable order = effective date, then posting order. Ids come from a sequence (TRX-000001 …), so
 * (length(id), id) orders them numerically even past TRX-999999, and exactly — no timestamp truncation.
 */
const ORDER_DESC = 't.effective_date desc, length(t.id) desc, t.id desc'
const ORDER_ASC = 't.effective_date, length(t.id), t.id'

function encodeCursor(r: { effective_date: string; id: string }) {
  return Buffer.from(JSON.stringify([r.effective_date, r.id]), 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): [string, string] {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (Array.isArray(parsed) && parsed.length === 2 && isIsoDate(parsed[0]) && ID_PATTERN.test(parsed[1])) {
      return parsed as [string, string]
    }
  } catch {}
  throw errors.validation({ cursor: ['Cursor tidak valid.'] })
}

/** Newest first in a stable order. Totals cover the whole filter, not just the page. */
export async function statement(db: Db, filter: StatementFilter) {
  const today = todayBusinessDate()
  const firstOfMonth = `${today.slice(0, 8)}01`
  const range = validateRange(filter.from, filter.to, { from: firstOfMonth, to: today })
  if (daysBetween(range.from, range.to) > 366) throw errors.validation({ to: ['Rentang maksimal 1 tahun.'] })

  const params: unknown[] = [range.from, range.to]
  const where = ['t.effective_date between $1 and $2']
  const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)) }
  if (filter.accountId) {
    if (!ID_PATTERN.test(filter.accountId)) throw errors.validation({ accountId: ['Rekening tidak valid.'] })
    add('t.bank_account_id = ?', filter.accountId)
  }
  if (filter.projectId) {
    if (!ID_PATTERN.test(filter.projectId)) throw errors.validation({ projectId: ['Project tidak valid.'] })
    add('t.project_id = ?', filter.projectId)
  }
  if (filter.direction) {
    if (filter.direction !== 'in' && filter.direction !== 'out') throw errors.validation({ direction: ['Arah harus "in" atau "out".'] })
    add('t.direction = ?', filter.direction)
  }
  if (filter.kind) {
    if (!(TRANSACTION_KINDS as readonly string[]).includes(filter.kind)) throw errors.validation({ kind: ['Jenis transaksi tidak dikenal.'] })
    add('t.kind = ?', filter.kind)
  }
  if (filter.includeTransfers === false) where.push(`t.kind not in ('transfer_in', 'transfer_out')`)

  const baseWhere = where.join(' and ')
  const [totals] = await db.query<{ in_minor: string; out_minor: string; transfer_in_minor: string; transfer_out_minor: string; voided_count: string; count: string }>(
    // Grouped by kind, not only direction: a reversed transfer leg runs the other way but is still internal.
    // A posting and its reversal cancel out: both stay listed, but neither counts as real in/out flow.
    `select
       coalesce(sum(case when not voided and direction = 'in' and kind not in ('transfer_in', 'transfer_out') then amount_minor end), 0) as in_minor,
       coalesce(sum(case when not voided and direction = 'out' and kind not in ('transfer_in', 'transfer_out') then amount_minor end), 0) as out_minor,
       coalesce(sum(case when not voided and direction = 'in' and kind in ('transfer_in', 'transfer_out') then amount_minor end), 0) as transfer_in_minor,
       coalesce(sum(case when not voided and direction = 'out' and kind in ('transfer_in', 'transfer_out') then amount_minor end), 0) as transfer_out_minor,
       count(*) filter (where voided) as voided_count,
       count(*) as count
     from (
       select t.*, (t.reversal_of_id is not null or exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)) as voided
         from financial_transactions t where ${baseWhere}
     ) t`,
    params
  )

  const pageParams = [...params]
  let pageWhere = baseWhere
  if (filter.cursor) {
    const [date, id] = decodeCursor(filter.cursor)
    pageParams.push(date, id.length, id)
    const n = pageParams.length
    pageWhere += ` and (t.effective_date, length(t.id), t.id) < ($${n - 2}::date, $${n - 1}::int, $${n})`
  }
  pageParams.push(filter.limit + 1)
  const rows = await db.query<StatementRow>(
    `${STATEMENT_SELECT} where ${pageWhere} order by ${ORDER_DESC} limit $${pageParams.length}`,
    pageParams
  )
  const items = rows.slice(0, filter.limit)
  const last = items[items.length - 1]
  return {
    period: range,
    summary: {
      /** Operational in/out: internal transfers and reversed pairs excluded (transfer fees are real outflow and stay in). */
      inMinor: totals!.in_minor,
      outMinor: totals!.out_minor,
      netMinor: (BigInt(totals!.in_minor) - BigInt(totals!.out_minor)).toString(),
      internalTransferInMinor: totals!.transfer_in_minor,
      internalTransferOutMinor: totals!.transfer_out_minor,
      /** Rows that are reversals or have been reversed — listed, but left out of the totals above. */
      reversedCount: Number(totals!.voided_count),
      count: Number(totals!.count)
    },
    items: items.map(movementDto),
    pagination: { limit: filter.limit, nextCursor: rows.length > filter.limit && last ? encodeCursor(last) : null }
  }
}

/** One account over a period: opening + in − out = closing, with a running balance on every row. */
export async function accountLedger(db: Db, accountId: string, query: { from?: string; to?: string }) {
  const account = await findAccount(db, accountId)
  if (!account) throw errors.notFound('Rekening')
  const today = todayBusinessDate()
  const range = validateRange(query.from, query.to, { from: `${today.slice(0, 8)}01`, to: today })
  if (daysBetween(range.from, range.to) > 366) throw errors.validation({ to: ['Rentang maksimal 1 tahun.'] })

  const header = { id: account.id, code: account.code, bankName: account.bank_name, currency: account.currency }
  if (account.opening_status !== 'verified' || !account.opening_date || account.opening_balance_minor === null) {
    return { available: false as const, reason: 'OPENING_BALANCE_UNVERIFIED', account: header, period: range }
  }
  if (range.to < account.opening_date) {
    throw rule(`Periode berakhir sebelum tanggal saldo pembuka (${account.opening_date}). Riwayat sebelum cutover tidak dicatat per transaksi.`)
  }
  // Before the cutover date there is no transaction history; the period starts at the opening date at the earliest.
  const from = range.from < account.opening_date ? account.opening_date : range.from

  const [before] = await db.query<{ net: string }>(
    `select coalesce(sum(case when direction = 'in' then amount_minor else -amount_minor end), 0) as net
       from financial_transactions where bank_account_id = $1 and effective_date < $2`,
    [accountId, from]
  )
  const opening = BigInt(account.opening_balance_minor) + BigInt(before!.net)
  const rows = await db.query<StatementRow>(
    `${STATEMENT_SELECT} where t.bank_account_id = $1 and t.effective_date between $2 and $3 order by ${ORDER_ASC}`,
    [accountId, from, range.to]
  )
  let running = opening
  let totalIn = 0n
  let totalOut = 0n
  const items = rows.map(r => {
    const amount = BigInt(r.amount_minor)
    if (r.direction === 'in') { running += amount; totalIn += amount } else { running -= amount; totalOut += amount }
    return { ...movementDto(r), balanceAfterMinor: running.toString() }
  })
  return {
    available: true as const,
    account: header,
    period: { from, to: range.to, requestedFrom: range.from },
    openingDate: account.opening_date,
    openingMinor: opening.toString(),
    inMinor: totalIn.toString(),
    outMinor: totalOut.toString(),
    closingMinor: running.toString(),
    items
  }
}

/**
 * Company cash today. Unavailable (not zero) while any active account lacks a verified opening balance.
 * Inactive accounts are included whenever they still hold money, so cash can never silently disappear.
 */
export async function cashPosition(db: Queryable) {
  const all = await db.query<AccountRow>(`select ${ACCOUNT_COLUMNS} from bank_accounts order by is_active desc, code`)
  const net = await netMovements(db)
  let total = 0n
  const unverified: string[] = []
  const perAccount = all.flatMap(a => {
    const balance = currentBalance(a, net.get(a.id))
    if (!a.is_active && (balance === null || balance === 0n)) return []
    if (balance === null) unverified.push(a.id)
    else total += balance
    return [{ id: a.id, code: a.code, bankName: a.bank_name, currency: a.currency, isActive: a.is_active, openingStatus: a.opening_status, currentMinor: balance?.toString() ?? null }]
  })
  const accounts = all.filter(a => a.is_active)
  const available = accounts.length > 0 && unverified.length === 0
  return {
    asOf: todayBusinessDate(),
    available,
    reason: accounts.length === 0 ? 'NO_ACCOUNTS' : unverified.length ? 'OPENING_BALANCE_UNVERIFIED' : null,
    /** Sum of verified accounts only; shown as complete only when `available`. */
    totalMinor: total.toString(),
    unverifiedAccountIds: unverified,
    accounts: perAccount
  }
}

export async function getTransaction(db: Db, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Transaksi')
  const [row] = await db.query<StatementRow>(`${STATEMENT_SELECT} where t.id = $1`, [id])
  if (!row) throw errors.notFound('Transaksi')
  return movementDto(row)
}

export async function getTransfer(db: Db, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Transfer')
  const [transfer] = await db.query<{ id: string; from_account_id: string; to_account_id: string; amount_minor: string; fee_minor: string; effective_date: string; memo: string | null; created_by: string; created_at: Date }>(
    'select * from transfers where id = $1', [id]
  )
  if (!transfer) throw errors.notFound('Transfer')
  const legs = await db.query<StatementRow>(`${STATEMENT_SELECT} where t.transfer_id = $1 order by ${ORDER_ASC}`, [id])
  return {
    id: transfer.id,
    fromAccountId: transfer.from_account_id,
    toAccountId: transfer.to_account_id,
    amountMinor: transfer.amount_minor,
    feeMinor: transfer.fee_minor,
    effectiveDate: transfer.effective_date,
    memo: transfer.memo,
    reversed: legs.some(l => l.reversal_of_id !== null),
    createdBy: transfer.created_by,
    createdAt: transfer.created_at.toISOString(),
    legs: legs.map(movementDto)
  }
}
