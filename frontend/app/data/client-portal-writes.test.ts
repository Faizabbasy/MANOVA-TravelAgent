import { describe, expect, it, vi } from 'vitest'
import {
  cancellableSelection, clientMarkInvoiceViewed, clientSubmitPaymentProof, clientSubmitProfileChange, clientAddContact, clientAddTraveler, clientApproveChangeImpact, clientCancelChangeRequestOnServer, clientRespondToQuotation, clientSubmitChangeRequest, clientDisputeInvoice, clientEditContact, clientMarkMessagesRead, clientRemoveContact, clientSendMessage, clientUploadDocument
} from './client-portal-writes'
import { CHANGE_REQUESTS, CONTACTS, DOCUMENT_RECORDS, INVOICES, MESSAGE_RECORDS, PARTIES, QUOTATIONS, TRAVELERS } from './index'
import type { ManovaApi } from '~/lib/api/endpoints'

const ok = <T>(data: T) => Promise.resolve({ data })
const fail = () => Promise.reject(Object.assign(new Error('Project sudah berjalan'), { status: 422 }))
const apiWith = (core: Record<string, unknown>) => ({ core } as unknown as Pick<ManovaApi, 'core'>)

const traveler = { id: 'TRV-900', projectId: 'PRJ-201', partyId: null, leadId: null, salesOrderId: null, groupId: null, name: 'Peserta Server', passportNumber: null, passportExpiryDate: null, idNumber: null, visaNumber: null, visaExpiryDate: null, emergencyContactName: null, emergencyContactPhone: null, specialRequest: null, dietaryRestrictions: null, accessibilityNeeds: null, companionOfTravelerId: null, isVip: false, cancelled: false, cancelReason: null, replacedByTravelerId: null, replacesTravelerId: null, documentsVerifiedOn: null, documentsVerifiedBy: null }

describe('client portal writes (S12b-1)', () => {
  it('a server traveler is added locally; a refused write changes nothing', async () => {
    const t = await clientAddTraveler(apiWith({ clientCreateTraveler: () => ok(traveler) }), 'PRJ-201', { name: 'Peserta Server' })
    expect(t.id).toBe('TRV-900')
    expect(TRAVELERS.some(x => x.id === 'TRV-900')).toBe(true)
    const before = TRAVELERS.length
    await expect(clientAddTraveler(apiWith({ clientCreateTraveler: fail }), 'PRJ-202', { name: 'Telat' })).rejects.toThrow()
    expect(TRAVELERS.length).toBe(before)
  })

  it('documents and messages land in the local lists with server ids', async () => {
    const doc = { id: 'DOC-900', entityType: 'project', entityId: 'PRJ-201', projectId: 'PRJ-201', name: 'Rundown', category: 'Rundown', version: 1, accessLevel: 'client', sourceType: 'uploaded', previewRoute: null, uploadedBy: null, uploadedAt: '2026-10-19', generatedAt: null, expiresAt: null, supersedesId: null, verified: false, verifiedBy: null, verifiedAt: null }
    await clientUploadDocument(apiWith({ clientCreateDocument: () => ok(doc) }), { entityType: 'project', entityId: 'PRJ-201', name: 'Rundown', category: 'Rundown' })
    expect(DOCUMENT_RECORDS.find(d => d.id === 'DOC-900')).toBeTruthy()
    const msg = { id: 'MSG-900', entityType: 'project', entityId: 'PRJ-201', projectId: 'PRJ-201', channel: 'client-message', senderId: 'USR-021', body: 'Halo', mentions: [], deliveryStatus: 'delivered', deliveryChannel: 'email', attachmentName: null, readBy: [], sentAt: '2026-10-19T00:00:00.000Z' }
    await clientSendMessage(apiWith({ clientSendMessage: () => ok(msg) }), { projectId: 'PRJ-201', body: 'Halo' })
    expect(MESSAGE_RECORDS.find(m => m.id === 'MSG-900')).toBeTruthy()
    const mark = vi.fn(() => ok({ updated: 1 }))
    await clientMarkMessagesRead(apiWith({ clientMarkMessagesRead: mark }), 'PRJ-201', 'USR-021')
    expect(mark).toHaveBeenCalledWith('PRJ-201')
    expect(MESSAGE_RECORDS.filter(m => m.projectId === 'PRJ-201' && m.channel === 'client-message').every(m => m.readBy.includes('USR-021'))).toBe(true)
  })

  it('contacts and disputes follow the server', async () => {
    await clientAddContact(apiWith({ clientCreateContact: () => ok({ id: 'CP-900', partyId: 'PTY-005', name: 'Rina', title: 'HR', email: null, phone: null }) }), { name: 'Rina', title: 'HR' })
    expect(CONTACTS.find(x => x.id === 'CP-900')?.name).toBe('Rina')
    await clientEditContact(apiWith({ clientUpdateContact: () => ok({ id: 'CP-900', partyId: 'PTY-005', name: 'Rina', title: 'HR', email: null, phone: '0812' }) }), 'CP-900', { phone: '0812' })
    expect(CONTACTS.find(x => x.id === 'CP-900')?.phone).toBe('0812')
    await clientRemoveContact(apiWith({ clientDeleteContact: () => ok({ id: 'CP-900', deleted: true }) }), 'CP-900')
    expect(CONTACTS.some(x => x.id === 'CP-900')).toBe(false)

    const inv = { id: 'CINV-950', number: 'INV-950', project: { id: 'PRJ-201', name: 'P' }, invoiceType: 'dp', status: 'issued', settlement: 'open', overdue: false, daysOverdue: 0, currency: 'IDR', totalMinor: '1000', paidMinor: '0', creditedMinor: '0', outstandingMinor: '1000', issueDate: '2026-10-01', dueDate: '2026-10-30', isDisputed: true, disputeReason: 'Salah', voidReason: null, billingSnapshot: null, lines: [], payments: [], creditNotes: [] }
    INVOICES.push({ id: 'CINV-950', projectId: 'PRJ-201', label: 'INV-950', amountIdr: 1000, issuedAt: '2026-10-01', dueAt: '2026-10-30', status: 'unpaid' } as never)
    const result = await clientDisputeInvoice(apiWith({ clientDisputeInvoice: () => ok(inv) }), 'PTY-005', 'CINV-950', 'Salah')
    expect(result.status).toBe('disputed')
    expect(INVOICES.find(i => i.id === 'CINV-950')?.disputeReason).toBe('Salah')
  })
})

describe('bulk cancel targets (S12b-1 review)', () => {
  it('only selected, not yet cancelled travelers of projects that have not departed', () => {
    const rows = [
      { traveler: { id: 'A', cancelled: false }, project: { id: 'P1', status: 'planning' as const } },
      { traveler: { id: 'B', cancelled: true }, project: { id: 'P1', status: 'planning' as const } },
      { traveler: { id: 'C', cancelled: false }, project: { id: 'P2', status: 'ongoing-trip' as const } },
      { traveler: { id: 'D', cancelled: false }, project: { id: 'P1', status: 'planning' as const } }
    ]
    const { targets, skipped } = cancellableSelection(rows, ['A', 'B', 'C'])
    expect(targets.map(r => r.traveler.id)).toEqual(['A'])
    expect(skipped).toBe(1)
  })
})

describe('client change requests & quotation response (S12b-2)', () => {
  const crDto = (over: Record<string, unknown> = {}) => ({
    id: 'CR-950',
    projectId: 'PRJ-201',
    source: 'client',
    requestedBy: 'USR-021',
    submittedAt: '2026-10-19T00:00:00.000Z',
    affectedEntities: [{ entityType: 'project', entityId: 'PRJ-201' }],
    beforeSummary: 'Hotel A',
    afterSummary: 'Hotel B',
    operationalImpact: null,
    commercialImpactMinor: null,
    financialImpactNote: null,
    timelineImpactNote: null,
    status: 'submitted',
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    implementedAt: null,
    activityId: 'ACT-9',
    changeType: 'change-hotel',
    cancellationFeeMinor: null,
    clientDecidedBy: null,
    clientDecidedAt: null,
    cancelReason: null,
    cancelledAt: null,
    ...over
  })

  it('submit, approve the impact and cancel follow the server; a refused write changes nothing', async () => {
    const created = await clientSubmitChangeRequest(apiWith({ clientCreateChangeRequest: () => ok(crDto()) }), 'PRJ-201', { changeType: 'change-hotel', beforeSummary: 'Hotel A', afterSummary: 'Hotel B' })
    expect(created).toMatchObject({ id: 'CR-950', status: 'submitted', changeType: 'change-hotel' })
    expect(CHANGE_REQUESTS.some(r => r.id === 'CR-950')).toBe(true)
    await clientApproveChangeImpact(apiWith({ clientApproveChangeRequest: () => ok(crDto({ status: 'approved', clientDecidedBy: 'USR-021' })) }), 'CR-950')
    expect(CHANGE_REQUESTS.find(r => r.id === 'CR-950')?.status).toBe('approved')
    await expect(clientCancelChangeRequestOnServer(apiWith({ clientCancelChangeRequest: () => Promise.reject(new Error('422')) }), 'CR-950', 'Tidak jadi')).rejects.toThrow()
    expect(CHANGE_REQUESTS.find(r => r.id === 'CR-950')?.status).toBe('approved')
  })

  it('the client’s quotation answer replaces the local quotation', async () => {
    QUOTATIONS.push({ id: 'QUO-952', leadId: 'LED-952', amountIdr: 1, createdAt: '2026-10-01' } as never)
    const dto = { id: 'QUO-952', version: 1, createdOn: '2026-10-01', sentToClientOn: '2026-10-02', accepted: false, projectId: null, currency: 'IDR', amountMinor: '1000', discountMinor: null, taxMinor: null, previousAmountMinor: null, serviceBreakdown: [], paymentTerms: null, validUntil: null, termsAndConditions: null, inclusions: null, exclusions: null, cancellationPolicy: null, proposedItineraryNote: null, preparedByName: null, clientResponse: { response: 'rejected', note: 'Terlalu mahal', version: 1, respondedAt: '2026-10-19T00:00:00.000Z' }, lead: { id: 'LED-952', title: null, companyName: null, name: 'X', destination: null, travelStartDate: null, travelEndDate: null, travelerEstimate: null, serviceScope: [] } }
    const q = await clientRespondToQuotation(apiWith({ respondToQuotation: () => ok(dto) }), 'QUO-952', { response: 'rejected', note: 'Terlalu mahal' })
    expect(q.clientResponse?.response).toBe('rejected')
    expect(QUOTATIONS.find(x => x.id === 'QUO-952')?.clientResponse?.note).toBe('Terlalu mahal')
  })
})

describe('payment proof, viewed & profile change (S12c-1)', () => {
  const invDto = (over: Record<string, unknown> = {}) => ({ id: 'CINV-960', number: 'INV-960', project: { id: 'PRJ-201', name: 'P' }, invoiceType: 'dp', status: 'issued', settlement: 'open', overdue: false, daysOverdue: 0, currency: 'IDR', totalMinor: '9000000', paidMinor: '0', creditedMinor: '0', outstandingMinor: '9000000', issueDate: '2026-10-01', dueDate: '2026-10-30', isDisputed: false, disputeReason: null, voidReason: null, billingSnapshot: null, lines: [], payments: [], creditNotes: [], paymentProof: null, viewedAt: null, ...over })
  it('a sent proof makes the local invoice wait for verification; marking viewed sets the time', async () => {
    INVOICES.push({ id: 'CINV-960', projectId: 'PRJ-201', label: 'INV-960', amountIdr: 9_000_000, issuedAt: '2026-10-01', dueAt: '2026-10-30', status: 'unpaid' } as never)
    const proof = { id: 'PPF-1', status: 'submitted', reference: 'TRF-1', amountMinor: '4000000', transferDate: '2026-10-18', senderBank: 'BCA', note: null, fileName: null, submittedAt: '2026-10-18T03:00:00.000Z', reviewedAt: null, rejectionReason: null }
    const inv = await clientSubmitPaymentProof(apiWith({ clientSubmitPaymentProof: () => ok(invDto({ paymentProof: proof })) }), 'PTY-005', 'CINV-960', { reference: 'TRF-1', amountMinor: '4000000', transferDate: '2026-10-18' })
    expect(inv.status).toBe('waiting-verification')
    await clientMarkInvoiceViewed(apiWith({ clientMarkInvoiceViewed: () => ok({ viewedAt: '2026-10-19T01:00:00.000Z' }) }), 'CINV-960')
    expect(INVOICES.find(i => i.id === 'CINV-960')?.viewedAt).toBe('2026-10-19T01:00:00.000Z')
  })
  it('a proposed profile change shows as pending on the party', async () => {
    const party = PARTIES.find(p => p.id === 'PTY-005')!
    const dto = { ...party, id: 'PTY-005', name: party.name, npwp: null, pendingChange: { id: 'PPC-1', changes: { npwp: '01.234.567.8-901.234' }, status: 'submitted', submittedAt: '2026-10-19T02:00:00.000Z' } }
    await clientSubmitProfileChange(apiWith({ clientSubmitProfileChange: () => ok(dto) }), { npwp: '01.234.567.8-901.234' })
    expect(PARTIES.find(p => p.id === 'PTY-005')).toMatchObject({ pendingProfileChange: { npwp: '01.234.567.8-901.234' }, pendingProfileChangeSubmittedAt: '2026-10-19T02:00:00.000Z' })
  })
})
