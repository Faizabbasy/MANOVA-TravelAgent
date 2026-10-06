drop table if exists id_sequences;
alter table projects
  drop column if exists characteristic,
  drop column if exists service_scope,
  drop column if exists traveler_count,
  drop column if exists is_group_trip,
  drop column if exists lead_id,
  drop column if exists source_quotation_id,
  drop column if exists tour_leader_name,
  drop column if exists tour_leader_phone,
  drop column if exists emergency_contact_name,
  drop column if exists emergency_contact_phone,
  drop column if exists meeting_point;
