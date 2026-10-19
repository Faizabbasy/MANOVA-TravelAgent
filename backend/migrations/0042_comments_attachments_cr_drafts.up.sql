-- S12c-5: comments and attachment names on client-facing records, and the client's change-request drafts — API-owned.
-- `entity_type` + `entity_id` name the record (`itinerary` = a project's itinerary, entity_id is the project id).
create table entity_comments (
  id             text primary key check (id <> ''),
  entity_type    text not null check (entity_type in ('change-request', 'quotation', 'document', 'itinerary', 'travel-request')),
  entity_id      text not null check (entity_id <> ''),
  author_user_id text not null references users (id),
  from_client    boolean not null,
  body           text not null check (btrim(body) <> ''),
  created_at     timestamptz not null default now()
);
create index entity_comments_entity on entity_comments (entity_type, entity_id);

-- Name only: real files wait for ADR-005.
create table entity_attachments (
  id             text primary key check (id <> ''),
  entity_type    text not null check (entity_type in ('change-request', 'quotation', 'travel-request')),
  entity_id      text not null check (entity_id <> ''),
  file_name      text not null check (btrim(file_name) <> ''),
  uploaded_by    text not null references users (id),
  from_client    boolean not null,
  created_at     timestamptz not null default now()
);
create index entity_attachments_entity on entity_attachments (entity_type, entity_id);

create table change_request_drafts (
  id             text primary key check (id <> ''),
  project_id     text not null references projects (id),
  party_id       text not null references parties (id),
  created_by     text not null references users (id),
  change_type    text,
  before_summary text not null default '',
  after_summary  text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index change_request_drafts_party on change_request_drafts (party_id);
