drop index if exists customer_invoices_one_per_sales_order;
alter table customer_invoices drop column if exists sales_order_id;
drop table if exists sales_order_refs;
