import { describe, expect, it } from 'vitest'
import { customerInvoiceTag, movementTitle, vendorInvoiceTag } from './labels'
import { daysBetween, dueInfo, formatBusinessDate, shiftDate, todayJakarta } from './dates'
import type { MovementDto } from '~/types/api'

describe('finance dates', () => {
  it('today is the Jakarta calendar date, whatever the browser timezone', () => {
    // 2026-09-29 18:30 UTC is already 30 Sep 01:30 in Jakarta (UTC+7).
    expect(todayJakarta(new Date('2026-09-29T18:30:00Z'))).toBe('2026-09-30')
    expect(todayJakarta(new Date('2026-09-29T16:59:00Z'))).toBe('2026-09-29')
  })

  it('shifts calendar dates across month and year ends', () => {
    expect(shiftDate('2026-12-30', 3)).toBe('2027-01-02')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-29', '2026-10-02')).toBe(3)
  })

  it('formats in Indonesian, short form drops the current year', () => {
    expect(formatBusinessDate('2026-08-17')).toBe('17 Agu 2026')
    expect(formatBusinessDate('2026-08-17', { short: true, today: '2026-09-29' })).toBe('17 Agu')
    expect(formatBusinessDate('2025-08-17', { short: true, today: '2026-09-29' })).toBe('17 Agu 2025')
    expect(formatBusinessDate(null)).toBe('—')
  })

  it('describes due dates in plain language', () => {
    const today = '2026-09-29'
    expect(dueInfo('2026-09-25', today)).toEqual({ label: 'Terlambat 4 hari', tone: 'destructive' })
    expect(dueInfo('2026-09-29', today)).toEqual({ label: 'Jatuh tempo hari ini', tone: 'warning' })
    expect(dueInfo('2026-10-02', today)).toEqual({ label: '3 hari lagi', tone: 'warning' })
    expect(dueInfo('2026-11-15', today).label).toBe('15 Nov')
    expect(dueInfo('2026-09-01', today, true).tone).toBe('muted') // settled: never "late"
  })
})

describe('finance labels', () => {
  it('invoice badges: paid beats overdue, drafts and voids are never "late"', () => {
    expect(customerInvoiceTag({ status: 'issued', settlement: 'paid', overdue: false, isDisputed: false }).label).toBe('Lunas')
    expect(customerInvoiceTag({ status: 'issued', settlement: 'partial', overdue: true, isDisputed: false })).toEqual({ label: 'Terlambat', tone: 'destructive' })
    expect(customerInvoiceTag({ status: 'draft', settlement: null, overdue: false, isDisputed: false }).label).toBe('Draft')
    expect(customerInvoiceTag({ status: 'issued', settlement: 'credited', overdue: false, isDisputed: false }).label).not.toBe('Lunas')
    expect(vendorInvoiceTag({ status: 'submitted', settlement: null, overdue: false }).label).toBe('Perlu direview')
    expect(vendorInvoiceTag({ status: 'approved', settlement: 'open', overdue: false }).label).toBe('Siap dibayar')
  })

  it('movement title prefers the party, then the counterparty', () => {
    const base = { isInternalTransfer: false, kind: 'expense', party: null, vendor: null, counterparty: null } as unknown as MovementDto
    expect(movementTitle({ ...base, counterparty: 'Meta Ads' })).toBe('Meta Ads')
    expect(movementTitle({ ...base, party: { id: 'PTY-1', name: 'PT A' }, counterparty: 'x' })).toBe('PT A')
    expect(movementTitle({ ...base, isInternalTransfer: true, kind: 'transfer_out' })).toBe('Transfer antar rekening')
    expect(movementTitle(base)).toBe('Pengeluaran operasional')
  })
})
