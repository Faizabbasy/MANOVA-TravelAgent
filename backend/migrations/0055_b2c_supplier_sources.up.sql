-- Native retail supplier sources share the existing AP/fulfillment/cash engine; no synthetic project or cash ledger.
alter table vendor_invoices add column sales_order_id text references sales_order_refs(id);
create index vendor_invoices_sales_order on vendor_invoices(sales_order_id) where sales_order_id is not null;
alter table supplier_claims add column sales_order_id text references sales_order_refs(id);
create index supplier_claims_sales_order on supplier_claims(sales_order_id) where sales_order_id is not null;
alter table financial_transactions add column sales_order_id text references sales_order_refs(id);
do $$ declare c record; n integer:=0; begin
  for c in select conname from pg_constraint where conrelid='service_fulfillments'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%supplier%' and pg_get_constraintdef(oid) like '%sales_order_id IS NULL%' loop
    execute format('alter table service_fulfillments drop constraint %I',c.conname); n:=n+1;
  end loop;
  if n<>1 then raise exception 'Expected one legacy supplier fulfillment scope constraint'; end if;
end $$;
alter table service_fulfillments add constraint supplier_fulfillment_order_scope check(side<>'supplier' or
  (vendor_id is not null and (sales_order_id is null or (project_id is null and service_id is null and booking_id is null and service_order_id is null and party_id is null))));
create function retail_supplier_scope_guard() returns trigger language plpgsql as $$
declare o sales_order_refs;
begin
  if tg_table_name='service_fulfillments' then
    if new.side<>'supplier' then return new; end if;
  end if;
  if tg_op='UPDATE' and new.sales_order_id is distinct from old.sales_order_id then
    raise exception 'Supplier source order attribution is immutable' using errcode='23514';
  end if;
  if tg_table_name='financial_transactions' then
    if new.reversal_of_id is not null and new.sales_order_id is distinct from
      (select sales_order_id from financial_transactions where id=new.reversal_of_id) then
      raise exception 'Cash reversal must preserve the source order' using errcode='23514';
    end if;
  end if;
  if new.sales_order_id is not null then
    select * into o from sales_order_refs where id=new.sales_order_id for update;
    if not found or o.project_id is not null or new.project_id is not null then
      raise exception 'Supplier order source must reference a standalone retail order' using errcode='23514';
    end if;
    if tg_table_name='vendor_invoices' then
      if new.booking_id is not null or new.service_order_id is not null then
        raise exception 'Retail invoice cannot also reference a project booking or service order' using errcode='23514';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger retail_vendor_invoice_scope before insert or update on vendor_invoices for each row execute function retail_supplier_scope_guard();
create trigger retail_supplier_fulfillment_scope before insert or update on service_fulfillments for each row execute function retail_supplier_scope_guard();
create trigger retail_supplier_claim_scope before insert or update on supplier_claims for each row execute function retail_supplier_scope_guard();
create trigger retail_cash_scope before insert or update on financial_transactions for each row execute function retail_supplier_scope_guard();
create function retail_company_link_guard() returns trigger language plpgsql as $$ begin
  if exists(select 1 from vendor_invoices where id=new.vendor_invoice_id and sales_order_id is not null) then
    raise exception 'Retail invoice cannot replace a company-only accrual' using errcode='23514';
  end if;
  return new;
end $$;
create trigger retail_company_link_guard before insert on company_expense_invoice_links for each row execute function retail_company_link_guard();
create function retail_allocation_scope_guard() returns trigger language plpgsql as $$
declare source_order text; target_order text;
begin
  select sales_order_id into source_order from financial_transactions where id=new.transaction_id;
  if source_order is null then return new; end if; -- Unattributed vendor/customer advances remain the existing shared pool.
  if new.target_type='supplier_claim' then select sales_order_id into target_order from supplier_claims where id=new.target_id;
  elsif new.target_type='vendor_invoice' then select sales_order_id into target_order from vendor_invoices where id=new.target_id;
  elsif new.target_type='customer_invoice' then select sales_order_id into target_order from customer_invoices where id=new.target_id;
  elsif new.target_type='refund' then select to_jsonb(r)->>'sales_order_id' into target_order from refunds r where id=new.target_id;
  end if;
  if target_order is distinct from source_order then raise exception 'Cash allocation must preserve its order scope' using errcode='23514'; end if;
  return new;
end $$;
create trigger retail_allocation_scope_guard before insert on payment_allocations for each row execute function retail_allocation_scope_guard();
