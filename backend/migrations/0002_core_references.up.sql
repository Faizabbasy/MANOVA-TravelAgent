-- Core reference bridge (ADR-004). IDs are the same text IDs the frontend already uses (PTY-001, VND-006,
-- PRJ-101, FLT-1011 …) so finance records can reference them and old deep links keep resolving.
-- These tables are references, not a second operational booking system: booking detail and lifecycle stay
-- in their own domains; booking_refs only records (type, id) → project/service.

create table parties (
  id                 text primary key check (id <> ''),
  name               text not null check (btrim(name) <> ''),
  lifecycle_status   text not null check (lifecycle_status in ('prospect', 'client')),
  party_type         text check (party_type in ('company', 'individual')),
  preferred_currency text check (preferred_currency ~ '^[A-Z]{3}$'),
  provenance         text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table vendors (
  id           text primary key check (id <> ''),
  name         text not null check (btrim(name) <> ''),
  service_type text not null check (service_type in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  status       text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  provenance   text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table projects (
  id                text primary key check (id <> ''),
  name              text not null check (btrim(name) <> ''),
  party_id          text not null references parties (id),
  destination       text,
  travel_start_date date,
  travel_end_date   date,
  status            text not null check (status in (
                      'draft', 'planning', 'confirmed', 'in-progress', 'ongoing-trip', 'completed', 'on-hold', 'cancelled')),
  -- FK to users is added in 0003 once identity exists.
  owner_user_id     text,
  provenance        text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint projects_travel_dates_ordered check (
    travel_start_date is null or travel_end_date is null or travel_end_date >= travel_start_date)
);

create index projects_party_idx on projects (party_id);

create table project_services (
  id           text primary key check (id <> ''),
  project_id   text not null references projects (id),
  service_type text not null check (service_type in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  vendor_id    text references vendors (id),
  provenance   text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at   timestamptz not null default now(),
  constraint project_services_id_project_key unique (id, project_id)
);

create index project_services_project_idx on project_services (project_id);
create index project_services_vendor_idx on project_services (vendor_id) where vendor_id is not null;

-- booking_type uses the booking-orchestration literals ('transport', not 'transportation').
create table booking_refs (
  booking_type text not null check (booking_type in ('flight', 'hotel', 'transport', 'mice')),
  booking_id   text not null check (booking_id <> ''),
  project_id   text not null references projects (id),
  service_id   text,
  provenance   text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at   timestamptz not null default now(),
  primary key (booking_type, booking_id),
  -- A booking's service must belong to the booking's own project.
  constraint booking_refs_service_same_project_fk
    foreign key (service_id, project_id) references project_services (id, project_id)
);

create index booking_refs_project_idx on booking_refs (project_id);
create index booking_refs_service_idx on booking_refs (service_id) where service_id is not null;

-- Procurement service orders: the formal vendor engagement a vendor invoice (AP) will point at. Reference
-- only — line items, prices and lifecycle stay in procurement.
create table service_orders (
  id         text primary key check (id <> ''),
  vendor_id  text not null references vendors (id),
  project_id text references projects (id),
  service_id text,
  provenance text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at timestamptz not null default now(),
  constraint service_orders_service_needs_project check (service_id is null or project_id is not null),
  constraint service_orders_service_same_project_fk
    foreign key (service_id, project_id) references project_services (id, project_id)
);

create index service_orders_vendor_idx on service_orders (vendor_id);
create index service_orders_project_idx on service_orders (project_id) where project_id is not null;
