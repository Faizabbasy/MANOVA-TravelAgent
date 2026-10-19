import { describe, expect, it, vi } from 'vitest'
import {
  clientAddContact, clientAddTraveler, clientDisputeInvoice, clientEditContact, clientMarkMessagesRead, clientRemoveContact, clientSendMessage, clientUploadDocument
} from './client-portal-writes'
import { CONTACTS, DOCUMENT_RECORDS, INVOICES, MESSAGE_RECORDS, TRAVELERS } from './index'
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
