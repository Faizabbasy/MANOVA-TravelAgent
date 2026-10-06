-- Project core moves to the server (S3a): operational header fields owned by the Project module, and
-- server-generated IDs that keep the legacy prefixes (PRJ-341 …) so deep links stay the same shape.
alter table projects
  add column characteristic text not null default 'normal' check (characteristic in ('normal', 'high-change', 'complex')),
  add column service_scope text[] not null default '{}'
    check (service_scope <@ array['flight', 'hotel', 'transportation', 'mice', 'additional']::text[]),
  add column traveler_count integer not null default 0 check (traveler_count >= 0),
  add column is_group_trip boolean not null default false,
  add column lead_id text,
  add column source_quotation_id text,
  add column tour_leader_name text,
  add column tour_leader_phone text,
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column meeting_point text;

-- One row per ID prefix; nextId() increments it under a row lock (insert … on conflict do update).
create table id_sequences (
  prefix     text primary key check (prefix ~ '^[A-Z]+-$'),
  last_value integer not null check (last_value >= 0)
);

insert into id_sequences (prefix, last_value)
select 'PRJ-', coalesce(max(substring(id from '^PRJ-([0-9]+)$')::integer), 0) from projects
union all
select 'PTY-', coalesce(max(substring(id from '^PTY-([0-9]+)$')::integer), 0) from parties;
