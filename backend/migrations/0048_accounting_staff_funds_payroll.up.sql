-- Owner accounting F5: staff advances (kasbon), expense claims and reimbursements, and payroll paid only through
-- a real cash settlement. One cash book: new kinds in financial_transactions, never a second ledger.

alter table financial_transactions add column employee_id text references employees (id);
alter table financial_transactions add column payroll_run_id text references payroll_runs (id);

alter table financial_transactions drop constraint financial_transactions_kind_check;
alter table financial_transactions add constraint financial_transactions_kind_check check (kind in (
  'customer_receipt', 'vendor_refund', 'other_income', 'transfer_in', 'employee_advance_return',
  'vendor_payment', 'refund_settlement', 'expense', 'transfer_out', 'transfer_fee',
  'employee_advance', 'employee_reimbursement', 'payroll_payment'));
alter table financial_transactions drop constraint financial_transactions_direction_matches_kind;
alter table financial_transactions add constraint financial_transactions_direction_matches_kind check (
  (reversal_of_id is null) = (direction = case
    when kind in ('customer_receipt', 'vendor_refund', 'other_income', 'transfer_in', 'employee_advance_return') then 'in'
    else 'out' end));
-- Staff money always names the employee; payroll money always names its run (and nothing else claims them).
alter table financial_transactions add constraint financial_transactions_employee_link check (
  (kind in ('employee_advance', 'employee_reimbursement', 'employee_advance_return')) = (employee_id is not null));
alter table financial_transactions add constraint financial_transactions_payroll_link check (
  (kind = 'payroll_payment') = (payroll_run_id is not null));
create index financial_transactions_employee_idx on financial_transactions (employee_id) where employee_id is not null;
-- One standing payment per run is enforced by the payroll service under the run's row lock (a reversed payment may be redone).
create index financial_transactions_payroll_idx on financial_transactions (payroll_run_id) where payroll_run_id is not null;

-- Proof of what an employee spent from a kasbon (or out of pocket). One receipt can be claimed once.
create table employee_expense_claims (
  id            text primary key,
  employee_id   text not null references employees (id),
  project_id    text references projects (id),
  category      text not null check (category in ('trip', 'payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other')),
  amount_minor  bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  spent_on      date not null,
  evidence_ref  text not null check (length(btrim(evidence_ref)) between 3 and 120),
  description   text not null check (length(btrim(description)) between 3 and 500),
  status        text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason   text,
  voided_by     text references users (id),
  voided_at     timestamptz,
  created_by    text not null references users (id),
  created_at    timestamptz not null default now(),
  -- A trip cost belongs to its project; company-only costs use a company category.
  check ((category = 'trip') = (project_id is not null)),
  check ((status = 'void') = (void_reason is not null and voided_at is not null and voided_by is not null))
);
create unique index employee_expense_claims_evidence_once on employee_expense_claims (lower(btrim(evidence_ref))) where status = 'recorded';
create index employee_expense_claims_employee on employee_expense_claims (employee_id, spent_on);

create function employee_expense_claims_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Expense claim evidence is immutable; void it instead'; end if;
  if old.status = 'void' or new.status <> 'void' or (to_jsonb(new) - array['status','void_reason','voided_by','voided_at'])
      is distinct from (to_jsonb(old) - array['status','void_reason','voided_by','voided_at']) then
    raise exception 'Expense claim evidence is immutable; void it instead';
  end if;
  return new;
end $$;
create trigger employee_expense_claims_guard before update or delete on employee_expense_claims
  for each row execute function employee_expense_claims_guard();
create trigger employee_expense_claims_no_truncate before truncate on employee_expense_claims
  for each statement execute function accounting_immutable();

-- Net staff position: > 0 the employee still holds company cash; < 0 the company owes a reimbursement.
create view v_employee_fund_balances as
  select e.id as employee_id,
         coalesce((select sum(case when t.kind = 'employee_advance_return' then -t.amount_minor else t.amount_minor end)
                     from financial_transactions t
                    where t.employee_id = e.id and t.reversal_of_id is null
                      and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)), 0)
         - coalesce((select sum(c.amount_minor) from employee_expense_claims c where c.employee_id = e.id and c.status = 'recorded'), 0) as net_minor
    from employees e;

-- Paid = a real, non-reversed payroll payment exists for the run; never a status alone. Legacy/demo rows
-- (provenance demo-fixture/migration) keep their historical label; they are not cash evidence and are not re-posted.
create function payroll_runs_paid_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'paid' and new.provenance = 'manual' and (tg_op = 'INSERT' or old.status <> 'paid') and not exists (select 1 from financial_transactions t where t.payroll_run_id = new.id and t.reversal_of_id is null
      and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)) then
    raise exception 'Payroll can only be paid through a recorded payroll payment' using errcode = '23514';
  end if;
  return new;
end $$;
create constraint trigger payroll_runs_paid_guard after insert or update on payroll_runs
  deferrable initially deferred for each row execute function payroll_runs_paid_guard();

-- Kasbon claims share the generic mandatory-posting check (date = spent_on).
create or replace function accounting_source_mandatory() returns trigger language plpgsql as $$
declare b accounting_books; v_kind text; v_date date; v_source text := tg_argv[0];
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' then return new; end if;
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;
  if new.status in ('issued', 'recorded') then
    v_kind := 'source_recorded';
    v_date := case v_source when 'credit_note' then (new.created_at at time zone b.timezone)::date
                            when 'service_fulfillment' then (to_jsonb(new)->>'fulfilled_on')::date
                            when 'employee_expense_claim' then (to_jsonb(new)->>'spent_on')::date
                            else (to_jsonb(new)->>'recognized_on')::date end;
  elsif new.status = 'void' then
    v_kind := 'source_voided'; v_date := (new.voided_at at time zone b.timezone)::date;
  else return new; end if;
  if v_date < b.cutover_date then raise exception 'New % before cutover requires opening correction', v_source; end if;
  if not exists (select 1 from accounting_events e join accounting_posting_registry r on r.event_id = e.id and r.book_id = e.book_id
      join accounting_journals j on j.id = r.journal_id and j.status = 'posted'
      where e.book_id = b.id and e.source_type = v_source and e.source_id = new.id and e.event_kind = v_kind and r.status = 'posted') then
    raise exception 'Mandatory accounting posting missing for % %', v_source, new.id;
  end if;
  return new;
end $$;
create constraint trigger accounting_expense_claim_mandatory after insert or update on employee_expense_claims
  deferrable initially deferred for each row execute function accounting_source_mandatory('employee_expense_claim');

-- Approved payroll is an expense and a payable to each employee on an ACTIVE book.
create function accounting_payroll_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' or new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then return new; end if;
  if not exists (select 1 from accounting_events e join accounting_posting_registry r on r.event_id = e.id and r.book_id = e.book_id
      join accounting_journals j on j.id = r.journal_id and j.status = 'posted'
      where e.book_id = b.id and e.source_type = 'payroll_run' and e.source_id = new.id and e.event_kind = 'source_recorded' and r.status = 'posted') then
    raise exception 'Mandatory accounting payroll posting missing for %', new.id;
  end if;
  return new;
end $$;
create constraint trigger accounting_payroll_mandatory after insert or update on payroll_runs
  deferrable initially deferred for each row execute function accounting_payroll_mandatory();

-- Reimbursements owed to staff need their own liability (template account for new books, added to existing ones).
insert into accounting_accounts (book_id, code, name, account_type, control_role, required_dimension)
  select id, '2165', 'Utang reimbursement staf', 'liability', 'reimbursement-payable', 'employee' from accounting_books;
