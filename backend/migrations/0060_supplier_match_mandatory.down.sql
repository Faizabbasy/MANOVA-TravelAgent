do $$ begin
 if exists(select 1 from vendor_fulfillment_matches) then raise exception 'Supplier match evidence exists; mandatory posting guard must be preserved'; end if;
end $$;
drop trigger accounting_supplier_match_mandatory on vendor_fulfillment_matches;
drop function accounting_supplier_match_mandatory();
