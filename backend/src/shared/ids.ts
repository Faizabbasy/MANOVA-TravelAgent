import type { Queryable } from '../db/client'

/**
 * Server-generated IDs that keep the legacy text format of the frontend fixtures (PRJ-341, PTY-031 …), so
 * deep links and finance references look the same as before. One counter per prefix in `id_sequences`;
 * the upsert takes a row lock, so concurrent creates never get the same number.
 */
export type IdPrefix = 'PRJ-' | 'PTY-' | 'CP-' | 'PACT-' | 'VND-' | 'VCT-' | 'VPR-' | 'VDOC-' | 'SVC-' | 'FLT-' | 'HTL-' | 'TRN-' | 'MICE-' | 'VQ-' | 'SO-' | 'BAT-' | 'LED-' | 'LACT-' | 'QUO-' | 'SLO-' | 'GRP-' | 'TRV-' | 'ROOM-' | 'ITIN-' | 'TSK-' | 'PMS-' | 'ACT-' | 'CHG-' | 'CR-' | 'INC-' | 'CNX-' | 'DOC-' | 'MSG-' | 'NOT-'
  | 'PT-' | 'ST-' | 'DST-' | 'VC-' | 'APT-' | 'ALN-' | 'MHTL-' | 'CUR-' | 'TAX-' | 'PTM-' | 'CXR-' | 'NUM-' | 'DTPL-' | 'RGC-' | 'ASR-' | 'MTPL-'
  | 'AST-' | 'MNT-' | 'ACO-' | 'CAM-' | 'PRD-' | 'PRP-' | 'VHC-' | 'IT-'
  | 'CTS-' | 'CTD-' | 'EMP-' | 'INS-' | 'PPF-' | 'PPC-' | 'TCK-' | 'TCKR-' | 'FBK-'
  | 'CMT-' | 'ATT-' | 'CRD-' | 'TRQ-' | 'TRQA-' | 'CAP-'

/** Where each prefix's IDs live: table, ID column and an optional fixed filter (bookings share one table). */
const SOURCES: Record<IdPrefix, { table: string; column?: string; where?: string }> = {
  'PRJ-': { table: 'projects' }, 'PTY-': { table: 'parties' }, 'CP-': { table: 'party_contacts' }, 'PACT-': { table: 'party_activities' },
  'VND-': { table: 'vendors' }, 'VCT-': { table: 'vendor_contacts' }, 'VPR-': { table: 'vendor_products' }, 'VDOC-': { table: 'vendor_documents' },
  'SVC-': { table: 'project_services' },
  'FLT-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'flight'" },
  'HTL-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'hotel'" },
  'TRN-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'transport'" },
  'MICE-': { table: 'booking_refs', column: 'booking_id', where: "booking_type = 'mice'" },
  'VQ-': { table: 'vendor_quotations' }, 'SO-': { table: 'service_orders' }, 'BAT-': { table: 'booking_attempts' },
  'LED-': { table: 'leads' }, 'LACT-': { table: 'lead_activities' }, 'QUO-': { table: 'quotations' },
  'SLO-': { table: 'sales_order_refs' },
  'GRP-': { table: 'traveler_groups' }, 'TRV-': { table: 'travelers' }, 'ROOM-': { table: 'room_assignments' },
  'ITIN-': { table: 'itinerary_items' },
  'TSK-': { table: 'project_tasks' }, 'PMS-': { table: 'project_milestones' },
  'ACT-': { table: 'project_activities' }, 'CHG-': { table: 'project_activities' },
  'CR-': { table: 'change_requests' }, 'INC-': { table: 'incidents' }, 'CNX-': { table: 'booking_cancellations' },
  'DOC-': { table: 'documents' }, 'MSG-': { table: 'messages' }, 'NOT-': { table: 'notifications' },
  // S10b: master data, one prefix per category.
  'PT-': { table: 'master_data_records', where: "category = 'project-type'" },
  'ST-': { table: 'master_data_records', where: "category = 'service-type'" },
  'DST-': { table: 'master_data_records', where: "category = 'destination'" },
  'VC-': { table: 'master_data_records', where: "category = 'vendor-category'" },
  'APT-': { table: 'master_data_records', where: "category = 'airport'" },
  'ALN-': { table: 'master_data_records', where: "category = 'airline'" },
  'MHTL-': { table: 'master_data_records', where: "category = 'hotel'" },
  'CUR-': { table: 'master_data_records', where: "category = 'currency'" },
  'TAX-': { table: 'master_data_records', where: "category = 'tax-rule'" },
  'PTM-': { table: 'master_data_records', where: "category = 'payment-term'" },
  'CXR-': { table: 'master_data_records', where: "category = 'cancellation-rule'" },
  'NUM-': { table: 'master_data_records', where: "category = 'numbering-scheme'" },
  'DTPL-': { table: 'master_data_records', where: "category = 'document-template'" },
  'RGC-': { table: 'master_data_records', where: "category = 'readiness-gate'" },
  'ASR-': { table: 'master_data_records', where: "category = 'assignment-rule'" },
  'MTPL-': { table: 'master_data_records', where: "category = 'milestone-template'" },
  // S11a: assets (ID and a code per category), maintenance and checkouts.
  'AST-': { table: 'assets' }, 'MNT-': { table: 'asset_maintenance' }, 'ACO-': { table: 'asset_checkouts' },
  'CAM-': { table: 'assets', column: 'code' }, 'PRD-': { table: 'assets', column: 'code' }, 'PRP-': { table: 'assets', column: 'code' },
  'VHC-': { table: 'assets', column: 'code' }, 'IT-': { table: 'assets', column: 'code' },
  // S11b: marketing content schedule and development.
  'CTS-': { table: 'content_schedule' }, 'CTD-': { table: 'content_development' },
  // S11c: employees and manual incentives (INS-, since INC- is incidents); payroll and attendance use composed IDs.
  'EMP-': { table: 'employees' }, 'INS-': { table: 'incentives' },
  // S12c-1: client payment proofs and proposed company-profile changes.
  'PPF-': { table: 'payment_proofs' }, 'PPC-': { table: 'party_profile_changes' },
  // S12c-2: support tickets, their replies and trip feedback.
  'TCK-': { table: 'support_tickets' }, 'TCKR-': { table: 'support_ticket_replies' }, 'FBK-': { table: 'project_feedback' },
  'CMT-': { table: 'entity_comments' }, 'ATT-': { table: 'entity_attachments' }, 'CRD-': { table: 'change_request_drafts' },
  'TRQ-': { table: 'travel_requests' }, 'TRQA-': { table: 'travel_request_activities' }, 'CAP-': { table: 'client_approvals' }
}

/** IDs other tables already point at without a row of their own (S6a: projects won from a lead made by the old local mock). */
const REFERENCES: Partial<Record<IdPrefix, { table: string; column: string }>> = {
  'LED-': { table: 'projects', column: 'lead_id' },
  'QUO-': { table: 'projects', column: 'source_quotation_id' }
}

export async function nextId(q: Queryable, prefix: IdPrefix, width = 3): Promise<string> {
  const [row] = await q.query<{ last_value: number }>(
    `insert into id_sequences (prefix, last_value) values ($1, 1)
     on conflict (prefix) do update set last_value = id_sequences.last_value + 1
     returning last_value`,
    [prefix]
  )
  return `${prefix}${String(row!.last_value).padStart(width, '0')}`
}

/** Raises every counter to at least the highest ID already present (after a seed or an import). */
export async function syncIdSequences(q: Queryable): Promise<void> {
  for (const [prefix, source] of Object.entries(SOURCES)) {
    const column = source.column ?? 'id'
    await q.query(
      `insert into id_sequences (prefix, last_value)
       select $1, coalesce(max(substring(${column} from '^' || $2 || '([0-9]+)$')::integer), 0) from ${source.table}
       ${source.where ? `where ${source.where}` : ''}
       on conflict (prefix) do update set last_value = greatest(id_sequences.last_value, excluded.last_value)`,
      [prefix, prefix]
    )
    const ref = REFERENCES[prefix as IdPrefix]
    if (ref) {
      await q.query(
        `insert into id_sequences (prefix, last_value)
         select $1, coalesce(max(substring(${ref.column} from '^' || $2 || '([0-9]+)$')::integer), 0) from ${ref.table}
         on conflict (prefix) do update set last_value = greatest(id_sequences.last_value, excluded.last_value)`,
        [prefix, prefix]
      )
    }
  }
}
