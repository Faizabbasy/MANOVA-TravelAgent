import type {Actor} from '../../auth/rbac'
import type {Queryable} from '../../db/client'
import {errors} from '../../http/errors'
import {getBook,type BookRow} from './setup'
import {findPolicy,originalLines,postBusinessEvent,type JournalLine} from './posting'
import {roleCodes} from './recognition'

export async function supplierMatchParentsReady(tx:Queryable,book:BookRow,invoiceId:string,fulfillmentId:string){
  const [r]=await tx.query<{n:string}>(`select count(*) as n from accounting_journals j
    join accounting_events e on e.id=j.event_id join accounting_policies p on p.id=j.policy_id
    where j.book_id=$1 and j.status='posted' and j.reversal_of_id is null and p.settings->>'costMatching'='receipt-links'
      and not exists(select 1 from accounting_journals r where r.reversal_of_id=j.id and r.status='posted')
      and ((e.source_type='vendor_invoice' and e.source_id=$2 and e.event_kind='invoice_recognized'
        and (select coalesce(sum(l.debit_minor-l.credit_minor),0) from accounting_journal_lines l join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code where l.journal_id=j.id and a.control_role='prepaid-trip')=(select total_minor from vendor_invoices where id=$2))
       or (e.source_type='service_fulfillment' and e.source_id=$3 and e.event_kind='source_recorded'
        and (select coalesce(sum(l.credit_minor-l.debit_minor),0) from accounting_journal_lines l join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code where l.journal_id=j.id and a.control_role='accrued-cost')=(select amount_minor from service_fulfillments where id=$3)))`,[book.id,invoiceId,fulfillmentId])
  return Number(r!.n)===2
}

/** Matching reclassifies the already-recorded receipt estimate against the genuine invoice prepayment.
 * The primary invoice creates AP, the receipt creates cost/accrual, and this event clears both exactly once.
 */
export async function postVendorFulfillmentMatch(tx:Queryable,actor:Actor,id:string,requestId:string,voidReason?:string,voidDate?:string){
  const book=await getBook(tx,true)
  if(!book || book.mode==='off')return {status:'off' as const,journalId:null}
  const [m]=await tx.query<Record<string,any>>(`select m.id,m.vendor_invoice_id,m.fulfillment_id,m.actual_minor,m.estimate_minor,m.closes_receipt,m.economic_date,m.posting_date,m.reason,
    i.vendor_id,i.project_id,i.sales_order_id from vendor_fulfillment_matches m join vendor_invoices i on i.id=m.vendor_invoice_id where m.id=$1`,[id])
  if(!m)throw errors.notFound('Pencocokan supplier')
  const date=voidDate ?? m.posting_date
  const policy=await findPolicy(tx,book,'vendor_billing',date)
  let lines:JournalLine[]=[],pendingReason:{code:string;message:string}|undefined,reversalOfId:string|undefined
  if(voidReason){
    const [original]=await tx.query<{id:string}>(`select j.id from accounting_journals j join accounting_events e on e.id=j.event_id where j.book_id=$1 and e.source_type='vendor_fulfillment_match' and e.source_id=$2 and e.event_kind='source_recorded' and j.status='posted'`,[book.id,id])
    if(original){reversalOfId=original.id;lines=await originalLines(tx,original.id)}
    else pendingReason={code:'SOURCE_MATCH_PENDING',message:'Pencocokan asal belum mempunyai jurnal. Proses sumber dan koreksinya sesuai urutan.'}
  }else{
    if(policy?.settings.costMatching!=='receipt-links')pendingReason={code:'SUPPLIER_MATCH_POLICY_REQUIRED',message:'Pilih pencocokan invoice ke penerimaan jasa pada kebijakan supplier. Tidak menggunakan saldo vendor gabungan sebagai pasangan.'}
    else if(!await supplierMatchParentsReady(tx,book,m.vendor_invoice_id,m.fulfillment_id))pendingReason={code:'SOURCE_MATCH_PENDING',message:'Invoice dan penerimaan jasa memerlukan jurnal sumber dengan pencocokan terstruktur. Sumber lama memerlukan review saldo awal/koreksi, bukan diklasifikasi ulang diam-diam.'}
    else{
      const code=await roleCodes(tx,book),estimate=BigInt(m.estimate_minor),actual=BigInt(m.actual_minor),variance=actual-estimate
      const dims={vendorId:m.vendor_id,projectId:m.project_id,salesOrderId:m.sales_order_id}
      lines=[{accountCode:code('accrued-cost'),debitMinor:estimate.toString(),creditMinor:'0',...dims},
        {accountCode:code('prepaid-trip'),debitMinor:'0',creditMinor:actual.toString(),...dims},
        ...(variance===0n?[]:[{accountCode:code('direct-cost'),debitMinor:variance>0n?variance.toString():'0',creditMinor:variance<0n?(-variance).toString():'0',...dims}])]
    }
  }
  return postBusinessEvent(tx,actor,{sourceType:'vendor_fulfillment_match',sourceId:id,sourceVersion:voidReason?'void':'1',kind:voidReason?'source_voided':'source_recorded',effectiveDate:date,
    snapshot:{...m,...(voidReason?{correctionReason:voidReason}:{})},policyKind:'vendor_billing',description:`${voidReason?'Pembatalan':'Pencocokan'} ${m.vendor_invoice_id} → ${m.fulfillment_id}`,lines,pendingReason,reversalOfId,correctionReason:voidReason},requestId)
}
