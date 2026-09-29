-- Finance Phase 3 — receivables & payables (ADR-007, FINANCE-DOMAIN-MAPPING §6.2–§6.3).
-- Invoices state obligations; money only moves in financial_transactions (Phase 2). Payments reach invoices
-- through payment_allocations. Outstanding amounts are computed by the views at the end — never stored.

create sequence finance_customer_invoice_seq;
create sequence finance_invoice_number_seq;
create sequence finance_billing_schedule_seq;
create sequence finance_vendor_invoice_seq;
create sequence finance_credit_note_seq;

-- ── Customer side ──────────────────────────────────────────────────────────────────────────────────

create table billing_schedule_items (
  id            text primary key default ('BS-' || lpad(nextval('finance_billing_schedule_seq')::text, 5, '0')),
  project_id    text not null references projects (id),
  booking_type  text,
  booking_id    text,
  label         text not null check (btrim(label) <> ''),
  invoice_type  text not null check (invoice_type in ('dp', 'progress', 'final', 'other')),
  amount_minor  bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  planned_date  date not null,
  status        text not null default 'planned' check (status in ('planned', 'invoiced', 'cancelled')),
  created_by    text not null references users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint billing_schedule_booking_fk foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id),
  constraint billing_schedule_booking_pair check ((booking_type is null) = (booking_id is null))
);

create index billing_schedule_project_idx on billing_schedule_items (project_id, planned_date);

create table customer_invoices (
  id                       text primary key default ('CINV-' || lpad(nextval('finance_customer_invoice_seq')::text, 5, '0')),
  -- Assigned when issued; drafts have no legal number yet.
  number                   text unique,
  project_id               text not null references projects (id),
  -- Always the project's customer (derived by the service, never chosen freely).
  party_id                 text not null references parties (id),
  booking_type             text,
  booking_id               text,
  billing_schedule_item_id text unique references billing_schedule_items (id),
  invoice_type             text not null check (invoice_type in ('dp', 'progress', 'final', 'other')),
  status                   text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  currency                 text not null default 'IDR' check (currency = 'IDR'),
  total_minor              bigint not null default 0 check (total_minor >= 0 and total_minor <= 1000000000000000),
  issue_date               date,
  due_date                 date,
  -- Realistic payment date for cash flow; the contractual due date never moves after issue.
  expected_date            date,
  expected_reason          text,
  is_disputed              boolean not null default false,
  dispute_reason           text,
  -- Frozen copy for the legal document (customer & project names at issue time).
  billing_snapshot         jsonb,
  notes                    text,
  void_reason              text,
  voided_by                text references users (id),
  voided_at                timestamptz,
  issued_by                text references users (id),
  issued_at                timestamptz,
  created_by               text not null references users (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint customer_invoices_booking_fk foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id),
  constraint customer_invoices_booking_pair check ((booking_type is null) = (booking_id is null)),
  constraint customer_invoices_issued_complete check (
    status = 'draft' or (number is not null and issue_date is not null and due_date is not null and total_minor > 0 and issued_at is not null)),
  constraint customer_invoices_due_after_issue check (due_date is null or issue_date is null or due_date >= issue_date),
  constraint customer_invoices_void_reason check ((status = 'void') = (void_reason is not null and voided_at is not null))
);

create index customer_invoices_project_idx on customer_invoices (project_id, due_date);
create index customer_invoices_party_idx on customer_invoices (party_id, due_date);
create index customer_invoices_status_idx on customer_invoices (status, due_date);
create index customer_invoices_booking_idx on customer_invoices (booking_type, booking_id) where booking_id is not null;

create table customer_invoice_lines (
  id           bigint generated always as identity primary key,
  invoice_id   text not null references customer_invoices (id) on delete cascade,
  position     integer not null check (position >= 1),
  description  text not null check (btrim(description) <> ''),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  unique (invoice_id, position)
);

-- Reductions of what a customer owes (e.g. agreed discount, cancelled scope). Refund liabilities for money
-- already received arrive with Phase 5 (effect 'refund_liability').
create table credit_notes (
  id                  text primary key default ('CN-' || lpad(nextval('finance_credit_note_seq')::text, 5, '0')),
  customer_invoice_id text not null references customer_invoices (id),
  effect              text not null default 'reduce_receivable' check (effect in ('reduce_receivable', 'refund_liability')),
  amount_minor        bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  reason              text not null check (length(btrim(reason)) >= 5),
  status              text not null default 'issued' check (status in ('issued', 'void')),
  void_reason         text,
  voided_by           text references users (id),
  voided_at           timestamptz,
  created_by          text not null references users (id),
  created_at          timestamptz not null default now(),
  constraint credit_notes_void_reason check ((status = 'void') = (void_reason is not null and voided_at is not null))
);

create index credit_notes_invoice_idx on credit_notes (customer_invoice_id);

-- ── Vendor side ────────────────────────────────────────────────────────────────────────────────────

create table vendor_invoices (
  id                    text primary key default ('VINV-' || lpad(nextval('finance_vendor_invoice_seq')::text, 5, '0')),
  vendor_id             text not null references vendors (id),
  -- The vendor's own document number; unique per vendor (case-insensitive) to stop double entry.
  vendor_invoice_number text not null check (btrim(vendor_invoice_number) <> ''),
  service_order_id      text references service_orders (id),
  project_id            text references projects (id),
  booking_type          text,
  booking_id            text,
  status                text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected', 'void')),
  match_status          text check (match_status in ('matched', 'unmatched', 'disputed')),
  currency              text not null default 'IDR' check (currency = 'IDR'),
  total_minor           bigint not null check (total_minor > 0 and total_minor <= 1000000000000000),
  invoice_date          date not null,
  due_date              date not null,
  expected_date         date,
  expected_reason       text,
  notes                 text,
  review_note           text,
  reviewed_by           text references users (id),
  reviewed_at           timestamptz,
  rejected_reason       text,
  void_reason           text,
  created_by            text not null references users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint vendor_invoices_booking_fk foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id),
  constraint vendor_invoices_booking_pair check ((booking_type is null) = (booking_id is null)),
  constraint vendor_invoices_due_after_invoice check (due_date >= invoice_date),
  constraint vendor_invoices_rejected_reason check ((status = 'rejected') = (rejected_reason is not null)),
  constraint vendor_invoices_void_reason check ((status = 'void') = (void_reason is not null))
);

create unique index vendor_invoices_number_key on vendor_invoices (vendor_id, lower(vendor_invoice_number));
create index vendor_invoices_status_idx on vendor_invoices (status, due_date);
create index vendor_invoices_project_idx on vendor_invoices (project_id) where project_id is not null;
create index vendor_invoices_booking_idx on vendor_invoices (booking_type, booking_id) where booking_id is not null;

-- ── Allocations: which payment settles which invoice ───────────────────────────────────────────────

create table payment_allocations (
  id             bigint generated always as identity primary key,
  transaction_id text not null references financial_transactions (id),
  target_type    text not null check (target_type in ('customer_invoice', 'vendor_invoice')),
  target_id      text not null,
  amount_minor   bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  created_by     text not null references users (id),
  created_at     timestamptz not null default now(),
  unique (transaction_id, target_type, target_id)
);

create index payment_allocations_target_idx on payment_allocations (target_type, target_id);

-- Allocations are permanent. To undo one, reverse the payment (its allocations stop counting).
create trigger payment_allocations_immutable
  before update or delete on payment_allocations
  for each row execute function finance_block_mutation();
create trigger payment_allocations_no_truncate
  before truncate on payment_allocations
  for each statement execute function finance_block_mutation();

-- ── Computed balances (the ONLY outstanding formula) ───────────────────────────────────────────────

-- An allocation counts while its payment has not been reversed.
create view v_active_allocations as
  select a.*
    from payment_allocations a
    join financial_transactions t on t.id = a.transaction_id
   where not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id);

create view v_customer_invoice_balances as
  select i.id as invoice_id,
         i.total_minor,
         coalesce((select sum(a.amount_minor) from v_active_allocations a
                    where a.target_type = 'customer_invoice' and a.target_id = i.id), 0) as paid_minor,
         coalesce((select sum(c.amount_minor) from credit_notes c
                    where c.customer_invoice_id = i.id and c.status = 'issued' and c.effect = 'reduce_receivable'), 0) as credited_minor
    from customer_invoices i;

create view v_vendor_invoice_balances as
  select v.id as vendor_invoice_id,
         v.total_minor,
         coalesce((select sum(a.amount_minor) from v_active_allocations a
                    where a.target_type = 'vendor_invoice' and a.target_id = v.id), 0) as paid_minor
    from vendor_invoices v;

-- Money received/paid but not yet allocated to an invoice (customer advance / vendor deposit).
create view v_unallocated_payments as
  select t.id as transaction_id, t.kind, t.bank_account_id, t.party_id, t.vendor_id, t.project_id, t.effective_date,
         t.amount_minor,
         t.amount_minor - coalesce((select sum(a.amount_minor) from payment_allocations a where a.transaction_id = t.id), 0) as unallocated_minor
    from financial_transactions t
   where t.kind in ('customer_receipt', 'vendor_payment')
     and t.reversal_of_id is null
     and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id);

-- ── Database-level guards (defence in depth; the service checks the same with row locks) ────────────

create function payment_allocations_check() returns trigger
language plpgsql as $$
declare
  tx financial_transactions%rowtype;
  allocated numeric;
  outstanding numeric;
  inv customer_invoices%rowtype;
  vinv vendor_invoices%rowtype;
begin
  select * into tx from financial_transactions where id = new.transaction_id;
  if tx.reversal_of_id is not null or exists (select 1 from financial_transactions r where r.reversal_of_id = tx.id) then
    raise exception 'cannot allocate a reversed payment' using errcode = '23514';
  end if;
  select coalesce(sum(amount_minor), 0) into allocated from payment_allocations where transaction_id = tx.id;
  if allocated + new.amount_minor > tx.amount_minor then
    raise exception 'allocations exceed payment %', tx.id using errcode = '23514';
  end if;

  if new.target_type = 'customer_invoice' then
    if tx.kind <> 'customer_receipt' then
      raise exception 'only customer receipts settle customer invoices' using errcode = '23514';
    end if;
    select * into inv from customer_invoices where id = new.target_id;
    if not found or inv.status <> 'issued' or inv.party_id is distinct from tx.party_id then
      raise exception 'invoice % is not an issued invoice of the paying customer', new.target_id using errcode = '23514';
    end if;
    select b.total_minor - b.paid_minor - b.credited_minor into outstanding
      from v_customer_invoice_balances b where b.invoice_id = inv.id;
  else
    if tx.kind <> 'vendor_payment' then
      raise exception 'only vendor payments settle vendor invoices' using errcode = '23514';
    end if;
    select * into vinv from vendor_invoices where id = new.target_id;
    if not found or vinv.status <> 'approved' or vinv.vendor_id is distinct from tx.vendor_id then
      raise exception 'vendor invoice % is not an approved invoice of the paid vendor', new.target_id using errcode = '23514';
    end if;
    select b.total_minor - b.paid_minor into outstanding
      from v_vendor_invoice_balances b where b.vendor_invoice_id = vinv.id;
  end if;

  if new.amount_minor > outstanding then
    raise exception 'allocation exceeds outstanding of %', new.target_id using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger payment_allocations_guard
  before insert on payment_allocations
  for each row execute function payment_allocations_check();

-- An issued invoice is a legal document: amounts, parties, number and contractual dates are frozen.
create function customer_invoices_freeze() returns trigger
language plpgsql as $$
begin
  if old.status <> 'draft' and (
       new.number is distinct from old.number or new.project_id <> old.project_id or new.party_id <> old.party_id
    or new.total_minor <> old.total_minor or new.issue_date is distinct from old.issue_date
    or new.due_date is distinct from old.due_date or new.invoice_type <> old.invoice_type or new.currency <> old.currency
    or new.booking_id is distinct from old.booking_id or new.billing_snapshot is distinct from old.billing_snapshot) then
    raise exception 'issued invoice % is frozen; use a credit note or void it', old.id using errcode = '42501';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'a void invoice cannot be revived' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger customer_invoices_frozen
  before update on customer_invoices
  for each row execute function customer_invoices_freeze();

create function customer_invoice_lines_draft_only() returns trigger
language plpgsql as $$
declare
  parent_status text;
begin
  select status into parent_status from customer_invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if parent_status is not null and parent_status <> 'draft' then
    raise exception 'lines of a non-draft invoice cannot change' using errcode = '42501';
  end if;
  return coalesce(new, old);
end
$$;

create trigger customer_invoice_lines_guard
  before insert or update or delete on customer_invoice_lines
  for each row execute function customer_invoice_lines_draft_only();

create function vendor_invoices_freeze() returns trigger
language plpgsql as $$
begin
  if old.status in ('approved', 'rejected', 'void') and (
       new.vendor_id <> old.vendor_id or lower(new.vendor_invoice_number) <> lower(old.vendor_invoice_number)
    or new.total_minor <> old.total_minor or new.invoice_date <> old.invoice_date or new.due_date <> old.due_date
    or new.service_order_id is distinct from old.service_order_id or new.project_id is distinct from old.project_id) then
    raise exception 'reviewed vendor invoice % is frozen', old.id using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger vendor_invoices_frozen
  before update on vendor_invoices
  for each row execute function vendor_invoices_freeze();

-- Issued/void customer invoices are never deleted; vendor invoices are never deleted at all (reject/void them).
-- Voiding is only possible while no active payment or issued credit note remains on the invoice.
create function finance_invoices_delete_and_void_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'vendor_invoices' or old.status <> 'draft' then
      raise exception '% % cannot be deleted; void it instead', tg_table_name, old.id using errcode = '42501';
    end if;
    return old;
  end if;
  if new.status = 'void' and old.status <> 'void' then
    if tg_table_name = 'customer_invoices' and (
         exists (select 1 from v_active_allocations a where a.target_type = 'customer_invoice' and a.target_id = old.id)
      or exists (select 1 from credit_notes c where c.customer_invoice_id = old.id and c.status = 'issued')) then
      raise exception 'invoice % still has payments or credit notes; reverse them before voiding', old.id using errcode = '23514';
    end if;
    if tg_table_name = 'vendor_invoices'
       and exists (select 1 from v_active_allocations a where a.target_type = 'vendor_invoice' and a.target_id = old.id) then
      raise exception 'vendor invoice % still has payments; reverse them before voiding', old.id using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger customer_invoices_delete_void_guard
  before update or delete on customer_invoices
  for each row execute function finance_invoices_delete_and_void_guard();

create trigger vendor_invoices_delete_void_guard
  before update or delete on vendor_invoices
  for each row execute function finance_invoices_delete_and_void_guard();
