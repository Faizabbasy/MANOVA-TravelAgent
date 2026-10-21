-- Owner accounting F4: a B2C standalone order (sales order without project) is billed, paid, credited and recognised
-- on its own order dimension — never through a dummy project.
alter table customer_invoices alter column project_id drop not null;
alter table customer_invoices add constraint customer_invoices_project_or_order check (project_id is not null or sales_order_id is not null);
