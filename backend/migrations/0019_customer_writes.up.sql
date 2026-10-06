-- Customer (S1): profile owned by CRM, credit limit owned by Finance, contacts and CRM activity log.
alter table parties
  add column industry text,
  add column company_type text check (company_type in ('private-company', 'bumn', 'government-agency', 'university', 'foundation', 'event-organizer', 'travel-agent', 'other')),
  add column size text,
  add column address text,
  add column city text,
  add column province text,
  add column country text,
  add column postal_code text,
  add column phone text,
  add column email text,
  add column website text,
  add column account_owner_user_id text references users (id),
  add column registration_number text,
  add column npwp text,
  add column billing_name text,
  add column billing_address text,
  add column payment_term text,
  add column po_required boolean not null default false,
  add column travel_preferences text,
  add column credit_limit_minor bigint check (credit_limit_minor >= 0 and credit_limit_minor <= 1000000000000000);

create table party_contacts (
  id         text primary key check (id <> ''),
  party_id   text not null references parties (id),
  name       text not null check (btrim(name) <> ''),
  title      text not null check (btrim(title) <> ''),
  email      text,
  phone      text,
  provenance text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at timestamptz not null default now()
);
create index party_contacts_party on party_contacts (party_id);

create table party_activities (
  id            text primary key check (id <> ''),
  party_id      text not null references parties (id),
  lead_id       text,
  type          text not null check (type in ('call', 'meeting', 'email', 'note', 'follow-up')),
  message       text not null check (btrim(message) <> ''),
  owner_user_id text not null references users (id),
  activity_date date not null,
  due_at        date,
  provenance    text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at    timestamptz not null default now()
);
create index party_activities_party on party_activities (party_id);
create index party_activities_lead on party_activities (lead_id) where lead_id is not null;

insert into id_sequences (prefix, last_value) values ('CP-', 0), ('PACT-', 0) on conflict (prefix) do nothing;
