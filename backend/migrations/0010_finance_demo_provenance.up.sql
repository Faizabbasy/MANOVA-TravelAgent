-- Lets the finance demo seed mark what it creates as 'demo-fixture' without ever updating the immutable cash
-- book: the provenance default reads a transaction-local setting that only the seed sets
-- (`select set_config('manova.provenance', 'demo-fixture', true)`). Normal requests never set it → 'manual'.
alter table bank_accounts
  alter column provenance set default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual');
alter table financial_transactions
  alter column provenance set default coalesce(nullif(current_setting('manova.provenance', true), ''), 'manual');
