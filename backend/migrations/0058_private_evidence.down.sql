do $$ declare rec record; begin
 if exists(select 1 from private_files) then raise exception 'Private evidence exists; use forward repair or an approved DB+blob restore'; end if;
 for rec in select * from (values ('financial_transactions'),('customer_invoices'),('vendor_invoices'),('payment_proofs'),('refunds'),('supplier_claims'),('employee_expense_claims'),('company_expenses'),('prepaid_expenses'),('payroll_runs'),('documents'),('travelers'),('change_requests'),('quotations'),('travel_requests')) as x(tab)
 loop execute format('drop trigger retain_private_evidence on %I',rec.tab); end loop;
end $$;
drop table private_files;
drop function private_file_source_exists();
drop function private_file_retain_source();
drop function private_file_immutable();
