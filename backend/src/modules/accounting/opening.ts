import { createHash } from 'node:crypto'
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { parseAmountMinor } from '../../shared/money'
import { postBusinessEvent, type JournalLine } from './posting'
import { roleCodes } from './recognition'
import { getBook, type BookRow } from './setup'
import { missingPrepaidMonths } from './prepaid-completeness'

/**
 * Opening balances at the cutover date, derived from the same Finance facts (never retyped, never cash replay).
 * Positions whose classification is a business judgement are asked per item; a suggestion is shown, nothing is assumed.
 * Whatever is not decided stays in "saldo awal belum direkonsiliasi" and keeps the book unvalidated.
 */
export type OpeningSide = 'debit' | 'credit'
export interface OpeningItem {
  key: string; group: string; label: string; sourceType: string; sourceId: string; role: string; side: OpeningSide; amountMinor: string
  dims: { bankAccountId?: string | null; projectId?: string | null; salesOrderId?: string | null; partyId?: string | null; vendorId?: string | null; employeeId?: string | null }
}
export interface OpeningDecisionItem { key: string; kind: 'customer-invoice' | 'vendor-invoice'; sourceId: string; label: string; amountMinor: string; suggestion: string; options: string[] }
export interface OpeningDecisions { invoices?: Record<string, 'earned' | 'unearned'>; vendorInvoices?: Record<string, 'incurred' | 'prepaid'>; equity?: { capitalMinor: string } }

const notReversedBefore = (alias: string) => `not exists (select 1 from financial_transactions r where r.reversal_of_id = ${alias}.id and r.effective_date < $1)`
const allocDate = `coalesce(a.effective_date, (a.created_at at time zone $2)::date)`

async function facts(tx: Queryable, book: BookRow) {
  const c = book.cutover_date, tz = book.timezone
  const items: OpeningItem[] = [], decisions: OpeningDecisionItem[] = [], exceptions: { code: string; message: string }[] = []
  const push = (i: Omit<OpeningItem, 'key'>) => { if (BigInt(i.amountMinor) > 0n) items.push({ ...i, key: `${i.sourceType}:${i.sourceId}:${i.role}` }) }

  for (const a of await tx.query<{ id: string; code: string; opening_date: string; balance: string }>(`select a.id, a.code, a.opening_date,
      ((case when a.opening_date < $1 then a.opening_balance_minor else 0 end) + coalesce((select sum(case when t.direction = 'in' then t.amount_minor else -t.amount_minor end)
        from financial_transactions t where t.bank_account_id = a.id and t.effective_date >= a.opening_date and t.effective_date < $1), 0))::text as balance
      from bank_accounts a where a.opening_status = 'verified' order by a.code`, [c])) {
    if (a.opening_date >= c) exceptions.push({ code: 'BANK_OPENED_AFTER_CUTOVER', message: `Saldo awal rekening ${a.code} bertanggal ${a.opening_date} (setelah cutover) harus tercatat sebagai setoran/transfer, bukan saldo awal buku.` })
    const bal = BigInt(a.balance)
    if (bal < 0n) exceptions.push({ code: 'NEGATIVE_BANK', message: `Saldo rekening ${a.code} per cutover negatif; periksa mutasi.` })
    push({ group: 'Kas & bank', label: `Rekening ${a.code}`, sourceType: 'bank_account', sourceId: a.id, role: 'cash', side: bal >= 0n ? 'debit' : 'credit', amountMinor: (bal < 0n ? -bal : bal).toString(), dims: { bankAccountId: a.id } })
  }

  // Customer invoices open at cutover (issued before, not voided before).
  const invoices = await tx.query<Record<string, any>>(`select i.id, i.number, i.project_id, i.party_id, i.sales_order_id, i.total_minor,
      coalesce((select sum(a.amount_minor) from payment_allocations a join financial_transactions t on t.id = a.transaction_id
        where a.target_type = 'customer_invoice' and a.target_id = i.id and t.effective_date < $1 and ${allocDate} < $1 and ${notReversedBefore('t')}), 0) as paid,
      coalesce((select sum(cn.amount_minor) from credit_notes cn where cn.customer_invoice_id = i.id and cn.effect = 'reduce_receivable' and (cn.created_at at time zone $2)::date < $1
        and (cn.status = 'issued' or (cn.voided_at at time zone $2)::date >= $1)), 0) as credited,
      coalesce((select sum(cn.amount_minor) from credit_notes cn where cn.customer_invoice_id = i.id and cn.effect = 'refund_liability' and (cn.created_at at time zone $2)::date < $1
        and (cn.status = 'issued' or (cn.voided_at at time zone $2)::date >= $1)), 0) as refunded,
      (coalesce(p.status in ('completed') or p.travel_end_date < $1, false) or coalesce(s.status = 'done' or s.travel_end_date < $1, false)) as delivered
    from customer_invoices i left join projects p on p.id = i.project_id left join sales_order_refs s on s.id = i.sales_order_id
    where i.issue_date < $1 and (i.status = 'issued' or (i.status = 'void' and (i.voided_at at time zone $2)::date >= $1)) order by i.id`, [c, tz])
  for (const i of invoices) {
    const dims = { projectId: i.project_id, salesOrderId: i.sales_order_id, partyId: i.party_id }
    const outstanding = BigInt(i.total_minor) - BigInt(i.paid) - BigInt(i.credited)
    const billed = BigInt(i.total_minor) - BigInt(i.credited) - BigInt(i.refunded)
    push({ group: 'Piutang customer', label: `Invoice ${i.number ?? i.id}`, sourceType: 'customer_invoice', sourceId: i.id, role: 'receivable', side: 'debit', amountMinor: outstanding.toString(), dims })
    if (billed > 0n) decisions.push({ key: `customer_invoice:${i.id}`, kind: 'customer-invoice', sourceId: i.id, label: `Invoice ${i.number ?? i.id}`, amountMinor: billed.toString(),
      suggestion: i.delivered ? 'earned' : 'unearned', options: ['earned', 'unearned'] })
  }

  for (const r of await tx.query<Record<string, any>>(`select t.id, t.party_id, t.project_id, t.amount_minor - coalesce((select sum(a.amount_minor) from payment_allocations a
        where a.transaction_id = t.id and ${allocDate} < $1), 0) as open from financial_transactions t
      where t.kind = 'customer_receipt' and t.reversal_of_id is null and t.effective_date < $1 and ${notReversedBefore('t')} order by t.id`, [c, tz])) {
    push({ group: 'Uang muka customer', label: `Penerimaan ${r.id}`, sourceType: 'financial_transaction', sourceId: r.id, role: 'customer-advance', side: 'credit', amountMinor: r.open, dims: { partyId: r.party_id, projectId: r.project_id } })
  }

  const vendorInvoices = await tx.query<Record<string, any>>(`select v.id, v.vendor_invoice_number, v.vendor_id, v.project_id,v.sales_order_id, v.total_minor,
      exists(select 1 from company_expense_invoice_links l where l.vendor_invoice_id=v.id) as company_expense,
      coalesce((select sum(a.amount_minor) from payment_allocations a join financial_transactions t on t.id = a.transaction_id
        where a.target_type = 'vendor_invoice' and a.target_id = v.id and t.effective_date < $1 and ${allocDate} < $1 and ${notReversedBefore('t')}), 0) as paid,
      coalesce(p.status = 'completed' or p.travel_end_date < $1, true) as incurred
    from vendor_invoices v left join projects p on p.id = v.project_id where v.status = 'approved' and v.invoice_date < $1 order by v.id`, [c, tz])
  for (const v of vendorInvoices) {
    const dims = { projectId: v.project_id, salesOrderId:v.sales_order_id,vendorId: v.vendor_id }
    push({ group: 'Utang supplier', label: `Invoice supplier ${v.vendor_invoice_number}`, sourceType: 'vendor_invoice', sourceId: v.id, role: 'payable', side: 'credit',
      amountMinor: (BigInt(v.total_minor) - BigInt(v.paid)).toString(), dims })
    if (!v.company_expense) decisions.push({ key: `vendor_invoice:${v.id}`, kind: 'vendor-invoice', sourceId: v.id, label: `Invoice supplier ${v.vendor_invoice_number}`, amountMinor: v.total_minor,
      suggestion: v.incurred ? 'incurred' : 'prepaid', options: ['incurred', 'prepaid'] })
  }

  for (const d of await tx.query<Record<string, any>>(`select t.id, t.vendor_id, t.project_id, t.amount_minor - coalesce((select sum(a.amount_minor) from payment_allocations a
        where a.transaction_id = t.id and ${allocDate} < $1), 0) as open from financial_transactions t
      where t.kind = 'vendor_payment' and t.reversal_of_id is null and t.effective_date < $1 and ${notReversedBefore('t')} order by t.id`, [c, tz])) {
    push({ group: 'Uang muka supplier', label: `Deposit ${d.id}`, sourceType: 'financial_transaction', sourceId: d.id, role: 'supplier-advance', side: 'debit', amountMinor: d.open, dims: { vendorId: d.vendor_id, projectId: d.project_id } })
  }

  for (const r of await tx.query<Record<string, any>>(`select r.id, r.party_id,r.project_id,r.sales_order_id, r.refundable_minor - coalesce((select sum(a.amount_minor) from payment_allocations a
        join financial_transactions t on t.id = a.transaction_id where a.target_type = 'refund' and a.target_id = r.id and t.effective_date < $1 and ${notReversedBefore('t')}), 0) as open
      from refunds r where r.status = 'approved' and (r.decided_at at time zone $2)::date < $1 order by r.id`, [c, tz])) {
    push({ group: 'Utang refund', label: `Refund ${r.id}`, sourceType: 'refund', sourceId: r.id, role: 'refund-payable', side: 'credit', amountMinor: r.open, dims: { partyId: r.party_id,projectId:r.project_id,salesOrderId:r.sales_order_id } })
  }

  for (const s of await tx.query<Record<string, any>>(`select e.id, e.name,
      coalesce((select sum(case when t.kind = 'employee_advance_return' then -t.amount_minor else t.amount_minor end) from financial_transactions t
        where t.employee_id = e.id and t.reversal_of_id is null and t.effective_date < $1 and ${notReversedBefore('t')}), 0)
      - coalesce((select sum(cl.amount_minor) from employee_expense_claims cl where cl.employee_id = e.id and cl.spent_on < $1
        and (cl.status = 'recorded' or (cl.voided_at at time zone $2)::date >= $1)), 0) as net from employees e order by e.id`, [c, tz])) {
    const net = BigInt(s.net)
    if (net > 0n) push({ group: 'Kasbon staf', label: `Kasbon ${s.name}`, sourceType: 'employee', sourceId: s.id, role: 'employee-advance', side: 'debit', amountMinor: net.toString(), dims: { employeeId: s.id } })
    if (net < 0n) push({ group: 'Reimbursement staf', label: `Reimbursement ${s.name}`, sourceType: 'employee', sourceId: s.id, role: 'reimbursement-payable', side: 'credit', amountMinor: (-net).toString(), dims: { employeeId: s.id } })
  }

  for (const p of await tx.query<Record<string, any>>(`select l.payroll_run_id, l.employee_id, greatest(l.base_salary_minor + l.allowance_minor - l.deduction_minor, 0) as net
      from payroll_lines l join payroll_runs r on r.id = l.payroll_run_id
      where r.status in ('approved', 'paid') and (date_trunc('month', (r.period || '-01')::date) + interval '1 month - 1 day')::date < $1
        and not exists (select 1 from financial_transactions t where t.payroll_run_id = r.id and t.effective_date < $1 and t.reversal_of_id is null and ${notReversedBefore('t')})
        and r.provenance = 'manual' order by l.payroll_run_id, l.employee_id`, [c])) {
    push({ group: 'Utang gaji', label: `Gaji ${p.payroll_run_id} ${p.employee_id}`, sourceType: 'payroll_line', sourceId: `${p.payroll_run_id}:${p.employee_id}`, role: 'payroll-payable', side: 'credit', amountMinor: p.net, dims: { employeeId: p.employee_id } })
  }

  for (const a of await tx.query<Record<string, any>>(`select c.asset_id, c.cost_minor, coalesce((select sum(d.amount_minor) from asset_depreciations d where d.asset_id = c.asset_id
        and (date_trunc('month', (d.period || '-01')::date) + interval '1 month - 1 day')::date < $1), 0) as accumulated from asset_capitalizations c
      where c.acquired_on < $1 and exists (select 1 from financial_transactions t where t.asset_id = c.asset_id and t.kind = 'asset_purchase' and t.reversal_of_id is null and ${notReversedBefore('t')})
      order by c.asset_id`, [c])) {
    push({ group: 'Aset tetap', label: `Aset ${a.asset_id}`, sourceType: 'asset', sourceId: a.asset_id, role: 'fixed-asset', side: 'debit', amountMinor: a.cost_minor, dims: {} })
    push({ group: 'Aset tetap', label: `Akumulasi penyusutan ${a.asset_id}`, sourceType: 'asset', sourceId: a.asset_id, role: 'accumulated-depreciation', side: 'credit', amountMinor: a.accumulated, dims: {} })
  }

  for (const l of await tx.query<Record<string, any>>(`select l.id, l.lender, l.principal_minor - coalesce((select sum(p.principal_minor) from loan_repayments p join financial_transactions t on t.id = p.transaction_id
        where p.loan_id = l.id and t.effective_date < $1 and ${notReversedBefore('t')}), 0) as open from loans l where l.received_on < $1 order by l.id`, [c])) {
    push({ group: 'Pinjaman', label: `Pinjaman ${l.lender}`, sourceType: 'loan', sourceId: l.id, role: 'loan', side: 'credit', amountMinor: l.open, dims: {} })
  }

  for (const s of await tx.query<Record<string, any>>(`select c.id, c.vendor_id, c.project_id,c.sales_order_id, c.amount_minor - coalesce((select sum(a.amount_minor) from payment_allocations a join financial_transactions t on t.id = a.transaction_id
        where a.target_type = 'supplier_claim' and a.target_id = c.id and t.kind = 'vendor_refund' and t.effective_date < $1 and ${notReversedBefore('t')}), 0) as open
      from supplier_claims c where c.recognized_on < $1 and (c.status = 'recorded' or (c.voided_at at time zone $2)::date >= $1) order by c.id`, [c, tz])) {
    push({ group: 'Klaim supplier', label: `Klaim ${s.id}`, sourceType: 'supplier_claim', sourceId: s.id, role: 'supplier-claim', side: 'debit', amountMinor: s.open, dims: { vendorId: s.vendor_id, projectId: s.project_id,salesOrderId:s.sales_order_id } })
  }
  for (const e of await tx.query<{id:string;description:string;vendor_id:string;amount_minor:string}>(`select e.id,e.description,e.vendor_id,e.amount_minor
    from company_expenses e where e.incurred_on<$1 and (e.status='recorded' or e.voided_on>=$1)
    and not exists(select 1 from company_expense_invoice_links l join vendor_invoices v on v.id=l.vendor_invoice_id
      where l.expense_id=e.id and v.status='approved' and v.invoice_date<$1) order by e.id`,[c])) {
    push({group:'Biaya kantor belum ditagih',label:e.description,sourceType:'company_expense',sourceId:e.id,role:'company-accrued',side:'credit',amountMinor:e.amount_minor,dims:{vendorId:e.vendor_id}})
  }
  const [companyHistory] = await tx.query<{n:string}>(`select count(*) as n from company_expense_invoice_links l join vendor_invoices v on v.id=l.vendor_invoice_id
    where v.status='void' and v.invoice_date<$1`,[c])
  if (BigInt(companyHistory!.n)>0n) exceptions.push({code:'COMPANY_INVOICE_HISTORY_REVIEW',message:'Invoice kantor historis yang di-void memerlukan review tanggal koreksi sebelum saldo awal divalidasi.'})
  const [unreviewedCompany] = await tx.query<{n:string}>(`select count(*) as n from v_company_expense_forecast where planned and service_date<$1`,[c])
  if (BigInt(unreviewedCompany!.n)>0n) exceptions.push({code:'RECURRING_REVIEW_REQUIRED',message:'Review bulan kontrak rutin sebelum cutover: catat biaya yang terjadi atau hentikan rencana dengan alasan. Saldo awal belum lengkap.'})
  const beforeCutover = new Date(`${c}T00:00:00Z`)
  beforeCutover.setUTCDate(beforeCutover.getUTCDate()-1)
  for (const p of await missingPrepaidMonths(tx, beforeCutover.toISOString().slice(0,10))) {
    exceptions.push({ code: 'PREPAID_AMORTIZATION_MISSING', message: `Selesaikan ${p.missing} bulan beban ${p.description} sebelum memvalidasi saldo awal.` })
  }
  for (const p of await tx.query<{ id: string; description: string; remaining: string }>(`select p.id,p.description,
      t.amount_minor-coalesce((select sum(a.amount_minor) from prepaid_expense_amortizations a where a.prepaid_expense_id=p.id
        and (date_trunc('month',(a.period || '-01')::date)+interval '1 month - 1 day')::date < $1),0) as remaining
    from prepaid_expenses p join financial_transactions t on t.id=p.transaction_id
    where t.effective_date < $1 and ${notReversedBefore('t')} order by p.id`, [c])) {
    push({ group: 'Biaya kantor dibayar di muka', label: p.description, sourceType: 'prepaid_expense', sourceId: p.id, role: 'prepaid-office', side: 'debit', amountMinor: p.remaining, dims: {} })
  }
  return { items, decisions, exceptions }
}

const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v ?? null)

/** Applies the owner's decisions; the rest balances to opening clearing (never silently to retained earnings). */
function withDecisions(base: Awaited<ReturnType<typeof facts>>, d: OpeningDecisions) {
  const lines = [...base.items]
  const undecided: string[] = []
  for (const q of base.decisions) {
    const choice = q.kind === 'customer-invoice' ? d.invoices?.[q.sourceId] : d.vendorInvoices?.[q.sourceId]
    if (!choice || !q.options.includes(choice)) { undecided.push(q.key); continue }
    if (choice === 'unearned') lines.push({ key: `${q.key}:contract-liability`, group: 'Jasa belum diberikan', label: q.label, sourceType: 'customer_invoice', sourceId: q.sourceId,
      role: 'contract-liability', side: 'credit', amountMinor: q.amountMinor, dims: base.items.find(i => i.sourceType === 'customer_invoice' && i.sourceId === q.sourceId)?.dims ?? {} })
    if (choice === 'prepaid') lines.push({ key: `${q.key}:prepaid-trip`, group: 'Biaya dibayar di muka', label: q.label, sourceType: 'vendor_invoice', sourceId: q.sourceId,
      role: 'prepaid-trip', side: 'debit', amountMinor: q.amountMinor, dims: base.items.find(i => i.sourceType === 'vendor_invoice' && i.sourceId === q.sourceId)?.dims ?? {} })
  }
  const net = lines.reduce((s, l) => s + (l.side === 'debit' ? BigInt(l.amountMinor) : -BigInt(l.amountMinor)), 0n)
  // net > 0: assets exceed liabilities → equity (credit). The owner states paid-in capital; the rest is retained earnings.
  let clearing = -net, equityDecided = false
  if (d.equity && undecided.length === 0) {
    const capital = parseAmountMinor(d.equity.capitalMinor, 'equity.capitalMinor', { allowZero: true })
    const retained = net - capital
    if (capital > 0n) lines.push({ key: 'equity:capital', group: 'Modal', label: 'Modal disetor', sourceType: 'equity', sourceId: 'capital', role: 'capital', side: 'credit', amountMinor: capital.toString(), dims: {} })
    if (retained !== 0n) lines.push({ key: 'equity:retained', group: 'Modal', label: 'Saldo laba s.d. cutover', sourceType: 'equity', sourceId: 'retained', role: 'retained-earnings',
      side: retained > 0n ? 'credit' : 'debit', amountMinor: (retained > 0n ? retained : -retained).toString(), dims: {} })
    clearing = 0n; equityDecided = true
  }
  if (clearing !== 0n) lines.push({ key: 'equity:clearing', group: 'Belum direkonsiliasi', label: 'Saldo awal belum direkonsiliasi', sourceType: 'equity', sourceId: 'clearing',
    role: 'opening-clearing', side: clearing > 0n ? 'debit' : 'credit', amountMinor: (clearing > 0n ? clearing : -clearing).toString(), dims: {} })
  return { lines, undecided, equityDecided, netAssetsMinor: net.toString() }
}

export async function openingPreview(tx: Queryable, decisions: OpeningDecisions = {}) {
  const book = await getBook(tx)
  if (!book) throw errors.notFound('Profil accounting')
  const base = await facts(tx, book)
  const planHash = createHash('sha256').update(canonical({ cutover: book.cutover_date, items: base.items, decisions: base.decisions })).digest('hex')
  const applied = withDecisions(base, decisions)
  const [confirmed] = await tx.query<{ plan_hash: string; validated: boolean; confirmed_at: Date }>('select plan_hash, validated, confirmed_at from accounting_opening_plans where book_id = $1', [book.id])
  return { cutoverDate: book.cutover_date, bookPurpose: book.purpose, planHash, items: applied.lines, decisions: base.decisions, undecided: applied.undecided,
    equityDecided: applied.equityDecided, netAssetsMinor: applied.netAssetsMinor, exceptions: base.exceptions,
    // Only an isolated rehearsal book posts an opening here; production activation stays a separate, user-instructed cutover.
    canConfirm: book.purpose === 'rehearsal' && book.mode !== 'off' && !confirmed,
    confirmed: confirmed ? { planHash: confirmed.plan_hash, validated: confirmed.validated, confirmedAt: confirmed.confirmed_at.toISOString() } : null }
}

export async function confirmOpening(tx: Queryable, actor: Actor, input: { planHash: string; decisions: OpeningDecisions; reason: string }, requestId: string) {
  const book = await getBook(tx, true)
  if (!book) throw errors.notFound('Profil accounting')
  if (book.purpose !== 'rehearsal' || book.mode === 'off') throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', 'Saldo awal produksi diposting saat cutover yang diinstruksikan, bukan dari halaman ini.')
  if ((await tx.query('select 1 from accounting_opening_plans where book_id = $1', [book.id])).length) throw errors.conflict('Saldo awal buku ini sudah dikonfirmasi. Koreksi memakai jurnal penyesuaian yang tercatat.')
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < 5) throw errors.validation({ reason: ['Tuliskan dasar saldo awal (mis. rekening koran per tanggal cutover).'] })
  const preview = await openingPreview(tx, input.decisions ?? {})
  if (preview.planHash !== input.planHash) throw new AppError(409, 'CONFLICT', 'Data sumber berubah sejak pratinjau. Muat ulang pratinjau saldo awal.')
  const code = await roleCodes(tx, book)
  const lines: JournalLine[] = preview.items.map(l => ({ accountCode: code(l.role), debitMinor: l.side === 'debit' ? l.amountMinor : '0', creditMinor: l.side === 'credit' ? l.amountMinor : '0', ...l.dims }))
  if (lines.length < 2) throw errors.validation({ planHash: ['Tidak ada saldo untuk dibuka.'] })
  const posted = await postBusinessEvent(tx, actor, { sourceType: 'opening_plan', sourceId: book.id, sourceVersion: preview.planHash, kind: 'opening', effectiveDate: book.cutover_date,
    snapshot: { planHash: preview.planHash, decisions: input.decisions ?? {} }, policyKind: 'opening', description: `Saldo awal per ${book.cutover_date}`, lines }, requestId)
  if (posted?.status !== 'posted' || !posted.journalId) throw new AppError(422, 'ACCOUNTING_POLICY_REQUIRED', 'Saldo awal belum dapat dibukukan: lengkapi kebijakan saldo awal dan periode cutover.')
  for (const l of preview.items.filter(i => !['equity', 'bank_account'].includes(i.sourceType))) {
    await tx.query('insert into accounting_opening_items (book_id, source_type, source_id, role, amount_minor) values ($1,$2,$3,$4,$5) on conflict do nothing',
      [book.id, l.sourceType, l.sourceId, l.role, l.amountMinor])
  }
  const validated = preview.undecided.length === 0 && preview.equityDecided && preview.exceptions.length === 0
  await tx.query('insert into accounting_opening_plans (book_id, plan_hash, decisions, journal_id, validated, confirmed_by) values ($1,$2,$3::text::jsonb,$4,$5,$6)',
    [book.id, preview.planHash, JSON.stringify(input.decisions ?? {}), posted.journalId, validated, actor.userId])
  if (validated && !book.opening_validated) await tx.query('update accounting_books set opening_validated = true, version = version + 1 where id = $1', [book.id])
  await recordAudit(tx, { action: 'finance.accounting_opening_confirmed', actorUserId: actor.userId, entityType: 'accounting_book', entityId: book.id, requestId, reason,
    after: { planHash: preview.planHash, journalId: posted.journalId, validated, undecided: preview.undecided.length, exceptions: preview.exceptions.map(e => e.code) } })
  return { journalId: posted.journalId, validated, undecided: preview.undecided.length }
}

/** True when a pre-cutover source is represented by the confirmed opening (so later settlements post as deltas). */
export async function openingCovers(tx: Queryable, bookId: string, sourceType: string, sourceId: string) {
  return (await tx.query('select 1 from accounting_opening_items where book_id = $1 and source_type = $2 and source_id = $3 limit 1', [bookId, sourceType, sourceId])).length > 0
}
