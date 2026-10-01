import type { IsoDate, MonthlyReportDto } from '~/types/api'

/**
 * The V2 dashboard's financial period filter, mapped onto the server's monthly accrual report
 * (`GET /finance/reports/monthly?from=&to=`). The report works in whole calendar months, at most 24.
 */
export type DashboardPeriodPreset = 'this-month' | 'this-year' | 'all-time' | 'custom'
export interface DashboardPeriod { from: IsoDate; to: IsoDate }

export interface DashboardFinanceFigures {
  revenueMinor: string
  costMinor: string
  netMinor: string
  expenseMinor: string
  months: { month: string; revenueMinor: string; costMinor: string; netMinor: string }[]
}

const MAX_MONTHS = 24

/** First day of the earliest month in the 24-month window that ends in the month of `end`. */
function windowStart (end: IsoDate): IsoDate {
  const start = new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - MAX_MONTHS, 1))
  return start.toISOString().slice(0, 10)
}

export function periodRange (preset: DashboardPeriodPreset, today: IsoDate, custom?: DashboardPeriod): DashboardPeriod {
  if (preset === 'custom' && custom) {
    const earliest = windowStart(custom.to)
    return { from: custom.from < earliest ? earliest : custom.from, to: custom.to }
  }
  if (preset === 'this-year') { return { from: `${today.slice(0, 4)}-01-01`, to: today } }
  if (preset === 'all-time') { return { from: windowStart(today), to: today } }
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

/** The period a trend compares against: the whole previous month / year; none for all time and custom. */
export function previousPeriodRange (preset: DashboardPeriodPreset, today: IsoDate): DashboardPeriod | null {
  const y = Number(today.slice(0, 4))
  if (preset === 'this-year') { return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` } }
  if (preset === 'this-month') {
    const m = Number(today.slice(5, 7))
    const first = new Date(Date.UTC(y, m - 2, 1))
    const last = new Date(Date.UTC(y, m - 1, 0))
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
  }
  return null
}

export function sumMonthly (report: MonthlyReportDto): DashboardFinanceFigures {
  const total = (key: 'revenueMinor' | 'costMinor' | 'netMinor' | 'expenseMinor') =>
    report.months.reduce((sum, m) => sum + BigInt(m[key]), 0n).toString()
  return {
    revenueMinor: total('revenueMinor'),
    costMinor: total('costMinor'),
    netMinor: total('netMinor'),
    expenseMinor: total('expenseMinor'),
    months: report.months.map(m => ({ month: m.month, revenueMinor: m.revenueMinor, costMinor: m.costMinor, netMinor: m.netMinor }))
  }
}
