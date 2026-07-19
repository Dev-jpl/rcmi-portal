-- 018_bible_study_attendance_logging.sql
-- Allows attendance to be logged against a Bible Study (alongside events and
-- programs) from the QR modal, and reported on in the admin Reports page.
--
-- Aggregation goals:
--   * by bible study      -> bible_study_id
--   * by leading pastor   -> bs_pastor_id / bs_pastor_name
-- The leading pastor is stamped on the log so a report stays accurate even if
-- the study's handlers change later.

alter table public.tbl_attendance_logs
    add column if not exists bible_study_id bigint
        references public.tbl_bible_studies (id) on delete set null,
    add column if not exists bs_pastor_id uuid
        references public.tbl_users (id) on delete set null,
    add column if not exists bs_pastor_name character varying;

comment on column public.tbl_attendance_logs.bible_study_id is
    'Set when log_type = ''bible_study''. The study the attendance was logged for.';
comment on column public.tbl_attendance_logs.bs_pastor_id is
    'Pastor leading the bible study at the time of logging.';
comment on column public.tbl_attendance_logs.bs_pastor_name is
    'Denormalised name of bs_pastor_id, captured at log time.';

create index if not exists idx_attendance_logs_bible_study
    on public.tbl_attendance_logs (bible_study_id)
    where bible_study_id is not null;

create index if not exists idx_attendance_logs_bs_pastor
    on public.tbl_attendance_logs (bs_pastor_id)
    where bs_pastor_id is not null;

-- log_type is a free-form varchar defaulting to 'event'; 'bible_study' joins
-- the existing 'event' and 'program' values. No constraint change needed.
