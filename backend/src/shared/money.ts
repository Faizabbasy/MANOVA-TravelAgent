import { errors } from '../http/errors'

/**
 * Money rules (docs/manova-finance-implementation/03 "Uang, waktu, dan mata uang"):
 *  - amounts are integers in minor units (IDR has none, so 1 = Rp1) held as bigint, never float
 *  - on the wire they are decimal strings ("30000000") so JavaScript clients cannot lose precision
 *  - percentages are basis points (1% = 100 bp) and rounding is explicit half-up
 */

export const PG_BIGINT_MAX = 9_223_372_036_854_775_807n
const MINOR_PATTERN = /^(0|[1-9][0-9]{0,18})$/

export function parseAmountMinor(value: unknown, field = 'amountMinor', options: { allowZero?: boolean } = {}): bigint {
  if (typeof value !== 'string' || !MINOR_PATTERN.test(value)) {
    throw errors.validation({ [field]: ['Nominal harus berupa angka bulat tanpa titik/koma, dikirim sebagai teks (contoh "30000000").'] })
  }
  const amount = BigInt(value)
  if (amount > PG_BIGINT_MAX) throw errors.validation({ [field]: ['Nominal terlalu besar.'] })
  if (amount === 0n && !options.allowZero) throw errors.validation({ [field]: ['Nominal harus lebih dari 0.'] })
  return amount
}

export function toAmountMinor(amount: bigint): string {
  if (amount < 0n) throw new RangeError('Money amounts are non-negative; use direction to express outflow')
  return amount.toString()
}

/** `amount × bp / 10 000`, rounded half-up to a whole minor unit. */
export function percentOfHalfUp(amount: bigint, basisPoints: bigint): bigint {
  if (amount < 0n || basisPoints < 0n) throw new RangeError('amount and basisPoints must be non-negative')
  return (amount * basisPoints + 5_000n) / 10_000n
}
