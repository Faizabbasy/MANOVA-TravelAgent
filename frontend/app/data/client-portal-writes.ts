import { reloadProjectTravelers, upsertServerRoom, upsertServerTraveler } from './travelers-sync'
import { documentFromServer, messageFromServer } from './documents-sync'
import { contactFromServer, upsertServerParty } from './parties-sync'
import { invoiceFromClientServer } from './client-commerce-sync'
import { CONTACTS, DOCUMENT_RECORDS, INVOICES, MESSAGE_RECORDS } from './index'
import type { ManovaApi } from '~/lib/api/endpoints'
import type { ClientContactInput, ClientDocumentInput, ClientMessageInput, PartyProfileInput, TravelerInput } from '~/types/api'

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
export const clientUpdateProfile = async (api: CoreApi, input: PartyProfileInput) => upsertServerParty((await api.core.updateClientProfile(input)).data)
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
