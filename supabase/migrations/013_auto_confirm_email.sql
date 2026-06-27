-- Auto-confirm email at the database level so the GoTrue "Confirm email" dashboard
-- setting is no longer a blocker. GoTrue's password login rejects accounts whose
-- email_confirmed_at IS NULL ("Email not confirmed"); by stamping it on insert,
-- every new signup is immediately able to log in.
--
-- This makes registration → immediate login work without touching the dashboard,
-- and pairs with the client-side signInWithPassword fallback in auth.store.ts.

-- 1. Stamp email_confirmed_at on every new auth user.
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email();

-- 2. Confirm all existing unconfirmed accounts so they can log in right now.
--    (Only email_confirmed_at — confirmed_at is a generated column.)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
