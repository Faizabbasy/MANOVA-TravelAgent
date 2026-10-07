-- S6b: sales orders (B2C standalone + Group Trip participant bookings) owned by the Sales API.
alter table sales_order_refs
  alter column project_id drop not null,
  add column status text not null default 'draft' check (status in ('draft', 'paid', 'ongoing', 'done', 'cancelled')),
  add column status_reason text,
  -- Set whenever the API changes the status: a re-seed only writes fixture status while this is null.
  add column status_changed_at timestamptz,
  add column destination text,
  add column travel_start_date date,
  add column travel_end_date date,
  add column note text,
  add column lead_id text references leads (id),
  add column paid_on date,
  add column created_on date not null default current_date,
  add column updated_at timestamptz not null default now(),
  add constraint sales_order_refs_period check (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date);
create index sales_order_refs_lead on sales_order_refs (lead_id) where lead_id is not null;

insert into id_sequences (prefix, last_value)
select 'SLO-', coalesce(max(substring(id from '^SLO-([0-9]+)$')::integer), 0) from sales_order_refs
on conflict (prefix) do nothing;
