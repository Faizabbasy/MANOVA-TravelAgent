import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { createActivity, createParty } from '../core/party-writes'
import { missingQualification } from './lead-rules'
import { insertLeadActivity, lockLead } from './lead-writes'
import { wonProjectId } from './repository'

/**
 * Qualify (S6a): the same required fields as the form, then the customer — the one named, else one with the same
 * name and kind, else a new one (company → prospect, individual → client) owned by the Account Executive.
 * B2C sales orders stay local until S6b; the server records the stage and the customer.
 */
export async function qualifyLead(tx: Queryable, actor: Actor, id: string, input: { customerKind?: unknown; partyId?: unknown }, today: string, requestId: string): Promise<void> {
  const lead = await lockLead(tx, id)
  if (lead.stage === 'qualified' && lead.party_id) return
  if (await wonProjectId(tx, id)) throw new AppError(422, 'RULE_VIOLATION', 'Lead ini sudah menjadi project.')
  if (lead.archived) throw new AppError(422, 'RULE_VIOLATION', 'Lead ini diarsip — buka kembali sebelum qualify.')
  const kind = input.customerKind ?? (lead.service_category === 'individual-travel' ? 'individual' : 'company')
  if (kind !== 'company' && kind !== 'individual') throw errors.validation({ customerKind: ['Pilih perusahaan atau individu.'] })
  const missing = missingQualification(lead)
  if (missing.length) {
    throw new AppError(422, 'RULE_VIOLATION', `Lengkapi data qualification dulu: ${missing.join(', ')}.`, { details: { missing } })
  }

  let partyId: string
  if (input.partyId !== undefined && input.partyId !== null) {
    const found = typeof input.partyId === 'string' && ID_PATTERN.test(input.partyId)
      ? (await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId]))[0]
      : undefined
    if (!found) throw errors.validation({ partyId: ['Customer tidak ditemukan.'] })
    partyId = found.id
  } else {
    const name = (kind === 'company' ? lead.company_name || lead.name : lead.name).trim()
    const [same] = await tx.query<{ id: string }>(
      `select id from parties where lower(name) = lower($1) and ${kind === 'company' ? "coalesce(party_type, 'company') <> 'individual'" : "party_type = 'individual'"} order by id limit 1`,
      [name]
    )
    partyId = same?.id ?? (await createParty(tx, actor, {
      name,
      partyType: kind,
      lifecycleStatus: kind === 'individual' ? 'client' : 'prospect',
      accountOwnerUserId: lead.handed_over_to ?? lead.owner_user_id
    }, requestId)).id
  }

  await tx.query("update leads set stage = 'qualified', party_id = $2, qualified_on = $3, unqualified_reason = null, last_updated_on = $3, updated_at = now() where id = $1",
    [id, partyId, today])
  const ae = lead.handed_over_to ?? lead.owner_user_id
  await insertLeadActivity(tx, id, 'note', 'Lead Qualified', ae, today)
  if (lead.handed_over_to) {
    const [user] = await tx.query<{ name: string }>('select name from users where id = $1', [lead.handed_over_to])
    await insertLeadActivity(tx, id, 'note', `Lead Assigned to Account Executive (${user?.name ?? lead.handed_over_to})`, ae, today)
  }
  if (lead.service_category !== 'individual-travel') {
    await createActivity(tx, actor, partyId, { type: 'note', message: `Lead ${id} qualified — siap dibuatkan Quotation.`, leadId: id }, today, requestId)
  }
  await recordAudit(tx, { action: 'lead.qualified', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { partyId, customerKind: kind } })
}
