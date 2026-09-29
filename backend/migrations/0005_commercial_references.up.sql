-- Decision #1 (ADR-007): commercial reference values that Finance reads but does NOT own.
-- Owners: Project module (contract value), Booking module (sell amount, departure date). Finance never writes
-- these columns; they are filled by the demo seed now and by the Project/Booking APIs once those modules move
-- to the server. Money is bigint minor units (IDR has no minor unit).

alter table projects
  add column contract_value_minor bigint check (contract_value_minor is null or contract_value_minor >= 0),
  add column contract_currency text not null default 'IDR' check (contract_currency ~ '^[A-Z]{3}$');

alter table booking_refs
  add column sell_amount_minor bigint check (sell_amount_minor is null or sell_amount_minor >= 0),
  add column departure_date date;

comment on column projects.contract_value_minor is 'Owned by Project module (accepted quotation value). Read-only for Finance.';
comment on column booking_refs.sell_amount_minor is 'Owned by Booking module (client sell price). Read-only for Finance.';
comment on column booking_refs.departure_date is 'Owned by Booking module (first departure / check-in / pickup / session date, Asia/Jakarta). Used for H-x cancellation tiers.';
