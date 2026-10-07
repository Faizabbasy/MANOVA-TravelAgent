import { PROJECTS, PROJECT_SERVICES } from './projects'
import { FLIGHT_BOOKINGS } from './ticketing'
import { HOTEL_BOOKINGS } from './accommodation'
import { TRANSPORT_BOOKINGS } from './transportation'
import { MICE_EVENTS } from './mice'
import { BOOKING_ORCHESTRATION_RECORDS } from './booking-orchestration'
import type { ProjectService } from '~/types/project'
import type { ApiBookingType, BookingCreateInput, BookingDto, BookingPatchInput, ProjectServiceDto, ServiceCreateInput, ServicePatchInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `PROJECT_SERVICES` + the four booking arrays (S4a). The server owns services and bookings; the UI
 * keeps the booking objects (same shape as before: core fields + `details` spread) and updates them in place.
 * Writes go to the server first; local side effects (activity log, service orders, payment gate) run after.
 */

export type UiBookingType = 'flight' | 'hotel' | 'transportation' | 'mice'
export const toApiBookingType = (t: UiBookingType | ApiBookingType): ApiBookingType => (t === 'transportation' ? 'transport' : t)

type AnyBooking = Record<string, unknown> & { id: string }
type CoreApi = Pick<ManovaApi, 'core'>

const ARRAYS: Record<ApiBookingType, AnyBooking[]> = {
  flight: FLIGHT_BOOKINGS as unknown as AnyBooking[],
  hotel: HOTEL_BOOKINGS as unknown as AnyBooking[],
  transport: TRANSPORT_BOOKINGS as unknown as AnyBooking[],
  mice: MICE_EVENTS as unknown as AnyBooking[]
}
/** Same list as the server `CORE_BOOKING_KEYS`: these never travel inside `details`. */
const CORE_KEYS = ['id', 'projectId', 'serviceId', 'status', 'statusReason', 'netCostIdr', 'sellPriceIdr', 'pnr', 'confirmationNumber', 'createdAt', 'updatedAt']
const idr = (minor: string | null) => (minor === null ? undefined : Number(minor))
const minor = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : null)

export function serviceFromServer (d: ProjectServiceDto): ProjectService {
  const s: ProjectService = { id: d.id, projectId: d.projectId, type: d.type, label: d.label, status: d.status }
  if (d.vendorId) { s.vendorId = d.vendorId }
  if (d.bookingReference) { s.bookingReference = d.bookingReference }
  if (d.budgetMinor !== null) { s.budgetIdr = idr(d.budgetMinor) }
  return s
}

export function bookingFromServer (d: BookingDto): AnyBooking {
  const b: AnyBooking = { ...d.details, id: d.id, projectId: d.projectId, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt }
  if (d.serviceId) { b.serviceId = d.serviceId }
  if (d.statusReason) { b.statusReason = d.statusReason }
  if (d.type !== 'mice') {
    if (d.sellAmountMinor !== null) { b.sellPriceIdr = Number(d.sellAmountMinor) }
    if (d.netCostMinor !== null) { b.netCostIdr = Number(d.netCostMinor) }
  }
  if (d.reference) {
    if (d.type === 'flight') { b.pnr = d.reference } else if (d.type === 'hotel') { b.confirmationNumber = d.reference }
  }
  // Lists every page reads without a guard.
  if (d.type === 'mice') {
    for (const k of ['sessions', 'participantCategories', 'boqItems', 'staffAssignments', 'checklist', 'deliverables']) { b[k] ??= [] }
    b.clientApprovalStatus ??= 'draft'
  } else {
    b.options ??= []
    b.travelerIds ??= []
    if (d.type === 'flight') { b.segments ??= [] }
    if (d.type === 'transport') { b.legs ??= [] }
  }
  return b
}

export function bookingToServer (type: UiBookingType | ApiBookingType, b: Record<string, unknown>): BookingPatchInput {
  const api = toApiBookingType(type)
  const details = Object.fromEntries(Object.entries(b).filter(([k, v]) => !CORE_KEYS.includes(k) && v !== undefined))
  const out: BookingPatchInput = { details }
  // Only flight (PNR) and hotel (confirmation number) carry a reference; the others never send one.
  if (api === 'flight' || api === 'hotel') {
    const reference = (api === 'flight' ? b.pnr : b.confirmationNumber) as string | undefined
    out.reference = reference?.trim() || null
  }
  if (api !== 'mice') {
    out.sellAmountMinor = minor(b.sellPriceIdr)
    out.netCostMinor = minor(b.netCostIdr)
  }
  return out
}

/** Replaces the fields of the local object in place (pages keep their references), or appends it. */
function upsertInto<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) {
    list.push(value)
    return list[list.length - 1]!
  }
  for (const k of Object.keys(local)) {
    if (!(k in value)) { delete (local as Record<string, unknown>)[k] }
  }
  Object.assign(local, value)
  return local
}

export const upsertServerService = (d: ProjectServiceDto) => upsertInto(PROJECT_SERVICES, serviceFromServer(d))
/** Payment gate (computed from Finance), attempt log and duplicate flag of a booking (S4b); local `dependsOn` stays. */
export function upsertOrchestration (d: BookingDto): void {
  if (!d.paymentGate) { return }
  const record = BOOKING_ORCHESTRATION_RECORDS.find(r => r.bookingType === d.type && r.bookingId === d.id)
  const values = {
    paymentGateStatus: d.paymentGate.status,
    attemptLog: d.attempts.map(a => ({ id: a.id, at: a.at, outcome: a.outcome, ...(a.note ? { note: a.note } : {}) })),
    flaggedDuplicate: d.flaggedDuplicate
  }
  if (record) {
    Object.assign(record, values)
    return
  }
  BOOKING_ORCHESTRATION_RECORDS.push({ id: `BKO-${d.id}`, bookingType: d.type, bookingId: d.id, projectId: d.projectId, ...values })
}

export function upsertServerBooking (d: BookingDto) {
  upsertOrchestration(d)
  return upsertInto(ARRAYS[d.type], bookingFromServer(d))
}

export function mergeServerServicesAndBookings (data: { services: ProjectServiceDto[]; bookings: BookingDto[] }): void {
  const keepServices = new Set(data.services.map(s => s.id))
  for (let i = PROJECT_SERVICES.length - 1; i >= 0; i--) {
    if (!keepServices.has(PROJECT_SERVICES[i]!.id)) { PROJECT_SERVICES.splice(i, 1) }
  }
  for (const s of data.services) { upsertServerService(s) }
  for (const [type, list] of Object.entries(ARRAYS) as [ApiBookingType, AnyBooking[]][]) {
    const keep = new Set(data.bookings.filter(b => b.type === type).map(b => b.id))
    for (let i = list.length - 1; i >= 0; i--) {
      if (!keep.has(list[i]!.id)) { list.splice(i, 1) }
    }
  }
  for (const b of data.bookings) { upsertServerBooking(b) }
}

/** Every service and booking; the local arrays change only after both arrived. */
export async function loadServerServicesAndBookings (api: CoreApi): Promise<void> {
  const [services, bookings] = await Promise.all([api.core.listProjectServices(), api.core.listBookings()])
  mergeServerServicesAndBookings({ services: services.data, bookings: bookings.data })
}

/** A booking write can move its service (status, reference): refresh the project's services. */
async function reloadProjectServices (api: CoreApi, projectId: string): Promise<void> {
  const services = await api.core.listProjectServices({ projectId })
  for (const s of services.data) { upsertServerService(s) }
}

export async function createServiceOnServer (api: CoreApi, projectId: string, input: ServiceCreateInput, key: string = newIdempotencyKey()): Promise<ProjectService> {
  return upsertServerService((await api.core.createProjectService(projectId, input, key)).data)
}

export async function patchServiceOnServer (api: CoreApi, id: string, input: ServicePatchInput): Promise<ProjectService> {
  return upsertServerService((await api.core.updateProjectService(id, input)).data)
}

/** Creates the booking; the server picks or makes its service. */
export async function createBookingOnServer (api: CoreApi, type: UiBookingType, input: BookingCreateInput, key: string = newIdempotencyKey()): Promise<AnyBooking> {
  const res = await api.core.createBooking(toApiBookingType(type), input, key)
  await reloadProjectServices(api, input.projectId)
  return upsertServerBooking(res.data)
}

const LABEL_PREFIX: Record<UiBookingType, string> = { flight: 'Flight', hotel: 'Hotel', transportation: 'Transport', mice: 'MICE' }

/**
 * Same input as the former local `create*Booking` / `createMiceEvent`; the service label keeps their rule
 * ("Flight <destination>"). Everything except project and service travels as `details`.
 */
export async function createBookingFromInput (api: CoreApi, type: UiBookingType, input: { projectId: string; serviceId?: string } & Record<string, unknown>, key: string = newIdempotencyKey()): Promise<AnyBooking> {
  const { projectId, serviceId, ...rest } = input
  const destination = PROJECTS.find(p => p.id === projectId)?.destination ?? ''
  const details = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
  return await createBookingOnServer(api, type, { projectId, ...(serviceId ? { serviceId } : {}), label: `${LABEL_PREFIX[type]} ${destination}`.trim(), details }, key)
}

/** Saves the whole local booking object (details + prices + reference) after a local edit. */
export async function saveBookingOnServer (api: CoreApi, type: UiBookingType, booking: Record<string, unknown> & { id: string; projectId: string }): Promise<AnyBooking> {
  const res = await api.core.updateBooking(toApiBookingType(type), booking.id, bookingToServer(type, booking))
  await reloadProjectServices(api, booking.projectId)
  return upsertServerBooking(res.data)
}

/**
 * Local edit (the existing mutator, with its guards), then save to the server. A refused save puts the
 * booking and its project's services back as they were. Returns false when the local mutator refused.
 */
export async function persistBookingEdit (api: CoreApi, type: UiBookingType, booking: AnyBooking & { projectId: string }, mutate: () => unknown): Promise<boolean> {
  const snapshot = JSON.parse(JSON.stringify(booking)) as AnyBooking
  if (mutate() === undefined) { return false }
  try {
    await saveBookingOnServer(api, type, booking)
    return true
  } catch (error) {
    for (const k of Object.keys(booking)) {
      if (!(k in snapshot)) { delete booking[k] }
    }
    Object.assign(booking, snapshot)
    await reloadProjectServices(api, booking.projectId).catch(() => undefined)
    throw error
  }
}

/** The project's services and bookings as the server has them now (e.g. after Finance cancelled one). */
export async function reloadProjectBookings (api: CoreApi, projectId: string): Promise<void> {
  const [services, bookings] = await Promise.all([api.core.listProjectServices({ projectId }), api.core.listBookings({ projectId })])
  for (const s of services.data) { upsertServerService(s) }
  for (const b of bookings.data) { upsertServerBooking(b) }
}

export async function changeBookingStatusOnServer (api: CoreApi, type: UiBookingType, id: string, to: string, reason?: string): Promise<BookingDto> {
  return (await api.core.changeBookingStatus(toApiBookingType(type), id, { to, ...(reason?.trim() ? { reason: reason.trim() } : {}) })).data
}

/** Server status change, then the local mutator for its side effects, then the server's version wins. */
export async function runBookingStatusChange (api: CoreApi, type: UiBookingType, booking: { id: string; projectId: string }, to: string, reason: string | undefined, localSideEffects: () => unknown): Promise<void> {
  const dto = await changeBookingStatusOnServer(api, type, booking.id, to, reason)
  localSideEffects()
  upsertServerBooking(dto)
  await reloadProjectServices(api, booking.projectId)
}

export interface BookingsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads services and bookings once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useBookingsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<BookingsSyncState>('manova-bookings-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerServicesAndBookings(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Layanan & booking belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}

/** Service write: the server decides; local follow-ups (service order, supplier invoice, alerts) run only after it agreed. */
export async function runServiceWrite<T> (serverCall: () => Promise<T>, localSideEffects?: () => unknown): Promise<T> {
  const result = await serverCall()
  localSideEffects?.()
  return result
}

const serviceHasBooking = (serviceId: string) => Object.values(ARRAYS).some(list => list.some(b => b.serviceId === serviceId))

/**
 * Vendor choice (quick assignment or accepted quotation): the server sets the vendor (and `confirmed` for a
 * service without booking — one with a booking follows its booking), local follow-ups run (quotations,
 * service order, supplier invoice), then the server's version of the service wins.
 */
export async function assignServiceVendorOnServer (api: CoreApi, serviceId: string, vendorId: string | undefined, localSideEffects: () => unknown, opts: { confirm?: boolean } = {}): Promise<ProjectService> {
  const input: ServicePatchInput = { vendorId: vendorId ?? null }
  if (opts.confirm && !serviceHasBooking(serviceId)) { input.status = 'confirmed' }
  const dto = (await api.core.updateProjectService(serviceId, input)).data
  localSideEffects()
  return upsertServerService(dto)
}

/**
 * Budget per service type (new project form): the project's existing service of that type gets the budget,
 * otherwise a service is created with it — the rule of the former local `ensureProjectServiceForBudget`.
 */
export async function allocateServiceBudgetOnServer (api: CoreApi, projectId: string, type: ProjectService['type'], label: string, amountIdr: number, key: string = newIdempotencyKey()): Promise<ProjectService> {
  const budgetMinor = String(Math.round(amountIdr))
  const existing = PROJECT_SERVICES.find(s => s.projectId === projectId && s.type === type)
  if (existing) { return await patchServiceOnServer(api, existing.id, { budgetMinor }) }
  return await createServiceOnServer(api, projectId, { type, label, budgetMinor }, key)
}
