import { describe, expect, it } from 'vitest'
import { periodRange, previousPeriodRange, sumMonthly } from './dashboard-finance'
import type { MonthlyReportDto } from '~/types/api'

describe('periodRange (V2 dashboard period filter → server date range)', () => {
  it('this month and this year start on the 1st', () => {
    expect(periodRange('this-month', '2026-10-17')).toEqual({ from: '2026-10-01', to: '2026-10-17' })
    expect(periodRange('this-year', '2026-10-17')).toEqual({ from: '2026-01-01', to: '2026-10-17' })
  })

  it('all time is the last 24 months, the most the server reports', () => {
    expect(periodRange('all-time', '2026-10-17')).toEqual({ from: '2024-11-01', to: '2026-10-17' })
    expect(periodRange('all-time', '2026-01-05')).toEqual({ from: '2024-02-01', to: '2026-01-05' })
  })

  it('custom uses the chosen range; without one it falls back to this month', () => {
    expect(periodRange('custom', '2026-10-17', { from: '2026-07-01', to: '2026-08-31' })).toEqual({ from: '2026-07-01', to: '2026-08-31' })
    expect(periodRange('custom', '2026-10-17')).toEqual({ from: '2026-10-01', to: '2026-10-17' })
  })

  it('a custom range longer than 24 months keeps the last 24 months up to its end (the server limit)', () => {
    expect(periodRange('custom', '2026-10-17', { from: '2020-03-10', to: '2026-08-31' })).toEqual({ from: '2024-09-01', to: '2026-08-31' })
    expect(periodRange('custom', '2026-10-17', { from: '2024-09-01', to: '2026-08-31' })).toEqual({ from: '2024-09-01', to: '2026-08-31' })
  })
})

describe('previousPeriodRange (trend comparison)', () => {
  it('this month compares with the whole previous month, across a year boundary too', () => {
    expect(previousPeriodRange('this-month', '2026-10-17')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(previousPeriodRange('this-month', '2026-01-05')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(previousPeriodRange('this-month', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('this year compares with the whole previous year', () => {
    expect(previousPeriodRange('this-year', '2026-10-17')).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('all time and custom have no previous period (no trend shown)', () => {
    expect(previousPeriodRange('all-time', '2026-10-17')).toBeNull()
    expect(previousPeriodRange('custom', '2026-10-17')).toBeNull()
  })
})

describe('sumMonthly', () => {
  const report = (months: MonthlyReportDto['months']) => ({ asOf: '2026-10-01', timezone: 'Asia/Jakarta', basis: 'accrual', vendors: [], months }) as MonthlyReportDto
  const month = (m: string, revenue: string, cost: string, expense: string, net: string) =>
    ({ month: m, invoicedMinor: revenue, creditedMinor: '0', revenueMinor: revenue, vendorCostMinor: '0', expenseMinor: expense, costMinor: cost, netMinor: net })

  it('adds the months exactly (bigint strings, no float rounding)', () => {
    const r = sumMonthly(report([month('2026-08', '900000000000001', '10', '5', '899999999999991'), month('2026-09', '1', '1', '1', '0')]))
    expect(r).toMatchObject({ revenueMinor: '900000000000002', costMinor: '11', netMinor: '899999999999991', expenseMinor: '6' })
    expect(r.months.map(m => m.month)).toEqual(['2026-08', '2026-09'])
  })

  it('a loss stays negative', () => {
    expect(sumMonthly(report([month('2026-09', '100', '300', '0', '-200')])).netMinor).toBe('-200')
  })

  it('no months: zeros', () => {
    expect(sumMonthly(report([]))).toEqual({ revenueMinor: '0', costMinor: '0', netMinor: '0', expenseMinor: '0', months: [] })
  })
})
