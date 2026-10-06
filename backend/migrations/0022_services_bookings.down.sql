delete from id_sequences where prefix in ('SVC-', 'FLT-', 'HTL-', 'TRN-', 'MICE-');
drop index if exists booking_refs_service;
drop trigger if exists booking_refs_default_status on booking_refs;
drop function if exists booking_refs_default_status();
alter table booking_refs
  drop constraint if exists booking_refs_status, drop constraint if exists booking_refs_sell_max,
  drop column if exists status, drop column if exists net_cost_minor, drop column if exists reference,
  drop column if exists status_reason, drop column if exists details, drop column if exists updated_at;
drop trigger if exists project_services_default_label on project_services;
drop function if exists project_services_default_label();
alter table project_services
  drop constraint if exists project_services_label,
  drop column if exists label, drop column if exists status, drop column if exists booking_reference,
  drop column if exists budget_minor, drop column if exists updated_at;
