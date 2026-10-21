do $$ begin
  if exists (select 1 from accounting_journals where status='posted') or exists (select 1 from service_fulfillments)
     or exists (select 1 from supplier_claims) then
    raise exception 'Fulfillment/claim or posted financial evidence exists. Use forward repair or an approved restore.';
  end if;
end $$;

create or replace function accounting_allocation_mandatory() returns trigger language plpgsql as $$
declare b accounting_books;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode='active' and new.effective_date >= b.cutover_date and not exists (
    select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id
    join accounting_journals j on j.id=r.journal_id and j.status='posted'
    where e.book_id=b.id and e.source_type='payment_allocation' and e.source_id=new.id::text and r.status='posted'
  ) then raise exception 'Mandatory accounting allocation posting missing'; end if;
  return new;
end $$;

drop trigger accounting_supplier_claim_mandatory on supplier_claims;
drop trigger accounting_fulfillment_mandatory on service_fulfillments;
drop trigger accounting_credit_note_mandatory on credit_notes;
drop function accounting_source_mandatory();

create function accounting_unsupported_finance_guard() returns trigger language plpgsql as $$
begin
  perform 1 from accounting_books where singleton for update;
  if exists (select 1 from accounting_books where mode='active') then
    raise exception 'Accounting integration not enabled for this credit/refund lifecycle';
  end if;
  return new;
end $$;
create trigger accounting_credit_integration_guard before insert or update on credit_notes
  for each row execute function accounting_unsupported_finance_guard();
create trigger accounting_refund_integration_guard before insert or update on refunds
  for each row execute function accounting_unsupported_finance_guard();

create or replace function payment_allocations_check() returns trigger
language plpgsql as $$
declare
  tx financial_transactions%rowtype;
  allocated numeric;
  outstanding numeric;
  inv customer_invoices%rowtype;
  vinv vendor_invoices%rowtype;
  rf refunds%rowtype;
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

create or replace view v_unallocated_payments as
  select t.id as transaction_id, t.kind, t.bank_account_id, t.party_id, t.vendor_id, t.project_id, t.effective_date,
         t.amount_minor,
         t.amount_minor - coalesce((select sum(a.amount_minor) from payment_allocations a where a.transaction_id = t.id), 0) as unallocated_minor
    from financial_transactions t
   where t.kind in ('customer_receipt', 'vendor_payment')
     and t.reversal_of_id is null
     and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id);
drop function allocation_counts(payment_allocations);
drop view v_supplier_claim_balances;
alter table payment_allocations drop constraint payment_allocations_target_type_check;
alter table payment_allocations add constraint payment_allocations_target_type_check
  check (target_type in ('customer_invoice', 'vendor_invoice', 'refund'));
drop table supplier_claims;
drop function supplier_claims_guard();
drop table service_fulfillments;
drop function service_fulfillments_guard();
