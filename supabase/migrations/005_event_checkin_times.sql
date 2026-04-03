-- Migration: 005_event_checkin_times.sql
-- Add check-in start time to regular events
ALTER TABLE tbl_events ADD COLUMN IF NOT EXISTS checkin_start_at TIMESTAMPTZ;

-- Add default check-in time to recurring templates
ALTER TABLE lib_default_events ADD COLUMN IF NOT EXISTS default_checkin_time TIME;
