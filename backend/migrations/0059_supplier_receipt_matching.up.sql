-- Explicit source allocation: which actual supplier invoice settles which received service estimate.
-- This records no cash. Existing vendor invoices and service_fulfillments remain the source documents.
create table vendor_fulfillment_matches (
 id text primary key,
 vendor_invoice_id text not null references vendor_invoices(id),
 fulfillment_id text not null references service_fulfillments(id),
 actual_minor bigint not null check(actual_minor between 1 and 1000000000000000),
 estimate_minor bigint not null check(estimate_minor between 1 and 1000000000000000),
 closes_receipt boolean not null,
 economic_date date not null, posting_date date not null check(posting_date>=economic_date),
 reason text not null check(length(btrim(reason)) between 5 and 500),
 status text not null default 'recorded' check(status in ('recorded','void')),
 void_reason text,voided_by text references users(id),voided_at timestamptz,
 created_by text not null references users(id),created_at timestamptz not null default now(),
 check((status='void')=(void_reason is not null and voided_by is not null and voided_at is not null))
);
create unique index vendor_fulfillment_match_active_pair on vendor_fulfillment_matches(vendor_invoice_id,fulfillment_id) where status='recorded';
create function vendor_fulfillment_match_guard() returns trigger language plpgsql as $$
declare i vendor_invoices; f service_fulfillments; actual_used numeric; estimate_used numeric;
begin
 if tg_op='DELETE' then raise exception 'Supplier matching evidence is retained'; end if;
 if tg_op='UPDATE' then
  if old.status<>'recorded' or new.status<>'void' or (to_jsonb(old)-'status'-'void_reason'-'voided_by'-'voided_at') is distinct from (to_jsonb(new)-'status'-'void_reason'-'voided_by'-'voided_at') then
   raise exception 'Supplier match facts are immutable; void with a reason';
  end if;
  return new;
 end if;
 select * into i from vendor_invoices where id=new.vendor_invoice_id for update;
 if new.status<>'recorded' then raise exception 'A new supplier match must be recorded' using errcode='23514'; end if;
 select * into f from service_fulfillments where id=new.fulfillment_id for update;
 if i.status is distinct from 'approved' or f.status is distinct from 'recorded' or f.side is distinct from 'supplier'
  or i.vendor_id is distinct from f.vendor_id or i.project_id is distinct from f.project_id or i.sales_order_id is distinct from f.sales_order_id
  or (i.service_order_id is not null and i.service_order_id is distinct from f.service_order_id)
  or (i.booking_id is not null and (i.booking_type is distinct from f.booking_type or i.booking_id is distinct from f.booking_id))
  or exists(select 1 from company_expense_invoice_links where vendor_invoice_id=i.id) then
  raise exception 'Supplier invoice and receipt source scope must match' using errcode='23514';
 end if;
 if new.economic_date is distinct from greatest(i.invoice_date,f.fulfilled_on) then raise exception 'Retain original supplier invoice and delivery dates' using errcode='23514'; end if;
 select coalesce(sum(actual_minor),0) into actual_used from vendor_fulfillment_matches where vendor_invoice_id=i.id and status='recorded';
 select coalesce(sum(estimate_minor),0) into estimate_used from vendor_fulfillment_matches where fulfillment_id=f.id and status='recorded';
 if actual_used+new.actual_minor>i.total_minor or estimate_used+new.estimate_minor>f.amount_minor
  or (new.closes_receipt and estimate_used+new.estimate_minor<>f.amount_minor)
  or (not new.closes_receipt and (new.actual_minor>=f.amount_minor-estimate_used or new.estimate_minor<>new.actual_minor)) then
  raise exception 'Supplier matching cannot exceed invoice or unconsumed receipt' using errcode='23514';
 end if;
 return new;
end $$;
create trigger vendor_fulfillment_match_guard before insert or update or delete on vendor_fulfillment_matches for each row execute function vendor_fulfillment_match_guard();
create trigger vendor_fulfillment_match_no_truncate before truncate on vendor_fulfillment_matches for each statement execute function accounting_immutable();

create function supplier_matched_source_guard() returns trigger language plpgsql as $$
begin
 if new.status='void' and old.status<>'void' and exists(select 1 from vendor_fulfillment_matches m where m.status='recorded'
   and ((tg_table_name='vendor_invoices' and m.vendor_invoice_id=old.id) or (tg_table_name='service_fulfillments' and m.fulfillment_id=old.id))) then
  raise exception 'Reverse supplier matches before voiding their source' using errcode='23514';
 end if;
 return new;
end $$;
create trigger supplier_matched_invoice_guard before update on vendor_invoices for each row execute function supplier_matched_source_guard();
create trigger supplier_matched_receipt_guard before update on service_fulfillments for each row execute function supplier_matched_source_guard();
