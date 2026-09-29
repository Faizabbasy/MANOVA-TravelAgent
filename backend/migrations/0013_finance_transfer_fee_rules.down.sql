-- Drops the fee rules; transfers keep their fee amounts (fee_minor), only the provenance columns go.
alter table transfers
  drop column fee_snapshot,
  drop column fee_rule_id,
  drop column fee_source;

drop table transfer_fee_rules;
drop function transfer_fee_rules_no_overlap();
drop function transfer_fee_rules_lock_pair();
drop sequence finance_transfer_fee_rule_seq;
