import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { notifyInternal } from './client-writes'
import { notify } from './notifications'
import { checkPartyProfile, createActivity, updateParty } from './party-writes'

/**
 * S12c-1: a client proposes changes to its registration / tax / billing data and company name; Admin (vendor/customer
 * management) approves them — then they are applied — or rejects them with a reason. One waiting proposal per party.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

export const SENSITIVE_FIELDS = ['name', 'npwp', 'registrationNumber', 'billingName', 'billingAddress', 'paymentTerm'] as const
const COLUMN: Record<string, string> = { name: 'name', npwp: 'npwp', registrationNumber: 'registration_number', billingName: 'billing_name', billingAddress: 'billing_address', paymentTerm: 'payment_term' }

export async function submitProfileChange(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, today: string, requestId: string) {
  const other = Object.keys(input).filter(k => !(SENSITIVE_FIELDS as readonly string[]).includes(k))
  if (other.length) throw errors.validation(Object.fromEntries(other.map(k => [k, ['Bukan data registrasi/pajak/billing — ubah lewat profil biasa.']])))
  const checked = await checkPartyProfile(tx, input)
  const [current] = await tx.query<Record<string, unknown>>('select * from parties where id = $1 for update', [partyId])
  if (!current) throw errors.notFound('Customer')
  const changes = Object.fromEntries(Object.entries(checked).filter(([k, v]) => (current[COLUMN[k]!] ?? null) !== (v ?? null)))
  if (!Object.keys(changes).length) throw errors.validation({ changes: ['Tidak ada perubahan dibanding data saat ini.'] })
  if ((await tx.query("select 1 from party_profile_changes where party_id = $1 and status = 'submitted'", [partyId])).length)
    throw rule('Masih ada perubahan data yang menunggu verifikasi.')
  const id = await nextId(tx, 'PPC-')
  await tx.query('insert into party_profile_changes (id, party_id, submitted_by, changes) values ($1, $2, $3, $4::text::jsonb)', [id, partyId, actor.userId, JSON.stringify(changes)])
  await createActivity(tx, actor, partyId, { type: 'note', message: `Perubahan data sensitif Company Profile (${Object.keys(changes).join(', ')}) diajukan client, menunggu verifikasi.` }, today, requestId)
  const reviewers = await tx.query<{ id: string }>(
    "select id from users where status = 'active' and (role in ('admin', 'super-admin') or id = (select account_owner_user_id from parties where id = $1)) order by id", [partyId])
  for (const r of reviewers) await notifyInternal(tx, actor, r.id, { type: 'change', title: 'Perubahan data perusahaan menunggu verifikasi', body: `${Object.keys(changes).join(', ')} — ${current.name as string}.`, entityType: 'party', entityId: partyId })
  await recordAudit(tx, { action: 'party.profile_change_submitted', actorUserId: actor.userId, entityType: 'party', entityId: partyId, requestId, after: { changeId: id, changes } })
  return { id }
}

async function lockChange(tx: Queryable, id: string) {
  const [row] = await tx.query<{ id: string; party_id: string; submitted_by: string; changes: Record<string, string | null>; status: string }>(
    'select id, party_id, submitted_by, changes, status from party_profile_changes where id = $1 for update', [id])
  if (!row) throw errors.notFound('Perubahan data')
  if (row.status !== 'submitted') throw rule('Perubahan data ini sudah diputuskan.')
  return row
}

export async function approveProfileChange(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const change = await lockChange(tx, id)
  await updateParty(tx, actor, change.party_id, change.changes, requestId)
  await tx.query("update party_profile_changes set status = 'approved', reviewed_by = $2, reviewed_at = now() where id = $1", [id, actor.userId])
  await createActivity(tx, actor, change.party_id, { type: 'note', message: `Perubahan data sensitif Company Profile (${Object.keys(change.changes).join(', ')}) disetujui dan diterapkan.` }, today, requestId)
  await notify(tx, { userId: change.submitted_by, actorUserId: actor.userId, type: 'change', title: 'Perubahan data perusahaan disetujui',
    body: `Data ${Object.keys(change.changes).join(', ')} telah diperbarui.`, entityType: 'party', entityId: change.party_id })
  await recordAudit(tx, { action: 'party.profile_change_approved', actorUserId: actor.userId, entityType: 'party', entityId: change.party_id, requestId, after: { changeId: id } })
}

export async function rejectProfileChange(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, today: string, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan penolakan wajib diisi.'] })
  const change = await lockChange(tx, id)
  await tx.query("update party_profile_changes set status = 'rejected', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3 where id = $1", [id, actor.userId, reason.slice(0, 1000)])
  await createActivity(tx, actor, change.party_id, { type: 'note', message: `Perubahan data sensitif Company Profile ditolak: ${reason}` }, today, requestId)
  await notify(tx, { userId: change.submitted_by, actorUserId: actor.userId, type: 'change', title: 'Perubahan data perusahaan ditolak', body: reason, entityType: 'party', entityId: change.party_id })
  await recordAudit(tx, { action: 'party.profile_change_rejected', actorUserId: actor.userId, entityType: 'party', entityId: change.party_id, requestId, reason })
}

export async function listProfileChanges(db: Queryable, filter: { id?: string; partyId?: string; status?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select c.*, p.name as party_name, u.name as submitted_by_name from party_profile_changes c
       join parties p on p.id = c.party_id left join users u on u.id = c.submitted_by
      where ($1::text is null or c.id = $1) and ($2::text is null or c.party_id = $2) and ($3::text is null or c.status = $3)
      order by c.created_at desc, c.id desc`, [filter.id ?? null, filter.partyId ?? null, filter.status ?? null])
  return rows.map(r => ({
    id: r.id as string,
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    submittedBy: r.submitted_by as string,
    submittedByName: str(r.submitted_by_name),
    changes: r.changes as Record<string, string | null>,
    status: r.status as string,
    reviewedBy: str(r.reviewed_by),
    reviewedAt: iso(r.reviewed_at),
    rejectionReason: str(r.rejection_reason),
    submittedAt: iso(r.created_at)!
  }))
}

/** The client's view: its latest waiting proposal (no staff ids). */
export async function clientPendingChange(db: Queryable, partyId: string) {
  const [c] = await listProfileChanges(db, { partyId, status: 'submitted' })
  return c ? { id: c.id, changes: c.changes, status: c.status, submittedAt: c.submittedAt } : null
}
