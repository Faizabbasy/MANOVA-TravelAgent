delete from id_sequences where prefix in ('AST-', 'MNT-', 'ACO-', 'CAM-', 'PRD-', 'PRP-', 'VHC-', 'IT-');
drop table if exists asset_checkouts;
drop table if exists asset_maintenance;
drop table if exists assets;
