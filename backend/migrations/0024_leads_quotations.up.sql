-- S6a: leads, lead activities and client quotations with full content per version (API-owned).
create table leads (
  id                   text primary key check (id <> ''),
  name                 text not null check (name <> ''),
  company_name         text,
  title                text,
  source               text not null check (source in ('website', 'instagram', 'tiktok', 'whatsapp', 'referral', 'event', 'email', 'sales-outreach', 'client-portal', 'other')),
  stage                text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'unqualified')),
  owner_user_id        text not null references users (id),
  handed_over_to       text references users (id),
  phone                text,
  email                text,
  qualification_notes  text,
  expected_close_date  date,
  created_on           date not null default current_date,
  last_updated_on      date not null default current_date,
  archived             boolean not null default false,
  archive_reason       text,
  party_id             text references parties (id),
  qualified_on         date,
  unqualified_reason   text,
  merged_into          text references leads (id),
  service_category     text check (service_category in ('corporate-travel', 'group-travel', 'individual-travel', 'mice-event')),
  destination          text,
  travel_start_date    date,
  travel_end_date      date,
  traveler_estimate    integer check (traveler_estimate is null or traveler_estimate > 0),
  service_scope        jsonb not null default '[]'::jsonb check (jsonb_typeof(service_scope) = 'array'),
  requirement_summary  text,
  budget_range         text,
  date_flexible        boolean,
  decision_maker       text,
  urgency              text check (urgency in ('low', 'medium', 'high')),
  special_request_note text,
  b2c                  jsonb not null default '{}'::jsonb check (jsonb_typeof(b2c) = 'object'),
  provenance           text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date)
);
create index leads_stage on leads (stage);
create index leads_party on leads (party_id) where party_id is not null;

create table lead_activities (
  id            text primary key check (id <> ''),
  lead_id       text not null references leads (id),
  type          text not null check (type in ('call', 'meeting', 'email', 'note', 'follow-up')),
  message       text not null check (message <> ''),
  owner_user_id text not null references users (id),
  activity_date date not null default current_date,
  due_on        date,
  done_on       date,
  provenance    text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at    timestamptz not null default now()
);
create index lead_activities_lead on lead_activities (lead_id);

-- One quotation per lead; its content lives per version.
create table quotations (
  id                text primary key check (id <> ''),
  lead_id           text not null unique references leads (id),
  current_version   integer not null default 1 check (current_version >= 1),
  sent_to_client_on date,
  created_on        date not null default current_date,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table quotation_versions (
  quotation_id            text not null references quotations (id),
  version                 integer not null check (version >= 1),
  amount_minor            bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  discount_minor          bigint check (discount_minor is null or (discount_minor >= 0 and discount_minor <= 1000000000000000)),
  tax_minor               bigint check (tax_minor is null or (tax_minor >= 0 and tax_minor <= 1000000000000000)),
  markup_minor            bigint check (markup_minor is null or (markup_minor >= 0 and markup_minor <= 1000000000000000)),
  estimated_cost_minor    bigint check (estimated_cost_minor is null or (estimated_cost_minor >= 0 and estimated_cost_minor <= 1000000000000000)),
  estimated_margin_minor  bigint check (estimated_margin_minor is null or abs(estimated_margin_minor) <= 1000000000000000),
  currency                text not null default 'IDR',
  payment_terms           text,
  valid_until             date,
  terms_and_conditions    text,
  inclusions              text,
  exclusions              text,
  cancellation_policy     text,
  proposed_itinerary_note text,
  cost_sheet_id           text,
  service_breakdown       jsonb not null default '[]'::jsonb check (jsonb_typeof(service_breakdown) = 'array'),
  status                  text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'superseded')),
  submitted_by            text references users (id),
  submitted_at            timestamptz,
  decided_by              text references users (id),
  decided_at              timestamptz,
  decision_note           text,
  created_by              text references users (id),
  created_on              date not null default current_date,
  updated_at              timestamptz not null default now(),
  primary key (quotation_id, version)
);

-- Old staging rows may point at leads that only arrive with the S6a seed: checked for new rows only.
alter table projects add constraint projects_lead_fk foreign key (lead_id) references leads (id) not valid;
alter table projects add constraint projects_source_quotation_fk foreign key (source_quotation_id) references quotations (id) not valid;

insert into id_sequences (prefix, last_value) values ('LED-', 0), ('LACT-', 0), ('QUO-', 0) on conflict (prefix) do nothing;
