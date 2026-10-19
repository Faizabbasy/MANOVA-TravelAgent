import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { SERVICE_TYPES } from '../core/booking-rules'
import { createActivity } from '../core/party-writes'
import { notifyInternal } from '../core/client-writes'
import { lockLead, touchLead } from './lead-writes'

/**
 * Client quotations (S6a). Every version keeps its own full content; only the latest version can change and only
 * while it is a draft. Submitting locks it; a revision copies it into a new draft. Self-approval is allowed and
 * recorded. After Won the project keeps its contract value — later revisions never touch it.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

const MONEY: Record<string, string> = {
  amountMinor: 'amount_minor', discountMinor: 'discount_minor', taxMinor: 'tax_minor', markupMinor: 'markup_minor',
  estimatedCostMinor: 'estimated_cost_minor', estimatedMarginMinor: 'estimated_margin_minor'
}
const TEXT: Record<string, string> = {
  currency: 'currency', paymentTerms: 'payment_terms', termsAndConditions: 'terms_and_conditions', inclusions: 'inclusions',
  exclusions: 'exclusions', cancellationPolicy: 'cancellation_policy', proposedItineraryNote: 'proposed_itinerary_note', costSheetId: 'cost_sheet_id'
}
const CONTENT_COLUMNS = [...Object.values(MONEY), ...Object.values(TEXT), 'valid_until', 'service_breakdown']

function content(input: Record<string, unknown>, problems: FieldErrors): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, column] of Object.entries(MONEY)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null && field !== 'amountMinor') { out[column] = null; continue }
    try {
      // The estimated margin may be negative (a loss-making deal); every other figure is ≥ 0.
      const value = field === 'estimatedMarginMinor' && typeof v === 'string' && v.startsWith('-')
        ? -parseAmountMinor(v.slice(1), field, { allowZero: true })
        : parseAmountMinor(v, field, { allowZero: field !== 'amountMinor' })
      out[column] = value.toString()
    } catch {
      problems[field] = [field === 'amountMinor' ? 'Nilai quotation harus lebih dari 0.' : 'Harus angka rupiah.']
    }
  }
  for (const [field, column] of Object.entries(TEXT)) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && (typeof v !== 'string' || v.length > 4000)) { problems[field] = ['Harus teks, maksimal 4000 karakter.']; continue }
    const s = typeof v === 'string' ? v.trim() : ''
    out[column] = column === 'currency' ? (s || 'IDR') : (s || null)
  }
  if (input.validUntil !== undefined) {
    if (input.validUntil === null) out.valid_until = null
    else if (typeof input.validUntil !== 'string' || !isIsoDate(input.validUntil)) problems.validUntil = ['Tanggal harus format YYYY-MM-DD.']
    else out.valid_until = input.validUntil
  }
  if (input.serviceBreakdown !== undefined) {
    const rows = Array.isArray(input.serviceBreakdown) ? input.serviceBreakdown as Record<string, unknown>[] : null
    const cleaned = rows?.map((r) => {
      if (!r || !(SERVICE_TYPES as readonly unknown[]).includes(r.service)) return null
      try {
        const amountMinor = parseAmountMinor(r.amountMinor, 'amountMinor', { allowZero: true }).toString()
        return typeof r.description === 'string' && r.description.trim()
          ? { service: r.service, description: r.description.trim().slice(0, 500), amountMinor }
          : { service: r.service, amountMinor }
      } catch {
        return null
      }
    })
    if (!cleaned || cleaned.includes(null)) problems.serviceBreakdown = ['Rincian layanan tidak valid.']
    else out.service_breakdown = JSON.stringify(cleaned)
  }
  return out
}

const ph = (column: string, i: number) => (column === 'service_breakdown' ? `$${i}::text::jsonb` : `$${i}`)

async function lockQuotation(tx: Queryable, id: string) {
  const [q] = await tx.query<{ id: string; lead_id: string; current_version: number }>('select id, lead_id, current_version from quotations where id = $1 for update', [id])
  if (!q) throw errors.notFound('Quotation')
  const [v] = await tx.query<{ status: string; submitted_by: string | null; amount_minor: string }>(
    'select status, submitted_by, amount_minor from quotation_versions where quotation_id = $1 and version = $2', [id, q.current_version])
  return { ...q, status: v!.status, submittedBy: v!.submitted_by, amountMinor: String(v!.amount_minor) }
}

/** A note on the customer timeline, as the local mutators wrote it. */
async function partyNote(tx: Queryable, actor: Actor, leadId: string, message: string, today: string, requestId: string) {
  const [lead] = await tx.query<{ party_id: string | null }>('select party_id from leads where id = $1', [leadId])
  if (lead?.party_id) await createActivity(tx, actor, lead.party_id, { type: 'note', message, leadId }, today, requestId)
}

export async function createQuotation(tx: Queryable, actor: Actor, leadId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.amountMinor === undefined) problems.amountMinor = ['Nilai quotation harus lebih dari 0.']
  const values = content(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const lead = await lockLead(tx, leadId)
  if (lead.stage !== 'qualified') throw rule('Qualify lead dulu sebelum membuat quotation.')
  if (lead.service_category === 'individual-travel') throw rule('Lead Individual Travel (B2C) langsung menjadi Sales Order, tanpa quotation.')
  if (lead.archived) throw rule('Lead ini diarsip.')
  const [existing] = await tx.query<{ id: string }>('select id from quotations where lead_id = $1', [leadId])
  if (existing) throw new AppError(409, 'CONFLICT', `Lead ini sudah punya quotation ${existing.id}.`, { details: { quotationId: existing.id } })

  const id = await nextId(tx, 'QUO-')
  await tx.query('insert into quotations (id, lead_id, created_on) values ($1, $2, $3)', [id, leadId, today])
  const cols = ['quotation_id', 'version', 'created_by', 'created_on', ...Object.keys(values)]
  await tx.query(`insert into quotation_versions (${cols.join(', ')}) values (${cols.map((c, i) => ph(c, i + 1)).join(', ')})`,
    [id, 1, actor.userId, today, ...Object.values(values)])
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'quotation.created', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { leadId, amountMinor: values.amount_minor } })
  return { id }
}

export async function updateQuotation(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const values = content(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const q = await lockQuotation(tx, id)
  if (q.status !== 'draft') throw rule('Ajukan revisi untuk mengubah quotation yang sudah diajukan.')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update quotation_versions set ${cols.map((c, i) => `${c} = ${ph(c, i + 3)}`).join(', ')}, updated_at = now() where quotation_id = $1 and version = $2`,
    [id, q.current_version, ...Object.values(values)])
  await tx.query('update quotations set updated_at = now() where id = $1', [id])
  await recordAudit(tx, { action: 'quotation.updated', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version, ...values } })
}

export async function reviseQuotation(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, today: string, requestId: string) {
  const problems: FieldErrors = {}
  const values = content(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const q = await lockQuotation(tx, id)
  if (q.status === 'draft') throw rule('Versi terbaru masih draft — ubah langsung, tidak perlu revisi.')
  const next = q.current_version + 1
  await tx.query(
    `insert into quotation_versions (quotation_id, version, created_by, created_on, ${CONTENT_COLUMNS.join(', ')})
     select quotation_id, $3, $4, $5, ${CONTENT_COLUMNS.join(', ')} from quotation_versions where quotation_id = $1 and version = $2`,
    [id, q.current_version, next, actor.userId, today]
  )
  if (q.status !== 'rejected') {
    await tx.query("update quotation_versions set status = 'superseded', updated_at = now() where quotation_id = $1 and version = $2", [id, q.current_version])
  }
  const cols = Object.keys(values)
  if (cols.length) {
    await tx.query(`update quotation_versions set ${cols.map((c, i) => `${c} = ${ph(c, i + 3)}`).join(', ')} where quotation_id = $1 and version = $2`,
      [id, next, ...Object.values(values)])
  }
  await tx.query('update quotations set current_version = $2, sent_to_client_on = null, updated_at = now() where id = $1', [id, next])
  await recordAudit(tx, { action: 'quotation.revised', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: next, from: q.current_version, ...values } })
}

export async function submitQuotation(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const q = await lockQuotation(tx, id)
  if (q.status !== 'draft') throw rule('Hanya quotation draft yang bisa diajukan.')
  await tx.query(
    `update quotation_versions set status = 'submitted', submitted_by = $3, submitted_at = now(), decided_by = null, decided_at = null, decision_note = null, updated_at = now()
      where quotation_id = $1 and version = $2`,
    [id, q.current_version, actor.userId]
  )
  await partyNote(tx, actor, q.lead_id, `Quotation ${id} (Rp ${Number(q.amountMinor).toLocaleString('id-ID')}) diajukan untuk commercial approval.`, today, requestId)
  await recordAudit(tx, { action: 'quotation.submitted', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version } })
}

export async function withdrawQuotation(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const q = await lockQuotation(tx, id)
  if (q.status !== 'submitted') throw rule('Hanya quotation yang sedang diajukan yang bisa ditarik.')
  await tx.query("update quotation_versions set status = 'draft', submitted_by = null, submitted_at = null, updated_at = now() where quotation_id = $1 and version = $2", [id, q.current_version])
  await recordAudit(tx, { action: 'quotation.withdrawn', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version } })
}

export async function decideQuotation(tx: Queryable, actor: Actor, id: string, decision: 'approve' | 'reject', noteInput: unknown, today: string, requestId: string) {
  const note = typeof noteInput === 'string' && noteInput.trim() ? noteInput.trim().slice(0, 2000) : null
  if (decision === 'reject' && !note) throw errors.validation({ note: ['Catatan penolakan wajib diisi.'] })
  const q = await lockQuotation(tx, id)
  if (q.status !== 'submitted') throw rule('Hanya quotation yang sedang diajukan yang bisa disetujui atau ditolak.')
  const status = decision === 'approve' ? 'approved' : 'rejected'
  await tx.query('update quotation_versions set status = $3, decided_by = $4, decided_at = now(), decision_note = $5, updated_at = now() where quotation_id = $1 and version = $2',
    [id, q.current_version, status, actor.userId, note])
  await partyNote(tx, actor, q.lead_id, decision === 'approve'
    ? `Quotation ${id} disetujui (Commercial Approval).${note ? ` Catatan: ${note}` : ''}`
    : `Quotation ${id} ditolak (dikembalikan untuk revisi). Catatan: ${note}`, today, requestId)
  await recordAudit(tx, {
    action: `quotation.${status}`, actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, reason: note,
    details: { version: q.current_version, submittedBy: q.submittedBy, selfApproved: q.submittedBy === actor.userId }
  })
}

export async function sendQuotation(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const q = await lockQuotation(tx, id)
  if (q.status !== 'approved') throw rule('Hanya quotation yang sudah disetujui yang bisa dikirim ke client.')
  await tx.query('update quotations set sent_to_client_on = $2, updated_at = now() where id = $1', [id, today])
  await recordAudit(tx, { action: 'quotation.sent', actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, after: { version: q.current_version } })
}

const CLIENT_RESPONSES = ['accepted', 'rejected', 'revision-requested']

/** S12b-2: the client answers the quotation it was sent — once per version; staff are told and act (Won / revise). */
export async function respondToQuotation(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, today: string, requestId: string) {
  const response = input.response
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 2000) : ''
  if (typeof response !== 'string' || !CLIENT_RESPONSES.includes(response)) throw errors.validation({ response: ['Pilih setuju, tolak, atau minta revisi.'] })
  if (response !== 'accepted' && !note) throw errors.validation({ note: ['Catatan wajib diisi.'] })
  const [q] = await tx.query<{ current_version: number; sent_to_client_on: string | null; client_response_version: number | null; lead_id: string; owner_user_id: string; handed_over_to: string | null; project_id: string | null }>(
    `select q.current_version, q.sent_to_client_on, q.client_response_version, q.lead_id, l.owner_user_id, l.handed_over_to,
            (select p.id from projects p where p.lead_id = l.id) as project_id
       from quotations q join leads l on l.id = q.lead_id where q.id = $1 and l.party_id = $2 for update of q`, [id, partyId])
  if (!q || !q.sent_to_client_on) throw errors.notFound('Quotation')
  if (q.project_id) throw rule('Quotation ini sudah menjadi project.')
  if (q.client_response_version === q.current_version) throw rule('Anda sudah merespons versi quotation ini.')
  await tx.query(
    `update quotations set client_response = $2, client_response_note = $3, client_response_version = current_version, client_responded_by = $4,
            client_responded_at = now(), updated_at = now() where id = $1`, [id, response, note || null, actor.userId])
  const label = response === 'accepted' ? 'menyetujui' : response === 'rejected' ? 'menolak' : 'meminta revisi'
  await createActivity(tx, actor, partyId, { type: 'note', leadId: q.lead_id, message: `Client ${label} quotation ${id} v${q.current_version}.${note ? ` Catatan: ${note}` : ''}` }, today, requestId)
  await notifyInternal(tx, actor, q.handed_over_to ?? q.owner_user_id, { type: 'change', title: `Client ${label} quotation ${id}`, body: note || `Versi ${q.current_version}.`, entityType: 'lead', entityId: q.lead_id })
  await recordAudit(tx, { action: `quotation.client_${response.replace('-', '_')}`, actorUserId: actor.userId, entityType: 'quotation', entityId: id, requestId, reason: note || null, after: { version: q.current_version } })
}
