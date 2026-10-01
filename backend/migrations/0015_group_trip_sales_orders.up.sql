-- Group Trip B2C: each participant booking (sales order) is billed to its own customer, not the project's.
-- Reference data owned by the Sales module; Finance reads it and never changes it.
create table sales_order_refs (
  id             text primary key check (id <> ''),
  project_id     text not null references projects (id),
  party_id       text not null references parties (id),
  price_minor    bigint not null check (price_minor > 0 and price_minor <= 1000000000000000),
  traveler_count integer not null check (traveler_count > 0),
  provenance     text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at     timestamptz not null default now()
);
create index sales_order_refs_project on sales_order_refs (project_id);

alter table customer_invoices add column sales_order_id text references sales_order_refs (id);
-- One live invoice per participant booking (a voided one may be replaced).
create unique index customer_invoices_one_per_sales_order on customer_invoices (sales_order_id)
  where sales_order_id is not null and status <> 'void';
