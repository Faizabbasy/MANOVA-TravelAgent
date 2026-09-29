import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { ID_PATTERN } from '../../http/envelope'
import { parseMovementAmount, rule } from './common'

/**
 * Directional transfer fee rules (spec 02: "Arah fee A→B dan B→A punya rule berbeda").
 * The server always picks the rule itself from direction + date; a client never chooses one.
 * A transfer stores a snapshot of the rule it used, so later edits never rewrite history.
 */

type FeeRuleRow = {
  id: string
  from_account_id: string
  to_account_id: string
  fee_type: 'fixed' | 'percent'
  fixed_minor: string | null
  percent_bp: number | null
  min_minor: string | null
  max_minor: string | null
  effective_from: string
  effective_to: string | null
  is_active: boolean
  note: string | null
  created_by: string
  created_at: Date
  updated_by: string | null
  updated_at: Date
}

export interface FeeRuleInput {
  fromAccountId?: string
  toAccountId?: string
  feeType?: string
  fixedMinor?: string | null
  percentBasisPoints?: number | null
  minMinor?: string | null
  maxMinor?: string | null
  effectiveFrom?: string
  effectiveTo?: string | null
  isActive?: boolean
  note?: string | null
}

export function feeRuleDto(r: FeeRuleRow) {
  return {
    id: r.id,
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id,
    feeType: r.fee_type,
    fixedMinor: r.fixed_minor,
    percentBasisPoints: r.percent_bp,
    minMinor: r.min_minor,
    maxMinor: r.max_minor,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    isActive: r.is_active,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString()
  }
}

/** What a transfer stores: enough to explain the fee without the rule row. */
export function feeSnapshot(r: FeeRuleRow) {
  return {
    ruleId: r.id,
    feeType: r.fee_type,
    fixedMinor: r.fixed_minor,
    percentBasisPoints: r.percent_bp,
    minMinor: r.min_minor,
    maxMinor: r.max_minor,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to
  }
}

/** Fee for an amount under a rule. Percent rounds half up to whole minor units, then applies min/max. */
export function computeFee(r: Pick<FeeRuleRow, 'fee_type' | 'fixed_minor' | 'percent_bp' | 'min_minor' | 'max_minor'>, amount: bigint): bigint {
  if (r.fee_type === 'fixed') return BigInt(r.fixed_minor!)
  let fee = (amount * BigInt(r.percent_bp!) + 5_000n) / 10_000n
  if (r.min_minor !== null && fee < BigInt(r.min_minor)) fee = BigInt(r.min_minor)
  if (r.max_minor !== null && fee > BigInt(r.max_minor)) fee = BigInt(r.max_minor)
  return fee
}

/** The one active rule for this direction on this date, or null. */
export async function findFeeRule(db: Queryable, fromAccountId: string, toAccountId: string, date: string): Promise<FeeRuleRow | null> {
  const [row] = await db.query<FeeRuleRow>(
    `select * from transfer_fee_rules
      where from_account_id = $1 and to_account_id = $2 and is_active
        and effective_from <= $3::date and (effective_to is null or effective_to >= $3::date)`,
    [fromAccountId, toAccountId, date]
  )
  return row ?? null
}

export async function quoteTransferFee(db: Queryable, input: { fromAccountId?: string; toAccountId?: string; amountMinor?: string; effectiveDate?: string }) {
  const from = input.fromAccountId ?? ''
  const to = input.toAccountId ?? ''
  if (!ID_PATTERN.test(from)) throw errors.validation({ fromAccountId: ['Pilih rekening asal.'] })
  if (!ID_PATTERN.test(to)) throw errors.validation({ toAccountId: ['Pilih rekening tujuan.'] })
  if (!input.effectiveDate || !isIsoDate(input.effectiveDate)) throw errors.validation({ effectiveDate: ['Tanggal harus berformat YYYY-MM-DD.'] })
  const amount = parseMovementAmount(input.amountMinor)
  const r = await findFeeRule(db, from, to, input.effectiveDate)
  return { feeMinor: r ? computeFee(r, amount).toString() : '0', rule: r ? feeRuleDto(r) : null }
}

export async function listFeeRules(db: Db, query: { accountId?: string }) {
  const rows = query.accountId
    ? await db.query<FeeRuleRow>('select * from transfer_fee_rules where from_account_id = $1 or to_account_id = $1 order by from_account_id, to_account_id, effective_from desc', [query.accountId])
    : await db.query<FeeRuleRow>('select * from transfer_fee_rules order by from_account_id, to_account_id, effective_from desc')
  return rows.map(feeRuleDto)
}

function optionalMinor(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return parseMovementAmount(value, field, { allowZero: true }).toString()
}

/** Validates a complete rule (after merging an update onto the stored row). */
function normalise(input: Required<Pick<FeeRuleInput, 'feeType'>> & FeeRuleInput) {
  const fields: Record<string, string[]> = {}
  if (input.feeType !== 'fixed' && input.feeType !== 'percent') fields.feeType = ['Pilih biaya tetap atau persen.']
  if (!input.effectiveFrom || !isIsoDate(input.effectiveFrom)) fields.effectiveFrom = ['Tanggal mulai harus berformat YYYY-MM-DD.']
  if (input.effectiveTo && !isIsoDate(input.effectiveTo)) fields.effectiveTo = ['Tanggal akhir harus berformat YYYY-MM-DD.']
  if (input.effectiveTo && input.effectiveFrom && isIsoDate(input.effectiveTo) && input.effectiveTo < input.effectiveFrom) fields.effectiveTo = ['Tanggal akhir tidak boleh sebelum tanggal mulai.']
  if (Object.keys(fields).length) throw errors.validation(fields)

  if (input.feeType === 'fixed') {
    const fixed = optionalMinor(input.fixedMinor, 'fixedMinor')
    if (fixed === null) throw errors.validation({ fixedMinor: ['Isi nominal biaya.'] })
    return { fee_type: 'fixed' as const, fixed_minor: fixed, percent_bp: null, min_minor: null, max_minor: null }
  }
  const bp = input.percentBasisPoints
  if (typeof bp !== 'number' || !Number.isInteger(bp) || bp < 1 || bp > 10_000) {
    throw errors.validation({ percentBasisPoints: ['Persen harus antara 0,01% dan 100% (1–10.000 basis poin).'] })
  }
  const min = optionalMinor(input.minMinor, 'minMinor')
  const max = optionalMinor(input.maxMinor, 'maxMinor')
  if (min !== null && max !== null && BigInt(max) < BigInt(min)) throw errors.validation({ maxMinor: ['Biaya maksimum tidak boleh di bawah minimum.'] })
  return { fee_type: 'percent' as const, fixed_minor: null, percent_bp: bp, min_minor: min, max_minor: max }
}

const OVERLAP = 'Periode ini bertabrakan dengan aturan aktif lain untuk arah yang sama. Akhiri aturan lama lebih dulu.'

function isOverlap(error: unknown) {
  return (error as { code?: string })?.code === '23P01'
}

export async function createFeeRule(db: Db, actor: Actor, input: FeeRuleInput, requestId: string) {
  const from = input.fromAccountId ?? ''
  const to = input.toAccountId ?? ''
  if (!ID_PATTERN.test(from)) throw errors.validation({ fromAccountId: ['Pilih rekening asal.'] })
  if (!ID_PATTERN.test(to)) throw errors.validation({ toAccountId: ['Pilih rekening tujuan.'] })
  if (from === to) throw errors.validation({ toAccountId: ['Rekening tujuan harus berbeda dari rekening asal.'] })
  const shape = normalise({ ...input, feeType: input.feeType ?? '' })
  return db.transaction(async tx => {
    const accounts = await tx.query<{ id: string; currency: string }>('select id, currency from bank_accounts where id in ($1, $2)', [from, to])
    if (!accounts.some(a => a.id === from)) throw errors.validation({ fromAccountId: ['Rekening tidak ditemukan.'] })
    if (!accounts.some(a => a.id === to)) throw errors.validation({ toAccountId: ['Rekening tidak ditemukan.'] })
    if (new Set(accounts.map(a => a.currency)).size > 1) throw rule('Aturan biaya hanya untuk rekening dengan mata uang yang sama.')
    try {
      const [row] = await tx.query<FeeRuleRow>(
        `insert into transfer_fee_rules (from_account_id, to_account_id, fee_type, fixed_minor, percent_bp, min_minor, max_minor,
           effective_from, effective_to, is_active, note, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning *`,
        [from, to, shape.fee_type, shape.fixed_minor, shape.percent_bp, shape.min_minor, shape.max_minor,
          input.effectiveFrom, input.effectiveTo || null, input.isActive ?? true, input.note?.trim() || null, actor.userId]
      )
      const dto = feeRuleDto(row!)
      await recordAudit(tx, { action: 'finance.fee_rule_created', actorUserId: actor.userId, entityType: 'transfer_fee_rule', entityId: row!.id, requestId, after: dto })
      return dto
    } catch (error) {
      if (isOverlap(error)) throw rule(OVERLAP)
      throw error
    }
  })
}

/** Direction (from/to) is fixed; a different direction is a different rule. */
export async function updateFeeRule(db: Db, actor: Actor, id: string, input: FeeRuleInput, requestId: string) {
  if (input.fromAccountId !== undefined || input.toAccountId !== undefined) {
    throw errors.validation({ fromAccountId: ['Arah aturan tidak bisa diubah. Buat aturan baru untuk arah lain.'] })
  }
  return db.transaction(async tx => {
    const [before] = await tx.query<FeeRuleRow>('select * from transfer_fee_rules where id = $1 for update', [id])
    if (!before) throw errors.notFound('Aturan biaya')
    const has = (k: keyof FeeRuleInput) => Object.prototype.hasOwnProperty.call(input, k)
    const merged: FeeRuleInput & { feeType: string } = {
      feeType: input.feeType ?? before.fee_type,
      fixedMinor: has('fixedMinor') ? input.fixedMinor : before.fixed_minor,
      percentBasisPoints: has('percentBasisPoints') ? input.percentBasisPoints : before.percent_bp,
      minMinor: has('minMinor') ? input.minMinor : before.min_minor,
      maxMinor: has('maxMinor') ? input.maxMinor : before.max_minor,
      effectiveFrom: input.effectiveFrom ?? before.effective_from,
      effectiveTo: has('effectiveTo') ? input.effectiveTo : before.effective_to
    }
    const shape = normalise(merged)
    try {
      const [row] = await tx.query<FeeRuleRow>(
        `update transfer_fee_rules set fee_type = $2, fixed_minor = $3, percent_bp = $4, min_minor = $5, max_minor = $6,
           effective_from = $7, effective_to = $8, is_active = $9, note = $10, updated_by = $11, updated_at = now()
         where id = $1 returning *`,
        [id, shape.fee_type, shape.fixed_minor, shape.percent_bp, shape.min_minor, shape.max_minor, merged.effectiveFrom,
          merged.effectiveTo || null, input.isActive ?? before.is_active, has('note') ? input.note?.trim() || null : before.note, actor.userId]
      )
      const dto = feeRuleDto(row!)
      await recordAudit(tx, { action: 'finance.fee_rule_updated', actorUserId: actor.userId, entityType: 'transfer_fee_rule', entityId: id, requestId, before: feeRuleDto(before), after: dto })
      return dto
    } catch (error) {
      if (isOverlap(error)) throw rule(OVERLAP)
      throw error
    }
  })
}
