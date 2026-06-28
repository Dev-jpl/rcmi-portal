-- Lost & Found module. Members post items they've lost or found within their
-- satellite church; admins (and super_admins across all churches) can see and
-- moderate everything. Photos are stored in the existing public 'avatars' bucket
-- under a lost-found/ prefix, so no new bucket is required.

CREATE TABLE IF NOT EXISTS public.tbl_lost_found (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type                varchar(10)  NOT NULL CHECK (type IN ('lost', 'found')),
    title               varchar(150) NOT NULL,
    description         text,
    category            varchar(50),               -- electronics, clothing, accessories, documents, keys, bag, other
    location            varchar(150),              -- where it was lost / found
    item_date           date,                      -- when it was lost / found
    photo_url           text,
    contact_info        varchar(150),              -- optional; falls back to poster's profile
    status              varchar(20)  NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'resolved')),
    satellite_church_id int REFERENCES lib_satellite_churches(id),
    resolved_by         uuid REFERENCES public.tbl_users(id) ON DELETE SET NULL,
    resolved_at         timestamptz,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lost_found_church  ON public.tbl_lost_found (satellite_church_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_user    ON public.tbl_lost_found (user_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_status  ON public.tbl_lost_found (status);

ALTER TABLE public.tbl_lost_found ENABLE ROW LEVEL SECURITY;

-- Read: members see only their own posts; super_admins see everything; church
-- admins/pastorals see all items in their church.
CREATE POLICY "lostfound: read own or admin"
  ON public.tbl_lost_found FOR SELECT
  USING (
    user_id = auth.uid()
    OR get_my_role() = 'super_admin'
    OR (get_my_role() IN ('admin', 'pastoral') AND satellite_church_id = get_my_church_id())
  );

-- Insert: a member may only post their own item, as 'open', in their own church.
CREATE POLICY "lostfound: insert own"
  ON public.tbl_lost_found FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'open'
    AND satellite_church_id = get_my_church_id()
  );

-- Update: the poster, or an admin/pastoral in the same church, or a super_admin.
CREATE POLICY "lostfound: update own or admin"
  ON public.tbl_lost_found FOR UPDATE
  USING (
    user_id = auth.uid()
    OR get_my_role() = 'super_admin'
    OR (get_my_role() IN ('admin', 'pastoral') AND satellite_church_id = get_my_church_id())
  );

-- Delete: same authorization as update.
CREATE POLICY "lostfound: delete own or admin"
  ON public.tbl_lost_found FOR DELETE
  USING (
    user_id = auth.uid()
    OR get_my_role() = 'super_admin'
    OR (get_my_role() IN ('admin', 'pastoral') AND satellite_church_id = get_my_church_id())
  );
