do $$ begin
  if exists (select 1 from accounting_opening_plans) then
    raise exception 'A confirmed opening exists. Use forward repair or an approved restore.';
  end if;
end $$;
drop table accounting_opening_items;
drop table accounting_opening_plans;
