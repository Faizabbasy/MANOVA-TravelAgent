import { describe, it, expect, afterEach } from 'vitest'
import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from './parties'
import { applyServerActivityId, ensureCustomerForLead, makeActivitySink, mergeServerActivities, mergeServerContacts, mergeServerParties, upsertServerParty } from './parties-sync'
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

describe('ensureCustomerForLead', () => {
  it('memakai party yang sudah ada (nama sama) tanpa memanggil API', async () => {
    const lead = LEADS.find(l => l.companyName && PARTIES.some(p => p.name.toLowerCase() === l.companyName!.toLowerCase()))!
    let calls = 0
    const party = await ensureCustomerForLead({ core: { createParty: () => { calls++; return Promise.reject(new Error('x')) } } } as never, lead.id, 'company')
    expect(party.name.toLowerCase()).toBe(lead.companyName!.toLowerCase())
    expect(calls).toBe(0)
  })

  it('membuat party di server bila belum ada; error diteruskan tanpa mengubah lead', async () => {
    const lead = LEADS.find(l => l.companyName && !PARTIES.some(p => p.name.toLowerCase() === l.companyName!.toLowerCase()))!
    const before = { ...lead }
    const created = await ensureCustomerForLead({ core: { createParty: (input: { name: string }) => Promise.resolve({ data: serverPartyDto({ id: 'PTY-060', name: input.name, lifecycleStatus: 'prospect' }) }) } } as never, lead.id, 'company')
    expect(created.id).toBe('PTY-060')
    await expect(ensureCustomerForLead({ core: { createParty: () => Promise.reject(new Error('down')) } } as never, LEADS.find(l => l.companyName && l.id !== lead.id && !PARTIES.some(p => p.name.toLowerCase() === l.companyName!.toLowerCase()))!.id, 'company')).rejects.toThrow('down')
    expect(lead.stage).toBe(before.stage)
  })
})
