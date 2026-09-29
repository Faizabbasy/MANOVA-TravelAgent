import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { parseAmountMinor } from '../../shared/money'
import { ACCOUNT_COLUMNS, currentBalance, isUniqueViolation, maskAccountNumber, netMovements, rule, todayBusinessDate, type AccountRow } from './common'

/**
 * Bank accounts and their opening balance (maker/checker).
 * Opening balance = verified cash on the cutover date; transactions before it are history, not re-added.
 */

export interface AccountDto {
  id: string
  code: string
  bankName: string
  holderName: string
  /** Full number only for finance.manage-bank-accounts holders. */
  accountNumber: string
  currency: string
  isActive: boolean
  opening: {
    status: 'unset' | 'pending' | 'verified'
    balanceMinor: string | null
    date: string | null
    note: string | null
    submittedBy: string | null
    submittedAt: string | null
    verifiedBy: string | null
    verifiedAt: string | null
  }
  balance: {
    /** False until the opening balance is verified — the UI shows "Belum tersedia", not Rp0. */
    available: boolean
    currentMinor: string | null
    asOf: string
  }
  provenance: string
}

export function accountDto(row: AccountRow, net: bigint | undefined, showFullNumber: boolean): AccountDto {
  const balance = currentBalance(row, net)
  return {
    id: row.id,
    code: row.code,
    bankName: row.bank_name,
    holderName: row.holder_name,
    accountNumber: showFullNumber ? row.account_number : maskAccountNumber(row.account_number),
    currency: row.currency,
    isActive: row.is_active,
    opening: {
      status: row.opening_status,
      balanceMinor: row.opening_balance_minor,
      date: row.opening_date,
      note: row.opening_note,
      submittedBy: row.opening_submitted_by,
      submittedAt: row.opening_submitted_at?.toISOString() ?? null,
      verifiedBy: row.opening_verified_by,
      verifiedAt: row.opening_verified_at?.toISOString() ?? null
    },
    balance: { available: balance !== null, currentMinor: balance?.toString() ?? null, asOf: todayBusinessDate() },
    provenance: row.provenance
  }
}

export async function listAccounts(db: Db, showFullNumber: boolean): Promise<AccountDto[]> {
  const rows = await db.query<AccountRow>(`select ${ACCOUNT_COLUMNS} from bank_accounts order by is_active desc, code`)
  const net = await netMovements(db)
  return rows.map(r => accountDto(r, net.get(r.id), showFullNumber))
}

export async function findAccount(q: Queryable, id: string, lock = false): Promise<AccountRow | null> {
  const [row] = await q.query<AccountRow>(`select ${ACCOUNT_COLUMNS} from bank_accounts where id = $1${lock ? ' for update' : ''}`, [id])
  return row ?? null
}

export async function getAccount(db: Db, id: string, showFullNumber: boolean): Promise<AccountDto> {
  const row = await findAccount(db, id)
  if (!row) throw errors.notFound('Rekening')
  const net = await netMovements(db, [id])
  return accountDto(row, net.get(id), showFullNumber)
}

const CODE = /^[A-Z0-9][A-Z0-9-]{1,19}$/
const NUMBER = /^[0-9][0-9 -]{3,40}[0-9]$/

function validateAccountFields(input: { code?: string; bankName?: string; holderName?: string; accountNumber?: string }, partial: boolean) {
  const fieldErrors: Record<string, string[]> = {}
  if (!partial || input.code !== undefined) {
    if (!input.code || !CODE.test(input.code)) fieldErrors.code = ['Kode 2–20 karakter: huruf besar, angka, atau "-" (contoh BCA-OPS).']
  }
  if (!partial || input.bankName !== undefined) {
    if (!input.bankName?.trim()) fieldErrors.bankName = ['Nama bank wajib diisi.']
  }
  if (!partial || input.holderName !== undefined) {
    if (!input.holderName?.trim()) fieldErrors.holderName = ['Nama pemilik rekening wajib diisi.']
  }
  if (!partial || input.accountNumber !== undefined) {
    if (!input.accountNumber || !NUMBER.test(input.accountNumber.trim())) fieldErrors.accountNumber = ['Nomor rekening hanya angka (boleh spasi atau "-"), 5–42 karakter.']
  }
  if (Object.keys(fieldErrors).length) throw errors.validation(fieldErrors)
}

export async function createAccount(
  db: Db,
  actor: Actor,
  input: { code: string; bankName: string; holderName: string; accountNumber: string },
  requestId: string
): Promise<AccountDto> {
  const clean = { ...input, code: input.code?.trim().toUpperCase() }
  validateAccountFields(clean, false)
  try {
    return await db.transaction(async tx => {
      const [row] = await tx.query<AccountRow>(
        `insert into bank_accounts (code, bank_name, holder_name, account_number, created_by)
         values ($1, $2, $3, $4, $5) returning ${ACCOUNT_COLUMNS}`,
        [clean.code, clean.bankName.trim(), clean.holderName.trim(), clean.accountNumber.trim(), actor.userId]
      )
      await recordAudit(tx, {
        action: 'finance.account_created', actorUserId: actor.userId, entityType: 'bank_account', entityId: row!.id, requestId,
        after: { code: row!.code, bankName: row!.bank_name, accountNumber: maskAccountNumber(row!.account_number) }
      })
      return accountDto(row!, 0n, true)
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'CONFLICT', `Kode rekening ${clean.code} sudah dipakai.`, { fieldErrors: { code: ['Kode sudah dipakai.'] } })
    throw err
  }
}

export async function updateAccount(
  db: Db,
  actor: Actor,
  id: string,
  input: { bankName?: string; holderName?: string; accountNumber?: string; isActive?: boolean },
  requestId: string
): Promise<AccountDto> {
  validateAccountFields(input, true)
  return db.transaction(async tx => {
    const before = await findAccount(tx, id, true)
    if (!before) throw errors.notFound('Rekening')
    const net = (await netMovements(tx, [id])).get(id)

    if (input.accountNumber !== undefined && input.accountNumber.trim() !== before.account_number && net !== undefined) {
      throw rule('Nomor rekening tidak bisa diubah setelah ada transaksi. Buat rekening baru bila nomornya berbeda.')
    }
    if (input.isActive === false && before.is_active) {
      const balance = currentBalance(before, net)
      if (balance !== null && balance !== 0n) {
        throw rule('Rekening dengan saldo belum nol tidak bisa dinonaktifkan. Pindahkan saldonya lebih dulu.', { balanceMinor: balance.toString() })
      }
    }

    const [row] = await tx.query<AccountRow>(
      `update bank_accounts set
         bank_name = coalesce($2, bank_name), holder_name = coalesce($3, holder_name),
         account_number = coalesce($4, account_number), is_active = coalesce($5, is_active), updated_at = now()
       where id = $1 returning ${ACCOUNT_COLUMNS}`,
      [id, input.bankName?.trim() ?? null, input.holderName?.trim() ?? null, input.accountNumber?.trim() ?? null, input.isActive ?? null]
    )
    await recordAudit(tx, {
      action: 'finance.account_updated', actorUserId: actor.userId, entityType: 'bank_account', entityId: id, requestId,
      before: { bankName: before.bank_name, holderName: before.holder_name, accountNumber: maskAccountNumber(before.account_number), isActive: before.is_active },
      after: { bankName: row!.bank_name, holderName: row!.holder_name, accountNumber: maskAccountNumber(row!.account_number), isActive: row!.is_active }
    })
    return accountDto(row!, net, true)
  })
}

/** Maker step. Re-submitting while still pending replaces the proposal; a verified opening is locked. */
export async function submitOpening(
  db: Db,
  actor: Actor,
  id: string,
  input: { amountMinor: string; openingDate: string; note?: string },
  requestId: string
): Promise<AccountDto> {
  const amount = parseAmountMinor(input.amountMinor, 'amountMinor', { allowZero: true })
  if (!isIsoDate(input.openingDate)) throw errors.validation({ openingDate: ['Tanggal harus berformat YYYY-MM-DD.'] })
  if (input.openingDate > todayBusinessDate()) throw errors.validation({ openingDate: ['Tanggal saldo pembuka tidak boleh di masa depan.'] })

  return db.transaction(async tx => {
    const before = await findAccount(tx, id, true)
    if (!before) throw errors.notFound('Rekening')
    if (before.opening_status === 'verified') {
      throw new AppError(409, 'CONFLICT', 'Saldo pembuka rekening ini sudah diverifikasi dan terkunci.')
    }
    const [row] = await tx.query<AccountRow>(
      `update bank_accounts set opening_status = 'pending', opening_balance_minor = $2, opening_date = $3, opening_note = $4,
         opening_submitted_by = $5, opening_submitted_at = now(), updated_at = now()
       where id = $1 returning ${ACCOUNT_COLUMNS}`,
      [id, amount.toString(), input.openingDate, input.note?.trim() || null, actor.userId]
    )
    await recordAudit(tx, {
      action: 'finance.opening_submitted', actorUserId: actor.userId, entityType: 'bank_account', entityId: id, requestId,
      before: { status: before.opening_status, balanceMinor: before.opening_balance_minor, date: before.opening_date },
      after: { status: 'pending', balanceMinor: amount.toString(), date: input.openingDate }, reason: input.note ?? null
    })
    return accountDto(row!, undefined, true)
  })
}

/** Checker step: a different person than the maker must verify (maker/checker). */
export async function verifyOpening(db: Db, actor: Actor, id: string, requestId: string, showFullNumber: boolean): Promise<AccountDto> {
  return db.transaction(async tx => {
    const before = await findAccount(tx, id, true)
    if (!before) throw errors.notFound('Rekening')
    if (before.opening_status !== 'pending') {
      throw rule(before.opening_status === 'verified' ? 'Saldo pembuka sudah diverifikasi.' : 'Belum ada saldo pembuka yang diajukan.')
    }
    if (before.opening_submitted_by === actor.userId) {
      throw new AppError(403, 'MAKER_CHECKER_VIOLATION', 'Saldo pembuka harus diverifikasi oleh orang lain, bukan yang mengajukannya.')
    }
    const [row] = await tx.query<AccountRow>(
      `update bank_accounts set opening_status = 'verified', opening_verified_by = $2, opening_verified_at = now(), updated_at = now()
       where id = $1 returning ${ACCOUNT_COLUMNS}`,
      [id, actor.userId]
    )
    await recordAudit(tx, {
      action: 'finance.opening_verified', actorUserId: actor.userId, entityType: 'bank_account', entityId: id, requestId,
      after: { balanceMinor: row!.opening_balance_minor, date: row!.opening_date, submittedBy: row!.opening_submitted_by }
    })
    const net = (await netMovements(tx, [id])).get(id)
    return accountDto(row!, net, showFullNumber)
  })
}
