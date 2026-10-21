-- Owner accounting F6: fixed-asset acquisition and depreciation, loans, and owner funds — all money still moves only
-- in financial_transactions; asset/loan records hold the non-cash facts (life, schedule, principal/interest split).

create table loans (
  id             text primary key,
  lender         text not null check (length(btrim(lender)) between 2 and 200),
  principal_minor bigint not null check (principal_minor > 0 and principal_minor <= 1000000000000000),
  received_on    date not null,
  terms          text not null check (length(btrim(terms)) between 5 and 1000),
  status         text not null default 'open' check (status in ('open', 'repaid')),
  created_by     text not null references users (id),
  created_at     timestamptz not null default now()
);

-- Capitalisation of an inventory asset: cost and depreciation basis. Creating/borrowing an asset card is not acquisition.
create table asset_capitalizations (
  asset_id          text primary key references assets (id),
  cost_minor        bigint not null check (cost_minor > 0 and cost_minor <= 1000000000000000),
  residual_minor    bigint not null default 0 check (residual_minor >= 0),
  acquired_on       date not null,
  in_service_on     date not null,
  useful_life_months integer not null check (useful_life_months between 1 and 600),
  method            text not null default 'straight-line' check (method = 'straight-line'),
  created_by        text not null references users (id),
  created_at        timestamptz not null default now(),
  check (residual_minor < cost_minor),
  check (in_service_on >= acquired_on)
);
create trigger asset_capitalizations_immutable before update or delete or truncate on asset_capitalizations
  for each statement execute function accounting_immutable();

-- One depreciation occurrence per asset and month; a retry or a second worker can never book the month twice.
create table asset_depreciations (
  asset_id     text not null references asset_capitalizations (asset_id),
  period       text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_minor bigint not null check (amount_minor > 0),
  created_by   text not null references users (id),
  created_at   timestamptz not null default now(),
  primary key (asset_id, period)
);
create trigger asset_depreciations_immutable before update or delete or truncate on asset_depreciations
  for each statement execute function accounting_immutable();

alter table financial_transactions add column asset_id text references assets (id);
alter table financial_transactions add column loan_id text references loans (id);
create table loan_repayments (
  transaction_id  text primary key references financial_transactions (id),
  loan_id         text not null references loans (id),
  principal_minor bigint not null check (principal_minor >= 0),
  interest_minor  bigint not null check (interest_minor >= 0),
  check (principal_minor + interest_minor > 0)
);

alter table financial_transactions drop constraint financial_transactions_kind_check;
alter table financial_transactions add constraint financial_transactions_kind_check check (kind in (
  'customer_receipt', 'vendor_refund', 'other_income', 'transfer_in', 'employee_advance_return', 'loan_proceeds', 'owner_contribution',
  'vendor_payment', 'refund_settlement', 'expense', 'transfer_out', 'transfer_fee',
  'employee_advance', 'employee_reimbursement', 'payroll_payment', 'asset_purchase', 'loan_repayment', 'owner_withdrawal'));
alter table financial_transactions drop constraint financial_transactions_direction_matches_kind;
alter table financial_transactions add constraint financial_transactions_direction_matches_kind check (
  (reversal_of_id is null) = (direction = case
    when kind in ('customer_receipt', 'vendor_refund', 'other_income', 'transfer_in', 'employee_advance_return', 'loan_proceeds', 'owner_contribution') then 'in'
    else 'out' end));
alter table financial_transactions add constraint financial_transactions_asset_link check ((kind = 'asset_purchase') = (asset_id is not null));
alter table financial_transactions add constraint financial_transactions_loan_link check ((kind in ('loan_proceeds', 'loan_repayment')) = (loan_id is not null));
create index financial_transactions_loan_idx on financial_transactions (loan_id) where loan_id is not null;

-- A repayment is split once into principal and interest, summing exactly to the cash that left.
create function loan_repayments_guard() returns trigger language plpgsql as $$
declare t financial_transactions;
begin
  if tg_op <> 'INSERT' then raise exception 'Loan repayment split is immutable; reverse the payment instead'; end if;
  select * into t from financial_transactions where id = new.transaction_id;
  if t.kind <> 'loan_repayment' or t.loan_id <> new.loan_id or t.reversal_of_id is not null or new.principal_minor + new.interest_minor <> t.amount_minor then
    raise exception 'Loan repayment split must match its payment' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger loan_repayments_guard before insert or update or delete on loan_repayments for each row execute function loan_repayments_guard();

-- Depreciation occurrences must be booked when a book is ACTIVE (deferred: the service writes row then journal).
create function accounting_depreciation_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' then return new; end if;
  if not exists (select 1 from accounting_events e join accounting_posting_registry r on r.event_id = e.id and r.book_id = e.book_id
      join accounting_journals j on j.id = r.journal_id and j.status = 'posted'
      where e.book_id = b.id and e.source_type = 'asset_depreciation' and e.source_id = new.asset_id || ':' || new.period and r.status = 'posted') then
    raise exception 'Mandatory accounting depreciation posting missing for % %', new.asset_id, new.period;
  end if;
  return new;
end $$;
create constraint trigger accounting_depreciation_mandatory after insert on asset_depreciations
  deferrable initially deferred for each row execute function accounting_depreciation_mandatory();
