-- Add link to default event template in tbl_events
ALTER TABLE tbl_events ADD COLUMN IF NOT EXISTS default_event_id BIGINT REFERENCES lib_default_events(id);

-- Create index for faster lookups when checking for existing instances
CREATE INDEX IF NOT EXISTS idx_events_default_event ON tbl_events(default_event_id, duration_from);
