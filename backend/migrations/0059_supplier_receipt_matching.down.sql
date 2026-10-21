do $$ begin
 if exists(select 1 from vendor_fulfillment_matches) then raise exception 'Supplier match evidence exists; use forward correction or approved restore'; end if;
end $$;
drop trigger supplier_matched_invoice_guard on vendor_invoices;
drop trigger supplier_matched_receipt_guard on service_fulfillments;
drop function supplier_matched_source_guard();
drop table vendor_fulfillment_matches;
drop function vendor_fulfillment_match_guard();
