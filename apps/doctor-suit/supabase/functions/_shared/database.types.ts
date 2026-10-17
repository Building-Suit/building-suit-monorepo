export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_profiles: {
        Row: {
          contact_phone: string
          in_app_confirmations: boolean
          personal_name: string
          user_id: string
          version: number
        }
        Insert: {
          contact_phone?: string
          in_app_confirmations?: boolean
          personal_name?: string
          user_id: string
          version?: number
        }
        Update: {
          contact_phone?: string
          in_app_confirmations?: boolean
          personal_name?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      appointment_events: {
        Row: {
          actor_user_id: string
          appointment_id: string
          details: Json
          event_type: string
          happened_at: string
          id: number
          location_id: string
          practice_id: string
          record_version: number
        }
        Insert: {
          actor_user_id: string
          appointment_id: string
          details?: Json
          event_type: string
          happened_at?: string
          id?: never
          location_id: string
          practice_id: string
          record_version: number
        }
        Update: {
          actor_user_id?: string
          appointment_id?: string
          details?: Json
          event_type?: string
          happened_at?: string
          id?: never
          location_id?: string
          practice_id?: string
          record_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_practice_id_appointment_id_fkey"
            columns: ["practice_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "appointment_events_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      appointment_queue_revisions: {
        Row: {
          location_id: string
          practice_id: string
          revision: number
        }
        Insert: {
          location_id: string
          practice_id: string
          revision?: number
        }
        Update: {
          location_id?: string
          practice_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_queue_revisions_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      appointments: {
        Row: {
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          doctor_user_id: string
          ends_at: string
          id: string
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          started_at: string | null
          starts_at: string
          state: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          doctor_user_id: string
          ends_at: string
          id?: string
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          started_at?: string | null
          starts_at: string
          state?: string
          timezone: string
          updated_at?: string
          version?: number
        }
        Update: {
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          doctor_user_id?: string
          ends_at?: string
          id?: string
          location_id?: string
          location_name?: string
          patient_id?: string
          practice_id?: string
          started_at?: string | null
          starts_at?: string
          state?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_practice_id_doctor_user_id_fkey"
            columns: ["practice_id", "doctor_user_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id", "owner_user_id"]
          },
          {
            foreignKeyName: "appointments_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "appointments_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_user_id: string
          details: Json
          entity_id: string
          event_type: string
          happened_at: string
          id: number
          practice_id: string
        }
        Insert: {
          actor_user_id: string
          details?: Json
          entity_id: string
          event_type: string
          happened_at?: string
          id?: never
          practice_id: string
        }
        Update: {
          actor_user_id?: string
          details?: Json
          entity_id?: string
          event_type?: string
          happened_at?: string
          id?: never
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_candidate_admissions: {
        Row: {
          database_actor: string
          evidence_ref: string
          id: string
          issued_at: string
          purpose: string
          user_id: string
          valid_until: string
        }
        Insert: {
          database_actor?: string
          evidence_ref: string
          id?: string
          issued_at?: string
          purpose: string
          user_id: string
          valid_until: string
        }
        Update: {
          database_actor?: string
          evidence_ref?: string
          id?: string
          issued_at?: string
          purpose?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      doctor_candidate_revocations: {
        Row: {
          admission_id: string
          database_actor: string
          reason: string
          revoked_at: string
        }
        Insert: {
          admission_id: string
          database_actor?: string
          reason: string
          revoked_at?: string
        }
        Update: {
          admission_id?: string
          database_actor?: string
          reason?: string
          revoked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_candidate_revocations_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: true
            referencedRelation: "doctor_candidate_admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_edition_policy: {
        Row: {
          change_reason: string
          changed_at: string
          mode: string
          revision: number
          singleton: boolean
        }
        Insert: {
          change_reason: string
          changed_at?: string
          mode: string
          revision: number
          singleton?: boolean
        }
        Update: {
          change_reason?: string
          changed_at?: string
          mode?: string
          revision?: number
          singleton?: boolean
        }
        Relationships: []
      }
      doctor_edition_policy_events: {
        Row: {
          change_reason: string
          database_actor: string
          happened_at: string
          next_mode: string
          previous_mode: string | null
          revision: number
        }
        Insert: {
          change_reason: string
          database_actor: string
          happened_at?: string
          next_mode: string
          previous_mode?: string | null
          revision: number
        }
        Update: {
          change_reason?: string
          database_actor?: string
          happened_at?: string
          next_mode?: string
          previous_mode?: string | null
          revision?: number
        }
        Relationships: []
      }
      doctor_profiles: {
        Row: {
          created_at: string
          display_name: string
          professional_verification: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          professional_verification?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          professional_verification?: string
          user_id?: string
        }
        Relationships: []
      }
      location_schedules: {
        Row: {
          exceptions: Json
          location_id: string
          practice_id: string
          slot_minutes: number
          updated_at: string
          updated_by: string
          version: number
          weekly: Json
        }
        Insert: {
          exceptions: Json
          location_id: string
          practice_id: string
          slot_minutes: number
          updated_at?: string
          updated_by: string
          version?: number
          weekly: Json
        }
        Update: {
          exceptions?: Json
          location_id?: string
          practice_id?: string
          slot_minutes?: number
          updated_at?: string
          updated_by?: string
          version?: number
          weekly?: Json
        }
        Relationships: [
          {
            foreignKeyName: "location_schedules_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      locations: {
        Row: {
          archived_at: string | null
          contact_address: string
          contact_phone: string
          created_at: string
          id: string
          name: string
          practice_id: string
          timezone: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          contact_address?: string
          contact_phone?: string
          created_at?: string
          id?: string
          name: string
          practice_id: string
          timezone: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          contact_address?: string
          contact_phone?: string
          created_at?: string
          id?: string
          name?: string
          practice_id?: string
          timezone?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "locations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_locations: {
        Row: {
          capabilities: string[] | null
          location_id: string
          membership_id: string
          practice_id: string
        }
        Insert: {
          capabilities?: string[] | null
          location_id: string
          membership_id: string
          practice_id: string
        }
        Update: {
          capabilities?: string[] | null
          location_id?: string
          membership_id?: string
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_locations_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "membership_locations_practice_id_membership_id_fkey"
            columns: ["practice_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          capabilities: string[]
          created_at: string
          id: string
          practice_id: string
          status: string
          user_id: string
          version: number
        }
        Insert: {
          capabilities?: string[]
          created_at?: string
          id?: string
          practice_id: string
          status?: string
          user_id: string
          version?: number
        }
        Update: {
          capabilities?: string[]
          created_at?: string
          id?: string
          practice_id?: string
          status?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_drafts: {
        Row: {
          command_key: string
          display_name: string
          location_name: string
          practice_name: string
          timezone: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          command_key: string
          display_name?: string
          location_name?: string
          practice_name?: string
          timezone?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          command_key?: string
          display_name?: string
          location_name?: string
          practice_name?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      patient_administrative_activity: {
        Row: {
          actor_user_id: string
          event_type: string
          happened_at: string
          id: number
          location_id: string
          patient_id: string
          practice_id: string
          record_version: number
        }
        Insert: {
          actor_user_id: string
          event_type: string
          happened_at?: string
          id?: never
          location_id: string
          patient_id: string
          practice_id: string
          record_version: number
        }
        Update: {
          actor_user_id?: string
          event_type?: string
          happened_at?: string
          id?: never
          location_id?: string
          patient_id?: string
          practice_id?: string
          record_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_administrative_activity_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_administrative_activity_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      patient_document_events: {
        Row: {
          actor_user_id: string
          document_id: string
          event_type: string
          happened_at: string
          id: number
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          timezone: string
          version_id: string
        }
        Insert: {
          actor_user_id: string
          document_id: string
          event_type: string
          happened_at?: string
          id?: never
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          timezone: string
          version_id: string
        }
        Update: {
          actor_user_id?: string
          document_id?: string
          event_type?: string
          happened_at?: string
          id?: never
          location_id?: string
          location_name?: string
          patient_id?: string
          practice_id?: string
          timezone?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_document_events_practice_id_document_id_version_id_fkey"
            columns: ["practice_id", "document_id", "version_id"]
            isOneToOne: false
            referencedRelation: "patient_document_versions"
            referencedColumns: ["practice_id", "document_id", "id"]
          },
          {
            foreignKeyName: "patient_document_events_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_document_events_practice_id_patient_id_document_id_fkey"
            columns: ["practice_id", "patient_id", "document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["practice_id", "patient_id", "id"]
          },
        ]
      }
      patient_document_versions: {
        Row: {
          byte_size: number
          document_id: string
          filename: string
          id: string
          location_id: string
          location_name: string
          mime_type: string
          object_path: string
          patient_id: string
          practice_id: string
          provenance: string
          revision: number
          sha256: string
          timezone: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          byte_size: number
          document_id: string
          filename: string
          id: string
          location_id: string
          location_name: string
          mime_type: string
          object_path: string
          patient_id: string
          practice_id: string
          provenance?: string
          revision: number
          sha256: string
          timezone: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          byte_size?: number
          document_id?: string
          filename?: string
          id?: string
          location_id?: string
          location_name?: string
          mime_type?: string
          object_path?: string
          patient_id?: string
          practice_id?: string
          provenance?: string
          revision?: number
          sha256?: string
          timezone?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_document_versions_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_document_versions_practice_id_patient_id_document__fkey"
            columns: ["practice_id", "patient_id", "document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["practice_id", "patient_id", "id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          created_location_id: string
          current_version_id: string
          id: string
          patient_id: string
          practice_id: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          created_location_id: string
          current_version_id: string
          id: string
          patient_id: string
          practice_id: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          created_location_id?: string
          current_version_id?: string
          id?: string
          patient_id?: string
          practice_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_document_current_version"
            columns: ["practice_id", "id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "patient_document_versions"
            referencedColumns: ["practice_id", "document_id", "id"]
          },
          {
            foreignKeyName: "patient_documents_practice_id_created_location_id_fkey"
            columns: ["practice_id", "created_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      patient_identities: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      practice_patients: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          created_location_id: string
          display_name: string
          id: string
          patient_identity_id: string
          practice_id: string
          recorded_date_of_birth: string | null
          recorded_email: string
          recorded_phone: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          created_location_id: string
          display_name: string
          id?: string
          patient_identity_id: string
          practice_id: string
          recorded_date_of_birth?: string | null
          recorded_email?: string
          recorded_phone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          created_location_id?: string
          display_name?: string
          id?: string
          patient_identity_id?: string
          practice_id?: string
          recorded_date_of_birth?: string | null
          recorded_email?: string
          recorded_phone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_patients_patient_identity_id_fkey"
            columns: ["patient_identity_id"]
            isOneToOne: true
            referencedRelation: "patient_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_patients_practice_id_created_location_id_fkey"
            columns: ["practice_id", "created_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "practice_patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "practices_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: true
            referencedRelation: "doctor_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      secretary_invitations: {
        Row: {
          accepted_membership_id: string | null
          accepted_user_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          grants: Json
          id: string
          practice_id: string
          recipient_email: string
          status: string
          token_hash: string
          version: number
        }
        Insert: {
          accepted_membership_id?: string | null
          accepted_user_id?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          grants: Json
          id?: string
          practice_id: string
          recipient_email: string
          status?: string
          token_hash: string
          version?: number
        }
        Update: {
          accepted_membership_id?: string | null
          accepted_user_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          grants?: Json
          id?: string
          practice_id?: string
          recipient_email?: string
          status?: string
          token_hash?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "secretary_invitations_accepted_membership_id_fkey"
            columns: ["accepted_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretary_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      doctor_accept_secretary_invitation: {
        Args: { p_invitation: string; p_key: string; p_token: string }
        Returns: Json
      }
      doctor_account_settings: { Args: never; Returns: Json }
      doctor_administrative_audit: {
        Args: {
          p_location?: string
          p_page?: number
          p_practice: string
          p_query?: string
        }
        Returns: Json
      }
      doctor_administrative_capabilities: { Args: never; Returns: string[] }
      doctor_administrative_edition: { Args: never; Returns: Json }
      doctor_appointment_board: {
        Args: {
          p_day: string
          p_location: string
          p_page?: number
          p_practice: string
          p_queue_page?: number
        }
        Returns: Json
      }
      doctor_appointment_history: {
        Args: {
          p_appointment: string
          p_location: string
          p_page?: number
          p_practice: string
        }
        Returns: Json
      }
      doctor_archive_document: {
        Args: {
          p_document: string
          p_expected_version: number
          p_key: string
          p_location: string
          p_patient: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_archive_location: {
        Args: {
          p_expected_version: number
          p_key: string
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_archive_patient: {
        Args: {
          p_expected_version: number
          p_key: string
          p_location: string
          p_patient: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_availability: {
        Args: { p_day: string; p_location: string; p_practice: string }
        Returns: Json
      }
      doctor_book_appointment: {
        Args: {
          p_day: string
          p_key: string
          p_location: string
          p_location_version: number
          p_minute: number
          p_patient: string
          p_practice: string
          p_schedule_version: number
        }
        Returns: Json
      }
      doctor_cancel_secretary_invitation: {
        Args: {
          p_invitation: string
          p_key: string
          p_practice: string
          p_version: number
        }
        Returns: Json
      }
      doctor_complete_onboarding: {
        Args: { p_draft_version: number; p_key: string }
        Returns: Json
      }
      doctor_contexts: { Args: never; Returns: Json }
      doctor_document_delivery: {
        Args: {
          p_actor: string
          p_document: string
          p_key?: string
          p_location: string
          p_patient: string
          p_practice: string
          p_session: string
          p_version?: string
        }
        Returns: Json
      }
      doctor_document_history: {
        Args: {
          p_document: string
          p_location: string
          p_page?: number
          p_patient: string
          p_practice: string
          p_size?: number
        }
        Returns: Json
      }
      doctor_finalize_document: {
        Args: { p_actor: string; p_intent: string; p_session: string }
        Returns: Json
      }
      doctor_invitation_details: {
        Args: { p_invitation: string; p_token: string }
        Returns: Json
      }
      doctor_invite_secretary: {
        Args: {
          p_email: string
          p_grants: Json
          p_key: string
          p_practice: string
          p_token_hash: string
        }
        Returns: Json
      }
      doctor_location_archive_status: {
        Args: { p_location: string; p_practice: string }
        Returns: Json
      }
      doctor_locations: {
        Args: {
          p_page?: number
          p_practice: string
          p_search?: string
          p_size?: number
        }
        Returns: Json
      }
      doctor_onboard: {
        Args: {
          p_key: string
          p_location_name: string
          p_name: string
          p_timezone: string
        }
        Returns: Json
      }
      doctor_patient: {
        Args: { p_location: string; p_patient: string; p_practice: string }
        Returns: Json
      }
      doctor_patient_documents: {
        Args: {
          p_location: string
          p_page?: number
          p_patient: string
          p_practice: string
          p_size?: number
        }
        Returns: Json
      }
      doctor_patient_duplicate_review: {
        Args: {
          p_input: Json
          p_location: string
          p_patient?: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_patient_profile: {
        Args: { p_location: string; p_patient: string; p_practice: string }
        Returns: Json
      }
      doctor_patients: {
        Args: {
          p_location: string
          p_page?: number
          p_practice: string
          p_search?: string
          p_size?: number
          p_status?: string
        }
        Returns: Json
      }
      doctor_personal_account_audit: {
        Args: { p_page?: number; p_query?: string }
        Returns: Json
      }
      doctor_practice_setup: { Args: never; Returns: Json }
      doctor_reschedule_appointment: {
        Args: {
          p_appointment: string
          p_day: string
          p_destination: string
          p_expected_version: number
          p_key: string
          p_location: string
          p_location_version: number
          p_minute: number
          p_practice: string
          p_reason: string
          p_schedule_version: number
        }
        Returns: Json
      }
      doctor_reserve_document: {
        Args: {
          p_actor: string
          p_document?: string
          p_expected_version?: number
          p_filename: string
          p_key: string
          p_location: string
          p_mime: string
          p_patient: string
          p_practice: string
          p_session: string
          p_sha: string
          p_size: number
        }
        Returns: Json
      }
      doctor_resolve_context: {
        Args: {
          p_expected_version?: number
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_runtime_contract: { Args: never; Returns: Json }
      doctor_save_onboarding_draft: {
        Args: {
          p_display_name: string
          p_expected_version: number
          p_key: string
          p_location_name: string
          p_practice_name: string
          p_timezone: string
        }
        Returns: Json
      }
      doctor_schedule: {
        Args: { p_location: string; p_practice: string }
        Returns: Json
      }
      doctor_session_context: { Args: never; Returns: Json }
      doctor_set_membership_grants: {
        Args: {
          p_grants: Json
          p_key: string
          p_membership: string
          p_practice: string
          p_version: number
        }
        Returns: Json
      }
      doctor_set_membership_status: {
        Args: {
          p_key: string
          p_membership: string
          p_practice: string
          p_status: string
          p_version: number
        }
        Returns: Json
      }
      doctor_team: {
        Args: {
          p_page?: number
          p_practice: string
          p_search?: string
          p_size?: number
        }
        Returns: Json
      }
      doctor_transition_appointment: {
        Args: {
          p_appointment: string
          p_expected_version: number
          p_key: string
          p_location: string
          p_practice: string
          p_reason: string
          p_state: string
        }
        Returns: Json
      }
      doctor_update_account_settings: {
        Args: {
          p_contact_phone: string
          p_expected_version: number
          p_in_app_confirmations: boolean
          p_key: string
          p_personal_name: string
        }
        Returns: Json
      }
      doctor_update_practice_profile: {
        Args: {
          p_display_name: string
          p_expected_version: number
          p_key: string
          p_practice: string
          p_practice_name: string
        }
        Returns: Json
      }
      doctor_write_location: {
        Args: {
          p_address: string
          p_expected_version?: number
          p_key: string
          p_location?: string
          p_name: string
          p_phone: string
          p_practice: string
          p_timezone: string
        }
        Returns: Json
      }
      doctor_write_patient: {
        Args: {
          p_duplicate_review?: string
          p_expected_version?: number
          p_input: Json
          p_key: string
          p_location: string
          p_patient?: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_write_schedule: {
        Args: {
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_location_version: number
          p_practice: string
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

