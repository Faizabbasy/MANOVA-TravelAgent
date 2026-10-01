-- Posted transactions are immutable (financial_transactions_immutable), so rows that use a project category
-- cannot be rewritten: refuse while any exist rather than fail half-way.
do $$
begin
  if exists (select 1 from financial_transactions where category in ('transportation', 'meals', 'supplies', 'accommodation', 'emergency')) then
    raise exception 'project expense categories are in use; 0014 cannot be rolled back while such transactions exist';
  end if;
end
$$;
alter table financial_transactions drop constraint financial_transactions_category_check;
alter table financial_transactions add constraint financial_transactions_category_check check (category is null or category in (
  'payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other'));
