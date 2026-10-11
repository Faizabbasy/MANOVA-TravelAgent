-- S9: document metadata and messages (API-owned). No file storage: a document is its metadata, like the UI today.
create table documents (
  id              text primary key check (id <> ''),
  entity_type     text not null check (entity_type in ('project', 'party', 'vendor', 'traveler', 'quotation', 'flight', 'hotel', 'transport', 'mice',
                                                       'invoice', 'change-request', 'incident', 'travel-request', 'approval')),
  entity_id       text not null check (entity_id <> ''),
  project_id      text references projects (id),
  name            text not null check (name <> ''),
  category        text not null check (category <> ''),
  version         integer not null default 1 check (version >= 1),
  access_level    text not null check (access_level in ('internal', 'client', 'supplier')),
  source_type     text not null check (source_type in ('uploaded', 'generated')),
  preview_route   text,
  uploaded_by     text references users (id),
  uploaded_on     date,
  generated_on    date,
  expires_on      date,
  supersedes_id   text references documents (id),
  verified        boolean not null default false,
  verified_by     text references users (id),
  verified_on     date,
  provenance      text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at      timestamptz not null default now()
);
create index documents_project on documents (project_id);
create index documents_entity on documents (entity_type, entity_id);

create table messages (
  id               text primary key check (id <> ''),
  entity_type      text not null check (entity_type in ('project', 'party', 'vendor', 'traveler', 'quotation', 'flight', 'hotel', 'transport', 'mice',
                                                        'invoice', 'change-request', 'incident', 'travel-request', 'approval')),
  entity_id        text not null check (entity_id <> ''),
  project_id       text references projects (id),
  channel          text not null check (channel in ('internal-note', 'client-message', 'supplier-message')),
  sender_id        text not null references users (id),
  body             text not null check (body <> ''),
  mentions         jsonb not null default '[]'::jsonb check (jsonb_typeof(mentions) = 'array'),
  delivery_status  text not null check (delivery_status in ('queued', 'sent', 'delivered', 'failed')),
  delivery_channel text check (delivery_channel in ('email', 'whatsapp')),
  attachment_name  text,
  read_by          jsonb not null default '[]'::jsonb check (jsonb_typeof(read_by) = 'array'),
  sent_at          timestamptz not null default now(),
  provenance       text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at       timestamptz not null default now()
);
create index messages_project on messages (project_id);

insert into id_sequences (prefix, last_value) values ('DOC-', 0), ('MSG-', 0) on conflict (prefix) do nothing;
