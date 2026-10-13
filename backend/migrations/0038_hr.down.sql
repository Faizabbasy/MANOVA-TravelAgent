delete from id_sequences where prefix in ('EMP-', 'INC-');
drop table if exists incentives;
drop table if exists payroll_lines;
drop table if exists payroll_runs;
drop table if exists performance_reviews;
drop table if exists attendance_records;
drop table if exists employees;
