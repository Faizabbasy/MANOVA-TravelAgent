/**
 * Business dates for the finance screens. The server works in Asia/Jakarta calendar dates (`YYYY-MM-DD`);
 * the browser may be in any timezone, so "today" is always computed in Asia/Jakarta and dates are shifted
 * as calendar dates (UTC arithmetic), never through local-time Date objects.
 */

const BUSINESS_TIMEZONE = 'Asia/Jakarta'

export function todayJakarta (now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function shiftDate (iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function startOfMonth (iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween (from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** "2026-09-29" → "29 Sep 2026"; `short` drops the year when it is the current one. */
export function formatBusinessDate (iso: string | null | undefined, options: { short?: boolean; today?: string } = {}): string {
  if (!iso) { return '—' }
  const [y, m, d] = iso.split('-')
  const sameYear = options.short && (options.today ?? todayJakarta()).slice(0, 4) === y
  return `${Number(d)} ${MONTHS[Number(m) - 1]}${sameYear ? '' : ` ${y}`}`
}

export function formatBusinessDateLong (iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_LONG[Number(m) - 1]} ${y}`
}

/** "12:40" style time of an instant, in Jakarta time. */
export function formatInstant (iso: string): string {
  const date = new Date(iso)
  const day = todayJakarta(date)
  const time = new Intl.DateTimeFormat('id-ID', { timeZone: BUSINESS_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(date)
  return `${formatBusinessDate(day)}, ${time.replace('.', ':')}`
}

export interface DueInfo { label: string; tone: 'destructive' | 'warning' | 'muted' }

/** Plain-language due line: "Terlambat 4 hari", "Jatuh tempo hari ini", "3 hari lagi", "29 Okt". */
export function dueInfo (dueDate: string | null, today: string, settled = false): DueInfo {
  if (!dueDate) { return { label: 'Tanpa jatuh tempo', tone: 'muted' } }
  if (settled) { return { label: formatBusinessDate(dueDate, { short: true, today }), tone: 'muted' } }
  const diff = daysBetween(today, dueDate)
  if (diff < 0) { return { label: `Terlambat ${-diff} hari`, tone: 'destructive' } }
  if (diff === 0) { return { label: 'Jatuh tempo hari ini', tone: 'warning' } }
  if (diff <= 7) { return { label: `${diff} hari lagi`, tone: 'warning' } }
  return { label: formatBusinessDate(dueDate, { short: true, today }), tone: 'muted' }
}
