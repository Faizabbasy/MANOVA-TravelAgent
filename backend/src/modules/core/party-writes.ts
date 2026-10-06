import { ROLE_DEFINITIONS, type Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/** Customer profile writes (S1). Lifecycle changes only through Won (project-writes) and credit limit only through Finance. */
export const COMPANY_TYPES = ['private-company', 'bumn', 'government-agency', 'university', 'foundation', 'event-organizer', 'travel-agent', 'other'] as const

const TEXT_FIELDS = {
  industry: 'industry', size: 'size', address: 'address', city: 'city', province: 'province', country: 'country',
  postalCode: 'postal_code', phone: 'phone', website: 'website', registrationNumber: 'registration_number',
  billingName: 'billing_name', billingAddress: 'billing_address', paymentTerm: 'payment_term', travelPreferences: 'travel_preferences'
} as const
type TextField = keyof typeof TEXT_FIELDS
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PartyInput = Partial<Record<TextField | 'name' | 'email' | 'npwp' | 'companyType' | 'accountOwnerUserId' | 'partyType' | 'lifecycleStatus', string | null>> & { poRequired?: boolean }

function cleanText(value: unknown, field: string, problems: FieldErrors, max = 500): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems[field] = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s || null
}

async function profile(tx: Queryable, input: PartyInput & Record<string, unknown>, problems: FieldErrors) {
  const out: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) problems.name = ['Nama customer wajib diisi.']
    else if (name.length > 200) problems.name = ['Maksimal 200 karakter.']
    else out.name = name
  }
  for (const f of Object.keys(TEXT_FIELDS) as TextField[]) {
    const v = cleanText(input[f], f, problems)
    if (v !== undefined) out[f] = v
  }
  const email = cleanText(input.email, 'email', problems, 200)
  if (email !== undefined) { if (email && !EMAIL.test(email)) problems.email = ['Format email tidak valid.']; else out.email = email }
  const npwp = cleanText(input.npwp, 'npwp', problems, 40)
  if (npwp !== undefined) {
    const digits = npwp?.replace(/[.\-\s]/g, '') ?? ''
    if (npwp && !/^\d{15,16}$/.test(digits)) problems.npwp = ['NPWP harus 15–16 digit.']
    else out.npwp = npwp
  }
  if (input.companyType !== undefined) {
    if (input.companyType === null || (COMPANY_TYPES as readonly string[]).includes(input.companyType)) out.companyType = input.companyType
    else problems.companyType = ['Jenis perusahaan tidak dikenal.']
  }
  if (input.poRequired !== undefined) {
    if (typeof input.poRequired === 'boolean') out.poRequired = input.poRequired
    else problems.poRequired = ['Harus ya/tidak.']
  }
  if (input.accountOwnerUserId !== undefined) {
    if (input.accountOwnerUserId === null) out.accountOwnerUserId = null
    else {
      const [u] = await tx.query<{ role: string }>('select role from users where id = $1', [input.accountOwnerUserId])
      if (!u || ROLE_DEFINITIONS[u.role as keyof typeof ROLE_DEFINITIONS]?.kind !== 'internal') problems.accountOwnerUserId = ['AE tidak dikenal.']
      else out.accountOwnerUserId = input.accountOwnerUserId
    }
  }
  return out
}

const COLUMN: Record<string, string> = {
  ...TEXT_FIELDS, name: 'name', email: 'email', npwp: 'npwp', companyType: 'company_type',
  poRequired: 'po_required', accountOwnerUserId: 'account_owner_user_id'
}

export async function createParty(tx: Queryable, actor: Actor, input: PartyInput & Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama customer wajib diisi.']
  if (input.partyType !== 'company' && input.partyType !== 'individual') problems.partyType = ['Pilih perusahaan atau individu.']
  const lifecycle = input.lifecycleStatus ?? 'prospect'
  if (lifecycle !== 'prospect' && lifecycle !== 'client') problems.lifecycleStatus = ['Status harus prospect atau client.']
  if (input.creditLimitMinor !== undefined) problems.creditLimitMinor = ['Limit kredit diatur Finance setelah customer dibuat.']
  const p = await profile(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const id = await nextId(tx, 'PTY-')
  const cols = ['id', 'party_type', 'lifecycle_status', ...Object.keys(p).map(k => COLUMN[k]!)]
  const vals = [id, input.partyType, lifecycle, ...Object.values(p)]
  await tx.query(`insert into parties (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals)
  await recordAudit(tx, { action: 'party.created', actorUserId: actor.userId, entityType: 'party', entityId: id, requestId, after: { partyType: input.partyType, lifecycleStatus: lifecycle, ...p } })
  return { id }
}

const FORBIDDEN_PATCH = ['id', 'creditLimitMinor', 'lifecycleStatus', 'partyType', 'provenance']

export async function updateParty(tx: Queryable, actor: Actor, id: string, input: PartyInput & Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN_PATCH.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit customer.']])))
  const [current] = await tx.query<Record<string, unknown>>('select * from parties where id = $1 for update', [id])
  if (!current) throw errors.notFound('Customer')
  const problems: FieldErrors = {}
  const p = await profile(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const keys = Object.keys(p)
  if (!keys.length) return
  await tx.query(
    `update parties set ${keys.map((k, i) => `${COLUMN[k]} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
    [id, ...Object.values(p)]
  )
  await recordAudit(tx, {
    action: 'party.updated', actorUserId: actor.userId, entityType: 'party', entityId: id, requestId,
    before: Object.fromEntries(keys.map(k => [k, current[COLUMN[k]!]])), after: p
  })
}

export async function setCreditLimit(tx: Queryable, actor: Actor, id: string, input: { creditLimitMinor?: string | null; reason?: string }, requestId: string): Promise<void> {
  const problems: FieldErrors = {}
  let value: bigint | null = null
  if (input.creditLimitMinor !== null) {
    try { value = parseAmountMinor(input.creditLimitMinor, 'creditLimitMinor', { allowZero: true }) } catch { problems.creditLimitMinor = ['Limit kredit harus angka rupiah ≥ 0, atau kosong untuk tanpa batas.'] }
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) problems.reason = ['Alasan perubahan wajib diisi.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [current] = await tx.query<{ credit_limit_minor: string | null }>('select credit_limit_minor from parties where id = $1 for update', [id])
  if (!current) throw errors.notFound('Customer')
  await tx.query('update parties set credit_limit_minor = $2, updated_at = now() where id = $1', [id, value?.toString() ?? null])
  await recordAudit(tx, {
    action: 'party.credit_limit_changed', actorUserId: actor.userId, entityType: 'party', entityId: id, requestId, reason,
    before: { creditLimitMinor: current.credit_limit_minor }, after: { creditLimitMinor: value?.toString() ?? null }
  })
}

const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'note', 'follow-up'] as const

export async function createContact(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!name) problems.name = ['Nama kontak wajib diisi.']
  if (!title) problems.title = ['Jabatan wajib diisi.']
  const email = cleanText(input.email, 'email', problems, 200)
  if (email && !EMAIL.test(email)) problems.email = ['Format email tidak valid.']
  const phone = cleanText(input.phone, 'phone', problems, 50)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'CP-')
  await tx.query('insert into party_contacts (id, party_id, name, title, email, phone) values ($1, $2, $3, $4, $5, $6)', [id, partyId, name, title, email ?? null, phone ?? null])
  await recordAudit(tx, { action: 'party.contact_created', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { contactId: id, name, title } })
  return { id }
}

export async function createActivity(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (!(ACTIVITY_TYPES as readonly unknown[]).includes(input.type)) problems.type = ['Jenis aktivitas tidak dikenal.']
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) problems.message = ['Isi aktivitas wajib diisi.']
  else if (message.length > 2000) problems.message = ['Maksimal 2000 karakter.']
  const leadId = cleanText(input.leadId, 'leadId', problems, 64)
  const dueAt = input.dueAt === undefined || input.dueAt === null ? null : (typeof input.dueAt === 'string' && isIsoDate(input.dueAt) ? input.dueAt : (problems.dueAt = ['Tanggal harus YYYY-MM-DD.'], null))
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'PACT-')
  await tx.query(
    'insert into party_activities (id, party_id, lead_id, type, message, owner_user_id, activity_date, due_at) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, partyId, leadId ?? null, input.type, message, actor.userId, today, dueAt]
  )
  await recordAudit(tx, { action: 'party.activity_created', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { activityId: id, type: input.type } })
  return { id }
}
