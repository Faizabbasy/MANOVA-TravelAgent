delete from id_sequences where prefix in ('GRP-', 'TRV-', 'ROOM-');
drop table if exists room_assignments;
drop table if exists travelers;
drop table if exists traveler_groups;
