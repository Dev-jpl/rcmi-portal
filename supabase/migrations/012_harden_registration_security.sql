-- Harden registration so clients can self-register only as a plain pending member,
-- and can never self-approve or self-promote. The app creates these rows client-side
-- (createMemberRecords in auth.store.ts), so RLS must pin the privileged columns.
--
-- Context: the previous INSERT policies only checked id/user_id = auth.uid(), which
-- let any authenticated user insert tbl_users.role_type = 'super_admin' or
-- tbl_members_profile.status = 'approved' directly via the API — privilege escalation.

-- 1. INSERT on tbl_users: only a self-owned, plain "member" row.
DROP POLICY IF EXISTS "users: service role insert" ON public.tbl_users;
DROP POLICY IF EXISTS "Users can insert own user" ON public.tbl_users;
DROP POLICY IF EXISTS "users: self insert member" ON public.tbl_users;
CREATE POLICY "users: self insert member"
  ON public.tbl_users FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role_type = 'member'
    AND role_id = 6
    AND is_active = 'P'
  );

-- 2. INSERT on tbl_members_profile: only a self-owned, pending, unapproved profile.
DROP POLICY IF EXISTS "profile: insert own" ON public.tbl_members_profile;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.tbl_members_profile;
DROP POLICY IF EXISTS "profile: self insert pending" ON public.tbl_members_profile;
CREATE POLICY "profile: self insert pending"
  ON public.tbl_members_profile FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
  );

-- 3. Prevent members from self-approving via UPDATE. A non-admin caller cannot change
--    the protected columns; the trigger pins them to their existing values. Admins,
--    super_admins and pastorals (who run the approval flow) pass through unchanged.
CREATE OR REPLACE FUNCTION public.protect_member_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(public.get_my_role(), 'member') NOT IN ('super_admin', 'admin', 'pastoral') THEN
    NEW.status          := OLD.status;
    NEW.approved_by     := OLD.approved_by;
    NEW.approved_at     := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
    NEW.qr_token        := OLD.qr_token;
    NEW.user_id         := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_member_profile ON public.tbl_members_profile;
CREATE TRIGGER trg_protect_member_profile
  BEFORE UPDATE ON public.tbl_members_profile
  FOR EACH ROW EXECUTE FUNCTION public.protect_member_profile_fields();

-- 4. Clean up the 4 orphaned auth users that have no profile row (they predate the
--    current flow and are stuck at /login). Deleting from auth.users cascades to
--    tbl_users and tbl_members_profile. They can simply register again.
DELETE FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.tbl_members_profile p WHERE p.user_id = au.id
);
