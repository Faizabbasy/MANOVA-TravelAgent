do $$ begin
  if exists (select 1 from customer_invoices where project_id is null) then
    raise exception 'Standalone order invoices exist. Use forward repair or an approved restore.';
  end if;
end $$;
alter table customer_invoices drop constraint customer_invoices_project_or_order;
alter table customer_invoices alter column project_id set not null;
