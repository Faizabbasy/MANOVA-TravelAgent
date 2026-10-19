import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S12b-1: these client portal screens write through /client/* — the local mutators must not come back. The rest of the
 * portal (travel requests, approvals, support, feedback, payment proofs… — S12c) still writes locally and is excluded
 * from `no-local-sales.test.ts` as a whole.
 */
const FILES = [
  'components/client/ParticipantsListPanel.vue',
  'pages/client/participants/[id]/index.vue',
  'pages/client/project-orders/[id]/index.vue'
]
const FORBIDDEN = [
  'createTraveler(', 'updateTraveler(', 'cancelTraveler(', 'replaceTraveler(', 'commitTravelerImport(', 'setTravelerVip(',
  'createRoomAssignment(', 'setRoomAssignmentTravelers('
]
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

describe('client portal writes go to the server (S12b-1)', () => {
  it('ignores the server versions', () => {
    expect(used('await clientCancelTraveler(api, p, id, r)', 'cancelTraveler(')).toBe(false)
    expect(used('cancelTraveler(id, reason)', 'cancelTraveler(')).toBe(true)
  })

  it.each(FILES)('%s', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8')
    expect(FORBIDDEN.filter(name => used(source, name))).toEqual([])
  })
})
