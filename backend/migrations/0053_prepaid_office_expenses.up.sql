-- Office prepayments use the existing cash book. The schedule is a service-period fact, never another money ledger.
alter table financial_transactions drop constraint financial_transactions_kind_check;
alter table financial_transactions add constraint financial_transactions_kind_check check (kind in (
  'customer_receipt','vendor_refund','other_income','transfer_in','employee_advance_return','loan_proceeds','owner_contribution',
  'vendor_payment','refund_settlement','expense','transfer_out','transfer_fee','employee_advance','employee_reimbursement',
  'payroll_payment','asset_purchase','loan_repayment','owner_withdrawal','prepaid_opex'));

create table prepaid_expenses (
  id text primary key,
  transaction_id text not null unique references financial_transactions(id),
  description text not null check (length(btrim(description)) between 3 and 200),
  evidence_ref text not null unique check (length(btrim(evidence_ref)) between 3 and 200),
  starts_on date not null check (extract(day from starts_on) = 1),
  months integer not null check (months between 1 and 120),
  method text not null check (method = 'equal-months'),
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);
create trigger prepaid_expenses_immutable before update or delete or truncate on prepaid_expenses
  for each statement execute function accounting_immutable();

create table prepaid_expense_amortizations (
  prepaid_expense_id text not null references prepaid_expenses(id),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_minor bigint not null check (amount_minor > 0),
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  primary key(prepaid_expense_id, period)
);
create trigger prepaid_amortizations_immutable before update or delete or truncate on prepaid_expense_amortizations
  for each statement execute function accounting_immutable();

create function prepaid_expense_source_guard() returns trigger language plpgsql as $$
declare t financial_transactions;
begin
  select * into t from financial_transactions where id=new.transaction_id for update;
  if t.kind <> 'prepaid_opex' or t.reversal_of_id is not null or t.direction <> 'out'
    or t.project_id is not null or t.party_id is not null or t.vendor_id is not null
    or t.effective_date > new.starts_on or t.amount_minor < new.months
    or exists(select 1 from financial_transactions r where r.reversal_of_id=t.id) then
    raise exception 'Prepaid office schedule must match its original company payment' using errcode='23514';
  end if;
  return new;
end $$;
create trigger prepaid_expense_source_guard before insert on prepaid_expenses
  for each row execute function prepaid_expense_source_guard();

-- Even with accounting OFF, every office prepayment has exactly one immutable schedule. A reversal after expense
-- recognition requires a separate correction, not an unbalanced cash cancellation.
create function prepaid_cash_guard() returns trigger language plpgsql as $$
begin
  if new.kind <> 'prepaid_opex' then return new; end if;
  if new.reversal_of_id is null then
    if not exists(select 1 from prepaid_expenses where transaction_id=new.id) then
      raise exception 'Prepaid office payment schedule missing' using errcode='23514';
    end if;
  else
    perform id from prepaid_expenses where transaction_id=new.reversal_of_id for update;
    if exists(select 1 from prepaid_expense_amortizations a join prepaid_expenses p on p.id=a.prepaid_expense_id
      where p.transaction_id=new.reversal_of_id) then
      raise exception 'Amortized prepayment cannot be reversed as cash alone' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create constraint trigger prepaid_cash_guard after insert on financial_transactions
  deferrable initially deferred for each row execute function prepaid_cash_guard();

create function prepaid_amortization_guard() returns trigger language plpgsql as $$
declare p prepaid_expenses; t financial_transactions; idx integer; expected bigint;
begin
  select * into p from prepaid_expenses where id=new.prepaid_expense_id for update;
  select * into t from financial_transactions where id=p.transaction_id;
  idx := (extract(year from (new.period || '-01')::date)-extract(year from p.starts_on))*12
    + extract(month from (new.period || '-01')::date)-extract(month from p.starts_on);
  if idx < 0 or idx >= p.months or exists(select 1 from financial_transactions r where r.reversal_of_id=t.id) then
    raise exception 'Amortization period or source is invalid' using errcode='23514';
  end if;
  expected := case when idx=p.months-1 then t.amount_minor-(t.amount_minor/p.months)*(p.months-1) else t.amount_minor/p.months end;
  if new.amount_minor <> expected then
    raise exception 'Amortization must equal its exact monthly schedule' using errcode='23514';
  end if;
  return new;
end $$;
create trigger prepaid_amortization_guard before insert on prepaid_expense_amortizations
  for each row execute function prepaid_amortization_guard();

create function accounting_prepaid_amortization_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' then return new; end if;
  if not exists(select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
    join accounting_journals j on j.id=r.journal_id and j.status='posted'
    where e.book_id=b.id and e.source_type='prepaid_amortization' and e.source_id=new.prepaid_expense_id || ':' || new.period and r.status='posted') then
    raise exception 'Mandatory prepaid amortization posting missing';
  end if;
  return new;
end $$;
create constraint trigger accounting_prepaid_amortization_mandatory after insert on prepaid_expense_amortizations
  deferrable initially deferred for each row execute function accounting_prepaid_amortization_mandatory();
