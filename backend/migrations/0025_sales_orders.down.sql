delete from id_sequences where prefix = 'SLO-';
delete from sales_order_refs where project_id is null;
drop index if exists sales_order_refs_lead;
alter table sales_order_refs
  drop constraint if exists sales_order_refs_period,
  drop column if exists status, drop column if exists status_reason, drop column if exists status_changed_at,
  drop column if exists destination, drop column if exists travel_start_date, drop column if exists travel_end_date,
  drop column if exists note, drop column if exists lead_id, drop column if exists paid_on, drop column if exists created_on,
  drop column if exists updated_at,
  alter column project_id set not null;
