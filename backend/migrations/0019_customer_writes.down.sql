delete from id_sequences where prefix in ('CP-', 'PACT-');
drop table if exists party_activities;
drop table if exists party_contacts;
alter table parties
  drop column if exists industry, drop column if exists company_type, drop column if exists size,
  drop column if exists address, drop column if exists city, drop column if exists province,
  drop column if exists country, drop column if exists postal_code, drop column if exists phone,
  drop column if exists email, drop column if exists website, drop column if exists account_owner_user_id,
  drop column if exists registration_number, drop column if exists npwp, drop column if exists billing_name,
  drop column if exists billing_address, drop column if exists payment_term, drop column if exists po_required,
  drop column if exists travel_preferences, drop column if exists credit_limit_minor;
