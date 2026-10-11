-- S8: change requests, incidents and non-Finance booking cancellations (no-show / refunded) are API-owned.
-- A `cancelled` booking is recorded by Finance (`refunds`, 0011); booking_cancellations keeps the rest plus pre-Finance history.
create table change_requests (
  id                      text primary key check (id <> ''),
  project_id              text not null references projects (id),
  source                  text not null check (source in ('client', 'internal', 'supplier')),
  requested_by            text not null references users (id),
  affected_entities       jsonb not null default '[]'::jsonb check (jsonb_typeof(affected_entities) = 'array'),
  before_summary          text not null check (before_summary <> ''),
  after_summary           text not null check (after_summary <> ''),
  operational_impact      text,
  commercial_impact_minor bigint check (commercial_impact_minor >= 0),
  financial_impact_note   text,
  timeline_impact_note    text,
  status                  text not null default 'submitted'
    check (status in ('submitted', 'under-review', 'approved', 'rejected', 'implemented')),
  decided_by              text references users (id),
  decided_at              timestamptz,
  rejection_reason        text,
  implemented_at          timestamptz,
  activity_id             text references project_activities (id),
  changed_by_api_at       timestamptz,
  provenance              text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null)
);
create index change_requests_project on change_requests (project_id);

create table incidents (
  id                text primary key check (id <> ''),
  project_id        text not null references projects (id),
  booking_type      text check (booking_type in ('flight', 'hotel', 'transport', 'mice')),
  booking_id        text,
  title             text not null check (title <> ''),
  description       text not null check (description <> ''),
  severity          text not null check (severity in ('low', 'medium', 'high', 'critical')),
  owner_id          text not null references users (id),
  status            text not null default 'open' check (status in ('open', 'investigating', 'escalated', 'resolved', 'closed')),
  escalated_to      text references users (id),
  communication_log jsonb not null default '[]'::jsonb check (jsonb_typeof(communication_log) = 'array'),
  resolution_note   text,
  resolved_at       timestamptz,
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((booking_type is null) = (booking_id is null))
);
create index incidents_project on incidents (project_id);

create table booking_cancellations (
  id             text primary key check (id <> ''),
  project_id     text not null references projects (id),
  booking_type   text not null check (booking_type in ('flight', 'hotel', 'transport', 'mice')),
  booking_id     text not null,
  outcome        text not null check (outcome in ('cancelled', 'no-show', 'refunded')),
  reason         text not null check (reason <> ''),
  penalty_minor  bigint check (penalty_minor >= 0),
  refund_eligible boolean not null default false,
  cancelled_by   text not null references users (id),
  cancelled_on   date not null,
  provenance     text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at     timestamptz not null default now()
);
create index booking_cancellations_project on booking_cancellations (project_id);

insert into id_sequences (prefix, last_value) values ('CR-', 0), ('INC-', 0), ('CNX-', 0) on conflict (prefix) do nothing;
