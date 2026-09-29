import type { Db, Queryable } from '../../db/client'
import { BUSINESS_TIMEZONE } from '../../config/env'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { parseAmountMinor } from '../../shared/money'
import { findAccount } from './accounts'
import { businessDateOf } from '../../shared/dates'
import { currentBalance, netMovements } from './common'
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
 * and no longer outstanding, so nothing is counted twice; for the same reason a customer's unallocated
 * advance reduces that customer's expected receipts. Labels (confirmed/expected/overdue) are for
 * transparency only — amounts are never weighted. All reads share one repeatable-read snapshot.
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

// ── Warnings (pure) ─────────────────────────────────────────────────────────────────────────────────────

export type CashWarning =
  | { code: 'CASH_GAP'; date: string; balanceMinor: string; lowestDate: string; lowestMinor: string; contributors: string[] }
  | { code: 'LOW_CASH'; date: string; balanceMinor: string; floorMinor: string; contributors: string[] }

/**
 * First day the balance is negative (and the lowest point), and — separately — first day under the optional
 * floor. Today's balance counts too: a balance that is already negative is reported from `asOf`.
 */
export function detectWarnings(opening: bigint, asOf: string, days: DayPoint[], items: ForecastItem[], floor: bigint | null): CashWarning[] {
  const timeline: DayPoint[] = [{ date: asOf, balance: opening }, ...days]
  const out: CashWarning[] = []
  const gap = firstBelow(timeline, 0n)
  if (gap) {
    const lowest = timeline.reduce((m, d) => (d.balance < m.balance ? d : m))
    out.push({
      code: 'CASH_GAP', date: gap.date, balanceMinor: gap.balance.toString(),
      lowestDate: lowest.date, lowestMinor: lowest.balance.toString(), contributors: topOutflows(items, gap.date)
    })
  }
  if (floor !== null && floor > 0n) {
    const low = firstBelow(timeline, floor)
    if (low) out.push({ code: 'LOW_CASH', date: low.date, balanceMinor: low.balance.toString(), floorMinor: floor.toString(), contributors: topOutflows(items, low.date) })
  }
  return out
}

/**
 * Customer advances (receipts not yet matched to an invoice) are already in cash. Counting the same
 * customer's open invoices in full would count that money twice, so the pool is applied to the customer's
 * invoices, earliest forecast first (in a project view only advances booked on that project). Vendor
 * deposits are not netted: that would lower the outflows, and the projection stays on the cautious side.
 */
export function applyAdvances<T extends { party: string | null; outstanding: bigint; order: string }>(
  invoices: T[], pools: Map<string, bigint>
): { applied: Map<T, bigint>; remaining: Map<string, bigint> } {
  const remaining = new Map(pools)
  const applied = new Map<T, bigint>()
  for (const inv of [...invoices].sort((a, b) => a.order.localeCompare(b.order))) {
    if (!inv.party) continue
    const pool = remaining.get(inv.party) ?? 0n
    if (pool <= 0n) continue
    const use = pool < inv.outstanding ? pool : inv.outstanding
    applied.set(inv, use)
    remaining.set(inv.party, pool - use)
  }
  return { applied, remaining }
}

// ── Reading the obligations ─────────────────────────────────────────────────────────────────────────────

interface SourceRow extends Record<string, unknown> {
  source: SourceType
  id: string
  reference: string
  counterparty: string
  party_id: string | null
  project_id: string | null
  project_name: string | null
  booking_type: string | null
  booking_id: string | null
  due_date: string | null
  expected_date: string | null
  disputed: boolean
  outstanding_minor: string
}

async function openObligations(q: Queryable, projectId: string | null): Promise<SourceRow[]> {
  const params = projectId ? [projectId] : []
  const scope = (col: string) => (projectId ? ` and ${col} = $1` : '')
  const receivables = await q.query<SourceRow>(
    `select 'customer_invoice' as source, i.id, i.number as reference, pa.name as counterparty, i.party_id, i.project_id, p.name as project_name,
            i.booking_type, i.booking_id, i.due_date, i.expected_date, i.is_disputed as disputed,
            (b.total_minor - b.paid_minor - b.credited_minor) as outstanding_minor
       from customer_invoices i
       join v_customer_invoice_balances b on b.invoice_id = i.id
       join parties pa on pa.id = i.party_id
       join projects p on p.id = i.project_id
      where i.status = 'issued' and b.total_minor - b.paid_minor - b.credited_minor > 0${scope('i.project_id')}`,
    params
  )
  const payables = await q.query<SourceRow>(
    `select 'vendor_invoice' as source, v.id, v.vendor_invoice_number as reference, ve.name as counterparty, null as party_id, v.project_id, p.name as project_name,
            v.booking_type, v.booking_id, v.due_date, v.expected_date, (v.match_status = 'disputed') as disputed,
            (b.total_minor - b.paid_minor) as outstanding_minor
       from vendor_invoices v
       join v_vendor_invoice_balances b on b.vendor_invoice_id = v.id
       join vendors ve on ve.id = v.vendor_id
       left join projects p on p.id = v.project_id
      where v.status = 'approved' and b.total_minor - b.paid_minor > 0${scope('v.project_id')}`,
    params
  )
  const refunds = await q.query<SourceRow>(
    `select 'refund' as source, r.id, r.id as reference, pa.name as counterparty, r.party_id, r.project_id, p.name as project_name,
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

/** Unallocated customer receipts per customer (reversed receipts are not in the view). */
async function advancePools(q: Queryable, projectId: string | null): Promise<{ pools: Map<string, bigint>; count: number }> {
  const rows = await q.query<{ party_id: string | null; total: string; n: string }>(
    `select party_id, sum(unallocated_minor) as total, count(*) as n from v_unallocated_payments
      where kind = 'customer_receipt' and unallocated_minor > 0${projectId ? ' and project_id = $1' : ''}
      group by party_id`,
    projectId ? [projectId] : []
  )
  const pools = new Map<string, bigint>()
  let count = 0
  for (const r of rows) {
    count += Number(r.n)
    // A receipt without a customer cannot be matched to anyone's invoice; it stays "not counted".
    pools.set(r.party_id ?? '', BigInt(r.total))
  }
  return { pools, count }
}

type ExcludedCode = 'draft_invoices' | 'planned_billing' | 'vendor_invoices_in_review' | 'refunds_awaiting_decision'
  | 'customer_advances' | 'vendor_deposits' | 'incoming_after_horizon' | 'outgoing_after_horizon'

interface Excluded {
  code: ExcludedCode
  direction: 'in' | 'out' | null
  count: number
  amountMinor: string
  /** Cases whose amount is not set yet (manual refund cases before Finance decides). */
  undeterminedCount?: number
}

/** Money that is real or planned but deliberately NOT in the projection — shown so nothing is hidden. */
async function excludedFigures(q: Queryable, projectId: string | null): Promise<Excluded[]> {
  const params = projectId ? [projectId] : []
  const scope = (col: string) => (projectId ? ` and ${col} = $1` : '')
  const [row] = await q.query<Record<string, string>>(
    `select
       (select count(*) from customer_invoices where status = 'draft'${scope('project_id')}) as draft_n,
       (select coalesce(sum(total_minor), 0) from customer_invoices where status = 'draft'${scope('project_id')}) as draft_sum,
       (select count(*) from billing_schedule_items where status = 'planned'${scope('project_id')}) as plan_n,
       (select coalesce(sum(amount_minor), 0) from billing_schedule_items where status = 'planned'${scope('project_id')}) as plan_sum,
       (select count(*) from vendor_invoices where status in ('submitted', 'under_review')${scope('project_id')}) as review_n,
       (select coalesce(sum(total_minor), 0) from vendor_invoices where status in ('submitted', 'under_review')${scope('project_id')}) as review_sum,
       (select count(*) from refunds where status = 'requested'${scope('project_id')}) as refund_n,
       (select coalesce(sum(refundable_minor), 0) from refunds where status = 'requested'${scope('project_id')}) as refund_sum,
       (select count(*) from refunds where status = 'requested' and calculation = 'manual' and refundable_minor = 0${scope('project_id')}) as refund_open_n,
       (select count(*) from v_unallocated_payments where kind = 'vendor_payment' and unallocated_minor > 0${scope('project_id')}) as dep_n,
       (select coalesce(sum(unallocated_minor), 0) from v_unallocated_payments where kind = 'vendor_payment' and unallocated_minor > 0${scope('project_id')}) as dep_sum`,
    params
  )
  const r = row!
  const all: Excluded[] = [
    { code: 'draft_invoices', direction: 'in', count: Number(r.draft_n), amountMinor: r.draft_sum! },
    { code: 'planned_billing', direction: 'in', count: Number(r.plan_n), amountMinor: r.plan_sum! },
    { code: 'vendor_invoices_in_review', direction: 'out', count: Number(r.review_n), amountMinor: r.review_sum! },
    { code: 'refunds_awaiting_decision', direction: 'out', count: Number(r.refund_n), amountMinor: r.refund_sum!, undeterminedCount: Number(r.refund_open_n) },
    { code: 'vendor_deposits', direction: null, count: Number(r.dep_n), amountMinor: r.dep_sum! }
  ]
  return all.filter(e => e.count > 0)
}

// ── The endpoint ────────────────────────────────────────────────────────────────────────────────────────

export interface CashFlowQuery { horizon?: string; projectId?: string; accountId?: string; minimumCashMinor?: string }

const ASSUMPTIONS = {
  /** Forecast date = expected date when set, otherwise due date. */
  dateRule: 'expected_else_due',
  /** Anything dated today or earlier (overdue without a new expected date, or a passed expectation) goes to the first period. */
  pastDatesToFirstPeriod: true,
  /** Approved, unpaid refunds are owed now: first period. */
  refundsInFirstPeriod: true,
  /** Disputed customer invoices stay in, with their own subtotal. */
  disputedIncluded: true,
  /** Unallocated customer advances reduce the same customer's expected receipts (already in cash). */
  customerAdvancesNetted: true,
  /** Vendor deposits are not netted against vendor invoices (cautious). */
  vendorDepositsNotNetted: true,
  /** Amounts are never weighted by probability. */
  noProbabilityWeighting: true,
  /** v1 always projects from today (business date, Asia/Jakarta); a past `asOf` would need point-in-time balances. */
  asOfIsToday: true
} as const

export async function cashFlow(db: Db, query: CashFlowQuery, now: Date = new Date()) {
  const horizon = (query.horizon ?? '3m') as Horizon
  const fieldErrors: Record<string, string[]> = {}
  if (!HORIZONS.includes(horizon)) fieldErrors.horizon = ['Pilihan: 30d, 3m, 6m, atau 12m.']
  if (query.projectId && !ID_PATTERN.test(query.projectId)) fieldErrors.projectId = ['Project tidak valid.']
  if (query.accountId && !ID_PATTERN.test(query.accountId)) fieldErrors.accountId = ['Rekening tidak valid.']
  if (query.projectId && query.accountId) fieldErrors.accountId = ['Pilih salah satu: filter project atau filter rekening.']
  if (Object.keys(fieldErrors).length) throw errors.validation(fieldErrors)
  // Optional low-cash floor chosen by the viewer (no stored setting yet).
  const floor = query.minimumCashMinor ? parseAmountMinor(query.minimumCashMinor, 'minimumCashMinor', { allowZero: true }) : null

  const asOf = businessDateOf(now)
  const periods = buildPeriods(asOf, horizon)
  const periodStart = periods[0]!.startDate
  const periodEnd = periods[periods.length - 1]!.endDate
  const base = { asOf, timezone: BUSINESS_TIMEZONE, horizon, periodStart, periodEnd }

  // One consistent snapshot: cash and obligations must not straddle a posting committed in between.
  return db.transaction(async (q) => {
    await q.query('set transaction isolation level repeatable read')

    // Scope and opening balance.
    let scope: { type: 'company' | 'account' | 'project'; id: string | null; name: string | null }
    let opening: bigint
    let openingBasis: 'company_cash' | 'account_cash' | 'zero_net_flow'
    if (query.projectId) {
      const [p] = await q.query<{ id: string; name: string }>('select id, name from projects where id = $1', [query.projectId])
      if (!p) throw errors.notFound('Project')
      scope = { type: 'project', id: p.id, name: p.name }
      // A project has no bank account of its own: its line is the net flow, starting from zero.
      opening = 0n
      openingBasis = 'zero_net_flow'
    } else if (query.accountId) {
      const account = await findAccount(q, query.accountId)
      if (!account) throw errors.notFound('Rekening')
      scope = { type: 'account', id: account.id, name: account.code }
      const balance = currentBalance(account, (await netMovements(q, [account.id])).get(account.id))
      if (balance === null) {
        return { ...base, available: false as const, scope, reason: 'OPENING_BALANCE_UNVERIFIED' as const, missingAccounts: [{ id: account.id, code: account.code }] }
      }
      opening = balance
      openingBasis = 'account_cash'
    } else {
      scope = { type: 'company', id: null, name: null }
      const cash = await cashPosition(q)
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
    const projectScope = scope.type === 'project' ? scope.id : null

    // Place every open obligation.
    const sources = await openObligations(q, projectScope)
    const placed = sources.map((s) => {
      const planned = s.expected_date ?? s.due_date ?? periodStart
      const certainty: Certainty = s.due_date !== null && s.due_date < asOf ? 'overdue' : s.expected_date !== null ? 'expected' : 'confirmed'
      const forecastDate = planned <= asOf ? periodStart : planned
      const outstanding = BigInt(s.outstanding_minor)
      return {
        s, certainty, forecastDate, outstanding, amount: outstanding, advance: 0n,
        movedToFirstPeriod: planned <= asOf || s.source === 'refund',
        party: s.source === 'customer_invoice' ? s.party_id : null,
        order: `${forecastDate}|${s.id.length.toString().padStart(3, '0')}|${s.id}`
      }
    })
    type Placed = (typeof placed)[number]

    // Customer advances already in cash reduce what is still expected from that customer.
    const advances = await advancePools(q, projectScope)
    const netting = applyAdvances(placed.filter(p => p.s.source === 'customer_invoice'), advances.pools)
    for (const [p, used] of netting.applied) { p.advance = used; p.amount = p.outstanding - used }
    const advanceLeft = [...netting.remaining.values()].reduce((a, b) => a + b, 0n)

    const isIn = (p: Placed) => p.s.source === 'customer_invoice'
    const inHorizon = placed.filter(p => p.forecastDate <= periodEnd)
    const after = placed.filter(p => p.forecastDate > periodEnd && p.amount > 0n)

    // Obligations carry no bank account yet: on an account view they are listed, but not counted.
    const counted = scope.type === 'account' ? [] : inHorizon
    const items: ForecastItem[] = counted.filter(p => p.amount > 0n).map(p => ({
      key: `${p.s.source}:${p.s.id}`,
      direction: isIn(p) ? 'in' : 'out',
      amount: p.amount,
      forecastDate: p.forecastDate,
      certainty: p.certainty,
      disputed: p.s.disputed
    }))
    const projection = project(opening, periods, items)

    const periodIndexOf = (date: string) => periods.findIndex(p => date >= p.startDate && date <= p.endDate)
    const total = (list: Placed[]) => list.reduce((acc, p) => acc + p.amount, 0n)

    // Warnings (advisory only). A project's net flow is not cash, so no gap is claimed for it.
    const warnings: Record<string, unknown>[] = scope.type === 'project' ? [] : detectWarnings(opening, asOf, projection.days, items, floor)
    const overdueIn = counted.filter(p => isIn(p) && p.certainty === 'overdue' && p.amount > 0n)
    if (overdueIn.length) {
      warnings.push({
        code: 'OVERDUE_INCOMING', count: overdueIn.length, amountMinor: total(overdueIn).toString(),
        /** Of those, placed in the first period (no new expected date); the rest follow their expected date. */
        inFirstPeriodCount: overdueIn.filter(p => p.movedToFirstPeriod).length
      })
    }
    const disputedIn = counted.filter(p => isIn(p) && p.s.disputed && p.amount > 0n)
    if (disputedIn.length) warnings.push({ code: 'DISPUTED_INCOMING', count: disputedIn.length, amountMinor: total(disputedIn).toString() })
    if (netting.applied.size) {
      warnings.push({ code: 'ADVANCES_NETTED', count: netting.applied.size, amountMinor: [...netting.applied.values()].reduce((a, b) => a + b, 0n).toString() })
    }

    const excluded: Excluded[] = await excludedFigures(q, projectScope)
    if (advanceLeft > 0n) excluded.push({ code: 'customer_advances', direction: null, count: advances.count, amountMinor: advanceLeft.toString() })
    const afterIn = after.filter(isIn)
    const afterOut = after.filter(p => !isIn(p))
    if (afterIn.length) excluded.push({ code: 'incoming_after_horizon', direction: 'in', count: afterIn.length, amountMinor: total(afterIn).toString() })
    if (afterOut.length) excluded.push({ code: 'outgoing_after_horizon', direction: 'out', count: afterOut.length, amountMinor: total(afterOut).toString() })

    const totalIn = projection.rows.reduce((s, r) => s + r.incomingMinor, 0n)
    const totalOut = projection.rows.reduce((s, r) => s + r.outgoingMinor, 0n)
    const splitTotal = (key: keyof ProjectedRow['split']) => projection.rows.reduce((s, r) => s + r.split[key], 0n).toString()
    const sortKey = (p: Placed) => `${p.forecastDate}|${isIn(p) ? 0 : 1}|${p.s.id.length.toString().padStart(3, '0')}|${p.s.id}`

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
        disputedIncomingMinor: total(counted.filter(p => isIn(p) && p.s.disputed)).toString(),
        refundOutgoingMinor: total(counted.filter(p => p.s.source === 'refund')).toString()
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
        /** What the projection counts: outstanding minus any customer advance applied to it. */
        amountMinor: p.amount.toString(),
        outstandingMinor: p.outstanding.toString(),
        advanceAppliedMinor: p.advance.toString(),
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
            count: inHorizon.filter(p => p.amount > 0n).length,
            incomingMinor: total(inHorizon.filter(isIn)).toString(),
            outgoingMinor: total(inHorizon.filter(p => !isIn(p))).toString()
          }
        : null,
      warnings,
      excluded,
      assumptions: ASSUMPTIONS
    }
  })
}
