import type { Db } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { todayBusinessDate } from '../finance/common'

/** One definition of retail contribution: the same posted lines used by company reports, never cash minus sales. */
export async function orderAccountingSummary(db:Db,salesOrderId:string) {
  if (!ID_PATTERN.test(salesOrderId)) throw errors.notFound('Order')
  return db.transaction(async tx=>{
    const [o]=await tx.query<{project_id:string|null;status:string}>('select project_id,status from sales_order_refs where id=$1',[salesOrderId])
    if (!o) throw errors.notFound('Order')
    const [b]=await tx.query<{id:string;mode:string;purpose:string;opening_validated:boolean}>('select id,mode,purpose,opening_validated from accounting_books where singleton')
    const reasons:{code:string;message:string}[]=[]
    const base={salesOrderId,projectId:o.project_id,status:o.status,asOf:todayBusinessDate()}
    if (!b || b.mode==='off') return {...base,available:false,basis:null,reasons:[{code:'BOOK_OFF',message:'Accounting belum aktif.'}],figures:null}
    if (b.purpose==='rehearsal') reasons.push({code:'REHEARSAL_ONLY',message:'Hasil rehearsal, bukan buku produksi.'})
    if (!b.opening_validated) reasons.push({code:'OPENING_REQUIRED',message:'Saldo awal belum direkonsiliasi.'})
    const [pending]=await tx.query<{n:string}>(`select count(*) as n from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
      where e.book_id=$1 and r.status='pending' and (e.snapshot->>'sales_order_id'=$2 or e.snapshot->>'salesOrderId'=$2)`,[b.id,salesOrderId])
    if (BigInt(pending!.n)>0n) reasons.push({code:'SOURCE_PENDING',message:`${pending!.n} kejadian order menunggu kebijakan atau fakta.`})
    const rows=await tx.query<{role:string;type:string;net:string}>(`select a.control_role as role,a.account_type as type,sum(l.debit_minor-l.credit_minor) as net
      from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted'
      join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
      where l.book_id=$1 and l.sales_order_id=$2 and j.effective_date<=$3 group by a.control_role,a.account_type`,[b.id,salesOrderId,base.asOf])
    const by=(role:string)=>BigInt(rows.find(r=>r.role===role)?.net ?? '0')
    const revenue=-rows.filter(r=>r.type==='revenue').reduce((n,r)=>n+BigInt(r.net),0n),cost=by('direct-cost')
    if (by('accrued-cost')<0n) reasons.push({code:'ACCRUAL_UNMATCHED',message:'Biaya supplier belum seluruhnya diganti invoice aktual.'})
    if (by('contract-liability')<0n) reasons.push({code:'SERVICE_NOT_DELIVERED',message:'Sebagian tagihan belum menjadi pendapatan karena jasa belum diberikan.'})
    return {...base,available:true,basis:b.purpose==='rehearsal' ? 'rehearsal' : 'recognized',reasons,
      figures:{revenueMinor:revenue.toString(),directCostMinor:cost.toString(),contributionMinor:(revenue-cost).toString(),
        receivableMinor:by('receivable').toString(),payableMinor:(-by('payable')).toString(),accruedCostMinor:(-by('accrued-cost')).toString(),
        prepaidCostMinor:by('prepaid-trip').toString(),supplierClaimMinor:by('supplier-claim').toString()}}
  })
}
