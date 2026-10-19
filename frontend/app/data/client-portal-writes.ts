import { reloadProjectTravelers, upsertServerRoom, upsertServerTraveler } from './travelers-sync'
import { documentFromServer, messageFromServer } from './documents-sync'
import { contactFromServer } from './parties-sync'
import { applyClientProfile, invoiceFromClientServer, quotationFromClientServer } from './client-commerce-sync'
import { upsertServerChangeRequest } from './changes-sync'
import { CONTACTS, DOCUMENT_RECORDS, INVOICES, MESSAGE_RECORDS, QUOTATIONS } from './index'
import type { ManovaApi } from '~/lib/api/endpoints'
import type { ProjectStatus } from '~/types/project'
import type { ChangeRequestType } from '~/types/change-incident'
import type { QuotationClientResponse } from '~/types/quotation'
import type { ClientContactInput, ClientDocumentInput, ClientMessageInput, PartyProfileInput, PaymentProofInput, ProfileChangeDto, TravelerInput } from '~/types/api'

/**
 * Client portal writes (S12b-1): every action goes to /client/* first and only the server's answer changes the local
 * lists — a refused write (locked project, another party, staff-only field) leaves them as they were.
 */

type CoreApi = Pick<ManovaApi, 'core'>

const upsert = <T extends { id: string }>(list: T[], row: T): T => {
  const i = list.findIndex(x => x.id === row.id)
  if (i === -1) { list.push(row) } else { list.splice(i, 1, row) }
  return row
}

/* participants & rooms */
export const clientAddTraveler = async (api: CoreApi, projectId: string, input: TravelerInput & { name: string }) =>
  upsertServerTraveler((await api.core.clientCreateTraveler(projectId, input)).data)
export const clientEditTraveler = async (api: CoreApi, id: string, input: TravelerInput) =>
  upsertServerTraveler((await api.core.clientUpdateTraveler(id, input)).data)
export async function clientCancelTraveler (api: CoreApi, projectId: string, id: string, reason: string): Promise<void> {
  await api.core.clientCancelTraveler(id, reason)
  await reloadProjectTravelers(api, projectId) // the traveler also leaves its room
}
export async function clientReplaceTraveler (api: CoreApi, projectId: string, id: string, input: TravelerInput & { name: string }) {
  const created = (await api.core.clientReplaceTraveler(id, input)).data
  await reloadProjectTravelers(api, projectId) // old one cancelled, room handed over
  return upsertServerTraveler(created)
}
export async function clientImportTravelers (api: CoreApi, projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[]) {
  const result = (await api.core.clientImportTravelers(projectId, rows)).data
  await reloadProjectTravelers(api, projectId)
  return result
}
export const clientCreateRoom = async (api: CoreApi, projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }) =>
  upsertServerRoom((await api.core.clientCreateRoom(projectId, input)).data)
export async function clientSetRoomTravelers (api: CoreApi, projectId: string, id: string, travelerIds: string[]) {
  const room = upsertServerRoom((await api.core.clientSetRoomTravelers(id, travelerIds)).data)
  await reloadProjectTravelers(api, projectId) // travelers moved out of their other rooms
  return room
}

/* documents & messages */
export const clientUploadDocument = async (api: CoreApi, input: ClientDocumentInput) =>
  upsert(DOCUMENT_RECORDS, documentFromServer((await api.core.clientCreateDocument(input)).data))
export const clientReplaceDocument = async (api: CoreApi, id: string, input: { name?: string; category?: string; expiresOn?: string }) =>
  upsert(DOCUMENT_RECORDS, documentFromServer((await api.core.clientReplaceDocument(id, input)).data))
export const clientSendMessage = async (api: CoreApi, input: ClientMessageInput) =>
  upsert(MESSAGE_RECORDS, messageFromServer((await api.core.clientSendMessage(input)).data))
export async function clientMarkMessagesRead (api: CoreApi, projectId: string, userId: string): Promise<void> {
  await api.core.clientMarkMessagesRead(projectId)
  for (const m of MESSAGE_RECORDS) {
    if (m.projectId === projectId && m.channel === 'client-message' && !m.readBy.includes(userId)) { m.readBy.push(userId) }
  }
}

/* profile, contacts & disputes */
export const clientUpdateProfile = async (api: CoreApi, input: PartyProfileInput) => applyClientProfile((await api.core.updateClientProfile(input)).data)
export const clientAddContact = async (api: CoreApi, input: ClientContactInput & { name: string; title: string }) =>
  upsert(CONTACTS, contactFromServer((await api.core.clientCreateContact(input)).data))
export const clientEditContact = async (api: CoreApi, id: string, input: ClientContactInput) =>
  upsert(CONTACTS, contactFromServer((await api.core.clientUpdateContact(id, input)).data))
export async function clientRemoveContact (api: CoreApi, id: string): Promise<void> {
  await api.core.clientDeleteContact(id)
  const i = CONTACTS.findIndex(x => x.id === id)
  if (i !== -1) { CONTACTS.splice(i, 1) }
}
export const clientDisputeInvoice = async (api: CoreApi, partyId: string, id: string, reason: string) =>
  upsert(INVOICES, invoiceFromClientServer((await api.core.clientDisputeInvoice(id, reason)).data, partyId))

/* project lock for participant writes (same rule as the server) */
export const PARTICIPANTS_LOCKED_HINT = 'Project sudah berjalan, selesai atau dibatalkan — ajukan perubahan peserta lewat change request.'
export const participantsLocked = (status: ProjectStatus): boolean => status === 'ongoing-trip' || status === 'completed' || status === 'cancelled'

/**
 * Bulk cancel: the selected travelers the server will accept — not already cancelled, on a project that has not
 * departed. `skipped` counts the selected ones left out, so the screen can say so instead of failing halfway.
 */
export function cancellableSelection<R extends { traveler: { id: string; cancelled?: boolean }; project: { status: ProjectStatus } }> (rows: R[], selectedIds: string[]) {
  const selected = rows.filter(row => selectedIds.includes(row.traveler.id) && !row.traveler.cancelled)
  const targets = selected.filter(row => !participantsLocked(row.project.status))
  return { targets, skipped: selected.length - targets.length }
}

/* change requests & quotation response (S12b-2) */
export const clientSubmitChangeRequest = async (api: CoreApi, projectId: string, input: { changeType?: ChangeRequestType; category?: string; beforeSummary: string; afterSummary: string }) =>
  upsertServerChangeRequest((await api.core.clientCreateChangeRequest(projectId, input)).data)
export const clientApproveChangeImpact = async (api: CoreApi, id: string) => upsertServerChangeRequest((await api.core.clientApproveChangeRequest(id)).data)
export const clientRejectChangeImpact = async (api: CoreApi, id: string, reason: string) => upsertServerChangeRequest((await api.core.clientRejectChangeRequest(id, reason)).data)
export const clientCancelChangeRequestOnServer = async (api: CoreApi, id: string, reason: string) => upsertServerChangeRequest((await api.core.clientCancelChangeRequest(id, reason)).data)
export const clientRespondToQuotation = async (api: CoreApi, id: string, input: { response: QuotationClientResponse['response']; note?: string }) =>
  upsert(QUOTATIONS, quotationFromClientServer((await api.core.respondToQuotation(id, input)).data))

/* payment proof, invoice viewed & sensitive profile change (S12c-1) */
export const clientSubmitPaymentProof = async (api: CoreApi, partyId: string, invoiceId: string, input: PaymentProofInput) =>
  upsert(INVOICES, invoiceFromClientServer((await api.core.clientSubmitPaymentProof(invoiceId, input)).data, partyId))
export async function clientMarkInvoiceViewed (api: CoreApi, invoiceId: string): Promise<void> {
  const { viewedAt } = (await api.core.clientMarkInvoiceViewed(invoiceId)).data
  const invoice = INVOICES.find(i => i.id === invoiceId)
  if (invoice) { invoice.viewedAt = viewedAt }
}
export const clientSubmitProfileChange = async (api: CoreApi, changes: ProfileChangeDto['changes']) =>
  applyClientProfile((await api.core.clientSubmitProfileChange(changes)).data)
