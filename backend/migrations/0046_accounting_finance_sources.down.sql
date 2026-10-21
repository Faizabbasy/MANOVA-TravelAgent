do $$ begin
  if exists (select 1 from accounting_journals where status='posted') then
    raise exception 'Posted financial evidence exists. Use forward repair or an approved restore.';
  end if;
end $$;
drop trigger accounting_credit_integration_guard on credit_notes;
drop trigger accounting_refund_integration_guard on refunds;
drop function accounting_unsupported_finance_guard();
drop trigger accounting_allocation_mandatory on payment_allocations;
drop function accounting_allocation_mandatory();
drop trigger accounting_vendor_invoice_mandatory on vendor_invoices;
drop trigger accounting_customer_invoice_mandatory on customer_invoices;
drop function accounting_invoice_mandatory();
drop trigger accounting_allocation_date_guard on payment_allocations;
drop function accounting_allocation_date_guard();
alter table payment_allocations drop column effective_date;
