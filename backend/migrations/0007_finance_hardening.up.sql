-- Finance Phase 2 hardening (independent review of 0006).

-- 1. TRUNCATE must not bypass the immutability of the cash book.
create trigger financial_transactions_no_truncate
  before truncate on financial_transactions
  for each statement execute function finance_block_mutation();

create trigger transfers_no_truncate
  before truncate on transfers
  for each statement execute function finance_block_mutation();

-- 2. A realistic ceiling per movement (Rp 1 quadrillion) so sums can never approach bigint overflow.
alter table financial_transactions
  add constraint financial_transactions_amount_ceiling check (amount_minor <= 1000000000000000);
alter table transfers
  add constraint transfers_amount_ceiling check (amount_minor <= 1000000000000000 and fee_minor <= 1000000000000000);

-- 3. Reversal and transfer-leg consistency enforced by the database, not only by the application:
--    a reversal mirrors its original exactly (same account, amount, currency, kind, transfer; opposite
--    direction), and a transfer leg matches its transfer (account side and amount).
create function financial_transactions_check_links() returns trigger
language plpgsql as $$
declare
  original financial_transactions%rowtype;
  tr transfers%rowtype;
begin
  if new.reversal_of_id is not null then
    select * into original from financial_transactions where id = new.reversal_of_id;
    if not found then
      raise exception 'reversal target % does not exist', new.reversal_of_id using errcode = '23503';
    end if;
    if original.reversal_of_id is not null then
      raise exception 'a reversal cannot itself be reversed' using errcode = '23514';
    end if;
    if new.bank_account_id <> original.bank_account_id
       or new.amount_minor <> original.amount_minor
       or new.currency <> original.currency
       or new.kind <> original.kind
       or new.direction = original.direction
       or new.transfer_id is distinct from original.transfer_id then
      raise exception 'reversal % does not mirror original %', new.id, original.id using errcode = '23514';
    end if;
    return new;
  end if;

  if new.kind in ('transfer_in', 'transfer_out', 'transfer_fee') then
    select * into tr from transfers where id = new.transfer_id;
    if not found then
      raise exception 'transfer % does not exist', new.transfer_id using errcode = '23503';
    end if;
    if (new.kind = 'transfer_out' and (new.bank_account_id <> tr.from_account_id or new.amount_minor <> tr.amount_minor))
       or (new.kind = 'transfer_in' and (new.bank_account_id <> tr.to_account_id or new.amount_minor <> tr.amount_minor))
       or (new.kind = 'transfer_fee' and (new.bank_account_id <> tr.from_account_id or new.amount_minor <> tr.fee_minor)) then
      raise exception 'transfer leg % does not match transfer %', new.id, tr.id using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger financial_transactions_links
  before insert on financial_transactions
  for each row execute function financial_transactions_check_links();
