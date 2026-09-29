-- Destructive for recorded money: production rollback requires --confirm-backup (scripts/db.ts).
drop table idempotency_keys;
drop table financial_transactions;
drop table transfers;
drop function finance_block_mutation();
drop table bank_accounts;
drop sequence finance_transfer_seq;
drop sequence finance_transaction_seq;
drop sequence finance_bank_account_seq;
