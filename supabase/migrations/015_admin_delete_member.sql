-- Full member deletion. A client cannot delete from auth.users directly, so this
-- SECURITY DEFINER function does it on the admin's behalf. Deleting the auth user
-- cascades to tbl_users → tbl_members_profile and all the content FKs wired up in
-- migration 009 (RSVPs, reactions, notifications, etc.), and SET NULLs authored
-- content. This is the single source of truth for "delete a member account".
--
-- Used by both the Delete action and the Reject action (reject = remove account).

CREATE OR REPLACE FUNCTION public.admin_delete_member(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_role   text;
    caller_church int;
    target_church int;
    target_role   text;
BEGIN
    caller_role := public.get_my_role();

    IF caller_role NOT IN ('super_admin', 'admin') THEN
        RAISE EXCEPTION 'Not authorized to delete members';
    END IF;

    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete your own account';
    END IF;

    SELECT role_type INTO target_role FROM public.tbl_users WHERE id = target_user_id;

    -- Church admins may only remove plain members in their own church.
    IF caller_role = 'admin' THEN
        IF target_role IS DISTINCT FROM 'member' THEN
            RAISE EXCEPTION 'Admins can only delete member accounts';
        END IF;

        SELECT satellite_church_id INTO caller_church
            FROM public.tbl_members_profile WHERE user_id = auth.uid();
        SELECT satellite_church_id INTO target_church
            FROM public.tbl_members_profile WHERE user_id = target_user_id;

        IF caller_church IS NULL OR target_church IS NULL OR caller_church <> target_church THEN
            RAISE EXCEPTION 'You can only delete members within your own church';
        END IF;
    END IF;

    -- Deleting the auth user cascades to tbl_users and tbl_members_profile.
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_member(uuid) TO authenticated;
