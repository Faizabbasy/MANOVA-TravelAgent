-- S6b backfill: Group Trip bookings whose participant DP Finance confirmed before S6b (an issued, non-void invoice
-- on the order) are paid. status_changed_at is set so a later demo re-seed never resets them.
update sales_order_refs s
   set status = 'paid',
       paid_on = i.issue_date,
       status_changed_at = now(),
       updated_at = now()
  from (select sales_order_id, min(issue_date) as issue_date
          from customer_invoices
         where sales_order_id is not null and status = 'issued'
         group by sales_order_id) i
 where i.sales_order_id = s.id
   and s.project_id is not null
   and s.status = 'draft';
