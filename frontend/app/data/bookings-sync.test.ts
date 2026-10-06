import { beforeEach, describe, expect, it } from 'vitest'
import { FLIGHT_BOOKINGS } from './ticketing'
import { PROJECT_SERVICES } from './projects'
import { bookingFromServer, bookingToServer, mergeServerServicesAndBookings } from './bookings-sync'
import type { BookingDto, ProjectServiceDto } from '~/types/api'

const svc = (over: Partial<ProjectServiceDto> = {}): ProjectServiceDto => ({ id: 'SVC-9001', projectId: 'PRJ-101', type: 'flight', label: 'Flight Manila', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR1', budgetMinor: '1000', hasBookings: true, provenance: 'manual', ...over })
const flightDto = (over: Partial<BookingDto> = {}): BookingDto => ({
  type: 'flight',
  id: 'FLT-9001',
  projectId: 'PRJ-101',
  serviceId: 'SVC-9001',
  serviceType: 'flight',
  vendorId: 'VND-001',
  status: 'issued',
  statusReason: null,
  reference: 'PNR1',
  sellAmountMinor: '95000000',
  netCostMinor: '80000000',
  departureDate: '2026-08-20',
  details: { segments: [{ origin: 'CGK', destination: 'MNL', departureAt: '2026-08-20T08:00' }], travelerIds: [], options: [] },
  createdAt: '2026-10-06',
  updatedAt: '2026-10-06',
  ...over
})

describe('bookings-sync', () => {
  beforeEach(() => {
    mergeServerServicesAndBookings({ services: [svc()], bookings: [flightDto()] })
  })

  it('maps server bookings to the UI shape (pnr, prices in rupiah, details spread)', () => {
    const b = FLIGHT_BOOKINGS.find(x => x.id === 'FLT-9001')!
    expect(b).toMatchObject({ projectId: 'PRJ-101', serviceId: 'SVC-9001', status: 'issued', pnr: 'PNR1', sellPriceIdr: 95000000, netCostIdr: 80000000 })
    expect(b.segments[0]!.origin).toBe('CGK')
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')).toMatchObject({ label: 'Flight Manila', status: 'confirmed', budgetIdr: 1000, bookingReference: 'PNR1' })
  })

  it('removes what the server no longer has and keeps object identity on update', () => {
    const before = FLIGHT_BOOKINGS.find(x => x.id === 'FLT-9001')!
    mergeServerServicesAndBookings({ services: [svc()], bookings: [flightDto({ status: 'reissued' })] })
    expect(FLIGHT_BOOKINGS.find(x => x.id === 'FLT-9001')).toBe(before)
    expect(before.status).toBe('reissued')
    mergeServerServicesAndBookings({ services: [], bookings: [] })
    expect(FLIGHT_BOOKINGS.some(x => x.id === 'FLT-9001')).toBe(false)
    expect(PROJECT_SERVICES.some(s => s.id === 'SVC-9001')).toBe(false)
  })

  it('sends details without core fields and prices as minor strings; MICE without prices', () => {
    const b = bookingFromServer(flightDto())
    const out = bookingToServer('flight', b)
    expect(out).toMatchObject({ reference: 'PNR1', sellAmountMinor: '95000000', netCostMinor: '80000000' })
    expect(Object.keys(out.details!)).not.toContain('status')
    expect(Object.keys(out.details!)).not.toContain('pnr')
    const mice = bookingToServer('mice', { id: 'MICE-1', projectId: 'PRJ-1', status: 'planning', boqItems: [{ sellPriceIdr: 5 }], sessions: [] })
    expect(mice.sellAmountMinor).toBeUndefined()
    expect(mice.details!.boqItems).toEqual([{ sellPriceIdr: 5 }])
  })
})
