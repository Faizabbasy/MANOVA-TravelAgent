import { describe, expect, it } from 'vitest'
import { collectPages } from './paging'

describe('collectPages', () => {
  it('follows the cursor until it ends', async () => {
    const pages: Record<string, { data: number[]; next: string | null }> = { start: { data: [1, 2], next: 'b' }, b: { data: [3], next: null } }
    const seen: (string | null)[] = []
    const all = await collectPages((cursor) => {
      seen.push(cursor)
      const p = pages[cursor ?? 'start']!
      return Promise.resolve({ data: p.data, meta: { pagination: { limit: 2, nextCursor: p.next } } })
    })
    expect(all).toEqual([1, 2, 3])
    expect(seen).toEqual([null, 'b'])
  })
})
