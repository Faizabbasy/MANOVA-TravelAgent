do $$ begin
  if exists(select 1 from company_expenses) or exists(select 1 from company_expense_schedules) or exists(select 1 from accounting_journals where status='posted') then
    raise exception 'Company expense, schedule or posted evidence exists. Use forward repair or approved restore.';
  end if;
end $$;
drop view v_company_expense_forecast;
drop table company_expense_invoice_links;
drop function company_expense_link_guard();
drop table company_expenses;
drop function company_expense_guard();
drop function accounting_company_expense_mandatory();
drop table company_expense_schedules;
drop function company_schedule_guard();
-- Accounts are immutable even when unused. The foundation down step removes them on an empty-schema rehearsal.
