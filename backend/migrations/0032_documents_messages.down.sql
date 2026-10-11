delete from id_sequences where prefix in ('DOC-', 'MSG-');
drop table if exists messages;
drop table if exists documents;
