import { beforeEach, describe, expect, it } from 'vitest'
import { FLIGHT_BOOKINGS } from './ticketing'
import { PROJECTS, PROJECT_SERVICES } from './projects'
import { TRANSPORT_BOOKINGS } from './transportation'
import { BOOKING_ORCHESTRATION_RECORDS } from './booking-orchestration'
import { bookingFromServer, bookingToServer, createBookingFromInput, mergeServerServicesAndBookings, patchServiceOnServer, persistBookingEdit, reloadProjectBookings, runBookingStatusChange, runServiceWrite, assignServiceVendorOnServer, allocateServiceBudgetOnServer, bookingConflictsOf, logBookingAttemptOnServer } from './bookings-sync'
import type { BookingDto, ProjectServiceDto } from '~/types/api'
import { ApiError } from '~/lib/api/errors'

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
  paymentGate: { status: 'not-required', basis: null },
  attempts: [],
  flaggedDuplicate: false,
  duplicateOf: [],
  duplicateNote: null,
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
    // Transport and MICE have no reference field: nothing is sent, so the service reference is never touched.
    expect('reference' in mice).toBe(false)
    expect('reference' in bookingToServer('transportation', { id: 'TRN-1', projectId: 'PRJ-1', legs: [] })).toBe(false)
  })

  it('status change: server first, local side effects, server version wins', async () => {
    const calls: string[] = []
    const api = {
      core: {
        changeBookingStatus: () => { calls.push('server'); return Promise.resolve({ data: flightDto({ status: 'cancelled', statusReason: 'x' }) }) },
        listProjectServices: () => Promise.resolve({ data: [svc({ status: 'cancelled' })] })
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
        createBooking: (type: string, input: Record<string, unknown>) => { sent = { type, input }; return Promise.resolve({ data: flightDto({ id: 'TRN-9002', type: 'transport', serviceId: null, details: { legs: [] } }) }) },
        listProjectServices: () => Promise.resolve({ data: [] })
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
    const ok = { core: { updateBooking: (_t: string, _id: string, input: Record<string, unknown>) => { saved = input; return Promise.resolve({ data: flightDto({ details: { ...flightDto().details, fareRules: 'NR' } }) }) }, listProjectServices: () => Promise.resolve({ data: [svc()] }) } } as never
    expect(await persistBookingEdit(ok, 'flight', booking as never, () => { booking.fareRules = 'NR'; return booking })).toBe(true)
    expect((saved!.details as Record<string, unknown>).fareRules).toBe('NR')
    expect(booking.fareRules).toBe('NR')

    const refused = { core: { updateBooking: () => Promise.reject(new Error('422')), listProjectServices: () => Promise.resolve({ data: [svc()] }) } } as never
    await expect(persistBookingEdit(refused, 'flight', booking as never, () => { booking.fareRules = 'X'; booking.pnr = 'NEW'; return booking })).rejects.toThrow()
    expect(booking.fareRules).toBe('NR')
    expect(booking.pnr).toBe('PNR1')

    let called = false
    const spy = { core: { updateBooking: () => { called = true; return Promise.resolve({ data: flightDto() }) }, listProjectServices: () => Promise.resolve({ data: [] }) } } as never
    expect(await persistBookingEdit(spy, 'flight', booking as never, () => undefined)).toBe(false)
    expect(called).toBe(false)
  })

  it('reloads the bookings and services of one project', async () => {
    const api = { core: { listBookings: () => Promise.resolve({ data: [flightDto({ status: 'cancelled' })] }), listProjectServices: () => Promise.resolve({ data: [svc({ status: 'cancelled' })] }) } } as never
    await reloadProjectBookings(api, 'PRJ-101')
    expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('cancelled')
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.status).toBe('cancelled')
  })

  it('a refused status change leaves the local booking untouched', async () => {
    const api = { core: { changeBookingStatus: () => Promise.reject(new Error('422')), listProjectServices: () => Promise.resolve({ data: [] }) } } as never
    let local = false
    await expect(runBookingStatusChange(api, 'flight', { id: 'FLT-9001', projectId: 'PRJ-101' }, 'cancelled', 'x', () => { local = true })).rejects.toThrow()
    expect(local).toBe(false)
    expect(FLIGHT_BOOKINGS.find(b => b.id === 'FLT-9001')!.status).toBe('issued')
  })

  it('service write: server first; local side effects only after success', async () => {
    const calls: string[] = []
    const api = { core: { updateProjectService: () => { calls.push('server'); return Promise.resolve({ data: svc({ vendorId: 'VND-002' }) }) } } } as never
    await runServiceWrite(() => patchServiceOnServer(api, 'SVC-9001', { vendorId: 'VND-002' }), () => { calls.push('local') })
    expect(calls).toEqual(['server', 'local'])
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.vendorId).toBe('VND-002')
    const failing = { core: { updateProjectService: () => Promise.reject(new Error('422')) } } as never
    await expect(runServiceWrite(() => patchServiceOnServer(failing, 'SVC-9001', { vendorId: 'VND-003' }), () => { calls.push('local2') })).rejects.toThrow()
    expect(calls).not.toContain('local2')
  })

  it('vendor assignment: with an amount it goes through a quotation; without, a plain vendor patch; both reload service orders', async () => {
    const calls: string[] = []
    const api = {
      core: {
        createVendorQuotation: () => { calls.push('quote'); return Promise.resolve({ data: { id: 'VQ-901', vendorId: 'VND-002', projectId: 'PRJ-101', serviceId: 'SVC-9001', serviceType: 'flight', amountMinor: '5000000', notes: null, status: 'submitted', decisionReason: null, submittedOn: '2026-10-07', decidedAt: null } }) },
        acceptVendorQuotation: () => { calls.push('accept'); return Promise.resolve({ data: { id: 'VQ-901', vendorId: 'VND-002', projectId: 'PRJ-101', serviceId: 'SVC-9001', serviceType: 'flight', amountMinor: '5000000', notes: null, status: 'accepted', decisionReason: null, submittedOn: '2026-10-07', decidedAt: '2026-10-07' } }) },
        updateProjectService: () => { calls.push('patch'); return Promise.resolve({ data: svc({ vendorId: 'VND-002' }) }) },
        listProjectServices: () => Promise.resolve({ data: [svc({ vendorId: 'VND-002' })] }),
        listServiceOrders: () => { calls.push('orders'); return Promise.resolve({ data: [] }) },
        listVendorQuotations: () => Promise.resolve({ data: [] })
      }
    } as never
    await assignServiceVendorOnServer(api, 'SVC-9001', 'VND-002', undefined, { amountIdr: 5_000_000 })
    expect(calls).toEqual(['quote', 'accept', 'orders'])
    calls.length = 0
    await assignServiceVendorOnServer(api, 'SVC-9001', 'VND-002')
    expect(calls).toEqual(['patch', 'orders'])
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9001')!.vendorId).toBe('VND-002')
    // Saving again with the same vendor and an amount does not create another quotation.
    calls.length = 0
    await assignServiceVendorOnServer(api, 'SVC-9001', 'VND-002', undefined, { amountIdr: 5_000_000 })
    expect(calls).toEqual(['patch', 'orders'])
    // The "Tugaskan Vendor" dialog asks for a quotation explicitly: same vendor, an amount → quotation + accept.
    calls.length = 0
    await assignServiceVendorOnServer(api, 'SVC-9001', 'VND-002', undefined, { amountIdr: 10_000_000, forceQuotation: true })
    expect(calls).toEqual(['quote', 'accept', 'orders'])
  })

  it('budget allocation: patches the existing service of that type, otherwise creates one with the budget', async () => {
    const calls: unknown[][] = []
    const api = {
      core: {
        updateProjectService: (id: string, input: unknown) => { calls.push(['patch', id, input]); return Promise.resolve({ data: svc({ budgetMinor: '80000000' }) }) },
        createProjectService: (projectId: string, input: unknown) => { calls.push(['create', projectId, input]); return Promise.resolve({ data: svc({ id: 'SVC-9200', type: 'hotel', label: 'Hotel', budgetMinor: '40000000', hasBookings: false }) }) }
      }
    } as never
    await allocateServiceBudgetOnServer(api, 'PRJ-101', 'flight', 'Flight', 80_000_000)
    await allocateServiceBudgetOnServer(api, 'PRJ-101', 'hotel', 'Hotel', 40_000_000)
    expect(calls[0]).toEqual(['patch', 'SVC-9001', { budgetMinor: '80000000' }])
    expect(calls[1]![0]).toBe('create')
    expect(calls[1]![2]).toEqual({ type: 'hotel', label: 'Hotel', budgetMinor: '40000000' })
    expect(PROJECT_SERVICES.find(s => s.id === 'SVC-9200')!.budgetIdr).toBe(40_000_000)
  })

  it('orchestration from the server: gate, attempts and duplicate flag; local dependsOn kept', () => {
    // beforeEach already merged FLT-9001, so its record exists; a local dependsOn on it must survive the next merge.
    BOOKING_ORCHESTRATION_RECORDS.find(r => r.bookingId === 'FLT-9001')!.dependsOn = [{ bookingType: 'hotel', bookingId: 'HTL-1' }] as never
    mergeServerServicesAndBookings({ services: [svc()], bookings: [flightDto({ paymentGate: { status: 'cleared', basis: 'project' }, attempts: [{ id: 'BAT-1', outcome: 'failed', note: 'x', at: '2026-10-01T09:00', actorUserId: null }], flaggedDuplicate: true })] })
    const rec = BOOKING_ORCHESTRATION_RECORDS.find(r => r.bookingId === 'FLT-9001')!
    expect(rec).toMatchObject({ paymentGateStatus: 'cleared', flaggedDuplicate: true, paymentGateBasis: 'project' })
    expect(rec.attemptLog).toEqual([{ id: 'BAT-1', at: '2026-10-01T09:00', outcome: 'failed', note: 'x' }])
    expect(rec.dependsOn).toBeDefined()
  })

  it('duplicate flow: 409 conflicts are read from the error; allowDuplicate and the note are sent on the retry', async () => {
    const conflict = new ApiError(409, 'CONFLICT', 'Sudah ada booking aktif untuk layanan ini.', null, {}, { conflicts: [{ type: 'flight', id: 'FLT-1' }] })
    expect(bookingConflictsOf(conflict)).toEqual([{ type: 'flight', id: 'FLT-1' }])
    expect(bookingConflictsOf(new ApiError(409, 'CONFLICT', 'Kunci sudah dipakai'))).toBeNull()
    expect(bookingConflictsOf(new Error('x'))).toBeNull()
    let sent: Record<string, unknown> | undefined
    const api = { core: { createBooking: (_t: string, input: Record<string, unknown>) => { sent = input; return Promise.resolve({ data: flightDto({ id: 'FLT-9100' }) }) }, listProjectServices: () => Promise.resolve({ data: [] }) } } as never
    await createBookingFromInput(api, 'flight', { projectId: 'PRJ-101', serviceId: 'SVC-9001' }, 'key-12345678', { allowDuplicate: true, duplicateNote: 'Grup kedua' })
    expect(sent).toMatchObject({ serviceId: 'SVC-9001', allowDuplicate: true, duplicateNote: 'Grup kedua' })
    expect(sent!.details).toEqual({})
  })

  it('logs an attempt on the server and takes the booking back (attempt log updated)', async () => {
    let sent: unknown[] = []
    const api = { core: { logBookingAttempt: (type: string, id: string, input: unknown) => { sent = [type, id, input]; return Promise.resolve({ data: flightDto({ attempts: [{ id: 'BAT-2', outcome: 'success', note: null, at: '2026-10-07T10:00', actorUserId: 'USR-002' }] }) }) } } } as never
    await logBookingAttemptOnServer(api, 'flight', 'FLT-9001', 'success', '  ')
    expect(sent).toEqual(['flight', 'FLT-9001', { outcome: 'success' }])
    expect(BOOKING_ORCHESTRATION_RECORDS.find(r => r.bookingId === 'FLT-9001')!.attemptLog.map(a => a.id)).toEqual(['BAT-2'])
  })
})
