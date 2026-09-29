import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { isUniqueViolation, rule, todayBusinessDate } from './common'
import { trimOrNull, validateReason } from './postings'

/**
 * Cancellation policies (Phase 5): versioned, tiered refund rules and their snapshot per booking/project.
 *
 * A tier is a half-open interval of "days before departure" H: `minDays <= H < maxDays` (null = unbounded).
 * A policy's tiers must cover every H without gap or overlap — including departure day and after
 * (docs/.../08: "H<1/after departure wajib aturan eksplisit"). Published policies are frozen (trigger); a
 * change is a new version. Assigning a policy stores a snapshot, so later versions never change a case.
 */

export const SUBJECT_TYPES = ['project', 'flight', 'hotel', 'transport', 'mice'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]
const POLICY_BOOKING_TYPES = ['flight', 'hotel', 'transport', 'mice'] as const

export interface TierInput { minDays: number | null; maxDays: number | null; refundBp: number }
export interface Tier { minDays: number | null; maxDays: number | null; refundBp: number; forfeitBp: number }

export interface PolicySnapshot {
  policyId: string
  code: string
  name: string
  version: number
  basis: 'paid_customer_deposit'
  bookingType: string | null
  effectiveFrom: string
  effectiveTo: string | null
  tiers: Tier[]
}

const isDayBound = (v: unknown): v is number | null => v === null || (Number.isInteger(v) && Math.abs(v as number) <= 3650)

/** Sorted, contiguous, complete tiers — or a validation error that says exactly what is wrong. */
export function validateTiers(input: unknown): Tier[] {
  if (!Array.isArray(input) || input.length === 0) throw errors.validation({ tiers: ['Isi minimal satu tingkat refund.'] })
  if (input.length > 20) throw errors.validation({ tiers: ['Maksimal 20 tingkat.'] })
  const tiers = input.map((t: Partial<TierInput>, i) => {
    const minDays = t?.minDays ?? null
    const maxDays = t?.maxDays ?? null
    if (!isDayBound(minDays) || !isDayBound(maxDays)) throw errors.validation({ [`tiers.${i}`]: ['Batas hari harus bilangan bulat (−3650 s/d 3650) atau kosong.'] })
    if (!Number.isInteger(t?.refundBp) || (t.refundBp as number) < 0 || (t.refundBp as number) > 10_000) {
      throw errors.validation({ [`tiers.${i}.refundBp`]: ['Persentase refund harus 0–100%.'] })
    }
    if (minDays !== null && maxDays !== null && minDays >= maxDays) throw errors.validation({ [`tiers.${i}`]: ['Batas bawah harus lebih kecil dari batas atas.'] })
    return { minDays, maxDays, refundBp: t.refundBp as number, forfeitBp: 10_000 - (t.refundBp as number) }
  })
  tiers.sort((a, b) => (a.minDays ?? -Infinity) - (b.minDays ?? -Infinity))
  if (tiers[0]!.minDays !== null) {
    throw errors.validation({ tiers: ['Harus ada tingkat untuk hari keberangkatan dan sesudahnya (batas bawah kosong).'] })
  }
  if (tiers[tiers.length - 1]!.maxDays !== null) throw errors.validation({ tiers: ['Tingkat paling jauh harus tanpa batas atas (mis. H ≥ 30).'] })
  for (let i = 1; i < tiers.length; i++) {
    const prev = tiers[i - 1]!
    const cur = tiers[i]!
    if (prev.maxDays === null || cur.minDays === null || prev.maxDays !== cur.minDays) {
      throw errors.validation({ tiers: [`Tingkat harus menyambung tanpa celah atau tumpang tindih (sekitar H-${cur.minDays ?? prev.maxDays}).`] })
    }
  }
  return tiers
}

/** The tier that applies H days before departure (H may be 0 or negative). */
export function tierFor(tiers: Tier[], daysBefore: number): Tier {
  const tier = tiers.find(t => (t.minDays === null || daysBefore >= t.minDays) && (t.maxDays === null || daysBefore < t.maxDays))
  if (!tier) throw new Error('policy tiers do not cover H') // impossible for validated tiers
  return tier
}

/** Whole calendar days from `from` to `to` (business dates). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Refund for a basis at a tier, in integer IDR; retained is the exact remainder (no rounding gap). */
export function applyTier(basis: bigint, tier: Tier): { refund: bigint; retained: bigint } {
  const refund = (basis * BigInt(tier.refundBp)) / 10_000n
  return { refund, retained: basis - refund }
}

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────────

interface PolicyRow extends Record<string, unknown> {
  id: string; code: string; version: number; name: string; description: string | null; booking_type: string | null
  basis: 'paid_customer_deposit'; status: 'draft' | 'published' | 'inactive'; effective_from: string; effective_to: string | null
  created_by: string; created_at: Date; published_by: string | null; published_at: Date | null
  deactivated_by: string | null; deactivated_at: Date | null; deactivation_reason: string | null
}

async function tiersOf(q: Queryable, policyId: string): Promise<Tier[]> {
  const rows = await q.query<{ min_days: number | null; max_days: number | null; refund_bp: number }>(
    'select min_days, max_days, refund_bp from cancellation_policy_tiers where policy_id = $1', [policyId]
  )
  return rows.map(r => ({ minDays: r.min_days, maxDays: r.max_days, refundBp: r.refund_bp, forfeitBp: 10_000 - r.refund_bp }))
    .sort((a, b) => (a.minDays ?? -Infinity) - (b.minDays ?? -Infinity))
}

function policyDto(p: PolicyRow, tiers: Tier[], usage?: { assignments: number; cases: number }) {
  return {
    id: p.id,
    code: p.code,
    version: p.version,
    name: p.name,
    description: p.description,
    bookingType: p.booking_type,
    basis: p.basis,
    status: p.status,
    effectiveFrom: p.effective_from,
    effectiveTo: p.effective_to,
    tiers,
    createdBy: p.created_by,
    createdAt: p.created_at.toISOString(),
    publishedBy: p.published_by,
    publishedAt: p.published_at?.toISOString() ?? null,
    deactivatedAt: p.deactivated_at?.toISOString() ?? null,
    deactivationReason: p.deactivation_reason,
    usage: usage ?? null
  }
}

export async function getPolicy(q: Queryable, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Kebijakan')
  const [p] = await q.query<PolicyRow>('select * from cancellation_policies where id = $1', [id])
  if (!p) throw errors.notFound('Kebijakan')
  const [usage] = await q.query<{ assignments: string; cases: string }>(
    `select (select count(*) from cancellation_policy_assignments where policy_id = $1) as assignments,
            (select count(*) from refunds where policy_id = $1) as cases`, [id]
  )
  return policyDto(p, await tiersOf(q, id), { assignments: Number(usage!.assignments), cases: Number(usage!.cases) })
}

export async function listPolicies(db: Db, filter: { status?: string }) {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.status) {
    if (!['draft', 'published', 'inactive'].includes(filter.status)) throw errors.validation({ status: ['Pilihan: draft, published, inactive.'] })
    params.push(filter.status)
    where.push(`status = $${params.length}`)
  }
  const rows = await db.query<PolicyRow>(
    `select * from cancellation_policies ${where.length ? `where ${where.join(' and ')}` : ''} order by code, version desc`, params
  )
  const out = []
  for (const r of rows) out.push(policyDto(r, await tiersOf(db, r.id)))
  return out
}

// ── Draft lifecycle ───────────────────────────────────────────────────────────────────────────────────

export interface PolicyInput {
  code?: string
  name?: string
  description?: string | null
  bookingType?: string | null
  effectiveFrom?: string
  effectiveTo?: string | null
  tiers?: TierInput[]
}

function validatePolicyFields(input: PolicyInput, creating: boolean) {
  const fe: Record<string, string[]> = {}
  if (creating) {
    const code = input.code?.trim().toUpperCase()
    if (!code || !/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code)) fe.code = ['Kode 2–40 karakter: huruf besar, angka, atau tanda hubung.']
  }
  if (creating || input.name !== undefined) {
    if (!input.name || input.name.trim().length < 3 || input.name.trim().length > 120) fe.name = ['Nama 3–120 karakter.']
  }
  if (input.bookingType !== undefined && input.bookingType !== null && !(POLICY_BOOKING_TYPES as readonly string[]).includes(input.bookingType)) {
    fe.bookingType = ['Jenis booking: flight, hotel, transport, mice, atau kosong (semua).']
  }
  if (creating || input.effectiveFrom !== undefined) {
    if (typeof input.effectiveFrom !== 'string' || !isIsoDate(input.effectiveFrom)) fe.effectiveFrom = ['Tanggal harus berformat YYYY-MM-DD.']
  }
  if (input.effectiveTo !== undefined && input.effectiveTo !== null && (typeof input.effectiveTo !== 'string' || !isIsoDate(input.effectiveTo))) {
    fe.effectiveTo = ['Tanggal harus berformat YYYY-MM-DD.']
  }
  if (Object.keys(fe).length) throw errors.validation(fe)
}

async function replaceTiers(tx: Queryable, policyId: string, tiers: Tier[]) {
  await tx.query('delete from cancellation_policy_tiers where policy_id = $1', [policyId])
  for (const t of tiers) {
    await tx.query('insert into cancellation_policy_tiers (policy_id, min_days, max_days, refund_bp) values ($1, $2, $3, $4)',
      [policyId, t.minDays, t.maxDays, t.refundBp])
  }
}

export async function createPolicy(tx: Queryable, actor: Actor, input: PolicyInput, requestId: string) {
  validatePolicyFields(input, true)
  const tiers = validateTiers(input.tiers)
  const code = input.code!.trim().toUpperCase()
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom!) throw errors.validation({ effectiveTo: ['Tanggal akhir tidak boleh sebelum tanggal mulai.'] })
  const [exists] = await tx.query('select 1 from cancellation_policies where code = $1 limit 1', [code])
  if (exists) throw new AppError(409, 'CONFLICT', `Kode ${code} sudah dipakai. Buat versi baru dari kebijakan itu.`, { fieldErrors: { code: ['Kode sudah dipakai.'] } })
  let row: { id: string } | undefined
  try {
    ;[row] = await tx.query<{ id: string }>(
      `insert into cancellation_policies (code, version, name, description, booking_type, effective_from, effective_to, created_by)
       values ($1, 1, $2, $3, $4, $5, $6, $7) returning id`,
      [code, input.name!.trim(), trimOrNull(input.description ?? undefined, 1000), input.bookingType ?? null, input.effectiveFrom, input.effectiveTo ?? null, actor.userId]
    )
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'CONFLICT', `Kode ${code} sudah dipakai.`, { fieldErrors: { code: ['Kode sudah dipakai.'] } })
    throw err
  }
  await replaceTiers(tx, row!.id, tiers)
  await recordAudit(tx, { action: 'finance.policy_created', actorUserId: actor.userId, entityType: 'cancellation_policy', entityId: row!.id, requestId, after: { code, tiers } })
  return getPolicy(tx, row!.id)
}

async function lockPolicy(tx: Queryable, id: string): Promise<PolicyRow> {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Kebijakan')
  const [p] = await tx.query<PolicyRow>('select * from cancellation_policies where id = $1 for update', [id])
  if (!p) throw errors.notFound('Kebijakan')
  return p
}

export async function updatePolicyDraft(tx: Queryable, actor: Actor, id: string, input: PolicyInput, requestId: string) {
  const p = await lockPolicy(tx, id)
  if (p.status !== 'draft') throw rule('Kebijakan yang sudah terbit tidak bisa diubah. Buat versi baru.')
  if (input.code !== undefined) throw errors.validation({ code: ['Kode tidak bisa diubah.'] })
  validatePolicyFields(input, false)
  const from = input.effectiveFrom ?? p.effective_from
  const to = input.effectiveTo === undefined ? p.effective_to : input.effectiveTo
  if (to && to < from) throw errors.validation({ effectiveTo: ['Tanggal akhir tidak boleh sebelum tanggal mulai.'] })
  await tx.query(
    `update cancellation_policies set name = $2, description = $3, booking_type = $4, effective_from = $5, effective_to = $6, updated_at = now() where id = $1`,
    [id, input.name?.trim() ?? p.name, input.description === undefined ? p.description : trimOrNull(input.description ?? undefined, 1000),
      input.bookingType === undefined ? p.booking_type : input.bookingType, from, to]
  )
  if (input.tiers !== undefined) await replaceTiers(tx, id, validateTiers(input.tiers))
  await recordAudit(tx, { action: 'finance.policy_draft_updated', actorUserId: actor.userId, entityType: 'cancellation_policy', entityId: id, requestId })
  return getPolicy(tx, id)
}

export async function deletePolicyDraft(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const p = await lockPolicy(tx, id)
  if (p.status !== 'draft') throw rule('Hanya draft yang bisa dihapus. Kebijakan terbit cukup dinonaktifkan.')
  await tx.query('delete from cancellation_policies where id = $1', [id])
  await recordAudit(tx, { action: 'finance.policy_draft_deleted', actorUserId: actor.userId, entityType: 'cancellation_policy', entityId: id, requestId })
  return { id }
}

export async function publishPolicy(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const p = await lockPolicy(tx, id)
  if (p.status !== 'draft') throw rule('Kebijakan ini sudah terbit atau nonaktif.')
  validateTiers(await tiersOf(tx, id)) // stored tiers are re-validated at the moment they become binding
  await tx.query("update cancellation_policies set status = 'published', published_by = $2, published_at = now(), updated_at = now() where id = $1", [id, actor.userId])
  await recordAudit(tx, { action: 'finance.policy_published', actorUserId: actor.userId, entityType: 'cancellation_policy', entityId: id, requestId, after: { code: p.code, version: p.version } })
  return getPolicy(tx, id)
}

export async function deactivatePolicy(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  const p = await lockPolicy(tx, id)
  if (p.status !== 'published') throw rule('Hanya kebijakan terbit yang bisa dinonaktifkan.')
  await tx.query(
    "update cancellation_policies set status = 'inactive', deactivated_by = $2, deactivated_at = now(), deactivation_reason = $3, updated_at = now() where id = $1",
    [id, actor.userId, reason]
  )
  await recordAudit(tx, { action: 'finance.policy_deactivated', actorUserId: actor.userId, entityType: 'cancellation_policy', entityId: id, requestId, reason })
  return getPolicy(tx, id)
}

/** Starts the next version as a draft copy of this one. Bookings keep the version they were given. */
export async function newPolicyVersion(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const p = await lockPolicy(tx, id)
  if (p.status === 'draft') throw rule('Ini masih draft; ubah langsung draft-nya.')
  const [draft] = await tx.query<{ id: string }>("select id from cancellation_policies where code = $1 and status = 'draft'", [p.code])
  if (draft) throw rule(`Sudah ada draft versi baru untuk ${p.code} (${draft.id}). Lanjutkan draft itu.`)
  const [max] = await tx.query<{ v: number }>('select max(version) as v from cancellation_policies where code = $1', [p.code])
  const [row] = await tx.query<{ id: string }>(
    `insert into cancellation_policies (code, version, name, description, booking_type, effective_from, effective_to, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [p.code, Number(max!.v) + 1, p.name, p.description, p.booking_type, todayBusinessDate() > p.effective_from ? todayBusinessDate() : p.effective_from, p.effective_to, actor.userId]
  )
  await replaceTiers(tx, row!.id, await tiersOf(tx, id))
  await recordAudit(tx, { action: 'finance.policy_version_started', actorUserId: actor.userId, entityType: 'cancellation_policy', entityId: row!.id, requestId, before: { from: id } })
  return getPolicy(tx, row!.id)
}

// ── Subjects & assignment ─────────────────────────────────────────────────────────────────────────────

export interface Subject {
  type: SubjectType
  id: string
  projectId: string
  projectName: string
  partyId: string
  partyName: string
  departureDate: string | null
  /** For bookings: invoices are linked by booking_type/booking_id. */
  bookingType: string | null
}

export function parseSubjectType(value: unknown, field = 'subjectType'): SubjectType {
  if (typeof value !== 'string' || !(SUBJECT_TYPES as readonly string[]).includes(value)) {
    throw errors.validation({ [field]: ['Pilihan: project, flight, hotel, transport, mice.'] })
  }
  return value as SubjectType
}

export async function resolveSubject(q: Queryable, type: SubjectType, id: string): Promise<Subject> {
  if (!ID_PATTERN.test(id)) throw errors.notFound(type === 'project' ? 'Project' : 'Booking')
  if (type === 'project') {
    const [p] = await q.query<{ id: string; name: string; party_id: string; party_name: string; travel_start_date: string | null }>(
      'select p.id, p.name, p.party_id, pa.name as party_name, p.travel_start_date from projects p join parties pa on pa.id = p.party_id where p.id = $1', [id]
    )
    if (!p) throw errors.notFound('Project')
    return { type, id, projectId: p.id, projectName: p.name, partyId: p.party_id, partyName: p.party_name, departureDate: p.travel_start_date, bookingType: null }
  }
  const [b] = await q.query<{ project_id: string; project_name: string; party_id: string; party_name: string; departure_date: string | null }>(
    `select b.project_id, p.name as project_name, p.party_id, pa.name as party_name, b.departure_date
       from booking_refs b join projects p on p.id = b.project_id join parties pa on pa.id = p.party_id
      where b.booking_type = $1 and b.booking_id = $2`, [type, id]
  )
  if (!b) throw errors.notFound('Booking')
  return { type, id, projectId: b.project_id, projectName: b.project_name, partyId: b.party_id, partyName: b.party_name, departureDate: b.departure_date, bookingType: type }
}

function policyFitsSubject(p: { booking_type: string | null }, subject: Subject): boolean {
  if (subject.type === 'project') return p.booking_type === null
  return p.booking_type === null || p.booking_type === subject.type
}

/** Published policies that are in force today and fit the subject — the only ones the UI may offer. */
export async function assignablePolicies(db: Db, subject: Subject) {
  const today = todayBusinessDate()
  const rows = await db.query<PolicyRow>(
    `select * from cancellation_policies where status = 'published' and effective_from <= $1 and (effective_to is null or effective_to >= $1)
      order by code, version desc`, [today]
  )
  const out = []
  for (const r of rows.filter(r => policyFitsSubject(r, subject))) out.push(policyDto(r, await tiersOf(db, r.id)))
  return out
}

export async function getAssignment(q: Queryable, subject: Subject) {
  const [a] = await q.query<{ policy_id: string; policy_version: number; snapshot: PolicySnapshot; note: string | null; assigned_by: string; assigned_at: Date }>(
    'select * from cancellation_policy_assignments where subject_type = $1 and subject_id = $2', [subject.type, subject.id]
  )
  if (!a) return null
  return { policyId: a.policy_id, version: a.policy_version, snapshot: a.snapshot, note: a.note, assignedBy: a.assigned_by, assignedAt: a.assigned_at.toISOString() }
}

/**
 * The policy that applies to a subject: its own snapshot, or — for a booking without one — the snapshot on its
 * project when that policy covers this booking type (assign once per project, override per booking).
 */
export async function effectiveAssignment(q: Queryable, subject: Subject) {
  const own = await getAssignment(q, subject)
  if (own || subject.type === 'project') return { assignment: own, inherited: false }
  const project = await getAssignment(q, { ...subject, type: 'project', id: subject.projectId, bookingType: null })
  if (project && (project.snapshot.bookingType === null || project.snapshot.bookingType === subject.type)) return { assignment: project, inherited: true }
  return { assignment: null, inherited: false }
}

export async function assignPolicy(tx: Queryable, actor: Actor, subject: Subject, input: { policyId?: string; note?: string }, requestId: string) {
  if (!input.policyId || !ID_PATTERN.test(input.policyId)) throw errors.validation({ policyId: ['Pilih kebijakan.'] })
  const [p] = await tx.query<PolicyRow>('select * from cancellation_policies where id = $1 for share', [input.policyId])
  if (!p) throw errors.validation({ policyId: ['Kebijakan tidak ditemukan.'] })
  if (p.status !== 'published') throw rule(`Kebijakan ${p.code} v${p.version} belum terbit atau sudah nonaktif.`)
  const today = todayBusinessDate()
  if (p.effective_from > today || (p.effective_to && p.effective_to < today)) {
    throw rule(`Kebijakan ${p.code} v${p.version} berlaku ${p.effective_from}${p.effective_to ? ` s/d ${p.effective_to}` : ''}, tidak untuk hari ini.`)
  }
  if (!policyFitsSubject(p, subject)) {
    throw rule(subject.type === 'project'
      ? 'Untuk pembatalan seluruh project, pilih kebijakan yang berlaku untuk semua jenis booking.'
      : `Kebijakan ${p.code} khusus booking ${p.booking_type}, bukan ${subject.type}.`)
  }
  const [active] = await tx.query("select id from refunds where subject_type = $1 and subject_id = $2 and status <> 'rejected'", [subject.type, subject.id])
  if (active) throw rule('Sudah ada kasus pembatalan untuk ini; kebijakannya tidak bisa diganti lagi.')
  const snapshot: PolicySnapshot = {
    policyId: p.id, code: p.code, name: p.name, version: p.version, basis: p.basis, bookingType: p.booking_type,
    effectiveFrom: p.effective_from, effectiveTo: p.effective_to, tiers: await tiersOf(tx, p.id)
  }
  const before = await getAssignment(tx, subject)
  await tx.query(
    `insert into cancellation_policy_assignments (subject_type, subject_id, project_id, policy_id, policy_version, snapshot, note, assigned_by)
     values ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8)
     on conflict (subject_type, subject_id) do update set policy_id = excluded.policy_id, policy_version = excluded.policy_version,
       snapshot = excluded.snapshot, note = excluded.note, assigned_by = excluded.assigned_by, assigned_at = now()`,
    [subject.type, subject.id, subject.projectId, p.id, p.version, JSON.stringify(snapshot), trimOrNull(input.note, 500), actor.userId]
  )
  await recordAudit(tx, {
    action: 'finance.policy_assigned', actorUserId: actor.userId, entityType: `cancellation_subject:${subject.type}`, entityId: subject.id, requestId,
    before: before ? { policyId: before.policyId, version: before.version } : null, after: { policyId: p.id, version: p.version }, reason: input.note ?? null
  })
  return getAssignment(tx, subject)
}
