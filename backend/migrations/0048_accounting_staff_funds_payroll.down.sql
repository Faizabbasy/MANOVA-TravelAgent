do $$ begin
  if exists (select 1 from accounting_journals where status='posted') or exists (select 1 from employee_expense_claims)
     or exists (select 1 from financial_transactions where kind in ('employee_advance','employee_reimbursement','employee_advance_return','payroll_payment')) then
    raise exception 'Staff fund, payroll payment or posted financial evidence exists. Use forward repair or an approved restore.';
  end if;
end $$;

-- Accounts are immutable evidence (statement trigger); the added account stays harmless when no book uses it.
drop trigger accounting_payroll_mandatory on payroll_runs;
drop function accounting_payroll_mandatory();
drop trigger accounting_expense_claim_mandatory on employee_expense_claims;
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
drop trigger payroll_runs_paid_guard on payroll_runs;
drop function payroll_runs_paid_guard();
drop view v_employee_fund_balances;
drop table employee_expense_claims;
drop function employee_expense_claims_guard();
drop index financial_transactions_payroll_idx;
drop index financial_transactions_employee_idx;
alter table financial_transactions drop constraint financial_transactions_payroll_link;
alter table financial_transactions drop constraint financial_transactions_employee_link;
alter table financial_transactions drop constraint financial_transactions_direction_matches_kind;
alter table financial_transactions add constraint financial_transactions_direction_matches_kind check (
  (reversal_of_id is null) = (direction = case
    when kind in ('customer_receipt', 'vendor_refund', 'other_income', 'transfer_in') then 'in'
    else 'out' end));
alter table financial_transactions drop constraint financial_transactions_kind_check;
alter table financial_transactions add constraint financial_transactions_kind_check check (kind in (
  'customer_receipt', 'vendor_refund', 'other_income', 'transfer_in',
  'vendor_payment', 'refund_settlement', 'expense', 'transfer_out', 'transfer_fee'));
alter table financial_transactions drop column payroll_run_id;
alter table financial_transactions drop column employee_id;
