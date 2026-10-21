import type {Actor} from '../../auth/rbac'
import type {Queryable} from '../../db/client'
import {errors} from '../../http/errors'
import {recordAudit} from '../../shared/audit'
import {nextId} from '../../shared/ids'
import {postVendorFulfillmentMatch,supplierMatchParentsReady} from '../accounting/supplier-matching'
import {getBook} from '../accounting/setup'
import {findPolicy,usablePolicy} from '../accounting/posting'
import {parseMovementAmount,todayBusinessDate,rule} from './common'
import {validateEffectiveDate,validateReason} from './postings'
export interface SupplierMatchInput{fulfillmentId:string;actualMinor:string;closesReceipt:boolean;postingDate?:string;reason:string}
export async function supplierMatchWorkspace(tx:Queryable,invoiceId:string){
  const [i]=await tx.query<Record<string,any>>('select * from vendor_invoices where id=$1',[invoiceId])
  if(!i)throw errors.notFound('Invoice supplier')
  const rows=await tx.query<Record<string,any>>(`select m.*,f.fulfilled_on from vendor_fulfillment_matches m join service_fulfillments f on f.id=m.fulfillment_id where m.vendor_invoice_id=$1 order by m.created_at,m.id`,[invoiceId])
  const receipts=await tx.query<Record<string,any>>(`select f.id,f.fulfilled_on,f.amount_minor,f.basis,f.evidence,
    f.amount_minor-coalesce((select sum(m.estimate_minor) from vendor_fulfillment_matches m where m.fulfillment_id=f.id and m.status='recorded'),0) as remaining_minor
    from service_fulfillments f where f.side='supplier' and f.status='recorded' and f.vendor_id=$1 and f.project_id is not distinct from $2 and f.sales_order_id is not distinct from $3
    and ($4::text is null or f.service_order_id=$4) and ($5::text is null or (f.booking_id=$5 and f.booking_type=$6)) order by f.fulfilled_on,f.id limit 101`,[i.vendor_id,i.project_id,i.sales_order_id,i.service_order_id,i.booking_id,i.booking_type])
  const book=await getBook(tx),policy=book?await findPolicy(tx,book,'vendor_billing',i.invoice_date):null
  const used=rows.filter(r=>r.status==='recorded').reduce((n,r)=>n+BigInt(r.actual_minor),0n)
  return {invoiceId,status:i.status,invoiceDate:i.invoice_date,totalMinor:i.total_minor,remainingMinor:(BigInt(i.total_minor)-used).toString(),
    mode:policy?.settings.costMatching==='receipt-links'?'receipt-links':'unconfigured',
    receipts:receipts.slice(0,100).map(f=>({id:f.id,fulfilledOn:f.fulfilled_on,amountMinor:f.amount_minor,remainingMinor:f.remaining_minor,basis:f.basis,evidence:f.evidence})),truncated:receipts.length>100,
    matches:rows.map(m=>({id:m.id,fulfillmentId:m.fulfillment_id,actualMinor:m.actual_minor,estimateMinor:m.estimate_minor,closesReceipt:m.closes_receipt,economicDate:m.economic_date,postingDate:m.posting_date,reason:m.reason,status:m.status,voidReason:m.void_reason}))}
}
export async function matchSupplierReceipt(tx:Queryable,actor:Actor,invoiceId:string,input:SupplierMatchInput,requestId:string){
  const book=await getBook(tx,true),reason=validateReason(input.reason),actual=parseMovementAmount(input.actualMinor,'actualMinor')
  const [i]=await tx.query<Record<string,any>>('select * from vendor_invoices where id=$1 for update',[invoiceId])
  const [f]=await tx.query<Record<string,any>>('select * from service_fulfillments where id=$1 for update',[input.fulfillmentId])
  if(!i)throw errors.notFound('Invoice supplier')
  if(!f)throw errors.notFound('Penerimaan jasa')
  const policy=book?await findPolicy(tx,book,'vendor_billing',i.invoice_date):null
  if(policy?.settings.costMatching!=='receipt-links')throw errors.validation({policy:['Lengkapi kebijakan pencocokan ke penerimaan jasa terlebih dahulu. Profil lama tidak diubah diam-diam.']})
  if(!book || !usablePolicy(book,policy) || !await supplierMatchParentsReady(tx,book,invoiceId,f.id))throw errors.validation({policy:['Selesaikan jurnal sumber dan validasi kebijakannya dahulu. Sumber lama memerlukan review mapping/koreksi; jangan mengulang kas.']})
  if(i.status!=='approved' || f.status!=='recorded' || f.side!=='supplier' || i.vendor_id!==f.vendor_id || i.project_id!==f.project_id || i.sales_order_id!==f.sales_order_id || (i.service_order_id && i.service_order_id!==f.service_order_id) || (i.booking_id && (i.booking_id!==f.booking_id || i.booking_type!==f.booking_type)))throw errors.validation({fulfillmentId:['Pilih penerimaan jasa aktif dari supplier, project/order dan layanan invoice yang sama.']})
  if((await tx.query('select 1 from company_expense_invoice_links where vendor_invoice_id=$1',[invoiceId])).length)throw errors.validation({vendorInvoiceId:['Biaya kantor memakai pencocokan sumber biaya kantor existing.']})
  const [totals]=await tx.query<{actual_used:string;estimate_used:string}>(`select (select coalesce(sum(actual_minor),0) from vendor_fulfillment_matches where vendor_invoice_id=$1 and status='recorded') as actual_used,
    (select coalesce(sum(estimate_minor),0) from vendor_fulfillment_matches where fulfillment_id=$2 and status='recorded') as estimate_used`,[invoiceId,f.id])
  const remaining=BigInt(f.amount_minor)-BigInt(totals!.estimate_used)
  if(remaining<=0n || actual>BigInt(i.total_minor)-BigInt(totals!.actual_used))throw errors.validation({actualMinor:['Melebihi sisa invoice atau penerimaan jasa sudah ditutup.']})
  if(!input.closesReceipt && actual>=remaining)throw errors.validation({closesReceipt:['Konfirmasi tagihan terakhir untuk menutup seluruh sisa estimasi.']})
  if((await tx.query("select 1 from vendor_fulfillment_matches where vendor_invoice_id=$1 and fulfillment_id=$2 and status='recorded'",[invoiceId,f.id])).length)throw errors.conflict('Pasangan sumber ini sudah dicocokkan. Batalkan pencocokan lama untuk koreksi.')
  const estimate=input.closesReceipt?remaining:(actual<remaining?actual:remaining),economicDate=i.invoice_date>f.fulfilled_on?i.invoice_date:f.fulfilled_on
  const date=input.postingDate?validateEffectiveDate(input.postingDate,'postingDate'):economicDate
  if(date<economicDate || date>todayBusinessDate())throw errors.validation({postingDate:['Tanggal pembukuan tidak boleh sebelum invoice/jasa atau di masa depan.']})
  const id=await nextId(tx,'VFM-')
  await tx.query(`insert into vendor_fulfillment_matches(id,vendor_invoice_id,fulfillment_id,actual_minor,estimate_minor,closes_receipt,economic_date,posting_date,reason,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,invoiceId,f.id,actual.toString(),estimate.toString(),input.closesReceipt,economicDate,date,reason,actor.userId])
  await postVendorFulfillmentMatch(tx,actor,id,requestId)
  await recordAudit(tx,{action:'finance.supplier_receipt_matched',actorUserId:actor.userId,entityType:'vendor_invoice',entityId:invoiceId,requestId,reason,after:{matchId:id,fulfillmentId:f.id,actualMinor:actual.toString(),estimateMinor:estimate.toString(),postingDate:date}})
  return supplierMatchWorkspace(tx,invoiceId)
}
export async function voidSupplierMatch(tx:Queryable,actor:Actor,id:string,reasonInput:string,requestId:string){
  await getBook(tx,true)
  const reason=validateReason(reasonInput)
  const [m]=await tx.query<Record<string,any>>('select * from vendor_fulfillment_matches where id=$1 for update',[id])
  if(!m)throw errors.notFound('Pencocokan supplier')
  if(m.status!=='recorded')throw rule('Pencocokan sudah dibatalkan.')
  await tx.query("update vendor_fulfillment_matches set status='void',void_reason=$2,voided_by=$3,voided_at=now() where id=$1",[id,reason,actor.userId])
  await postVendorFulfillmentMatch(tx,actor,id,requestId,reason,todayBusinessDate())
  await recordAudit(tx,{action:'finance.supplier_match_voided',actorUserId:actor.userId,entityType:'vendor_invoice',entityId:m.vendor_invoice_id,requestId,reason,after:{matchId:id}})
  return supplierMatchWorkspace(tx,m.vendor_invoice_id)
}
export async function voidSupplierMatchesForSource(tx:Queryable,actor:Actor,source:'invoice'|'fulfillment',id:string,reason:string,requestId:string){
  const matches=await tx.query<{id:string}>(`select id from vendor_fulfillment_matches where ${source==='invoice'?'vendor_invoice_id':'fulfillment_id'}=$1 and status='recorded' order by id`,[id])
  for(const m of matches)await voidSupplierMatch(tx,actor,m.id,reason,requestId)
}
