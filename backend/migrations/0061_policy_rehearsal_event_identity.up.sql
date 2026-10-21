-- A resolved parent journal is derived data, not a change to the economic facts of a pending correction.
alter table accounting_events add column identity_version smallint not null default 1 check(identity_version in(1,2));
create table accounting_policy_rehearsals(
 draft_policy_id text primary key references accounting_policies(id),
 result_policy_id text not null unique references accounting_policies(id),
 reason text not null check(length(btrim(reason)) between 5 and 500),
 tested_by text not null references users(id),created_at timestamptz not null default now()
);
create trigger accounting_policy_rehearsals_immutable before update or delete or truncate on accounting_policy_rehearsals
 for each statement execute function accounting_immutable();
create function accounting_policy_rehearsal_guard() returns trigger language plpgsql as $$
declare d accounting_policies; p accounting_policies; b accounting_books;
begin
 select * into d from accounting_policies where id=new.draft_policy_id;
 select * into p from accounting_policies where id=new.result_policy_id;
 select * into b from accounting_books where id=d.book_id;
 if b.purpose is distinct from 'rehearsal' or d.validation_status is distinct from 'draft' or p.validation_status is distinct from 'test-only'
  or p.book_id is distinct from d.book_id or p.source_kind is distinct from d.source_kind or p.version<=d.version
  or (to_jsonb(d)-'id'-'version'-'validation_status'-'created_by'-'created_at') is distinct from (to_jsonb(p)-'id'-'version'-'validation_status'-'created_by'-'created_at') then
  raise exception 'Policy rehearsal must retain the exact draft facts in a TEST_ONLY book' using errcode='23514';
 end if;
 return new;
end $$;
create trigger accounting_policy_rehearsal_guard before insert on accounting_policy_rehearsals for each row execute function accounting_policy_rehearsal_guard();
