import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { postCashSource } from '../accounting/cash-source'
import { postDepreciationSource } from '../accounting/assets'
import { getBook } from '../accounting/setup'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseMovementAmount, rule, todayBusinessDate } from './common'
import { assertOutflowFits, lockPostableAccount, trimOrNull, validateEffectiveDate } from './postings'

/**
 * Owner accounting F6 source actions: "Beli Aset", depreciation per month, loans and owner funds. Each is one
 * business fact; the cash leg goes through financial_transactions and the ledger derives the rest.
 */

const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/
const ref = (v: unknown, field: string) => {
  if (typeof v !== 'string' || !ID_PATTERN.test(v)) throw errors.validation({ [field]: ['Referensi tidak valid.'] })
  return v
}
function intInRange(v: unknown, field: string, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw errors.validation({ [field]: [`Isi bilangan bulat ${min}–${max}.`] })
  return v
}

async function insertCash(tx: Queryable, actor: Actor, row: { accountId: string; currency: string; direction: 'in' | 'out'; kind: string; amount: bigint; date: string
  assetId?: string | null; loanId?: string | null; reference?: string | null; memo: string }) {
  const [t] = await tx.query<{ id: string }>(`insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, asset_id, loan_id, reference, memo, created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
  [row.accountId, row.direction, row.amount.toString(), row.currency, row.kind, row.date, row.assetId ?? null, row.loanId ?? null, row.reference ?? null, row.memo, actor.userId])
  return t!.id
}

export interface AssetPurchaseInput {
  assetId: string; bankAccountId: string; costMinor: string; acquiredOn: string; inServiceOn?: string; usefulLifeMonths: number; residualMinor?: string; reference?: string
}

/** "Beli Aset": pays for an inventory asset and capitalises it. Not an expense; depreciation spreads it over its life. */
export async function purchaseAsset(tx: Queryable, actor: Actor, input: AssetPurchaseInput, requestId: string) {
  await getBook(tx, true)
  const assetId = ref(input.assetId, 'assetId')
  const [asset] = await tx.query<{ id: string; name: string }>('select id, name from assets where id = $1 for update', [assetId])
  if (!asset) throw errors.validation({ assetId: ['Aset tidak ditemukan.'] })
  if ((await tx.query('select 1 from asset_capitalizations where asset_id = $1', [assetId])).length) throw rule('Aset ini sudah tercatat dibeli/dikapitalisasi.')
  const cost = parseMovementAmount(input.costMinor, 'costMinor')
  const residual = input.residualMinor ? parseMovementAmount(input.residualMinor, 'residualMinor', { allowZero: true }) : 0n
  if (residual >= cost) throw errors.validation({ residualMinor: ['Nilai sisa harus lebih kecil dari harga perolehan.'] })
  const acquiredOn = validateEffectiveDate(input.acquiredOn, 'acquiredOn')
  const inServiceOn = input.inServiceOn ? validateEffectiveDate(input.inServiceOn, 'inServiceOn') : acquiredOn
  if (inServiceOn < acquiredOn) throw errors.validation({ inServiceOn: ['Mulai dipakai tidak boleh sebelum tanggal beli.'] })
  const life = intInRange(input.usefulLifeMonths, 'usefulLifeMonths', 1, 600)
  const account = await lockPostableAccount(tx, input.bankAccountId, acquiredOn)
  await assertOutflowFits(tx, account, acquiredOn, cost)
  await tx.query(`insert into asset_capitalizations (asset_id, cost_minor, residual_minor, acquired_on, in_service_on, useful_life_months, created_by)
    values ($1,$2,$3,$4,$5,$6,$7)`, [assetId, cost.toString(), residual.toString(), acquiredOn, inServiceOn, life, actor.userId])
  const transactionId = await insertCash(tx, actor, { accountId: account.id, currency: account.currency, direction: 'out', kind: 'asset_purchase', amount: cost,
    date: acquiredOn, assetId, reference: trimOrNull(input.reference, 120), memo: `Pembelian aset ${asset.name}` })
  await postCashSource(tx, actor, transactionId, requestId)
  await recordAudit(tx, { action: 'finance.asset_purchased', actorUserId: actor.userId, entityType: 'asset', entityId: assetId, requestId,
    after: { transactionId, costMinor: cost.toString(), residualMinor: residual.toString(), acquiredOn, inServiceOn, usefulLifeMonths: life } })
  return { assetId, transactionId }
}

/** Straight line with exact bigint maths: the remainder goes to the final month so the total equals cost − residual. */
export function depreciationFor(cost: bigint, residual: bigint, life: number, monthIndex: number): bigint {
  if (monthIndex < 0 || monthIndex >= life) return 0n
  const base = cost - residual, n = BigInt(life), monthly = base / n
  return monthIndex === life - 1 ? base - monthly * (n - 1n) : monthly
}

const monthsBetween = (fromIso: string, period: string) => (Number(period.slice(0, 4)) - Number(fromIso.slice(0, 4))) * 12 + Number(period.slice(5, 7)) - Number(fromIso.slice(5, 7))

/**
 * Books every missing depreciation month up to `throughPeriod` (inclusive), once per asset and month. Depreciation
 * starts in the month the asset is put into service. A reversed purchase stops the schedule.
 */
export async function runDepreciation(tx: Queryable, actor: Actor, input: { throughPeriod: string }, requestId: string) {
  await getBook(tx, true)
  if (typeof input.throughPeriod !== 'string' || !MONTH.test(input.throughPeriod)) throw errors.validation({ throughPeriod: ['Periode harus YYYY-MM.'] })
  if (input.throughPeriod > todayBusinessDate().slice(0, 7)) throw errors.validation({ throughPeriod: ['Penyusutan bulan yang belum berjalan tidak dicatat.'] })
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['depreciation-run'])
  const assets = await tx.query<{ asset_id: string; cost_minor: string; residual_minor: string; in_service_on: string; useful_life_months: number }>(`
    select c.asset_id, c.cost_minor, c.residual_minor, c.in_service_on, c.useful_life_months from asset_capitalizations c
     where exists (select 1 from financial_transactions t where t.asset_id = c.asset_id and t.kind = 'asset_purchase' and t.reversal_of_id is null
       and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id))
     order by c.asset_id`)
  const booked: { assetId: string; period: string; amountMinor: string }[] = []
  for (const a of assets) {
    const done = new Set((await tx.query<{ period: string }>('select period from asset_depreciations where asset_id = $1', [a.asset_id])).map(r => r.period))
    const start = a.in_service_on.slice(0, 7)
    for (let i = 0; i < a.useful_life_months; i++) {
      const y = Number(start.slice(0, 4)) + Math.floor((Number(start.slice(5, 7)) - 1 + i) / 12)
      const m = ((Number(start.slice(5, 7)) - 1 + i) % 12) + 1
      const period = `${y}-${String(m).padStart(2, '0')}`
      if (period > input.throughPeriod) break
      if (done.has(period)) continue
      const amount = depreciationFor(BigInt(a.cost_minor), BigInt(a.residual_minor), a.useful_life_months, monthsBetween(a.in_service_on, period))
      if (amount <= 0n) continue
      await tx.query('insert into asset_depreciations (asset_id, period, amount_minor, created_by) values ($1,$2,$3,$4)', [a.asset_id, period, amount.toString(), actor.userId])
      await postDepreciationSource(tx, actor, a.asset_id, period, requestId)
      booked.push({ assetId: a.asset_id, period, amountMinor: amount.toString() })
    }
  }
  if (booked.length) await recordAudit(tx, { action: 'finance.depreciation_run', actorUserId: actor.userId, entityType: 'asset_depreciation', entityId: input.throughPeriod, requestId, after: { booked } })
  return { throughPeriod: input.throughPeriod, booked }
}

export interface LoanInput { lender: string; principalMinor: string; receivedOn: string; terms: string; bankAccountId: string; reference?: string }

/** "Catat Pinjaman": the loan and the money received, in one fact. A loan is never revenue. */
export async function receiveLoan(tx: Queryable, actor: Actor, input: LoanInput, requestId: string) {
  await getBook(tx, true)
  const lender = trimOrNull(input.lender, 200) ?? ''
  if (lender.length < 2) throw errors.validation({ lender: ['Isi nama pemberi pinjaman.'] })
  const terms = trimOrNull(input.terms, 1000) ?? ''
  if (terms.length < 5) throw errors.validation({ terms: ['Jelaskan syarat pinjaman (bunga, tenor, jadwal).'] })
  const principal = parseMovementAmount(input.principalMinor, 'principalMinor')
  const receivedOn = validateEffectiveDate(input.receivedOn, 'receivedOn')
  const account = await lockPostableAccount(tx, input.bankAccountId, receivedOn)
  const id = await nextId(tx, 'LON-')
  await tx.query('insert into loans (id, lender, principal_minor, received_on, terms, created_by) values ($1,$2,$3,$4,$5,$6)', [id, lender, principal.toString(), receivedOn, terms, actor.userId])
  const transactionId = await insertCash(tx, actor, { accountId: account.id, currency: account.currency, direction: 'in', kind: 'loan_proceeds', amount: principal,
    date: receivedOn, loanId: id, reference: trimOrNull(input.reference, 120), memo: `Pinjaman dari ${lender}` })
  await postCashSource(tx, actor, transactionId, requestId)
  await recordAudit(tx, { action: 'finance.loan_received', actorUserId: actor.userId, entityType: 'loan', entityId: id, requestId, after: { principalMinor: principal.toString(), receivedOn, transactionId } })
  return { id, transactionId }
}

async function loanOutstanding(q: Queryable, loanId: string) {
  const [r] = await q.query<{ principal: string; repaid: string }>(`select l.principal_minor as principal, coalesce((select sum(p.principal_minor) from loan_repayments p
      join financial_transactions t on t.id = p.transaction_id where p.loan_id = l.id
      and not exists (select 1 from financial_transactions x where x.reversal_of_id = t.id)), 0) as repaid from loans l where l.id = $1`, [loanId])
  return r ? BigInt(r.principal) - BigInt(r.repaid) : null
}

export interface LoanRepaymentInput { loanId: string; bankAccountId: string; principalMinor: string; interestMinor: string; effectiveDate: string; reference?: string }

/** Instalment: principal reduces the loan (not an expense), interest is a finance cost. */
export async function repayLoan(tx: Queryable, actor: Actor, input: LoanRepaymentInput, requestId: string) {
  await getBook(tx, true)
  const loanId = ref(input.loanId, 'loanId')
  const [loan] = await tx.query<{ id: string; received_on: string }>('select id, received_on from loans where id = $1 for update', [loanId])
  if (!loan) throw errors.validation({ loanId: ['Pinjaman tidak ditemukan.'] })
  const principal = parseMovementAmount(input.principalMinor, 'principalMinor', { allowZero: true })
  const interest = parseMovementAmount(input.interestMinor, 'interestMinor', { allowZero: true })
  if (principal + interest <= 0n) throw errors.validation({ principalMinor: ['Isi pokok dan/atau bunga yang dibayar.'] })
  const outstanding = (await loanOutstanding(tx, loanId))!
  if (principal > outstanding) throw errors.validation({ principalMinor: [`Melebihi sisa pokok (${outstanding}).`] })
  const date = validateEffectiveDate(input.effectiveDate)
  if (date < loan.received_on) throw errors.validation({ effectiveDate: ['Cicilan tidak boleh sebelum pinjaman diterima.'] })
  const account = await lockPostableAccount(tx, input.bankAccountId, date)
  await assertOutflowFits(tx, account, date, principal + interest)
  const transactionId = await insertCash(tx, actor, { accountId: account.id, currency: account.currency, direction: 'out', kind: 'loan_repayment', amount: principal + interest,
    date, loanId, reference: trimOrNull(input.reference, 120), memo: `Cicilan ${loanId}` })
  await tx.query('insert into loan_repayments (transaction_id, loan_id, principal_minor, interest_minor) values ($1,$2,$3,$4)', [transactionId, loanId, principal.toString(), interest.toString()])
  await postCashSource(tx, actor, transactionId, requestId)
  if (principal === outstanding) await tx.query("update loans set status = 'repaid' where id = $1", [loanId])
  await recordAudit(tx, { action: 'finance.loan_repaid', actorUserId: actor.userId, entityType: 'loan', entityId: loanId, requestId,
    after: { transactionId, principalMinor: principal.toString(), interestMinor: interest.toString() } })
  return { transactionId, outstandingMinor: (outstanding - principal).toString() }
}

export interface OwnerFundInput { bankAccountId: string; amountMinor: string; effectiveDate: string; memo?: string; reference?: string }

/** Owner puts money in or takes money out. Never revenue or operating expense; the equity treatment comes from the entity profile. */
export async function postOwnerFunds(tx: Queryable, actor: Actor, kind: 'owner_contribution' | 'owner_withdrawal', input: OwnerFundInput, requestId: string) {
  await getBook(tx, true)
  const amount = parseMovementAmount(input.amountMinor)
  const date = validateEffectiveDate(input.effectiveDate)
  const account = await lockPostableAccount(tx, input.bankAccountId, date)
  if (kind === 'owner_withdrawal') await assertOutflowFits(tx, account, date, amount)
  const transactionId = await insertCash(tx, actor, { accountId: account.id, currency: account.currency, direction: kind === 'owner_contribution' ? 'in' : 'out', kind, amount, date,
    reference: trimOrNull(input.reference, 120), memo: trimOrNull(input.memo) ?? (kind === 'owner_contribution' ? 'Setoran owner' : 'Pengambilan dana owner') })
  const posting = await postCashSource(tx, actor, transactionId, requestId)
  await recordAudit(tx, { action: `finance.${kind}_posted`, actorUserId: actor.userId, entityType: 'financial_transaction', entityId: transactionId, requestId,
    after: { accountId: account.id, amountMinor: amount.toString(), effectiveDate: date } })
  return { transactionId, accountingStatus: posting?.status ?? 'off' }
}

export async function fundingOverview(db: Db) {
  const assets = await db.query<Record<string, any>>(`select a.id, a.name, c.cost_minor, c.residual_minor, c.acquired_on, c.in_service_on, c.useful_life_months,
      coalesce((select sum(d.amount_minor) from asset_depreciations d where d.asset_id = a.id), 0) as depreciated_minor,
      (select max(d.period) from asset_depreciations d where d.asset_id = a.id) as last_period
    from asset_capitalizations c join assets a on a.id = c.asset_id order by c.acquired_on desc, a.id`)
  const loans = await db.query<Record<string, any>>(`select l.*, l.principal_minor - coalesce((select sum(p.principal_minor) from loan_repayments p
      join financial_transactions t on t.id = p.transaction_id where p.loan_id = l.id and not exists (select 1 from financial_transactions x where x.reversal_of_id = t.id)), 0) as outstanding_minor
    from loans l order by l.received_on desc, l.id`)
  return {
    assets: assets.map(a => ({ assetId: a.id as string, name: a.name as string, costMinor: a.cost_minor as string, residualMinor: a.residual_minor as string,
      acquiredOn: a.acquired_on as string, inServiceOn: a.in_service_on as string, usefulLifeMonths: a.useful_life_months as number,
      accumulatedMinor: a.depreciated_minor as string, bookValueMinor: (BigInt(a.cost_minor) - BigInt(a.depreciated_minor)).toString(), lastPeriod: a.last_period ?? null })),
    loans: loans.map(l => ({ id: l.id as string, lender: l.lender as string, principalMinor: l.principal_minor as string, outstandingMinor: l.outstanding_minor as string,
      receivedOn: l.received_on as string, terms: l.terms as string, status: l.status as 'open' | 'repaid' }))
  }
}
