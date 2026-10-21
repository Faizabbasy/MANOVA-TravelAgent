-- New allocations have a real economic date. Historical dates remain unknown, never guessed/backfilled.
alter table payment_allocations add column effective_date date;

create function accounting_allocation_date_guard() returns trigger language plpgsql as $$
declare cash_date date; invoice_date date;
begin
  if new.effective_date is null and not exists (select 1 from accounting_books where mode='active') then return new; end if;
  select effective_date into cash_date from financial_transactions where id=new.transaction_id;
  if new.target_type='customer_invoice' then
    select issue_date into invoice_date from customer_invoices where id=new.target_id;
  elsif new.target_type='vendor_invoice' then
    select v.invoice_date into invoice_date from vendor_invoices v where id=new.target_id;
  end if;
  if new.effective_date is null or new.effective_date < cash_date or new.effective_date < invoice_date then
    raise exception 'Allocation date must not precede cash or invoice';
  end if;
  return new;
end $$;
create trigger accounting_allocation_date_guard before insert on payment_allocations
  for each row execute function accounting_allocation_date_guard();

-- An ACTIVE book may never silently miss an invoice lifecycle or allocation path.
create function accounting_invoice_mandatory() returns trigger language plpgsql as $$
declare b accounting_books; v_source_type text; v_event_kind text; v_event_date date;
begin
  select * into b from accounting_books where singleton for update;
  if b.mode is distinct from 'active' then return new; end if;
  if tg_table_name='customer_invoices' then
    v_source_type := 'customer_invoice';
    if new.status='issued' then v_event_kind := 'invoice_recognized'; v_event_date := new.issue_date;
    elsif new.status='void' then v_event_kind := 'invoice_voided'; v_event_date := (new.voided_at at time zone b.timezone)::date;
    else return new; end if;
  else
    v_source_type := 'vendor_invoice';
    if new.status='approved' then v_event_kind := 'invoice_recognized';v_event_date := new.invoice_date;
    elsif new.status='void' then v_event_kind := 'invoice_voided';v_event_date := (current_timestamp at time zone b.timezone)::date;
    else return new; end if;
  end if;
  if tg_op='UPDATE' and new.status=old.status then return new; end if;
  if v_event_date < b.cutover_date then raise exception 'New invoice before cutover requires opening correction'; end if;
  if not exists (select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id
    join accounting_journals j on j.id=r.journal_id and j.status='posted'
    where e.book_id=b.id and e.source_type=v_source_type and e.source_id=new.id and e.event_kind=v_event_kind and r.status='posted') then
    raise exception 'Mandatory accounting invoice posting missing';
  end if;
  return new;
end $$;
create constraint trigger accounting_customer_invoice_mandatory after insert or update on customer_invoices
  deferrable initially deferred for each row execute function accounting_invoice_mandatory();
create constraint trigger accounting_vendor_invoice_mandatory after insert or update on vendor_invoices
  deferrable initially deferred for each row execute function accounting_invoice_mandatory();

create function accounting_allocation_mandatory() returns trigger language plpgsql as $$
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
create constraint trigger accounting_allocation_mandatory after insert on payment_allocations
  deferrable initially deferred for each row execute function accounting_allocation_mandatory();

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
