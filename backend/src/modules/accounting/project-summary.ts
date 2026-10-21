import type { Db } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { todayBusinessDate } from '../finance/common'
import { unmatchedSupplierEstimates } from './supplier-completeness'

/**
 * Project accounting summary (owner accounting F3/F8): one project's recognised result and open positions from posted
 * journals, next to the Finance facts that are not ledger yet (contract, budget, remaining supplier commitment).
 * Operational status, accounting review and cash settlement are reported separately — never one "Lunas" badge.
 */
export async function projectAccountingSummary(db: Db, projectId: string) {
  if (!ID_PATTERN.test(projectId)) throw errors.notFound('Project')
  return db.transaction(async tx => {
    const [p] = await tx.query<{ id: string; status: string; contract_value_minor: string | null; finance_settled_at: Date | null; closed_at: Date | null }>(
      'select id, status, contract_value_minor, finance_settled_at, closed_at from projects where id = $1', [projectId])
    if (!p) throw errors.notFound('Project')
    const [book] = await tx.query<{ id: string; mode: string; purpose: string;timezone:string }>('select id, mode, purpose,timezone from accounting_books where singleton')
    const [facts] = await tx.query<{ budget: string; commitment: string }>(`select
        coalesce((select sum(budget_minor) from project_services where project_id = $1 and status <> 'cancelled'), 0) as budget,
        coalesce((select sum(greatest(so.net_cost_minor - greatest(coalesce((select sum(v.total_minor) from vendor_invoices v where v.service_order_id = so.id and v.status = 'approved'), 0),
          coalesce((select sum(f.amount_minor) from service_fulfillments f where f.service_order_id=so.id and f.side='supplier' and f.status='recorded'),0)), 0))
          from service_orders so where so.project_id = $1 and so.status in ('sent', 'acknowledged', 'amended', 'fulfilled') and so.net_cost_minor is not null), 0) as commitment`, [projectId])
    const status = {
      operational: p.status,
      cashSettled: !!p.finance_settled_at,
      closed: !!p.closed_at
    }
    const base = { projectId, contractValueMinor: p.contract_value_minor, budgetMinor: facts!.budget, remainingCommitmentMinor: facts!.commitment, status }
    if (!book || book.mode === 'off') {
      return { ...base, available: false as const, basis: null, reasons: [{ code: 'BOOK_OFF', message: 'Accounting belum aktif; hasil project memakai ringkasan Finance.' }],
        accountingReview: null, figures: null }
    }
    const rows = await tx.query<{ role: string | null; account_type: string; net: string }>(`select a.control_role as role, a.account_type, coalesce(sum(l.debit_minor - l.credit_minor), 0) as net
      from accounting_journal_lines l join accounting_journals j on j.id = l.journal_id and j.status = 'posted'
      join accounting_accounts a on a.book_id = l.book_id and a.code = l.account_code
      where l.book_id = $1 and l.project_id = $2 group by a.control_role, a.account_type`, [book.id, projectId])
    const by = (role: string) => BigInt(rows.find(r => r.role === role)?.net ?? '0')
    const revenue = -rows.filter(r => r.account_type === 'revenue').reduce((s, r) => s + BigInt(r.net), 0n)
    const directCost = by('direct-cost')
    const otherCost = rows.filter(r => r.account_type === 'expense' && r.role !== 'direct-cost').reduce((s, r) => s + BigInt(r.net), 0n)
    const prepaid = by('prepaid-trip')
    const [pending] = await tx.query<{ n: string }>(`select count(*) as n from accounting_posting_registry r join accounting_events e on e.id = r.event_id
      where r.book_id = $1 and r.status = 'pending' and (e.snapshot->>'project_id' = $2 or e.snapshot->>'projectId' = $2)`, [book.id, projectId])
    const estimates=await unmatchedSupplierEstimates(tx,book,todayBusinessDate(),projectId)
    const reasons: { code: string; message: string }[] = []
    if (book.purpose === 'rehearsal') reasons.push({ code: 'REHEARSAL_ONLY', message: 'Hasil rehearsal, bukan buku produksi.' })
    if (BigInt(pending!.n) > 0n) reasons.push({ code: 'SOURCE_PENDING', message: `${pending!.n} transaksi project ini menunggu kebijakan/fakta.` })
    if (BigInt(estimates!.n) > 0n) reasons.push({ code: 'ACCRUAL_ESTIMATE', message: `${estimates!.n} biaya supplier masih estimasi tanpa invoice.` })
    if (by('contract-liability') < 0n) reasons.push({ code: 'SERVICE_NOT_DELIVERED', message: 'Sebagian tagihan belum menjadi pendapatan karena jasanya belum dicatat diberikan.' })
    const matchRequired=prepaid>0n && by('accrued-cost')<0n
    if(matchRequired)reasons.push({code:'SUPPLIER_MATCH_REQUIRED',message:'Invoice menunggu pencocokan sementara jasa sudah dicatat diterima. Perkiraan biaya akhir ditahan agar prepaid dan estimasi tidak dijumlahkan ganda.'})
    return {
      ...base,
      available: true as const,
      basis: book.purpose === 'rehearsal' ? 'rehearsal' as const : 'recognized' as const,
      reasons,
      accountingReview: { pendingCount: Number(pending!.n), estimateCount: Number(estimates!.n), complete: reasons.every(r => r.code === 'REHEARSAL_ONLY') },
      figures: {
        recognizedRevenueMinor: revenue.toString(),
        recognizedDirectCostMinor: directCost.toString(),
        contributionMinor: (revenue - directCost).toString(),
        otherProjectCostMinor: otherCost.toString(),
        deferredRevenueMinor: (-by('contract-liability')).toString(),
        unbilledRevenueMinor: by('contract-asset').toString(),
        receivableMinor: by('receivable').toString(),
        payableMinor: (-by('payable')).toString(),
        accruedCostMinor: (-by('accrued-cost')).toString(),
        prepaidCostMinor: prepaid.toString(),
        supplierAdvanceMinor: by('supplier-advance').toString(),
        // Direct cost already recognised + paid-ahead service still to be consumed + what suppliers have yet to bill.
        estimatedFinalCostMinor: matchRequired ? null : (directCost + prepaid + BigInt(facts!.commitment)).toString()
      }
    }
  })
}
