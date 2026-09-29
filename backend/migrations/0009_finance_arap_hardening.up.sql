-- Phase 3 hardening (independent review of 0008).

-- 1. A voided invoice must release its billing-schedule item so it can be re-invoiced.
alter table customer_invoices drop constraint customer_invoices_billing_schedule_item_id_key;
create unique index customer_invoices_schedule_item_active_key
  on customer_invoices (billing_schedule_item_id) where billing_schedule_item_id is not null and status <> 'void';

-- 2. Status can never move backwards (issued → draft, reviewed → submitted), even via raw SQL:
--    that would turn a paid document back into an editable one.
create or replace function customer_invoices_freeze() returns trigger
language plpgsql as $$
begin
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'invoice % cannot return to draft', old.id using errcode = '42501';
  end if;
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

create or replace function vendor_invoices_freeze() returns trigger
language plpgsql as $$
begin
  if old.status in ('approved', 'rejected', 'void') and new.status in ('submitted', 'under_review') then
    raise exception 'reviewed vendor invoice % cannot return to review', old.id using errcode = '42501';
  end if;
  if old.status in ('rejected', 'void') and new.status <> old.status then
    raise exception 'vendor invoice % is closed', old.id using errcode = '42501';
  end if;
  if old.status in ('approved', 'rejected', 'void') and (
       new.vendor_id <> old.vendor_id or lower(new.vendor_invoice_number) <> lower(old.vendor_invoice_number)
    or new.total_minor <> old.total_minor or new.invoice_date <> old.invoice_date or new.due_date <> old.due_date
    or new.service_order_id is distinct from old.service_order_id or new.project_id is distinct from old.project_id) then
    raise exception 'reviewed vendor invoice % is frozen', old.id using errcode = '42501';
  end if;
  return new;
end
$$;
