import type { Queryable } from '../db/client'

/**
 * Server-generated IDs that keep the legacy text format of the frontend fixtures (PRJ-341, PTY-031 …), so
 * deep links and finance references look the same as before. One counter per prefix in `id_sequences`;
 * the upsert takes a row lock, so concurrent creates never get the same number.
 */
export type IdPrefix = 'PRJ-' | 'PTY-'

const SOURCES: Record<IdPrefix, string> = { 'PRJ-': 'projects', 'PTY-': 'parties' }

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
  for (const [prefix, table] of Object.entries(SOURCES)) {
    await q.query(
      `insert into id_sequences (prefix, last_value)
       select $1, coalesce(max(substring(id from '^' || $2 || '([0-9]+)$')::integer), 0) from ${table}
       on conflict (prefix) do update set last_value = greatest(id_sequences.last_value, excluded.last_value)`,
      [prefix, prefix]
    )
  }
}
