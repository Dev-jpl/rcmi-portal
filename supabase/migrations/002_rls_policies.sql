-- ============================================================
-- RCMI PORTAL — ROW LEVEL SECURITY POLICIES
-- Migration: 002_rls_policies.sql
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ── HELPER FUNCTION ──────────────────────────────────────────
-- Returns the role_type of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role_type FROM tbl_users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the satellite_church_id of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_church_id()
RETURNS INT AS $$
  SELECT satellite_church_id FROM tbl_members_profile WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the status of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_status()
RETURNS TEXT AS $$
  SELECT status FROM tbl_members_profile WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE tbl_users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_members_profile     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_pastoral_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_network_leaders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_lpath_leaders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_lpath_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_bod_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_ministry_involvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_ministry_heads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_program_involvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_attendance_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lib_satellite_churches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lib_ministries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lib_ministry_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lib_programs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_membership_type     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ref_roles — PUBLIC READ (everyone needs to read roles)
-- ============================================================

CREATE POLICY "ref_roles: public read"
  ON ref_roles FOR SELECT
  USING (true);

-- ============================================================
-- ref_membership_type — PUBLIC READ
-- ============================================================

CREATE POLICY "ref_membership_type: public read"
  ON ref_membership_type FOR SELECT
  USING (true);

-- ============================================================
-- lib_satellite_churches — PUBLIC READ, admin write
-- ============================================================

CREATE POLICY "churches: public read"
  ON lib_satellite_churches FOR SELECT
  USING (true);

CREATE POLICY "churches: super_admin insert"
  ON lib_satellite_churches FOR INSERT
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "churches: super_admin update"
  ON lib_satellite_churches FOR UPDATE
  USING (get_my_role() = 'super_admin');

-- ============================================================
-- lib_ministries / lib_ministry_roles / lib_programs — PUBLIC READ
-- ============================================================

CREATE POLICY "ministries: public read"
  ON lib_ministries FOR SELECT USING (true);

CREATE POLICY "ministry_roles: public read"
  ON lib_ministry_roles FOR SELECT USING (true);

CREATE POLICY "programs: public read"
  ON lib_programs FOR SELECT USING (true);

-- ============================================================
-- tbl_users
-- ============================================================

-- Members can read their own user record
CREATE POLICY "users: read own"
  ON tbl_users FOR SELECT
  USING (id = auth.uid());

-- Admins & pastorals can read users in their church
CREATE POLICY "users: admin read church"
  ON tbl_users FOR SELECT
  USING (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
  );

-- Only super_admin can update roles
CREATE POLICY "users: super_admin update"
  ON tbl_users FOR UPDATE
  USING (get_my_role() = 'super_admin');

-- Allow insert only via service role (handled by Edge Function on register)
CREATE POLICY "users: service role insert"
  ON tbl_users FOR INSERT
  WITH CHECK (id = auth.uid()); -- only insert your own record

-- ============================================================
-- tbl_members_profile
-- ============================================================

-- Members can read their own profile
CREATE POLICY "profile: read own"
  ON tbl_members_profile FOR SELECT
  USING (user_id = auth.uid());

-- Members can update their own profile (not status/qr_token)
CREATE POLICY "profile: update own"
  ON tbl_members_profile FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- status & approved_by changes blocked at app level + Edge Function
  );

-- Members can insert their own profile on registration
CREATE POLICY "profile: insert own"
  ON tbl_members_profile FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can read all profiles in their church
CREATE POLICY "profile: admin read same church"
  ON tbl_members_profile FOR SELECT
  USING (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
    OR (
      get_my_role() = 'network_leader'
      AND satellite_church_id = get_my_church_id()
    )
  );

-- Admins can update status (approve/reject)
CREATE POLICY "profile: admin update status"
  ON tbl_members_profile FOR UPDATE
  USING (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
    AND satellite_church_id = get_my_church_id()
  );

-- Lpath leaders can view members in their group only
CREATE POLICY "profile: lpath leader read group"
  ON tbl_members_profile FOR SELECT
  USING (
    get_my_role() = 'lpath_leader'
    AND satellite_church_id = get_my_church_id()
  );

-- ============================================================
-- tbl_events
-- ============================================================

-- Approved members can read events for their church
CREATE POLICY "events: approved member read"
  ON tbl_events FOR SELECT
  USING (
    get_my_status() = 'approved'
    AND (
      satellite_church_id = get_my_church_id()
      OR get_my_role() = 'super_admin'
    )
  );

-- Admins / pastorals can insert events for their church
CREATE POLICY "events: admin insert"
  ON tbl_events FOR INSERT
  WITH CHECK (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
    AND satellite_church_id = get_my_church_id()
  );

-- Admins can update their own church events
CREATE POLICY "events: admin update"
  ON tbl_events FOR UPDATE
  USING (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
    AND satellite_church_id = get_my_church_id()
  );

-- Admins can soft-delete (is_active = false) events
CREATE POLICY "events: admin delete"
  ON tbl_events FOR DELETE
  USING (get_my_role() IN ('super_admin', 'admin'));

-- ============================================================
-- tbl_attendance_logs
-- ============================================================

-- Members can read their own attendance
CREATE POLICY "attendance: read own"
  ON tbl_attendance_logs FOR SELECT
  USING (user_id = auth.uid());

-- Members can self check-in (insert their own log)
CREATE POLICY "attendance: self insert"
  ON tbl_attendance_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND get_my_status() = 'approved'
    AND input_method = 'self'
  );

-- Leaders/admins can insert manual or QR logs
CREATE POLICY "attendance: leader manual insert"
  ON tbl_attendance_logs FOR INSERT
  WITH CHECK (
    get_my_role() IN ('super_admin', 'admin', 'pastoral', 'network_leader', 'lpath_leader')
    AND get_my_status() = 'approved'
    AND input_method IN ('manual', 'qr')
  );

-- Admins can read all attendance in their church
CREATE POLICY "attendance: admin read church"
  ON tbl_attendance_logs FOR SELECT
  USING (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
    AND logged_location_id = get_my_church_id()
  );

-- Network/lpath leaders can read attendance for their church
CREATE POLICY "attendance: leader read church"
  ON tbl_attendance_logs FOR SELECT
  USING (
    get_my_role() IN ('network_leader', 'lpath_leader')
    AND logged_location_id = get_my_church_id()
  );

-- Admins can update remarks
CREATE POLICY "attendance: admin update"
  ON tbl_attendance_logs FOR UPDATE
  USING (
    get_my_role() IN ('super_admin', 'admin', 'pastoral')
    AND logged_location_id = get_my_church_id()
  );

-- ============================================================
-- tbl_pastoral_members
-- ============================================================

CREATE POLICY "pastoral: super_admin read all"
  ON tbl_pastoral_members FOR SELECT
  USING (get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "pastoral: read own"
  ON tbl_pastoral_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "pastoral: super_admin write"
  ON tbl_pastoral_members FOR ALL
  USING (get_my_role() = 'super_admin');

-- ============================================================
-- tbl_network_leaders
-- ============================================================

CREATE POLICY "network_leaders: read same church"
  ON tbl_network_leaders FOR SELECT
  USING (
    get_my_status() = 'approved'
    AND church_id = get_my_church_id()
  );

CREATE POLICY "network_leaders: admin write"
  ON tbl_network_leaders FOR ALL
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

-- ============================================================
-- tbl_lpath_leaders
-- ============================================================

CREATE POLICY "lpath_leaders: read same church"
  ON tbl_lpath_leaders FOR SELECT
  USING (
    get_my_status() = 'approved'
    AND church_id = get_my_church_id()
  );

CREATE POLICY "lpath_leaders: read own"
  ON tbl_lpath_leaders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "lpath_leaders: admin write"
  ON tbl_lpath_leaders FOR ALL
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral', 'network_leader'));

-- ============================================================
-- tbl_lpath_members
-- ============================================================

-- Members can read their own lpath membership
CREATE POLICY "lpath_members: read own"
  ON tbl_lpath_members FOR SELECT
  USING (user_id = auth.uid());

-- Lpath leaders can read members in their group
CREATE POLICY "lpath_members: lpath_leader read group"
  ON tbl_lpath_members FOR SELECT
  USING (
    get_my_role() = 'lpath_leader'
    AND lpath_leader_id = auth.uid()
  );

-- Admins can read all
CREATE POLICY "lpath_members: admin read"
  ON tbl_lpath_members FOR SELECT
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

CREATE POLICY "lpath_members: admin write"
  ON tbl_lpath_members FOR ALL
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral', 'network_leader'));

-- ============================================================
-- tbl_ministry_involvements
-- ============================================================

CREATE POLICY "ministry_inv: read own"
  ON tbl_ministry_involvements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ministry_inv: admin read"
  ON tbl_ministry_involvements FOR SELECT
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

CREATE POLICY "ministry_inv: admin write"
  ON tbl_ministry_involvements FOR ALL
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

-- ============================================================
-- tbl_ministry_heads
-- ============================================================

CREATE POLICY "ministry_heads: public read approved"
  ON tbl_ministry_heads FOR SELECT
  USING (get_my_status() = 'approved');

CREATE POLICY "ministry_heads: admin write"
  ON tbl_ministry_heads FOR ALL
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

-- ============================================================
-- tbl_program_involvements
-- ============================================================

CREATE POLICY "program_inv: read own"
  ON tbl_program_involvements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "program_inv: admin read"
  ON tbl_program_involvements FOR SELECT
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

CREATE POLICY "program_inv: admin write"
  ON tbl_program_involvements FOR ALL
  USING (get_my_role() IN ('super_admin', 'admin', 'pastoral'));

-- ============================================================
-- tbl_bod_members
-- ============================================================

CREATE POLICY "bod: super_admin all"
  ON tbl_bod_members FOR ALL
  USING (get_my_role() = 'super_admin');

CREATE POLICY "bod: approved read"
  ON tbl_bod_members FOR SELECT
  USING (get_my_status() = 'approved');