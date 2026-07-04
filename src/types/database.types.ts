export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      lib_ministries: {
        Row: {
          description: string | null
          id: number
          is_active: boolean | null
          ministry_type: string
        }
        Insert: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          ministry_type: string
        }
        Update: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          ministry_type?: string
        }
        Relationships: []
      }
      lib_ministry_roles: {
        Row: {
          description: string | null
          id: number
          is_active: boolean | null
          ministry_type: string | null
          ministry_type_id: number | null
          role_title: string | null
        }
        Insert: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          ministry_type?: string | null
          ministry_type_id?: number | null
          role_title?: string | null
        }
        Update: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          ministry_type?: string | null
          ministry_type_id?: number | null
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lib_ministry_roles_ministry_type_id_fkey"
            columns: ["ministry_type_id"]
            isOneToOne: false
            referencedRelation: "lib_ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      lib_programs: {
        Row: {
          date_started: string | null
          description: string | null
          id: number
          is_active: boolean | null
          type: string
        }
        Insert: {
          date_started?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          type: string
        }
        Update: {
          date_started?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          type?: string
        }
        Relationships: []
      }
      lib_satellite_churches: {
        Row: {
          barangay_code: string | null
          barangay_name: string | null
          church_name: string
          country_code: string | null
          country_name: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          municipality_code: string | null
          municipality_name: string | null
          province_code: string | null
          province_name: string | null
          region_code: string | null
          region_name: string | null
          updated_at: string | null
        }
        Insert: {
          barangay_code?: string | null
          barangay_name?: string | null
          church_name: string
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          municipality_code?: string | null
          municipality_name?: string | null
          province_code?: string | null
          province_name?: string | null
          region_code?: string | null
          region_name?: string | null
          updated_at?: string | null
        }
        Update: {
          barangay_code?: string | null
          barangay_name?: string | null
          church_name?: string
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          municipality_code?: string | null
          municipality_name?: string | null
          province_code?: string | null
          province_name?: string | null
          region_code?: string | null
          region_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ref_membership_type: {
        Row: {
          description: string | null
          id: number
          is_active: boolean | null
          membership_type: string
        }
        Insert: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          membership_type: string
        }
        Update: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          membership_type?: string
        }
        Relationships: []
      }
      ref_roles: {
        Row: {
          description: string | null
          id: number
          is_active: boolean | null
          role_type: string
        }
        Insert: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          role_type: string
        }
        Update: {
          description?: string | null
          id?: number
          is_active?: boolean | null
          role_type?: string
        }
        Relationships: []
      }
      tbl_attendance_logs: {
        Row: {
          created_at: string | null
          event_id: string | null
          event_title: string | null
          id: string
          input_method: string
          is_active: boolean | null
          log_date: string | null
          logged_at: string | null
          logged_by: string | null
          logged_by_name: string | null
          logged_location_id: number | null
          logged_location_name: string | null
          remarks: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          event_title?: string | null
          id?: string
          input_method?: string
          is_active?: boolean | null
          log_date?: string | null
          logged_at?: string | null
          logged_by?: string | null
          logged_by_name?: string | null
          logged_location_id?: number | null
          logged_location_name?: string | null
          remarks?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          event_title?: string | null
          id?: string
          input_method?: string
          is_active?: boolean | null
          log_date?: string | null
          logged_at?: string | null
          logged_by?: string | null
          logged_by_name?: string | null
          logged_location_id?: number | null
          logged_location_name?: string | null
          remarks?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_attendance_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tbl_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_logged_location_id_fkey"
            columns: ["logged_location_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_logged_location_id_fkey"
            columns: ["logged_location_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_logged_location_id_fkey"
            columns: ["logged_location_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_bod_members: {
        Row: {
          created_at: string | null
          date_started: string | null
          id: number
          is_active: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_bod_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_bod_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_events: {
        Row: {
          allow_self_checkin: boolean | null
          checkin_start_at: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          default_event_id: number | null
          duration_from: string | null
          duration_to: string | null
          event_title: string
          event_type: string | null
          id: string
          is_active: boolean | null
          remarks: string | null
          satellite_church_id: number | null
          updated_at: string | null
        }
        Insert: {
          allow_self_checkin?: boolean | null
          checkin_start_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          default_event_id?: number | null
          duration_from?: string | null
          duration_to?: string | null
          event_title: string
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          remarks?: string | null
          satellite_church_id?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_self_checkin?: boolean | null
          checkin_start_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          default_event_id?: number | null
          duration_from?: string | null
          duration_to?: string | null
          event_title?: string
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          remarks?: string | null
          satellite_church_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tbl_events_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_events_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_events_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
        ]
      }
      tbl_lpath_leaders: {
        Row: {
          church_id: number | null
          created_at: string | null
          date_started: string | null
          id: string
          is_active: string | null
          network_id: number | null
          network_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: string
          is_active?: string | null
          network_id?: number | null
          network_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: string
          is_active?: string | null
          network_id?: number | null
          network_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_lpath_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_lpath_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_lpath_leaders_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "tbl_network_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_leaders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_leaders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_lpath_members: {
        Row: {
          church_id: number | null
          created_at: string | null
          date_started: string | null
          id: number
          is_active: string | null
          lpath_leader_id: string | null
          lpath_leader_name: string | null
          network_leader_id: number | null
          network_leader_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          lpath_leader_id?: string | null
          lpath_leader_name?: string | null
          network_leader_id?: number | null
          network_leader_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          lpath_leader_id?: string | null
          lpath_leader_name?: string | null
          network_leader_id?: number | null
          network_leader_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_lpath_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_lpath_leader_id_fkey"
            columns: ["lpath_leader_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_lpath_leader_id_fkey"
            columns: ["lpath_leader_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_network_leader_id_fkey"
            columns: ["network_leader_id"]
            isOneToOne: false
            referencedRelation: "tbl_network_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_lpath_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_members_profile: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          barangay_code: string | null
          barangay_name: string | null
          birth_date: string | null
          country_code: string | null
          country_name: string | null
          created_at: string | null
          email: string | null
          ext_name: string | null
          first_name: string | null
          id: number
          last_name: string | null
          membership_type_id: number | null
          middle_name: string | null
          municipality_code: string | null
          municipality_name: string | null
          network_id: number | null
          network_name: string | null
          profile_photo_url: string | null
          province_code: string | null
          province_name: string | null
          qr_token: string | null
          region_code: string | null
          region_name: string | null
          rejected_reason: string | null
          satellite_church_id: number | null
          satellite_church_name: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          barangay_code?: string | null
          barangay_name?: string | null
          birth_date?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          email?: string | null
          ext_name?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          membership_type_id?: number | null
          middle_name?: string | null
          municipality_code?: string | null
          municipality_name?: string | null
          network_id?: number | null
          network_name?: string | null
          profile_photo_url?: string | null
          province_code?: string | null
          province_name?: string | null
          qr_token?: string | null
          region_code?: string | null
          region_name?: string | null
          rejected_reason?: string | null
          satellite_church_id?: number | null
          satellite_church_name?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          barangay_code?: string | null
          barangay_name?: string | null
          birth_date?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          email?: string | null
          ext_name?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          membership_type_id?: number | null
          middle_name?: string | null
          municipality_code?: string | null
          municipality_name?: string | null
          network_id?: number | null
          network_name?: string | null
          profile_photo_url?: string | null
          province_code?: string | null
          province_name?: string | null
          qr_token?: string | null
          region_code?: string | null
          region_name?: string | null
          rejected_reason?: string | null
          satellite_church_id?: number | null
          satellite_church_name?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_members_profile_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_members_profile_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tbl_members_profile_membership_type_id_fkey"
            columns: ["membership_type_id"]
            isOneToOne: false
            referencedRelation: "ref_membership_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_members_profile_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_members_profile_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_members_profile_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_members_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_members_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_ministry_heads: {
        Row: {
          created_at: string | null
          date_assigned: string | null
          id: number
          is_active: string | null
          ministry_id: number | null
          ministry_role_id: number | null
          ministry_role_title: string | null
          ministry_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_assigned?: string | null
          id?: number
          is_active?: string | null
          ministry_id?: number | null
          ministry_role_id?: number | null
          ministry_role_title?: string | null
          ministry_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_assigned?: string | null
          id?: number
          is_active?: string | null
          ministry_id?: number | null
          ministry_role_id?: number | null
          ministry_role_title?: string | null
          ministry_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_ministry_heads_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "lib_ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_ministry_heads_ministry_role_id_fkey"
            columns: ["ministry_role_id"]
            isOneToOne: false
            referencedRelation: "lib_ministry_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_ministry_heads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_ministry_heads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_ministry_involvements: {
        Row: {
          created_at: string | null
          date_started: string | null
          id: number
          is_active: string | null
          ministry_id: number | null
          ministry_role_id: number | null
          ministry_role_title: string | null
          ministry_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          ministry_id?: number | null
          ministry_role_id?: number | null
          ministry_role_title?: string | null
          ministry_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          ministry_id?: number | null
          ministry_role_id?: number | null
          ministry_role_title?: string | null
          ministry_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_ministry_involvements_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "lib_ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_ministry_involvements_ministry_role_id_fkey"
            columns: ["ministry_role_id"]
            isOneToOne: false
            referencedRelation: "lib_ministry_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_ministry_involvements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_ministry_involvements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_network_leaders: {
        Row: {
          church_id: number | null
          created_at: string | null
          date_started: string | null
          id: number
          is_active: string | null
          pastor_id: string | null
          pastor_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          pastor_id?: string | null
          pastor_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          pastor_id?: string | null
          pastor_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_network_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_network_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_network_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_network_leaders_pastor_id_fkey"
            columns: ["pastor_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_network_leaders_pastor_id_fkey"
            columns: ["pastor_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tbl_network_leaders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_network_leaders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_pastoral_members: {
        Row: {
          church_id: number | null
          created_at: string | null
          date_started: string | null
          id: number
          is_active: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          church_id?: number | null
          created_at?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_pastoral_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_pastoral_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_pastoral_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "tbl_pastoral_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_pastoral_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_program_involvements: {
        Row: {
          created_at: string | null
          date_ended: string | null
          date_started: string | null
          id: number
          is_active: string | null
          program_id: number | null
          program_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_ended?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          program_id?: number | null
          program_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_ended?: string | null
          date_started?: string | null
          id?: number
          is_active?: string | null
          program_id?: number | null
          program_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_program_involvements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "lib_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_program_involvements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_program_involvements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_users: {
        Row: {
          created_at: string | null
          email: string
          ext_name: string | null
          first_name: string | null
          id: string
          is_active: string | null
          last_name: string | null
          middle_name: string | null
          role_id: number | null
          role_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          ext_name?: string | null
          first_name?: string | null
          id: string
          is_active?: string | null
          last_name?: string | null
          middle_name?: string | null
          role_id?: number | null
          role_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          ext_name?: string | null
          first_name?: string | null
          id?: string
          is_active?: string | null
          last_name?: string | null
          middle_name?: string | null
          role_id?: number | null
          role_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ref_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_newcomer_access_codes: {
        Row: {
          church_id: number
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          valid_from: string
          valid_until: string
        }
        Insert: {
          church_id: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          valid_from: string
          valid_until: string
        }
        Update: {
          church_id?: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_newcomer_access_codes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_newcomer_access_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_newcomers: {
        Row: {
          access_code_id: string | null
          church_id: number
          contact_no: string
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string
          id: string
          is_deleted: boolean
          last_name: string
          notes: string | null
          source: string
          status: string
          submitted_at: string
          submitter_ip: string | null
        }
        Insert: {
          access_code_id?: string | null
          church_id: number
          contact_no: string
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name: string
          id?: string
          is_deleted?: boolean
          last_name: string
          notes?: string | null
          source?: string
          status?: string
          submitted_at?: string
          submitter_ip?: string | null
        }
        Update: {
          access_code_id?: string | null
          church_id?: number
          contact_no?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string
          id?: string
          is_deleted?: boolean
          last_name?: string
          notes?: string | null
          source?: string
          status?: string
          submitted_at?: string
          submitter_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_newcomers_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "tbl_newcomer_access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_newcomers_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_attendance_summary: {
        Row: {
          church_id: number | null
          church_name: string | null
          duration_from: string | null
          event_id: number | null
          event_title: string | null
          event_type: string | null
          total_attendees: number | null
          via_manual: number | null
          via_qr: number | null
          via_self: number | null
        }
        Relationships: []
      }
      v_member_attendance: {
        Row: {
          church_name: string | null
          event_title: string | null
          event_type: string | null
          input_method: string | null
          log_date: string | null
          logged_at: string | null
          member_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_members_list"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tbl_bible_studies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          satellite_church_id: number | null
          schedules: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          satellite_church_id?: number | null
          schedules?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          satellite_church_id?: number | null
          schedules?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_bible_studies_satellite_church_id_fkey"
            columns: ["satellite_church_id"]
            isOneToOne: false
            referencedRelation: "lib_satellite_churches"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_bible_study_handlers: {
        Row: {
          bible_study_id: string
          user_id: string
        }
        Insert: {
          bible_study_id: string
          user_id: string
        }
        Update: {
          bible_study_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_bible_study_handlers_bible_study_id_fkey"
            columns: ["bible_study_id"]
            isOneToOne: false
            referencedRelation: "tbl_bible_studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_bible_study_handlers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_bible_study_sessions: {
        Row: {
          bible_study_id: string
          created_at: string
          id: string
          notes: string | null
          session_date: string
        }
        Insert: {
          bible_study_id: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
        }
        Update: {
          bible_study_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_bible_study_sessions_bible_study_id_fkey"
            columns: ["bible_study_id"]
            isOneToOne: false
            referencedRelation: "tbl_bible_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_bible_study_attendance: {
        Row: {
          guest_contact: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          logged_at: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          guest_contact?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          logged_at?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          guest_contact?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          logged_at?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_bible_study_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tbl_bible_study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_bible_study_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lib_default_events: {
        Row: {
          allow_self_checkin: boolean
          day_of_week: string
          default_end_time: string
          default_start_time: string
          event_title: string
          event_type: string
          id: string
          is_active: boolean
        }
        Insert: {
          allow_self_checkin?: boolean
          day_of_week: string
          default_end_time: string
          default_start_time: string
          event_title: string
          event_type: string
          id?: string
          is_active?: boolean
        }
        Update: {
          allow_self_checkin?: boolean
          day_of_week?: string
          default_end_time?: string
          default_start_time?: string
          event_title?: string
          event_type?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      tbl_devotionals: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_devotionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_comments: {
        Row: {
          content: string
          created_at: string
          devotional_id: string
          id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          devotional_id: string
          id?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          devotional_id?: string
          id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_comments_devotional_id_fkey"
            columns: ["devotional_id"]
            isOneToOne: false
            referencedRelation: "tbl_devotionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tbl_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_devotional_reactions: {
        Row: {
          created_at: string
          devotional_id: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          devotional_id: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          devotional_id?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_devotional_reactions_devotional_id_fkey"
            columns: ["devotional_id"]
            isOneToOne: false
            referencedRelation: "tbl_devotionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_devotional_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tbl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_members_list: {
        Row: {
          approved_at: string | null
          birth_date: string | null
          church_id: number | null
          church_name: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          middle_name: string | null
          profile_photo_url: string | null
          qr_token: string | null
          registered_at: string | null
          role_type: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_welcome_form: {
        Args: { p_code: string }
        Returns: Json
      }
      submit_newcomer: {
        Args: {
          p_code: string
          p_first_name: string
          p_last_name: string
          p_email: string
          p_contact_no: string
          p_honeypot?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
