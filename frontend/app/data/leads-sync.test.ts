import { beforeEach, describe, expect, it } from 'vitest'
import { LEADS, LEAD_ACTIVITIES } from './leads'
import { QUOTATIONS } from './quotations'
import { applyCostSheetOnServer, leadFromServer, mergeServerLeads, qualifyB2cLeadOnServer, qualifyGroupTripOnServer, qualifyLeadOnServer, quotationFromServer, reviseQuotationOnServer } from './leads-sync'
import { SALES_ORDERS } from './sales-orders'
import { COST_SHEETS } from './products'
import type { LeadDto, SalesQuotationDto } from '~/types/api'

const lead = (over: Partial<LeadDto> = {}): LeadDto => ({
  id: 'LED-001',
  name: 'CV Nirmala',
  companyName: 'CV Nirmala',
  title: null,
  source: 'website',
  stage: 'qualified',
  ownerUserId: 'USR-001',
  handedOverTo: 'USR-001',
  phone: null,
  email: null,
  qualificationNotes: null,
  expectedCloseDate: null,
  createdOn: '2026-07-10',
  lastUpdatedOn: '2026-07-22',
  archived: false,
  archiveReason: null,
  partyId: 'PTY-004',
  qualifiedOn: '2026-07-22',
  unqualifiedReason: null,
  mergedInto: null,
  serviceCategory: 'mice-event',
  destination: 'Yogyakarta',
  travelStartDate: '2026-09-20',
  travelEndDate: '2026-09-22',
  travelerEstimate: 150,
  serviceScope: ['mice'],
  requirementSummary: 'x',
  budgetRange: null,
  dateFlexible: null,
  decisionMaker: null,
  urgency: null,
  specialRequestNote: null,
  b2c: {},
  wonProjectId: null,
  quotationId: null,
  activities: [{ id: 'LACT-001', leadId: 'LED-001', type: 'call', message: 'Halo', ownerUserId: 'USR-001', activityDate: '2026-07-11', dueOn: null, doneOn: null }],
  ...over
})
const quo = (over: Partial<SalesQuotationDto> = {}): SalesQuotationDto => ({
  id: 'QUO-005',
  leadId: 'LED-005',
  currentVersion: 2,
  status: 'submitted',
  sentToClientOn: null,
  createdOn: '2026-07-18',
  amountMinor: '180000000',
  discountMinor: null,
  taxMinor: null,
  markupMinor: null,
  estimatedCostMinor: null,
  estimatedMarginMinor: null,
  currency: 'IDR',
  paymentTerms: null,
  validUntil: null,
  termsAndConditions: null,
  inclusions: null,
  exclusions: null,
  cancellationPolicy: null,
  proposedItineraryNote: null,
  costSheetId: null,
  serviceBreakdown: [{ service: 'hotel', amountMinor: '180000000' }],
  submittedBy: 'USR-001',
  submittedAt: null,
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  versions: [
    { version: 1, status: 'superseded', amountMinor: '150000000', createdOn: '2026-07-10', submittedBy: null, decidedBy: null, decidedAt: null, decisionNote: null },
    { version: 2, status: 'submitted', amountMinor: '180000000', createdOn: '2026-07-18', submittedBy: 'USR-001', decidedBy: null, decidedAt: null, decisionNote: null }
  ],
  ...over
})

describe('leads-sync mapping', () => {
  it('maps a lead: dates, won project, B2C project from b2c, activities', () => {
    const l = leadFromServer(lead({ wonProjectId: 'PRJ-101', quotationId: 'QUO-001' }))
    expect(l).toMatchObject({ id: 'LED-001', createdAt: '2026-07-10', lastUpdatedAt: '2026-07-22', projectId: 'PRJ-101', quotationId: 'QUO-001', partyId: 'PTY-004', qualifiedAt: '2026-07-22' })
    const b2c = leadFromServer(lead({ serviceCategory: 'individual-travel', b2c: { groupTripProjectId: 'PRJ-205', projectId: 'PRJ-205', b2cAdultCount: 2 } }))
    expect(b2c).toMatchObject({ projectId: 'PRJ-205', groupTripProjectId: 'PRJ-205', b2cAdultCount: 2 })
  })

  it('maps a quotation: approval fields, previous amount, version list, accepted when the lead is won', () => {
    const q = quotationFromServer(quo(), new Set(['LED-005']))
    expect(q).toMatchObject({ id: 'QUO-005', amountIdr: 180_000_000, version: 2, approvalStatus: 'submitted', supersededAmountIdr: 150_000_000, accepted: true })
    expect(q.serviceBreakdown).toEqual([{ service: 'hotel', amountIdr: 180_000_000 }])
    expect(q.versions).toHaveLength(2)
  })

  it('merge replaces leads, activities and quotations with the server lists, keeping object identity', () => {
    const before = LEADS.find(l => l.id === 'LED-001')!
    mergeServerLeads([lead({ name: 'Nama Baru' })], [quo()])
    expect(LEADS).toHaveLength(1)
    expect(LEADS[0]).toBe(before)
    expect(LEADS[0]!.name).toBe('Nama Baru')
    expect(LEAD_ACTIVITIES.map(a => a.id)).toEqual(['LACT-001'])
    expect(QUOTATIONS.map(q => q.id)).toEqual(['QUO-005'])
  })
})

describe('leads-sync writes', () => {
  beforeEach(() => { mergeServerLeads([lead()], [quo()]) })

  it('revise sends a revision while the latest version is decided or submitted, a PATCH while it is a draft', async () => {
    const calls: string[] = []
    const api = {
      sales: {
        updateQuotation: (id: string) => { calls.push(`patch ${id}`); return Promise.resolve({ data: quo({ status: 'draft' }) }) },
        reviseQuotation: (id: string) => { calls.push(`revise ${id}`); return Promise.resolve({ data: quo({ currentVersion: 3, status: 'draft' }) }) }
      }
    } as never
    await reviseQuotationOnServer(api, 'QUO-005', { amountIdr: 200_000_000 })
    expect(calls).toEqual(['revise QUO-005'])
    await reviseQuotationOnServer(api, 'QUO-005', { amountIdr: 210_000_000 })
    expect(calls).toEqual(['revise QUO-005', 'patch QUO-005'])
  })

  it('qualify takes the server lead and reloads its customer', async () => {
    const parties: string[] = []
    const api = {
      sales: { qualifyLead: () => Promise.resolve({ data: lead({ partyId: 'PTY-001' }) }) },
      core: { getParty: (id: string) => { parties.push(id); return Promise.reject(new Error('offline')) } }
    } as never
    const l = await qualifyLeadOnServer(api, 'LED-001', 'company')
    expect(l.partyId).toBe('PTY-001')
    expect(parties).toEqual(['PTY-001'])
  })
})

describe('cost sheet applied through the server (S6a)', () => {
  beforeEach(() => {
    mergeServerLeads([lead({ id: 'LED-019', partyId: 'PTY-004', activities: [] })], [])
    const cs = COST_SHEETS.find(c => c.id === 'CS-003')!
    cs.appliedToQuotationId = undefined
    cs.status = 'draft'
  })

  it('creates the quotation on the server with the cost sheet figures, then locks the cost sheet', async () => {
    const sent: Record<string, unknown>[] = []
    const api = {
      sales: {
        createQuotation: (leadId: string, input: Record<string, unknown>) => {
          sent.push(input)
          return Promise.resolve({ data: quo({ id: 'QUO-050', leadId, currentVersion: 1, status: 'draft', amountMinor: String(input.amountMinor), versions: [] }) })
        }
      }
    } as never
    const q = await applyCostSheetOnServer(api, 'CS-003', 'USR-001')
    expect(q?.id).toBe('QUO-050')
    expect(sent[0]).toMatchObject({ costSheetId: 'CS-003', currency: 'IDR' })
    expect(Number(sent[0]!.amountMinor)).toBeGreaterThan(0)
    expect((sent[0]!.serviceBreakdown as unknown[]).length).toBe(4)
    expect(COST_SHEETS.find(c => c.id === 'CS-003')).toMatchObject({ appliedToQuotationId: 'QUO-050', status: 'final' })
  })

  it('a server refusal leaves the cost sheet unlocked; a submitted quotation is not overwritten', async () => {
    const failing = { sales: { createQuotation: () => Promise.reject(new Error('down')) } } as never
    await expect(applyCostSheetOnServer(failing, 'CS-003', 'USR-001')).rejects.toThrow('down')
    expect(COST_SHEETS.find(c => c.id === 'CS-003')!.appliedToQuotationId).toBeUndefined()
    mergeServerLeads([lead({ id: 'LED-019', partyId: 'PTY-004', quotationId: 'QUO-051', activities: [] })], [quo({ id: 'QUO-051', leadId: 'LED-019', status: 'submitted' })])
    let calls = 0
    const api = { sales: { updateQuotation: () => { calls++; return Promise.reject(new Error('x')) }, reviseQuotation: () => { calls++; return Promise.reject(new Error('x')) } } } as never
    expect(await applyCostSheetOnServer(api, 'CS-003', 'USR-001')).toBeUndefined()
    expect(calls).toBe(0)
  })
})

describe('B2C and Group Trip qualify through the server (S6b)', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: 'SLO-020',
    projectId: null,
    partyId: 'PTY-030',
    partyName: 'Bu Sri',
    leadId: 'LED-001',
    destination: 'Bali',
    travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-03',
    travelerCount: 2,
    priceMinor: '5000000',
    status: 'draft',
    statusReason: null,
    note: null,
    paidOn: null,
    createdOn: '2026-10-07',
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...over
  })
  beforeEach(() => { mergeServerLeads([lead({ serviceCategory: 'individual-travel', stage: 'new', partyId: null })], []) })

  it('B2C qualify sends the price and brings back the lead and its order', async () => {
    const sent: Record<string, unknown>[] = []
    const api = {
      sales: {
        qualifyLead: (_id: string, input: Record<string, unknown>) => { sent.push(input); return Promise.resolve({ data: lead({ serviceCategory: 'individual-travel', partyId: 'PTY-030', b2c: { salesOrderId: 'SLO-020' } }) }) },
        getSalesOrder: () => Promise.resolve({ data: order() })
      },
      core: { getParty: () => Promise.reject(new Error('offline')) }
    } as never
    const res = await qualifyB2cLeadOnServer(api, 'LED-001', 5_000_000)
    expect(sent[0]).toEqual({ customerKind: 'individual', priceMinor: '5000000' })
    expect(res.order?.id).toBe('SLO-020')
    expect(SALES_ORDERS.some(o => o.id === 'SLO-020')).toBe(true)
    expect(res.lead.salesOrderId).toBe('SLO-020')
  })

  it('group trip waitlist brings no order; qualified brings the booking', async () => {
    const waitApi = { sales: { qualifyGroupTrip: () => Promise.resolve({ data: { outcome: 'waitlist', lead: lead({ serviceCategory: 'individual-travel', b2c: { b2cQualificationResult: 'waitlist' } }), salesOrder: null } }) }, core: { getParty: () => Promise.reject(new Error('x')) } } as never
    const input = { projectId: 'PRJ-205', adultCount: 1, childCount: 0, infantCount: 0, priceIdr: 3_500_000, priceAcceptance: 'accept', bookingReadiness: 'ready' }
    const wait = await qualifyGroupTripOnServer(waitApi, 'LED-001', input)
    expect(wait.outcome).toBe('waitlist')
    expect(wait.order).toBeUndefined()
    const sent: Record<string, unknown>[] = []
    const okApi = {
      sales: { qualifyGroupTrip: (_id: string, body: Record<string, unknown>) => { sent.push(body); return Promise.resolve({ data: { outcome: 'qualified', lead: lead({ serviceCategory: 'individual-travel', partyId: 'PTY-030' }), salesOrder: order({ id: 'SLO-021', projectId: 'PRJ-205', travelerCount: 1 }) } }) } },
      core: { getParty: () => Promise.reject(new Error('x')) }
    } as never
    const ok = await qualifyGroupTripOnServer(okApi, 'LED-001', input)
    expect(sent[0]).toMatchObject({ projectId: 'PRJ-205', priceMinor: '3500000' })
    expect(sent[0]).not.toHaveProperty('priceIdr')
    expect(ok.order?.projectId).toBe('PRJ-205')
  })
})
