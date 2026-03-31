-- =======================================================================================
-- 004_bible_study_management.sql
-- Description: Creates tables for tracking Bible Studies, sessions, handlers, and attendance.
-- =======================================================================================

-- 1. tbl_bible_studies
CREATE TABLE tbl_bible_studies (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    satellite_church_id INT REFERENCES lib_satellite_churches(id) ON DELETE SET NULL,
    location VARCHAR(255),
    schedules JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. tbl_bible_study_handlers
CREATE TABLE tbl_bible_study_handlers (
    bible_study_id BIGINT REFERENCES tbl_bible_studies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES tbl_users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (bible_study_id, user_id)
);

-- 3. tbl_bible_study_sessions
CREATE TABLE tbl_bible_study_sessions (
    id BIGSERIAL PRIMARY KEY,
    bible_study_id BIGINT REFERENCES tbl_bible_studies(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    topic VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES tbl_users(id) ON DELETE SET NULL
);

-- 4. tbl_bible_study_attendance
CREATE TABLE tbl_bible_study_attendance (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES tbl_bible_study_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES tbl_users(id) ON DELETE CASCADE, -- Nullable if it's an unregistered guest
    guest_name VARCHAR(255), -- Populated if user_id is null
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    logged_by UUID REFERENCES tbl_users(id) ON DELETE SET NULL,
    -- Basic constraint to ensure either user_id or guest_name is provided
    CONSTRAINT chk_attendee CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND TRIM(guest_name) <> ''))
);

-- Optional constraint to prevent duplicate registered attendees per session
CREATE UNIQUE INDEX idx_unique_session_user ON tbl_bible_study_attendance (session_id, user_id) WHERE user_id IS NOT NULL;

-- Automatically update timestamps trigger
CREATE TRIGGER trg_bible_studies_updated_at
BEFORE UPDATE ON tbl_bible_studies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =======================================================================================
-- GRANTS
-- Set explicit permissions to match standard Supabase access patterns for non-RLS projects.
-- =======================================================================================
GRANT ALL ON TABLE tbl_bible_studies TO anon, authenticated, service_role;
GRANT ALL ON TABLE tbl_bible_study_handlers TO anon, authenticated, service_role;
GRANT ALL ON TABLE tbl_bible_study_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE tbl_bible_study_attendance TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
