-- Vendor (S2): profile, contact persons, product catalog and document records (metadata only, no files — ADR-005).
alter table vendors
  add column contact_name  text,
  add column contact_phone text,
  add column category      text;

create table vendor_contacts (
  id         text primary key check (id <> ''),
  vendor_id  text not null references vendors (id),
  name       text not null check (btrim(name) <> ''),
  title      text not null check (btrim(title) <> ''),
  email      text,
  phone      text,
  provenance text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at timestamptz not null default now()
);
create index vendor_contacts_vendor on vendor_contacts (vendor_id);

create table vendor_products (
  id          text primary key check (id <> ''),
  vendor_id   text not null references vendors (id),
  name        text not null check (btrim(name) <> ''),
  category    text not null check (category in ('flight', 'hotel', 'transportation', 'mice', 'additional')),
  description text,
  price_minor bigint check (price_minor >= 0 and price_minor <= 1000000000000000),
  provenance  text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at  timestamptz not null default now()
);
create index vendor_products_vendor on vendor_products (vendor_id);

create table vendor_documents (
  id          text primary key check (id <> ''),
  vendor_id   text not null references vendors (id),
  name        text not null check (btrim(name) <> ''),
  type        text not null check (btrim(type) <> ''),
  uploaded_on date not null,
  provenance  text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at  timestamptz not null default now()
);
create index vendor_documents_vendor on vendor_documents (vendor_id);

insert into id_sequences (prefix, last_value)
select 'VND-', coalesce(max(substring(id from '^VND-([0-9]+)$')::integer), 0) from vendors
on conflict (prefix) do nothing;
insert into id_sequences (prefix, last_value) values ('VCT-', 0), ('VPR-', 0), ('VDOC-', 0) on conflict (prefix) do nothing;
