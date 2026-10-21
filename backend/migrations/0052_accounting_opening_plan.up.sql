-- Owner accounting F9: opening balances at cutover. A plan is previewed read-only from Finance facts, confirmed once
-- (snapshot hash must still match), and posted as one balanced journal. Opening items map each pre-cutover source to
-- the position it opened with, so later settlements/allocations of those sources post without replaying history.
create table accounting_opening_plans (
  book_id        text primary key references accounting_books (id),
  plan_hash      text not null check (plan_hash ~ '^[0-9a-f]{64}$'),
  decisions      jsonb not null check (jsonb_typeof(decisions) = 'object'),
  journal_id     text not null,
  validated      boolean not null,
  confirmed_by   text not null references users (id),
  confirmed_at   timestamptz not null default now(),
  foreign key (book_id, journal_id) references accounting_journals (book_id, id)
);
create table accounting_opening_items (
  book_id      text not null references accounting_books (id),
  source_type  text not null,
  source_id    text not null,
  role         text not null,
  amount_minor bigint not null check (amount_minor > 0),
  primary key (book_id, source_type, source_id, role)
);
create trigger accounting_opening_plans_immutable before update or delete or truncate on accounting_opening_plans
  for each statement execute function accounting_immutable();
create trigger accounting_opening_items_immutable before update or delete or truncate on accounting_opening_items
  for each statement execute function accounting_immutable();
