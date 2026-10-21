-- Approved commercial changes create ordinary invoice drafts from an explicit source allocation.
-- Approval/draft creation never moves cash or recognises revenue.
create table change_billing_plans (
  id text primary key, change_request_id text not null references change_requests(id),
  mode text not null check(mode in ('charge','no-charge')),
  basis text not null check(basis in ('commercial','fee','separate','none')),
  commercial_minor bigint not null check(commercial_minor between 0 and 1000000000000000), fee_minor bigint not null check(fee_minor between 0 and 1000000000000000),
  total_minor bigint not null check(total_minor between 0 and 1000000000000000),
  reason text not null check(length(btrim(reason)) between 5 and 500),
  status text not null default 'draft' check(status in ('draft','applied','void')),
  applied_at timestamptz, void_reason text, voided_by text references users(id),
  created_by text not null references users(id), created_at timestamptz not null default now(),
  check((mode='charge' and basis<>'none' and total_minor>0) or (mode='no-charge' and basis='none' and total_minor=0)),
  check(mode='no-charge' or total_minor=case basis when 'commercial' then commercial_minor when 'fee' then fee_minor when 'separate' then commercial_minor+fee_minor end),
  check((status='void')=(void_reason is not null and voided_by is not null))
);
create unique index change_billing_one_active on change_billing_plans(change_request_id) where status<>'void';
create table change_billing_allocations (
  id text primary key, plan_id text not null references change_billing_plans(id),
  project_id text not null references projects(id), sales_order_id text references sales_order_refs(id), party_id text not null references parties(id),
  amount_minor bigint not null check(amount_minor between 1 and 1000000000000000), due_date date not null,
  adjusts_invoice_id text references customer_invoices(id),
  invoice_id text unique -- Historical ID retained if an unissued draft is deleted when its plan is voided.
);
create unique index change_billing_target on change_billing_allocations(plan_id,coalesce(sales_order_id,''));
alter table customer_invoices add column change_billing_allocation_id text unique references change_billing_allocations(id);
create table change_billing_amendments (
  allocation_id text not null references change_billing_allocations(id), kind text not null check(kind in ('apply','reverse')),
  before_minor bigint not null, after_minor bigint not null,
  created_by text not null references users(id),created_at timestamptz not null default now(), primary key(allocation_id,kind)
);
create trigger change_amendment_immutable before update or delete or truncate on change_billing_amendments for each statement execute function accounting_immutable();
create function change_billing_plan_guard() returns trigger language plpgsql as $$ begin
  if tg_op<>'UPDATE' or old.status='void' or new.status not in ('applied','void') or new.status=old.status
    or (to_jsonb(old)-'status'-'applied_at'-'void_reason'-'voided_by') is distinct from (to_jsonb(new)-'status'-'applied_at'-'void_reason'-'voided_by') then
    raise exception 'Billing plan facts are immutable; void with a reason and create a revised plan';
  end if;
  return new;
end $$;
create trigger change_billing_plan_guard before update or delete on change_billing_plans for each row execute function change_billing_plan_guard();
create trigger change_billing_plan_no_truncate before truncate on change_billing_plans for each statement execute function accounting_immutable();
create function change_billing_allocation_guard() returns trigger language plpgsql as $$ begin
  if tg_op<>'UPDATE' or old.invoice_id is not null or new.invoice_id is null
    or (to_jsonb(old)-'invoice_id') is distinct from (to_jsonb(new)-'invoice_id') then raise exception 'Billing allocation facts are immutable'; end if;
  return new;
end $$;
create trigger change_billing_allocation_guard before update or delete on change_billing_allocations for each row execute function change_billing_allocation_guard();
create trigger change_billing_allocation_no_truncate before truncate on change_billing_allocations for each statement execute function accounting_immutable();
create function change_billing_cr_guard() returns trigger language plpgsql as $$ begin
  if (coalesce(new.commercial_impact_minor,0) is distinct from coalesce(old.commercial_impact_minor,0) or coalesce(new.cancellation_fee_minor,0) is distinct from coalesce(old.cancellation_fee_minor,0))
    and exists(select 1 from change_billing_plans where change_request_id=old.id and status<>'void') then
    raise exception 'Void the source billing plan before changing commercial facts' using errcode='23514';
  end if;
  return new;
end $$;
create trigger change_billing_cr_guard before update on change_requests for each row execute function change_billing_cr_guard();
create function change_billing_invoice_guard() returns trigger language plpgsql as $$
declare a change_billing_allocations; p change_billing_plans;
begin
  if tg_op='DELETE' then
    if old.change_billing_allocation_id is not null and exists(select 1 from change_billing_allocations x join change_billing_plans h on h.id=x.plan_id where x.id=old.change_billing_allocation_id and h.status<>'void') then
      raise exception 'Void the commercial source plan before removing its draft' using errcode='23514';
    end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.change_billing_allocation_id is distinct from new.change_billing_allocation_id then raise exception 'Invoice commercial source is immutable'; end if;
  if new.change_billing_allocation_id is null then return new; end if;
  select * into a from change_billing_allocations where id=new.change_billing_allocation_id;
  select * into p from change_billing_plans where id=a.plan_id;
  if (tg_op='INSERT' and p.status='void') or a.party_id is distinct from new.party_id or a.project_id is distinct from new.project_id
    or a.sales_order_id is distinct from new.sales_order_id or a.amount_minor<>new.total_minor
    or a.adjusts_invoice_id is distinct from new.adjusts_invoice_id or a.due_date is distinct from new.due_date or new.booking_id is not null then
    raise exception 'Invoice must retain its approved commercial allocation facts' using errcode='23514';
  end if;
  return new;
end $$;
create trigger change_billing_invoice_guard before insert or update or delete on customer_invoices for each row execute function change_billing_invoice_guard();
create function change_billing_scope_guard() returns trigger language plpgsql as $$
declare p change_billing_plans; cr change_requests; o sales_order_refs; customer text; origin customer_invoices;
begin
  select * into p from change_billing_plans where id=new.plan_id;
  select * into cr from change_requests where id=p.change_request_id;
  if p.status<>'draft' or new.project_id is distinct from cr.project_id then raise exception 'Invalid commercial allocation project' using errcode='23514'; end if;
  if new.sales_order_id is not null then
    select * into o from sales_order_refs where id=new.sales_order_id;
    if not found or o.project_id is distinct from new.project_id then raise exception 'Commercial order scope mismatch' using errcode='23514'; end if;
    customer:=o.party_id;
  else select party_id into customer from projects where id=new.project_id;
  end if;
  if customer is distinct from new.party_id then raise exception 'Commercial customer scope mismatch' using errcode='23514'; end if;
  if new.adjusts_invoice_id is not null then
    select * into origin from customer_invoices where id=new.adjusts_invoice_id;
    if origin.status<>'issued' or origin.project_id is distinct from new.project_id or origin.party_id is distinct from new.party_id
      or origin.sales_order_id is distinct from new.sales_order_id then raise exception 'Invalid commercial base invoice' using errcode='23514'; end if;
  end if;
  return new;
end $$;
create trigger change_billing_scope_guard before insert on change_billing_allocations for each row execute function change_billing_scope_guard();
create function change_billing_complete() returns trigger language plpgsql as $$
declare p change_billing_plans; cr change_requests; n bigint; total numeric;
begin
  if tg_table_name='change_billing_plans' then select * into p from change_billing_plans where id=new.id;
  else select * into p from change_billing_plans where id=new.plan_id;
  end if;
  if p.status='void' then return new; end if;
  select * into cr from change_requests where id=p.change_request_id;
  select count(*),coalesce(sum(amount_minor),0) into n,total from change_billing_allocations where plan_id=p.id;
  if p.commercial_minor<>coalesce(cr.commercial_impact_minor,0) or p.fee_minor<>coalesce(cr.cancellation_fee_minor,0)
    or total<>p.total_minor or (p.mode='charge' and n=0) or (p.mode='no-charge' and n<>0) then
    raise exception 'Commercial source totals and allocations must reconcile' using errcode='23514';
  end if;
  if p.status='applied' then
    if cr.status not in ('approved','implemented') or exists(select 1 from change_billing_allocations a where a.plan_id=p.id and
      (not exists(select 1 from customer_invoices i where i.id=a.invoice_id and i.change_billing_allocation_id=a.id)
       or not exists(select 1 from change_billing_amendments m where m.allocation_id=a.id and m.kind='apply' and m.after_minor-m.before_minor=a.amount_minor))) then
      raise exception 'Approved amendment and source invoice draft required' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create constraint trigger change_billing_complete after insert or update on change_billing_plans deferrable initially deferred for each row execute function change_billing_complete();
create constraint trigger change_billing_allocations_complete after insert or update on change_billing_allocations deferrable initially deferred for each row execute function change_billing_complete();
