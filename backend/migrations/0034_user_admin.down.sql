alter table users drop constraint if exists users_suspension_reason;
alter table users drop column if exists changed_by_api_at;
alter table users drop column if exists suspended_at;
alter table users drop column if exists suspended_reason;
