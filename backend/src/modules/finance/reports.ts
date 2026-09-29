import type { Db } from '../../db/client'
import { BUSINESS_TIMEZONE } from '../../config/env'
import { errors } from '../../http/errors'
import { todayBusinessDate } from './common'

/**
 * Reporting read model (Phase 7): accrual figures per calendar month, for the Reports screen.
 *
 *   revenue = customer invoices issued in the month (issue date) − credit notes issued in the month
 *             (discounts, cancellation write-offs and refunds granted all reduce revenue)
 *   cost    = vendor invoices approved, by invoice date + expenses and transfer fees paid in the month
 *             (reversed pairs left out)
 *   net     = revenue − cost
 *
 * Accrual, not cash: money received or paid is in the Statement and the Cash Flow. The same definitions as a
 * project's profitability, summed over the company and bucketed by date (Asia/Jakarta business dates).
 */

const MONTH_RE = /^\d{4}-\d{2}$/

function monthsBack(today: string, count: number): string[] {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
    out.push(m.toISOString().slice(0, 7))
  }
  return out
}

export async function monthlyReport(db: Db, query: { months?: string }) {
  const count = query.months === undefined ? 6 : Number(query.months)
  if (!Number.isInteger(count) || count < 1 || count > 24) throw errors.validation({ months: ['Jumlah bulan 1–24.'] })
  const today = todayBusinessDate()
  const months = monthsBack(today, count)
  const from = `${months[0]}-01`

  const bucket = async (sql: string, params: unknown[] = [from]) => new Map(
    (await db.query<{ m: string; total: string }>(sql, params)).filter(r => MONTH_RE.test(r.m)).map(r => [r.m, BigInt(r.total)])
  )
  const invoiced = await bucket(
    `select to_char(issue_date, 'YYYY-MM') as m, sum(total_minor) as total from customer_invoices
      where status = 'issued' and issue_date >= $1::date group by 1`
  )
  // Credit notes carry a timestamp; their month is the Jakarta business date of issue.
  const credited = await bucket(
    `select to_char((created_at at time zone $2)::date, 'YYYY-MM') as m, sum(amount_minor) as total from credit_notes
      where status = 'issued' and (created_at at time zone $2)::date >= $1::date group by 1`,
    [from, BUSINESS_TIMEZONE]
  )
  const vendor = await bucket(
    `select to_char(invoice_date, 'YYYY-MM') as m, sum(total_minor) as total from vendor_invoices
      where status = 'approved' and invoice_date >= $1::date group by 1`
  )
  const spent = await bucket(
    `select to_char(t.effective_date, 'YYYY-MM') as m, sum(t.amount_minor) as total from financial_transactions t
      where t.kind in ('expense', 'transfer_fee') and t.reversal_of_id is null and t.effective_date >= $1::date
        and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)
      group by 1`
  )

  const rows = months.map((month) => {
    const revenue = (invoiced.get(month) ?? 0n) - (credited.get(month) ?? 0n)
    const cost = (vendor.get(month) ?? 0n) + (spent.get(month) ?? 0n)
    return {
      month,
      invoicedMinor: (invoiced.get(month) ?? 0n).toString(),
      creditedMinor: (credited.get(month) ?? 0n).toString(),
      revenueMinor: revenue.toString(),
      vendorCostMinor: (vendor.get(month) ?? 0n).toString(),
      expenseMinor: (spent.get(month) ?? 0n).toString(),
      costMinor: cost.toString(),
      netMinor: (revenue - cost).toString()
    }
  })

  // Approved vendor invoices per vendor (all time): who we spend with, across how many projects.
  const vendors = await db.query<{ vendor_id: string; name: string; total: string; projects: string; invoices: string }>(
    `select v.vendor_id, ve.name, sum(v.total_minor) as total, count(distinct v.project_id) as projects, count(*) as invoices
       from vendor_invoices v join vendors ve on ve.id = v.vendor_id
      where v.status = 'approved' group by v.vendor_id, ve.name order by sum(v.total_minor) desc, v.vendor_id limit 20`
  )

  return {
    asOf: today,
    timezone: BUSINESS_TIMEZONE,
    basis: 'accrual' as const,
    months: rows,
    vendors: vendors.map(v => ({ vendor: { id: v.vendor_id, name: v.name }, approvedMinor: v.total, projectCount: Number(v.projects), invoiceCount: Number(v.invoices) }))
  }
}
