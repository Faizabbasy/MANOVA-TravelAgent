-- Extend the SAME cancellation cases, credit notes and settlements to participant/standalone orders.
alter table refunds alter column project_id drop not null;
alter table refunds add column sales_order_id text references sales_order_refs(id);
alter table refunds drop constraint refunds_subject_type_check;
alter table refunds add constraint refunds_subject_type_check check(subject_type in ('project','flight','hotel','transport','mice','sales_order'));
alter table refunds add constraint refunds_order_subject check((subject_type='sales_order')=(sales_order_id is not null));
alter table refunds add constraint refunds_project_or_order check(project_id is not null or sales_order_id is not null);
create index refunds_sales_order on refunds(sales_order_id) where sales_order_id is not null;
alter table cancellation_policy_assignments alter column project_id drop not null;
alter table cancellation_policy_assignments drop constraint cancellation_policy_assignments_subject_type_check;
alter table cancellation_policy_assignments add constraint cancellation_policy_assignments_subject_type_check check(subject_type in ('project','flight','hotel','transport','mice','sales_order'));
alter table cancellation_policy_assignments add constraint cancellation_assignment_project_or_order check(project_id is not null or subject_type='sales_order');
create function order_cancellation_scope_guard() returns trigger language plpgsql as $$
declare o sales_order_refs;
begin
  if new.subject_type='sales_order' then
    select * into o from sales_order_refs where id=new.subject_id for update;
    if not found or o.project_id is distinct from new.project_id then raise exception 'Order cancellation scope mismatch' using errcode='23514'; end if;
    if tg_table_name='refunds' then
      if new.sales_order_id is distinct from o.id or new.party_id is distinct from o.party_id then raise exception 'Order refund customer mismatch' using errcode='23514'; end if;
    end if;
  end if;
  if tg_table_name='refunds' then
    if tg_op='UPDATE' and new.sales_order_id is distinct from old.sales_order_id then raise exception 'Refund order attribution is immutable' using errcode='23514'; end if;
  end if;
  return new;
end $$;
create trigger order_cancellation_scope before insert or update on refunds for each row execute function order_cancellation_scope_guard();
create trigger order_policy_scope before insert or update on cancellation_policy_assignments for each row execute function order_cancellation_scope_guard();
drop trigger retail_cash_scope on financial_transactions;
create function order_cash_scope_guard() returns trigger language plpgsql as $$
declare o sales_order_refs;
begin
  if tg_op='UPDATE' and new.sales_order_id is distinct from old.sales_order_id then raise exception 'Cash order attribution is immutable' using errcode='23514'; end if;
  if new.reversal_of_id is not null and new.sales_order_id is distinct from (select sales_order_id from financial_transactions where id=new.reversal_of_id) then
    raise exception 'Cash reversal must preserve its order' using errcode='23514';
  end if;
  if new.sales_order_id is not null then
    select * into o from sales_order_refs where id=new.sales_order_id for update;
    if not found or o.project_id is distinct from new.project_id or (new.party_id is not null and o.party_id is distinct from new.party_id) then
      raise exception 'Cash order scope mismatch' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger order_cash_scope before insert or update on financial_transactions for each row execute function order_cash_scope_guard();
