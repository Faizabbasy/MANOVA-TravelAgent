-- S4b: vendor quotations, service orders with status, booking attempts and duplicate flags (API-owned).
create table vendor_quotations (
  id              text primary key check (id <> ''),
  vendor_id       text not null references vendors (id),
  project_id      text not null references projects (id),
  service_id      text,
  service_type    text not null check (service_type in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  amount_minor    bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  notes           text,
  status          text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  decision_reason text,
  submitted_on    date not null,
  decided_at      timestamptz,
  decided_by      text references users (id),
  provenance      text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at      timestamptz not null default now(),
  constraint vendor_quotations_service_fk foreign key (service_id, project_id) references project_services (id, project_id)
);
create index vendor_quotations_service on vendor_quotations (service_id);
create index vendor_quotations_project on vendor_quotations (project_id);
-- One accepted quotation per service.
create unique index vendor_quotations_one_accepted on vendor_quotations (service_id) where status = 'accepted';

alter table service_orders
  add column status text not null default 'draft'
    check (status in ('draft', 'sent', 'acknowledged', 'amended', 'fulfilled', 'cancelled')),
  add column net_cost_minor bigint check (net_cost_minor is null or (net_cost_minor >= 0 and net_cost_minor <= 1000000000000000)),
  add column line_items jsonb not null default '[]'::jsonb check (jsonb_typeof(line_items) = 'array'),
  add column source_quotation_id text references vendor_quotations (id),
  add column status_reason text,
  add column acknowledged_at timestamptz,
  add column fulfilled_at timestamptz,
  add column updated_at timestamptz not null default now();
-- One active order per service + vendor (orders are cancelled, never deleted: vendor invoices point at them).
create unique index service_orders_one_active on service_orders (service_id, vendor_id)
  where status <> 'cancelled' and service_id is not null;

alter table booking_refs
  add column flagged_duplicate boolean not null default false,
  add column duplicate_of jsonb not null default '[]'::jsonb check (jsonb_typeof(duplicate_of) = 'array'),
  add column duplicate_note text;

create table booking_attempts (
  id            text primary key check (id <> ''),
  booking_type  text not null,
  booking_id    text not null,
  outcome       text not null check (outcome in ('success', 'failed', 'manual-fallback')),
  note          text,
  actor_user_id text references users (id),
  attempted_at  timestamptz not null default now(),
  provenance    text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  constraint booking_attempts_booking_fk foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id)
);
create index booking_attempts_booking on booking_attempts (booking_type, booking_id);

insert into id_sequences (prefix, last_value)
select 'SO-', coalesce(max(substring(id from '^SO-([0-9]+)$')::integer), 0) from service_orders
on conflict (prefix) do nothing;
insert into id_sequences (prefix, last_value) values ('VQ-', 0), ('BAT-', 0) on conflict (prefix) do nothing;
