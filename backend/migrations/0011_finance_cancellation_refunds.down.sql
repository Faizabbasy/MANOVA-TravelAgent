-- Reverts 0011. Refund data is dropped with its tables; refund_settlement transactions (if any) stay in the
-- immutable cash book, so run this only on a database without Phase 5 postings (rehearsal / dev).
create or replace function payment_allocations_check() returns trigger
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

drop view v_refund_balances;
alter table payment_allocations drop constraint payment_allocations_target_type_check;
alter table payment_allocations add constraint payment_allocations_target_type_check
  check (target_type in ('customer_invoice', 'vendor_invoice'));

drop trigger credit_notes_refund_guard on credit_notes;
drop function credit_notes_refund_guard();
alter table credit_notes drop constraint credit_notes_refund_liability_linked;
alter table credit_notes drop column refund_id;

drop trigger refunds_no_truncate on refunds;
drop trigger refunds_guard on refunds;
drop function refunds_guard();
drop table refunds;
drop table cancellation_policy_assignments;
drop trigger cancellation_policy_tiers_draft_only on cancellation_policy_tiers;
drop function cancellation_policy_tiers_draft_only();
drop table cancellation_policy_tiers;
drop trigger cancellation_policies_freeze on cancellation_policies;
drop function cancellation_policies_freeze();
drop table cancellation_policies;
drop sequence finance_refund_seq;
drop sequence finance_policy_tier_seq;
drop sequence finance_policy_seq;
