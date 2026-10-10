-- S7d: project activity log (API-owned). ACT- = activity written by a server action, CHG- = change logged by hand.
create table project_activities (
  id               text primary key check (id <> ''),
  project_id       text not null references projects (id),
  message          text not null check (message <> ''),
  is_change        boolean not null default false,
  reviewed         boolean not null default true,
  reviewed_by      text references users (id),
  reviewed_at      timestamptz,
  category         text check (category in ('traveler', 'itinerary', 'service', 'vendor', 'budget', 'other')),
  reason           text,
  requested_by     text references users (id),
  before_value     text,
  after_value      text,
  impact_note      text,
  approval_status  text check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by      text references users (id),
  actor_user_id    text references users (id),
  source_action    text,
  source_entity_id text,
  provenance       text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at       timestamptz not null default now(),
  check (approval_status is null or is_change)
);
create index project_activities_project on project_activities (project_id, created_at);

insert into id_sequences (prefix, last_value) values ('ACT-', 0), ('CHG-', 0) on conflict (prefix) do nothing;
