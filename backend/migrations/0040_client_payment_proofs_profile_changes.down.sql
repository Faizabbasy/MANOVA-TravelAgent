drop table if exists party_profile_changes;
alter table customer_invoices drop column if exists client_viewed_at;
drop table if exists payment_proofs;
