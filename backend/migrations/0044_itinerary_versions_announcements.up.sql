-- S12c-4: itinerary versions the client approves (a snapshot of the client-visible items, never changed after) and
-- trip announcements the client confirms — API-owned.
create table itinerary_versions (
  id               text primary key check (id <> ''),
  project_id       text not null references projects (id),
  version_number   integer not null check (version_number > 0),
  status           text not null check (status in ('waiting-approval', 'approved', 'revision-requested', 'superseded')),
  items            jsonb not null,
  note             text,
  revision_comment text,
  created_by       text not null references users (id),
  created_at       timestamptz not null default now(),
  decided_by       text references users (id),
  decided_at       timestamptz,
  unique (project_id, version_number),
  check (status <> 'revision-requested' or btrim(coalesce(revision_comment, '')) <> '')
);
create index itinerary_versions_project on itinerary_versions (project_id);

create table trip_announcements (
  id                    text primary key check (id <> ''),
  project_id            text not null references projects (id),
  title                 text not null check (btrim(title) <> ''),
  message               text not null check (btrim(message) <> ''),
  requires_confirmation boolean not null default false,
  published_by          text not null references users (id),
  published_at          timestamptz not null default now()
);
create index trip_announcements_project on trip_announcements (project_id);

create table trip_announcement_confirmations (
  announcement_id text not null references trip_announcements (id),
  user_id         text not null references users (id),
  confirmed_at    timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
