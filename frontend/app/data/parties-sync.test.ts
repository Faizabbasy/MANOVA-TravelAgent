import { describe, it, expect, afterEach } from 'vitest'
import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from './parties'
import { mergeServerActivities, mergeServerContacts, mergeServerParties, upsertServerParty } from './parties-sync'
import { serverPartyDto } from './parties-sync.test-utils'

const snap = <T>(a: T[]) => a.map(x => ({ ...x }))
const p0 = snap(PARTIES); const c0 = snap(CONTACTS); const a0 = snap(PARTY_ACTIVITIES)
afterEach(() => {
  PARTIES.splice(0, PARTIES.length, ...snap(p0)); CONTACTS.splice(0, CONTACTS.length, ...snap(c0)); PARTY_ACTIVITIES.splice(0, PARTY_ACTIVITIES.length, ...snap(a0))
})

describe('parties-sync', () => {
  it('update di tempat; field lokal (pendingProfileChange, logoFileName) tetap; limit kredit jadi creditLimitIdr', () => {
    const local = PARTIES.find(p => p.id === 'PTY-001')!
    local.logoFileName = 'logo.png'
    upsertServerParty(serverPartyDto({ id: 'PTY-001', city: 'Medan', creditLimitMinor: '750000000' }))
    expect(PARTIES.find(p => p.id === 'PTY-001')).toBe(local)
    expect(local).toMatchObject({ city: 'Medan', creditLimitIdr: 750_000_000, logoFileName: 'logo.png' })
  })

  it('creditLimitMinor null dari server berarti tanpa batas: creditLimitIdr dikosongkan', () => {
    const local = PARTIES.find(p => p.id === 'PTY-001')!
    local.creditLimitIdr = 5
    upsertServerParty(serverPartyDto({ id: 'PTY-001', creditLimitMinor: null }))
    expect(local.creditLimitIdr).toBeUndefined()
  })

  it('merge party menghapus yang tidak ada di server; kontak & aktivitas diganti daftar server', () => {
    mergeServerParties([serverPartyDto({ id: 'PTY-001' }), serverPartyDto({ id: 'PTY-050', name: 'Baru' })])
    expect(PARTIES.map(p => p.id)).toEqual(['PTY-001', 'PTY-050'])
    mergeServerContacts([{ id: 'CP-900', partyId: 'PTY-001', name: 'A', title: 'B', email: null, phone: null }])
    expect(CONTACTS.map(x => x.id)).toEqual(['CP-900'])
    mergeServerActivities([{ id: 'PACT-900', partyId: 'PTY-001', leadId: null, type: 'call', message: 'm', ownerUserId: 'USR-001', activityDate: '2026-10-01', dueAt: null }])
    expect(PARTY_ACTIVITIES[0]).toMatchObject({ id: 'PACT-900', ownerId: 'USR-001', createdAt: '2026-10-01' })
  })
})
