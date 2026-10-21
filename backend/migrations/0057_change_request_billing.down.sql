do $$ begin
  if exists(select 1 from change_billing_plans) then raise exception 'Commercial billing evidence exists; use forward repair or approved restore'; end if;
end $$;
drop trigger change_billing_invoice_guard on customer_invoices;
drop function change_billing_invoice_guard();
drop trigger change_billing_cr_guard on change_requests;
drop function change_billing_cr_guard();
alter table customer_invoices drop column change_billing_allocation_id;
drop table change_billing_amendments;
drop table change_billing_allocations;
drop function change_billing_scope_guard();
drop function change_billing_allocation_guard();
drop table change_billing_plans;
drop function change_billing_complete();
drop function change_billing_plan_guard();
