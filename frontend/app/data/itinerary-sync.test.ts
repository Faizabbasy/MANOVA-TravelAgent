import { describe, expect, it } from 'vitest'
import { ITINERARY_ITEMS } from './projects'
import {
  createItineraryItemOnServer, deleteItineraryItemOnServer, itineraryInput, itineraryItemFromServer, mergeServerItinerary, updateItineraryItemOnServer
} from './itinerary-sync'
import type { ItineraryItemDto } from '~/types/api'

const dto = (over: Partial<ItineraryItemDto> = {}): ItineraryItemDto => ({
  id: 'ITIN-1031',
  projectId: 'PRJ-103',
  date: '2026-08-10',
  time: '07:00',
  title: 'Kedatangan Group Management',
  description: null,
  serviceType: 'flight',
  groupId: 'GRP-001',
  timezone: 'Asia/Makassar',
  location: null,
  visibleToClient: true,
  vendorId: null,
  vendorAmountMinor: null,
  ...over
})

describe('itinerary-sync', () => {
  it('maps the server item to the local shape', () => {
    const item = itineraryItemFromServer(dto({ vendorId: 'VND-001', vendorAmountMinor: '500000', visibleToClient: false }))
    expect(item).toMatchObject({ id: 'ITIN-1031', time: '07:00', vendorId: 'VND-001', vendorAmountIdr: 500000, visibleToClient: false })
    expect(item.description).toBeUndefined()
    expect(item.location).toBeUndefined()
  })

  it('merge keeps object identity and drops items the server no longer has', () => {
    const before = ITINERARY_ITEMS.find(x => x.id === 'ITIN-1031')!
    mergeServerItinerary([dto({ title: 'Judul Server' })])
    expect(ITINERARY_ITEMS).toHaveLength(1)
    expect(ITINERARY_ITEMS[0]).toBe(before)
    expect(ITINERARY_ITEMS[0]!.title).toBe('Judul Server')
  })

  it('turns a form patch into the API input: empty fields clear, rupiah becomes a minor string', () => {
    expect(itineraryInput({ time: undefined, description: '', vendorId: 'VND-001', vendorAmountIdr: 1500.4 }))
      .toEqual({ time: null, description: null, vendorId: 'VND-001', vendorAmountMinor: '1500' })
    expect(itineraryInput({ vendorId: undefined })).toEqual({ vendorId: null, vendorAmountMinor: null })
    expect(itineraryInput({ visibleToClient: false })).toEqual({ visibleToClient: false })
  })

  it('writes go to the server first; a rejected update leaves the local item untouched', async () => {
    mergeServerItinerary([dto()])
    const api = {
      core: {
        createItineraryItem: (_p: string, input: { title: string }) => Promise.resolve({ data: dto({ id: 'ITIN-2000', title: input.title }) }),
        updateItineraryItem: () => Promise.reject(new Error('422')),
        deleteItineraryItem: (id: string) => Promise.resolve({ data: { id, deleted: true } })
      }
    } as never
    const created = await createItineraryItemOnServer(api, 'PRJ-103', { date: '2026-08-11', title: 'Baru' })
    expect(created.id).toBe('ITIN-2000')
    expect(ITINERARY_ITEMS.some(x => x.id === 'ITIN-2000')).toBe(true)
    await expect(updateItineraryItemOnServer(api, 'ITIN-1031', { title: 'Gagal' })).rejects.toThrow()
    expect(ITINERARY_ITEMS.find(x => x.id === 'ITIN-1031')!.title).toBe('Kedatangan Group Management')
    await deleteItineraryItemOnServer(api, 'ITIN-2000')
    expect(ITINERARY_ITEMS.some(x => x.id === 'ITIN-2000')).toBe(false)
  })
})
