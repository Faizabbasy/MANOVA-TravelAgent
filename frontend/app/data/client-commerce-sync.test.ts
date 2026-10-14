import { describe, expect, it } from 'vitest'
import { CLIENT_COMMERCE_STATE, CLIENT_RESERVATIONS } from './client-commerce'
import { clientBookingFor, mergeClientInvoices, mergeClientQuotations, mergeClientReservations, resetClientCommerce } from './client-commerce-sync'
import { CREDIT_NOTES, INVOICES, LEADS, PAYMENTS, QUOTATIONS, getClientFinanceSummary, getClientInvoices, getClientReservations, getInvoiceOutstandingIdr } from './index'
import type { ClientInvoiceDto, ClientQuotationDto, ClientReservationDto } from '~/types/api'

const PARTY = 'PTY-005'
// The internal lists before any client merge, for the reset check.
const BEFORE = { invoices: INVOICES.map(i => i.id), payments: PAYMENTS.map(p => p.id), creditNotes: CREDIT_NOTES.map(n => n.id), quotations: QUOTATIONS.map(q => q.id), leads: LEADS.map(l => l.id) }

const quotation = (over: Partial<ClientQuotationDto> = {}): ClientQuotationDto => ({
  id: 'QUO-900',
  version: 2,
  createdOn: '2026-07-01',
  sentToClientOn: '2026-07-03',
  accepted: false,
  projectId: null,
  currency: 'IDR',
  amountMinor: '150000000',
  discountMinor: '5000000',
  taxMinor: null,
  previousAmountMinor: '160000000',
  serviceBreakdown: [{ service: 'Hotel', description: null, amountMinor: '150000000' }],
  paymentTerms: 'DP 30%',
  validUntil: '2026-08-01',
  termsAndConditions: null,
  inclusions: 'Hotel',
  exclusions: null,
  cancellationPolicy: null,
  proposedItineraryNote: null,
  preparedByName: 'Doni Saputra',
  lead: { id: 'LED-900', title: 'Retreat Bali', companyName: 'PT Java Bhakti', name: 'Dimas', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-04', travelerEstimate: 40, serviceScope: ['hotel'] },
  ...over
})

const invoice = (over: Partial<ClientInvoiceDto> = {}): ClientInvoiceDto => ({
  id: 'CINV-900',
  number: 'INV-2026-00900',
  project: { id: 'PRJ-201', name: 'Proyek Client' },
  invoiceType: 'dp',
  status: 'issued',
  settlement: 'partial',
  overdue: false,
  daysOverdue: 0,
  currency: 'IDR',
  totalMinor: '10000000',
  paidMinor: '4000000',
  creditedMinor: '1000000',
  outstandingMinor: '5000000',
  issueDate: '2026-07-01',
  dueDate: '2026-07-15',
  isDisputed: false,
  disputeReason: null,
  voidReason: null,
  billingSnapshot: null,
  lines: [{ position: 1, description: 'DP', amountMinor: '10000000' }],
  payments: [{ amountMinor: '4000000', effectiveDate: '2026-07-05', reference: 'TRF-1' }],
  creditNotes: [{ id: 'CN-900', amountMinor: '1000000', reason: 'Diskon', status: 'issued', issuedAt: '2026-07-06T00:00:00.000Z' }],
  ...over
})

const reservation = (over: Partial<ClientReservationDto> = {}): ClientReservationDto => ({
  type: 'flight',
  id: 'FLT-900',
  projectId: 'PRJ-201',
  projectName: 'Proyek Client',
  status: 'confirmed',
  clientStatus: 'Dikonfirmasi',
  reference: 'PNR123',
  label: 'Garuda Indonesia',
  startDate: '2026-09-01T08:00',
  deadlineDate: '2026-08-20',
  details: { travelerIds: ['TRV-1', 'TRV-2'], segments: [{ origin: 'CGK', destination: 'DPS', departureAt: '2026-09-01T08:00', arrivalAt: null, flightNumber: 'GA402' }], ticketingDeadline: '2026-08-20', airline: 'Garuda Indonesia', cabinClass: 'economy' },
  ...over
})

describe('client commerce sync (S12a-2)', () => {
  it('quotations: only the sent ones remain for the client party; the lead is created when unknown', () => {
    const partyLead = LEADS.find(l => l.partyId === PARTY && l.quotationId)
    mergeClientQuotations(PARTY, [quotation()])
    const party = new Set(LEADS.filter(l => l.partyId === PARTY).map(l => l.id))
    const forParty = QUOTATIONS.filter(q => party.has(q.leadId))
    expect(forParty.map(q => q.id)).toEqual(['QUO-900'])
    expect(forParty[0]).toMatchObject({ amountIdr: 150_000_000, discountIdr: 5_000_000, approvalStatus: 'approved', sentToClientAt: '2026-07-03', supersededAmountIdr: 160_000_000, preparedByName: 'Doni Saputra', accepted: false })
    expect(forParty[0]).not.toHaveProperty('estimatedCostIdr')
    expect(LEADS.find(l => l.id === 'LED-900')).toMatchObject({ partyId: PARTY, title: 'Retreat Bali', quotationId: 'QUO-900' })
    if (partyLead) { expect(QUOTATIONS.some(q => q.leadId === partyLead.id)).toBe(false) } // an unsent local quotation is gone
  })

  it('reservations: the portal reads the server list, and a preview gets the booking-like view without money', () => {
    mergeClientReservations([reservation()])
    expect(CLIENT_COMMERCE_STATE.reservationsLoaded).toBe(true)
    expect(getClientReservations('PRJ-201')).toEqual([{
      bookingType: 'flight',
      bookingId: 'FLT-900',
      category: 'flight',
      projectId: 'PRJ-201',
      projectName: 'Proyek Client',
      label: 'Garuda Indonesia',
      reference: 'PNR123',
      travelerCount: 2,
      startDate: '2026-09-01T08:00',
      deadlineDate: '2026-08-20',
      clientVisibleStatus: 'Dikonfirmasi'
    }])
    expect(clientBookingFor('flight', 'FLT-900')).toMatchObject({ id: 'FLT-900', projectId: 'PRJ-201', status: 'confirmed', pnr: 'PNR123', travelerIds: ['TRV-1', 'TRV-2'] })
    expect(clientBookingFor('flight', 'FLT-900')).not.toHaveProperty('sellPriceIdr')
  })

  it('invoices: the client’s invoices replace the local ones; status, payments and credit notes follow the server', () => {
    mergeClientInvoices(PARTY, { invoices: [invoice(), invoice({ id: 'CINV-901', number: 'INV-2026-00901', project: { id: 'PRJ-101', name: 'Group Trip' }, settlement: 'open', paidMinor: '0', creditedMinor: '0', outstandingMinor: '3000000', totalMinor: '3000000', payments: [], creditNotes: [], lines: [] })], summary: { invoicedMinor: '13000000', paidMinor: '4000000', outstandingMinor: '8000000', overdueCount: '0', nextDueDate: '2026-07-15' } })
    expect(INVOICES.map(i => i.id)).toEqual(['CINV-900', 'CINV-901'])
    expect(INVOICES[0]).toMatchObject({ label: 'INV-2026-00900', amountIdr: 10_000_000, status: 'partially-paid', dueAt: '2026-07-15', issuedAt: '2026-07-01', billedPartyId: PARTY })
    expect(PAYMENTS.map(p => [p.invoiceId, p.amountIdr])).toEqual([['CINV-900', 4_000_000]])
    expect(CREDIT_NOTES.map(n => [n.invoiceId, n.amountIdr, n.status])).toEqual([['CINV-900', 1_000_000, 'issued']])
    expect(getInvoiceOutstandingIdr('CINV-900')).toBe(5_000_000)
    // A Group Trip participant invoice on another party's project is still the client's bill.
    expect(getClientInvoices(PARTY).map(i => i.id).sort()).toEqual(['CINV-900', 'CINV-901'])
  })
})

describe('client commerce sync — leaving the client session (S12a-2 review)', () => {
  it('void invoices count neither as invoiced nor as paid in the client summary', () => {
    mergeClientInvoices(PARTY, { invoices: [invoice(), invoice({ id: 'CINV-902', number: 'INV-2026-00902', status: 'void', voidReason: 'Salah nominal', totalMinor: '2000000', paidMinor: '0', creditedMinor: '0', outstandingMinor: '0', payments: [], creditNotes: [] })], summary: { invoicedMinor: '10000000', paidMinor: '4000000', outstandingMinor: '5000000', overdueCount: '0', nextDueDate: '2026-07-15' } })
    expect(getClientFinanceSummary(PARTY)).toMatchObject({ totalInvoicedIdr: 10_000_000, outstandingIdr: 5_000_000, totalPaidIdr: 5_000_000 })
  })

  it('reset restores the internal lists and the local reservation view', () => {
    resetClientCommerce()
    expect(INVOICES.map(i => i.id)).toEqual(BEFORE.invoices)
    expect(PAYMENTS.map(p => p.id)).toEqual(BEFORE.payments)
    expect(CREDIT_NOTES.map(n => n.id)).toEqual(BEFORE.creditNotes)
    expect(QUOTATIONS.map(q => q.id)).toEqual(BEFORE.quotations)
    expect(LEADS.map(l => l.id)).toEqual(BEFORE.leads)
    expect(CLIENT_COMMERCE_STATE.reservationsLoaded).toBe(false)
    expect(CLIENT_RESERVATIONS).toEqual([])
  })
})
