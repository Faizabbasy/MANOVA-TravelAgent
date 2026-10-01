-- Project expenses (V2 Pengeluaran tab): add the field-cost categories next to the company ones.
alter table financial_transactions drop constraint financial_transactions_category_check;
alter table financial_transactions add constraint financial_transactions_category_check check (category is null or category in (
  'payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax',
  'transportation', 'meals', 'supplies', 'accommodation', 'emergency', 'other'));
