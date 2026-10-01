import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

/** Formatter terpusat (Prompt 5-J / D-037) — jangan format manual berbeda-beda di setiap halaman. */

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
})

const numberFormatter = new Intl.NumberFormat('id-ID')

export function formatCurrencyIdr (value: number): string {
  return idrFormatter.format(value)
}

/**
 * Notasi ringkas ("Rp 1,25 M" / "Rp 950 Jt") untuk StatsCard bernilai besar — full precision-nya
 * cuma numerik biasa (di bawah 1 juta) tetap dipakai supaya tidak over-abbreviate angka kecil.
 * Dipakai berbarengan dengan `formatCurrencyIdr` (versi lengkap) sebagai tooltip/`fullValue`
 * di kartu, jadi presisi aslinya tetap kebaca tanpa bikin card yang sempit meluber.
 */
export function formatCurrencyIdrCompact (value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const trimmed = (n: number) => n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
  if (abs >= 1_000_000_000) { return `${sign}Rp ${trimmed(abs / 1_000_000_000)} M` }
  if (abs >= 1_000_000) { return `${sign}Rp ${trimmed(abs / 1_000_000)} Jt` }
  return formatCurrencyIdr(value)
}

export function formatNumber (value: number): string {
  return numberFormatter.format(value)
}

export function formatPercentage (value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`
}

export function formatDate (isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy', { locale: localeId })
}

/** Nama bulan penuh (mis. "31 Oktober 2026") — dipakai badge tanggal yang butuh tampilan lebih formal/lega, mis. kartu highlight milestone aktif. */
export function formatDateLong (isoDate: string): string {
  return format(parseISO(isoDate), 'd MMMM yyyy', { locale: localeId })
}

export function formatDateTime (isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy, HH:mm', { locale: localeId })
}

/** Header hari untuk daily itinerary (Section 12) — mis. "Kamis, 20 Agu 2026". */
export function formatDayLabel (isoDate: string): string {
  return format(parseISO(isoDate), 'EEEE, d MMM yyyy', { locale: localeId })
}

/** Badge tanggal compact (dipakai Daily Itinerary, detail Project) — tanggal+bulan singkat sebagai dua baris terpisah, bukan string tunggal, supaya bisa ditumpuk vertikal di kotak kecil. */
export function formatDayBadge (isoDate: string): { day: string, month: string } {
  const date = parseISO(isoDate)
  return { day: format(date, 'd'), month: format(date, 'MMM', { locale: localeId }) }
}

export function formatDateRange (startIso: string, endIso: string): string {
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = format(start, sameMonth ? 'd' : 'd MMM yyyy', { locale: localeId })
  const endLabel = format(end, 'd MMM yyyy', { locale: localeId })
  return `${startLabel} – ${endLabel}`
}

export function formatTravelerCount (count: number): string {
  return `${formatNumber(count)} traveler`
}

export function daysUntil (isoDate: string, referenceIso: string): number {
  return differenceInCalendarDays(parseISO(isoDate), parseISO(referenceIso))
}

/** "Sensitive values masked sesuai role" (Section 11) — menyisakan 4 karakter terakhir, sisanya diganti `•`. */
export function maskDocumentNumber (value?: string): string {
  if (!value) { return '—' }
  const trimmed = value.trim()
  if (trimmed.length <= 4) { return '•'.repeat(trimmed.length) }
  return `${'•'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`
}
