-- Directional transfer fee rules (03 · transfer_fee_rules, 05 · /finance/transfer-fee-rules).
-- A→B and B→A are separate rules. A transfer keeps a snapshot of the rule it used, so editing a rule
-- later never changes history.

create sequence finance_transfer_fee_rule_seq;

create table transfer_fee_rules (
  id              text primary key default ('TFR-' || lpad(nextval('finance_transfer_fee_rule_seq')::text, 4, '0')),
  from_account_id text not null references bank_accounts (id),
  to_account_id   text not null references bank_accounts (id),
  fee_type        text not null check (fee_type in ('fixed', 'percent')),
  -- fixed: the fee in minor units · percent: basis points of the amount (100 = 1%)
  fixed_minor     bigint check (fixed_minor >= 0),
  percent_bp      integer check (percent_bp > 0 and percent_bp <= 10000),
  min_minor       bigint check (min_minor >= 0),
  max_minor       bigint check (max_minor >= 0),
  effective_from  date not null,
  effective_to    date,
  is_active       boolean not null default true,
  note            text,
  created_by      text not null references users (id),
  created_at      timestamptz not null default now(),
  updated_by      text references users (id),
  updated_at      timestamptz not null default now(),
  constraint transfer_fee_rules_distinct_accounts check (from_account_id <> to_account_id),
  constraint transfer_fee_rules_period check (effective_to is null or effective_to >= effective_from),
  constraint transfer_fee_rules_shape check (
    (fee_type = 'fixed' and fixed_minor is not null and percent_bp is null and min_minor is null and max_minor is null)
    or (fee_type = 'percent' and percent_bp is not null and fixed_minor is null
        and (min_minor is null or max_minor is null or max_minor >= min_minor))
  )
);

create index transfer_fee_rules_pair on transfer_fee_rules (from_account_id, to_account_id, effective_from);

-- One active rule per direction per day: overlapping periods would make the quote ambiguous.
create or replace function transfer_fee_rules_no_overlap() returns trigger
language plpgsql as $$
begin
  if new.is_active and exists (
    select 1 from transfer_fee_rules r
     where r.id <> new.id and r.is_active
       and r.from_account_id = new.from_account_id and r.to_account_id = new.to_account_id
       and daterange(r.effective_from, r.effective_to, '[]') && daterange(new.effective_from, new.effective_to, '[]')
  ) then
    raise exception 'transfer fee rule period overlaps another active rule for % → %', new.from_account_id, new.to_account_id
      using errcode = '23P01';
  end if;
  return new;
end
$$;

create trigger transfer_fee_rules_no_overlap
  before insert or update on transfer_fee_rules
  for each row execute function transfer_fee_rules_no_overlap();

-- Serialise rule writes per pair so two concurrent inserts cannot both pass the overlap check.
create or replace function transfer_fee_rules_lock_pair() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('transfer_fee_rules:' || new.from_account_id || '>' || new.to_account_id));
  return new;
end
$$;

create trigger transfer_fee_rules_a_lock_pair
  before insert or update on transfer_fee_rules
  for each row execute function transfer_fee_rules_lock_pair();

-- Where each transfer's fee came from. Existing transfers were typed in by hand.
alter table transfers
  add column fee_source   text not null default 'manual' check (fee_source in ('none', 'rule', 'manual')),
  add column fee_rule_id  text references transfer_fee_rules (id),
  add column fee_snapshot jsonb;
