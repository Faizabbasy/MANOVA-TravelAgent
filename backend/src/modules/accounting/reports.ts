import type { Db, Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { dateInput, type BookRow } from './setup'
import { missingPrepaidMonths } from './prepaid-completeness'
import { unmatchedSupplierEstimates } from './supplier-completeness'

/**
 * Owner reports read only posted journals (one definition for P&L, balance sheet and project contribution).
 * Unavailable amounts are null, never zero. "Laba sebelum pajak" is the most that is claimed while the tax
 * profile is not validated; net profit after tax stays null.
 */

type Reason = { code: string; message: string }
const REVENUE_ROLES: Record<string, string> = { 'service-revenue': 'Pendapatan jasa', 'agency-revenue': 'Pendapatan fee agen', 'other-revenue': 'Pendapatan lain' }

async function context(tx: Queryable, from: string, to: string) {
  const [b] = await tx.query<BookRow>('select * from accounting_books where singleton for share')
  const reasons: Reason[] = []
  if (!b) return { b: null, available: false, reasons: [{ code: 'SETUP_REQUIRED', message: 'Buat profil accounting terlebih dahulu.' }] }
  if (b.mode === 'off') reasons.push({ code: 'BOOK_OFF', message: 'Buku accounting belum aktif.' })
  if (b.purpose === 'rehearsal') reasons.push({ code: 'REHEARSAL_ONLY', message: 'Ini hasil rehearsal, bukan buku produksi atau saldo bank.' })
  if (from < b.cutover_date) reasons.push({ code: 'BEFORE_CUTOVER', message: `Buku dimulai ${b.cutover_date}; periode sebelum cutover tidak dibukukan dan tidak dikarang.` })
  if (!b.opening_validated) reasons.push({ code: 'OPENING_REQUIRED', message: 'Saldo awal accounting belum direkonsiliasi.' })
  if (b.tax_status !== 'validated') reasons.push({ code: 'TAX_PROFILE_INCOMPLETE', message: 'Profil pajak belum tervalidasi; yang tersedia laba sebelum pajak.' })
  const [pending] = await tx.query<{ count: string }>(`select count(*) as count from accounting_posting_registry r join accounting_events e on e.id=r.event_id
    where r.book_id=$1 and r.status='pending' and e.effective_date between $2 and $3`, [b.id, from, to])
  if (BigInt(pending!.count) > 0n) reasons.push({ code: 'SOURCE_PENDING', message: `${pending!.count} kejadian sumber pada periode ini belum dibukukan (kebijakan/fakta kurang).` })
  const accrual=await unmatchedSupplierEstimates(tx,b,to)
  if (BigInt(accrual.n)>0n) reasons.push({code:'ACCRUAL_UNMATCHED',message:`${accrual.n} penerimaan jasa masih memakai estimasi (sisa ${accrual.total}); invoice aktual belum dicocokkan penuh.`})
  const prepaid = await missingPrepaidMonths(tx, to)
  const [recurring] = await tx.query<{n:string}>('select count(*) as n from v_company_expense_forecast where planned and service_date<=$1',[to])
  if (BigInt(recurring!.n)>0n) reasons.push({code:'RECURRING_REVIEW_REQUIRED',message:`${recurring!.n} bulan rencana biaya rutin belum direview sebagai biaya terjadi atau penghentian kontrak.`})
  if (prepaid.length) reasons.push({ code: 'PREPAID_AMORTIZATION_MISSING', message: `${prepaid.length} biaya kantor dibayar di muka belum dibebankan untuk bulan manfaat yang telah berakhir.` })
  return { b, available: b.mode !== 'off' && to >= b.cutover_date, reasons }
}

function period(from: unknown, to: unknown) {
  const f = dateInput(from, 'from'), t = dateInput(to, 'to')
  if (t < f) throw errors.validation({ to: ['Tanggal akhir harus setelah tanggal awal.'] })
  return { from: f, to: t }
}

const header = (b: BookRow | null, available: boolean, reasons: Reason[]) => ({
  currency: b?.currency ?? 'IDR', timezone: b?.timezone ?? null, basis: b?.purpose === 'rehearsal' ? 'rehearsal' as const : 'recognized' as const,
  available, completeness: available ? 'provisional' as const : 'unavailable' as const, reasons, policyVersion: b?.version ?? null
})

/** Account movements (debit − credit) by account for posted journals in a date range. */
async function movements(tx: Queryable, b: BookRow, from: string, to: string) {
  return tx.query<{ code: string; name: string; account_type: string; control_role: string | null; net: string }>(`select a.code,a.name,a.account_type,a.control_role,
    coalesce(sum(l.debit_minor-l.credit_minor),0) as net from accounting_accounts a
    left join (accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted' and j.effective_date between $2 and $3)
    on l.book_id=a.book_id and l.account_code=a.code where a.book_id=$1 group by a.code,a.name,a.account_type,a.control_role order by a.code`, [b.id, from, to])
}

function section(rows: { code: string; name: string; net: bigint }[]) {
  const lines = rows.filter(r => r.net !== 0n).map(r => ({ code: r.code, name: r.name, amountMinor: r.net.toString() }))
  return { lines, totalMinor: rows.reduce((s, r) => s + r.net, 0n).toString() }
}

export async function profitAndLoss(db: Db, query: { from?: string; to?: string }) {
  const { from, to } = period(query.from, query.to)
  return db.transaction(async tx => {
    const { b, available, reasons } = await context(tx, from, to)
    const base = { from, to, ...header(b, available, reasons) }
    if (!b || !available) return { ...base, revenue: null, directCost: null, grossProfitMinor: null, operatingExpense: null, profitBeforeTaxMinor: null, taxExpense: null, netProfitMinor: null }
    const rows = await movements(tx, b, from < b.cutover_date ? b.cutover_date : from, to)
    const pl = rows.filter(r => r.account_type === 'revenue' || r.account_type === 'expense').map(r => ({ ...r, net: BigInt(r.net) }))
    // Revenue shown positive (credit), expenses positive (debit).
    const revenue = section(pl.filter(r => r.account_type === 'revenue').map(r => ({ code: r.code, name: REVENUE_ROLES[r.control_role ?? ''] ?? r.name, net: -r.net })))
    const directCost = section(pl.filter(r => r.control_role === 'direct-cost'))
    const tax = section(pl.filter(r => r.control_role === 'tax-expense'))
    // Office, payroll, commission, bank fee, depreciation, finance cost, credit loss: every other expense, once.
    const operating = section(pl.filter(r => r.account_type === 'expense' && r.control_role !== 'direct-cost' && r.control_role !== 'tax-expense'))
    const gross = BigInt(revenue.totalMinor) - BigInt(directCost.totalMinor)
    const beforeTax = gross - BigInt(operating.totalMinor)
    return { ...base, revenue, directCost, grossProfitMinor: gross.toString(), operatingExpense: operating, profitBeforeTaxMinor: beforeTax.toString(), taxExpense: tax,
      // After-tax profit needs a validated tax profile and complete tax accruals; never claimed from unknown.
      netProfitMinor: b.tax_status === 'validated' && !reasons.some(r => ['SOURCE_PENDING','PREPAID_AMORTIZATION_MISSING','RECURRING_REVIEW_REQUIRED'].includes(r.code)) ? (beforeTax - BigInt(tax.totalMinor)).toString() : null }
  })
}

export async function balanceSheet(db: Db, query: { asOf?: string }) {
  const asOf = dateInput(query.asOf, 'asOf')
  return db.transaction(async tx => {
    const { b, available, reasons } = await context(tx, '0001-01-01', asOf)
    const base = { asOf, ...header(b, available, reasons.filter(r => r.code !== 'BEFORE_CUTOVER')) }
    if (!b || !available) return { ...base, assets: null, liabilities: null, equity: null, currentResultMinor: null, balanced: null }
    const rows = (await movements(tx, b, '0001-01-01', asOf)).map(r => ({ ...r, net: BigInt(r.net) }))
    const assets = section(rows.filter(r => r.account_type === 'asset'))
    const liabilities = section(rows.filter(r => r.account_type === 'liability').map(r => ({ ...r, net: -r.net })))
    const equity = section(rows.filter(r => r.account_type === 'equity').map(r => ({ ...r, net: -r.net })))
    // No closing entries exist yet: the result since cutover is counted once here, never also in retained earnings.
    const result = -rows.filter(r => r.account_type === 'revenue' || r.account_type === 'expense').reduce((s, r) => s + r.net, 0n)
    const balanced = BigInt(assets.totalMinor) === BigInt(liabilities.totalMinor) + BigInt(equity.totalMinor) + result
    return { ...base, assets, liabilities, equity, currentResultMinor: result.toString(), balanced }
  })
}

/**
 * Contribution per project/order (recognised revenue − direct cost) plus company-level items, reconciling to
 * the P&L total. Overhead allocation is not added as a second expense here.
 */
export async function projectContribution(db: Db, query: { from?: string; to?: string }) {
  const { from, to } = period(query.from, query.to)
  return db.transaction(async tx => {
    const { b, available, reasons } = await context(tx, from, to)
    const base = { from, to, ...header(b, available, reasons) }
    if (!b || !available) return { ...base, items: [], companyMinor: null, totalMinor: null }
    const rows = await tx.query<{ project_id: string | null; sales_order_id: string | null; name: string | null; revenue: string; direct: string; other: string }>(`
      select l.project_id, case when l.project_id is null then l.sales_order_id end as sales_order_id, p.name,
        coalesce(sum(case when a.account_type='revenue' then l.credit_minor-l.debit_minor end),0) as revenue,
        coalesce(sum(case when a.control_role='direct-cost' then l.debit_minor-l.credit_minor end),0) as direct,
        coalesce(sum(case when a.account_type='expense' and a.control_role is distinct from 'direct-cost' then l.debit_minor-l.credit_minor end),0) as other
      from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted' and j.effective_date between $2 and $3
      join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code left join projects p on p.id=l.project_id
      where l.book_id=$1 and a.account_type in ('revenue','expense')
      group by l.project_id, case when l.project_id is null then l.sales_order_id end, p.name`, [b.id, from < b.cutover_date ? b.cutover_date : from, to])
    let company = 0n, total = 0n
    const items = []
    for (const r of rows) {
      const contribution = BigInt(r.revenue) - BigInt(r.direct)
      const net = contribution - BigInt(r.other)
      total += net
      if (!r.project_id && !r.sales_order_id) { company += net; continue }
      items.push({ projectId: r.project_id, salesOrderId: r.sales_order_id, name: r.name ?? r.sales_order_id, revenueMinor: r.revenue, directCostMinor: r.direct,
        contributionMinor: contribution.toString(), otherExpenseMinor: r.other })
    }
    items.sort((x, y) => (BigInt(y.contributionMinor) > BigInt(x.contributionMinor) ? 1 : BigInt(y.contributionMinor) < BigInt(x.contributionMinor) ? -1 : 0))
    return { ...base, items, companyMinor: company.toString(), totalMinor: total.toString() }
  })
}
