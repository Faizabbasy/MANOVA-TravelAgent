import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

/** Formatter terpusat (Prompt 5-J / D-037) — jangan format manual berbeda-beda di setiap halaman. */

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('id-ID')

export function formatCurrencyIdr(value: number): string {
  return idrFormatter.format(value)
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatPercentage(value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`
}

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy', { locale: localeId })
}

export function formatDateTime(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy, HH:mm', { locale: localeId })
}

/** Header hari untuk daily itinerary (Section 12) — mis. "Kamis, 20 Agu 2026". */
export function formatDayLabel(isoDate: string): string {
  return format(parseISO(isoDate), 'EEEE, d MMM yyyy', { locale: localeId })
}

export function formatDateRange(startIso: string, endIso: string): string {
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = format(start, sameMonth ? 'd' : 'd MMM yyyy', { locale: localeId })
  const endLabel = format(end, 'd MMM yyyy', { locale: localeId })
  return `${startLabel} – ${endLabel}`
}

export function formatTravelerCount(count: number): string {
  return `${formatNumber(count)} traveler`
}

export function daysUntil(isoDate: string, referenceIso: string): number {
  return differenceInCalendarDays(parseISO(isoDate), parseISO(referenceIso))
}

/** "Sensitive values masked sesuai role" (Section 11) — menyisakan 4 karakter terakhir, sisanya diganti `•`. */
export function maskDocumentNumber(value?: string): string {
  if (!value) return '—'
  const trimmed = value.trim()
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length)
  return `${'•'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`
}
