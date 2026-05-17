-- Backfill tbl_users and tbl_members_profile for auth.users created before
-- the handle_new_user trigger (migration 008) was applied to the remote
-- database. Without these rows, login succeeds in auth but the app sees
-- auth.user = null and bounces the user back to /login.

-- Ensure user_id is unique so the handle_new_user trigger's
-- ON CONFLICT (user_id) clause works (and prevents duplicate profiles).
ALTER TABLE public.tbl_members_profile
    ADD CONSTRAINT tbl_members_profile_user_id_key UNIQUE (user_id);

INSERT INTO public.tbl_users (id, email, first_name, last_name, role_id, role_type, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', ''),
    COALESCE(au.raw_user_meta_data->>'last_name', ''),
    6,
    'member',
    'P'
FROM auth.users au
LEFT JOIN public.tbl_users u ON u.id = au.id
WHERE u.id IS NULL;

INSERT INTO public.tbl_members_profile (
    user_id, email, first_name, middle_name, last_name,
    satellite_church_id, satellite_church_name, status
)
SELECT
    au.id,
    au.email,
    au.raw_user_meta_data->>'first_name',
    au.raw_user_meta_data->>'middle_name',
    au.raw_user_meta_data->>'last_name',
    NULLIF(au.raw_user_meta_data->>'satellite_church_id','')::integer,
    au.raw_user_meta_data->>'satellite_church_name',
    'pending'
FROM auth.users au
LEFT JOIN public.tbl_members_profile p ON p.user_id = au.id
WHERE p.user_id IS NULL;
