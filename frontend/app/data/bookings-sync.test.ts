import { beforeEach, describe, expect, it } from 'vitest'
import { FLIGHT_BOOKINGS } from './ticketing'
import { PROJECTS, PROJECT_SERVICES } from './projects'
import { TRANSPORT_BOOKINGS } from './transportation'
import { bookingFromServer, bookingToServer, createBookingFromInput, mergeServerServicesAndBookings, persistBookingEdit, reloadProjectBookings, runBookingStatusChange } from './bookings-sync'
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

  it('status change: server first, local side effects, server version wins', async () => {
    const calls: string[] = []
    const api = {
      core: {
        changeBookingStatus: async () => { calls.push('server'); return { data: flightDto({ status: 'cancelled', statusReason: 'x' }) } },
        listProjectServices: async () => ({ data: [svc({ status: 'cancelled' })] })
      }
    } as never
    await runBookingStatusChange(api, 'flight', { id: 'FLT-9001', projectId: 'PRJ-101' }, 'cancelled', 'x', () => { calls.push('local') })
    expect(calls).toEqual(['server', 'local'])
    expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('cancelled')
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.status).toBe('cancelled')
  })

  it('create from the former local input: label from the destination, the rest as details', async () => {
    let sent: { type: string; input: Record<string, unknown> } | undefined
    const api = {
      core: {
        createBooking: async (type: string, input: Record<string, unknown>) => { sent = { type, input }; return { data: flightDto({ id: 'TRN-9002', type: 'transport', serviceId: null, details: { legs: [] } }) } },
        listProjectServices: async () => ({ data: [] })
      }
    } as never
    const project = PROJECTS.find(p => p.destination)!
    const made = await createBookingFromInput(api, 'transportation', { projectId: project.id, transferType: 'airport-pickup', travelerIds: undefined })
    expect(sent).toEqual({ type: 'transport', input: { projectId: project.id, label: `Transport ${project.destination}`, details: { transferType: 'airport-pickup' } } })
    expect(TRANSPORT_BOOKINGS.find(b => b.id === 'TRN-9002')).toBe(made)
  })

  it('edit: local change saved to the server; a refused save puts the booking back; a local refusal sends nothing', async () => {
    const booking = FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!
    let saved: Record<string, unknown> | undefined
    const ok = { core: { updateBooking: async (_t: string, _id: string, input: Record<string, unknown>) => { saved = input; return { data: flightDto({ details: { ...flightDto().details, fareRules: 'NR' } }) } }, listProjectServices: async () => ({ data: [svc()] }) } } as never
    expect(await persistBookingEdit(ok, 'flight', booking as never, () => { booking.fareRules = 'NR'; return booking })).toBe(true)
    expect((saved!.details as Record<string, unknown>).fareRules).toBe('NR')
    expect(booking.fareRules).toBe('NR')

    const refused = { core: { updateBooking: async () => { throw new Error('422') }, listProjectServices: async () => ({ data: [svc()] }) } } as never
    await expect(persistBookingEdit(refused, 'flight', booking as never, () => { booking.fareRules = 'X'; booking.pnr = 'NEW'; return booking })).rejects.toThrow()
    expect(booking.fareRules).toBe('NR')
    expect(booking.pnr).toBe('PNR1')

    let called = false
    const spy = { core: { updateBooking: async () => { called = true; return { data: flightDto() } }, listProjectServices: async () => ({ data: [] }) } } as never
    expect(await persistBookingEdit(spy, 'flight', booking as never, () => undefined)).toBe(false)
    expect(called).toBe(false)
  })

  it('reloads the bookings and services of one project', async () => {
    const api = { core: { listBookings: async () => ({ data: [flightDto({ status: 'cancelled' })] }), listProjectServices: async () => ({ data: [svc({ status: 'cancelled' })] }) } } as never
    await reloadProjectBookings(api, 'PRJ-101')
    expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('cancelled')
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.status).toBe('cancelled')
  })

  it('a refused status change leaves the local booking untouched', async () => {
    const api = { core: { changeBookingStatus: async () => { throw new Error('422') }, listProjectServices: async () => ({ data: [] }) } } as never
    let local = false
    await expect(runBookingStatusChange(api, 'flight', { id: 'FLT-9001', projectId: 'PRJ-101' }, 'cancelled', 'x', () => { local = true })).rejects.toThrow()
    expect(local).toBe(false)
    expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('issued')
  })
})
