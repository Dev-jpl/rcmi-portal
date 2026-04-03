-- =======================================================================================
-- 006_bible_study_guest_details.sql
-- Description: Adds email and contact columns for Bible Study guests.
-- =======================================================================================

ALTER TABLE tbl_bible_study_attendance
ADD COLUMN guest_email VARCHAR(255),
ADD COLUMN guest_contact VARCHAR(50);
