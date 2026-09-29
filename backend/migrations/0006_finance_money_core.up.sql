-- Finance Phase 2 — money foundation (ADR-007, FINANCE-DOMAIN-MAPPING §6.1).
-- One cash book: every rupiah that really moves is exactly one immutable row in financial_transactions.
-- Statement, account ledger, balances and (later) receivables/payables/cash flow are computed from it.

create sequence finance_bank_account_seq;
create sequence finance_transaction_seq;
create sequence finance_transfer_seq;

create table bank_accounts (
  id                    text primary key default ('BA-' || lpad(nextval('finance_bank_account_seq')::text, 3, '0')),
  code                  text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  bank_name             text not null check (btrim(bank_name) <> ''),
  holder_name           text not null check (btrim(holder_name) <> ''),
  -- Full number is only returned to finance.manage-bank-accounts holders; everyone else sees it masked.
  account_number        text not null check (account_number ~ '^[0-9][0-9 -]{3,40}[0-9]$'),
  currency              text not null default 'IDR' check (currency = 'IDR'), -- V1: IDR only
  is_active             boolean not null default true,
  -- Opening balance: maker (finance) submits, checker (super-admin) verifies. Cash figures stay
  -- "unavailable" until verified — never a fake Rp0.
  opening_status        text not null default 'unset' check (opening_status in ('unset', 'pending', 'verified')),
  opening_balance_minor bigint check (opening_balance_minor is null or opening_balance_minor >= 0),
  opening_date          date,
  opening_note          text,
  opening_submitted_by  text references users (id),
  opening_submitted_at  timestamptz,
  opening_verified_by   text references users (id),
  opening_verified_at   timestamptz,
  provenance            text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_by            text not null references users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint bank_accounts_opening_complete check (
    opening_status = 'unset'
    or (opening_balance_minor is not null and opening_date is not null and opening_submitted_by is not null))
  ,
  constraint bank_accounts_opening_verified check (
    (opening_status = 'verified') = (opening_verified_by is not null and opening_verified_at is not null))
);

create unique index bank_accounts_code_key on bank_accounts (code);

-- An internal move between two own accounts (+ optional bank fee charged to the sender).
create table transfers (
  id              text primary key default ('TRF-' || lpad(nextval('finance_transfer_seq')::text, 5, '0')),
  from_account_id text not null references bank_accounts (id),
  to_account_id   text not null references bank_accounts (id),
  amount_minor    bigint not null check (amount_minor > 0),
  fee_minor       bigint not null default 0 check (fee_minor >= 0),
  effective_date  date not null,
  memo            text,
  created_by      text not null references users (id),
  created_at      timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create table financial_transactions (
  id              text primary key default ('TRX-' || lpad(nextval('finance_transaction_seq')::text, 6, '0')),
  bank_account_id text not null references bank_accounts (id),
  direction       text not null check (direction in ('in', 'out')),
  amount_minor    bigint not null check (amount_minor > 0),
  currency        text not null check (currency ~ '^[A-Z]{3}$'),
  kind            text not null check (kind in (
                    'customer_receipt', 'vendor_refund', 'other_income', 'transfer_in',
                    'vendor_payment', 'refund_settlement', 'expense', 'transfer_out', 'transfer_fee')),
  -- Business date the money moved (Asia/Jakarta); posted_at is when it was recorded.
  effective_date  date not null,
  posted_at       timestamptz not null default now(),
  project_id      text references projects (id),
  booking_type    text,
  booking_id      text,
  party_id        text references parties (id),
  vendor_id       text references vendors (id),
  counterparty    text,
  reference       text,
  memo            text,
  category        text check (category is null or category in (
                    'payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other')),
  transfer_id     text references transfers (id),
  reversal_of_id  text references financial_transactions (id),
  reversal_reason text,
  provenance      text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_by      text not null references users (id),

  constraint financial_transactions_booking_fk
    foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id),
  constraint financial_transactions_booking_pair check ((booking_type is null) = (booking_id is null)),
  -- A kind has a natural direction; only a reversal row runs the opposite way (and must say why).
  constraint financial_transactions_direction_matches_kind check (
    (reversal_of_id is null) = (direction = case
      when kind in ('customer_receipt', 'vendor_refund', 'other_income', 'transfer_in') then 'in'
      else 'out' end)),
  constraint financial_transactions_reversal_reason check ((reversal_of_id is null) = (reversal_reason is null)),
  -- Transfer legs always belong to a transfer; nothing else may claim one.
  constraint financial_transactions_transfer_link check (
    (kind in ('transfer_in', 'transfer_out', 'transfer_fee')) = (transfer_id is not null)),
  constraint financial_transactions_expense_category check (
    kind <> 'expense' or reversal_of_id is not null or category is not null)
);

-- One reversal per original, ever.
create unique index financial_transactions_reversal_key on financial_transactions (reversal_of_id) where reversal_of_id is not null;
create index financial_transactions_account_idx on financial_transactions (bank_account_id, effective_date, posted_at, id);
create index financial_transactions_date_idx on financial_transactions (effective_date, id);
create index financial_transactions_project_idx on financial_transactions (project_id) where project_id is not null;
create index financial_transactions_booking_idx on financial_transactions (booking_type, booking_id) where booking_id is not null;
create index financial_transactions_transfer_idx on financial_transactions (transfer_id) where transfer_id is not null;

create function finance_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% rows are immutable; post a reversal instead', tg_table_name using errcode = '42501';
end
$$;

create trigger financial_transactions_immutable
  before update or delete on financial_transactions
  for each row execute function finance_block_mutation();

create trigger transfers_immutable
  before update or delete on transfers
  for each row execute function finance_block_mutation();

-- Replay protection for money-moving commands: same actor + route + key returns the first response.
create table idempotency_keys (
  actor_user_id text not null references users (id),
  route         text not null,
  key           text not null check (key ~ '^[A-Za-z0-9_-]{8,128}$'),
  request_hash  text not null,
  response      jsonb,
  created_at    timestamptz not null default now(),
  primary key (actor_user_id, route, key)
);
