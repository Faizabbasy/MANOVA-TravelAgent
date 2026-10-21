do $$ begin
  if exists (select 1 from bank_statement_imports) then
    raise exception 'Bank statement evidence exists. Use forward repair or an approved restore.';
  end if;
end $$;
drop table bank_reconciliation_matches;
drop function bank_reconciliation_guard();
drop table bank_statement_lines;
drop table bank_statement_imports;
