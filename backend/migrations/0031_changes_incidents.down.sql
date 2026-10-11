delete from id_sequences where prefix in ('CR-', 'INC-', 'CNX-');
drop table if exists booking_cancellations;
drop table if exists incidents;
drop table if exists change_requests;
