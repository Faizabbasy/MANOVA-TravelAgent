-- Project Order workflow (S3b): handover, ready, finance close and close move to the server with the status.
alter table projects
  add column handover_accepted_at   timestamptz,
  add column handover_accepted_by   text references users (id),
  add column handover_returned_at   timestamptz,
  add column handover_return_reason text,
  add column ready_at               timestamptz,
  add column finance_settled_at     timestamptz,
  add column finance_settled_by     text references users (id),
  add column closed_at              timestamptz,
  add column closed_by              text references users (id),
  add column final_note             text,
  add column client_feedback        text;
