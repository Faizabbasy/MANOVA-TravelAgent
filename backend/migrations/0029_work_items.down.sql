delete from id_sequences where prefix in ('TSK-', 'PMS-');
drop table if exists project_milestones;
drop table if exists project_tasks;
