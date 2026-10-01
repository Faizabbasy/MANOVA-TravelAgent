import { describe, expect, it } from 'vitest'
import { heroFigures } from './project-hero'
import type { CustomerInvoiceDto, ProjectFinanceSummaryDto } from '~/types/api'

const TODAY = '2026-10-01'
const base = { paymentStatus: 'partial', label: 'Dibayar sebagian', hasOverdue: true, openInvoiceCount: 1, nextDueDate: null, dpInvoiced: true, dpReceived: true }
const status = { ...base, view: 'status', projectId: 'PRJ-1', cancellation: null } as unknown as ProjectFinanceSummaryDto

function invoice (over: Partial<CustomerInvoiceDto>): CustomerInvoiceDto {
  return {
    id: 'CINV-1',
    number: 'INV-2026-00001',
    status: 'issued',
    settlement: 'partial',
    overdue: false,
    daysOverdue: 0,
    totalMinor: '0',
    paidMinor: '0',
    creditedMinor: '0',
    outstandingMinor: '0',
    issueDate: '2026-09-01',
    dueDate: null,
    invoiceType: 'dp',
    ...over
  } as CustomerInvoiceDto
}

function full (over: Record<string, unknown> = {}): ProjectFinanceSummaryDto {
  return {
    ...base,
    view: 'full',
    projectId: 'PRJ-1',
    currency: 'IDR',
    contractValueMinor: '1000000',
    receivable: { invoicedMinor: '600000', creditedMinor: '100000', receivedMinor: '300000', outstandingMinor: '200000', overdueMinor: '0', invoiceCount: 2, draftCount: 0, uninvoicedMinor: '500000', scheduledNotInvoicedMinor: '0' },
    invoices: [],
    ...over
  } as unknown as ProjectFinanceSummaryDto
}

describe('heroFigures', () => {
  it('no summary (server down or project unknown to the server) is unavailable, never zero', () => {
    expect(heroFigures(null, TODAY)).toEqual({ kind: 'unavailable' })
  })

  it('the Admin status view carries a label and no amounts', () => {
    const f = heroFigures(status, TODAY)
    expect(f).toEqual({ kind: 'status', paymentLabel: 'Dibayar sebagian', hasOverdue: true })
    expect(JSON.stringify(f)).not.toMatch(/Minor/)
  })

  it('Finance: contract, billed (net of credit notes), received, outstanding and not yet billed come from the server', () => {
    const f = heroFigures(full(), TODAY)
    expect(f).toMatchObject({
      kind: 'full',
      contractMinor: '1000000',
      invoicedMinor: '500000',
      receivedMinor: '300000',
      outstandingMinor: '200000',
      uninvoicedMinor: '500000',
      paymentLabel: 'Dibayar sebagian',
      hasOverdue: true,
      hasAnyInvoice: true
    })
  })

  it('percentages are shares of the contract, clamped so the bar never exceeds 100%', () => {
    const f = heroFigures(full(), TODAY)
    expect(f.kind === 'full' && f.percent).toEqual({ invoiced: 50, paid: 30, outstanding: 20, remainder: 50 })
    const over = heroFigures(full({ receivable: { invoicedMinor: '1500000', creditedMinor: '0', receivedMinor: '900000', outstandingMinor: '600000', uninvoicedMinor: '0' } }), TODAY)
    expect(over.kind === 'full' && over.percent).toEqual({ invoiced: 150, paid: 90, outstanding: 10, remainder: 0 })
    expect(over.kind === 'full' && over.overInvoiced).toBe(true)
  })

  it('no contract value: null contract and zero percentages (UI says the value is not set)', () => {
    const f = heroFigures(full({ contractValueMinor: null }), TODAY)
    expect(f.kind === 'full' && f.contractMinor).toBeNull()
    expect(f.kind === 'full' && f.percent).toEqual({ invoiced: 0, paid: 0, outstanding: 0, remainder: 0 })
  })

  it('next payment = the open issued invoice due first; overdue / due within 7 days / scheduled', () => {
    const invoices = [
      invoice({ id: 'A', number: 'INV-A', dueDate: '2026-10-20', outstandingMinor: '100000' }),
      invoice({ id: 'B', number: 'INV-B', dueDate: '2026-10-05', outstandingMinor: '50000' }),
      invoice({ id: 'C', number: 'INV-C', dueDate: '2026-09-01', outstandingMinor: '0', settlement: 'paid' }),
      invoice({ id: 'D', number: null, status: 'draft', dueDate: '2026-09-02', outstandingMinor: '0' })
    ]
    const f = heroFigures(full({ invoices }), TODAY)
    expect(f.kind === 'full' && f.nextPayment).toEqual({ invoiceLabel: 'INV-B', amountMinor: '50000', dueDate: '2026-10-05', tone: 'due-soon' })
    const late = heroFigures(full({ invoices: [invoice({ number: 'INV-L', dueDate: '2026-09-20', outstandingMinor: '10', overdue: true })] }), TODAY)
    expect(late.kind === 'full' && late.nextPayment?.tone).toBe('overdue')
    const later = heroFigures(full({ invoices: [invoice({ number: 'INV-S', dueDate: '2026-11-30', outstandingMinor: '10' })] }), TODAY)
    expect(later.kind === 'full' && later.nextPayment?.tone).toBe('scheduled')
    const none = heroFigures(full({ invoices: [invoice({ outstandingMinor: '0', settlement: 'paid', dueDate: '2026-10-02' })] }), TODAY)
    expect(none.kind === 'full' && none.nextPayment).toBeNull()
  })
})
