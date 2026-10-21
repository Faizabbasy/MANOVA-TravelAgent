do $$ begin
  if exists(select 1 from vendor_invoices where sales_order_id is not null)
    or exists(select 1 from service_fulfillments where side='supplier' and sales_order_id is not null)
    or exists(select 1 from supplier_claims where sales_order_id is not null)
    or exists(select 1 from financial_transactions where sales_order_id is not null) then
    raise exception 'Retail supplier evidence exists; use forward repair or approved restore';
  end if;
end $$;
drop trigger retail_allocation_scope_guard on payment_allocations;
drop function retail_allocation_scope_guard();
drop trigger retail_company_link_guard on company_expense_invoice_links;
drop function retail_company_link_guard();
drop trigger retail_cash_scope on financial_transactions;
drop trigger retail_vendor_invoice_scope on vendor_invoices;
drop trigger retail_supplier_fulfillment_scope on service_fulfillments;
drop trigger retail_supplier_claim_scope on supplier_claims;
drop function retail_supplier_scope_guard();
alter table service_fulfillments drop constraint supplier_fulfillment_order_scope;
alter table service_fulfillments add constraint supplier_fulfillment_legacy_scope check(side<>'supplier' or (vendor_id is not null and sales_order_id is null));
alter table vendor_invoices drop column sales_order_id;
alter table supplier_claims drop column sales_order_id;
alter table financial_transactions drop column sales_order_id;
