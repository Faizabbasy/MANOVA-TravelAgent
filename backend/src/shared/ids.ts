import type { Queryable } from '../db/client'

/**
 * Server-generated IDs that keep the legacy text format of the frontend fixtures (PRJ-341, PTY-031 …), so
 * deep links and finance references look the same as before. One counter per prefix in `id_sequences`;
 * the upsert takes a row lock, so concurrent creates never get the same number.
 */
export type IdPrefix = 'PRJ-' | 'PTY-' | 'CP-' | 'PACT-' | 'VND-' | 'VCT-' | 'VPR-' | 'VDOC-' | 'SVC-' | 'FLT-' | 'HTL-' | 'TRN-' | 'MICE-' | 'VQ-' | 'SO-' | 'BAT-' | 'LED-' | 'LACT-' | 'QUO-'

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
  'LED-': { table: 'leads' }, 'LACT-': { table: 'lead_activities' }, 'QUO-': { table: 'quotations' }
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
  }
}
