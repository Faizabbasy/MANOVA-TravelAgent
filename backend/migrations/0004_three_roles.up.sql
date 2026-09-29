-- Penyederhanaan 3-Role (ADR-006): management, sales and operations become one `admin` role
-- (every module except Finance). super-admin and finance are unchanged; client/vendor stay valid values
-- but cannot sign in while portals are switched off (enforced in the API, not here).

alter table users drop constraint users_role_check;

update users set role = 'admin', updated_at = now() where role in ('management', 'sales', 'operations');

alter table users add constraint users_role_check
  check (role in ('super-admin', 'admin', 'finance', 'client', 'vendor'));
