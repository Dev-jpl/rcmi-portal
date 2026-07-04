-- Newcomer / first-timer module.
--
-- Two capture doors, one follow-up list:
--   1. Leaders/admins enter newcomers manually (source = 'manual').
--   2. A dated QR code opens a public, no-login form (source = 'qr_form').
--
-- The public form is gated by a per-QR access code with a validity window
-- (valid_from / valid_until). Outside that window the form is closed. The anon
-- role gets NO direct access to either table — it may only call the two
-- SECURITY DEFINER RPCs at the bottom (get_welcome_form / submit_newcomer),
-- which validate the code and insert on the caller's behalf.
--
-- Isolation: both tables are brand new and nothing in the existing schema
-- references them. The only outbound link is church_id -> lib_satellite_churches
-- (a read-only lookup). Dropping these two tables + three functions returns the
-- app to its current state.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_bytes / gen_random_uuid

-- ── ACCESS CODES (one row per generated QR) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.tbl_newcomer_access_codes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code         varchar(16) NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(8), 'hex')),
    church_id    int NOT NULL REFERENCES lib_satellite_churches(id),
    valid_from   timestamptz NOT NULL,
    valid_until  timestamptz NOT NULL,
    is_active    boolean NOT NULL DEFAULT true,
    created_by   uuid REFERENCES public.tbl_users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_newcomer_codes_church ON public.tbl_newcomer_access_codes (church_id);

-- ── NEWCOMERS (the follow-up list) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tbl_newcomers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name     varchar(100) NOT NULL,
    last_name      varchar(100) NOT NULL,
    email          varchar(255) NOT NULL,
    contact_no     varchar(30)  NOT NULL,
    church_id      int NOT NULL REFERENCES lib_satellite_churches(id),
    access_code_id uuid REFERENCES public.tbl_newcomer_access_codes(id) ON DELETE SET NULL,
    status         varchar(20) NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'contacted', 'attending', 'dropped')),
    source         varchar(10) NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual', 'qr_form')),
    notes          text,
    submitter_ip   inet,                       -- captured for QR submissions (rate limiting / audit)
    is_deleted     boolean NOT NULL DEFAULT false,
    deleted_at     timestamptz,
    submitted_at   timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Global, case-insensitive uniqueness: a person can only be a newcomer once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_newcomers_email   ON public.tbl_newcomers (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_newcomers_contact ON public.tbl_newcomers (contact_no);
CREATE INDEX IF NOT EXISTS idx_newcomers_church ON public.tbl_newcomers (church_id);
CREATE INDEX IF NOT EXISTS idx_newcomers_status ON public.tbl_newcomers (status);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Leaders (pastoral/network/lpath) manage their own church; admins see all.
-- Anon gets nothing here — it goes through the RPCs only.
ALTER TABLE public.tbl_newcomer_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_newcomers             ENABLE ROW LEVEL SECURITY;

-- Access codes: read/manage
CREATE POLICY "newcomer_codes: read" ON public.tbl_newcomer_access_codes
  FOR SELECT USING (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

CREATE POLICY "newcomer_codes: insert" ON public.tbl_newcomer_access_codes
  FOR INSERT WITH CHECK (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

CREATE POLICY "newcomer_codes: update" ON public.tbl_newcomer_access_codes
  FOR UPDATE USING (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

CREATE POLICY "newcomer_codes: delete" ON public.tbl_newcomer_access_codes
  FOR DELETE USING (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

-- Newcomers: read/manage
CREATE POLICY "newcomers: read" ON public.tbl_newcomers
  FOR SELECT USING (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

CREATE POLICY "newcomers: insert" ON public.tbl_newcomers
  FOR INSERT WITH CHECK (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

CREATE POLICY "newcomers: update" ON public.tbl_newcomers
  FOR UPDATE USING (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

CREATE POLICY "newcomers: delete" ON public.tbl_newcomers
  FOR DELETE USING (
    get_my_role() IN ('super_admin', 'admin')
    OR (get_my_role() IN ('pastoral', 'network_leader', 'lpath_leader')
        AND church_id = get_my_church_id())
  );

-- ── PUBLIC RPC 1: describe the form for a scanned code ────────────────────
-- Returns just enough for the public page to render: is it open, which church,
-- and a friendly message. Never exposes the tables themselves.
CREATE OR REPLACE FUNCTION public.get_welcome_form(p_code text)
RETURNS json AS $$
DECLARE
  v_code   public.tbl_newcomer_access_codes%ROWTYPE;
  v_church text;
BEGIN
  SELECT * INTO v_code
  FROM public.tbl_newcomer_access_codes
  WHERE lower(code) = lower(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'invalid',
      'message', 'This link is not valid.');
  END IF;

  IF NOT v_code.is_active THEN
    RETURN json_build_object('status', 'closed',
      'message', 'This form is closed.');
  END IF;

  IF now() < v_code.valid_from THEN
    RETURN json_build_object('status', 'not_open',
      'message', 'This form is not open yet.');
  END IF;

  IF now() > v_code.valid_until THEN
    RETURN json_build_object('status', 'closed',
      'message', 'This form is closed.');
  END IF;

  SELECT church_name INTO v_church
  FROM lib_satellite_churches WHERE id = v_code.church_id;

  RETURN json_build_object('status', 'open', 'church_name', v_church);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── PUBLIC RPC 2: submit a newcomer through a QR code ─────────────────────
-- The only write path available to anonymous visitors. Validates the code +
-- window, honeypot, required fields, per-IP rate limit, and duplicates, then
-- inserts with church_id derived from the code (never from user input).
CREATE OR REPLACE FUNCTION public.submit_newcomer(
  p_code       text,
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_contact_no text,
  p_honeypot   text DEFAULT ''
)
RETURNS json AS $$
DECLARE
  v_code  public.tbl_newcomer_access_codes%ROWTYPE;
  v_ip    inet;
  v_email text := lower(trim(p_email));
BEGIN
  -- Honeypot: a bot filled the hidden field. Pretend success, insert nothing.
  IF length(coalesce(trim(p_honeypot), '')) > 0 THEN
    RETURN json_build_object('ok', true, 'message', 'Thank you!');
  END IF;

  -- All fields required.
  IF coalesce(trim(p_first_name), '') = ''
     OR coalesce(trim(p_last_name), '') = ''
     OR v_email = ''
     OR coalesce(trim(p_contact_no), '') = '' THEN
    RETURN json_build_object('ok', false, 'message', 'All fields are required.');
  END IF;

  -- Code must exist, be active, and be inside its window.
  SELECT * INTO v_code
  FROM public.tbl_newcomer_access_codes
  WHERE lower(code) = lower(trim(p_code))
  LIMIT 1;

  IF NOT FOUND
     OR NOT v_code.is_active
     OR now() < v_code.valid_from
     OR now() > v_code.valid_until THEN
    RETURN json_build_object('ok', false, 'message', 'This form is closed.');
  END IF;

  -- Best-effort caller IP from the forwarded header, for rate limiting.
  BEGIN
    v_ip := split_part(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      ',', 1
    )::inet;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  -- Rate limit: max 10 submissions per IP per hour.
  IF v_ip IS NOT NULL AND (
       SELECT count(*) FROM public.tbl_newcomers
       WHERE submitter_ip = v_ip AND created_at > now() - interval '1 hour'
     ) >= 10 THEN
    RETURN json_build_object('ok', false,
      'message', 'Too many submissions. Please try again later.');
  END IF;

  -- Friendly duplicate check (unique indexes are the hard backstop below).
  IF EXISTS (
    SELECT 1 FROM public.tbl_newcomers
    WHERE lower(email) = v_email OR contact_no = trim(p_contact_no)
  ) THEN
    RETURN json_build_object('ok', false,
      'message', 'You are already registered.');
  END IF;

  INSERT INTO public.tbl_newcomers
    (first_name, last_name, email, contact_no, church_id, access_code_id, source, submitter_ip)
  VALUES
    (trim(p_first_name), trim(p_last_name), v_email, trim(p_contact_no),
     v_code.church_id, v_code.id, 'qr_form', v_ip);

  RETURN json_build_object('ok', true, 'message', 'Thank you! You are registered.');

EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('ok', false, 'message', 'You are already registered.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Base table privileges for logged-in users. RLS (above) still governs which
-- rows each leader/admin can actually see or change — these grants only let the
-- 'authenticated' role reach the tables at all. 'anon' is intentionally NOT
-- granted anything here; it reaches data only through the RPCs below.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_newcomers             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_newcomer_access_codes TO authenticated;

-- Anonymous (and logged-in) visitors may call the two RPCs, nothing else.
REVOKE ALL ON FUNCTION public.get_welcome_form(text) FROM public;
REVOKE ALL ON FUNCTION public.submit_newcomer(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_welcome_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_newcomer(text, text, text, text, text, text) TO anon, authenticated;
