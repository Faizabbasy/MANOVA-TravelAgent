-- Refuses to roll back while debit notes exist: they are issued legal documents and may carry payments.
do $$
begin
  if exists (select 1 from customer_invoices where invoice_type = 'debit_note') then
    raise exception 'debit notes exist; void and archive them before rolling back 0016';
  end if;
end
$$;
drop index if exists customer_invoices_one_per_sales_order;
create unique index customer_invoices_one_per_sales_order on customer_invoices (sales_order_id)
  where sales_order_id is not null and status <> 'void';
drop sequence if exists finance_debit_note_number_seq;
drop index if exists customer_invoices_adjusts;
alter table customer_invoices drop constraint if exists customer_invoices_debit_note_origin;
alter table customer_invoices drop column if exists adjusts_invoice_id;
alter table customer_invoices drop constraint customer_invoices_invoice_type_check;
alter table customer_invoices add constraint customer_invoices_invoice_type_check
  check (invoice_type in ('dp', 'progress', 'final', 'other'));
