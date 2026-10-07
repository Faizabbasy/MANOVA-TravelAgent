import { describe, it, expect, afterEach } from 'vitest'
import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from './parties'
import { applyServerActivityId, setCreditLimitOnServer, makeActivitySink, mergeServerActivities, mergeServerContacts, mergeServerParties, upsertServerParty } from './parties-sync'
import { serverPartyDto } from './parties-sync.test-utils'
import { createPartyActivity, LEADS, setPartyActivitySink } from './index'

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

describe('sink aktivitas', () => {
  it('createPartyActivity memanggil sink; sukses mengganti id lokal dengan id server', async () => {
    const sent: string[] = []
    setPartyActivitySink((a) => { sent.push(a.message) })
    const activity = createPartyActivity({ partyId: 'PTY-001', type: 'note', message: 'Halo', ownerId: 'USR-001' })
    expect(sent).toEqual(['Halo'])
    setPartyActivitySink(null)
    await applyServerActivityId(activity.id, 'PACT-777')
    expect(PARTY_ACTIVITIES.some(a => a.id === 'PACT-777' && a.message === 'Halo')).toBe(true)
  })

  it('sink gagal: aktivitas tetap ada dan notifikasi dipanggil', async () => {
    const warned: string[] = []
    const sink = makeActivitySink({ core: { createActivity: () => Promise.reject(new Error('down')) } } as never, msg => warned.push(msg))
    const activity = createPartyActivity({ partyId: 'PTY-001', type: 'call', message: 'Tes', ownerId: 'USR-001' })
    await sink(activity)
    expect(PARTY_ACTIVITIES.some(a => a.id === activity.id)).toBe(true)
    expect(warned).toHaveLength(1)
  })
})

describe('setCreditLimitOnServer', () => {
  it('mengirim nominal sebagai minor string beserta alasan, lalu menerapkan jawaban server', async () => {
    const sent: unknown[] = []
    const api = { core: { setCreditLimit: (id: string, input: unknown) => { sent.push({ id, input }); return Promise.resolve({ data: serverPartyDto({ id: 'PTY-001', creditLimitMinor: '500000000' }) }) } } }
    const party = await setCreditLimitOnServer(api as never, 'PTY-001', 500_000_000, 'Review tahunan')
    expect(sent).toEqual([{ id: 'PTY-001', input: { creditLimitMinor: '500000000', reason: 'Review tahunan' } }])
    expect(party.creditLimitIdr).toBe(500_000_000)
  })

  it('kosong = tanpa batas: dikirim null dan limit lokal dihapus', async () => {
    const sent: unknown[] = []
    const api = { core: { setCreditLimit: (_id: string, input: unknown) => { sent.push(input); return Promise.resolve({ data: serverPartyDto({ id: 'PTY-001', creditLimitMinor: null }) }) } } }
    const party = await setCreditLimitOnServer(api as never, 'PTY-001', null, 'Tanpa batas')
    expect(sent).toEqual([{ creditLimitMinor: null, reason: 'Tanpa batas' }])
    expect(party.creditLimitIdr).toBeUndefined()
  })
})
