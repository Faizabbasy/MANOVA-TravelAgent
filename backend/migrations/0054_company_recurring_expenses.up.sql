-- Plans are not invoices or cash. Actual incurred expenses accrue; genuine existing vendor invoices replace the accrual.
do $$ begin
  if exists(select 1 from accounting_accounts where (code='2115' or control_role='company-accrued')
    and (code<>'2115' or control_role is distinct from 'company-accrued' or account_type<>'liability' or required_dimension is distinct from 'vendor')) then
    raise exception 'Account 2115/company-accrued conflicts with the existing chart; review mapping before migration';
  end if;
end $$;
insert into accounting_accounts(book_id,code,name,account_type,control_role,required_dimension)
  select id,'2115','Biaya kantor belum ditagih','liability','company-accrued','vendor' from accounting_books on conflict do nothing;
create table company_expense_schedules (
  id text primary key,
  vendor_id text not null references vendors(id),
  description text not null check(length(btrim(description)) between 3 and 200),
  contract_ref text not null unique check(length(btrim(contract_ref)) between 3 and 200),
  category text not null check(category in ('office','marketing','utilities','other')),
  amount_minor bigint not null check(amount_minor between 1 and 1000000000000000),
  starts_on date not null check(extract(day from starts_on)=1),
  months integer not null check(months between 1 and 120),
  due_day integer not null check(due_day between 1 and 28),
  stops_on date check(extract(day from stops_on)=1 and stops_on >= starts_on),
  stop_reason text, stopped_by text references users(id),
  created_by text not null references users(id), created_at timestamptz not null default now(),
  check((stops_on is null and stop_reason is null and stopped_by is null) or (stops_on is not null and length(btrim(stop_reason))>=5 and stopped_by is not null))
);
create function company_schedule_guard() returns trigger language plpgsql as $$
begin
  if tg_op <> 'UPDATE' or old.stops_on is not null or new.stops_on is null
    or (to_jsonb(old)-'stops_on'-'stop_reason'-'stopped_by') is distinct from (to_jsonb(new)-'stops_on'-'stop_reason'-'stopped_by') then
    raise exception 'Recurring schedule facts are immutable; stop remaining plans with a reason';
  end if;
  return new;
end $$;
create trigger company_schedule_guard before update or delete on company_expense_schedules for each row execute function company_schedule_guard();
create trigger company_schedule_no_truncate before truncate on company_expense_schedules for each statement execute function accounting_immutable();

create table company_expenses (
  id text primary key, vendor_id text not null references vendors(id),
  schedule_id text references company_expense_schedules(id), period text check(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  description text not null check(length(btrim(description)) between 3 and 200),
  category text not null check(category in ('office','marketing','utilities','other')),
  amount_minor bigint not null check(amount_minor between 1 and 1000000000000000),
  incurred_on date not null, due_date date not null,
  evidence_ref text not null unique check(length(btrim(evidence_ref)) between 3 and 200),
  basis text not null check(basis in ('estimate','actual')),
  status text not null default 'recorded' check(status in ('recorded','void')),
  void_reason text, voided_on date, voided_by text references users(id),
  created_by text not null references users(id), created_at timestamptz not null default now(),
  check((schedule_id is null)=(period is null)),
  check((status='recorded' and void_reason is null and voided_on is null and voided_by is null)
    or (status='void' and length(btrim(void_reason))>=5 and voided_on>=incurred_on and voided_by is not null))
);
create unique index company_expense_occurrence on company_expenses(schedule_id,period) where status='recorded';
create table company_expense_invoice_links (
  vendor_invoice_id text primary key references vendor_invoices(id), expense_id text not null references company_expenses(id),
  created_by text not null references users(id), created_at timestamptz not null default now()
);
create index company_expense_link_expense on company_expense_invoice_links(expense_id);
create trigger company_expense_link_immutable before update or delete or truncate on company_expense_invoice_links for each statement execute function accounting_immutable();
create function company_expense_guard() returns trigger language plpgsql as $$
declare s company_expense_schedules;
begin
  if tg_op='DELETE' then raise exception 'Company expense is immutable; void with a reason'; end if;
  if tg_op='UPDATE' then
    if old.status<>'recorded' or new.status<>'void'
      or (to_jsonb(old)-'status'-'void_reason'-'voided_on'-'voided_by') is distinct from (to_jsonb(new)-'status'-'void_reason'-'voided_on'-'voided_by') then
      raise exception 'Company expense facts are immutable';
    end if;
    if exists(select 1 from company_expense_invoice_links l join vendor_invoices v on v.id=l.vendor_invoice_id
      where l.expense_id=old.id and v.status not in ('void','rejected')) then raise exception 'Void the linked invoice before the expense'; end if;
  elsif new.schedule_id is not null then
    select * into s from company_expense_schedules where id=new.schedule_id for update;
    if s.vendor_id<>new.vendor_id or s.category<>new.category or to_char(new.incurred_on,'YYYY-MM')<>new.period
      or (new.period || '-01')::date<s.starts_on or (new.period || '-01')::date>=s.starts_on+make_interval(months=>s.months)
      or (s.stops_on is not null and (new.period || '-01')::date>=s.stops_on) then raise exception 'Expense must match its active schedule occurrence' using errcode='23514'; end if;
  end if;
  return new;
end $$;
create trigger company_expense_guard before insert or update or delete on company_expenses for each row execute function company_expense_guard();
create trigger company_expense_no_truncate before truncate on company_expenses for each statement execute function accounting_immutable();
create function company_expense_link_guard() returns trigger language plpgsql as $$
declare e company_expenses; v vendor_invoices;
begin
  select * into e from company_expenses where id=new.expense_id for update;
  select * into v from vendor_invoices where id=new.vendor_invoice_id for update;
  if e.status<>'recorded' or v.status not in ('submitted','under_review') or e.vendor_id<>v.vendor_id or v.project_id is not null
    or v.booking_id is not null or v.service_order_id is not null or v.invoice_date<e.incurred_on
    or exists(select 1 from company_expense_invoice_links l join vendor_invoices i on i.id=l.vendor_invoice_id
      where l.expense_id=e.id and i.status not in ('void','rejected')) then
    raise exception 'Company expense invoice must be an unapproved matching company vendor invoice' using errcode='23514';
  end if;
  return new;
end $$;
create trigger company_expense_link_guard before insert on company_expense_invoice_links for each row execute function company_expense_link_guard();
create function accounting_company_expense_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' then return new; end if;
  if not exists(select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
    join accounting_journals j on j.id=r.journal_id and j.status='posted'
    where e.book_id=b.id and e.source_type='company_expense' and e.source_id=new.id
      and e.event_kind=case when new.status='void' then 'source_voided' else 'source_recorded' end and r.status='posted') then
    raise exception 'Mandatory company expense posting missing';
  end if;
  return new;
end $$;
create constraint trigger accounting_company_expense_mandatory after insert or update on company_expenses deferrable initially deferred
  for each row execute function accounting_company_expense_mandatory();
create view v_company_expense_forecast as
 select s.id || ':' || to_char(m.day,'YYYY-MM') as id,s.id as schedule_id,null::text as expense_id,s.vendor_id,s.description,s.amount_minor,
   (m.day+(s.due_day-1)*interval '1 day')::date as due_date,(m.day+interval '1 month - 1 day')::date as service_date,true as planned
 from company_expense_schedules s cross join lateral generate_series(0,s.months-1) n
 cross join lateral (select s.starts_on+make_interval(months=>n) as day) m
 where (s.stops_on is null or m.day<s.stops_on) and not exists(select 1 from company_expenses e
   where e.schedule_id=s.id and e.period=to_char(m.day,'YYYY-MM') and e.status='recorded')
 union all
 select e.id,e.schedule_id,e.id,e.vendor_id,e.description,e.amount_minor,e.due_date,e.incurred_on,false
 from company_expenses e where e.status='recorded' and not exists(select 1 from company_expense_invoice_links l
   join vendor_invoices v on v.id=l.vendor_invoice_id where l.expense_id=e.id and v.status='approved');
