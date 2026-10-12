import { describe, expect, it } from 'vitest'
import { AIRPORTS, MILESTONE_TEMPLATES, ORGANIZATION_PROFILE, PAYMENT_TERMS } from './master-data'
import {
  createMasterRecordOnServer, mergeServerMasterData, mergeServerOrganizationProfile, setMasterRecordActiveOnServer, updateOrganizationProfileOnServer
} from './master-data-sync'
import type { MasterDataRecordDto, OrganizationProfileDto } from '~/types/api'

const rec = (over: Partial<MasterDataRecordDto>): MasterDataRecordDto => ({
  id: 'APT-001', category: 'airport', isActive: true, data: { iataCode: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta' }, updatedAt: '2026-10-12T01:00:00.000Z', ...over
})
const profile: OrganizationProfileDto = {
  id: 'ORG-001',
  legalName: 'PT Server',
  displayName: 'Server Travel',
  address: 'Jl. Server',
  defaultCurrencyCode: 'IDR',
  businessHours: '',
  contactEmail: 'server@manova.id',
  contactPhone: '',
  updatedAt: '2026-10-12T01:00:00.000Z',
  updatedBy: 'USR-002'
}

describe('master-data-sync', () => {
  it('the server list replaces a category in place, in server order, keeping object identity', () => {
    const cgk = AIRPORTS.find(a => a.id === 'APT-001')!
    mergeServerMasterData([
      rec({ id: 'APT-009', data: { iataCode: 'KNO', name: 'Kualanamu', city: 'Medan' } }),
      rec({ id: 'APT-001', isActive: false, data: { iataCode: 'CGK', name: 'CGK (server)', city: 'Jakarta' } })
    ])
    expect(AIRPORTS.map(a => a.id)).toEqual(['APT-009', 'APT-001'])
    expect(AIRPORTS[1]).toBe(cgk)
    expect(cgk).toMatchObject({ name: 'CGK (server)', isActive: false })
  })

  it('a field the server no longer has is removed; milestone items are copied', () => {
    const items = [{ id: 'MTPL-001-1', label: 'Mulai', offsetDays: 0 }]
    mergeServerMasterData([rec({ id: 'MTPL-001', category: 'milestone-template', data: { label: 'Standar', items } })])
    expect(MILESTONE_TEMPLATES[0]).toEqual({ id: 'MTPL-001', isActive: true, label: 'Standar', items })
    expect(MILESTONE_TEMPLATES[0]!.items).not.toBe(items)
  })

  it('a refused create or deactivation leaves the local list as it was', async () => {
    const before = PAYMENT_TERMS.map(p => ({ ...p }))
    const api = { core: { createMasterRecord: () => Promise.reject(new Error('403')), deactivateMasterRecord: () => Promise.reject(new Error('422')) } } as never
    await expect(createMasterRecordOnServer(api, 'payment-term', { label: 'Net 60', daysDue: 60 })).rejects.toThrow()
    await expect(setMasterRecordActiveOnServer(api, 'payment-term', PAYMENT_TERMS[0]!.id, false)).rejects.toThrow()
    expect(PAYMENT_TERMS).toEqual(before)
  })

  it('a created record is added to its category', async () => {
    const api = { core: { createMasterRecord: () => Promise.resolve({ data: rec({ id: 'PTM-009', category: 'payment-term', data: { label: 'Net 60', daysDue: 60 } }) }) } } as never
    await createMasterRecordOnServer(api, 'payment-term', { label: 'Net 60', daysDue: 60 })
    expect(PAYMENT_TERMS.find(p => p.id === 'PTM-009')).toMatchObject({ label: 'Net 60', daysDue: 60, isActive: true })
  })

  it('the organization profile comes from the server; a refused save keeps it', async () => {
    mergeServerOrganizationProfile(profile)
    expect(ORGANIZATION_PROFILE).toMatchObject({ displayName: 'Server Travel', updatedBy: 'USR-002' })
    const api = { core: { updateOrganizationProfile: () => Promise.reject(new Error('400')) } } as never
    await expect(updateOrganizationProfileOnServer(api, { ...profile, displayName: 'Baru' })).rejects.toThrow()
    expect(ORGANIZATION_PROFILE.displayName).toBe('Server Travel')
  })
})
