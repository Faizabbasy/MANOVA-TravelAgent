delete from id_sequences where prefix in ('VND-', 'VCT-', 'VPR-', 'VDOC-');
drop table if exists vendor_documents;
drop table if exists vendor_products;
drop table if exists vendor_contacts;
alter table vendors drop column if exists contact_name, drop column if exists contact_phone, drop column if exists category;
