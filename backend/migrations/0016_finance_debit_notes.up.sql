-- Debit notes: an extra charge on an issued customer invoice, kept as a supplementary invoice (own DN number)
-- for the same customer and project, so receivables, aging, cash flow and revenue include it unchanged.
alter table customer_invoices drop constraint customer_invoices_invoice_type_check;
alter table customer_invoices add constraint customer_invoices_invoice_type_check
  check (invoice_type in ('dp', 'progress', 'final', 'other', 'debit_note'));
alter table customer_invoices add column adjusts_invoice_id text references customer_invoices (id);
alter table customer_invoices add constraint customer_invoices_debit_note_origin
  check ((invoice_type = 'debit_note') = (adjusts_invoice_id is not null));
create index customer_invoices_adjusts on customer_invoices (adjusts_invoice_id) where adjusts_invoice_id is not null;
create sequence finance_debit_note_number_seq;
