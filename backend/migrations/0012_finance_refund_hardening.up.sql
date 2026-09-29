-- Phase 5 hardening (independent review of 0011).

-- 1. A cancellation case can be voided ("rejected") while no refund money has gone out; everything it did is
--    then undone: its credit notes are voided and the billing plan items it cancelled are restored.
alter table billing_schedule_items add column cancelled_by_refund text references refunds (id);

-- 2. Case facts are frozen from the start; only the decision (and a manual case's amount at approval) changes.
--    approved → rejected (void) is allowed only while no active settlement exists.
create or replace function refunds_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'refund cases are never deleted' using errcode = '42501';
  end if;
  if old.status = 'rejected' then
    raise exception 'refund % is rejected and frozen', old.id using errcode = '42501';
  end if;
  if new.subject_type <> old.subject_type or new.subject_id <> old.subject_id or new.project_id <> old.project_id
     or new.party_id <> old.party_id or new.cancel_date <> old.cancel_date or new.calculation <> old.calculation
     or new.departure_date is distinct from old.departure_date or new.days_before is distinct from old.days_before
     or new.policy_id is distinct from old.policy_id or new.policy_version is distinct from old.policy_version
     or new.policy_snapshot is distinct from old.policy_snapshot or new.tier is distinct from old.tier
     or new.basis_minor <> old.basis_minor or new.other_paid_minor <> old.other_paid_minor
     or new.policy_refund_minor <> old.policy_refund_minor or new.additional_refund_minor <> old.additional_refund_minor
     or new.additional_reason is distinct from old.additional_reason or new.source_payments <> old.source_payments
     or new.written_off_minor <> old.written_off_minor or new.reason <> old.reason
     or new.requested_by <> old.requested_by or new.requested_at <> old.requested_at then
    raise exception 'refund % facts are frozen', old.id using errcode = '42501';
  end if;
  if old.status = 'approved' then
    if new.status <> 'rejected' or new.refundable_minor <> old.refundable_minor or new.retained_minor <> old.retained_minor then
      raise exception 'refund % is decided and frozen', old.id using errcode = '42501';
    end if;
    if exists (select 1 from v_active_allocations a where a.target_type = 'refund' and a.target_id = old.id) then
      raise exception 'refund % has settlements; reverse them before voiding the case', old.id using errcode = '42501';
    end if;
    return new;
  end if;
  -- requested: only a manual case gets its amount (and retained) at approval.
  if old.calculation = 'policy' and (new.refundable_minor <> old.refundable_minor or new.retained_minor <> old.retained_minor) then
    raise exception 'refund % amount follows its policy', old.id using errcode = '42501';
  end if;
  return new;
end
$$;

-- 3. Never refund more than was received on the subject (also for manual cases).
alter table refunds add constraint refunds_refundable_cap check (refundable_minor <= basis_minor + other_paid_minor);

-- 4. Credit notes of a case are voided only together with the case.
create or replace function credit_notes_refund_guard() returns trigger
language plpgsql as $$
begin
  if old.refund_id is not null and new.status <> old.status
     and not exists (select 1 from refunds r where r.id = old.refund_id and r.status = 'rejected') then
    raise exception 'credit note % belongs to refund case %', old.id, old.refund_id using errcode = '42501';
  end if;
  return new;
end
$$;

-- 5. A tier cannot be moved out of (or into) a published policy either.
create or replace function cancellation_policy_tiers_draft_only() returns trigger
language plpgsql as $$
declare
  st text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into st from cancellation_policies where id = old.policy_id;
    if st is not null and st <> 'draft' then
      raise exception 'tiers of policy % are frozen', old.policy_id using errcode = '42501';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into st from cancellation_policies where id = new.policy_id;
    if st is not null and st <> 'draft' then
      raise exception 'tiers of policy % are frozen', new.policy_id using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end
$$;
