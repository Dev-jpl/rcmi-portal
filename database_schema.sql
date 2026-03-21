CREATE TABLE "ref_roles" (
  "varchar" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>
);

CREATE INDEX "id" ON  "ref_roles" ("varchar");

CREATE INDEX "role_type" ON  "ref_roles" ("char");

CREATE INDEX "description" ON  "ref_roles" ("char");

CREATE INDEX "isActive" ON  "ref_roles" ("char");

CREATE TABLE "tbl_users" (
  "varchar" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "int" <type>,
  "enum" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_users_int"
    FOREIGN KEY ("int")
      REFERENCES "ref_roles"("varchar")
);

CREATE INDEX "id" ON  "tbl_users" ("varchar");

CREATE INDEX "email" ON  "tbl_users" ("char");

CREATE INDEX "first_name" ON  "tbl_users" ("char");

CREATE INDEX "middle_name" ON  "tbl_users" ("char");

CREATE INDEX "last_name" ON  "tbl_users" ("char");

CREATE INDEX "ext_name" ON  "tbl_users" ("char");

CREATE INDEX "role_id" ON  "tbl_users" ("int");

CREATE INDEX "role_type" ON  "tbl_users" ("enum");

CREATE INDEX "isActive" ON  "tbl_users" ("char");

CREATE TABLE "tbl_pastoral_members" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_pastoral_members_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "tbl_users"("varchar")
);

CREATE INDEX "id" ON  "tbl_pastoral_members" ("bigint");

CREATE INDEX "user_id" ON  "tbl_pastoral_members" ("varchar");

CREATE INDEX "user" ON  "tbl_pastoral_members" ("char");

CREATE INDEX "date_started" ON  "tbl_pastoral_members" ("date");

CREATE INDEX "isActive" ON  "tbl_pastoral_members" ("char");

CREATE TABLE "tbl_network_leaders" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_network_leaders_int"
    FOREIGN KEY ("int")
      REFERENCES "tbl_pastoral_members"("varchar")
);

CREATE INDEX "id" ON  "tbl_network_leaders" ("bigint");

CREATE INDEX "user_id" ON  "tbl_network_leaders" ("varchar");

CREATE INDEX "user" ON  "tbl_network_leaders" ("char");

CREATE INDEX "pastor_id" ON  "tbl_network_leaders" ("int");

CREATE INDEX "pastor_name" ON  "tbl_network_leaders" ("char");

CREATE INDEX "date_started" ON  "tbl_network_leaders" ("date");

CREATE INDEX "isActive" ON  "tbl_network_leaders" ("char");

CREATE TABLE "tbl_lpath_leaders" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>
);

CREATE INDEX "id" ON  "tbl_lpath_leaders" ("bigint");

CREATE INDEX "user_id" ON  "tbl_lpath_leaders" ("varchar");

CREATE INDEX "user" ON  "tbl_lpath_leaders" ("char");

CREATE INDEX "network_id" ON  "tbl_lpath_leaders" ("int");

CREATE INDEX "network_name" ON  "tbl_lpath_leaders" ("char");

CREATE INDEX "date_started" ON  "tbl_lpath_leaders" ("date");

CREATE INDEX "isActive" ON  "tbl_lpath_leaders" ("char");

CREATE TABLE "lib_satellite_churches" (
  "int" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "boolean" <type>
);

CREATE INDEX "id" ON  "lib_satellite_churches" ("int");

CREATE INDEX "church_name" ON  "lib_satellite_churches" ("char");

CREATE INDEX "country_name" ON  "lib_satellite_churches" ("char");

CREATE INDEX "country_code" ON  "lib_satellite_churches" ("char");

CREATE INDEX "region_name" ON  "lib_satellite_churches" ("char");

CREATE INDEX "region_code" ON  "lib_satellite_churches" ("char");

CREATE INDEX "province_name" ON  "lib_satellite_churches" ("char");

CREATE INDEX "province_code" ON  "lib_satellite_churches" ("char");

CREATE INDEX "municipality_name" ON  "lib_satellite_churches" ("char");

CREATE INDEX "municipality_code" ON  "lib_satellite_churches" ("char");

CREATE INDEX "barangay_name" ON  "lib_satellite_churches" ("char");

CREATE INDEX "barangay_code" ON  "lib_satellite_churches" ("char");

CREATE INDEX "longitude" ON  "lib_satellite_churches" ("char");

CREATE INDEX "latitude" ON  "lib_satellite_churches" ("char");

CREATE INDEX "isActive" ON  "lib_satellite_churches" ("boolean");

CREATE TABLE "tbl_members_profile" (
  "uuid" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_members_profile_int"
    FOREIGN KEY ("int")
      REFERENCES "lib_satellite_churches"("int")
);

CREATE INDEX "user_id" ON  "tbl_members_profile" ("uuid");

CREATE INDEX "email" ON  "tbl_members_profile" ("char");

CREATE INDEX "first_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "middle_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "last_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "ext_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "birth_date" ON  "tbl_members_profile" ("date");

CREATE INDEX "country_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "country_code" ON  "tbl_members_profile" ("char");

CREATE INDEX "region_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "region_code" ON  "tbl_members_profile" ("char");

CREATE INDEX "province_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "province_code" ON  "tbl_members_profile" ("char");

CREATE INDEX "municipality_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "municipality_code" ON  "tbl_members_profile" ("char");

CREATE INDEX "barangay_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "barangay_code" ON  "tbl_members_profile" ("char");

CREATE INDEX "satellite_church_id" ON  "tbl_members_profile" ("int");

CREATE INDEX "satellite_church_name" ON  "tbl_members_profile" ("char");

CREATE INDEX "network_id" ON  "tbl_members_profile" ("int");

CREATE INDEX "network_name" ON  "tbl_members_profile" ("char");

CREATE TABLE "tbl_bod_members" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_bod_members_bigint"
    FOREIGN KEY ("bigint")
      REFERENCES "tbl_users"("varchar")
);

CREATE INDEX "id" ON  "tbl_bod_members" ("bigint");

CREATE INDEX "user_id" ON  "tbl_bod_members" ("varchar");

CREATE INDEX "user" ON  "tbl_bod_members" ("char");

CREATE INDEX "date_started" ON  "tbl_bod_members" ("date");

CREATE INDEX "isActive" ON  "tbl_bod_members" ("char");

CREATE TABLE "lib_programs" (
  "int" <type>,
  "char" <type>,
  "char" <type>,
  "date" <type>,
  "boolean" <type>
);

CREATE INDEX "id" ON  "lib_programs" ("int");

CREATE INDEX "type" ON  "lib_programs" ("char");

CREATE INDEX "description" ON  "lib_programs" ("char");

CREATE INDEX "date_started" ON  "lib_programs" ("date");

CREATE INDEX "isActive" ON  "lib_programs" ("boolean");

CREATE TABLE "tbl_program_involvements" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "date" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_program_involvements_int"
    FOREIGN KEY ("int")
      REFERENCES "lib_programs"("int"),
  CONSTRAINT "FK_tbl_program_involvements_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "tbl_users"("varchar")
);

CREATE INDEX "id" ON  "tbl_program_involvements" ("bigint");

CREATE INDEX "user_id" ON  "tbl_program_involvements" ("varchar");

CREATE INDEX "user" ON  "tbl_program_involvements" ("char");

CREATE INDEX "program_id" ON  "tbl_program_involvements" ("int");

CREATE INDEX "program_type" ON  "tbl_program_involvements" ("char");

CREATE INDEX "date_started" ON  "tbl_program_involvements" ("date");

CREATE INDEX "date_ended" ON  "tbl_program_involvements" ("date");

CREATE INDEX "isActive" ON  "tbl_program_involvements" ("char");

CREATE TABLE "tbl_lpath_members" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "varchar" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_lpath_members_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "tbl_lpath_leaders"("varchar"),
  CONSTRAINT "FK_tbl_lpath_members_int"
    FOREIGN KEY ("int")
      REFERENCES "tbl_network_leaders"("varchar")
);

CREATE INDEX "id" ON  "tbl_lpath_members" ("bigint");

CREATE INDEX "user_id" ON  "tbl_lpath_members" ("varchar");

CREATE INDEX "user" ON  "tbl_lpath_members" ("char");

CREATE INDEX "lpath_leader" ON  "tbl_lpath_members" ("varchar");

CREATE INDEX "lapth_leader_name" ON  "tbl_lpath_members" ("char");

CREATE INDEX "network_leader_id" ON  "tbl_lpath_members" ("int");

CREATE INDEX "network_leader_name" ON  "tbl_lpath_members" ("char");

CREATE INDEX "date_started" ON  "tbl_lpath_members" ("date");

CREATE INDEX "isActive" ON  "tbl_lpath_members" ("char");

CREATE TABLE "lib_ministries" (
  "int" <type>,
  "char" <type>,
  "varchar" <type>,
  "boolean" <type>
);

CREATE INDEX "id" ON  "lib_ministries" ("int");

CREATE INDEX "ministry_type" ON  "lib_ministries" ("char");

CREATE INDEX "description" ON  "lib_ministries" ("varchar");

CREATE INDEX "isActive" ON  "lib_ministries" ("boolean");

CREATE TABLE "tbl_ministry_involvements" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_ministry_involvements_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "tbl_users"("varchar"),
  CONSTRAINT "FK_tbl_ministry_involvements_int"
    FOREIGN KEY ("int")
      REFERENCES "lib_ministries"("int")
);

CREATE INDEX "id" ON  "tbl_ministry_involvements" ("bigint");

CREATE INDEX "user_id" ON  "tbl_ministry_involvements" ("varchar");

CREATE INDEX "user" ON  "tbl_ministry_involvements" ("char");

CREATE INDEX "ministry_id" ON  "tbl_ministry_involvements" ("int");

CREATE INDEX "ministry_type" ON  "tbl_ministry_involvements" ("char");

CREATE INDEX "ministry_role_id" ON  "tbl_ministry_involvements" ("int");

CREATE INDEX "ministry_role_title" ON  "tbl_ministry_involvements" ("char");

CREATE INDEX "date_started" ON  "tbl_ministry_involvements" ("date");

CREATE INDEX "isActive" ON  "tbl_ministry_involvements" ("char");

CREATE TABLE "lib_ministry_roles" (
  "int" <type>,
  "int" <type>,
  "char" <type>,
  "char" <type>,
  "varchar" <type>,
  "boolean" <type>,
  CONSTRAINT "FK_lib_ministry_roles_int"
    FOREIGN KEY ("int")
      REFERENCES "lib_ministries"("int")
);

CREATE INDEX "id" ON  "lib_ministry_roles" ("int");

CREATE INDEX "ministry_type_id" ON  "lib_ministry_roles" ("int");

CREATE INDEX "ministry_type" ON  "lib_ministry_roles" ("char");

CREATE INDEX "role_title" ON  "lib_ministry_roles" ("char");

CREATE INDEX "description" ON  "lib_ministry_roles" ("varchar");

CREATE INDEX "isActive" ON  "lib_ministry_roles" ("boolean");

CREATE TABLE "tbl_events" (
  "int" <type>,
  "char" <type>,
  "datetime" <type>,
  "datetime" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "boolean" <type>,
  CONSTRAINT "FK_tbl_events_char"
    FOREIGN KEY ("char")
      REFERENCES "tbl_users"("varchar")
);

CREATE INDEX "id" ON  "tbl_events" ("int");

CREATE INDEX "event_title" ON  "tbl_events" ("char");

CREATE INDEX "duration_from" ON  "tbl_events" ("datetime");

CREATE INDEX "duration_to" ON  "tbl_events" ("datetime");

CREATE INDEX "remarks" ON  "tbl_events" ("char");

CREATE INDEX "created_by" ON  "tbl_events" ("char");

CREATE INDEX "created_by_name" ON  "tbl_events" ("char");

CREATE INDEX "isActive" ON  "tbl_events" ("boolean");

CREATE TABLE "ref_membership_type" (
  "int" <type>,
  "char" <type>,
  "char" <type>,
  "boolean" <type>
);

CREATE INDEX "id" ON  "ref_membership_type" ("int");

CREATE INDEX "membershp_type" ON  "ref_membership_type" ("char");

CREATE INDEX "description" ON  "ref_membership_type" ("char");

CREATE INDEX "isActive" ON  "ref_membership_type" ("boolean");

CREATE TABLE "tbl_attendance_logs" (
  "int" <type>,
  "varchar" <type>,
  "user" <type>,
  "datetime" <type>,
  "vachchar" <type>,
  "char" <type>,
  "varchar" <type>,
  "varchar" <type>,
  "date" <type>,
  "char" <type>,
  "char" <type>,
  "char" <type>,
  "boolean" <type>,
  CONSTRAINT "FK_tbl_attendance_logs_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "tbl_users"("varchar"),
  CONSTRAINT "FK_tbl_attendance_logs_vachchar"
    FOREIGN KEY ("vachchar")
      REFERENCES "tbl_users"("varchar"),
  CONSTRAINT "FK_tbl_attendance_logs_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "lib_satellite_churches"("int"),
  CONSTRAINT "FK_tbl_attendance_logs_char"
    FOREIGN KEY ("char")
      REFERENCES "tbl_events"("int")
);

CREATE INDEX "id" ON  "tbl_attendance_logs" ("int");

CREATE INDEX "user_id" ON  "tbl_attendance_logs" ("varchar");

CREATE INDEX "user" ON  "tbl_attendance_logs" ("user");

CREATE INDEX "logged_at" ON  "tbl_attendance_logs" ("datetime");

CREATE INDEX "logged_by" ON  "tbl_attendance_logs" ("vachchar");

CREATE INDEX "logged_by_name" ON  "tbl_attendance_logs" ("char");

CREATE INDEX "logged_location_id" ON  "tbl_attendance_logs" ("varchar");

CREATE INDEX "logged_location_name" ON  "tbl_attendance_logs" ("varchar");

CREATE INDEX "log_date" ON  "tbl_attendance_logs" ("date");

CREATE INDEX "event_id" ON  "tbl_attendance_logs" ("char");

CREATE INDEX "event_title" ON  "tbl_attendance_logs" ("char");

CREATE INDEX "remarks" ON  "tbl_attendance_logs" ("char");

CREATE INDEX "isActive" ON  "tbl_attendance_logs" ("boolean");

CREATE TABLE "tbl_ministry_heads" (
  "bigint" <type>,
  "varchar" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "int" <type>,
  "char" <type>,
  "date" <type>,
  "char" <type>,
  CONSTRAINT "FK_tbl_ministry_heads_varchar"
    FOREIGN KEY ("varchar")
      REFERENCES "tbl_ministry_involvements"("varchar"),
  CONSTRAINT "FK_tbl_ministry_heads_int"
    FOREIGN KEY ("int")
      REFERENCES "lib_ministries"("int")
);

CREATE INDEX "id" ON  "tbl_ministry_heads" ("bigint");

CREATE INDEX "user_id" ON  "tbl_ministry_heads" ("varchar");

CREATE INDEX "user" ON  "tbl_ministry_heads" ("char");

CREATE INDEX "ministry_id" ON  "tbl_ministry_heads" ("int");

CREATE INDEX "ministry_type" ON  "tbl_ministry_heads" ("char");

CREATE INDEX "ministry_role_id" ON  "tbl_ministry_heads" ("int");

CREATE INDEX "ministry_role_title" ON  "tbl_ministry_heads" ("char");

CREATE INDEX "date_assigned" ON  "tbl_ministry_heads" ("date");

CREATE INDEX "isActive" ON  "tbl_ministry_heads" ("char");



npx supabase gen types typescript --project-id uuxodpunpeuazdvbcpgi > src/types/database.types.ts
