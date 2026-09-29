-- Restores the 0011 definitions.
create or replace function refunds_guard() returns trigger
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

create or replace function credit_notes_refund_guard() returns trigger
language plpgsql as $$
begin
  if old.refund_id is not null and new.status <> old.status then
    raise exception 'credit note % belongs to refund case %', old.id, old.refund_id using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function cancellation_policy_tiers_draft_only() returns trigger
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

alter table refunds drop constraint refunds_refundable_cap;
alter table billing_schedule_items drop column cancelled_by_refund;
