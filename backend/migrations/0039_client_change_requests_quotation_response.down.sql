alter table quotations drop constraint if exists quotations_client_response_complete;
alter table quotations drop column if exists client_responded_at, drop column if exists client_responded_by,
  drop column if exists client_response_version, drop column if exists client_response_note, drop column if exists client_response;
alter table change_requests drop constraint if exists change_requests_cancel_reason;
update change_requests set status = 'under-review' where status = 'waiting-client-approval';
update change_requests set status = 'rejected', rejection_reason = coalesce(rejection_reason, cancel_reason, 'Dibatalkan') where status = 'cancelled';
alter table change_requests drop column if exists cancelled_at, drop column if exists cancelled_by, drop column if exists cancel_reason,
  drop column if exists client_decided_at, drop column if exists client_decided_by, drop column if exists cancellation_fee_minor, drop column if exists change_type;
alter table change_requests drop constraint if exists change_requests_status_check;
alter table change_requests add constraint change_requests_status_check
  check (status in ('submitted', 'under-review', 'approved', 'rejected', 'implemented'));
