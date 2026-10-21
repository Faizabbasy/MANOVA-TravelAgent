do $$ begin
  if exists (select 1 from accounting_journals where status='posted') or exists (select 1 from loans) or exists (select 1 from asset_capitalizations)
     or exists (select 1 from financial_transactions where kind in ('asset_purchase','loan_proceeds','loan_repayment','owner_contribution','owner_withdrawal')) then
    raise exception 'Asset, loan, owner-fund or posted financial evidence exists. Use forward repair or an approved restore.';
  end if;
end $$;
drop trigger accounting_depreciation_mandatory on asset_depreciations;
drop function accounting_depreciation_mandatory();
drop index financial_transactions_loan_idx;
alter table financial_transactions drop constraint financial_transactions_loan_link;
alter table financial_transactions drop constraint financial_transactions_asset_link;
alter table financial_transactions drop constraint financial_transactions_direction_matches_kind;
alter table financial_transactions add constraint financial_transactions_direction_matches_kind check (
  (reversal_of_id is null) = (direction = case
    when kind in ('customer_receipt', 'vendor_refund', 'other_income', 'transfer_in', 'employee_advance_return') then 'in'
    else 'out' end));
alter table financial_transactions drop constraint financial_transactions_kind_check;
alter table financial_transactions add constraint financial_transactions_kind_check check (kind in (
  'customer_receipt', 'vendor_refund', 'other_income', 'transfer_in', 'employee_advance_return',
  'vendor_payment', 'refund_settlement', 'expense', 'transfer_out', 'transfer_fee',
  'employee_advance', 'employee_reimbursement', 'payroll_payment'));
drop table loan_repayments;
drop function loan_repayments_guard();
alter table financial_transactions drop column loan_id;
alter table financial_transactions drop column asset_id;
drop table asset_depreciations;
drop table asset_capitalizations;
drop table loans;
