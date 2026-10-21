-- Owner accounting F2/F3: service fulfillment facts, supplier recovery claims and the credit/refund lifecycle.
-- Facts are recorded once in Finance; the ledger only derives from them. Nothing here activates a book.

-- A delivered (customer) or received (supplier) service, partial allowed. Not cash, not an invoice.
create table service_fulfillments (
  id               text primary key,
  side             text not null check (side in ('customer', 'supplier')),
  project_id       text references projects (id),
  sales_order_id   text references sales_order_refs (id),
  service_id       text references project_services (id),
  booking_type     text,
  booking_id       text,
  service_order_id text references service_orders (id),
  party_id         text references parties (id),
  vendor_id        text references vendors (id),
  amount_minor     bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  fulfilled_on     date not null,
  -- Supplier side: 'estimate' is an authorised accrual before the invoice; 'final' closes the vendor's service.
  basis            text not null default 'actual' check (basis in ('actual', 'estimate')),
  is_final         boolean not null default false,
  evidence         text not null check (length(btrim(evidence)) between 5 and 500),
  status           text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason      text,
  voided_by        text references users (id),
  voided_at        timestamptz,
  created_by       text not null references users (id),
  created_at       timestamptz not null default now(),
  constraint service_fulfillments_booking_fk foreign key (booking_type, booking_id) references booking_refs (booking_type, booking_id),
  check ((booking_type is null) = (booking_id is null)),
  check (project_id is not null or sales_order_id is not null),
  check (side <> 'customer' or (party_id is not null and vendor_id is null and service_order_id is null and basis = 'actual')),
  check (side <> 'supplier' or (vendor_id is not null and sales_order_id is null)),
  check ((status = 'void') = (void_reason is not null and voided_at is not null and voided_by is not null))
);
create index service_fulfillments_project on service_fulfillments (project_id, side, fulfilled_on);
create index service_fulfillments_order on service_fulfillments (sales_order_id, side);

-- Recorded facts are immutable; the only change is recorded → void with a reason (a reversal, not an edit).
create function service_fulfillments_guard() returns trigger language plpgsql as $$
declare limit_minor numeric; used numeric;
begin
  if tg_op = 'DELETE' then raise exception 'Fulfillment evidence is immutable; void it instead'; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'void' or new.status <> 'void' or (to_jsonb(new) - array['status','void_reason','voided_by','voided_at'])
        is distinct from (to_jsonb(old) - array['status','void_reason','voided_by','voided_at']) then
      raise exception 'Fulfillment evidence is immutable; void it instead';
    end if;
    return new;
  end if;
  if new.side = 'customer' then
    -- Cumulative recognition never exceeds the contractual right: contract/order value or what was validly billed.
    if new.sales_order_id is not null then
      perform 1 from sales_order_refs where id = new.sales_order_id for update;
      select greatest(s.price_minor, coalesce((select sum(i.total_minor) from customer_invoices i where i.sales_order_id = s.id and i.status = 'issued'), 0))
        into limit_minor from sales_order_refs s where s.id = new.sales_order_id;
      select coalesce(sum(amount_minor), 0) into used from service_fulfillments
        where side = 'customer' and status = 'recorded' and sales_order_id = new.sales_order_id;
    else
      perform 1 from projects where id = new.project_id for update;
      select greatest(coalesce(p.contract_value_minor, 0), coalesce((select sum(i.total_minor) from customer_invoices i
          where i.project_id = p.id and i.party_id = new.party_id and i.sales_order_id is null and i.status = 'issued'), 0))
        into limit_minor from projects p where p.id = new.project_id;
      select coalesce(sum(amount_minor), 0) into used from service_fulfillments
        where side = 'customer' and status = 'recorded' and project_id = new.project_id and sales_order_id is null and party_id = new.party_id;
    end if;
    if used + new.amount_minor > limit_minor then
      raise exception 'Cumulative fulfillment exceeds the contractual right' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger service_fulfillments_guard before insert or update or delete on service_fulfillments
  for each row execute function service_fulfillments_guard();
create trigger service_fulfillments_no_truncate before truncate on service_fulfillments
  for each statement execute function accounting_immutable();

-- Money/credit a supplier owes back: cost recovery of a recognised cost, or recovery of an unused deposit.
create table supplier_claims (
  id             text primary key,
  vendor_id      text not null references vendors (id),
  project_id     text references projects (id),
  basis          text not null check (basis in ('cost-recovery', 'deposit-recovery')),
  -- Deposit recovery consumes an existing vendor deposit (an allocation of that payment), never new cash.
  source_payment_id text references financial_transactions (id),
  amount_minor   bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000000),
  recognized_on  date not null,
  reason         text not null check (length(btrim(reason)) between 5 and 500),
  status         text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason    text,
  voided_by      text references users (id),
  voided_at      timestamptz,
  created_by     text not null references users (id),
  created_at     timestamptz not null default now(),
  check ((basis = 'deposit-recovery') = (source_payment_id is not null)),
  check ((status = 'void') = (void_reason is not null and voided_at is not null and voided_by is not null))
);
create index supplier_claims_vendor on supplier_claims (vendor_id, status);

create function supplier_claims_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Supplier claim evidence is immutable; void it instead'; end if;
  if old.status = 'void' or new.status <> 'void' or (to_jsonb(new) - array['status','void_reason','voided_by','voided_at'])
      is distinct from (to_jsonb(old) - array['status','void_reason','voided_by','voided_at']) then
    raise exception 'Supplier claim evidence is immutable; void it instead';
  end if;
  if exists (select 1 from v_active_allocations a join financial_transactions t on t.id = a.transaction_id
      where a.target_type = 'supplier_claim' and a.target_id = old.id and t.kind = 'vendor_refund') then
    raise exception 'Supplier claim has received refunds; reverse them first' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger supplier_claims_guard before update or delete on supplier_claims
  for each row execute function supplier_claims_guard();
create trigger supplier_claims_no_truncate before truncate on supplier_claims
  for each statement execute function accounting_immutable();

alter table payment_allocations drop constraint payment_allocations_target_type_check;
alter table payment_allocations add constraint payment_allocations_target_type_check
  check (target_type in ('customer_invoice', 'vendor_invoice', 'refund', 'supplier_claim'));

-- A voided deposit-recovery claim gives its deposit back (allocations stay immutable evidence).
create function allocation_counts(a payment_allocations) returns boolean language sql stable as $$
  select a.target_type <> 'supplier_claim' or exists (select 1 from supplier_claims c where c.id = a.target_id and c.status = 'recorded')
$$;
create or replace view v_unallocated_payments as
  select t.id as transaction_id, t.kind, t.bank_account_id, t.party_id, t.vendor_id, t.project_id, t.effective_date,
         t.amount_minor,
         t.amount_minor - coalesce((select sum(a.amount_minor) from payment_allocations a where a.transaction_id = t.id and allocation_counts(a)), 0) as unallocated_minor
    from financial_transactions t
   where t.kind in ('customer_receipt', 'vendor_payment')
     and t.reversal_of_id is null
     and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id);

-- Claim balance: deposit recoveries are funded by the deposit allocation; cash refunds settle what is left.
create view v_supplier_claim_balances as
  select c.id as claim_id, c.vendor_id, c.project_id, c.basis, c.status, c.amount_minor,
         coalesce((select sum(a.amount_minor) from v_active_allocations a join financial_transactions t on t.id = a.transaction_id
                    where a.target_type = 'supplier_claim' and a.target_id = c.id and t.kind = 'vendor_refund'), 0) as settled_minor
    from supplier_claims c;

create or replace function payment_allocations_check() returns trigger
language plpgsql as $$
declare
  tx financial_transactions%rowtype;
  allocated numeric;
  outstanding numeric;
  inv customer_invoices%rowtype;
  vinv vendor_invoices%rowtype;
  rf refunds%rowtype;
  cl supplier_claims%rowtype;
begin
  select * into tx from financial_transactions where id = new.transaction_id;
  if tx.reversal_of_id is not null or exists (select 1 from financial_transactions r where r.reversal_of_id = tx.id) then
    raise exception 'cannot allocate a reversed payment' using errcode = '23514';
  end if;
  select coalesce(sum(a.amount_minor), 0) into allocated from payment_allocations a where a.transaction_id = tx.id and allocation_counts(a);
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
  elsif new.target_type = 'vendor_invoice' then
    if tx.kind <> 'vendor_payment' then
      raise exception 'only vendor payments settle vendor invoices' using errcode = '23514';
    end if;
    select * into vinv from vendor_invoices where id = new.target_id;
    if not found or vinv.status <> 'approved' or vinv.vendor_id is distinct from tx.vendor_id then
      raise exception 'vendor invoice % is not an approved invoice of the paid vendor', new.target_id using errcode = '23514';
    end if;
    select b.total_minor - b.paid_minor into outstanding
      from v_vendor_invoice_balances b where b.vendor_invoice_id = vinv.id;
  elsif new.target_type = 'supplier_claim' then
    select * into cl from supplier_claims where id = new.target_id;
    if not found or cl.status <> 'recorded' or cl.vendor_id is distinct from tx.vendor_id then
      raise exception 'supplier claim % is not a recorded claim of this vendor', new.target_id using errcode = '23514';
    end if;
    if tx.kind = 'vendor_payment' then
      -- Only the deposit named on a deposit-recovery claim funds it, exactly once and in full.
      if cl.basis <> 'deposit-recovery' or cl.source_payment_id <> tx.id or new.amount_minor <> cl.amount_minor
         or exists (select 1 from payment_allocations a where a.target_type = 'supplier_claim' and a.target_id = cl.id and a.transaction_id = tx.id) then
        raise exception 'deposit allocation does not match supplier claim %', cl.id using errcode = '23514';
      end if;
      outstanding := cl.amount_minor;
    elsif tx.kind = 'vendor_refund' then
      select b.amount_minor - b.settled_minor into outstanding from v_supplier_claim_balances b where b.claim_id = cl.id;
    else
      raise exception 'only vendor refunds or the named deposit settle supplier claims' using errcode = '23514';
    end if;
  else
    if tx.kind <> 'refund_settlement' then
      raise exception 'only refund settlements settle refund cases' using errcode = '23514';
    end if;
    select * into rf from refunds where id = new.target_id;
    if not found or rf.status <> 'approved' or rf.party_id is distinct from tx.party_id then
      raise exception 'refund % is not an approved case of this customer', new.target_id using errcode = '23514';
    end if;
    select b.refundable_minor - b.settled_minor into outstanding
      from v_refund_balances b where b.refund_id = rf.id;
  end if;

  if new.amount_minor > outstanding then
    raise exception 'allocation exceeds outstanding of %', new.target_id using errcode = '23514';
  end if;
  return new;
end
$$;

-- Credit notes and refund cases are now integrated; replace the blanket ACTIVE-book block with mandatory postings.
drop trigger accounting_credit_integration_guard on credit_notes;
drop trigger accounting_refund_integration_guard on refunds;
drop function accounting_unsupported_finance_guard();

-- One mandatory-posting check for every derived source: issued/recorded → posted event, void → posted reversal.
create function accounting_source_mandatory() returns trigger language plpgsql as $$
declare b accounting_books; v_kind text; v_date date; v_source text := tg_argv[0];
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' then return new; end if;
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;
  if new.status in ('issued', 'recorded') then
    v_kind := 'source_recorded';
    v_date := case v_source when 'credit_note' then (new.created_at at time zone b.timezone)::date
                            when 'service_fulfillment' then (to_jsonb(new)->>'fulfilled_on')::date
                            else (to_jsonb(new)->>'recognized_on')::date end;
  elsif new.status = 'void' then
    v_kind := 'source_voided'; v_date := (new.voided_at at time zone b.timezone)::date;
  else return new; end if;
  if v_date < b.cutover_date then raise exception 'New % before cutover requires opening correction', v_source; end if;
  if not exists (select 1 from accounting_events e join accounting_posting_registry r on r.event_id = e.id and r.book_id = e.book_id
      join accounting_journals j on j.id = r.journal_id and j.status = 'posted'
      where e.book_id = b.id and e.source_type = v_source and e.source_id = new.id and e.event_kind = v_kind and r.status = 'posted') then
    raise exception 'Mandatory accounting posting missing for % %', v_source, new.id;
  end if;
  return new;
end $$;
create constraint trigger accounting_credit_note_mandatory after insert or update on credit_notes
  deferrable initially deferred for each row execute function accounting_source_mandatory('credit_note');
create constraint trigger accounting_fulfillment_mandatory after insert or update on service_fulfillments
  deferrable initially deferred for each row execute function accounting_source_mandatory('service_fulfillment');
create constraint trigger accounting_supplier_claim_mandatory after insert or update on supplier_claims
  deferrable initially deferred for each row execute function accounting_source_mandatory('supplier_claim');

-- Refund settlements and supplier refunds are booked by their cash event (refund payable / claim), and a
-- deposit-recovery claim books its own advance → claim reclass; only invoice allocations need an allocation journal.
create or replace function accounting_allocation_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode = 'active' and new.effective_date >= b.cutover_date
     and new.target_type in ('customer_invoice', 'vendor_invoice')
     and not exists (
    select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id
    join accounting_journals j on j.id=r.journal_id and j.status='posted'
    where e.book_id=b.id and e.source_type='payment_allocation' and e.source_id=new.id::text and r.status='posted'
  ) then raise exception 'Mandatory accounting allocation posting missing'; end if;
  return new;
end $$;
