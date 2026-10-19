-- S12c-3: client travel requests (reviewed by sales, converted to a lead) and approvals staff ask a client for — API-owned.
create table travel_requests (
  id                         text primary key check (id <> ''),
  party_id                   text not null references parties (id),
  request_name               text not null check (btrim(request_name) <> ''),
  contact_person_id          text references party_contacts (id),
  trip_type                  text,
  purpose                    text,
  destination                text not null default '',
  travel_start_date          date,
  travel_end_date            date check (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date),
  date_flexible              boolean not null default false,
  estimated_participants     integer check (estimated_participants is null or estimated_participants > 0),
  -- An estimate in whole rupiah for the proposal, never posted anywhere.
  estimated_budget_idr       bigint check (estimated_budget_idr is null or estimated_budget_idr >= 0),
  currency                   text,
  service_scope              jsonb not null default '[]',
  flight_requirement         jsonb,
  hotel_requirement          jsonb,
  transportation_requirement jsonb,
  mice_requirement           jsonb,
  additional_services_note   text,
  status                     text not null check (status in ('draft', 'submitted', 'under-review', 'need-clarification', 'proposal-preparation', 'converted-to-lead', 'cancelled', 'closed')),
  reviewer_user_id           text references users (id),
  clarification_note         text,
  lead_id                    text references leads (id),
  cancel_reason              text,
  close_reason               text,
  created_by                 text not null references users (id),
  submitted_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index travel_requests_party on travel_requests (party_id);
create index travel_requests_status on travel_requests (status);

create table travel_request_activities (
  id                text primary key check (id <> ''),
  travel_request_id text not null references travel_requests (id),
  actor_user_id     text not null references users (id),
  from_client       boolean not null,
  message           text not null check (btrim(message) <> ''),
  created_at        timestamptz not null default now()
);
create index travel_request_activities_request on travel_request_activities (travel_request_id);

create table client_approvals (
  id              text primary key check (id <> ''),
  project_id      text not null references projects (id),
  party_id        text not null references parties (id),
  entity_type     text not null check (entity_type in ('participant-list', 'rooming-list', 'additional-charge', 'cancellation-charge', 'project-completion', 'final-report', 'berita-acara')),
  title           text not null check (btrim(title) <> ''),
  description     text,
  amount_idr      bigint check (amount_idr is null or amount_idr >= 0),
  status          text not null check (status in ('pending', 'approved', 'rejected', 'revision-requested')),
  requested_by    text not null references users (id),
  requested_at    timestamptz not null default now(),
  expires_on      date,
  decided_by      text references users (id),
  decided_at      timestamptz,
  decision_comment text,
  reason          text,
  check (status = 'pending' or (decided_by is not null and decided_at is not null)),
  check (status not in ('rejected', 'revision-requested') or btrim(coalesce(reason, '')) <> '')
);
create index client_approvals_party on client_approvals (party_id);
create index client_approvals_project on client_approvals (project_id);
