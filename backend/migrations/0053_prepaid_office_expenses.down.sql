do $$ begin
  if exists(select 1 from prepaid_expenses) or exists(select 1 from financial_transactions where kind='prepaid_opex')
    or exists(select 1 from accounting_journals where status='posted') then
    raise exception 'Prepaid or posted financial evidence exists. Use forward repair or an approved restore.';
  end if;
end $$;
drop trigger accounting_prepaid_amortization_mandatory on prepaid_expense_amortizations;
drop function accounting_prepaid_amortization_mandatory();
drop trigger prepaid_cash_guard on financial_transactions;
drop function prepaid_cash_guard();
drop table prepaid_expense_amortizations;
drop function prepaid_amortization_guard();
drop table prepaid_expenses;
drop function prepaid_expense_source_guard();
alter table financial_transactions drop constraint financial_transactions_kind_check;
alter table financial_transactions add constraint financial_transactions_kind_check check (kind in (
  'customer_receipt','vendor_refund','other_income','transfer_in','employee_advance_return','loan_proceeds','owner_contribution',
  'vendor_payment','refund_settlement','expense','transfer_out','transfer_fee','employee_advance','employee_reimbursement',
  'payroll_payment','asset_purchase','loan_repayment','owner_withdrawal'));
