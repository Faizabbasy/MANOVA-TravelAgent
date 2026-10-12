delete from id_sequences where prefix in ('PT-', 'ST-', 'DST-', 'VC-', 'APT-', 'ALN-', 'MHTL-', 'CUR-', 'TAX-', 'PTM-', 'CXR-', 'NUM-', 'DTPL-', 'RGC-', 'ASR-', 'MTPL-');
drop table if exists organization_profile;
drop table if exists master_data_records;
