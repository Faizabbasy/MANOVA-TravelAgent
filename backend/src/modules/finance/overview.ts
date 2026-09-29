import type { Db } from '../../db/client'
import { cashFlow } from './cashflow'
import { todayBusinessDate } from './common'
import { cashPosition } from './reads'
import {
  INVOICES_WITH_BALANCE, moreToBillByProject, statusView, VENDOR_INVOICES_WITH_BALANCE, withCancellation, type InvoiceBalanceRow
} from './summaries'

/**
 * Finance at a glance for the app dashboard (Phase 7), computed from the same records and rules as the
 * Finance menus and the per-project summaries — a handful of set-based queries instead of one request per
 * project. Two shapes (ADR-007 #3):
 *  - full   (finance.view-project-finance): cash, 30-day forecast, receivables/payables, overdue invoices,
 *                                            and per project the payment status, revenue, cost, received and outstanding
 *  - status (project-order.view-payment-status, Admin): per project the payment status only — no amount
 */

const sum = (rows: Record<string, any>[], key: string) => rows.reduce((s, r) => s + BigInt(r[key] ?? 0), 0n)

export async function financeOverview(db: Db, full: boolean) {
  const today = todayBusinessDate()
  const invoices = await db.query<InvoiceBalanceRow & { project_id: string; party_id: string }>(
    `${INVOICES_WITH_BALANCE} where i.status <> 'void' order by i.due_date nulls last, i.id`
  )
  const moreToBill = await moreToBillByProject(db)
  // Live whole-project cancellation cases (a booking case does not cancel the project).
  const cases = await db.query<Record<string, any>>(
    `select r.*, b.settled_minor, (b.refundable_minor - b.settled_minor) as outstanding_minor
       from refunds r join v_refund_balances b on b.refund_id = r.id
      where r.status <> 'rejected' and r.subject_type = 'project'`
  )
  const caseByProject = new Map(cases.map(c => [c.project_id as string, c]))

  const byProject = new Map<string, InvoiceBalanceRow[]>()
  for (const i of invoices) {
    const rows = byProject.get(i.project_id)
    if (rows) rows.push(i)
    else byProject.set(i.project_id, [i])
  }

  const projectIds = [...moreToBill.keys()].sort()
  const projects = projectIds.map((projectId) => {
    const rows = byProject.get(projectId) ?? []
    const cancelled = caseByProject.get(projectId) ?? null
    const status = withCancellation(statusView(rows, today, cancelled ? false : moreToBill.get(projectId)!), cancelled)
    return {
      projectId, paymentStatus: status.paymentStatus, label: status.label, hasOverdue: status.hasOverdue, cancelled: !!cancelled,
      dpInvoiced: status.dpInvoiced, dpReceived: status.dpReceived
    }
  })
  if (!full) return { view: 'status' as const, asOf: today, projects }

  // Actual cost per project: approved vendor invoices + project expenses (reversed pairs left out).
  const costs = await db.query<{ project_id: string; total: string }>(
    `select project_id, sum(total) as total from (
       select project_id, total_minor as total from vendor_invoices where status = 'approved' and project_id is not null
       union all
       select t.project_id, t.amount_minor from financial_transactions t
        where t.kind = 'expense' and t.project_id is not null and t.reversal_of_id is null
          and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)
     ) x group by project_id`
  )
  const costByProject = new Map(costs.map(c => [c.project_id, c.total]))
  // Revenue as in a project's profitability: issued invoices − every issued credit note on them.
  const credits = await db.query<{ project_id: string; total: string }>(
    `select i.project_id, sum(c.amount_minor) as total from credit_notes c join customer_invoices i on i.id = c.customer_invoice_id
      where c.status = 'issued' and i.status = 'issued' group by i.project_id`
  )
  const creditByProject = new Map(credits.map(c => [c.project_id, BigInt(c.total)]))

  const issued = invoices.filter(i => i.status === 'issued')
  const open = issued.filter(i => BigInt(i.outstanding_minor) > 0n)
  const overdue = open.filter(i => i.due_date < today)
  const vendorRows = await db.query<Record<string, any>>(`${VENDOR_INVOICES_WITH_BALANCE} where v.status not in ('rejected', 'void')`)
  const approved = vendorRows.filter(v => v.status === 'approved')
  const apOverdue = approved.filter(v => BigInt(v.outstanding_minor) > 0n && v.due_date < today)

  const cash = await cashPosition(db)
  const forecast = await cashFlow(db, { horizon: '30d' })
  const gap = forecast.available ? forecast.warnings.find(w => w.code === 'CASH_GAP') as { date: string; balanceMinor: string } | undefined : undefined

  return {
    view: 'full' as const,
    asOf: today,
    projects: projects.map((p) => {
      const projectIssued = (byProject.get(p.projectId) ?? []).filter(i => i.status === 'issued')
      return {
        ...p,
        costMinor: costByProject.get(p.projectId) ?? '0',
        revenueMinor: (sum(projectIssued, 'total_minor') - (creditByProject.get(p.projectId) ?? 0n)).toString(),
        receivedMinor: sum(projectIssued, 'paid_minor').toString(),
        outstandingMinor: sum(projectIssued.filter(i => BigInt(i.outstanding_minor) > 0n), 'outstanding_minor').toString()
      }
    }),
    cash: { available: cash.available, reason: cash.reason, totalMinor: cash.totalMinor },
    forecast: forecast.available
      ? { available: true as const, periodEnd: forecast.periodEnd, closingMinor: forecast.closingMinor, gap: gap ? { date: gap.date, balanceMinor: gap.balanceMinor } : null }
      : { available: false as const, reason: forecast.reason },
    receivables: {
      outstandingMinor: sum(open, 'outstanding_minor').toString(),
      openCount: open.length,
      overdueMinor: sum(overdue, 'outstanding_minor').toString(),
      overdueCount: overdue.length
    },
    payables: {
      outstandingMinor: sum(approved, 'outstanding_minor').toString(),
      overdueMinor: sum(apOverdue, 'outstanding_minor').toString(),
      overdueCount: apOverdue.length,
      pendingReviewCount: vendorRows.filter(v => ['submitted', 'under_review'].includes(v.status)).length
    },
    /** Oldest overdue customer invoices first (for "who to call today"). */
    overdueInvoices: overdue.slice(0, 5).map(i => ({
      id: i.id as string,
      number: i.number as string,
      party: { id: i.party_id, name: i.party_name as string },
      project: { id: (i as { project_id: string }).project_id, name: i.project_name as string },
      dueDate: i.due_date,
      outstandingMinor: i.outstanding_minor
    }))
  }
}
