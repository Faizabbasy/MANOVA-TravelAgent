-- Actual private evidence, separate from historical metadata-only attachment names.
create table private_files (
 id text primary key,
 source_type text not null check(source_type in ('financial_transaction','customer_invoice','vendor_invoice','payment_proof','refund','supplier_claim','expense_claim','company_expense','prepaid_expense','payroll_run','document','traveler','change-request','quotation','travel-request')),
 source_id text not null, owner_party_id text references parties(id),
 visibility text not null check(visibility in ('internal','source-party')),
 storage_key text not null unique check(storage_key ~ '^[0-9a-f-]{36}$'),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 mime text not null check(mime in ('application/pdf','image/png','image/jpeg','image/webp')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 original_name text not null check(length(original_name) between 1 and 180),
 uploaded_by text not null references users(id), created_at timestamptz not null default now(),
 check(visibility='internal' or owner_party_id is not null),
 unique(source_type,source_id,sha256)
);
create index private_files_source on private_files(source_type,source_id,created_at,id);
create function private_file_immutable() returns trigger language plpgsql as $$ begin
 raise exception 'Private evidence metadata is immutable; retain the source and add corrected evidence';
end $$;
create trigger private_files_immutable before update or delete or truncate on private_files for each statement execute function private_file_immutable();
create function private_file_source_exists() returns trigger language plpgsql as $$
declare tab text; found_source boolean;
begin
 tab:=case new.source_type when 'financial_transaction' then 'financial_transactions' when 'customer_invoice' then 'customer_invoices'
 when 'vendor_invoice' then 'vendor_invoices' when 'payment_proof' then 'payment_proofs' when 'refund' then 'refunds'
 when 'supplier_claim' then 'supplier_claims' when 'expense_claim' then 'employee_expense_claims' when 'company_expense' then 'company_expenses'
 when 'prepaid_expense' then 'prepaid_expenses' when 'payroll_run' then 'payroll_runs' when 'document' then 'documents'
 when 'traveler' then 'travelers' when 'change-request' then 'change_requests' when 'quotation' then 'quotations' when 'travel-request' then 'travel_requests' end;
 if tab is null then raise exception 'Unsupported private evidence source' using errcode='23514'; end if;
 execute format('select true from %I where id=$1 for key share',tab) into found_source using new.source_id;
 if found_source is not true then raise exception 'Private evidence source does not exist' using errcode='23514'; end if;
 if new.source_type='customer_invoice' and exists(select 1 from customer_invoices where id=new.source_id and status='draft') then
  raise exception 'Attach draft evidence to the commercial source; invoice evidence requires an issued source' using errcode='23514';
 end if;
 return new;
end $$;
create trigger private_file_source_exists before insert on private_files for each row execute function private_file_source_exists();
create function private_file_retain_source() returns trigger language plpgsql as $$ begin
 if exists(select 1 from private_files where source_type=tg_argv[0] and source_id=old.id) then
  raise exception 'Private evidence retains this source; use its controlled correction/void workflow' using errcode='23514';
 end if;
 return old;
end $$;
do $$ declare rec record; begin
 for rec in select * from (values
 ('financial_transactions','financial_transaction'),('customer_invoices','customer_invoice'),('vendor_invoices','vendor_invoice'),('payment_proofs','payment_proof'),
 ('refunds','refund'),('supplier_claims','supplier_claim'),('employee_expense_claims','expense_claim'),('company_expenses','company_expense'),
 ('prepaid_expenses','prepaid_expense'),('payroll_runs','payroll_run'),('documents','document'),('travelers','traveler'),('change_requests','change-request'),('quotations','quotation'),('travel_requests','travel-request')) as x(tab,kind)
 loop execute format('create trigger retain_private_evidence before delete on %I for each row execute function private_file_retain_source(%L)',rec.tab,rec.kind); end loop;
end $$;
