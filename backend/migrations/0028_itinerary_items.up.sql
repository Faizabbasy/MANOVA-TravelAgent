-- S7b: daily itinerary items (API-owned). Versions and comments stay in the hidden client portal (ADR-006).
create table itinerary_items (
  id                  text primary key check (id <> ''),
  project_id          text not null references projects (id),
  date                date not null,
  time                text check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title               text not null check (title <> ''),
  description         text,
  service_type        text check (service_type in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  group_id            text references traveler_groups (id),
  timezone            text,
  location            text,
  visible_to_client   boolean not null default true,
  vendor_id           text references vendors (id),
  vendor_amount_minor bigint check (vendor_amount_minor >= 0),
  changed_by_api_at   timestamptz,
  provenance          text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (vendor_amount_minor is null or vendor_id is not null)
);
create index itinerary_items_project_date on itinerary_items (project_id, date);

insert into id_sequences (prefix, last_value) values ('ITIN-', 0) on conflict (prefix) do nothing;
