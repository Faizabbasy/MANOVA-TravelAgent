do $$ begin
 if exists(select 1 from accounting_posting_registry where status='superseded') then raise exception 'Resolved cash reversal evidence exists; use forward correction'; end if;
end $$;
create or replace function accounting_registry_guard() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then raise exception 'Posting registry evidence is immutable'; end if;
 if tg_op='UPDATE' and old.status='posted' then raise exception 'Posted registry is immutable'; end if;
 if new.status='posted' and not exists(select 1 from accounting_journals j where j.id=new.journal_id and j.book_id=new.book_id and j.event_id=new.event_id and j.purpose=new.purpose and j.status='posted') then
  raise exception 'Registry must point at its own posted journal';
 end if;
 return new;
end $$;
alter table accounting_posting_registry drop constraint accounting_posting_registry_status_check;
alter table accounting_posting_registry add constraint accounting_posting_registry_status_check check(status in('pending','posted'));
