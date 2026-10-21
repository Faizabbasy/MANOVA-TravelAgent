import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { findPolicy, originalLines, postBusinessEvent, type JournalLine } from './posting'
import { getBook } from './setup'

/** Derive from the SAME financial_transactions row; this service never creates cash. */
export async function postCashSource(tx:Queryable,actor:Actor,transactionId:string,requestId:string) {
  const book = await getBook(tx,true)
  if (!book || book.mode === 'off') return
  const [t] = await tx.query<Record<string,any>>(`select id,kind,direction,amount_minor,currency,effective_date,bank_account_id,project_id,party_id,vendor_id,
    employee_id,payroll_run_id,asset_id,loan_id,category,reversal_of_id,reversal_reason,transfer_id,sales_order_id from financial_transactions where id=$1`,[transactionId])
  if (!t) throw errors.notFound('Transaksi sumber')
  if (!t.sales_order_id) delete t.sales_order_id
  if (t.effective_date < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Transaksi baru sebelum cutover memerlukan prosedur koreksi saldo awal, bukan posting kas historis ulang.')
    return
  }
  if (t.project_id && t.party_id) {
    const [related] = await tx.query(`select 1 from projects where id=$1 and party_id=$2
      union all select 1 from sales_order_refs where project_id=$1 and party_id=$2 limit 1`,[t.project_id,t.party_id])
    if (!related) throw errors.validation({ partyId:['Customer tidak terkait project sumber. Pilih customer/project yang sesuai.'] })
  }
  const accounts = await tx.query<{ code:string;control_role:string }>('select code,control_role from accounting_accounts where book_id=$1',[book.id])
  const map = new Map(accounts.map(a => [a.control_role,a.code]))
  const code = (role:string) => map.get(role) ?? ''
  const dims = { projectId:t.project_id,salesOrderId:t.sales_order_id,partyId:t.party_id,vendorId:t.vendor_id,employeeId:t.employee_id }
  const line = (role:string,side:'debitMinor'|'creditMinor',bank = false):JournalLine => ({ accountCode:code(role),debitMinor:'0',creditMinor:'0',
    ...dims,...(bank ? { bankAccountId:t.bank_account_id } : {}),[side]:t.amount_minor })
  const policyKind = ['transfer_in','transfer_out','transfer_fee'].includes(t.kind) ? 'transfer'
    : ['customer_receipt','vendor_payment'].includes(t.kind) ? t.kind
    : t.kind === 'refund_settlement' ? 'refund' : t.kind === 'vendor_refund' ? 'supplier_claim'
    : ['employee_advance','employee_advance_return','employee_reimbursement'].includes(t.kind) ? 'employee_advance'
    : t.kind === 'payroll_payment' ? 'payroll' : t.kind === 'asset_purchase' ? 'asset' : t.kind === 'prepaid_opex' ? 'prepaid_opex'
    : ['loan_proceeds','loan_repayment'].includes(t.kind) ? 'loan' : ['owner_contribution','owner_withdrawal'].includes(t.kind) ? 'owner_funds' : 'manual_cash'
  const policy = await findPolicy(tx,book,policyKind,t.effective_date)
  let lines:JournalLine[] = [],pendingReason:{ code:string;message:string } | undefined
  if (t.reversal_of_id) {
    const originals = await tx.query<{ id:string;source_kind:string }>(`select j.id,p.source_kind from accounting_journals j
      join accounting_events e on e.id=j.event_id join accounting_policies p on p.id=j.policy_id
      where j.book_id=$1 and j.status='posted' and j.reversal_of_id is null and
      ((e.source_type='financial_transaction' and e.source_id=$2) or
       (e.source_type='payment_allocation' and e.source_id in (select id::text from payment_allocations where transaction_id=$2))) order by j.id`,[book.id,t.reversal_of_id])
    if (originals.length) {
      let complete=true
      for (const original of originals) {
        const posted=await postBusinessEvent(tx,actor,{ sourceType:'financial_transaction',sourceId:t.id,sourceVersion:original.id,kind:'cash_reversal',
          effectiveDate:t.effective_date,snapshot:t,policyKind:original.source_kind,description:`Pembatalan ${t.reversal_of_id}`,
          lines:await originalLines(tx,original.id),reversalOfId:original.id,correctionReason:t.reversal_reason },requestId)
        if(posted.status!=='posted')complete=false
      }
      if(complete)await tx.query(`update accounting_posting_registry r set status='superseded',reason_code='DERIVED_REVERSALS_POSTED',
        reason_message='Pembatalan dipenuhi oleh jurnal pembalik setiap sumber asal; tidak ada uang baru.',updated_at=now()
        from accounting_events e where r.event_id=e.id and r.book_id=e.book_id and e.book_id=$1 and e.source_type='financial_transaction'
          and e.source_id=$2 and e.source_version='1' and e.event_kind='cash_reversal' and r.status='pending'`,[book.id,t.id])
      return {status:complete?'posted' as const:'pending' as const,journalId:null}
    }
    pendingReason = { code:'OPENING_SOURCE_MAPPING_REQUIRED',message:'Transaksi asal belum mempunyai jurnal atau mapping saldo awal. Tinjau koreksi saat cutover.' }
  } else if (t.kind === 'customer_receipt') lines = [line('cash','debitMinor',true),line('customer-advance','creditMinor')]
  else if (t.kind === 'vendor_payment') lines = [line('supplier-advance','debitMinor'),line('cash','creditMinor',true)]
  // Settlements of obligations recognised earlier: cash only, never a second revenue/cost adjustment.
  else if (t.kind === 'refund_settlement') lines = [line('refund-payable','debitMinor'),line('cash','creditMinor',true)]
  else if (t.kind === 'vendor_refund') lines = [line('cash','debitMinor',true),line('supplier-claim','creditMinor')]
  // Staff cash is a position held by the employee, not an expense; only approved evidence becomes cost.
  else if (t.kind === 'employee_advance') lines = [line('employee-advance','debitMinor'),line('cash','creditMinor',true)]
  else if (t.kind === 'employee_advance_return') lines = [line('cash','debitMinor',true),line('employee-advance','creditMinor')]
  else if (t.kind === 'employee_reimbursement') lines = [line('reimbursement-payable','debitMinor'),line('cash','creditMinor',true)]
  // Capital and funding: an asset is capitalised (not expensed), a loan is a liability, owner money is equity per entity profile.
  else if (t.kind === 'asset_purchase') lines = [line('fixed-asset','debitMinor'),line('cash','creditMinor',true)]
  else if (t.kind === 'prepaid_opex') {
    if (policy?.settings.method !== 'equal-months') pendingReason = { code:'PREPAID_METHOD_REQUIRED',message:'Validasi metode pembebanan bulanan biaya kantor dibayar di muka.' }
    else lines = [line('prepaid-office','debitMinor'),line('cash','creditMinor',true)]
  }
  else if (t.kind === 'loan_proceeds') lines = [line('cash','debitMinor',true),line('loan','creditMinor')]
  else if (t.kind === 'loan_repayment') {
    const [split] = await tx.query<{ principal_minor:string;interest_minor:string }>('select principal_minor,interest_minor from loan_repayments where transaction_id=$1',[t.id])
    if (!split) pendingReason = { code:'LOAN_SPLIT_REQUIRED',message:'Pisahkan pokok dan bunga cicilan. Pokok pinjaman bukan beban.' }
    else lines = [...(BigInt(split.principal_minor) > 0n ? [{ accountCode:code('loan'),debitMinor:split.principal_minor,creditMinor:'0',...dims }] : []),
      ...(BigInt(split.interest_minor) > 0n ? [{ accountCode:code('finance-cost'),debitMinor:split.interest_minor,creditMinor:'0',...dims }] : []),line('cash','creditMinor',true)]
  } else if (t.kind === 'owner_contribution' || t.kind === 'owner_withdrawal') {
    // Equity vs owner loan depends on the entity form (D02/D09); unknown is never guessed as revenue or expense.
    const role = policy?.settings[t.kind === 'owner_contribution' ? 'contributionRole' : 'withdrawalRole'] as string | undefined
    if (!role || !['capital','owner-funds','loan'].includes(role) || !code(role)) pendingReason = { code:'OWNER_FUNDS_TREATMENT_REQUIRED',message:'Tentukan perlakuan dana owner (modal, prive, atau pinjaman owner) sesuai bentuk usaha.' }
    else lines = t.kind === 'owner_contribution' ? [line('cash','debitMinor',true),line(role,'creditMinor')] : [line(role,'debitMinor'),line('cash','creditMinor',true)]
  }
  else if (t.kind === 'payroll_payment') {
    // Settles the payable per employee booked at approval; never a second salary expense.
    const net = await tx.query<{ employee_id:string;net:string }>(`select employee_id,(base_salary_minor+allowance_minor-deduction_minor)::text as net
      from payroll_lines where payroll_run_id=$1 and base_salary_minor+allowance_minor-deduction_minor > 0 order by employee_id`,[t.payroll_run_id])
    lines = [...net.map(n => ({ accountCode:code('payroll-payable'),debitMinor:n.net,creditMinor:'0',employeeId:n.employee_id })),line('cash','creditMinor',true)]
  }
  else if (t.kind === 'transfer_in') lines = [line('cash','debitMinor',true),line('transfer-clearing','creditMinor')]
  else if (t.kind === 'transfer_out') lines = [line('transfer-clearing','debitMinor'),line('cash','creditMinor',true)]
  else if (t.kind === 'transfer_fee') lines = [line('bank-fee','debitMinor'),line('cash','creditMinor',true)]
  else if (t.kind === 'expense' || t.kind === 'other_income') {
    // A category can mean a prepaid/asset/advance/tax settlement. Outflow alone does not establish expense.
    const classifications = policy?.settings.classifications as Record<string,string> | undefined
    const role = classifications?.[t.kind === 'other_income' ? 'other_income' : t.category]
    if (!role || !code(role)) pendingReason = { code:'CASH_CLASSIFICATION_REQUIRED',message:'Tentukan sifat biaya/dana pada kebijakan sumber. Pembayaran belum otomatis berarti beban atau pendapatan.' }
    else lines = t.direction === 'in' ? [line('cash','debitMinor',true),line(role,'creditMinor')] : [line(role,'debitMinor'),line('cash','creditMinor',true)]
  } else pendingReason = { code:'SOURCE_INTEGRATION_PENDING',message:'Jenis sumber ini belum memiliki integrasi accounting lengkap. Selesaikan integrasi sebelum mengaktifkan tipe transaksi.' }
  return postBusinessEvent(tx,actor,{ sourceType:'financial_transaction',sourceId:t.id,sourceVersion:'1',kind:t.reversal_of_id ? 'cash_reversal' : 'cash_posted',
    effectiveDate:t.effective_date,snapshot:t,policyKind,description:`${t.kind} ${t.id}`,lines,pendingReason },requestId)
}
