do $$ begin
  if exists(select 1 from refunds where sales_order_id is not null) or exists(select 1 from cancellation_policy_assignments where subject_type='sales_order')
    or exists(select 1 from financial_transactions where sales_order_id is not null and project_id is not null) then
    raise exception 'Order cancellation evidence exists; use forward repair or approved restore';
  end if;
end $$;
drop trigger order_cash_scope on financial_transactions;
drop function order_cash_scope_guard();
create trigger retail_cash_scope before insert or update on financial_transactions for each row execute function retail_supplier_scope_guard();
drop trigger order_cancellation_scope on refunds;
drop trigger order_policy_scope on cancellation_policy_assignments;
drop function order_cancellation_scope_guard();
alter table refunds drop constraint refunds_order_subject;
alter table refunds drop constraint refunds_project_or_order;
alter table refunds drop constraint refunds_subject_type_check;
alter table refunds add constraint refunds_subject_type_check check(subject_type in ('project','flight','hotel','transport','mice'));
alter table refunds alter column project_id set not null;
alter table refunds drop column sales_order_id;
alter table cancellation_policy_assignments drop constraint cancellation_assignment_project_or_order;
alter table cancellation_policy_assignments drop constraint cancellation_policy_assignments_subject_type_check;
alter table cancellation_policy_assignments add constraint cancellation_policy_assignments_subject_type_check check(subject_type in ('project','flight','hotel','transport','mice'));
alter table cancellation_policy_assignments alter column project_id set not null;
