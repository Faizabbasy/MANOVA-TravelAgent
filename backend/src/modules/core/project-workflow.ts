import { ROLE_DEFINITIONS, type Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { projectFinanceBlockers, projectFinanceSummary } from '../finance/summaries'
import { STATUS_TRANSITIONS } from './statuses'

/** Project Order workflow commands (S3b). Gates whose data lives in the frontend (travelers, itinerary, …) stay in the UI. */
export { STATUS_TRANSITIONS }

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
type Row = { status: string; handover_accepted_at: string | null; ready_at: string | null; finance_settled_at: string | null; closed_at: string | null; owner_user_id: string | null }

async function lock(tx: Queryable, id: string): Promise<Row> {
  const [row] = await tx.query<Row>('select status, handover_accepted_at, ready_at, finance_settled_at, closed_at, owner_user_id from projects where id = $1 for update', [id])
  if (!row) throw errors.notFound('Project')
  return row
}
const audit = (tx: Queryable, actor: Actor, id: string, requestId: string, action: string, extra: { before?: unknown; after?: unknown; reason?: string | null } = {}) =>
  recordAudit(tx, { action, actorUserId: actor.userId, entityType: 'project', entityId: id, requestId, ...extra })

export async function acceptHandover(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const p = await lock(tx, id)
  if (p.status !== 'draft' || p.handover_accepted_at) throw rule('Handover hanya bisa diterima sekali, saat project masih Draft.')
  await tx.query('update projects set handover_accepted_at = now(), handover_accepted_by = $2, updated_at = now() where id = $1', [id, actor.userId])
  await audit(tx, actor, id, requestId, 'project.handover_accepted')
}

export async function returnHandover(tx: Queryable, actor: Actor, id: string, reason: unknown, requestId: string) {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (!text) throw errors.validation({ reason: ['Alasan pengembalian wajib diisi.'] })
  const p = await lock(tx, id)
  if (p.status !== 'draft' || p.handover_accepted_at) throw rule('Handover hanya bisa dikembalikan sebelum diterima, saat project masih Draft.')
  await tx.query('update projects set handover_returned_at = now(), handover_return_reason = $2, updated_at = now() where id = $1', [id, text])
  await audit(tx, actor, id, requestId, 'project.handover_returned', { reason: text })
}

/** Moves the status along the transition map; returns the previous status. */
export async function transition(tx: Queryable, actor: Actor, id: string, to: unknown, reason: unknown, requestId: string): Promise<string> {
  if (typeof to !== 'string' || !(to in STATUS_TRANSITIONS)) throw errors.validation({ to: ['Status tujuan tidak dikenal.'] })
  const text = typeof reason === 'string' ? reason.trim() : ''
  if ((to === 'on-hold' || to === 'cancelled') && !text) throw errors.validation({ reason: ['Alasan wajib diisi untuk On Hold atau Batal.'] })
  const p = await lock(tx, id)
  if (!STATUS_TRANSITIONS[p.status]!.includes(to)) throw rule(`Status tidak bisa berubah dari "${p.status}" ke "${to}".`)
  // Gates hold whatever the source status (also when resuming from on-hold).
  if (['planning', 'confirmed', 'in-progress'].includes(to) && !p.handover_accepted_at) throw rule('Terima handover dulu sebelum project dilanjutkan.')
  // S8: open incidents block departure; change requests still waiting for a decision block completion.
  if (to === 'in-progress') {
    const open = await tx.query<{ id: string }>("select id from incidents where project_id = $1 and status in ('open', 'escalated') order by id", [id])
    if (open.length) throw rule(`Masih ada insiden terbuka (${open.map(x => x.id).join(', ')}) — selesaikan dulu sebelum berangkat.`)
  }
  if (to === 'completed') {
    const pending = await tx.query<{ id: string }>("select id from change_requests where project_id = $1 and status in ('submitted', 'under-review') order by id", [id])
    if (pending.length) throw rule(`Masih ada change request yang belum diputuskan (${pending.map(x => x.id).join(', ')}) — putuskan dulu sebelum project selesai.`)
  }
  if (to === 'in-progress' && !p.ready_at) throw rule('Project harus Ready dulu (DP ditagih dan diterima Finance) sebelum berangkat.')
  await tx.query('update projects set status = $2, updated_at = now() where id = $1', [id, to])
  await audit(tx, actor, id, requestId, 'project.status_changed', { before: { status: p.status }, after: { status: to }, reason: text || null })
  return p.status
}

export async function markReady(db: Db, actor: Actor, id: string, requestId: string) {
  const facts = await projectFinanceSummary(db, id, false)
  if (!facts.dpInvoiced || !facts.dpReceived) throw rule('Project baru bisa Ready setelah invoice DP terbit dan pembayaran DP diterima Finance.')
  await db.transaction(async (tx) => {
    const p = await lock(tx, id)
    if (p.status !== 'confirmed' || p.ready_at) throw rule('Hanya project Confirmed yang belum Ready yang bisa ditandai Ready.')
    await tx.query('update projects set ready_at = now(), updated_at = now() where id = $1', [id])
    await audit(tx, actor, id, requestId, 'project.ready')
  })
}

export async function closeFinance(db: Db, actor: Actor, id: string, requestId: string) {
  const blockers = await projectFinanceBlockers(db, id)
  if (blockers.length) throw rule(`Finance project belum bisa ditutup: ${blockers.join(' ')}`)
  await db.transaction(async (tx) => {
    const p = await lock(tx, id)
    if (p.finance_settled_at) throw rule('Finance project ini sudah ditutup.')
    await tx.query('update projects set finance_settled_at = now(), finance_settled_by = $2, updated_at = now() where id = $1', [id, actor.userId])
    await audit(tx, actor, id, requestId, 'project.finance_closed')
  })
}

export async function closeProject(tx: Queryable, actor: Actor, id: string, input: { finalNote?: unknown; clientFeedback?: unknown }, requestId: string) {
  const note = typeof input.finalNote === 'string' ? input.finalNote.trim() : ''
  if (!note) throw errors.validation({ finalNote: ['Catatan akhir wajib diisi sebelum menutup project.'] })
  const feedback = typeof input.clientFeedback === 'string' ? input.clientFeedback.trim() || null : null
  const p = await lock(tx, id)
  if (p.closed_at) throw rule('Project ini sudah ditutup.')
  if (p.status !== 'completed') throw rule('Project baru bisa ditutup setelah berstatus Completed.')
  if (!p.finance_settled_at) throw rule('Tutup finance project dulu sebelum menutup project.')
  // Anything billed or owed after the finance close blocks the project close too.
  const blockers = await projectFinanceBlockers(tx as Db, id)
  if (blockers.length) throw rule(`Finance project berubah setelah ditutup: ${blockers.join(' ')}`)
  await tx.query('update projects set closed_at = now(), closed_by = $2, final_note = $3, client_feedback = $4, updated_at = now() where id = $1', [id, actor.userId, note, feedback])
  await audit(tx, actor, id, requestId, 'project.closed', { after: { finalNote: note, clientFeedback: feedback } })
}

export async function addMember(tx: Queryable, actor: Actor, id: string, userId: string, requestId: string) {
  await lock(tx, id)
  const [u] = await tx.query<{ role: string; status: string }>('select role, status from users where id = $1', [userId])
  if (!u || u.status !== 'active' || ROLE_DEFINITIONS[u.role as keyof typeof ROLE_DEFINITIONS]?.kind !== 'internal') throw errors.validation({ userId: ['User internal aktif tidak ditemukan.'] })
  const added = await tx.query('insert into project_members (project_id, user_id) values ($1, $2) on conflict do nothing returning user_id', [id, userId])
  if (added.length) await audit(tx, actor, id, requestId, 'project.member_added', { after: { userId } })
}

export async function removeMember(tx: Queryable, actor: Actor, id: string, userId: string, requestId: string) {
  const p = await lock(tx, id)
  if (p.owner_user_id === userId) throw rule('Owner project tidak bisa dikeluarkan dari tim.')
  const removed = await tx.query('delete from project_members where project_id = $1 and user_id = $2 returning user_id', [id, userId])
  if (removed.length) await audit(tx, actor, id, requestId, 'project.member_removed', { before: { userId } })
}
