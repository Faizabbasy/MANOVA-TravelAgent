alter table projects
  drop column if exists handover_accepted_at,
  drop column if exists handover_accepted_by,
  drop column if exists handover_returned_at,
  drop column if exists handover_return_reason,
  drop column if exists ready_at,
  drop column if exists finance_settled_at,
  drop column if exists finance_settled_by,
  drop column if exists closed_at,
  drop column if exists closed_by,
  drop column if exists final_note,
  drop column if exists client_feedback;
