-- 020_ministry_leader_permissions.sql
--
-- Leadership in this app is an *assignment* (a row in tbl_pastoral_members /
-- tbl_network_leaders / tbl_lpath_leaders / tbl_ministry_involvements), but every
-- RLS policy so far keyed off tbl_users.role_type — which stays 'member' for
-- everyone except admins, because assigning a leader never writes role_type.
-- Net effect: an L-Path leader hit "new row violates row-level security policy"
-- when logging attendance, and saw empty member pickers.
--
-- This migration derives roles from the assignment tables instead, and extends
-- attendance logging to anyone serving in a ministry (head or servant).
-- Plain members remain restricted to self check-in.

-- ── Helper functions ─────────────────────────────────────────────────────

-- Every role the current user effectively holds: their role_type plus any role
-- implied by an active leadership / ministry assignment.
CREATE OR REPLACE FUNCTION get_my_roles()
RETURNS TEXT[] AS $$
  SELECT ARRAY(
    SELECT DISTINCT r FROM (
      SELECT role_type AS r FROM tbl_users WHERE id = auth.uid()
      UNION ALL
      SELECT 'pastoral'::text WHERE EXISTS (
        SELECT 1 FROM tbl_pastoral_members
        WHERE user_id = auth.uid() AND is_active = 'Y')
      UNION ALL
      SELECT 'network_leader'::text WHERE EXISTS (
        SELECT 1 FROM tbl_network_leaders
        WHERE user_id = auth.uid() AND is_active = 'Y')
      UNION ALL
      SELECT 'lpath_leader'::text WHERE EXISTS (
        SELECT 1 FROM tbl_lpath_leaders
        WHERE user_id = auth.uid() AND is_active = 'Y')
      UNION ALL
      SELECT 'ministry_head'::text WHERE EXISTS (
        SELECT 1 FROM tbl_ministry_involvements
        WHERE user_id = auth.uid() AND is_active = 'Y' AND member_type = 'head')
      UNION ALL
      SELECT 'ministry_member'::text WHERE EXISTS (
        SELECT 1 FROM tbl_ministry_involvements
        WHERE user_id = auth.uid() AND is_active = 'Y')
    ) t
    WHERE r IS NOT NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_my_roles() IS
  'All roles the caller holds — tbl_users.role_type plus roles derived from active '
  'leadership / ministry assignments. Use instead of get_my_role() in policies.';

-- True when the caller holds at least one of the given roles.
CREATE OR REPLACE FUNCTION has_any_role(VARIADIC roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT get_my_roles() && roles
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Serving somewhere: admin, a leader, or a ministry member. This is the "may act
-- on behalf of others" line — plain members fall below it. Leaders must also be
-- approved; admins are exempt since their profile status is incidental to the role.
CREATE OR REPLACE FUNCTION is_ministry_participant()
RETURNS BOOLEAN AS $$
  SELECT has_any_role('super_admin', 'admin')
      OR (
        get_my_status() = 'approved'
        AND has_any_role(
          'pastoral', 'network_leader', 'lpath_leader',
          'ministry_head', 'ministry_member'
        )
      )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_ministry_participant() IS
  'Approved user who serves in any leadership or ministry capacity — allowed to '
  'log attendance for others and browse approved members. Excludes plain members.';

-- Ministries the caller heads. Used to scope ministry roster writes.
CREATE OR REPLACE FUNCTION get_my_ministry_head_ids()
RETURNS INT[] AS $$
  SELECT COALESCE(ARRAY(
    SELECT ministry_id FROM tbl_ministry_involvements
    WHERE user_id = auth.uid() AND is_active = 'Y' AND member_type = 'head'
  ), '{}')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── tbl_attendance_logs ──────────────────────────────────────────────────

-- Logging on behalf of others. Two fixes over the old policy: roles now come
-- from assignments, and input_method is matched case-insensitively — the app
-- writes 'QR' while the policy only accepted lowercase 'qr'.
DROP POLICY IF EXISTS "attendance: leader manual insert" ON tbl_attendance_logs;

CREATE POLICY "attendance: participant manual insert"
  ON tbl_attendance_logs FOR INSERT
  WITH CHECK (
    is_ministry_participant()
    AND lower(input_method) IN ('manual', 'qr')
  );

-- Self check-in was also case-sensitive on status only; unchanged apart from
-- being recreated alongside the read policies below for clarity.
DROP POLICY IF EXISTS "attendance: admin read church" ON tbl_attendance_logs;
DROP POLICY IF EXISTS "attendance: leader read church" ON tbl_attendance_logs;

-- Admins read all attendance; everyone else serving reads their own church's.
CREATE POLICY "attendance: participant read church"
  ON tbl_attendance_logs FOR SELECT
  USING (
    has_any_role('super_admin', 'admin')
    OR (
      is_ministry_participant()
      AND logged_location_id = get_my_church_id()
    )
  );

DROP POLICY IF EXISTS "attendance: admin update" ON tbl_attendance_logs;

CREATE POLICY "attendance: leader update"
  ON tbl_attendance_logs FOR UPDATE
  USING (
    has_any_role('super_admin', 'admin')
    OR (
      has_any_role('pastoral', 'network_leader', 'lpath_leader', 'ministry_head')
      AND logged_location_id = get_my_church_id()
    )
  );

-- ── tbl_members_profile ──────────────────────────────────────────────────

-- Anyone serving needs to browse approved members to add them to an L-Path,
-- a ministry, or an attendance log. Pending/rejected profiles stay admin-only
-- so approval remains an admin concern.
DROP POLICY IF EXISTS "profile: lpath leader read group" ON tbl_members_profile;

CREATE POLICY "profile: participant read approved"
  ON tbl_members_profile FOR SELECT
  USING (
    status = 'approved'
    AND is_ministry_participant()
  );

DROP POLICY IF EXISTS "profile: admin read same church" ON tbl_members_profile;

CREATE POLICY "profile: admin read same church"
  ON tbl_members_profile FOR SELECT
  USING (
    has_any_role('super_admin', 'admin', 'pastoral')
    OR (
      has_any_role('network_leader')
      AND satellite_church_id = get_my_church_id()
    )
  );

DROP POLICY IF EXISTS "profile: admin update status" ON tbl_members_profile;

CREATE POLICY "profile: admin update status"
  ON tbl_members_profile FOR UPDATE
  USING (
    has_any_role('super_admin', 'admin', 'pastoral')
    AND satellite_church_id = get_my_church_id()
  );

-- ── tbl_users ────────────────────────────────────────────────────────────

-- Member pickers join to tbl_users for names/emails.
DROP POLICY IF EXISTS "users: admin read church" ON tbl_users;

CREATE POLICY "users: participant read"
  ON tbl_users FOR SELECT
  USING (is_ministry_participant());

-- ── tbl_lpath_members ────────────────────────────────────────────────────

-- An L-Path leader manages their own group. Previously only admins/pastors/
-- network leaders could write, so "Assign Member" failed for the leader.
DROP POLICY IF EXISTS "lpath_members: lpath_leader read group" ON tbl_lpath_members;
DROP POLICY IF EXISTS "lpath_members: admin read" ON tbl_lpath_members;
DROP POLICY IF EXISTS "lpath_members: admin write" ON tbl_lpath_members;

CREATE POLICY "lpath_members: leader read"
  ON tbl_lpath_members FOR SELECT
  USING (
    has_any_role('super_admin', 'admin', 'pastoral', 'network_leader')
    OR lpath_leader_id = auth.uid()
  );

CREATE POLICY "lpath_members: admin write"
  ON tbl_lpath_members FOR ALL
  USING (has_any_role('super_admin', 'admin', 'pastoral', 'network_leader'))
  WITH CHECK (has_any_role('super_admin', 'admin', 'pastoral', 'network_leader'));

CREATE POLICY "lpath_members: lpath_leader write own group"
  ON tbl_lpath_members FOR ALL
  USING (
    has_any_role('lpath_leader')
    AND lpath_leader_id = auth.uid()
  )
  WITH CHECK (
    has_any_role('lpath_leader')
    AND lpath_leader_id = auth.uid()
  );

-- ── tbl_lpath_leaders / tbl_network_leaders / tbl_pastoral_members ───────

-- Read access for the leader-name lookups the dashboards do.
DROP POLICY IF EXISTS "lpath_leaders: admin write" ON tbl_lpath_leaders;
CREATE POLICY "lpath_leaders: admin write"
  ON tbl_lpath_leaders FOR ALL
  USING (has_any_role('super_admin', 'admin', 'pastoral', 'network_leader'))
  WITH CHECK (has_any_role('super_admin', 'admin', 'pastoral', 'network_leader'));

-- The Bible Study scan flow asks for a pastor before the study, so the pastor
-- list has to be readable by whoever is scanning.
CREATE POLICY "pastoral: participant read"
  ON tbl_pastoral_members FOR SELECT
  USING (is_ministry_participant());

DROP POLICY IF EXISTS "network_leaders: admin write" ON tbl_network_leaders;
CREATE POLICY "network_leaders: admin write"
  ON tbl_network_leaders FOR ALL
  USING (has_any_role('super_admin', 'admin', 'pastoral'))
  WITH CHECK (has_any_role('super_admin', 'admin', 'pastoral'));

-- ── tbl_ministry_involvements ────────────────────────────────────────────

-- Ministry heads manage the roster of the ministries they head; everyone
-- serving can read rosters (needed to render "My Ministry" at all).
DROP POLICY IF EXISTS "ministry_inv: admin read" ON tbl_ministry_involvements;
DROP POLICY IF EXISTS "ministry_inv: admin write" ON tbl_ministry_involvements;

CREATE POLICY "ministry_inv: participant read"
  ON tbl_ministry_involvements FOR SELECT
  USING (is_ministry_participant());

CREATE POLICY "ministry_inv: admin write"
  ON tbl_ministry_involvements FOR ALL
  USING (has_any_role('super_admin', 'admin', 'pastoral'))
  WITH CHECK (has_any_role('super_admin', 'admin', 'pastoral'));

CREATE POLICY "ministry_inv: head write own ministry"
  ON tbl_ministry_involvements FOR ALL
  USING (ministry_id = ANY (get_my_ministry_head_ids()))
  WITH CHECK (ministry_id = ANY (get_my_ministry_head_ids()));

-- ── tbl_newcomers ────────────────────────────────────────────────────────

-- Same role-derivation fix; the Newcomers page is offered to leaders in the
-- ministry sidebar but its policies also read role_type.
DROP POLICY IF EXISTS "newcomer_codes: read" ON public.tbl_newcomer_access_codes;
DROP POLICY IF EXISTS "newcomer_codes: insert" ON public.tbl_newcomer_access_codes;
DROP POLICY IF EXISTS "newcomer_codes: update" ON public.tbl_newcomer_access_codes;
DROP POLICY IF EXISTS "newcomer_codes: delete" ON public.tbl_newcomer_access_codes;

CREATE POLICY "newcomer_codes: manage" ON public.tbl_newcomer_access_codes
  FOR ALL
  USING (
    has_any_role('super_admin', 'admin')
    OR (has_any_role('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  )
  WITH CHECK (
    has_any_role('super_admin', 'admin')
    OR (has_any_role('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

DROP POLICY IF EXISTS "newcomers: read" ON public.tbl_newcomers;
DROP POLICY IF EXISTS "newcomers: insert" ON public.tbl_newcomers;
DROP POLICY IF EXISTS "newcomers: update" ON public.tbl_newcomers;
DROP POLICY IF EXISTS "newcomers: delete" ON public.tbl_newcomers;

CREATE POLICY "newcomers: manage" ON public.tbl_newcomers
  FOR ALL
  USING (
    has_any_role('super_admin', 'admin')
    OR (has_any_role('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  )
  WITH CHECK (
    has_any_role('super_admin', 'admin')
    OR (has_any_role('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );
