import { describe, expect, it } from 'vitest'
import { collabApi, commentAuthor } from './collab'

const calls: string[] = []
const fake = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push(`${name}:${JSON.stringify(args[0])}`); return Promise.resolve({ data: [] }) } })
const api = { core: fake } as never

describe('collab helpers (S12c-5)', () => {
  it('the client portal uses /client routes, staff the staff routes', async () => {
    calls.length = 0
    await collabApi(api, true).comments('itinerary', 'PRJ-201')
    await collabApi(api, false).addAttachment('change-request', 'CR-001', 'a.pdf')
    expect(calls).toEqual(['listClientComments:"itinerary"', 'addAttachment:{"entityType":"change-request","entityId":"CR-001","fileName":"a.pdf"}'])
  })

  it('names the author and marks MANOVA staff in the portal', () => {
    expect(commentAuthor({ authorName: 'Doni', fromClient: false }, true)).toBe('Doni (MANOVA)')
    expect(commentAuthor({ authorName: 'Dimas', fromClient: true }, true)).toBe('Dimas')
    expect(commentAuthor({ authorName: 'Dimas', fromClient: true }, false)).toBe('Dimas (client)')
  })
})
