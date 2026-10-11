-- S9b: in-app notifications (API-owned), one recipient per row. Created by the server inside the action's transaction.
create table notifications (
  id          text primary key check (id <> ''),
  user_id     text not null references users (id),
  type        text not null check (type in ('mention', 'assignment', 'reminder', 'escalation', 'change', 'incident', 'document', 'message')),
  title       text not null check (title <> ''),
  body        text not null,
  entity_type text,
  entity_id   text,
  category    text check (category in ('approval', 'project', 'participant', 'reservation', 'document', 'payment', 'trip', 'support', 'system')),
  read        boolean not null default false,
  provenance  text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at  timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at);

insert into id_sequences (prefix, last_value) values ('NOT-', 0) on conflict (prefix) do nothing;
