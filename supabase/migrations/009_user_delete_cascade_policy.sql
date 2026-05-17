-- Allow user deletion by replacing NO ACTION FKs with CASCADE or SET NULL.
-- User-owned content (RSVPs, reactions, prayers offered, notifications, badges
-- received) is removed with the user. Authored or attributed content
-- (announcements, comments, devotionals, prayer requests, audit log, scripture
-- plans, badges given, approvals, leadership pointers) is preserved with the
-- attribution column set to NULL.

-- Drop NOT NULL on columns that will become SET NULL targets
ALTER TABLE public.tbl_announcements   ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.tbl_audit_log       ALTER COLUMN user_id   DROP NOT NULL;
ALTER TABLE public.tbl_comments        ALTER COLUMN user_id   DROP NOT NULL;
ALTER TABLE public.tbl_devotionals     ALTER COLUMN user_id   DROP NOT NULL;
ALTER TABLE public.tbl_member_badges   ALTER COLUMN given_by  DROP NOT NULL;
ALTER TABLE public.tbl_prayer_requests ALTER COLUMN user_id   DROP NOT NULL;

-- ── CASCADE: user-owned content that should disappear with the user ─────────
ALTER TABLE public.tbl_event_rsvps
  DROP CONSTRAINT tbl_event_rsvps_user_id_fkey,
  ADD  CONSTRAINT tbl_event_rsvps_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tbl_devotional_reactions
  DROP CONSTRAINT tbl_devotional_reactions_user_id_fkey,
  ADD  CONSTRAINT tbl_devotional_reactions_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tbl_prayer_request_prayers
  DROP CONSTRAINT tbl_prayer_request_prayers_user_id_fkey,
  ADD  CONSTRAINT tbl_prayer_request_prayers_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tbl_notifications
  DROP CONSTRAINT tbl_notifications_user_id_fkey,
  ADD  CONSTRAINT tbl_notifications_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tbl_member_badges
  DROP CONSTRAINT tbl_member_badges_member_id_fkey,
  ADD  CONSTRAINT tbl_member_badges_member_id_fkey
       FOREIGN KEY (member_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── SET NULL: authored content preserved, attribution cleared ───────────────
ALTER TABLE public.tbl_announcements
  DROP CONSTRAINT tbl_announcements_author_id_fkey,
  ADD  CONSTRAINT tbl_announcements_author_id_fkey
       FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_comments
  DROP CONSTRAINT tbl_comments_user_id_fkey,
  ADD  CONSTRAINT tbl_comments_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_devotionals
  DROP CONSTRAINT tbl_devotionals_user_id_fkey,
  ADD  CONSTRAINT tbl_devotionals_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_prayer_requests
  DROP CONSTRAINT tbl_prayer_requests_user_id_fkey,
  ADD  CONSTRAINT tbl_prayer_requests_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_audit_log
  DROP CONSTRAINT tbl_audit_log_user_id_fkey,
  ADD  CONSTRAINT tbl_audit_log_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_scripture_plans
  DROP CONSTRAINT tbl_scripture_plans_created_by_fkey,
  ADD  CONSTRAINT tbl_scripture_plans_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_member_badges
  DROP CONSTRAINT tbl_member_badges_given_by_fkey,
  ADD  CONSTRAINT tbl_member_badges_given_by_fkey
       FOREIGN KEY (given_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_program_involvements
  DROP CONSTRAINT tbl_program_involvements_approved_by_fkey,
  ADD  CONSTRAINT tbl_program_involvements_approved_by_fkey
       FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── FKs that reference public.tbl_users ─────────────────────────────────────
ALTER TABLE public.tbl_events
  DROP CONSTRAINT tbl_events_created_by_fkey,
  ADD  CONSTRAINT tbl_events_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES public.tbl_users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_attendance_logs
  DROP CONSTRAINT tbl_attendance_logs_logged_by_fkey,
  ADD  CONSTRAINT tbl_attendance_logs_logged_by_fkey
       FOREIGN KEY (logged_by) REFERENCES public.tbl_users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_members_profile
  DROP CONSTRAINT tbl_members_profile_approved_by_fkey,
  ADD  CONSTRAINT tbl_members_profile_approved_by_fkey
       FOREIGN KEY (approved_by) REFERENCES public.tbl_users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_lpath_members
  DROP CONSTRAINT tbl_lpath_members_lpath_leader_id_fkey,
  ADD  CONSTRAINT tbl_lpath_members_lpath_leader_id_fkey
       FOREIGN KEY (lpath_leader_id) REFERENCES public.tbl_users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_lpath_members
  DROP CONSTRAINT fk_lpath_members_lpath_leader,
  ADD  CONSTRAINT fk_lpath_members_lpath_leader
       FOREIGN KEY (lpath_leader_id) REFERENCES public.tbl_users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_network_leaders
  DROP CONSTRAINT tbl_network_leaders_pastor_id_fkey,
  ADD  CONSTRAINT tbl_network_leaders_pastor_id_fkey
       FOREIGN KEY (pastor_id) REFERENCES public.tbl_users(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_network_leaders
  DROP CONSTRAINT fk_network_leaders_pastor,
  ADD  CONSTRAINT fk_network_leaders_pastor
       FOREIGN KEY (pastor_id) REFERENCES public.tbl_users(id) ON DELETE SET NULL;
