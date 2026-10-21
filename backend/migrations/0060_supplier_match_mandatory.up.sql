-- A direct SQL path must not bypass atomic derived posting when a book is active.
create function accounting_supplier_match_mandatory() returns trigger language plpgsql as $$
declare b accounting_books; expected_kind text;
begin
 select * into b from accounting_books where singleton for update;
 if b.mode is distinct from 'active' then return new; end if;
 expected_kind:=case when new.status='void' then 'source_voided' else 'source_recorded' end;
 if not exists(select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
   join accounting_journals j on j.id=r.journal_id and j.status='posted'
   where e.book_id=b.id and e.source_type='vendor_fulfillment_match' and e.source_id=new.id and e.event_kind=expected_kind and r.status='posted') then
  raise exception 'Mandatory accounting supplier matching posting missing for %',new.id;
 end if;
 return new;
end $$;
create constraint trigger accounting_supplier_match_mandatory after insert or update on vendor_fulfillment_matches
 deferrable initially deferred for each row execute function accounting_supplier_match_mandatory();
