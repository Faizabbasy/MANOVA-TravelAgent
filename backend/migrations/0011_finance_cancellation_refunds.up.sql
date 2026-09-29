-- Finance Phase 5: cancellation policies (versioned tiers), policy snapshots per booking/project, refund cases
-- (cancellation + refund obligation), refund settlements (money out, allocated to the case).
-- docs/manova-finance-implementation/08-CANCELLATION-DP-POLICY-REFUND-FLOW.md, FINANCE-DOMAIN-MAPPING §6.4.

create sequence finance_policy_seq;
create sequence finance_policy_tier_seq;
create sequence finance_refund_seq;

-- ── Policies ──────────────────────────────────────────────────────────────────────────────────────────

create table cancellation_policies (
  id              text primary key default ('POL-' || lpad(nextval('finance_policy_seq')::text, 4, '0')),
  code            text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  version         integer not null check (version >= 1),
  name            text not null check (length(btrim(name)) between 3 and 120),
  description     text,
  -- null = applies to any booking type and to whole-project cancellations
  booking_type    text check (booking_type in ('flight', 'hotel', 'transport', 'mice')),
  basis           text not null default 'paid_customer_deposit' check (basis = 'paid_customer_deposit'),
  status          text not null default 'draft' check (status in ('draft', 'published', 'inactive')),
  effective_from  date not null,
  effective_to    date,
  created_by      text not null references users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_by    text references users (id),
  published_at    timestamptz,
  deactivated_by  text references users (id),
  deactivated_at  timestamptz,
  deactivation_reason text,
  unique (code, version),
  constraint cancellation_policies_dates check (effective_to is null or effective_to >= effective_from),
  constraint cancellation_policies_published check ((status = 'draft') = (published_at is null))
);
-- At most one draft per code (the next version being prepared).
create unique index cancellation_policies_one_draft on cancellation_policies (code) where status = 'draft';

-- Tier = half-open interval of days before departure: min_days <= H < max_days (null = unbounded).
create table cancellation_policy_tiers (
  id          text primary key default ('PT-' || lpad(nextval('finance_policy_tier_seq')::text, 5, '0')),
  policy_id   text not null references cancellation_policies (id) on delete cascade,
  min_days    integer,
  max_days    integer,
  refund_bp   integer not null check (refund_bp between 0 and 10000),
  constraint cancellation_policy_tiers_interval check (min_days is null or max_days is null or min_days < max_days)
);
create index cancellation_policy_tiers_policy_idx on cancellation_policy_tiers (policy_id);

-- A published policy is a rule customers were told about: only deactivation may change it.
create function cancellation_policies_freeze() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'policy % is published; it cannot be deleted', old.id using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'inactive' then
    raise exception 'policy % is inactive and frozen', old.id using errcode = '42501';
  end if;
  if old.status = 'published' then
    if new.status not in ('published', 'inactive')
       or new.code <> old.code or new.version <> old.version or new.name <> old.name
       or new.description is distinct from old.description or new.booking_type is distinct from old.booking_type
       or new.basis <> old.basis or new.effective_from <> old.effective_from
       or new.effective_to is distinct from old.effective_to then
      raise exception 'published policy % cannot be edited; create a new version', old.id using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
create trigger cancellation_policies_freeze
  before update or delete on cancellation_policies
  for each row execute function cancellation_policies_freeze();

create function cancellation_policy_tiers_draft_only() returns trigger
language plpgsql as $$
declare
  pid text := coalesce(new.policy_id, old.policy_id);
  st text;
begin
  select status into st from cancellation_policies where id = pid;
  -- A cascade from deleting a draft policy finds no parent row any more.
  if st is not null and st <> 'draft' then
    raise exception 'tiers of policy % are frozen', pid using errcode = '42501';
  end if;
  return coalesce(new, old);
end
$$;
create trigger cancellation_policy_tiers_draft_only
  before insert or update or delete on cancellation_policy_tiers
  for each row execute function cancellation_policy_tiers_draft_only();

-- ── Policy snapshot per booking / project ─────────────────────────────────────────────────────────────

create table cancellation_policy_assignments (
  subject_type  text not null check (subject_type in ('project', 'flight', 'hotel', 'transport', 'mice')),
  subject_id    text not null,
  project_id    text not null references projects (id),
  policy_id     text not null references cancellation_policies (id),
  policy_version integer not null,
  snapshot      jsonb not null,
  note          text,
  assigned_by   text not null references users (id),
  assigned_at   timestamptz not null default now(),
  primary key (subject_type, subject_id)
);
create index cancellation_policy_assignments_project_idx on cancellation_policy_assignments (project_id);

-- ── Refund cases (a cancellation and what is owed back because of it) ─────────────────────────────────

create table refunds (
  id                      text primary key default ('RF-' || lpad(nextval('finance_refund_seq')::text, 5, '0')),
  subject_type            text not null check (subject_type in ('project', 'flight', 'hotel', 'transport', 'mice')),
  subject_id              text not null,
  project_id              text not null references projects (id),
  party_id                text not null references parties (id),
  cancel_date             date not null,
  departure_date          date,
  days_before             integer,
  calculation             text not null check (calculation in ('policy', 'manual')),
  policy_id               text references cancellation_policies (id),
  policy_version          integer,
  policy_snapshot         jsonb,
  tier                    jsonb,
  basis_minor             bigint not null check (basis_minor >= 0),
  other_paid_minor        bigint not null check (other_paid_minor >= 0),
  policy_refund_minor     bigint not null check (policy_refund_minor >= 0),
  additional_refund_minor bigint not null default 0 check (additional_refund_minor >= 0),
  additional_reason       text,
  refundable_minor        bigint not null check (refundable_minor >= 0 and refundable_minor <= 1000000000000000),
  retained_minor          bigint not null check (retained_minor >= 0),
  written_off_minor       bigint not null default 0 check (written_off_minor >= 0),
  source_payments         jsonb not null default '[]'::jsonb,
  reason                  text not null check (length(btrim(reason)) >= 5),
  status                  text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  requested_by            text not null references users (id),
  requested_at            timestamptz not null default now(),
  decided_by              text references users (id),
  decided_at              timestamptz,
  decision_note           text,
  reject_reason           text,
  constraint refunds_policy_fields check ((calculation = 'policy') = (policy_id is not null and policy_snapshot is not null and tier is not null)),
  constraint refunds_retained check (calculation = 'manual' or retained_minor = basis_minor - policy_refund_minor),
  constraint refunds_refundable check (calculation = 'manual' or refundable_minor = policy_refund_minor + additional_refund_minor),
  constraint refunds_additional_reason check (additional_refund_minor = 0 or additional_reason is not null),
  constraint refunds_decision check ((status = 'requested') = (decided_at is null)),
  constraint refunds_reject_reason check ((status = 'rejected') = (reject_reason is not null))
);
-- One live case per subject; a rejected case may be replaced by a new one.
create unique index refunds_one_active_per_subject on refunds (subject_type, subject_id) where status <> 'rejected';
create index refunds_project_idx on refunds (project_id);
create index refunds_status_idx on refunds (status, requested_at);

create function refunds_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'refund cases are never deleted' using errcode = '42501';
  end if;
  if old.status <> 'requested' then
    raise exception 'refund % is decided and frozen', old.id using errcode = '42501';
  end if;
  if new.subject_type <> old.subject_type or new.subject_id <> old.subject_id or new.project_id <> old.project_id
     or new.party_id <> old.party_id or new.cancel_date <> old.cancel_date or new.calculation <> old.calculation
     or new.basis_minor <> old.basis_minor or new.other_paid_minor <> old.other_paid_minor
     or new.policy_refund_minor <> old.policy_refund_minor or new.policy_snapshot is distinct from old.policy_snapshot
     or new.source_payments <> old.source_payments or new.written_off_minor <> old.written_off_minor
     or new.requested_by <> old.requested_by then
    raise exception 'refund % facts are frozen', old.id using errcode = '42501';
  end if;
  -- Only a manual case gets its amount set by the approver.
  if old.calculation = 'policy' and new.refundable_minor <> old.refundable_minor then
    raise exception 'refund % amount follows its policy', old.id using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger refunds_guard before update or delete on refunds for each row execute function refunds_guard();
create trigger refunds_no_truncate before truncate on refunds for each statement execute function finance_block_mutation();

-- ── Credit notes linked to a case ─────────────────────────────────────────────────────────────────────

alter table credit_notes add column refund_id text references refunds (id);
alter table credit_notes add constraint credit_notes_refund_liability_linked check (effect <> 'refund_liability' or refund_id is not null);

-- Credit notes created by a cancellation case belong to it; they are never voided on their own.
create function credit_notes_refund_guard() returns trigger
language plpgsql as $$
begin
  if old.refund_id is not null and new.status <> old.status then
    raise exception 'credit note % belongs to refund case %', old.id, old.refund_id using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger credit_notes_refund_guard before update on credit_notes for each row execute function credit_notes_refund_guard();

-- ── Settlements: refund_settlement transactions allocated to a case ──────────────────────────────────

alter table payment_allocations drop constraint payment_allocations_target_type_check;
alter table payment_allocations add constraint payment_allocations_target_type_check
  check (target_type in ('customer_invoice', 'vendor_invoice', 'refund'));

create view v_refund_balances as
  select r.id as refund_id,
         r.refundable_minor,
         coalesce((select sum(a.amount_minor) from v_active_allocations a
                    where a.target_type = 'refund' and a.target_id = r.id), 0) as settled_minor
    from refunds r;

create or replace function payment_allocations_check() returns trigger
language plpgsql as $$
declare
  tx financial_transactions%rowtype;
  allocated numeric;
  outstanding numeric;
  inv customer_invoices%rowtype;
  vinv vendor_invoices%rowtype;
  rf refunds%rowtype;
begin
  select * into tx from financial_transactions where id = new.transaction_id;
  if tx.reversal_of_id is not null or exists (select 1 from financial_transactions r where r.reversal_of_id = tx.id) then
    raise exception 'cannot allocate a reversed payment' using errcode = '23514';
  end if;
  select coalesce(sum(amount_minor), 0) into allocated from payment_allocations where transaction_id = tx.id;
  if allocated + new.amount_minor > tx.amount_minor then
    raise exception 'allocations exceed payment %', tx.id using errcode = '23514';
  end if;

  if new.target_type = 'customer_invoice' then
    if tx.kind <> 'customer_receipt' then
      raise exception 'only customer receipts settle customer invoices' using errcode = '23514';
    end if;
    select * into inv from customer_invoices where id = new.target_id;
    if not found or inv.status <> 'issued' or inv.party_id is distinct from tx.party_id then
      raise exception 'invoice % is not an issued invoice of the paying customer', new.target_id using errcode = '23514';
    end if;
    select b.total_minor - b.paid_minor - b.credited_minor into outstanding
      from v_customer_invoice_balances b where b.invoice_id = inv.id;
  elsif new.target_type = 'vendor_invoice' then
    if tx.kind <> 'vendor_payment' then
      raise exception 'only vendor payments settle vendor invoices' using errcode = '23514';
    end if;
    select * into vinv from vendor_invoices where id = new.target_id;
    if not found or vinv.status <> 'approved' or vinv.vendor_id is distinct from tx.vendor_id then
      raise exception 'vendor invoice % is not an approved invoice of the paid vendor', new.target_id using errcode = '23514';
    end if;
    select b.total_minor - b.paid_minor into outstanding
      from v_vendor_invoice_balances b where b.vendor_invoice_id = vinv.id;
  else
    if tx.kind <> 'refund_settlement' then
      raise exception 'only refund settlements settle refund cases' using errcode = '23514';
    end if;
    select * into rf from refunds where id = new.target_id;
    if not found or rf.status <> 'approved' or rf.party_id is distinct from tx.party_id then
      raise exception 'refund % is not an approved case of this customer', new.target_id using errcode = '23514';
    end if;
    select b.refundable_minor - b.settled_minor into outstanding
      from v_refund_balances b where b.refund_id = rf.id;
  end if;

  if new.amount_minor > outstanding then
    raise exception 'allocation exceeds outstanding of %', new.target_id using errcode = '23514';
  end if;
  return new;
end
$$;
