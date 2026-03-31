-- Add 'icon' column to lib_ministries
ALTER TABLE lib_ministries
ADD COLUMN icon varchar DEFAULT 'ministries';

-- We could also update database_schema.sql manually later if needed,
-- but this migration suffices for Supabase to apply the change.
