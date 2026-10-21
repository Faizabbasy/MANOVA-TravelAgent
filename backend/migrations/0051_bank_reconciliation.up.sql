-- Owner accounting F7: bank statement import and reconciliation. Importing a statement never creates cash; lines are
-- matched to existing financial_transactions (many-to-many, split/fee), or a confirmed source transaction is created first.

create table bank_statement_imports (
  id               text primary key,
  bank_account_id  text not null references bank_accounts (id),
  file_name        text not null check (length(btrim(file_name)) between 1 and 200),
  file_sha256      text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  mapping          jsonb not null check (jsonb_typeof(mapping) = 'object'),
  row_count        integer not null check (row_count >= 0),
  skipped_duplicates integer not null default 0 check (skipped_duplicates >= 0),
  imported_by      text not null references users (id),
  imported_at      timestamptz not null default now(),
  unique (bank_account_id, file_sha256)
);

create table bank_statement_lines (
  id               text primary key,
  import_id        text not null references bank_statement_imports (id),
  bank_account_id  text not null references bank_accounts (id),
  line_no          integer not null check (line_no > 0),
  booked_on        date not null,
  description      text not null,
  direction        text not null check (direction in ('in', 'out')),
  amount_minor     bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  external_ref     text,
  -- Identity of a row without a bank reference: same date/side/amount/description AND its occurrence number in the file,
  -- so two legitimate identical transactions stay two, while re-importing an overlapping file skips them.
  row_identity     text not null,
  raw              jsonb not null check (jsonb_typeof(raw) = 'array'),
  unique (import_id, line_no),
  unique (bank_account_id, row_identity)
);
create index bank_statement_lines_account_date on bank_statement_lines (bank_account_id, booked_on);
create trigger bank_statement_imports_immutable before update or delete or truncate on bank_statement_imports
  for each statement execute function accounting_immutable();
create trigger bank_statement_lines_immutable before update or delete or truncate on bank_statement_lines
  for each statement execute function accounting_immutable();

-- A match links part of a statement line to part of a cash transaction. Unmatch keeps the row (history), never deletes.
create table bank_reconciliation_matches (
  id               bigint generated always as identity primary key,
  statement_line_id text not null references bank_statement_lines (id),
  transaction_id   text not null references financial_transactions (id),
  amount_minor     bigint not null check (amount_minor > 0),
  matched_by       text not null references users (id),
  matched_at       timestamptz not null default now(),
  unmatched_by     text references users (id),
  unmatched_at     timestamptz,
  unmatch_reason   text,
  check ((unmatched_at is null) = (unmatched_by is null)),
  check (unmatched_at is null or length(btrim(unmatch_reason)) >= 5)
);
create index bank_reconciliation_matches_line on bank_reconciliation_matches (statement_line_id) where unmatched_at is null;
create index bank_reconciliation_matches_tx on bank_reconciliation_matches (transaction_id) where unmatched_at is null;

create function bank_reconciliation_guard() returns trigger language plpgsql as $$
declare l bank_statement_lines; t financial_transactions; line_used numeric; tx_used numeric;
begin
  if tg_op = 'DELETE' then raise exception 'Reconciliation history is immutable; unmatch instead'; end if;
  if tg_op = 'UPDATE' then
    if old.unmatched_at is not null or new.unmatched_at is null or (new.statement_line_id, new.transaction_id, new.amount_minor, new.matched_by, new.matched_at)
       is distinct from (old.statement_line_id, old.transaction_id, old.amount_minor, old.matched_by, old.matched_at) then
      raise exception 'A match can only be undone once, with a reason';
    end if;
    return new;
  end if;
  select * into l from bank_statement_lines where id = new.statement_line_id for update;
  select * into t from financial_transactions where id = new.transaction_id for update;
  if t.bank_account_id <> l.bank_account_id or t.direction <> l.direction then
    raise exception 'Statement line and transaction must be the same account and direction' using errcode = '23514';
  end if;
  if t.reversal_of_id is not null or exists (select 1 from financial_transactions r where r.reversal_of_id = t.id) then
    raise exception 'A reversed transaction cannot reconcile a statement line' using errcode = '23514';
  end if;
  select coalesce(sum(amount_minor), 0) into line_used from bank_reconciliation_matches where statement_line_id = l.id and unmatched_at is null;
  select coalesce(sum(amount_minor), 0) into tx_used from bank_reconciliation_matches where transaction_id = t.id and unmatched_at is null;
  if line_used + new.amount_minor > l.amount_minor or tx_used + new.amount_minor > t.amount_minor then
    raise exception 'Matched amount exceeds the statement line or the transaction' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger bank_reconciliation_guard before insert or update or delete on bank_reconciliation_matches
  for each row execute function bank_reconciliation_guard();
create trigger bank_reconciliation_no_truncate before truncate on bank_reconciliation_matches
  for each statement execute function accounting_immutable();
