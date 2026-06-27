-- Notify admins when a new member registers (status 'pending'), so they know
-- there is someone awaiting approval. Mirrors the approval notification pattern
-- in migration 011.
--
-- Recipients: every super_admin (they oversee all churches) plus admins whose own
-- profile is in the same satellite church as the new member.

CREATE OR REPLACE FUNCTION public.notify_admins_new_member()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending' THEN
        INSERT INTO public.tbl_notifications (user_id, title, body, type, link)
        SELECT
            u.id,
            'New member awaiting approval',
            TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''))
                || ' has registered and is waiting to be approved.',
            'member_pending',
            '/admin/members'
        FROM public.tbl_users u
        WHERE u.role_type = 'super_admin'
           OR (
                u.role_type = 'admin'
                AND EXISTS (
                    SELECT 1
                    FROM public.tbl_members_profile ap
                    WHERE ap.user_id = u.id
                      AND ap.satellite_church_id = NEW.satellite_church_id
                )
           );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_member_registered ON public.tbl_members_profile;
CREATE TRIGGER on_member_registered
    AFTER INSERT ON public.tbl_members_profile
    FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_member();
