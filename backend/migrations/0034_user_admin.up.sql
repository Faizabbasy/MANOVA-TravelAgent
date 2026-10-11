-- S10a: users are suspended / re-roled through the API (Super Admin only). A suspension always carries its reason;
-- changed_by_api_at keeps a demo re-seed from undoing an API change to status or role.
alter table users add column suspended_reason text;
alter table users add column suspended_at timestamptz;
alter table users add column changed_by_api_at timestamptz;
update users set suspended_reason = 'Dinonaktifkan sebelum S10a', suspended_at = updated_at where status = 'suspended' and suspended_reason is null;
alter table users add constraint users_suspension_reason check (status <> 'suspended' or suspended_reason is not null);
