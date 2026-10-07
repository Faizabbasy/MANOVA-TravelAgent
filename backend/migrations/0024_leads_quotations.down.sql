delete from id_sequences where prefix in ('LED-', 'LACT-', 'QUO-');
alter table projects drop constraint if exists projects_source_quotation_fk;
alter table projects drop constraint if exists projects_lead_fk;
drop table if exists quotation_versions;
drop table if exists quotations;
drop table if exists lead_activities;
drop table if exists leads;
