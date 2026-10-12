-- S10b: master data (16 reference categories, fields validated per category by the API) and the organization profile.
create table master_data_records (
  id                text primary key check (id <> ''),
  category          text not null check (category in (
                      'project-type', 'service-type', 'destination', 'vendor-category', 'airport', 'airline', 'hotel',
                      'currency', 'tax-rule', 'payment-term', 'cancellation-rule', 'numbering-scheme', 'document-template',
                      'readiness-gate', 'assignment-rule', 'milestone-template')),
  is_active         boolean not null default true,
  data              jsonb not null check (jsonb_typeof(data) = 'object'),
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index master_data_records_category on master_data_records (category, id);
-- Codes are unique within their category (airport/airline IATA, currency code).
create unique index master_data_records_code on master_data_records (category, (coalesce(data->>'iataCode', data->>'code')))
  where category in ('airport', 'airline', 'currency');

-- The travel agency itself (a singleton, not multi-tenancy).
create table organization_profile (
  id                    text primary key check (id = 'ORG-001'),
  legal_name            text not null check (legal_name <> ''),
  display_name          text not null check (display_name <> ''),
  address               text not null check (address <> ''),
  default_currency_code text not null,
  business_hours        text not null default '',
  contact_email         text not null check (contact_email <> ''),
  contact_phone         text not null default '',
  updated_by            text references users (id),
  provenance            text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at     timestamptz,
  updated_at            timestamptz not null default now()
);
