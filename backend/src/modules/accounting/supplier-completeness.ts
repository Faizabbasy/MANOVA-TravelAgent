import type {Queryable} from '../../db/client'
import type {BookRow} from './setup'

/** Shared by company reports, project results and monthly review. An unrelated invoice never hides an estimate. */
export async function unmatchedSupplierEstimates(tx:Queryable,book:Pick<BookRow,'id'|'timezone'>,end:string,projectId?:string){
  const [r]=await tx.query<{n:string;total:string}>(`select count(*) as n,coalesce(sum(remaining),0) as total from (select f.*,
    case when exists(select 1 from accounting_events e join accounting_journals j on j.event_id=e.id and j.status='posted'
      join accounting_policies p on p.id=j.policy_id where e.book_id=$3 and e.source_type='service_fulfillment' and e.source_id=f.id and e.event_kind='source_recorded' and p.settings->>'costMatching'='receipt-links')
    then f.amount_minor-coalesce((select sum(m.estimate_minor) from vendor_fulfillment_matches m where m.fulfillment_id=f.id and m.posting_date<=$1
      and (m.status='recorded' or (m.voided_at at time zone $2)::date>$1::date)),0)
    else case when exists(select 1 from vendor_invoices v where v.vendor_id=f.vendor_id and v.project_id is not distinct from f.project_id and v.sales_order_id is not distinct from f.sales_order_id
      and v.status='approved' and v.invoice_date<=$1) then 0 else f.amount_minor end end as remaining
    from service_fulfillments f where ($4::text is null or f.project_id=$4)) f
    where f.side='supplier' and (f.status='recorded' or (f.voided_at at time zone $2)::date>$1::date) and f.basis='estimate' and f.fulfilled_on<=$1 and f.remaining>0`,[end,book.timezone,book.id,projectId ?? null])
  return r!
}
