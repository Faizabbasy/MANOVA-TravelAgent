-- S4a: project services and bookings are written by the API. booking_refs becomes the booking table: core
-- columns Finance reads (status, prices, departure) plus `details`, the UI-owned shape of each booking type.

alter table project_services
  add column label text,
  add column status text not null default 'not-started'
    check (status in ('not-started', 'sourcing', 'quoted', 'pending-confirmation', 'confirmed', 'changed', 'completed', 'cancelled')),
  add column booking_reference text,
  add column budget_minor bigint check (budget_minor is null or (budget_minor >= 0 and budget_minor <= 1000000000000000)),
  add column updated_at timestamptz not null default now();

-- A service inserted without a label gets the name of its type (existing rows, raw inserts).
create function project_services_default_label() returns trigger language plpgsql as $$
begin
  if new.label is null or btrim(new.label) = '' then
    new.label := case new.service_type
      when 'flight' then 'Flight' when 'hotel' then 'Hotel' when 'transportation' then 'Transportation'
      when 'mice' then 'MICE' else 'Additional' end;
  end if;
  return new;
end $$;
create trigger project_services_default_label before insert on project_services
  for each row execute function project_services_default_label();
update project_services set label = case service_type
  when 'flight' then 'Flight' when 'hotel' then 'Hotel' when 'transportation' then 'Transportation'
  when 'mice' then 'MICE' else 'Additional' end;
alter table project_services alter column label set not null;
alter table project_services add constraint project_services_label check (btrim(label) <> '');

alter table booking_refs
  add column status text,
  add column net_cost_minor bigint check (net_cost_minor is null or (net_cost_minor >= 0 and net_cost_minor <= 1000000000000000)),
  add column reference text,
  add column status_reason text,
  add column details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  add column updated_at timestamptz not null default now(),
  add constraint booking_refs_sell_max check (sell_amount_minor is null or sell_amount_minor <= 1000000000000000);

-- A booking inserted without a status starts at the first status of its type.
create function booking_refs_default_status() returns trigger language plpgsql as $$
begin
  if new.status is null then
    new.status := case when new.booking_type = 'mice' then 'planning' else 'requested' end;
  end if;
  return new;
end $$;
create trigger booking_refs_default_status before insert on booking_refs
  for each row execute function booking_refs_default_status();
update booking_refs set status = case when booking_type = 'mice' then 'planning' else 'requested' end;
alter table booking_refs alter column status set not null;
alter table booking_refs add constraint booking_refs_status check (
  (booking_type = 'flight' and status in ('requested', 'hold', 'confirmed', 'issued', 'reissued', 'cancelled', 'refunded')) or
  (booking_type = 'hotel' and status in ('requested', 'quoted', 'confirmed', 'amended', 'completed', 'cancelled', 'no-show')) or
  (booking_type = 'transport' and status in ('requested', 'quoted', 'assigned', 'confirmed', 'completed', 'cancelled', 'no-show')) or
  (booking_type = 'mice' and status in ('planning', 'confirmed', 'in-progress', 'completed', 'cancelled')));
create index booking_refs_service on booking_refs (service_id) where service_id is not null;

insert into id_sequences (prefix, last_value)
select 'SVC-', coalesce(max(substring(id from '^SVC-([0-9]+)$')::integer), 0) from project_services
on conflict (prefix) do nothing;
insert into id_sequences (prefix, last_value)
select p.prefix, coalesce(max(substring(b.booking_id from '^' || p.prefix || '([0-9]+)$')::integer), 0)
  from (values ('FLT-', 'flight'), ('HTL-', 'hotel'), ('TRN-', 'transport'), ('MICE-', 'mice')) as p(prefix, booking_type)
  left join booking_refs b on b.booking_type = p.booking_type
 group by p.prefix
on conflict (prefix) do nothing;
