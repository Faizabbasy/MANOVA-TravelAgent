-- S11b: marketing content schedule (what goes out on which platform and when) and the content development pipeline.
create table content_schedule (
  id                text primary key check (id <> ''),
  publish_date      date not null,
  platform          text not null check (platform in ('instagram', 'tiktok', 'website', 'email', 'youtube', 'linkedin')),
  title             text not null check (title <> ''),
  status            text not null check (status in ('draft', 'scheduled', 'published')),
  -- Campaigns are still a frontend mock, so this is a plain reference without a foreign key.
  campaign_id       text,
  note              text,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index content_schedule_date on content_schedule (publish_date);

create table content_development (
  id                text primary key check (id <> ''),
  title             text not null check (title <> ''),
  stage             text not null check (stage in ('idea', 'draft', 'review', 'ready')),
  platform          text not null check (platform in ('instagram', 'tiktok', 'website', 'email', 'youtube', 'linkedin')),
  owner_id          text references users (id),
  note              text,
  updated_on        date not null default current_date,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
