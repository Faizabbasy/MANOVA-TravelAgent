-- S11c: human resources. Money (salary, allowance, deduction, incentive) is owned by Finance and Super Admin
-- (hr.manage-payroll); commissions are derived from projects by the API, never stored. Payroll keeps its status only:
-- paying salaries is booked by Finance through its own cash flow.
create table employees (
  id                      text primary key check (id <> ''),
  user_id                 text unique references users (id),
  name                    text not null check (name <> ''),
  position                text not null check (position <> ''),
  department              text not null check (department <> ''),
  employment_type         text not null check (employment_type in ('full-time', 'contract', 'freelance')),
  status                  text not null check (status in ('active', 'on-leave', 'resigned')),
  joined_on               date not null,
  phone                   text,
  email                   text,
  -- 0 = paid per project (freelance).
  base_salary_minor       bigint not null default 0 check (base_salary_minor >= 0),
  commission_rate_percent numeric(5, 2) check (commission_rate_percent > 0 and commission_rate_percent <= 100),
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table attendance_records (
  id           text primary key check (id <> ''),
  employee_id  text not null references employees (id),
  date         date not null,
  status       text not null check (status in ('present', 'remote', 'leave', 'sick', 'absent')),
  check_in_at  text,
  check_out_at text,
  note         text,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (employee_id, date)
);

create table performance_reviews (
  id                  text primary key check (id <> ''),
  employee_id         text not null references employees (id),
  period              text not null check (period <> ''),
  reviewer_id         text not null references users (id),
  delivery_score      numeric(3, 2) not null check (delivery_score between 1 and 5),
  quality_score       numeric(3, 2) not null check (quality_score between 1 and 5),
  collaboration_score numeric(3, 2) not null check (collaboration_score between 1 and 5),
  initiative_score    numeric(3, 2) not null check (initiative_score between 1 and 5),
  overall_score       numeric(3, 2) not null check (overall_score between 1 and 5),
  strengths           text,
  improvements        text,
  reviewed_on         date not null,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table payroll_runs (
  id          text primary key check (id <> ''),
  period      text not null unique check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status      text not null check (status in ('draft', 'approved', 'paid')),
  approved_by text references users (id),
  approved_on date,
  paid_on     date,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((status = 'draft') = (approved_on is null)),
  check ((status = 'paid') = (paid_on is not null))
);

create table payroll_lines (
  id                text primary key check (id <> ''),
  payroll_run_id    text not null references payroll_runs (id),
  employee_id       text not null references employees (id),
  base_salary_minor bigint not null check (base_salary_minor >= 0),
  allowance_minor   bigint not null default 0 check (allowance_minor >= 0),
  deduction_minor   bigint not null default 0 check (deduction_minor >= 0),
  note              text,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);

create table incentives (
  id           text primary key check (id <> ''),
  employee_id  text not null references employees (id),
  project_id   text not null references projects (id),
  period       text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_minor bigint not null check (amount_minor > 0),
  note         text,
  provenance        text not null default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual')
    check (provenance in ('manual', 'demo-fixture', 'migration')),
  changed_by_api_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index incentives_period on incentives (period);
