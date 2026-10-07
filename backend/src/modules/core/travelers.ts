import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'

/**
 * Travelers, traveler groups and the rooming list (S7a). Delete corrects an input mistake; cancel is the business
 * decision (soft, with a reason). Booking travelers (Group Trip) are created by the DP confirmation and cancelled
 * with their order. A traveler sits in at most one room per project.
 */

export const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

export async function listTravelers(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, group_id, party_id, lead_id, sales_order_id, name, passport_number, passport_expiry_date::text as passport_expiry_date,
            id_number, visa_number, visa_expiry_date::text as visa_expiry_date, emergency_contact_name, emergency_contact_phone, special_request,
            dietary_restrictions, accessibility_needs, companion_of, documents_verified_on::text as documents_verified_on, documents_verified_by,
            is_vip, cancelled, cancel_reason, replaced_by, replaces
       from travelers where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) order by id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    groupId: str(r.group_id),
    partyId: str(r.party_id),
    leadId: str(r.lead_id),
    salesOrderId: str(r.sales_order_id),
    name: r.name as string,
    passportNumber: str(r.passport_number),
    passportExpiryDate: str(r.passport_expiry_date),
    idNumber: str(r.id_number),
    visaNumber: str(r.visa_number),
    visaExpiryDate: str(r.visa_expiry_date),
    emergencyContactName: str(r.emergency_contact_name),
    emergencyContactPhone: str(r.emergency_contact_phone),
    specialRequest: str(r.special_request),
    dietaryRestrictions: str(r.dietary_restrictions),
    accessibilityNeeds: str(r.accessibility_needs),
    companionOfTravelerId: str(r.companion_of),
    documentsVerifiedOn: str(r.documents_verified_on),
    documentsVerifiedBy: str(r.documents_verified_by),
    isVip: r.is_vip as boolean,
    cancelled: r.cancelled as boolean,
    cancelReason: str(r.cancel_reason),
    replacedByTravelerId: str(r.replaced_by),
    replacesTravelerId: str(r.replaces)
  }))
}

export type TravelerView = Awaited<ReturnType<typeof listTravelers>>[number]

export async function listTravelerGroups(db: Queryable, projectId?: string) {
  const rows = await db.query<{ id: string; project_id: string; name: string; pax_count: number; rooming_note: string | null }>(
    'select id, project_id, name, pax_count, rooming_note from traveler_groups where ($1::text is null or project_id = $1) order by id', [projectId ?? null])
  return rows.map(r => ({ id: r.id, projectId: r.project_id, name: r.name, paxCount: Number(r.pax_count), roomingNote: r.rooming_note }))
}

export async function listRoomAssignments(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<{ id: string; project_id: string; group_id: string; room_label: string; room_type: string; traveler_ids: string[] }>(
    `select id, project_id, group_id, room_label, room_type, traveler_ids from room_assignments
      where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) order by id`, [filter.id ?? null, filter.projectId ?? null])
  return rows.map(r => ({ id: r.id, projectId: r.project_id, groupId: r.group_id, roomLabel: r.room_label, roomType: r.room_type, travelerIds: r.traveler_ids }))
}

/** API field → column for the editable traveler profile. */
const PROFILE: Record<string, { column: string; kind: 'text' | 'date' | 'group' | 'companion' }> = {
  name: { column: 'name', kind: 'text' },
  groupId: { column: 'group_id', kind: 'group' },
  passportNumber: { column: 'passport_number', kind: 'text' },
  passportExpiryDate: { column: 'passport_expiry_date', kind: 'date' },
  idNumber: { column: 'id_number', kind: 'text' },
  visaNumber: { column: 'visa_number', kind: 'text' },
  visaExpiryDate: { column: 'visa_expiry_date', kind: 'date' },
  emergencyContactName: { column: 'emergency_contact_name', kind: 'text' },
  emergencyContactPhone: { column: 'emergency_contact_phone', kind: 'text' },
  specialRequest: { column: 'special_request', kind: 'text' },
  dietaryRestrictions: { column: 'dietary_restrictions', kind: 'text' },
  accessibilityNeeds: { column: 'accessibility_needs', kind: 'text' },
  companionOfTravelerId: { column: 'companion_of', kind: 'companion' }
}

export async function cleanProfile(tx: Queryable, projectId: string, input: Record<string, unknown>, problems: FieldErrors, selfId?: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(PROFILE)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null || v === '') {
      if (field === 'name') problems.name = ['Nama traveler wajib diisi.']
      else out[spec.column] = null
      continue
    }
    if (spec.kind === 'text') {
      if (typeof v !== 'string' || v.trim().length > 500) problems[field] = ['Harus teks, maksimal 500 karakter.']
      else if (!v.trim() && field === 'name') problems.name = ['Nama traveler wajib diisi.']
      else out[spec.column] = v.trim() || null
    } else if (spec.kind === 'date') {
      if (typeof v !== 'string' || !isIsoDate(v)) problems[field] = ['Tanggal harus format YYYY-MM-DD.']
      else out[spec.column] = v
    } else {
      const table = spec.kind === 'group' ? 'traveler_groups' : 'travelers'
      const found = typeof v === 'string' && ID_PATTERN.test(v) && v !== selfId &&
        (await tx.query(`select 1 from ${table} where id = $1 and project_id = $2`, [v, projectId])).length > 0
      if (!found) problems[field] = [spec.kind === 'group' ? 'Grup tidak ditemukan di project ini.' : 'Traveler pendamping tidak ditemukan di project ini.']
      else out[spec.column] = v
    }
  }
  return out
}

export async function insertTraveler(tx: Queryable, projectId: string, values: Record<string, unknown>, links: { partyId?: string | null; leadId?: string | null; salesOrderId?: string | null; replaces?: string | null } = {}): Promise<string> {
  const id = await nextId(tx, 'TRV-')
  const cols = ['id', 'project_id', 'party_id', 'lead_id', 'sales_order_id', 'replaces', ...Object.keys(values)]
  const vals = [id, projectId, links.partyId ?? null, links.leadId ?? null, links.salesOrderId ?? null, links.replaces ?? null, ...Object.values(values)]
  await tx.query(`insert into travelers (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals)
  return id
}

export async function createTraveler(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama traveler wajib diisi.']
  const values = await cleanProfile(tx, projectId, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await insertTraveler(tx, projectId, values)
  await tx.query('update travelers set changed_by_api_at = now() where id = $1', [id])
  await recordAudit(tx, { action: 'traveler.created', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: { projectId, name: values.name } })
  return { id }
}

const FORBIDDEN = ['id', 'projectId', 'partyId', 'leadId', 'salesOrderId', 'cancelled', 'cancelReason', 'replacedByTravelerId', 'replacesTravelerId', 'documentsVerifiedOn', 'documentsVerifiedBy', 'isVip']

export async function lockTraveler(tx: Queryable, id: string) {
  const [row] = await tx.query<{ id: string; project_id: string; cancelled: boolean; sales_order_id: string | null; replaced_by: string | null; replaces: string | null; group_id: string | null }>(
    'select id, project_id, cancelled, sales_order_id, replaced_by, replaces, group_id from travelers where id = $1 for update', [id])
  if (!row) throw errors.notFound('Traveler')
  return row
}

export async function updateTraveler(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  for (const k of FORBIDDEN) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat edit traveler.']
  const current = await lockTraveler(tx, id)
  const values = await cleanProfile(tx, current.project_id, input, problems, id)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (current.cancelled) throw rule('Traveler ini sudah dibatalkan.')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update travelers set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`, [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'traveler.updated', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: values })
}

export async function removeFromRooms(tx: Queryable, projectId: string, travelerId: string) {
  await tx.query(
    `update room_assignments set traveler_ids = traveler_ids - $2::text, changed_by_api_at = now(), updated_at = now()
      where project_id = $1 and traveler_ids ? $2::text`, [projectId, travelerId])
}

export async function deleteTraveler(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const current = await lockTraveler(tx, id)
  if (current.sales_order_id || current.replaced_by || current.replaces) throw rule('Traveler ini bagian dari booking atau penggantian — batalkan, jangan hapus.')
  await removeFromRooms(tx, current.project_id, id)
  await tx.query('update travelers set companion_of = null where companion_of = $1', [id])
  await tx.query('delete from travelers where id = $1', [id])
  await recordAudit(tx, { action: 'traveler.deleted', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, before: { projectId: current.project_id } })
}

export async function setVerified(tx: Queryable, actor: Actor, id: string, verified: unknown, today: string, requestId: string) {
  if (typeof verified !== 'boolean') throw errors.validation({ verified: ['Harus ya/tidak.'] })
  await lockTraveler(tx, id)
  await tx.query('update travelers set documents_verified_on = $2, documents_verified_by = $3, changed_by_api_at = now(), updated_at = now() where id = $1',
    [id, verified ? today : null, verified ? actor.userId : null])
  await recordAudit(tx, { action: verified ? 'traveler.verified' : 'traveler.unverified', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId })
}

export async function setVip(tx: Queryable, actor: Actor, id: string, isVip: unknown, requestId: string) {
  if (typeof isVip !== 'boolean') throw errors.validation({ isVip: ['Harus ya/tidak.'] })
  await lockTraveler(tx, id)
  await tx.query('update travelers set is_vip = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, isVip])
  await recordAudit(tx, { action: 'traveler.vip_set', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: { isVip } })
}

function groupValues(input: Record<string, unknown>, problems: FieldErrors, requireName: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.name !== undefined || requireName) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) problems.name = ['Nama grup wajib diisi.']
    else out.name = name.slice(0, 200)
  }
  if (input.paxCount !== undefined) {
    if (!Number.isInteger(input.paxCount) || (input.paxCount as number) < 0) problems.paxCount = ['Jumlah pax harus angka ≥ 0.']
    else out.pax_count = input.paxCount
  }
  if (input.roomingNote !== undefined) {
    out.rooming_note = typeof input.roomingNote === 'string' && input.roomingNote.trim() ? input.roomingNote.trim().slice(0, 500) : null
  }
  return out
}

export async function createGroup(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const values = groupValues(input, problems, true)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'GRP-')
  const cols = ['id', 'project_id', ...Object.keys(values)]
  await tx.query(`insert into traveler_groups (${cols.join(', ')}, changed_by_api_at) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, now())`, [id, projectId, ...Object.values(values)])
  await recordAudit(tx, { action: 'traveler_group.created', actorUserId: actor.userId, entityType: 'traveler_group', entityId: id, requestId, after: { projectId, ...values } })
  return { id }
}

export async function updateGroup(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const values = groupValues(input, problems, false)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [g] = await tx.query<{ id: string }>('select id from traveler_groups where id = $1 for update', [id])
  if (!g) throw errors.notFound('Grup')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update traveler_groups set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`, [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'traveler_group.updated', actorUserId: actor.userId, entityType: 'traveler_group', entityId: id, requestId, after: values })
}

const ROOM_TYPES = ['single', 'twin', 'suite'] as const

export async function cancelTraveler(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if (!reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const current = await lockTraveler(tx, id)
  if (current.cancelled) throw rule('Traveler ini sudah dibatalkan.')
  await tx.query('update travelers set cancelled = true, cancel_reason = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, reason])
  await removeFromRooms(tx, current.project_id, id)
  await recordAudit(tx, { action: 'traveler.cancelled', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, reason })
}

export async function replaceTraveler(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama traveler pengganti wajib diisi.']
  const current = await lockTraveler(tx, id)
  const values = await cleanProfile(tx, current.project_id, { ...input, groupId: undefined }, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (current.cancelled) throw rule('Traveler ini sudah dibatalkan — tidak bisa digantikan.')
  const newId = await insertTraveler(tx, current.project_id, { ...values, group_id: current.group_id }, { replaces: id })
  await tx.query('update travelers set changed_by_api_at = now() where id = $1', [newId])
  await tx.query('update travelers set cancelled = true, cancel_reason = $2, replaced_by = $3, changed_by_api_at = now(), updated_at = now() where id = $1',
    [id, `Digantikan oleh ${values.name as string} (${newId}).`, newId])
  // The replacement takes over the old traveler's room.
  await tx.query(
    `update room_assignments set traveler_ids = (select coalesce(jsonb_agg(case when x = $2::text then $3::text else x end), '[]'::jsonb) from jsonb_array_elements_text(traveler_ids) as x),
       changed_by_api_at = now(), updated_at = now()
     where project_id = $1 and traveler_ids ? $2::text`, [current.project_id, id, newId])
  await recordAudit(tx, { action: 'traveler.replaced', actorUserId: actor.userId, entityType: 'traveler', entityId: id, requestId, after: { replacedBy: newId } })
  return { id: newId }
}

/** Room members: travelers of the project, none cancelled. Returns the cleaned ids or records the problem. */
async function cleanRoomTravelers(tx: Queryable, projectId: string, input: unknown, problems: FieldErrors): Promise<{ ids: string[]; hasCancelled: boolean }> {
  if (!Array.isArray(input) || input.some(x => typeof x !== 'string' || !ID_PATTERN.test(x))) {
    problems.travelerIds = ['Daftar traveler tidak valid.']
    return { ids: [], hasCancelled: false }
  }
  const ids = [...new Set(input as string[])]
  if (!ids.length) return { ids, hasCancelled: false }
  const rows = await tx.query<{ id: string; cancelled: boolean }>(
    'select id, cancelled from travelers where project_id = $1 and id in (select jsonb_array_elements_text($2::text::jsonb))', [projectId, JSON.stringify(ids)])
  if (rows.length !== ids.length) problems.travelerIds = ['Ada traveler yang bukan dari project ini.']
  return { ids, hasCancelled: rows.some(r => r.cancelled) }
}

export async function setRoomTravelers(tx: Queryable, actor: Actor, roomId: string, input: unknown, requestId: string) {
  const [room] = await tx.query<{ project_id: string }>('select project_id from room_assignments where id = $1 for update', [roomId])
  if (!room) throw errors.notFound('Kamar')
  const problems: FieldErrors = {}
  const { ids, hasCancelled } = await cleanRoomTravelers(tx, room.project_id, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (hasCancelled) throw rule('Traveler yang sudah dibatalkan tidak bisa ditempatkan di kamar.')
  // A traveler sits in one room per project: take them out of every other room first.
  for (const tid of ids) {
    await tx.query(`update room_assignments set traveler_ids = traveler_ids - $3::text, changed_by_api_at = now(), updated_at = now()
                     where project_id = $1 and id <> $2 and traveler_ids ? $3::text`, [room.project_id, roomId, tid])
  }
  await tx.query('update room_assignments set traveler_ids = $2::text::jsonb, changed_by_api_at = now(), updated_at = now() where id = $1', [roomId, JSON.stringify(ids)])
  await recordAudit(tx, { action: 'room.travelers_set', actorUserId: actor.userId, entityType: 'room_assignment', entityId: roomId, requestId, after: { travelerIds: ids } })
}

export async function createRoom(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const label = typeof input.roomLabel === 'string' ? input.roomLabel.trim() : ''
  if (!label) problems.roomLabel = ['Label kamar wajib diisi.']
  if (!(ROOM_TYPES as readonly unknown[]).includes(input.roomType)) problems.roomType = ['Tipe kamar: single, twin, atau suite.']
  const groupOk = typeof input.groupId === 'string' && ID_PATTERN.test(input.groupId) &&
    (await tx.query('select 1 from traveler_groups where id = $1 and project_id = $2', [input.groupId, projectId])).length > 0
  if (!groupOk) problems.groupId = ['Grup tidak ditemukan di project ini.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'ROOM-')
  await tx.query('insert into room_assignments (id, project_id, group_id, room_label, room_type, changed_by_api_at) values ($1, $2, $3, $4, $5, now())',
    [id, projectId, input.groupId, label.slice(0, 100), input.roomType])
  await recordAudit(tx, { action: 'room.created', actorUserId: actor.userId, entityType: 'room_assignment', entityId: id, requestId, after: { projectId, label } })
  if (input.travelerIds !== undefined) await setRoomTravelers(tx, actor, id, input.travelerIds, requestId)
  return { id }
}

export async function deleteRoom(tx: Queryable, actor: Actor, roomId: string, requestId: string) {
  const done = await tx.query<{ id: string }>('delete from room_assignments where id = $1 returning id', [roomId])
  if (!done.length) throw errors.notFound('Kamar')
  await recordAudit(tx, { action: 'room.deleted', actorUserId: actor.userId, entityType: 'room_assignment', entityId: roomId, requestId })
}

/** Import commit: every row is validated again on the server; rows with errors are not created and are reported back. */
export async function importTravelers(tx: Queryable, actor: Actor, projectId: string, rowsInput: unknown, requestId: string) {
  if (!Array.isArray(rowsInput) || rowsInput.length === 0 || rowsInput.length > 500) throw errors.validation({ rows: ['Kirim 1–500 baris peserta.'] })
  const existing = new Set((await tx.query<{ passport_number: string }>(
    'select passport_number from travelers where project_id = $1 and passport_number is not null', [projectId])).map(r => r.passport_number))
  const created: string[] = []
  const rejected: { index: number; errors: string[] }[] = []
  for (const [index, raw] of (rowsInput as unknown[]).entries()) {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const errs: string[] = []
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) errs.push('Nama kosong — wajib diisi')
    const passport = typeof row.passportNumber === 'string' && row.passportNumber.trim() ? row.passportNumber.trim() : null
    if (passport && existing.has(passport)) errs.push(`Nomor paspor ${passport} sudah dipakai traveler lain di project ini`)
    const problems: FieldErrors = {}
    const values = errs.length ? {} : await cleanProfile(tx, projectId, { name, passportNumber: passport, groupId: row.groupId ?? undefined }, problems)
    for (const list of Object.values(problems)) errs.push(...list)
    if (errs.length) {
      rejected.push({ index, errors: errs })
      continue
    }
    const id = await insertTraveler(tx, projectId, values)
    await tx.query('update travelers set changed_by_api_at = now() where id = $1', [id])
    created.push(id)
    if (passport) existing.add(passport)
  }
  await recordAudit(tx, { action: 'traveler.imported', actorUserId: actor.userId, entityType: 'project', entityId: projectId, requestId, after: { created, rejected: rejected.length } })
  return { created, rejected }
}
