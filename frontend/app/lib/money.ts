import type { MoneyMinor } from '~/types/api'

/**
 * Display helpers for API money (`MoneyMinor`, integer minor units as a string). Formatting only —
 * balances, outstanding and projections are computed by the server and never re-derived in Vue.
 * BigInt keeps amounts beyond Number.MAX_SAFE_INTEGER exact.
 */

const MINOR_UNITS: Record<string, number> = { IDR: 0, USD: 2, SGD: 2, EUR: 2, JPY: 0, SAR: 2, AED: 2, MYR: 2 }
const MINOR_PATTERN = /^-?(0|[1-9]\d*)$/

export function minorUnitsOf (currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2
}

export function isMoneyMinor (value: unknown): value is MoneyMinor {
  return typeof value === 'string' && MINOR_PATTERN.test(value)
}

/** "30000000" → 30000000n; throws on anything that is not an integer string. */
export function toBigIntMinor (value: MoneyMinor): bigint {
  if (!isMoneyMinor(value)) { throw new TypeError(`Not a minor-unit amount: ${String(value)}`) }
  return BigInt(value)
}

/** Decimal string in major units without float math: ("123456", 2) → "1234.56". */
function toMajorDecimal (minor: bigint, units: number): string {
  if (units === 0) { return minor.toString() }
  const negative = minor < 0n
  const digits = (negative ? -minor : minor).toString().padStart(units + 1, '0')
  return `${negative ? '-' : ''}${digits.slice(0, -units)}.${digits.slice(-units)}`
}

export interface FormatMoneyOptions {
  /** Prefix a + for positive amounts (e.g. "+Rp 1.000" for money in). */
  signed?: boolean
  /** Drop the currency symbol. */
  plain?: boolean
}

/** Formats with Indonesian grouping: formatMoneyMinor("30000000") → "Rp 30.000.000". */
export function formatMoneyMinor (value: MoneyMinor, currency = 'IDR', options: FormatMoneyOptions = {}): string {
  const minor = toBigIntMinor(value)
  const units = minorUnitsOf(currency)
  const formatter = new Intl.NumberFormat('id-ID', {
    ...(options.plain ? {} : { style: 'currency', currency, currencyDisplay: 'symbol' }),
    minimumFractionDigits: units,
    maximumFractionDigits: units,
    ...(options.signed ? { signDisplay: 'exceptZero' as const } : {})
  })
  // Intl accepts exact decimal strings (ES2023); the cast keeps older lib typings happy.
  return formatter.format(toMajorDecimal(minor, units) as unknown as number).replace(/\u00A0/g, ' ')
}
