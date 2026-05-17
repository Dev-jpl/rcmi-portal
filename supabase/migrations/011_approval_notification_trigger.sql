-- Insert an in-app notification when a member's profile transitions to 'approved'.
-- Fires on UPDATE only, and only when the status actually changes.

CREATE OR REPLACE FUNCTION public.notify_member_approved()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND COALESCE(OLD.status, '') <> 'approved' THEN
        INSERT INTO public.tbl_notifications (user_id, title, body, type, link)
        VALUES (
            NEW.user_id,
            'Account Approved',
            'Welcome to the RCMI community! Your account has been approved and you now have full access to the portal.',
            'approval',
            '/app/dashboard'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_member_profile_approved ON public.tbl_members_profile;
CREATE TRIGGER on_member_profile_approved
    AFTER UPDATE OF status ON public.tbl_members_profile
    FOR EACH ROW EXECUTE FUNCTION public.notify_member_approved();
