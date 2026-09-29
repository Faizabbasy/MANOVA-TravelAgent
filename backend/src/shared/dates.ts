import { BUSINESS_TIMEZONE } from '../config/env'

/**
 * Calendar dates (due, expected, effective) are business dates in Asia/Jakarta, exchanged as
 * `YYYY-MM-DD`. Instants (postedAt, createdAt) are UTC ISO timestamps.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const [, y, mo, d] = m.map(Number) as [number, number, number, number]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** The business calendar date of an instant, e.g. 2026-09-30T17:30Z → "2026-10-01" in Jakarta. */
export function businessDateOf(instant: Date, timeZone: string = BUSINESS_TIMEZONE): string {
  let fmt = formatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    formatters.set(timeZone, fmt)
  }
  return fmt.format(instant)
}
