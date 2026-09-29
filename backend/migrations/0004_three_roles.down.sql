-- Lossy by nature: the original split between management/sales/operations is not recorded, so every admin
-- goes back to `operations` (the role that owned most former capabilities). Restore from backup if the exact
-- split matters.

alter table users drop constraint users_role_check;

update users set role = 'operations', updated_at = now() where role = 'admin';

alter table users add constraint users_role_check
  check (role in ('super-admin', 'management', 'sales', 'finance', 'operations', 'client', 'vendor'));
