-- ============================================================
-- RCMI PORTAL — INITIAL SCHEMA
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- REFERENCE & LIBRARY TABLES
-- ============================================================

CREATE TABLE ref_roles (
id SERIAL PRIMARY KEY,
role_type VARCHAR(50) NOT NULL UNIQUE, -- 'super_admin' | 'admin' | 'pastoral' | 'network_leader' | 'lpath_leader' | 'member'
description VARCHAR(255),
is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE ref_membership_type (
id SERIAL PRIMARY KEY,
membership_type VARCHAR(50) NOT NULL UNIQUE,
description VARCHAR(255),
is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE lib_satellite_churches (
id SERIAL PRIMARY KEY,
church_name VARCHAR(100) NOT NULL,
country_name VARCHAR(100),
country_code VARCHAR(10),
region_name VARCHAR(100),
region_code VARCHAR(20),
province_name VARCHAR(100),
province_code VARCHAR(20),
municipality_name VARCHAR(100),
municipality_code VARCHAR(20),
barangay_name VARCHAR(100),
barangay_code VARCHAR(20),
longitude DECIMAL(10, 7),
latitude DECIMAL(10, 7),
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lib_programs (
id SERIAL PRIMARY KEY,
type VARCHAR(100) NOT NULL,
description VARCHAR(255),
date_started DATE,
is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE lib_ministries (
id SERIAL PRIMARY KEY,
ministry_type VARCHAR(100) NOT NULL,
description VARCHAR(255),
is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE lib_ministry_roles (
id SERIAL PRIMARY KEY,
ministry_type_id INT REFERENCES lib_ministries(id) ON DELETE CASCADE,
ministry_type VARCHAR(100),
role_title VARCHAR(100),
description VARCHAR(255),
is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- CORE USER TABLES
-- ============================================================

-- tbl_users mirrors Supabase Auth (auth.users)
-- Do NOT store passwords here — Supabase Auth handles that
CREATE TABLE tbl_users (
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
email VARCHAR(255) NOT NULL UNIQUE,
first_name VARCHAR(100),
middle_name VARCHAR(100),
last_name VARCHAR(100),
ext_name VARCHAR(20),
role_id INT REFERENCES ref_roles(id),
role_type VARCHAR(50),
is_active CHAR(1) DEFAULT 'N', -- 'Y' | 'N' | 'P' (pending)
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_members_profile (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
email VARCHAR(255),
first_name VARCHAR(100),
middle_name VARCHAR(100),
last_name VARCHAR(100),
ext_name VARCHAR(20),
birth_date DATE,
country_name VARCHAR(100),
country_code VARCHAR(10),
region_name VARCHAR(100),
region_code VARCHAR(20),
province_name VARCHAR(100),
province_code VARCHAR(20),
municipality_name VARCHAR(100),
municipality_code VARCHAR(20),
barangay_name VARCHAR(100),
barangay_code VARCHAR(20),
satellite_church_id INT REFERENCES lib_satellite_churches(id),
satellite_church_name VARCHAR(100),
network_id INT,
network_name VARCHAR(100),
membership_type_id INT REFERENCES ref_membership_type(id),
profile_photo_url TEXT,
-- Registration workflow additions
status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
qr_token UUID UNIQUE DEFAULT uuid_generate_v4(),
approved_by UUID REFERENCES tbl_users(id),
approved_at TIMESTAMPTZ,
rejected_reason TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADERSHIP HIERARCHY TABLES
-- ============================================================

CREATE TABLE tbl_pastoral_members (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
church_id INT REFERENCES lib_satellite_churches(id),
date_started DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_network_leaders (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
pastor_id UUID REFERENCES tbl_users(id),
pastor_name VARCHAR(200),
church_id INT REFERENCES lib_satellite_churches(id),
date_started DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_lpath_leaders (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
network_id BIGINT REFERENCES tbl_network_leaders(id),
network_name VARCHAR(200),
church_id INT REFERENCES lib_satellite_churches(id),
date_started DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_lpath_members (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
lpath_leader_id UUID REFERENCES tbl_users(id),
lpath_leader_name VARCHAR(200),
network_leader_id BIGINT REFERENCES tbl_network_leaders(id),
network_leader_name VARCHAR(200),
church_id INT REFERENCES lib_satellite_churches(id),
date_started DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_bod_members (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
date_started DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MINISTRY & PROGRAM TABLES
-- ============================================================

CREATE TABLE tbl_ministry_involvements (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
ministry_id INT REFERENCES lib_ministries(id),
ministry_type VARCHAR(100),
ministry_role_id INT REFERENCES lib_ministry_roles(id),
ministry_role_title VARCHAR(100),
date_started DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_ministry_heads (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
ministry_id INT REFERENCES lib_ministries(id),
ministry_type VARCHAR(100),
ministry_role_id INT REFERENCES lib_ministry_roles(id),
ministry_role_title VARCHAR(100),
date_assigned DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_program_involvements (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
program_id INT REFERENCES lib_programs(id),
program_type VARCHAR(100),
date_started DATE,
date_ended DATE,
is_active CHAR(1) DEFAULT 'Y',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS & ATTENDANCE TABLES
-- ============================================================

CREATE TABLE tbl_events (
id BIGSERIAL PRIMARY KEY,
event_title VARCHAR(200) NOT NULL,
event_type VARCHAR(50), -- 'service' | 'cell' | 'program' | 'special'
satellite_church_id INT REFERENCES lib_satellite_churches(id),
duration_from TIMESTAMPTZ,
duration_to TIMESTAMPTZ,
remarks TEXT,
created_by UUID REFERENCES tbl_users(id),
created_by_name VARCHAR(200),
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_attendance_logs (
id BIGSERIAL PRIMARY KEY,
user_id UUID NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
event_id BIGINT REFERENCES tbl_events(id),
event_title VARCHAR(200),
logged_at TIMESTAMPTZ DEFAULT NOW(),
logged_by UUID REFERENCES tbl_users(id),
logged_by_name VARCHAR(200),
logged_location_id INT REFERENCES lib_satellite_churches(id),
logged_location_name VARCHAR(100),
input_method VARCHAR(10) NOT NULL DEFAULT 'self', -- 'qr' | 'manual' | 'self'
log_date DATE DEFAULT CURRENT_DATE,
remarks TEXT,
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMPTZ DEFAULT NOW(),
-- Prevent duplicate check-ins per event per member
UNIQUE(user_id, event_id)
);

-- ============================================================
-- USEFUL VIEWS FOR REPORTS & DASHBOARDS
-- ============================================================

-- Attendance summary per event
CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
e.id AS event_id,
e.event_title,
e.event_type,
e.duration_from,
sc.church_name,
sc.id AS church_id,
COUNT(al.id) AS total_attendees,
SUM(CASE WHEN al.input_method = 'qr' THEN 1 ELSE 0 END) AS via_qr,
SUM(CASE WHEN al.input_method = 'manual' THEN 1 ELSE 0 END) AS via_manual,
SUM(CASE WHEN al.input_method = 'self' THEN 1 ELSE 0 END) AS via_self
FROM tbl_events e
LEFT JOIN tbl_attendance_logs al ON al.event_id = e.id
LEFT JOIN lib_satellite_churches sc ON sc.id = e.satellite_church_id
GROUP BY e.id, sc.id;

-- Member list with church and status
CREATE OR REPLACE VIEW v_members_list AS
SELECT
u.id AS user_id,
u.email,
mp.first_name,
mp.middle_name,
mp.last_name,
mp.birth_date,
mp.status,
mp.qr_token,
mp.profile_photo_url,
sc.church_name,
sc.id AS church_id,
r.role_type,
mp.created_at AS registered_at,
mp.approved_at
FROM tbl_users u
LEFT JOIN tbl_members_profile mp ON mp.user_id = u.id
LEFT JOIN lib_satellite_churches sc ON sc.id = mp.satellite_church_id
LEFT JOIN ref_roles r ON r.id = u.role_id;

-- Attendance per member
CREATE OR REPLACE VIEW v_member_attendance AS
SELECT
al.user_id,
CONCAT(mp.first_name, ' ', mp.last_name) AS member_name,
sc.church_name,
e.event_title,
e.event_type,
al.input_method,
al.log_date,
al.logged_at
FROM tbl_attendance_logs al
JOIN tbl_members_profile mp ON mp.user_id = al.user_id
JOIN tbl_events e ON e.id = al.event_id
JOIN lib_satellite_churches sc ON sc.id = al.logged_location_id;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

-- Apply trigger to all main tables
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON tbl_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_members_profile_updated_at
  BEFORE UPDATE ON tbl_members_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON tbl_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_churches_updated_at
  BEFORE UPDATE ON lib_satellite_churches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SEED: REFERENCE DATA
-- ============================================================

INSERT INTO ref_roles (role_type, description) VALUES
  ('super_admin',    'Full system access across all churches'),
  ('admin',          'Church-level admin'),
  ('pastoral',       'Pastoral member of a satellite church'),
  ('network_leader', 'Leads a network within a church'),
  ('lpath_leader',   'Leads a life path group'),
  ('member',         'Regular church member');

INSERT INTO ref_membership_type (membership_type, description) VALUES
  ('regular',   'Regular attending member'),
  ('associate', 'Associate member'),
  ('visitor',   'First-time or occasional visitor');
$$
