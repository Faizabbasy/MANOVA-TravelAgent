do $$ begin
  if exists (select 1 from accounting_journals where status = 'posted') then
    raise exception 'Posted accounting evidence exists. Use forward repair or the approved backup/restore runbook.';
  end if;
end $$;
drop trigger accounting_cash_mandatory on financial_transactions;
drop function accounting_cash_mandatory();
drop table accounting_posting_registry;
drop function accounting_registry_guard();
drop table accounting_journal_lines;
drop function accounting_line_guard();
drop table accounting_journals;
drop function accounting_journal_guard();
drop table accounting_events;
drop table accounting_policies;
drop table accounting_periods;
drop function accounting_period_guard();
drop table accounting_accounts;
drop table accounting_books;
drop function accounting_immutable();
