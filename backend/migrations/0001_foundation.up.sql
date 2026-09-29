-- Foundation: append-only audit trail shared by every module.
-- actor_user_id deliberately has no FK: audit rows must outlive user changes and exist before identity tables.

create table audit_events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_user_id text,
  action        text not null check (action ~ '^[a-z][a-z0-9_.-]*$'),
  entity_type   text,
  entity_id     text,
  request_id    text,
  ip            text,
  user_agent    text,
  reason        text,
  before        jsonb,
  after         jsonb,
  details       jsonb
);

create index audit_events_entity_idx on audit_events (entity_type, entity_id, occurred_at);
create index audit_events_actor_idx on audit_events (actor_user_id, occurred_at);

create function audit_events_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_events is append-only' using errcode = '42501';
end
$$;

create trigger audit_events_no_update_delete
  before update or delete on audit_events
  for each row execute function audit_events_block_mutation();

create trigger audit_events_no_truncate
  before truncate on audit_events
  for each statement execute function audit_events_block_mutation();
