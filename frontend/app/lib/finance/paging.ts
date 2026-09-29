import type { ApiPagination } from '~/types/api'

/**
 * Follows the cursor to the end, so a list (allocation targets, reference data) is never silently cut at
 * one page. `guard` bounds the number of pages as a safety net against a misbehaving cursor.
 */
export async function collectPages<T> (
  page: (cursor: string | null) => Promise<{ data: T[]; meta: { pagination: ApiPagination } }>,
  guard = 50
): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null
  for (let i = 0; i < guard; i++) {
    const res = await page(cursor)
    all.push(...res.data)
    cursor = res.meta.pagination.nextCursor
    if (!cursor) { break }
  }
  return all
}
