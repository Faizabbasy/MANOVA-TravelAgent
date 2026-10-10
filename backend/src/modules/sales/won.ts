import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { actorName, recordProjectActivity } from '../core/activities'
import { createProject } from '../core/project-writes'
import { insertLeadActivity, lockLead, touchLead } from './lead-writes'
import { wonProjectId } from './repository'

/**
 * Mark as Won (S6a): the lead row is locked first, so a second click waits and then finds the project. The project
 * is created through the S3a path with the approved version's value as its contract value.
 */
export async function markLeadWon(tx: Queryable, actor: Actor, leadId: string, today: string, requestId: string): Promise<{ projectId: string; created: boolean }> {
  const lead = await lockLead(tx, leadId)
  const existing = await wonProjectId(tx, leadId)
  if (existing) return { projectId: existing, created: false }

  const [q] = await tx.query<{ id: string; status: string; amount_minor: string }>(
    `select q.id, v.status, v.amount_minor from quotations q join quotation_versions v on v.quotation_id = q.id and v.version = q.current_version
      where q.lead_id = $1`,
    [leadId]
  )
  const missing: string[] = []
  if (lead.stage !== 'qualified') missing.push('Lead belum qualified')
  if (!lead.party_id) missing.push('Customer belum ditautkan')
  if (!q) missing.push('Quotation belum dibuat')
  else if (q.status !== 'approved') missing.push('Quotation versi terbaru belum disetujui')
  if (!lead.destination) missing.push('Destinasi belum diisi')
  if (!lead.travel_start_date || !lead.travel_end_date) missing.push('Periode perjalanan belum diisi')
  if (!lead.traveler_estimate) missing.push('Estimasi traveler belum diisi')
  if (!lead.service_scope?.length) missing.push('Service scope belum dipilih')
  if (lead.archived) missing.push('Lead diarsip')
  if (missing.length || !q) throw new AppError(422, 'RULE_VIOLATION', `Lead belum bisa Won: ${missing.join(', ')}.`, { details: { missing } })

  const { id: projectId } = await createProject(tx, actor, {
    partyId: lead.party_id!,
    leadId,
    sourceQuotationId: q.id,
    name: lead.title ?? lead.company_name ?? lead.name,
    destination: lead.destination!,
    travelStartDate: lead.travel_start_date!,
    travelEndDate: lead.travel_end_date!,
    characteristic: 'normal',
    serviceScope: lead.service_scope,
    travelerCount: lead.traveler_estimate!,
    contractValueMinor: String(q.amount_minor)
  }, requestId)
  await insertLeadActivity(tx, leadId, 'note', `Lead Won — project ${projectId} dibuat dari quotation ${q.id}.`, actor.userId, today)
  await recordProjectActivity(tx, {
    projectId, actorUserId: actor.userId, sourceAction: 'lead.won', sourceEntityId: leadId,
    message: `Project ${projectId} dibuat dari Lead ${leadId} (Won oleh ${await actorName(tx, actor.userId)}).`
  })
  await touchLead(tx, leadId, today)
  await recordAudit(tx, {
    action: 'lead.won', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId,
    after: { projectId, quotationId: q.id, contractValueMinor: String(q.amount_minor) }
  })
  return { projectId, created: true }
}
