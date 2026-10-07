-- S7a: travelers, traveler groups and rooming list (API-owned). changed_by_api_at keeps demo re-seeds off user edits.
create table traveler_groups (
  id                text primary key check (id <> ''),
  project_id        text not null references projects (id),
  name              text not null check (name <> ''),
  pax_count         integer not null default 0 check (pax_count >= 0),
  rooming_note      text,
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index traveler_groups_project on traveler_groups (project_id);

create table travelers (
  id                      text primary key check (id <> ''),
  project_id              text not null references projects (id),
  group_id                text references traveler_groups (id),
  party_id                text references parties (id),
  lead_id                 text references leads (id),
  sales_order_id          text references sales_order_refs (id),
  name                    text not null check (name <> ''),
  passport_number         text,
  passport_expiry_date    date,
  id_number               text,
  visa_number             text,
  visa_expiry_date        date,
  emergency_contact_name  text,
  emergency_contact_phone text,
  special_request         text,
  dietary_restrictions    text,
  accessibility_needs     text,
  companion_of            text references travelers (id),
  documents_verified_on   date,
  documents_verified_by   text references users (id),
  is_vip                  boolean not null default false,
  cancelled               boolean not null default false,
  cancel_reason           text,
  replaced_by             text references travelers (id),
  replaces                text references travelers (id),
  changed_by_api_at       timestamptz,
  provenance              text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (cancelled = (cancel_reason is not null))
);
create index travelers_project on travelers (project_id);
create index travelers_sales_order on travelers (sales_order_id) where sales_order_id is not null;

create table room_assignments (
  id                text primary key check (id <> ''),
  project_id        text not null references projects (id),
  group_id          text not null references traveler_groups (id),
  room_label        text not null check (room_label <> ''),
  room_type         text not null check (room_type in ('single', 'twin', 'suite')),
  traveler_ids      jsonb not null default '[]'::jsonb check (jsonb_typeof(traveler_ids) = 'array'),
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index room_assignments_project on room_assignments (project_id);

insert into id_sequences (prefix, last_value) values ('GRP-', 0), ('TRV-', 0), ('ROOM-', 0) on conflict (prefix) do nothing;
