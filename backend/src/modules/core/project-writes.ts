import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { ID_PATTERN } from '../../http/envelope'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/**
 * Project header writes (S3a). Status, team, services and the contract value after creation are NOT
 * changed here: status/team/services still live in the frontend until their stage moves, and the contract
 * value has its own Finance-only command (`setContractValue`).
 */

export const GROUP_TRIP_PARTY_NAME = 'MANOVA Group Trip (Internal)'
export const CHARACTERISTICS = ['normal', 'high-change', 'complex'] as const
export const SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional'] as const
const CONTACT_FIELDS = ['tourLeaderName', 'tourLeaderPhone', 'emergencyContactName', 'emergencyContactPhone', 'meetingPoint'] as const
const CONTACT_COLUMNS: Record<(typeof CONTACT_FIELDS)[number], string> = {
  tourLeaderName: 'tour_leader_name',
  tourLeaderPhone: 'tour_leader_phone',
  emergencyContactName: 'emergency_contact_name',
  emergencyContactPhone: 'emergency_contact_phone',
  meetingPoint: 'meeting_point'
}

export interface ProjectCreateInput {
  name?: string
  partyId?: string
  isGroupTrip?: boolean
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  characteristic?: string
  serviceScope?: string[]
  travelerCount?: number
  contractValueMinor?: string
  leadId?: string
  sourceQuotationId?: string
}

export interface ProjectPatchInput {
  name?: string
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  characteristic?: string
  serviceScope?: string[]
  travelerCount?: number
  tourLeaderName?: string | null
  tourLeaderPhone?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  meetingPoint?: string | null
}

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

function text(value: unknown, field: string, problems: FieldErrors, label: string, max = 200): string | undefined {
  if (value === undefined) return undefined
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) { problems[field] = [`${label} wajib diisi.`]; return undefined }
  if (s.length > max) { problems[field] = [`${label} maksimal ${max} karakter.`]; return undefined }
  return s
}

function optionalText(value: unknown, field: string, problems: FieldErrors, max = 200): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems[field] = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s || null
}

function date(value: unknown, field: string, problems: FieldErrors): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !isIsoDate(value)) { problems[field] = ['Tanggal harus format YYYY-MM-DD.']; return undefined }
  return value
}

function header(input: ProjectCreateInput | ProjectPatchInput, problems: FieldErrors) {
  const out: Record<string, unknown> = {}
  out.name = text(input.name, 'name', problems, 'Nama project')
  out.destination = text(input.destination, 'destination', problems, 'Tujuan')
  out.travelStartDate = date(input.travelStartDate, 'travelStartDate', problems)
  out.travelEndDate = date(input.travelEndDate, 'travelEndDate', problems)
  if (input.characteristic !== undefined) {
    if ((CHARACTERISTICS as readonly string[]).includes(input.characteristic)) out.characteristic = input.characteristic
    else problems.characteristic = [`Harus salah satu dari: ${CHARACTERISTICS.join(', ')}.`]
  }
  if (input.serviceScope !== undefined) {
    const scope = Array.isArray(input.serviceScope) ? [...new Set(input.serviceScope)] : []
    if (!scope.length) problems.serviceScope = ['Pilih minimal satu layanan.']
    else if (scope.some(s => !(SERVICE_TYPES as readonly string[]).includes(s))) problems.serviceScope = [`Layanan harus salah satu dari: ${SERVICE_TYPES.join(', ')}.`]
    else out.serviceScope = scope
  }
  if (input.travelerCount !== undefined) {
    if (Number.isInteger(input.travelerCount) && input.travelerCount >= 1 && input.travelerCount <= 100_000) out.travelerCount = input.travelerCount
    else problems.travelerCount = ['Jumlah traveler minimal 1.']
  }
  return out
}

function checkDates(start: unknown, end: unknown, problems: FieldErrors) {
  if (typeof start === 'string' && typeof end === 'string' && start > end && !problems.travelEndDate) {
    problems.travelEndDate = ['Tanggal selesai tidak boleh sebelum tanggal mulai.']
  }
}

async function groupTripPartyId(tx: Queryable): Promise<string> {
  const [found] = await tx.query<{ id: string }>('select id from parties where name = $1 order by id limit 1', [GROUP_TRIP_PARTY_NAME])
  if (found) return found.id
  const id = await nextId(tx, 'PTY-')
  await tx.query(
    "insert into parties (id, name, lifecycle_status, party_type) values ($1, $2, 'client', 'individual')",
    [id, GROUP_TRIP_PARTY_NAME]
  )
  return id
}

export async function createProject(tx: Queryable, actor: Actor, input: ProjectCreateInput, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const h = header(input, problems)
  for (const [field, label] of [['name', 'Nama project'], ['destination', 'Tujuan'], ['travelStartDate', 'Tanggal mulai'], ['travelEndDate', 'Tanggal selesai']] as const) {
    if (input[field] === undefined) problems[field] = [`${label} wajib diisi.`]
  }
  if (input.serviceScope === undefined) problems.serviceScope = ['Pilih minimal satu layanan.']
  if (input.travelerCount === undefined) problems.travelerCount = ['Jumlah traveler minimal 1.']
  checkDates(h.travelStartDate, h.travelEndDate, problems)
  let contract: bigint | null = null
  try {
    contract = parseAmountMinor(input.contractValueMinor, 'contractValueMinor', { allowZero: true })
  } catch {
    problems.contractValueMinor = ['Nilai kontrak harus angka rupiah ≥ 0.']
  }
  if (!input.isGroupTrip && (!input.partyId || !ID_PATTERN.test(input.partyId))) problems.partyId = ['Pilih customer.']
  for (const ref of ['leadId', 'sourceQuotationId'] as const) {
    if (input[ref] !== undefined && !ID_PATTERN.test(input[ref]!)) problems[ref] = ['ID tidak valid.']
  }
  if (Object.keys(problems).length) throw errors.validation(problems)

  let partyId: string
  if (input.isGroupTrip) {
    partyId = await groupTripPartyId(tx)
  } else {
    const [party] = await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId])
    if (!party) throw rule('Customer belum tersimpan di server. Simpan customer ini dulu, lalu buat project lagi.')
    partyId = party.id
  }

  const id = await nextId(tx, 'PRJ-')
  await tx.query(
    `insert into projects (id, name, party_id, destination, travel_start_date, travel_end_date, status, owner_user_id,
                           contract_value_minor, characteristic, service_scope, traveler_count, is_group_trip, lead_id, source_quotation_id)
     values ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9,
             (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text($10::text::jsonb) as x),
             $11, $12, $13, $14)`,
    [id, h.name, partyId, h.destination, h.travelStartDate, h.travelEndDate, actor.userId, contract!.toString(),
      h.characteristic ?? 'normal', JSON.stringify(h.serviceScope), h.travelerCount, input.isGroupTrip === true,
      input.leadId ?? null, input.sourceQuotationId ?? null]
  )
  await tx.query('insert into project_members (project_id, user_id) values ($1, $2) on conflict do nothing', [id, actor.userId])
  await recordAudit(tx, {
    action: 'project.created', actorUserId: actor.userId, entityType: 'project', entityId: id, requestId,
    after: { name: h.name, partyId, destination: h.destination, travelStartDate: h.travelStartDate, travelEndDate: h.travelEndDate,
      serviceScope: h.serviceScope, travelerCount: h.travelerCount, contractValueMinor: contract!.toString(), isGroupTrip: input.isGroupTrip === true }
  })
  return { id }
}

const FORBIDDEN_PATCH = ['status', 'partyId', 'contractValueMinor', 'contractCurrency', 'isGroupTrip', 'ownerUserId', 'teamUserIds', 'id']

export async function updateProject(tx: Queryable, actor: Actor, id: string, input: ProjectPatchInput & Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN_PATCH.includes(k))
  if (blocked.length) {
    throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit project.']])))
  }
  const [current] = await tx.query<Record<string, any>>(
    `select name, destination, travel_start_date, travel_end_date, characteristic, service_scope, traveler_count,
            tour_leader_name, tour_leader_phone, emergency_contact_name, emergency_contact_phone, meeting_point
       from projects where id = $1 for update`,
    [id]
  )
  if (!current) throw errors.notFound('Project')
  const problems: FieldErrors = {}
  const h = header(input, problems)
  const contacts: Record<string, string | null | undefined> = {}
  for (const f of CONTACT_FIELDS) contacts[f] = optionalText(input[f], f, problems)
  checkDates(h.travelStartDate ?? current.travel_start_date, h.travelEndDate ?? current.travel_end_date, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const sets: string[] = []
  const params: unknown[] = [id]
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  const set = (column: string, field: string, value: unknown, old: unknown, sql = `$${params.length + 1}`) => {
    params.push(value)
    sets.push(`${column} = ${sql}`)
    before[field] = old
    after[field] = value
  }
  if (h.name !== undefined) set('name', 'name', h.name, current.name)
  if (h.destination !== undefined) set('destination', 'destination', h.destination, current.destination)
  if (h.travelStartDate !== undefined) set('travel_start_date', 'travelStartDate', h.travelStartDate, current.travel_start_date)
  if (h.travelEndDate !== undefined) set('travel_end_date', 'travelEndDate', h.travelEndDate, current.travel_end_date)
  if (h.characteristic !== undefined) set('characteristic', 'characteristic', h.characteristic, current.characteristic)
  if (h.travelerCount !== undefined) set('traveler_count', 'travelerCount', h.travelerCount, current.traveler_count)
  if (h.serviceScope !== undefined) {
    params.push(JSON.stringify(h.serviceScope))
    sets.push(`service_scope = (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text($${params.length}::text::jsonb) as x)`)
    before.serviceScope = current.service_scope
    after.serviceScope = h.serviceScope
  }
  for (const f of CONTACT_FIELDS) {
    if (contacts[f] !== undefined) set(CONTACT_COLUMNS[f], f, contacts[f], current[CONTACT_COLUMNS[f]])
  }
  if (!sets.length) return
  await tx.query(`update projects set ${sets.join(', ')}, updated_at = now() where id = $1`, params)
  await recordAudit(tx, { action: 'project.updated', actorUserId: actor.userId, entityType: 'project', entityId: id, requestId, before, after })
}

const formatRp = (minor: bigint) => `Rp ${minor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

export async function setContractValue(
  tx: Queryable, actor: Actor, id: string, input: { contractValueMinor?: string; reason?: string }, billedMinor: bigint, requestId: string
): Promise<void> {
  const problems: FieldErrors = {}
  let value: bigint | null = null
  try {
    value = parseAmountMinor(input.contractValueMinor, 'contractValueMinor', { allowZero: true })
  } catch {
    problems.contractValueMinor = ['Nilai kontrak harus angka rupiah ≥ 0.']
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) problems.reason = ['Alasan perubahan wajib diisi.']
  else if (reason.length > 500) problems.reason = ['Maksimal 500 karakter.']
  if (Object.keys(problems).length) throw errors.validation(problems)

  const [current] = await tx.query<{ contract_value_minor: string | null }>('select contract_value_minor from projects where id = $1 for update', [id])
  if (!current) throw errors.notFound('Project')
  if (value! < billedMinor) {
    throw rule(`Nilai kontrak tidak boleh di bawah yang sudah ditagih (${formatRp(billedMinor)}). Terbitkan credit note dulu bila tagihan memang turun.`)
  }
  await tx.query('update projects set contract_value_minor = $2, updated_at = now() where id = $1', [id, value!.toString()])
  await recordAudit(tx, {
    action: 'project.contract_value_changed', actorUserId: actor.userId, entityType: 'project', entityId: id, requestId, reason,
    before: { contractValueMinor: current.contract_value_minor }, after: { contractValueMinor: value!.toString() }
  })
}
