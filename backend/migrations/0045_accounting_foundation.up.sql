-- Accounting is a derived ledger. No book, policy, opening or cash is activated by this migration.
create table accounting_books (
  id text primary key,
  singleton boolean not null default true unique check (singleton),
  name text not null check (length(btrim(name)) between 2 and 120),
  purpose text not null check (purpose in ('rehearsal', 'production')),
  mode text not null default 'off' check (mode in ('off', 'shadow', 'active')),
  currency text not null default 'IDR' check (currency = 'IDR'),
  timezone text not null default 'Asia/Jakarta' check (timezone in ('Asia/Jakarta', 'Asia/Bangkok')),
  entity_type text not null default 'unknown',
  accounting_standard text not null default 'unknown',
  owner_mode text not null default 'team' check (owner_mode in ('team', 'single-owner')),
  tax_status text not null default 'unknown' check (tax_status in ('unknown', 'pending-validation', 'validated')),
  cutover_date date not null,
  opening_validated boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  check (mode <> 'shadow' or purpose = 'rehearsal'),
  check (mode <> 'active' or (opening_validated and entity_type <> 'unknown' and accounting_standard <> 'unknown'))
);

create table accounting_accounts (
  book_id text not null references accounting_books(id),
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  control_role text,
  required_dimension text check (required_dimension in ('bank', 'customer', 'vendor', 'employee')),
  primary key (book_id, code),
  unique (book_id, control_role),
  check (control_role is null or length(control_role) > 0)
);

create table accounting_periods (
  id text primary key,
  book_id text not null references accounting_books(id),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  version integer not null default 1 check (version > 0),
  changed_by text not null references users(id),
  reason text not null,
  check (ends_on >= starts_on),
  unique (book_id, id)
);

create table accounting_policies (
  id text primary key,
  book_id text not null references accounting_books(id),
  source_kind text not null,
  version integer not null check (version > 0),
  effective_from date not null,
  effective_to date,
  principal_agent text not null default 'unknown' check (principal_agent in ('unknown', 'principal', 'agent', 'mixed', 'not-applicable')),
  recognition text not null default 'unknown',
  tax_treatment text not null default 'unknown',
  validation_status text not null default 'draft' check (validation_status in ('draft', 'test-only', 'validated')),
  -- Configuration only; money, allocations and posting states are relational columns below.
  settings jsonb not null default '{}',
  rationale text not null check (length(btrim(rationale)) >= 5),
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  unique (book_id, source_kind, version),
  unique (book_id, id),
  check (effective_to is null or effective_to >= effective_from)
);

create table accounting_events (
  id text primary key,
  book_id text not null references accounting_books(id),
  source_type text not null,
  source_id text not null,
  source_version text not null,
  event_kind text not null,
  effective_date date not null,
  occurred_at timestamptz not null default now(),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  fingerprint text not null,
  actor_user_id text not null references users(id),
  request_id text not null,
  unique (book_id, source_type, source_id, source_version, event_kind),
  unique (book_id, id)
);
create index accounting_event_source on accounting_events (source_type, source_id, id);

create table accounting_journals (
  id text primary key,
  book_id text not null references accounting_books(id),
  event_id text not null,
  purpose text not null,
  policy_id text not null,
  period_id text not null,
  effective_date date not null,
  status text not null default 'draft' check (status in ('draft', 'posted')),
  description text not null,
  reversal_of_id text unique references accounting_journals(id),
  correction_reason text,
  posted_at timestamptz,
  foreign key (book_id, event_id) references accounting_events(book_id, id),
  foreign key (book_id, policy_id) references accounting_policies(book_id, id),
  foreign key (book_id, period_id) references accounting_periods(book_id, id),
  unique (book_id, event_id, purpose),
  unique (book_id, id),
  check (reversal_of_id is null or length(btrim(correction_reason)) >= 5),
  check ((status = 'posted') = (posted_at is not null))
);
create index accounting_journal_date on accounting_journals (book_id, effective_date, id);

create table accounting_journal_lines (
  journal_id text not null,
  book_id text not null,
  line_no integer not null check (line_no > 0),
  account_code text not null,
  debit_minor bigint not null default 0 check (debit_minor between 0 and 1000000000000000),
  credit_minor bigint not null default 0 check (credit_minor between 0 and 1000000000000000),
  bank_account_id text references bank_accounts(id),
  project_id text references projects(id),
  sales_order_id text references sales_order_refs(id),
  party_id text references parties(id),
  vendor_id text references vendors(id),
  employee_id text references employees(id),
  primary key (journal_id, line_no),
  foreign key (book_id, journal_id) references accounting_journals(book_id, id),
  foreign key (book_id, account_code) references accounting_accounts(book_id, code),
  check ((debit_minor > 0 and credit_minor = 0) or (credit_minor > 0 and debit_minor = 0))
);
create index accounting_line_account on accounting_journal_lines (book_id, account_code, journal_id);
create index accounting_line_project on accounting_journal_lines (project_id, journal_id);
create index accounting_line_order on accounting_journal_lines (sales_order_id, journal_id);

create table accounting_posting_registry (
  book_id text not null,
  event_id text not null,
  purpose text not null,
  status text not null check (status in ('pending', 'posted')),
  reason_code text,
  reason_message text,
  journal_id text unique,
  updated_at timestamptz not null default now(),
  primary key (book_id, event_id, purpose),
  foreign key (book_id, event_id) references accounting_events(book_id, id),
  foreign key (book_id, journal_id) references accounting_journals(book_id, id),
  check ((status = 'posted') = (journal_id is not null)),
  check (status <> 'pending' or (reason_code is not null and reason_message is not null))
);

create function accounting_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Accounting evidence is immutable; use a reversal or new version';
end $$;
create trigger accounting_events_immutable before update or delete or truncate on accounting_events
  for each statement execute function accounting_immutable();
create trigger accounting_policies_immutable before update or delete or truncate on accounting_policies
  for each statement execute function accounting_immutable();

create function accounting_period_guard() returns trigger language plpgsql as $$
begin
  perform 1 from accounting_books where id = new.book_id for update;
  if tg_op = 'UPDATE' and (old.book_id, old.starts_on, old.ends_on) is distinct from (new.book_id, new.starts_on, new.ends_on) then
    raise exception 'Period dates and book are immutable';
  end if;
  if exists (select 1 from accounting_periods p where p.book_id = new.book_id and p.id <> new.id
      and p.starts_on <= new.ends_on and p.ends_on >= new.starts_on) then
    raise exception 'Accounting periods overlap';
  end if;
  return new;
end $$;
create trigger accounting_period_guard before insert or update on accounting_periods
  for each row execute function accounting_period_guard();

create function accounting_journal_guard() returns trigger language plpgsql as $$
declare
  p accounting_periods; b accounting_books; pol accounting_policies;
  total_debit numeric; total_credit numeric; line_count integer;
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then raise exception 'Posted journal is immutable'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' and new.status = 'posted' then raise exception 'Create draft lines before posting'; end if;
  if tg_op = 'UPDATE' and old.status = 'posted' then raise exception 'Posted journal is immutable'; end if;
  if new.status = 'posted' then
    select * into b from accounting_books where id = new.book_id for update;
    select * into p from accounting_periods where id = new.period_id and book_id = new.book_id for update;
    select * into pol from accounting_policies where id = new.policy_id and book_id = new.book_id;
    if b.mode = 'off' or (b.mode = 'shadow' and b.purpose <> 'rehearsal') then raise exception 'Book is not postable'; end if;
    if p.status <> 'open' or new.effective_date not between p.starts_on and p.ends_on or new.effective_date < b.cutover_date then
      raise exception 'Accounting period is locked or date outside book';
    end if;
    if pol.validation_status = 'draft' or (pol.validation_status = 'test-only' and b.purpose <> 'rehearsal')
        or new.effective_date < pol.effective_from or (pol.effective_to is not null and new.effective_date > pol.effective_to)
        or pol.tax_treatment = 'unknown' or pol.principal_agent = 'unknown' or pol.recognition = 'unknown' then
      raise exception 'Accounting policy is not validated for this event';
    end if;
    if not exists (select 1 from accounting_events e where e.id = new.event_id and e.book_id = new.book_id and e.effective_date = new.effective_date) then
      raise exception 'Journal date must match frozen event';
    end if;
    select count(*), coalesce(sum(debit_minor),0), coalesce(sum(credit_minor),0)
      into line_count,total_debit,total_credit from accounting_journal_lines where journal_id = new.id;
    if line_count < 2 or total_debit <= 0 or total_debit <> total_credit then raise exception 'Journal must have balanced nonempty lines'; end if;
    if new.reversal_of_id is not null then
      if not exists (select 1 from accounting_journals j where j.id = new.reversal_of_id and j.book_id = new.book_id and j.status = 'posted' and j.reversal_of_id is null) then
        raise exception 'Invalid original journal for reversal';
      end if;
      if exists (
        (select account_code, credit_minor, debit_minor, bank_account_id, project_id, sales_order_id, party_id, vendor_id, employee_id
         from accounting_journal_lines where journal_id = new.reversal_of_id
         except all select account_code, debit_minor, credit_minor, bank_account_id, project_id, sales_order_id, party_id, vendor_id, employee_id
         from accounting_journal_lines where journal_id = new.id)
        union all
        (select account_code, debit_minor, credit_minor, bank_account_id, project_id, sales_order_id, party_id, vendor_id, employee_id
         from accounting_journal_lines where journal_id = new.id
         except all select account_code, credit_minor, debit_minor, bank_account_id, project_id, sales_order_id, party_id, vendor_id, employee_id
         from accounting_journal_lines where journal_id = new.reversal_of_id)
      ) then raise exception 'Reversal must exactly compensate original lines'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger accounting_journal_guard before insert or update or delete on accounting_journals
  for each row execute function accounting_journal_guard();
create trigger accounting_journals_no_truncate before truncate on accounting_journals
  for each statement execute function accounting_immutable();

create function accounting_line_guard() returns trigger language plpgsql as $$
declare j accounting_journals; a accounting_accounts;
begin
  if tg_op <> 'INSERT' then
    select * into j from accounting_journals where id = old.journal_id for update;
    if j.status = 'posted' then raise exception 'Posted journal lines are immutable'; end if;
    if tg_op = 'DELETE' then return old; end if;
  end if;
  select * into j from accounting_journals where id = new.journal_id for update;
  if j.status = 'posted' then raise exception 'Posted journal lines are immutable'; end if;
  select * into a from accounting_accounts where book_id = new.book_id and code = new.account_code;
  if (a.required_dimension = 'bank' and new.bank_account_id is null)
     or (a.required_dimension = 'customer' and new.party_id is null)
     or (a.required_dimension = 'vendor' and new.vendor_id is null)
     or (a.required_dimension = 'employee' and new.employee_id is null) then
    raise exception 'Control account requires its counterparty dimension';
  end if;
  if new.sales_order_id is not null and not exists (select 1 from sales_order_refs s where s.id = new.sales_order_id
       and (new.project_id is null or s.project_id = new.project_id) and (new.party_id is null or s.party_id = new.party_id)) then
    raise exception 'Order dimensions do not match';
  end if;
  if new.party_id is not null and new.project_id is not null and not exists (
    select 1 from projects p where p.id=new.project_id and p.party_id=new.party_id
    union all select 1 from sales_order_refs s where s.project_id=new.project_id and s.party_id=new.party_id
  ) then raise exception 'Customer does not belong to journal project'; end if;
  return new;
end $$;
create trigger accounting_line_guard before insert or update or delete on accounting_journal_lines
  for each row execute function accounting_line_guard();
create trigger accounting_lines_no_truncate before truncate on accounting_journal_lines
  for each statement execute function accounting_immutable();

create trigger accounting_accounts_immutable before update or delete or truncate on accounting_accounts
  for each statement execute function accounting_immutable();

create function accounting_registry_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Posting registry evidence is immutable'; end if;
  if tg_op = 'UPDATE' and old.status = 'posted' then raise exception 'Posted registry is immutable'; end if;
  if new.status = 'posted' and not exists (select 1 from accounting_journals j where j.id = new.journal_id
      and j.book_id = new.book_id and j.event_id = new.event_id and j.purpose = new.purpose and j.status = 'posted') then
    raise exception 'Registry must point at its own posted journal';
  end if;
  return new;
end $$;
create trigger accounting_registry_guard before insert or update or delete on accounting_posting_registry
  for each row execute function accounting_registry_guard();
create trigger accounting_registry_no_truncate before truncate on accounting_posting_registry
  for each statement execute function accounting_immutable();

-- Last defence against a new/unhooked cash code path silently bypassing an ACTIVE book.
-- Deferred until commit so the domain service can write source then journal in the same transaction.
create function accounting_cash_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode = 'active' and new.effective_date < b.cutover_date then
    raise exception 'New cash before cutover requires controlled opening correction';
  end if;
  if b.mode = 'active' and new.effective_date >= b.cutover_date and not exists (
    select 1 from accounting_events e join accounting_posting_registry r on r.event_id = e.id and r.book_id = e.book_id
    join accounting_journals j on j.id = r.journal_id and j.status = 'posted'
    where e.book_id = b.id and e.source_type = 'financial_transaction' and e.source_id = new.id and r.status = 'posted'
  ) then raise exception 'Mandatory accounting posting missing for cash source %',new.id; end if;
  return new;
end $$;
create constraint trigger accounting_cash_mandatory after insert on financial_transactions
  deferrable initially deferred for each row execute function accounting_cash_mandatory();
