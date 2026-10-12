-- S11a: MANOVA-owned assets, their maintenance and checkouts (to a project or a person). 'overdue' is derived from
-- the date by the API, never stored.
create table assets (
  id                   text primary key check (id <> ''),
  code                 text not null unique check (code <> ''),
  name                 text not null check (name <> ''),
  category             text not null check (category in ('camera', 'production', 'property', 'vehicle', 'it')),
  brand                text,
  serial_number        text,
  purchased_on         date not null,
  purchase_price_minor bigint check (purchase_price_minor >= 0),
  condition            text not null check (condition in ('excellent', 'good', 'needs-service', 'damaged')),
  status               text not null check (status in ('available', 'in-use', 'maintenance', 'retired')),
  location             text not null check (location <> ''),
  quantity             integer not null check (quantity > 0),
  note                 text,
  provenance           text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at    timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table asset_maintenance (
  id                text primary key check (id <> ''),
  asset_id          text not null references assets (id),
  type              text not null check (type in ('routine', 'repair', 'calibration', 'inspection')),
  scheduled_on      date not null,
  completed_on      date,
  status            text not null check (status in ('scheduled', 'in-progress', 'completed')),
  vendor_name       text,
  cost_minor        bigint check (cost_minor >= 0),
  note              text,
  interval_days     integer check (interval_days > 0),
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((status = 'completed') = (completed_on is not null))
);
create index asset_maintenance_asset on asset_maintenance (asset_id, scheduled_on);

create table asset_checkouts (
  id                  text primary key check (id <> ''),
  asset_id            text not null references assets (id),
  project_id          text references projects (id),
  borrowed_by         text not null references users (id),
  checked_out_on      date not null,
  due_on              date not null check (due_on >= checked_out_on),
  returned_on         date,
  status              text not null check (status in ('checked-out', 'returned')),
  condition_on_return text check (condition_on_return in ('excellent', 'good', 'needs-service', 'damaged')),
  note                text,
  provenance          text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check ((status = 'returned') = (returned_on is not null and condition_on_return is not null))
);
-- An asset is lent out at most once at a time.
create unique index asset_checkouts_open on asset_checkouts (asset_id) where status = 'checked-out';
create index asset_checkouts_project on asset_checkouts (project_id) where status = 'checked-out';
