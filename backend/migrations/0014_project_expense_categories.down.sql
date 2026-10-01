-- Rows posted with a project category fall back to 'other' so the original constraint can come back.
update financial_transactions set category = 'other'
 where category in ('transportation', 'meals', 'supplies', 'accommodation', 'emergency');
alter table financial_transactions drop constraint financial_transactions_category_check;
alter table financial_transactions add constraint financial_transactions_category_check check (category is null or category in (
  'payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other'));
