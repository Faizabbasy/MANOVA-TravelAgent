-- S12b-2: the client portal's change-request steps and quotation responses are API-owned.
alter table change_requests drop constraint if exists change_requests_status_check;
alter table change_requests add constraint change_requests_status_check
  check (status in ('submitted', 'under-review', 'waiting-client-approval', 'approved', 'rejected', 'implemented', 'cancelled'));
alter table change_requests
  add column change_type text check (change_type in ('add-participant', 'remove-participant', 'replace-participant', 'change-date', 'change-flight',
    'change-hotel', 'add-transportation', 'add-activity', 'upgrade-service', 'remove-service', 'change-itinerary', 'cancel-service', 'cancel-project')),
  add column cancellation_fee_minor bigint check (cancellation_fee_minor >= 0),
  add column client_decided_by text references users (id),
  add column client_decided_at timestamptz,
  add column cancel_reason text,
  add column cancelled_by text references users (id),
  add column cancelled_at timestamptz,
  add constraint change_requests_cancel_reason check (status <> 'cancelled' or cancel_reason is not null);

alter table quotations
  add column client_response text check (client_response in ('accepted', 'rejected', 'revision-requested')),
  add column client_response_note text,
  add column client_response_version integer,
  add column client_responded_by text references users (id),
  add column client_responded_at timestamptz,
  add constraint quotations_client_response_complete check ((client_response is null) = (client_response_version is null));
