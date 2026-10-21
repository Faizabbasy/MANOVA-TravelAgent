-- A cash reversal may predate its parents' GL posting in a SHADOW book. Its original pending marker remains
-- immutable evidence; only the exact, posted compensations of every available parent may supersede it.
alter table accounting_posting_registry drop constraint accounting_posting_registry_status_check;
alter table accounting_posting_registry add constraint accounting_posting_registry_status_check check(status in('pending','posted','superseded'));
create or replace function accounting_registry_guard() returns trigger language plpgsql as $$
declare e accounting_events; original_id text;
begin
 if tg_op='DELETE' then raise exception 'Posting registry evidence is immutable'; end if;
 if tg_op='UPDATE' and old.status in('posted','superseded') then raise exception 'Resolved registry is immutable'; end if;
 if tg_op='UPDATE' and (old.book_id,old.event_id,old.purpose) is distinct from (new.book_id,new.event_id,new.purpose) then raise exception 'Posting registry source identity is immutable'; end if;
 if new.status='posted' and not exists(select 1 from accounting_journals j where j.id=new.journal_id and j.book_id=new.book_id and j.event_id=new.event_id and j.purpose=new.purpose and j.status='posted') then
  raise exception 'Registry must point at its own posted journal';
 end if;
 if new.status='superseded' then
  select * into e from accounting_events where id=new.event_id and book_id=new.book_id;
  select reversal_of_id into original_id from financial_transactions where id=e.source_id;
  if tg_op<>'UPDATE' or old.status<>'pending' or e.source_type is distinct from 'financial_transaction' or e.event_kind is distinct from 'cash_reversal'
    or e.source_version<>'1' or original_id is null or new.reason_code is distinct from 'DERIVED_REVERSALS_POSTED'
    or not exists(select 1 from accounting_journals j join accounting_events p on p.id=j.event_id where j.book_id=new.book_id and j.status='posted' and p.source_type='financial_transaction' and p.source_id=original_id)
    or exists(select 1 from accounting_journals j join accounting_events p on p.id=j.event_id where j.book_id=new.book_id and j.status='posted' and j.reversal_of_id is null
      and ((p.source_type='financial_transaction' and p.source_id=original_id) or (p.source_type='payment_allocation' and p.source_id in(select id::text from payment_allocations where transaction_id=original_id)))
      and not exists(select 1 from accounting_journals c join accounting_events ce on ce.id=c.event_id where c.book_id=new.book_id and c.status='posted' and c.reversal_of_id=j.id
        and ce.source_type='financial_transaction' and ce.source_id=e.source_id and ce.source_version=j.id and ce.event_kind='cash_reversal')) then
   raise exception 'Pending cash reversal requires every exact source compensation before resolution';
  end if;
 end if;
 return new;
end $$;
