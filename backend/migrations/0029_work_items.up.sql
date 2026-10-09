-- S7c: project tasks and milestones (API-owned). A task without a project is a general to-do from /tasks.
create table project_tasks (
  id                text primary key check (id <> ''),
  project_id        text references projects (id),
  title             text not null check (title <> ''),
  status            text not null default 'not-started'
    check (status in ('not-started', 'in-progress', 'pending-confirmation', 'done', 'overdue')),
  due_on            date,
  is_milestone      boolean not null default false,
  depends_on        text references project_tasks (id),
  assigned_to       text references users (id),
  is_blocked        boolean not null default false,
  blocked_reason    text,
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (is_blocked = (blocked_reason is not null))
);
create index project_tasks_project on project_tasks (project_id);

create table project_milestones (
  id                text primary key check (id <> ''),
  project_id        text not null references projects (id),
  step_key          text check (step_key in ('drafting', 'confirmed', 'start', 'departure', 'on-progress', 'done')),
  name              text not null check (name <> ''),
  planned_on        date not null,
  actual_on         date,
  owner_id          text references users (id),
  status            text not null default 'not-started'
    check (status in ('not-started', 'in-progress', 'completed', 'delayed', 'cancelled')),
  note              text,
  budget_minor      bigint check (budget_minor >= 0),
  deliverables      jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  changed_by_api_at timestamptz,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index project_milestones_project on project_milestones (project_id, planned_on);

insert into id_sequences (prefix, last_value) values ('TSK-', 0), ('PMS-', 0) on conflict (prefix) do nothing;
