import type { Db } from '../../db/client'
import { BUSINESS_TIMEZONE } from '../../config/env'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { parseAmountMinor } from '../../shared/money'
import { findAccount } from './accounts'
import { currentBalance, netMovements, todayBusinessDate } from './common'
import { cashPosition } from './reads'

/**
 * Cash Flow v1 (docs/.../07) — a projection of the cash position, never profit or history:
 *
 *   opening[0]   = current cash (verified accounts, every posted movement through today)
 *   incoming     = outstanding issued customer invoices, on their forecast date
 *   outgoing     = outstanding approved vendor invoices + approved refunds not yet paid
 *   closing[n]   = opening[n] + incoming[n] − outgoing[n];  opening[n+1] = closing[n]
 *
 * Forecast date = expected date when set, otherwise the due date. Anything dated today or earlier (overdue,
 * or an expectation already passed) is placed in the first period and keeps its label. Refunds have no
 * date: they are owed now, so they sit in the first period. Posted money is already in the opening balance
 * and no longer outstanding, so nothing is counted twice. Labels (confirmed/expected/overdue) are for
 * transparency only — amounts are never weighted.
 */

export const HORIZONS = ['30d', '3m', '6m', '12m'] as const
export type Horizon = (typeof HORIZONS)[number]
const MONTHS: Record<Exclude<Horizon, '30d'>, number> = { '3m': 3, '6m': 6, '12m': 12 }

export type Certainty = 'confirmed' | 'expected' | 'overdue'
export type SourceType = 'customer_invoice' | 'vendor_invoice' | 'refund'

export interface Period { startDate: string; endDate: string; kind: 'week' | 'rest_of_month' | 'month' }

// ── Calendar arithmetic on YYYY-MM-DD business dates (UTC math, no time zone involved) ──────────────────

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function endOfMonth(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

/**
 * 30d: 30 calendar days from tomorrow in weekly buckets (the last one is shorter).
 * Nm:  the rest of the current month (when any is left), then N full calendar months.
 */
export function buildPeriods(asOf: string, horizon: Horizon): Period[] {
  const start = addDays(asOf, 1)
  const out: Period[] = []
  if (horizon === '30d') {
    const end = addDays(asOf, 30)
    for (let s = start; s <= end;) {
      const weekEnd = addDays(s, 6)
      const e = weekEnd < end ? weekEnd : end
      out.push({ startDate: s, endDate: e, kind: 'week' })
      s = addDays(e, 1)
    }
    return out
  }
  let s = start
  if (s.slice(0, 7) === asOf.slice(0, 7)) {
    out.push({ startDate: s, endDate: endOfMonth(s), kind: 'rest_of_month' })
    s = addDays(endOfMonth(s), 1)
  }
  for (let i = 0; i < MONTHS[horizon]; i++) {
    out.push({ startDate: s, endDate: endOfMonth(s), kind: 'month' })
    s = addDays(endOfMonth(s), 1)
  }
  return out
}

// ── Pure projection (unit-tested with the numeric acceptance example) ──────────────────────────────────

export interface ForecastItem {
  key: string
  direction: 'in' | 'out'
  amount: bigint
  /** Already placed: never before the first period. */
  forecastDate: string
  certainty: Certainty
  disputed: boolean
}

export interface ProjectedRow extends Period {
  openingMinor: bigint
  incomingMinor: bigint
  outgoingMinor: bigint
  closingMinor: bigint
  /** Lowest end-of-day balance inside the period (a gap can open and close within a month). */
  lowestMinor: bigint
  lowestDate: string
  split: Record<`${'in' | 'out'}_${Certainty}`, bigint>
}

export interface DayPoint { date: string; balance: bigint }

export function project(opening: bigint, periods: Period[], items: ForecastItem[]) {
  const byDate = new Map<string, bigint>()
  for (const i of items) byDate.set(i.forecastDate, (byDate.get(i.forecastDate) ?? 0n) + (i.direction === 'in' ? i.amount : -i.amount))

  let running = opening
  const days: DayPoint[] = []
  const rows: ProjectedRow[] = periods.map((p) => {
    const inPeriod = items.filter(i => i.forecastDate >= p.startDate && i.forecastDate <= p.endDate)
    const split = { in_confirmed: 0n, in_expected: 0n, in_overdue: 0n, out_confirmed: 0n, out_expected: 0n, out_overdue: 0n }
    for (const i of inPeriod) split[`${i.direction}_${i.certainty}`] += i.amount
    const rowOpening = running
    let lowest: DayPoint | null = null
    for (let d = p.startDate; d <= p.endDate; d = addDays(d, 1)) {
      running += byDate.get(d) ?? 0n
      days.push({ date: d, balance: running })
      if (!lowest || running < lowest.balance) lowest = { date: d, balance: running }
    }
    const incoming = split.in_confirmed + split.in_expected + split.in_overdue
    const outgoing = split.out_confirmed + split.out_expected + split.out_overdue
    return {
      ...p,
      openingMinor: rowOpening,
      incomingMinor: incoming,
      outgoingMinor: outgoing,
      closingMinor: rowOpening + incoming - outgoing,
      lowestMinor: lowest!.balance,
      lowestDate: lowest!.date,
      split
    }
  })
  return { rows, days, closing: running }
}

/** First day the balance drops below `threshold`, and the lowest point of the whole horizon. */
export function firstBelow(days: DayPoint[], threshold: bigint): DayPoint | null {
  return days.find(d => d.balance < threshold) ?? null
}

/** The largest outflows dated up to `date` — what to look at first when a gap appears. */
function topOutflows(items: ForecastItem[], date: string, n = 3) {
  return items
    .filter(i => i.direction === 'out' && i.forecastDate <= date)
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : a.key.localeCompare(b.key)))
    .slice(0, n)
    .map(i => i.key)
}

// ── Reading the obligations ─────────────────────────────────────────────────────────────────────────────

interface SourceRow extends Record<string, unknown> {
  source: SourceType
  id: string
  reference: string
  counterparty: string
  project_id: string | null
  project_name: string | null
  booking_type: string | null
  booking_id: string | null
  due_date: string | null
  expected_date: string | null
  disputed: boolean
  outstanding_minor: string
}

async function openObligations(db: Db, projectId: string | null): Promise<SourceRow[]> {
  const params = projectId ? [projectId] : []
  const scope = (col: string) => (projectId ? ` and ${col} = $1` : '')
  const receivables = await db.query<SourceRow>(
    `select 'customer_invoice' as source, i.id, i.number as reference, pa.name as counterparty, i.project_id, p.name as project_name,
            i.booking_type, i.booking_id, i.due_date, i.expected_date, i.is_disputed as disputed,
            (b.total_minor - b.paid_minor - b.credited_minor) as outstanding_minor
       from customer_invoices i
       join v_customer_invoice_balances b on b.invoice_id = i.id
       join parties pa on pa.id = i.party_id
       join projects p on p.id = i.project_id
      where i.status = 'issued' and b.total_minor - b.paid_minor - b.credited_minor > 0${scope('i.project_id')}`,
    params
  )
  const payables = await db.query<SourceRow>(
    `select 'vendor_invoice' as source, v.id, v.vendor_invoice_number as reference, ve.name as counterparty, v.project_id, p.name as project_name,
            v.booking_type, v.booking_id, v.due_date, v.expected_date, (v.match_status = 'disputed') as disputed,
            (b.total_minor - b.paid_minor) as outstanding_minor
       from vendor_invoices v
       join v_vendor_invoice_balances b on b.vendor_invoice_id = v.id
       join vendors ve on ve.id = v.vendor_id
       left join projects p on p.id = v.project_id
      where v.status = 'approved' and b.total_minor - b.paid_minor > 0${scope('v.project_id')}`,
    params
  )
  const refunds = await db.query<SourceRow>(
    `select 'refund' as source, r.id, r.id as reference, pa.name as counterparty, r.project_id, p.name as project_name,
            case when r.subject_type = 'project' then null else r.subject_type end as booking_type,
            case when r.subject_type = 'project' then null else r.subject_id end as booking_id,
            null as due_date, null as expected_date, false as disputed,
            (b.refundable_minor - b.settled_minor) as outstanding_minor
       from refunds r
       join v_refund_balances b on b.refund_id = r.id
       join parties pa on pa.id = r.party_id
       join projects p on p.id = r.project_id
      where r.status = 'approved' and b.refundable_minor - b.settled_minor > 0${scope('r.project_id')}`,
    params
  )
  return [...receivables, ...payables, ...refunds]
}

type ExcludedCode = 'draft_invoices' | 'planned_billing' | 'vendor_invoices_in_review' | 'refunds_awaiting_decision'
  | 'customer_advances' | 'vendor_deposits' | 'incoming_after_horizon' | 'outgoing_after_horizon'

interface Excluded { code: ExcludedCode; direction: 'in' | 'out' | null; count: number; amountMinor: string }

/** Money that is real or planned but deliberately NOT in the projection — shown so nothing is hidden. */
async function excludedFigures(db: Db, projectId: string | null): Promise<Excluded[]> {
  const params = projectId ? [projectId] : []
  const scope = (col: string) => (projectId ? ` and ${col} = $1` : '')
  const [row] = await db.query<Record<string, string>>(
    `select
       (select count(*) from customer_invoices where status = 'draft'${scope('project_id')}) as draft_n,
       (select coalesce(sum(total_minor), 0) from customer_invoices where status = 'draft'${scope('project_id')}) as draft_sum,
       (select count(*) from billing_schedule_items where status = 'planned'${scope('project_id')}) as plan_n,
       (select coalesce(sum(amount_minor), 0) from billing_schedule_items where status = 'planned'${scope('project_id')}) as plan_sum,
       (select count(*) from vendor_invoices where status in ('submitted', 'under_review')${scope('project_id')}) as review_n,
       (select coalesce(sum(total_minor), 0) from vendor_invoices where status in ('submitted', 'under_review')${scope('project_id')}) as review_sum,
       (select count(*) from refunds where status = 'requested'${scope('project_id')}) as refund_n,
       (select coalesce(sum(refundable_minor), 0) from refunds where status = 'requested'${scope('project_id')}) as refund_sum,
       (select count(*) from v_unallocated_payments where kind = 'customer_receipt' and unallocated_minor > 0${scope('project_id')}) as adv_n,
       (select coalesce(sum(unallocated_minor), 0) from v_unallocated_payments where kind = 'customer_receipt' and unallocated_minor > 0${scope('project_id')}) as adv_sum,
       (select count(*) from v_unallocated_payments where kind = 'vendor_payment' and unallocated_minor > 0${scope('project_id')}) as dep_n,
       (select coalesce(sum(unallocated_minor), 0) from v_unallocated_payments where kind = 'vendor_payment' and unallocated_minor > 0${scope('project_id')}) as dep_sum`,
    params
  )
  const r = row!
  const all: Excluded[] = [
    { code: 'draft_invoices', direction: 'in', count: Number(r.draft_n), amountMinor: r.draft_sum! },
    { code: 'planned_billing', direction: 'in', count: Number(r.plan_n), amountMinor: r.plan_sum! },
    { code: 'vendor_invoices_in_review', direction: 'out', count: Number(r.review_n), amountMinor: r.review_sum! },
    { code: 'refunds_awaiting_decision', direction: 'out', count: Number(r.refund_n), amountMinor: r.refund_sum! },
    { code: 'customer_advances', direction: null, count: Number(r.adv_n), amountMinor: r.adv_sum! },
    { code: 'vendor_deposits', direction: null, count: Number(r.dep_n), amountMinor: r.dep_sum! }
  ]
  return all.filter(e => e.count > 0)
}

// ── The endpoint ────────────────────────────────────────────────────────────────────────────────────────

export interface CashFlowQuery { horizon?: string; projectId?: string; accountId?: string; minimumCashMinor?: string }

const ASSUMPTIONS = {
  /** Forecast date = expected date when set, otherwise due date. */
  dateRule: 'expected_else_due',
  /** Overdue and past-expected items are placed in the first period, labelled. */
  pastDueToFirstPeriod: true,
  /** Approved, unpaid refunds are owed now: first period. */
  refundsInFirstPeriod: true,
  /** Disputed customer invoices stay in, with their own subtotal. */
  disputedIncluded: true,
  /** Customer advances / vendor deposits are already in cash and are not netted against invoices. */
  advancesNotNetted: true,
  /** Amounts are never weighted by probability. */
  noProbabilityWeighting: true
} as const

export async function cashFlow(db: Db, query: CashFlowQuery) {
  const horizon = (query.horizon ?? '3m') as Horizon
  const fieldErrors: Record<string, string[]> = {}
  if (!HORIZONS.includes(horizon)) fieldErrors.horizon = ['Pilihan: 30d, 3m, 6m, atau 12m.']
  if (query.projectId && !ID_PATTERN.test(query.projectId)) fieldErrors.projectId = ['Project tidak valid.']
  if (query.accountId && !ID_PATTERN.test(query.accountId)) fieldErrors.accountId = ['Rekening tidak valid.']
  if (query.projectId && query.accountId) fieldErrors.accountId = ['Pilih salah satu: filter project atau filter rekening.']
  if (Object.keys(fieldErrors).length) throw errors.validation(fieldErrors)
  // Optional low-cash floor chosen by the viewer (no stored setting yet).
  const floor = query.minimumCashMinor ? parseAmountMinor(query.minimumCashMinor, 'minimumCashMinor', { allowZero: true }) : null

  const asOf = todayBusinessDate()
  const periods = buildPeriods(asOf, horizon)
  const periodStart = periods[0]!.startDate
  const periodEnd = periods[periods.length - 1]!.endDate
  const base = { asOf, timezone: BUSINESS_TIMEZONE, horizon, periodStart, periodEnd }

  // Scope and opening balance.
  let scope: { type: 'company' | 'account' | 'project'; id: string | null; name: string | null }
  let opening: bigint
  let openingBasis: 'company_cash' | 'account_cash' | 'zero_net_flow'
  if (query.projectId) {
    const [p] = await db.query<{ id: string; name: string }>('select id, name from projects where id = $1', [query.projectId])
    if (!p) throw errors.notFound('Project')
    scope = { type: 'project', id: p.id, name: p.name }
    // A project has no bank account of its own: its line is the net flow, starting from zero.
    opening = 0n
    openingBasis = 'zero_net_flow'
  } else if (query.accountId) {
    const account = await findAccount(db, query.accountId)
    if (!account) throw errors.notFound('Rekening')
    scope = { type: 'account', id: account.id, name: account.code }
    const balance = currentBalance(account, (await netMovements(db, [account.id])).get(account.id))
    if (balance === null) {
      return { ...base, available: false as const, scope, reason: 'OPENING_BALANCE_UNVERIFIED' as const, missingAccounts: [{ id: account.id, code: account.code }] }
    }
    opening = balance
    openingBasis = 'account_cash'
  } else {
    scope = { type: 'company', id: null, name: null }
    const cash = await cashPosition(db)
    if (!cash.available) {
      return {
        ...base,
        available: false as const,
        scope,
        reason: (cash.reason ?? 'OPENING_BALANCE_UNVERIFIED') as 'NO_ACCOUNTS' | 'OPENING_BALANCE_UNVERIFIED',
        missingAccounts: cash.accounts.filter(a => cash.unverifiedAccountIds.includes(a.id)).map(a => ({ id: a.id, code: a.code }))
      }
    }
    opening = BigInt(cash.totalMinor)
    openingBasis = 'company_cash'
  }

  // Place every open obligation.
  const sources = await openObligations(db, scope.type === 'project' ? scope.id : null)
  const placed = sources.map((s) => {
    const planned = s.expected_date ?? s.due_date ?? periodStart
    const certainty: Certainty = s.due_date !== null && s.due_date < asOf ? 'overdue' : s.expected_date !== null ? 'expected' : 'confirmed'
    const forecastDate = planned <= asOf ? periodStart : planned
    return { s, certainty, forecastDate, movedToFirstPeriod: planned <= asOf || s.source === 'refund' }
  })
  const inHorizon = placed.filter(p => p.forecastDate <= periodEnd)
  const after = placed.filter(p => p.forecastDate > periodEnd)

  // Obligations carry no bank account yet: on an account view they are listed, but not counted.
  const counted = scope.type === 'account' ? [] : inHorizon
  const items: ForecastItem[] = counted.map(p => ({
    key: `${p.s.source}:${p.s.id}`,
    direction: p.s.source === 'customer_invoice' ? 'in' : 'out',
    amount: BigInt(p.s.outstanding_minor),
    forecastDate: p.forecastDate,
    certainty: p.certainty,
    disputed: p.s.disputed
  }))
  const projection = project(opening, periods, items)

  const periodIndexOf = (date: string) => periods.findIndex(p => date >= p.startDate && date <= p.endDate)
  const sum = (list: typeof placed, pred: (p: (typeof placed)[number]) => boolean) =>
    list.filter(pred).reduce((acc, p) => acc + BigInt(p.s.outstanding_minor), 0n)
  const isIn = (p: (typeof placed)[number]) => p.s.source === 'customer_invoice'

  // Warnings (advisory only). A project's net flow is not cash, so no gap is claimed for it.
  const warnings: Record<string, unknown>[] = []
  if (scope.type !== 'project') {
    const gap = firstBelow(projection.days, 0n)
    const lowest = projection.days.reduce<DayPoint | null>((m, d) => (!m || d.balance < m.balance ? d : m), null)
    if (gap) {
      warnings.push({
        code: 'CASH_GAP', date: gap.date, balanceMinor: gap.balance.toString(),
        lowestDate: lowest!.date, lowestMinor: lowest!.balance.toString(), contributors: topOutflows(items, gap.date)
      })
    }
    if (floor !== null && floor > 0n) {
      const low = firstBelow(projection.days, floor)
      if (low && (!gap || low.date < gap.date)) {
        warnings.push({ code: 'LOW_CASH', date: low.date, balanceMinor: low.balance.toString(), floorMinor: floor.toString(), contributors: topOutflows(items, low.date) })
      }
    }
  }
  const overdueIn = counted.filter(p => isIn(p) && p.certainty === 'overdue')
  if (overdueIn.length) warnings.push({ code: 'OVERDUE_INCOMING', count: overdueIn.length, amountMinor: sum(overdueIn, () => true).toString() })
  const disputedIn = counted.filter(p => isIn(p) && p.s.disputed)
  if (disputedIn.length) warnings.push({ code: 'DISPUTED_INCOMING', count: disputedIn.length, amountMinor: sum(disputedIn, () => true).toString() })

  const excluded: Excluded[] = await excludedFigures(db, scope.type === 'project' ? scope.id : null)
  const afterIn = after.filter(isIn)
  const afterOut = after.filter(p => !isIn(p))
  if (afterIn.length) excluded.push({ code: 'incoming_after_horizon', direction: 'in', count: afterIn.length, amountMinor: sum(afterIn, () => true).toString() })
  if (afterOut.length) excluded.push({ code: 'outgoing_after_horizon', direction: 'out', count: afterOut.length, amountMinor: sum(afterOut, () => true).toString() })

  const totalIn = projection.rows.reduce((s, r) => s + r.incomingMinor, 0n)
  const totalOut = projection.rows.reduce((s, r) => s + r.outgoingMinor, 0n)
  const splitTotal = (key: keyof ProjectedRow['split']) => projection.rows.reduce((s, r) => s + r.split[key], 0n).toString()
  const sortKey = (p: (typeof placed)[number]) => `${p.forecastDate}|${isIn(p) ? 0 : 1}|${p.s.id.length.toString().padStart(3, '0')}|${p.s.id}`

  return {
    ...base,
    available: true as const,
    scope,
    openingBasis,
    openingCashMinor: opening.toString(),
    closingMinor: projection.closing.toString(),
    totals: {
      incomingMinor: totalIn.toString(),
      outgoingMinor: totalOut.toString(),
      netMinor: (totalIn - totalOut).toString(),
      confirmedIncomingMinor: splitTotal('in_confirmed'),
      expectedIncomingMinor: splitTotal('in_expected'),
      overdueIncomingMinor: splitTotal('in_overdue'),
      confirmedOutgoingMinor: splitTotal('out_confirmed'),
      expectedOutgoingMinor: splitTotal('out_expected'),
      overdueOutgoingMinor: splitTotal('out_overdue'),
      disputedIncomingMinor: sum(counted, p => isIn(p) && p.s.disputed).toString(),
      refundOutgoingMinor: sum(counted, p => p.s.source === 'refund').toString()
    },
    rows: projection.rows.map(r => ({
      startDate: r.startDate,
      endDate: r.endDate,
      kind: r.kind,
      openingMinor: r.openingMinor.toString(),
      incomingMinor: r.incomingMinor.toString(),
      outgoingMinor: r.outgoingMinor.toString(),
      closingMinor: r.closingMinor.toString(),
      lowestMinor: r.lowestMinor.toString(),
      lowestDate: r.lowestDate,
      confirmedIncomingMinor: r.split.in_confirmed.toString(),
      expectedIncomingMinor: r.split.in_expected.toString(),
      overdueIncomingMinor: r.split.in_overdue.toString(),
      confirmedOutgoingMinor: r.split.out_confirmed.toString(),
      expectedOutgoingMinor: r.split.out_expected.toString(),
      overdueOutgoingMinor: r.split.out_overdue.toString()
    })),
    /** Drill-down: every obligation inside the horizon. On an account view `counted` is false (no account assigned). */
    items: [...inHorizon].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).map(p => ({
      source: p.s.source,
      id: p.s.id,
      reference: p.s.reference,
      counterparty: p.s.counterparty,
      project: p.s.project_id ? { id: p.s.project_id, name: p.s.project_name } : null,
      booking: p.s.booking_id ? { type: p.s.booking_type, id: p.s.booking_id } : null,
      direction: isIn(p) ? 'in' as const : 'out' as const,
      amountMinor: p.s.outstanding_minor,
      dueDate: p.s.due_date,
      expectedDate: p.s.expected_date,
      forecastDate: p.forecastDate,
      certainty: p.certainty,
      disputed: p.s.disputed,
      movedToFirstPeriod: p.movedToFirstPeriod,
      periodIndex: periodIndexOf(p.forecastDate),
      counted: scope.type !== 'account'
    })),
    unassigned: scope.type === 'account'
      ? {
          count: inHorizon.length,
          incomingMinor: sum(inHorizon, isIn).toString(),
          outgoingMinor: sum(inHorizon, p => !isIn(p)).toString()
        }
      : null,
    warnings,
    excluded,
    assumptions: ASSUMPTIONS
  }
}
