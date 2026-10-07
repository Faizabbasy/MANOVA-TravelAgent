import type { FieldErrors } from '../../http/errors'
import type { BookingType } from './repository'

/**
 * Booking rules shared by the API and the demo extract (S4a): status maps (same as the frontend
 * `*_TRANSITIONS`), booking → service status, `details` checks, and the derived departure date / MICE totals.
 */

export const SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional'] as const
export type ServiceType = typeof SERVICE_TYPES[number]
export const SERVICE_STATUSES = ['not-started', 'sourcing', 'quoted', 'pending-confirmation', 'confirmed', 'changed', 'completed', 'cancelled'] as const
export type ServiceStatus = typeof SERVICE_STATUSES[number]

export const BOOKING_TRANSITIONS: Record<BookingType, Record<string, readonly string[]>> = {
  flight: { requested: ['hold', 'confirmed', 'cancelled'], hold: ['confirmed', 'cancelled'], confirmed: ['issued', 'cancelled'], issued: ['reissued', 'cancelled'], reissued: ['cancelled'], cancelled: ['refunded'], refunded: [] },
  hotel: { requested: ['quoted', 'cancelled'], quoted: ['confirmed', 'cancelled'], confirmed: ['amended', 'completed', 'cancelled', 'no-show'], amended: ['completed', 'cancelled', 'no-show'], completed: [], cancelled: [], 'no-show': [] },
  transport: { requested: ['quoted', 'cancelled'], quoted: ['assigned', 'cancelled'], assigned: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled', 'no-show'], completed: [], cancelled: [], 'no-show': [] },
  mice: { planning: ['confirmed', 'cancelled'], confirmed: ['in-progress', 'cancelled'], 'in-progress': ['completed', 'cancelled'], completed: [], cancelled: [] }
}
export const BOOKING_STATUSES = Object.fromEntries(
  Object.entries(BOOKING_TRANSITIONS).map(([type, map]) => [type, Object.keys(map)])
) as unknown as Record<BookingType, readonly string[]>
export const BOOKING_INITIAL_STATUS: Record<BookingType, string> = { flight: 'requested', hotel: 'requested', transport: 'requested', mice: 'planning' }
/** Same guards as the frontend `update*` mutators. */
export const BOOKING_LOCKED_FOR_EDIT: Record<BookingType, readonly string[]> = {
  flight: ['refunded'], hotel: ['completed', 'cancelled', 'no-show'], transport: ['completed', 'cancelled', 'no-show'], mice: ['completed', 'cancelled']
}

export const serviceTypeOf = (type: BookingType): ServiceType => (type === 'transport' ? 'transportation' : type)
const LABELS: Record<ServiceType, string> = { flight: 'Flight', hotel: 'Hotel', transportation: 'Transportation', mice: 'MICE', additional: 'Additional' }
export const defaultServiceLabel = (t: ServiceType) => LABELS[t]

export function serviceStatusFor(type: BookingType, status: string): ServiceStatus {
  if (status === 'cancelled' || status === 'refunded' || status === 'no-show') return 'cancelled'
  if (status === 'completed') return 'completed'
  if (status === 'quoted' && (type === 'hotel' || type === 'transport')) return 'quoted'
  if (status === 'reissued' || (type === 'hotel' && status === 'amended')) return 'changed'
  if (status === 'confirmed' || (type === 'flight' && status === 'issued') || (type === 'mice' && status === 'in-progress')) return 'confirmed'
  return 'pending-confirmation'
}

/** Columns of the booking itself — never stored inside `details`. */
export const CORE_BOOKING_KEYS = ['id', 'projectId', 'serviceId', 'status', 'statusReason', 'netCostIdr', 'sellPriceIdr', 'pnr', 'confirmationNumber', 'createdAt', 'updatedAt'] as const
const MAX_DETAILS_BYTES = 64 * 1024
const MAX_PRICE = 1_000_000_000_000_000
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/
/** Arrays the server reads, and the date field inside each item. */
const ARRAYS: Record<BookingType, Record<string, string | null>> = {
  flight: { options: null, segments: 'departureAt', travelerIds: null },
  hotel: { options: null, travelerIds: null },
  transport: { options: null, legs: 'scheduledAt', travelerIds: null },
  mice: { sessions: 'startAt', participantCategories: null, boqItems: null, staffAssignments: null, checklist: null, deliverables: null }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
// undefined or null = an unpriced line (a cleared price field in the BOQ form sends null).
const isPrice = (v: unknown) => v === undefined || v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_PRICE)
const isDate = (v: unknown) => typeof v === 'string' && DATE_PREFIX.test(v)

export function cleanDetails(type: BookingType, raw: unknown, problems: FieldErrors): Record<string, unknown> | undefined {
  const fail = (message: string) => { problems.details = [message]; return undefined }
  if (!isObject(raw)) return fail('Detail booking harus berupa objek.')
  const details: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (!(CORE_BOOKING_KEYS as readonly string[]).includes(k)) details[k] = v
  if (new TextEncoder().encode(JSON.stringify(details)).length > MAX_DETAILS_BYTES) return fail('Detail booking terlalu besar (maks 64 KB).')
  for (const [key, dateField] of Object.entries(ARRAYS[type])) {
    const list = details[key]
    if (list === undefined) continue
    if (!Array.isArray(list)) return fail(`${key} harus berupa daftar.`)
    for (const item of list) {
      if (key === 'travelerIds' ? typeof item !== 'string' : !isObject(item)) return fail(`Isi ${key} tidak valid.`)
      if (dateField && isObject(item) && item[dateField] !== undefined && !isDate(item[dateField])) return fail(`${key}.${dateField} harus tanggal (YYYY-MM-DD…).`)
      if (key === 'boqItems' && isObject(item) && !(isPrice(item.sellPriceIdr) && isPrice(item.netCostIdr))) return fail('Harga BOQ harus bilangan bulat ≥ 0.')
    }
  }
  if (type === 'hotel' && details.checkInDate !== undefined && !isDate(details.checkInDate)) return fail('checkInDate harus tanggal (YYYY-MM-DD).')
  return details
}

const earliest = (values: unknown[]): string | null =>
  values.filter((v): v is string => isDate(v)).map(v => v.slice(0, 10)).sort()[0] ?? null
const field = (list: unknown, name: string) => (Array.isArray(list) ? list.map(i => (isObject(i) ? i[name] : undefined)) : [])

export function departureDateOf(type: BookingType, details: Record<string, unknown>): string | null {
  if (type === 'flight') return earliest(field(details.segments, 'departureAt'))
  if (type === 'hotel') return earliest([details.checkInDate])
  if (type === 'transport') return earliest(field(details.legs, 'scheduledAt'))
  return earliest(field(details.sessions, 'startAt'))
}

/** MICE price lives on BOQ lines (same rule as the frontend `getMiceBoqTotals`). */
export function miceTotals(details: Record<string, unknown>): { sellMinor: string | null; netMinor: string | null } {
  const sum = (name: string) => {
    const priced = field(details.boqItems, name).filter((v): v is number => typeof v === 'number')
    return priced.length ? String(priced.reduce((s, v) => s + Math.round(v), 0)) : null
  }
  return { sellMinor: sum('sellPriceIdr'), netMinor: sum('netCostIdr') }
}
