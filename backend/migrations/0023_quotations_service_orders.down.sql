delete from id_sequences where prefix in ('VQ-', 'SO-', 'BAT-');
drop table if exists booking_attempts;
alter table booking_refs drop column if exists flagged_duplicate, drop column if exists duplicate_of, drop column if exists duplicate_note;
drop index if exists service_orders_one_active;
alter table service_orders
  drop column if exists status, drop column if exists net_cost_minor, drop column if exists line_items,
  drop column if exists source_quotation_id, drop column if exists status_reason, drop column if exists acknowledged_at,
  drop column if exists fulfilled_at, drop column if exists updated_at;
drop table if exists vendor_quotations;
