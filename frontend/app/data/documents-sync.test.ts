import { describe, expect, it } from 'vitest'
import { DOCUMENT_RECORDS, MESSAGE_RECORDS, NOTIFICATION_RECORDS } from './document-comms'
import { documentFromServer, mergeServerDocuments, messageFromServer, sendMessageOnServer } from './documents-sync'
import type { DocumentDto, MessageDto } from '~/types/api'

const doc = (over: Partial<DocumentDto> = {}): DocumentDto => ({
  id: 'DOC-C001',
  entityType: 'project',
  entityId: 'PRJ-101',
  projectId: 'PRJ-101',
  name: 'Kontrak.pdf',
  category: 'Kontrak',
  version: 1,
  accessLevel: 'internal',
  sourceType: 'uploaded',
  previewRoute: null,
  uploadedBy: 'USR-002',
  uploadedAt: '2026-07-01',
  generatedAt: null,
  expiresAt: null,
  supersedesId: null,
  verified: false,
  verifiedBy: null,
  verifiedAt: null,
  ...over
})
const msg = (over: Partial<MessageDto> = {}): MessageDto => ({
  id: 'MSG-001',
  entityType: 'project',
  entityId: 'PRJ-101',
  projectId: 'PRJ-101',
  channel: 'internal-note',
  senderId: 'USR-002',
  body: 'Halo',
  mentions: [],
  sentAt: '2026-07-01T02:00:00.000Z',
  deliveryStatus: 'sent',
  deliveryChannel: null,
  attachmentName: null,
  readBy: ['USR-002'],
  ...over
})

describe('documents-sync', () => {
  it('maps server documents and messages to the local shapes', () => {
    expect(documentFromServer(doc()).expiresAt).toBeUndefined()
    expect(documentFromServer(doc({ expiresAt: '2026-12-31' })).expiresAt).toBe('2026-12-31')
    expect(messageFromServer(msg()).deliveryChannel).toBeUndefined()
  })

  it('merge keeps identity, drops server-gone rows and keeps rows the client portal wrote locally (DOC-L / MSG-L)', () => {
    const before = DOCUMENT_RECORDS.find(x => x.id === 'DOC-C001')!
    DOCUMENT_RECORDS.push({ ...before, id: 'DOC-L001' })
    MESSAGE_RECORDS.push({ ...messageFromServer(msg()), id: 'MSG-L001' })
    mergeServerDocuments([doc({ name: 'Nama Server' })], [msg()])
    expect(DOCUMENT_RECORDS.map(x => x.id).sort()).toEqual(['DOC-C001', 'DOC-L001'])
    expect(DOCUMENT_RECORDS.find(x => x.id === 'DOC-C001')).toBe(before)
    expect(before.name).toBe('Nama Server')
    expect(MESSAGE_RECORDS.map(x => x.id).sort()).toEqual(['MSG-001', 'MSG-L001'])
  })

  it('a sent message is added locally; the mention notification is created by the server, not locally (S9b)', async () => {
    const before = NOTIFICATION_RECORDS.length
    const api = { core: { sendMessage: () => Promise.resolve({ data: msg({ id: 'MSG-050', mentions: ['USR-003'], body: 'Cek @Andi' }) }) } } as never
    const sent = await sendMessageOnServer(api, { entityType: 'project', entityId: 'PRJ-101', projectId: 'PRJ-101', channel: 'internal-note', body: 'Cek @Andi', mentions: ['USR-003'] })
    expect(sent.id).toBe('MSG-050')
    expect(MESSAGE_RECORDS.some(x => x.id === 'MSG-050')).toBe(true)
    expect(NOTIFICATION_RECORDS.length).toBe(before)
  })
})
