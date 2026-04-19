-- Trigger to auto-create tbl_users and tbl_members_profile when a new auth user is created.
-- Uses SECURITY DEFINER to bypass RLS, since the user has no session yet at signup time.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into tbl_users
    INSERT INTO public.tbl_users (id, email, first_name, last_name, role_id, role_type, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        6,
        'member',
        'P'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert into tbl_members_profile
    INSERT INTO public.tbl_members_profile (
        user_id, email, first_name, middle_name, last_name,
        satellite_church_id, satellite_church_name, status
    )
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'middle_name',
        NEW.raw_user_meta_data->>'last_name',
        (NEW.raw_user_meta_data->>'satellite_church_id')::integer,
        NEW.raw_user_meta_data->>'satellite_church_name',
        'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
