do $$ begin
 if exists(select 1 from accounting_policy_rehearsals) or exists(select 1 from accounting_events where identity_version=2) then
  raise exception 'Policy rehearsal/event identity evidence exists; use a forward correction';
 end if;
end $$;
drop table accounting_policy_rehearsals;
drop function accounting_policy_rehearsal_guard();
alter table accounting_events drop column identity_version;
