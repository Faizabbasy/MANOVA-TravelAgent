-- Server-side identity (ADR-003). The browser never supplies role or scope; they come from these rows.
-- Role keys mirror frontend/app/data/rbac.ts ROLE_DEFINITIONS.

create table users (
  id            text primary key check (id <> ''),
  email         text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  name          text not null check (btrim(name) <> ''),
  role          text not null check (role in ('super-admin', 'management', 'sales', 'finance', 'operations', 'client', 'vendor')),
  party_id      text references parties (id),
  vendor_id     text references vendors (id),
  status        text not null default 'active' check (status in ('active', 'suspended')),
  -- null = account cannot sign in with a password
  password_hash text,
  provenance    text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Portal roles are scoped to exactly one party/vendor; internal roles to neither.
  constraint users_scope_matches_role check (
       (role = 'client' and party_id is not null and vendor_id is null)
    or (role = 'vendor' and vendor_id is not null and party_id is null)
    or (role not in ('client', 'vendor') and party_id is null and vendor_id is null))
);

create unique index users_email_key on users (email);

-- id = sha256(token) in hex. The raw token only ever exists in the HttpOnly cookie.
create table sessions (
  id         text primary key check (id ~ '^[0-9a-f]{64}$'),
  user_id    text not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip         text,
  user_agent text,
  constraint sessions_expiry_after_creation check (expires_at > created_at)
);

create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

create table project_members (
  project_id text not null references projects (id) on delete cascade,
  user_id    text not null references users (id) on delete cascade,
  primary key (project_id, user_id)
);

create index project_members_user_idx on project_members (user_id);

alter table projects
  add constraint projects_owner_user_fk foreign key (owner_user_id) references users (id);
