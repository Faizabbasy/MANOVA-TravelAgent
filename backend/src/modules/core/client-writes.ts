import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { actorName, recordProjectActivity } from './activities'
import { createDocument, listDocuments, sendMessage } from './documents'
import { notify } from './notifications'
import { createActivity, createContact, deleteContact, updateContact, updateParty } from './party-writes'
import { setInvoiceDispute } from '../finance/receivables'
import { cancelTraveler, createRoom, createTraveler, importTravelers, replaceTraveler, rule, setRoomTravelers, updateTraveler } from './travelers'

/**
 * Client portal writes (S12b-1). The party comes from the session; anything of another party is "not found". The
 * internal write functions do the work; this layer checks ownership, the participant status lock and the fields a
 * client may send, then logs the change on the project and tells the staff who own it.
 */

export const LOCKED_PROJECT_STATUSES = ['ongoing-trip', 'completed', 'cancelled']
export const LOCKED_MESSAGE = 'Project sudah berjalan, selesai atau dibatalkan — ajukan perubahan peserta lewat change request.'

export type OwnProject = { id: string; name: string; status: string; ownerUserId: string | null }

export async function ownProject(tx: Queryable, partyId: string, projectId: unknown, opts: { lockedTravelers?: boolean } = {}): Promise<OwnProject> {
  if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) throw errors.notFound('Project')
  const [p] = await tx.query<{ id: string; name: string; status: string; owner_user_id: string | null }>(
    'select id, name, status, owner_user_id from projects where id = $1 and party_id = $2', [projectId, partyId])
  if (!p) throw errors.notFound('Project')
  if (opts.lockedTravelers && LOCKED_PROJECT_STATUSES.includes(p.status)) throw rule(LOCKED_MESSAGE)
  return { id: p.id, name: p.name, status: p.status, ownerUserId: p.owner_user_id }
}

/** Notifies one internal user (owner, account owner, Finance); nobody when the user is missing or a portal user. */
export async function notifyInternal(tx: Queryable, actor: Actor, userId: string | null, n: { type: string; title: string; body: string; entityType: string; entityId: string }) {
  if (!userId) return
  const [u] = await tx.query("select 1 from users where id = $1 and role not in ('client', 'vendor') and status = 'active'", [userId])
  if (!u) return
  await notify(tx, { userId, actorUserId: actor.userId, ...n })
}

/** The project's activity log line plus a notification to the project owner. */
export async function tellProject(tx: Queryable, actor: Actor, project: OwnProject, a: { type: 'change' | 'document' | 'message'; title: string; message: string; sourceAction: string; sourceEntityId: string }) {
  await recordProjectActivity(tx, { projectId: project.id, actorUserId: actor.userId, sourceAction: a.sourceAction, sourceEntityId: a.sourceEntityId, message: a.message })
  await notifyInternal(tx, actor, project.ownerUserId, { type: a.type, title: a.title, body: a.message, entityType: 'project', entityId: project.id })
}

/* ---------- participants & rooms ---------- */

const STAFF_FIELDS = ['isVip', 'documentsVerified', 'documentsVerifiedOn', 'documentsVerifiedBy', 'cancelled', 'cancelReason', 'salesOrderId', 'leadId', 'partyId']

function refuseStaffFields(input: Record<string, unknown>) {
  const bad = Object.keys(input).filter(key => STAFF_FIELDS.includes(key))
  if (bad.length) throw errors.validation(Object.fromEntries(bad.map(key => [key, ['Hanya bisa diubah tim MANOVA.']])))
}

async function travelerOf(tx: Queryable, partyId: string, travelerId: string) {
  const [r] = await tx.query<{ project_id: string; name: string }>(
    'select t.project_id, t.name from travelers t join projects p on p.id = t.project_id where t.id = $1 and p.party_id = $2', [travelerId, partyId])
  if (!r) throw errors.notFound('Traveler')
  return { projectId: r.project_id, name: r.name }
}

const by = async (tx: Queryable, actor: Actor) => `client ${await actorName(tx, actor.userId)}`

export async function clientCreateTraveler(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  refuseStaffFields(input)
  const project = await ownProject(tx, partyId, projectId, { lockedTravelers: true })
  const { id } = await createTraveler(tx, actor, project.id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.created', sourceEntityId: id, title: `Peserta baru di ${project.name}`,
    message: `Peserta ${String(input.name).trim()} (${id}) ditambahkan oleh ${await by(tx, actor)}.` })
  return { id }
}

export async function clientUpdateTraveler(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  refuseStaffFields(input)
  const tr = await travelerOf(tx, partyId, id)
  const project = await ownProject(tx, partyId, tr.projectId, { lockedTravelers: true })
  await updateTraveler(tx, actor, id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.updated', sourceEntityId: id, title: `Data peserta diubah di ${project.name}`,
    message: `Data peserta ${tr.name} (${id}) diperbarui oleh ${await by(tx, actor)}.` })
}

export async function clientCancelTraveler(tx: Queryable, actor: Actor, partyId: string, id: string, reason: unknown, requestId: string) {
  const tr = await travelerOf(tx, partyId, id)
  const project = await ownProject(tx, partyId, tr.projectId, { lockedTravelers: true })
  await cancelTraveler(tx, actor, id, reason, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.cancelled', sourceEntityId: id, title: `Peserta dibatalkan di ${project.name}`,
    message: `Peserta ${tr.name} (${id}) dibatalkan oleh ${await by(tx, actor)}: ${String(reason).trim()}` })
}

export async function clientReplaceTraveler(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  refuseStaffFields(input)
  const tr = await travelerOf(tx, partyId, id)
  const project = await ownProject(tx, partyId, tr.projectId, { lockedTravelers: true })
  const { id: newId } = await replaceTraveler(tx, actor, id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.replaced', sourceEntityId: newId, title: `Peserta diganti di ${project.name}`,
    message: `Peserta ${tr.name} (${id}) digantikan oleh ${String(input.name).trim()} (${newId}) — ${await by(tx, actor)}.` })
  return { id: newId }
}

export async function clientImportTravelers(tx: Queryable, actor: Actor, partyId: string, projectId: string, rows: unknown, requestId: string) {
  const project = await ownProject(tx, partyId, projectId, { lockedTravelers: true })
  const result = await importTravelers(tx, actor, project.id, rows, requestId)
  if (result.created.length) {
    await tellProject(tx, actor, project, { type: 'change', sourceAction: 'traveler.imported', sourceEntityId: project.id, title: `Impor peserta di ${project.name}`,
      message: `${result.created.length} peserta diimpor oleh ${await by(tx, actor)}.` })
  }
  return result
}

export async function clientCreateRoom(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  const project = await ownProject(tx, partyId, projectId, { lockedTravelers: true })
  const { id } = await createRoom(tx, actor, project.id, input, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'room.created', sourceEntityId: id, title: `Kamar baru di ${project.name}`,
    message: `Kamar ${String(input.roomLabel).trim()} (${id}) dibuat oleh ${await by(tx, actor)}.` })
  return { id }
}

export async function clientSetRoomTravelers(tx: Queryable, actor: Actor, partyId: string, roomId: string, travelerIds: unknown, requestId: string) {
  const [room] = await tx.query<{ project_id: string; room_label: string }>(
    'select r.project_id, r.room_label from room_assignments r join projects p on p.id = r.project_id where r.id = $1 and p.party_id = $2', [roomId, partyId])
  if (!room) throw errors.notFound('Kamar')
  const project = await ownProject(tx, partyId, room.project_id, { lockedTravelers: true })
  await setRoomTravelers(tx, actor, roomId, travelerIds, requestId)
  await tellProject(tx, actor, project, { type: 'change', sourceAction: 'room.travelers_set', sourceEntityId: roomId, title: `Penghuni kamar diubah di ${project.name}`,
    message: `Penghuni kamar ${room.room_label} (${roomId}) diubah oleh ${await by(tx, actor)}.` })
}

/* ---------- documents & messages ---------- */

const accountOwnerOf = async (tx: Queryable, partyId: string) =>
  (await tx.query<{ account_owner_user_id: string | null }>('select account_owner_user_id from parties where id = $1', [partyId]))[0]?.account_owner_user_id ?? null

/** Where a client document goes: its own project, a traveler of its projects, or its own company (party). */
async function documentTarget(tx: Queryable, partyId: string, input: Record<string, unknown>) {
  if (input.entityType === 'project') {
    const project = await ownProject(tx, partyId, input.entityId)
    return { entityType: 'project', entityId: project.id, project }
  }
  if (input.entityType === 'traveler') {
    if (typeof input.entityId !== 'string' || !ID_PATTERN.test(input.entityId)) throw errors.notFound('Traveler')
    const tr = await travelerOf(tx, partyId, input.entityId)
    return { entityType: 'traveler', entityId: input.entityId, project: await ownProject(tx, partyId, tr.projectId) }
  }
  if (input.entityType === 'party') {
    if (input.entityId !== partyId) throw errors.notFound('Customer')
    return { entityType: 'party', entityId: partyId, project: null }
  }
  throw errors.validation({ entityType: ['Dokumen client hanya untuk project, peserta, atau perusahaan.'] })
}

async function tellDocument(tx: Queryable, actor: Actor, partyId: string, project: OwnProject | null, id: string, name: string, verb: string) {
  const message = `Dokumen ${name} (${id}) ${verb} oleh ${await by(tx, actor)} — menunggu verifikasi.`
  if (project) await tellProject(tx, actor, project, { type: 'document', sourceAction: 'document.created', sourceEntityId: id, title: `Dokumen client di ${project.name}`, message })
  else await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'document', title: 'Dokumen perusahaan dari client', body: message, entityType: 'party', entityId: partyId })
}

export async function clientCreateDocument(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const target = await documentTarget(tx, partyId, input)
  const { id } = await createDocument(tx, actor, {
    entityType: target.entityType, entityId: target.entityId, projectId: target.project?.id ?? null,
    name: input.name, category: input.category, expiresOn: input.expiresOn, accessLevel: 'client'
  }, requestId)
  await tellDocument(tx, actor, partyId, target.project, id, String(input.name).trim(), 'diunggah')
  return { id }
}

/** A new version of a client document: same entity, version + 1, `supersedes_id` the old one. */
export async function clientReplaceDocument(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  const [old] = await listDocuments(tx, { id, partyId })
  if (!old) throw errors.notFound('Dokumen')
  await tx.query('select id from documents where id = $1 for update', [id])
  if (old.sourceType !== 'uploaded') throw rule('Dokumen buatan sistem tidak bisa diganti dari portal.')
  if ((await tx.query('select 1 from documents where supersedes_id = $1', [id])).length) throw rule('Dokumen ini sudah digantikan versi yang lebih baru.')
  const { id: newId } = await createDocument(tx, actor, {
    entityType: old.entityType, entityId: old.entityId, projectId: old.projectId,
    name: input.name ?? old.name, category: input.category ?? old.category, expiresOn: input.expiresOn ?? old.expiresAt, accessLevel: 'client'
  }, requestId)
  await tx.query('update documents set version = $2, supersedes_id = $3 where id = $1', [newId, old.version + 1, id])
  const project = old.projectId ? await ownProject(tx, partyId, old.projectId) : null
  await tellDocument(tx, actor, partyId, project, newId, String(input.name ?? old.name).trim(), `(versi ${old.version + 1}) diunggah`)
  return { id: newId }
}

export async function clientSendMessage(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const mentions = input.mentions
  if (mentions !== undefined && mentions !== null && !(Array.isArray(mentions) && mentions.length === 0)) throw errors.validation({ mentions: ['Client tidak bisa me-mention.'] })
  const project = await ownProject(tx, partyId, input.projectId)
  const { id } = await sendMessage(tx, actor, {
    entityType: 'project', entityId: project.id, projectId: project.id, channel: 'client-message', body: input.body, attachmentName: input.attachmentName
  }, requestId)
  await notifyInternal(tx, actor, project.ownerUserId, { type: 'message', title: `Pesan client di ${project.name}`, body: String(input.body).trim(), entityType: 'project', entityId: project.id })
  return { id }
}

export async function clientMarkMessagesRead(tx: Queryable, actor: Actor, partyId: string, projectId: string) {
  const project = await ownProject(tx, partyId, projectId)
  const rows = await tx.query<{ id: string }>(
    `update messages set read_by = read_by || $2::text::jsonb
      where project_id = $1 and channel = 'client-message' and not (read_by ? $3) returning id`,
    [project.id, JSON.stringify([actor.userId]), actor.userId])
  return { updated: rows.length }
}

/* ---------- profile, contacts & disputes ---------- */

const CLIENT_PROFILE_FIELDS = ['industry', 'size', 'address', 'city', 'province', 'country', 'postalCode', 'phone', 'website', 'email', 'companyType', 'poRequired', 'travelPreferences']
const SENSITIVE_PROFILE_FIELDS = ['name', 'npwp', 'registrationNumber', 'billingName', 'billingAddress', 'paymentTerm', 'accountOwnerUserId']

export async function clientUpdateProfile(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, today: string, requestId: string) {
  if (Object.keys(input).some(key => SENSITIVE_PROFILE_FIELDS.includes(key))) throw rule('Perubahan data registrasi/pajak/billing diajukan lewat verifikasi.')
  const unknown = Object.keys(input).filter(key => !CLIENT_PROFILE_FIELDS.includes(key))
  if (unknown.length) throw errors.validation(Object.fromEntries(unknown.map(key => [key, ['Tidak bisa diubah dari portal.']])))
  if (!Object.keys(input).length) return
  await updateParty(tx, actor, partyId, input, requestId)
  await createActivity(tx, actor, partyId, { type: 'note', message: 'Company Profile diperbarui oleh Client.' }, today, requestId)
  await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'change', title: 'Company Profile diperbarui client', body: `Field: ${Object.keys(input).join(', ')}.`, entityType: 'party', entityId: partyId })
}

export async function clientCreateContact(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const { id } = await createContact(tx, actor, partyId, input, requestId)
  await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'change', title: 'Kontak baru dari client', body: `${String(input.name).trim()} (${id}) ditambahkan.`, entityType: 'party', entityId: partyId })
  return { id }
}

export const clientUpdateContact = (tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) =>
  updateContact(tx, actor, partyId, id, input, requestId)

export async function clientDeleteContact(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  await deleteContact(tx, actor, partyId, id, requestId)
  await notifyInternal(tx, actor, await accountOwnerOf(tx, partyId), { type: 'change', title: 'Kontak dihapus client', body: `Kontak ${id} dihapus.`, entityType: 'party', entityId: partyId })
}

/** The caller has checked the invoice is the party's, issued and not settled (`getClientInvoice`). */
export async function clientDisputeInvoice(tx: Queryable, actor: Actor, partyId: string, id: string, reason: unknown, requestId: string) {
  await setInvoiceDispute(tx, actor, id, { disputed: true, reason: reason as string }, requestId)
  const finance = await tx.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id")
  for (const u of finance) {
    await notifyInternal(tx, actor, u.id, { type: 'reminder', title: `Invoice ${id} disengketakan client`, body: String(reason).trim(), entityType: 'invoice', entityId: id })
  }
}
