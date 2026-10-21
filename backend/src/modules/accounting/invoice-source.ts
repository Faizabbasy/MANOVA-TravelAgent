import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { findPolicy,originalLines,postBusinessEvent,type JournalLine } from './posting'
import { openingCovers } from './opening'
import { roleBalance } from './recognition'
import { getBook } from './setup'
import { companyInvoiceLines } from './company-expenses'

export async function postInvoiceSource(tx:Queryable,actor:Actor,type:'customer_invoice'|'vendor_invoice',id:string,date:string,requestId:string,reversalReason?:string) {
  const book = await getBook(tx,true)
  if (!book || book.mode === 'off') return
  if (date < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Invoice baru sebelum cutover memerlukan koreksi saldo awal yang dapat ditelusuri.')
    return
  }
  const isCustomer = type === 'customer_invoice'
  // Whitelisted table choice; snapshot uses only frozen economic fields, not updated_at/status metadata.
  const [i] = await tx.query<Record<string,any>>(isCustomer
    ? 'select id,total_minor,currency,project_id,party_id,sales_order_id,issue_date from customer_invoices where id=$1'
    : 'select id,total_minor,currency,project_id,sales_order_id,vendor_id,invoice_date from vendor_invoices where id=$1',[id])
  if (!i) throw errors.notFound('Invoice sumber')
  if (!isCustomer && !i.sales_order_id) delete i.sales_order_id
  const companyLink = !isCustomer && (await tx.query('select 1 from company_expense_invoice_links where vendor_invoice_id=$1',[id])).length>0
  const policyKind = companyLink ? 'company_expense' : isCustomer ? 'customer_billing' : 'vendor_billing'
  let lines:JournalLine[] = [],reversalOfId:string|undefined,pendingReason:{code:string;message:string}|undefined
  if (reversalReason) {
    const [original] = await tx.query<{ id:string }>(`select j.id from accounting_journals j join accounting_events e on e.id=j.event_id
      where j.book_id=$1 and e.source_type=$2 and e.source_id=$3 and e.event_kind='invoice_recognized' and j.status='posted'`,[book.id,type,id])
    if (original) { reversalOfId = original.id;lines = await originalLines(tx,original.id) }
    else pendingReason = { code:'OPENING_SOURCE_MAPPING_REQUIRED',message:'Invoice asal belum memiliki jurnal atau mapping saldo awal. Tinjau koreksi cutover.' }
  } else {
    const p = await findPolicy(tx,book,policyKind,date)
    const roles = await tx.query<{ code:string;control_role:string }>('select code,control_role from accounting_accounts where book_id=$1',[book.id])
    const map = new Map(roles.map(a => [a.control_role,a.code]))
    const dims = { projectId:i.project_id,salesOrderId:i.sales_order_id ?? null,partyId:i.party_id ?? null,vendorId:i.vendor_id ?? null }
    const total = BigInt(i.total_minor)
    const l = (role:string,debit:boolean,amount = total):JournalLine => ({ accountCode:map.get(role) ?? '',debitMinor:debit ? amount.toString() : '0',creditMinor:debit ? '0' : amount.toString(),...dims })
    if (companyLink) {
      const derived = (await companyInvoiceLines(tx,id,date,total))!
      lines = derived.lines; pendingReason = derived.pendingReason
    } else if (isCustomer && p?.principal_agent === 'principal' && p.settings.billingRight === 'unconditional' && p.recognition === 'fulfillment') {
      // Service already delivered before billing sits in contract asset: reclass it to AR, the rest is deferred.
      const unbilled = await roleBalance(tx,book,'contract-asset',dims,date)
      const reclass = unbilled > 0n ? (unbilled < total ? unbilled : total) : 0n
      lines = [l('receivable',true),...(reclass > 0n ? [l('contract-asset',false,reclass)] : []),...(total > reclass ? [l('contract-liability',false,total - reclass)] : [])]
    } else if (!isCustomer && p?.settings.invoiceTreatment === 'prepaid' && p.recognition === 'supplier-fulfillment' && p.settings.costMatching === 'receipt-links') {
      // Each receipt is linked explicitly later. Invoice chronology never guesses which service was received.
      lines = [l('prepaid-trip',true),l('payable',false)]
    } else if (!isCustomer && book.purpose === 'rehearsal' && p?.validation_status === 'test-only' && p.settings.invoiceTreatment === 'prepaid' && p.recognition === 'supplier-fulfillment') {
      // Clear an authorised accrual first. Once the vendor's service is final, only the difference is extra cost
      // (or a cost reduction); before that the remainder is prepaid until the service is received.
      const accrued = -(await roleBalance(tx,book,'accrued-cost',dims,date))
      const [final] = await tx.query(`select 1 from service_fulfillments where side='supplier' and status='recorded' and is_final
        and vendor_id=$1 and project_id is not distinct from $2 and sales_order_id is not distinct from $4 and fulfilled_on <= $3 limit 1`,[i.vendor_id,i.project_id,date,i.sales_order_id ?? null])
      const cleared = accrued > 0n ? (final || accrued < total ? accrued : total) : 0n
      const rest = total - cleared
      lines = [...(cleared > 0n ? [l('accrued-cost',true,cleared)] : []),
        ...(rest > 0n ? [l(final ? 'direct-cost' : 'prepaid-trip',true,rest)] : []),
        l('payable',false),...(rest < 0n ? [l('direct-cost',false,-rest)] : [])]
    } else pendingReason = { code:'INVOICE_POLICY_REQUIRED',message:'Tentukan hak tagih dan pemenuhan jasa pada kontrak/sumber. Invoice tidak otomatis menjadi pendapatan atau biaya.' }
  }
  return postBusinessEvent(tx,actor,{ sourceType:type,sourceId:id,sourceVersion:reversalReason ? 'void' : '1',kind:reversalReason ? 'invoice_voided' : 'invoice_recognized',
    effectiveDate:date,snapshot:{ ...i,...(reversalReason ? { correctionReason:reversalReason } : {}) },policyKind,description:`${reversalReason ? 'Pembatalan' : 'Penagihan'} ${id}`,
    lines,pendingReason,reversalOfId,correctionReason:reversalReason },requestId)
}

export async function postAllocationSource(tx:Queryable,actor:Actor,id:string,requestId:string) {
  const book = await getBook(tx,true)
  if (!book || book.mode === 'off') return
  const [a] = await tx.query<Record<string,any>>(`select a.id::text,a.transaction_id,a.target_type,a.target_id,a.amount_minor,a.effective_date,
    t.party_id,t.vendor_id,t.project_id from payment_allocations a join financial_transactions t on t.id=a.transaction_id where a.id=$1::bigint`,[id])
  if (!a) throw errors.notFound('Alokasi sumber')
  if (!a.effective_date) throw errors.validation({ effectiveDate:['Alokasi memerlukan tanggal efektif.'] })
  if (a.effective_date < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Alokasi sebelum cutover memerlukan mapping saldo awal yang tervalidasi.')
    return
  }
  const customer = a.target_type === 'customer_invoice'
  const policyKind = customer ? 'customer_allocation' : 'vendor_allocation'
  const [invoice] = await tx.query<Record<string,any>>(customer
    ? 'select project_id,party_id,sales_order_id,issue_date as date from customer_invoices where id=$1'
    : 'select project_id,sales_order_id,vendor_id,invoice_date as date from vendor_invoices where id=$1',[a.target_id])
  if (!invoice) throw errors.notFound('Invoice alokasi')
  if (invoice.date > a.effective_date) throw errors.validation({ effectiveDate:['Alokasi tidak boleh sebelum tanggal invoice.'] })
  // A pre-cutover receipt/payment or invoice is represented by the confirmed opening: settle it as a delta, never replay it.
  const booked = async (type:string,sourceId:string) => (await tx.query('select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id where e.book_id=$1 and e.source_type=$2 and e.source_id=$3 and r.status=$4',[book.id,type,sourceId,'posted'])).length > 0
    || openingCovers(tx,book.id,type,sourceId)
  const sourceJournal = await booked('financial_transaction',a.transaction_id)
  const invoiceJournal = await booked(a.target_type,a.target_id)
  const roles = await tx.query<{ code:string;control_role:string }>('select code,control_role from accounting_accounts where book_id=$1',[book.id])
  const map = new Map(roles.map(r => [r.control_role,r.code]))
  // AR/AP belongs to the invoice project/order, while unallocated advances keep the ORIGINAL cash dimensions.
  const cashDims = { projectId:a.project_id,partyId:a.party_id,vendorId:a.vendor_id }
  const invoiceDims = { projectId:invoice.project_id,salesOrderId:invoice.sales_order_id ?? null,partyId:invoice.party_id ?? null,vendorId:invoice.vendor_id ?? null }
  const lines:JournalLine[] = customer ? [
    { accountCode:map.get('customer-advance')!,debitMinor:a.amount_minor,creditMinor:'0',...cashDims },
    { accountCode:map.get('receivable')!,debitMinor:'0',creditMinor:a.amount_minor,...invoiceDims }
  ] : [
    { accountCode:map.get('payable')!,debitMinor:a.amount_minor,creditMinor:'0',...invoiceDims },
    { accountCode:map.get('supplier-advance')!,debitMinor:'0',creditMinor:a.amount_minor,...cashDims }
  ]
  return postBusinessEvent(tx,actor,{ sourceType:'payment_allocation',sourceId:id,sourceVersion:'1',kind:'payment_allocated',effectiveDate:a.effective_date,
    snapshot:a,policyKind,description:`Alokasi ${a.transaction_id} ke ${a.target_id}`,lines,
    ...(!sourceJournal || !invoiceJournal ? { pendingReason:{ code:'OPENING_SOURCE_MAPPING_REQUIRED',message:'Receipt/payment atau invoice belum mempunyai jurnal/mapping saldo awal. Selesaikan sumber asal; jangan mengulang kas.' } } : {}) },requestId)
}
