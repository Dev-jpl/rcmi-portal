-- 019_widen_attendance_log_type.sql
-- tbl_attendance_logs.log_type was varchar(10), sized when the only values were
-- 'event' and 'program'. 'bible_study' is 11 characters and overflowed it:
--   ERROR: value too long for type character varying(10)
-- Widening is non-destructive; existing values are untouched.

alter table public.tbl_attendance_logs
    alter column log_type type character varying(20);
