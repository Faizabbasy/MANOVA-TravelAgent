-- S12c-1: payment proofs a client sends for an invoice (Finance verifies them by posting the receipt) and sensitive
-- company-profile changes a client proposes (staff approve or reject them).
create table payment_proofs (
  id                     text primary key check (id <> ''),
  customer_invoice_id    text not null references customer_invoices (id),
  party_id               text not null references parties (id),
  submitted_by           text not null references users (id),
  reference              text not null check (btrim(reference) <> ''),
  amount_minor           bigint not null check (amount_minor > 0),
  transfer_date          date not null,
  sender_bank            text,
  note                   text,
  file_name              text,
  status                 text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  reviewed_by            text references users (id),
  reviewed_at            timestamptz,
  rejection_reason       text,
  receipt_transaction_id text references financial_transactions (id),
  created_at             timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null),
  check (status <> 'verified' or receipt_transaction_id is not null)
);
create unique index payment_proofs_one_open on payment_proofs (customer_invoice_id) where status = 'submitted';
create index payment_proofs_party on payment_proofs (party_id);

alter table customer_invoices add column client_viewed_at timestamptz;

create table party_profile_changes (
  id               text primary key check (id <> ''),
  party_id         text not null references parties (id),
  submitted_by     text not null references users (id),
  changes          jsonb not null check (jsonb_typeof(changes) = 'object'),
  status           text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  reviewed_by      text references users (id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null)
);
create unique index party_profile_changes_one_open on party_profile_changes (party_id) where status = 'submitted';

