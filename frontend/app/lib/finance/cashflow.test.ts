import { describe, expect, it } from 'vitest'
import { contributorItems, itemsOfPeriod, lowestRow, periodLabel, periodShortLabel } from './cashflow'
import type { CashFlowProjection, CashFlowRow } from '~/types/api'

const row = (startDate: string, endDate: string, kind: CashFlowRow['kind'], lowestMinor = '0') =>
  ({ startDate, endDate, kind, lowestMinor }) as CashFlowRow

describe('cash flow labels', () => {
  const today = '2026-09-29'
  it('names months, the rest of this month and weeks the way people say them', () => {
    expect(periodLabel(row('2026-10-01', '2026-10-31', 'month'), today)).toBe('Oktober 2026')
    expect(periodLabel(row('2026-09-30', '2026-09-30', 'rest_of_month'), today)).toBe('Sisa September (30 Sep)')
    expect(periodLabel(row('2026-09-10', '2026-09-30', 'rest_of_month'), today)).toBe('Sisa September')
    expect(periodLabel(row('2026-09-30', '2026-10-06', 'week'), today)).toBe('30 Sep – 6 Okt')
    expect(periodLabel(row('2026-12-28', '2027-01-03', 'week'), today)).toBe('28 Des – 3 Jan 2027')
    expect(periodShortLabel(row('2027-01-01', '2027-01-31', 'month'), today)).toBe('Jan 27')
    expect(periodShortLabel(row('2026-09-30', '2026-09-30', 'rest_of_month'), today)).toBe('Sisa Sep')
  })
})

describe('cash flow drill-down helpers', () => {
  const flow = {
    rows: [row('2026-09-30', '2026-10-06', 'week', '100'), row('2026-10-07', '2026-10-13', 'week', '-5')],
    items: [
      { source: 'customer_invoice', id: 'CINV-1', periodIndex: 0 },
      { source: 'vendor_invoice', id: 'VINV-2', periodIndex: 1 },
      { source: 'refund', id: 'RF-3', periodIndex: 1 }
    ]
  } as unknown as CashFlowProjection

  it('finds contributors by key and ignores unknown ones', () => {
    expect(contributorItems(flow, ['vendor_invoice:VINV-2', 'refund:RF-9']).map(i => i.id)).toEqual(['VINV-2'])
  })
  it('groups items per period and finds the lowest row', () => {
    expect(itemsOfPeriod(flow, 1).map(i => i.id)).toEqual(['VINV-2', 'RF-3'])
    expect(lowestRow(flow.rows)?.startDate).toBe('2026-10-07')
    expect(lowestRow([])).toBeNull()
  })
})
