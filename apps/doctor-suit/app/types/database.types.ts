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
      administrative_task_events: {
        Row: {
          action: string
          actor_user_id: string
          happened_at: string
          id: number
          location_id: string
          next_assignee: string
          practice_id: string
          previous_assignee: string | null
          previous_state: string | null
          reason: string
          record_version: number
          state: string
          task_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          happened_at?: string
          id?: never
          location_id: string
          next_assignee: string
          practice_id: string
          previous_assignee?: string | null
          previous_state?: string | null
          reason: string
          record_version: number
          state: string
          task_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          happened_at?: string
          id?: never
          location_id?: string
          next_assignee?: string
          practice_id?: string
          previous_assignee?: string | null
          previous_state?: string | null
          reason?: string
          record_version?: number
          state?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "administrative_task_events_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "administrative_task_events_practice_id_task_id_fkey"
            columns: ["practice_id", "task_id"]
            isOneToOne: false
            referencedRelation: "administrative_tasks"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      administrative_tasks: {
        Row: {
          assignee_user_id: string
          captured_location_version: number
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          kind: string
          location_id: string
          location_name: string
          patient_id: string | null
          practice_id: string
          state: string
          timezone: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          assignee_user_id: string
          captured_location_version: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          due_at: string
          id: string
          kind: string
          location_id: string
          location_name: string
          patient_id?: string | null
          practice_id: string
          state: string
          timezone: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          assignee_user_id?: string
          captured_location_version?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          kind?: string
          location_id?: string
          location_name?: string
          patient_id?: string | null
          practice_id?: string
          state?: string
          timezone?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "administrative_tasks_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_tasks_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "administrative_tasks_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
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
          commitment_end: string
          commitment_start: string
          completed_at: string | null
          consultation_snapshot: Json | null
          created_at: string
          created_by: string
          doctor_user_id: string
          ends_at: string
          id: string
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          queue_position: number
          started_at: string | null
          starts_at: string
          state: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          checked_in_at?: string | null
          commitment_end: string
          commitment_start: string
          completed_at?: string | null
          consultation_snapshot?: Json | null
          created_at?: string
          created_by: string
          doctor_user_id: string
          ends_at: string
          id?: string
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          queue_position?: number
          started_at?: string | null
          starts_at: string
          state?: string
          timezone: string
          updated_at?: string
          version?: number
        }
        Update: {
          checked_in_at?: string | null
          commitment_end?: string
          commitment_start?: string
          completed_at?: string | null
          consultation_snapshot?: Json | null
          created_at?: string
          created_by?: string
          doctor_user_id?: string
          ends_at?: string
          id?: string
          location_id?: string
          location_name?: string
          patient_id?: string
          practice_id?: string
          queue_position?: number
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
      clinical_encounters: {
        Row: {
          active_version_id: string | null
          created_at: string
          created_by: string
          data_mode: string
          id: string
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          responsible_doctor: string
          status: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          created_by: string
          data_mode?: string
          id?: string
          location_id: string
          location_name: string
          patient_id: string
          practice_id: string
          responsible_doctor: string
          status: string
          timezone: string
          updated_at?: string
          version?: number
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          created_by?: string
          data_mode?: string
          id?: string
          location_id?: string
          location_name?: string
          patient_id?: string
          practice_id?: string
          responsible_doctor?: string
          status?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_encounters_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_practice_id_id_active_version_id_fkey"
            columns: ["practice_id", "id", "active_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_versions"
            referencedColumns: ["practice_id", "encounter_id", "id"]
          },
          {
            foreignKeyName: "clinical_encounters_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "clinical_encounters_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "clinical_encounters_responsible_doctor_fkey"
            columns: ["responsible_doctor"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clinical_events: {
        Row: {
          action: string
          actor_user_id: string
          encounter_id: string
          happened_at: string
          id: number
          practice_id: string
          version_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          encounter_id: string
          happened_at?: string
          id?: never
          practice_id: string
          version_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          encounter_id?: string
          happened_at?: string
          id?: never
          practice_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_events_practice_id_encounter_id_version_id_fkey"
            columns: ["practice_id", "encounter_id", "version_id"]
            isOneToOne: false
            referencedRelation: "clinical_versions"
            referencedColumns: ["practice_id", "encounter_id", "id"]
          },
        ]
      }
      clinical_note_templates: {
        Row: {
          data_mode: string
          sections: Json
          template_id: string
          version: number
        }
        Insert: {
          data_mode: string
          sections: Json
          template_id: string
          version: number
        }
        Update: {
          data_mode?: string
          sections?: Json
          template_id?: string
          version?: number
        }
        Relationships: []
      }
      clinical_release_revocations: {
        Row: {
          actor_user_id: string
          happened_at: string
          reason: string
          release_id: string
        }
        Insert: {
          actor_user_id: string
          happened_at?: string
          reason: string
          release_id: string
        }
        Update: {
          actor_user_id?: string
          happened_at?: string
          reason?: string
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_release_revocations_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: true
            referencedRelation: "clinical_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_releases: {
        Row: {
          encounter_id: string
          expires_at: string
          id: string
          practice_id: string
          recipient_patient_id: string
          recipient_user_id: string
          released_at: string
          released_by: string
          version_id: string
        }
        Insert: {
          encounter_id: string
          expires_at: string
          id?: string
          practice_id: string
          recipient_patient_id: string
          recipient_user_id: string
          released_at?: string
          released_by: string
          version_id: string
        }
        Update: {
          encounter_id?: string
          expires_at?: string
          id?: string
          practice_id?: string
          recipient_patient_id?: string
          recipient_user_id?: string
          released_at?: string
          released_by?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_releases_practice_id_encounter_id_version_id_fkey"
            columns: ["practice_id", "encounter_id", "version_id"]
            isOneToOne: false
            referencedRelation: "clinical_versions"
            referencedColumns: ["practice_id", "encounter_id", "id"]
          },
          {
            foreignKeyName: "clinical_releases_practice_id_recipient_patient_id_fkey"
            columns: ["practice_id", "recipient_patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      clinical_versions: {
        Row: {
          actor_session_id: string
          actor_user_id: string
          encounter_id: string
          happened_at: string
          id: string
          kind: string
          practice_id: string
          reason: string | null
          revision: number
          snapshot: Json
          snapshot_sha256: string
          source_version_id: string | null
        }
        Insert: {
          actor_session_id: string
          actor_user_id: string
          encounter_id: string
          happened_at?: string
          id?: string
          kind: string
          practice_id: string
          reason?: string | null
          revision: number
          snapshot: Json
          snapshot_sha256: string
          source_version_id?: string | null
        }
        Update: {
          actor_session_id?: string
          actor_user_id?: string
          encounter_id?: string
          happened_at?: string
          id?: string
          kind?: string
          practice_id?: string
          reason?: string | null
          revision?: number
          snapshot?: Json
          snapshot_sha256?: string
          source_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_versions_practice_id_encounter_id_fkey"
            columns: ["practice_id", "encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "clinical_versions_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_types: {
        Row: {
          active: boolean
          actor_user_id: string
          buffer_after: number
          buffer_before: number
          capacity: number
          duration_minutes: number
          happened_at: string
          id: string
          location_ids: string[]
          name: string
          practice_id: string
          version: number
        }
        Insert: {
          active: boolean
          actor_user_id: string
          buffer_after: number
          buffer_before: number
          capacity?: number
          duration_minutes: number
          happened_at?: string
          id?: string
          location_ids: string[]
          name: string
          practice_id: string
          version: number
        }
        Update: {
          active?: boolean
          actor_user_id?: string
          buffer_after?: number
          buffer_before?: number
          capacity?: number
          duration_minutes?: number
          happened_at?: string
          id?: string
          location_ids?: string[]
          name?: string
          practice_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultation_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_administration_audit: {
        Row: {
          authority_binding_id: string
          correlation_id: string
          created_at: string
          database_actor: string
          id: string
          key_id: string
          manifest_digest: string
          nonce: string
          operation: string
          outcome: string
          request_digest: string
          request_id: string
          response_digest: string | null
          role_snapshot: string
          source_binding_id: string
          subject_id: string
          target_binding_id: string
          target_environment_id: string
        }
        Insert: {
          authority_binding_id: string
          correlation_id: string
          created_at?: string
          database_actor?: string
          id?: string
          key_id: string
          manifest_digest: string
          nonce: string
          operation: string
          outcome: string
          request_digest: string
          request_id: string
          response_digest?: string | null
          role_snapshot: string
          source_binding_id: string
          subject_id: string
          target_binding_id: string
          target_environment_id: string
        }
        Update: {
          authority_binding_id?: string
          correlation_id?: string
          created_at?: string
          database_actor?: string
          id?: string
          key_id?: string
          manifest_digest?: string
          nonce?: string
          operation?: string
          outcome?: string
          request_digest?: string
          request_id?: string
          response_digest?: string | null
          role_snapshot?: string
          source_binding_id?: string
          subject_id?: string
          target_binding_id?: string
          target_environment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_administration_audit_source_binding_id_key_id_nonce_fkey"
            columns: ["source_binding_id", "key_id", "nonce"]
            isOneToOne: false
            referencedRelation: "doctor_administration_nonces"
            referencedColumns: ["source_binding_id", "key_id", "nonce"]
          },
        ]
      }
      doctor_administration_nonces: {
        Row: {
          expires_at: string
          key_id: string
          nonce: string
          received_at: string
          request_id: string
          source_binding_id: string
        }
        Insert: {
          expires_at: string
          key_id: string
          nonce: string
          received_at?: string
          request_id: string
          source_binding_id: string
        }
        Update: {
          expires_at?: string
          key_id?: string
          nonce?: string
          received_at?: string
          request_id?: string
          source_binding_id?: string
        }
        Relationships: []
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
      doctor_introductory_plans: {
        Row: {
          clinic_limit: number
          created_at: string
          decision_ref: string
          monthly_minor: number
          name_ar: string
          name_en: string
          plan_key: string
          staff_limit_excluding_owner: number
          total_named_users: number
          yearly_minor: number
        }
        Insert: {
          clinic_limit: number
          created_at?: string
          decision_ref?: string
          monthly_minor: number
          name_ar: string
          name_en: string
          plan_key: string
          staff_limit_excluding_owner: number
          total_named_users: number
          yearly_minor: number
        }
        Update: {
          clinic_limit?: number
          created_at?: string
          decision_ref?: string
          monthly_minor?: number
          name_ar?: string
          name_en?: string
          plan_key?: string
          staff_limit_excluding_owner?: number
          total_named_users?: number
          yearly_minor?: number
        }
        Relationships: []
      }
      doctor_manual_payment_configuration: {
        Row: {
          acceptance_mode: string
          activation_approval_ref: string | null
          activation_policy: string | null
          change_reason: string
          changed_at: string
          enabled: boolean
          recipient_id: string | null
          revision: number
          singleton: boolean
        }
        Insert: {
          acceptance_mode?: string
          activation_approval_ref?: string | null
          activation_policy?: string | null
          change_reason: string
          changed_at?: string
          enabled?: boolean
          recipient_id?: string | null
          revision: number
          singleton?: boolean
        }
        Update: {
          acceptance_mode?: string
          activation_approval_ref?: string | null
          activation_policy?: string | null
          change_reason?: string
          changed_at?: string
          enabled?: boolean
          recipient_id?: string | null
          revision?: number
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_configuration_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_payment_configuration_events: {
        Row: {
          acceptance_mode: string
          activation_approval_ref: string | null
          activation_policy: string | null
          change_reason: string
          database_actor: string
          enabled: boolean
          happened_at: string
          recipient_id: string | null
          revision: number
        }
        Insert: {
          acceptance_mode: string
          activation_approval_ref?: string | null
          activation_policy?: string | null
          change_reason: string
          database_actor: string
          enabled: boolean
          happened_at?: string
          recipient_id?: string | null
          revision: number
        }
        Update: {
          acceptance_mode?: string
          activation_approval_ref?: string | null
          activation_policy?: string | null
          change_reason?: string
          database_actor?: string
          enabled?: boolean
          happened_at?: string
          recipient_id?: string | null
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_configuration_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_payment_evidence: {
        Row: {
          byte_size: number
          created_at: string
          filename: string
          id: string
          mime_type: string
          notice_id: string
          object_path: string
          sha256: string
          uploaded_by: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          filename: string
          id: string
          mime_type: string
          notice_id: string
          object_path: string
          sha256: string
          uploaded_by: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          notice_id?: string
          object_path?: string
          sha256?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_evidence_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: true
            referencedRelation: "doctor_manual_payment_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_payment_evidence_events: {
        Row: {
          action: string
          actor_user_id: string
          evidence_id: string
          happened_at: string
          id: string
          notice_id: string
          session_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          evidence_id: string
          happened_at?: string
          id?: string
          notice_id: string
          session_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          evidence_id?: string
          happened_at?: string
          id?: string
          notice_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_evidence_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_manual_payment_evidence_events_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_payment_notices: {
        Row: {
          configuration_revision: number
          created_at: string
          id: string
          intent_id: string
          recipient_id: string
          request_id: string
          requires_attention: boolean
          subscriber_user_id: string
          transfer_reference: string
          transferred_at: string
        }
        Insert: {
          configuration_revision: number
          created_at?: string
          id?: string
          intent_id: string
          recipient_id: string
          request_id: string
          requires_attention: boolean
          subscriber_user_id: string
          transfer_reference: string
          transferred_at: string
        }
        Update: {
          configuration_revision?: number
          created_at?: string
          id?: string
          intent_id?: string
          recipient_id?: string
          request_id?: string
          requires_attention?: boolean
          subscriber_user_id?: string
          transfer_reference?: string
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_notices_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "doctor_saas_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_manual_payment_notices_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_manual_payment_notices_request_id_recipient_id_inte_fkey"
            columns: [
              "request_id",
              "recipient_id",
              "intent_id",
              "subscriber_user_id",
            ]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_requests"
            referencedColumns: [
              "id",
              "recipient_id",
              "intent_id",
              "subscriber_user_id",
            ]
          },
        ]
      }
      doctor_manual_payment_recipients: {
        Row: {
          account_key: string
          address: string
          address_kind: string
          beneficiary_name: string
          created_at: string
          currency: string
          currency_exponent: number
          database_actor: string
          id: string
          instructions_ar: string
          instructions_en: string
          merchant_approval_ref: string
        }
        Insert: {
          account_key: string
          address: string
          address_kind: string
          beneficiary_name: string
          created_at?: string
          currency: string
          currency_exponent: number
          database_actor?: string
          id?: string
          instructions_ar: string
          instructions_en: string
          merchant_approval_ref: string
        }
        Update: {
          account_key?: string
          address?: string
          address_kind?: string
          beneficiary_name?: string
          created_at?: string
          currency?: string
          currency_exponent?: number
          database_actor?: string
          id?: string
          instructions_ar?: string
          instructions_en?: string
          merchant_approval_ref?: string
        }
        Relationships: []
      }
      doctor_manual_payment_requests: {
        Row: {
          configuration_revision: number
          created_at: string
          id: string
          intent_id: string
          recipient_id: string
          subscriber_user_id: string
        }
        Insert: {
          configuration_revision: number
          created_at?: string
          id?: string
          intent_id: string
          recipient_id: string
          subscriber_user_id: string
        }
        Update: {
          configuration_revision?: number
          created_at?: string
          id?: string
          intent_id?: string
          recipient_id?: string
          subscriber_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_requests_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "doctor_saas_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_manual_payment_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_payment_reviewer_events: {
        Row: {
          approval_ref: string
          database_actor: string
          enabled: boolean
          happened_at: string
          revision: number
          user_id: string
          valid_until: string
        }
        Insert: {
          approval_ref: string
          database_actor: string
          enabled: boolean
          happened_at?: string
          revision: number
          user_id: string
          valid_until: string
        }
        Update: {
          approval_ref?: string
          database_actor?: string
          enabled?: boolean
          happened_at?: string
          revision?: number
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      doctor_manual_payment_reviewers: {
        Row: {
          approval_ref: string
          changed_at: string
          enabled: boolean
          revision: number
          user_id: string
          valid_until: string
        }
        Insert: {
          approval_ref: string
          changed_at?: string
          enabled: boolean
          revision: number
          user_id: string
          valid_until: string
        }
        Update: {
          approval_ref?: string
          changed_at?: string
          enabled?: boolean
          revision?: number
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      doctor_manual_payment_reviews: {
        Row: {
          action: string
          activation_approval_ref: string | null
          activation_configuration_revision: number | null
          activation_policy: string | null
          actor_user_id: string
          funds_id: string | null
          happened_at: string
          id: string
          notice_id: string
          period_id: string | null
          reason: string
          revision: number
        }
        Insert: {
          action: string
          activation_approval_ref?: string | null
          activation_configuration_revision?: number | null
          activation_policy?: string | null
          actor_user_id: string
          funds_id?: string | null
          happened_at?: string
          id?: string
          notice_id: string
          period_id?: string | null
          reason: string
          revision: number
        }
        Update: {
          action?: string
          activation_approval_ref?: string | null
          activation_configuration_revision?: number | null
          activation_policy?: string | null
          actor_user_id?: string
          funds_id?: string | null
          happened_at?: string
          id?: string
          notice_id?: string
          period_id?: string | null
          reason?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_payment_reviews_funds_id_fkey"
            columns: ["funds_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_received_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_manual_payment_reviews_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "doctor_manual_payment_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_manual_payment_reviews_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_plan_bindings: {
        Row: {
          change_reason: string
          changed_at: string
          enabled: boolean
          plan_key: string
          price_approval_ref: string | null
          revision: number
          terms_version_id: string | null
        }
        Insert: {
          change_reason: string
          changed_at?: string
          enabled?: boolean
          plan_key: string
          price_approval_ref?: string | null
          revision?: number
          terms_version_id?: string | null
        }
        Update: {
          change_reason?: string
          changed_at?: string
          enabled?: boolean
          plan_key?: string
          price_approval_ref?: string | null
          revision?: number
          terms_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_plan_bindings_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: true
            referencedRelation: "doctor_introductory_plans"
            referencedColumns: ["plan_key"]
          },
          {
            foreignKeyName: "doctor_manual_plan_bindings_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: true
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_manual_received_funds: {
        Row: {
          currency: string
          id: string
          notice_id: string
          received_at: string
          received_minor: number
          received_reference: string
          recipient_account_key: string
          verification_ref: string
          verified_at: string
          verified_by: string
        }
        Insert: {
          currency: string
          id?: string
          notice_id: string
          received_at: string
          received_minor: number
          received_reference: string
          recipient_account_key: string
          verification_ref: string
          verified_at?: string
          verified_by: string
        }
        Update: {
          currency?: string
          id?: string
          notice_id?: string
          received_at?: string
          received_minor?: number
          received_reference?: string
          recipient_account_key?: string
          verification_ref?: string
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_manual_received_funds_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: true
            referencedRelation: "doctor_manual_payment_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_privacy_requests: {
        Row: {
          created_at: string
          database_actor: string
          id: string
          kind: string
          request_key: string
          session_id: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          database_actor?: string
          id?: string
          kind: string
          request_key: string
          session_id: string
          state?: string
          user_id: string
        }
        Update: {
          created_at?: string
          database_actor?: string
          id?: string
          kind?: string
          request_key?: string
          session_id?: string
          state?: string
          user_id?: string
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
      doctor_saas_accounts: {
        Row: {
          changed_at: string
          created_at: string
          current_period_id: string
          reason_code: string
          revision: number
          state: string
          subscriber_user_id: string
        }
        Insert: {
          changed_at?: string
          created_at?: string
          current_period_id: string
          reason_code: string
          revision?: number
          state?: string
          subscriber_user_id: string
        }
        Update: {
          changed_at?: string
          created_at?: string
          current_period_id?: string
          reason_code?: string
          revision?: number
          state?: string
          subscriber_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_accounts_subscriber_user_id_current_period_id_fkey"
            columns: ["subscriber_user_id", "current_period_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_periods"
            referencedColumns: ["subscriber_user_id", "id"]
          },
        ]
      }
      doctor_saas_configuration: {
        Row: {
          change_reason: string
          changed_at: string
          revision: number
          singleton: boolean
          terms_version_id: string | null
        }
        Insert: {
          change_reason: string
          changed_at?: string
          revision: number
          singleton?: boolean
          terms_version_id?: string | null
        }
        Update: {
          change_reason?: string
          changed_at?: string
          revision?: number
          singleton?: boolean
          terms_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_configuration_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_configuration_events: {
        Row: {
          change_reason: string
          database_actor: string
          happened_at: string
          next_terms_id: string | null
          previous_terms_id: string | null
          revision: number
        }
        Insert: {
          change_reason: string
          database_actor: string
          happened_at?: string
          next_terms_id?: string | null
          previous_terms_id?: string | null
          revision: number
        }
        Update: {
          change_reason?: string
          database_actor?: string
          happened_at?: string
          next_terms_id?: string | null
          previous_terms_id?: string | null
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_configuration_events_next_terms_id_fkey"
            columns: ["next_terms_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_saas_configuration_events_previous_terms_id_fkey"
            columns: ["previous_terms_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_payment_intents: {
        Row: {
          created_at: string
          id: string
          quote_id: string
          state: string
          subscriber_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quote_id: string
          state?: string
          subscriber_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quote_id?: string
          state?: string
          subscriber_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_payment_intents_subscriber_user_id_quote_id_fkey"
            columns: ["subscriber_user_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_quotes"
            referencedColumns: ["subscriber_user_id", "id"]
          },
        ]
      }
      doctor_saas_period_events: {
        Row: {
          database_actor: string
          happened_at: string
          next_state: string
          period_id: string
          previous_state: string | null
          reason_code: string
          revision: number
          subscriber_user_id: string
        }
        Insert: {
          database_actor?: string
          happened_at?: string
          next_state: string
          period_id: string
          previous_state?: string | null
          reason_code: string
          revision: number
          subscriber_user_id: string
        }
        Update: {
          database_actor?: string
          happened_at?: string
          next_state?: string
          period_id?: string
          previous_state?: string | null
          reason_code?: string
          revision?: number
          subscriber_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_period_events_subscriber_user_id_period_id_fkey"
            columns: ["subscriber_user_id", "period_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_periods"
            referencedColumns: ["subscriber_user_id", "id"]
          },
        ]
      }
      doctor_saas_periods: {
        Row: {
          accepted_document_ref: string
          created_at: string
          database_actor: string
          ends_at: string
          id: string
          kind: string
          started_at: string
          subscriber_user_id: string
          terms_version_id: string
        }
        Insert: {
          accepted_document_ref: string
          created_at?: string
          database_actor?: string
          ends_at: string
          id?: string
          kind: string
          started_at: string
          subscriber_user_id: string
          terms_version_id: string
        }
        Update: {
          accepted_document_ref?: string
          created_at?: string
          database_actor?: string
          ends_at?: string
          id?: string
          kind?: string
          started_at?: string
          subscriber_user_id?: string
          terms_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_periods_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_quotes: {
        Row: {
          accepted_document_ref: string
          account_revision: number
          account_state: string
          amount_minor: number
          billing_interval: string
          configuration_revision: number
          created_at: string
          currency: string
          currency_exponent: number
          current_period_id: string | null
          id: string
          practice_id: string | null
          subscriber_user_id: string
          terms_version_id: string
        }
        Insert: {
          accepted_document_ref: string
          account_revision: number
          account_state: string
          amount_minor: number
          billing_interval: string
          configuration_revision: number
          created_at?: string
          currency: string
          currency_exponent: number
          current_period_id?: string | null
          id?: string
          practice_id?: string | null
          subscriber_user_id: string
          terms_version_id: string
        }
        Update: {
          accepted_document_ref?: string
          account_revision?: number
          account_state?: string
          amount_minor?: number
          billing_interval?: string
          configuration_revision?: number
          created_at?: string
          currency?: string
          currency_exponent?: number
          current_period_id?: string | null
          id?: string
          practice_id?: string | null
          subscriber_user_id?: string
          terms_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_quotes_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_saas_quotes_subscriber_user_id_current_period_id_fkey"
            columns: ["subscriber_user_id", "current_period_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_periods"
            referencedColumns: ["subscriber_user_id", "id"]
          },
          {
            foreignKeyName: "doctor_saas_quotes_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_synthetic_deliveries: {
        Row: {
          database_actor: string
          delivery_id: string
          disposition: string
          event_id: string
          intent_id: string
          received_at: string
          request: Json
          result: Json
        }
        Insert: {
          database_actor?: string
          delivery_id: string
          disposition: string
          event_id: string
          intent_id: string
          received_at?: string
          request: Json
          result: Json
        }
        Update: {
          database_actor?: string
          delivery_id?: string
          disposition?: string
          event_id?: string
          intent_id?: string
          received_at?: string
          request?: Json
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_synthetic_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_synthetic_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_saas_synthetic_deliveries_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_synthetic_events: {
        Row: {
          amount_minor: number
          binding: string
          currency: string
          database_actor: string
          event_ref: string
          id: string
          intent_id: string
          outcome: string
          received_at: string
          reported_subscriber_id: string
          source_sequence: number
        }
        Insert: {
          amount_minor: number
          binding: string
          currency: string
          database_actor?: string
          event_ref: string
          id?: string
          intent_id: string
          outcome: string
          received_at?: string
          reported_subscriber_id: string
          source_sequence: number
        }
        Update: {
          amount_minor?: number
          binding?: string
          currency?: string
          database_actor?: string
          event_ref?: string
          id?: string
          intent_id?: string
          outcome?: string
          received_at?: string
          reported_subscriber_id?: string
          source_sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_synthetic_events_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "doctor_saas_payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_terms_documents: {
        Row: {
          content_ar: string
          content_en: string
          created_at: string
          database_actor: string
          document_ref: string
          terms_version_id: string
        }
        Insert: {
          content_ar: string
          content_en: string
          created_at?: string
          database_actor?: string
          document_ref: string
          terms_version_id: string
        }
        Update: {
          content_ar?: string
          content_en?: string
          created_at?: string
          database_actor?: string
          document_ref?: string
          terms_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_saas_terms_documents_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: true
            referencedRelation: "doctor_saas_terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_saas_terms_versions: {
        Row: {
          cancellation_policy: string | null
          clinic_limit: number | null
          clinic_unlimited: boolean | null
          commercial_approval_ref: string | null
          created_at: string
          currency: string | null
          currency_exponent: number | null
          database_actor: string
          expiry_policy: string | null
          grace_days: number | null
          id: string
          legal_approval_ref: string | null
          monthly_minor: number | null
          over_limit_policy: string | null
          plan_key: string
          refund_policy: string | null
          renewal_policy: string | null
          staff_limit: number | null
          staff_unlimited: boolean | null
          status: string
          terms_document_ref: string | null
          trial_days: number | null
          version: number
          yearly_minor: number | null
        }
        Insert: {
          cancellation_policy?: string | null
          clinic_limit?: number | null
          clinic_unlimited?: boolean | null
          commercial_approval_ref?: string | null
          created_at?: string
          currency?: string | null
          currency_exponent?: number | null
          database_actor?: string
          expiry_policy?: string | null
          grace_days?: number | null
          id?: string
          legal_approval_ref?: string | null
          monthly_minor?: number | null
          over_limit_policy?: string | null
          plan_key: string
          refund_policy?: string | null
          renewal_policy?: string | null
          staff_limit?: number | null
          staff_unlimited?: boolean | null
          status: string
          terms_document_ref?: string | null
          trial_days?: number | null
          version: number
          yearly_minor?: number | null
        }
        Update: {
          cancellation_policy?: string | null
          clinic_limit?: number | null
          clinic_unlimited?: boolean | null
          commercial_approval_ref?: string | null
          created_at?: string
          currency?: string | null
          currency_exponent?: number | null
          database_actor?: string
          expiry_policy?: string | null
          grace_days?: number | null
          id?: string
          legal_approval_ref?: string | null
          monthly_minor?: number | null
          over_limit_policy?: string | null
          plan_key?: string
          refund_policy?: string | null
          renewal_policy?: string | null
          staff_limit?: number | null
          staff_unlimited?: boolean | null
          status?: string
          terms_document_ref?: string | null
          trial_days?: number | null
          version?: number
          yearly_minor?: number | null
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
      message_outbox: {
        Row: {
          attempts: number
          available_at: string
          blocker: string | null
          claim_token: string | null
          consent_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          intent: Json
          lease_until: string | null
          location_id: string
          parameters: Json
          patient_id: string
          practice_id: string
          recipient_kind: string
          state: string
          template: string
          version: number
        }
        Insert: {
          attempts?: number
          available_at?: string
          blocker?: string | null
          claim_token?: string | null
          consent_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id: string
          intent: Json
          lease_until?: string | null
          location_id: string
          parameters?: Json
          patient_id: string
          practice_id: string
          recipient_kind: string
          state?: string
          template: string
          version?: number
        }
        Update: {
          attempts?: number
          available_at?: string
          blocker?: string | null
          claim_token?: string | null
          consent_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          intent?: Json
          lease_until?: string | null
          location_id?: string
          parameters?: Json
          patient_id?: string
          practice_id?: string
          recipient_kind?: string
          state?: string
          template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_practice_id_consent_id_fkey"
            columns: ["practice_id", "consent_id"]
            isOneToOne: false
            referencedRelation: "patient_contact_consents"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "message_outbox_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "message_outbox_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      message_outbox_events: {
        Row: {
          actor_user_id: string
          blocker: string | null
          happened_at: string
          message_id: string
          practice_id: string
          state: string
          version: number
        }
        Insert: {
          actor_user_id: string
          blocker?: string | null
          happened_at?: string
          message_id: string
          practice_id: string
          state: string
          version: number
        }
        Update: {
          actor_user_id?: string
          blocker?: string | null
          happened_at?: string
          message_id?: string
          practice_id?: string
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_events_practice_id_message_id_fkey"
            columns: ["practice_id", "message_id"]
            isOneToOne: false
            referencedRelation: "message_outbox"
            referencedColumns: ["practice_id", "id"]
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
      operational_fulfillment_documents: {
        Row: {
          document_id: string
          document_version_id: string
          fulfillment_id: string
          practice_id: string
          received_at: string
          recorded_at: string
          recorded_by: string
          review_state: string
          source_at: string
          source_ref: string
        }
        Insert: {
          document_id: string
          document_version_id: string
          fulfillment_id: string
          practice_id: string
          received_at: string
          recorded_at?: string
          recorded_by: string
          review_state?: string
          source_at: string
          source_ref: string
        }
        Update: {
          document_id?: string
          document_version_id?: string
          fulfillment_id?: string
          practice_id?: string
          received_at?: string
          recorded_at?: string
          recorded_by?: string
          review_state?: string
          source_at?: string
          source_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_fulfillment_docum_practice_id_document_id_docu_fkey"
            columns: ["practice_id", "document_id", "document_version_id"]
            isOneToOne: false
            referencedRelation: "patient_document_versions"
            referencedColumns: ["practice_id", "document_id", "id"]
          },
          {
            foreignKeyName: "operational_fulfillment_documen_practice_id_fulfillment_id_fkey"
            columns: ["practice_id", "fulfillment_id"]
            isOneToOne: false
            referencedRelation: "operational_fulfillments"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      operational_fulfillment_events: {
        Row: {
          actor_user_id: string
          fulfillment_id: string
          happened_at: string
          practice_id: string
          source_ref: string
          state: string
          version: number
        }
        Insert: {
          actor_user_id: string
          fulfillment_id: string
          happened_at?: string
          practice_id: string
          source_ref: string
          state: string
          version: number
        }
        Update: {
          actor_user_id?: string
          fulfillment_id?: string
          happened_at?: string
          practice_id?: string
          source_ref?: string
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "operational_fulfillment_events_practice_id_fulfillment_id_fkey"
            columns: ["practice_id", "fulfillment_id"]
            isOneToOne: false
            referencedRelation: "operational_fulfillments"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      operational_fulfillments: {
        Row: {
          created_at: string
          created_by: string
          encounter_id: string
          id: string
          kind: string
          location_id: string
          order_id: string
          patient_id: string
          practice_id: string
          source_version_id: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          encounter_id: string
          id: string
          kind: string
          location_id: string
          order_id: string
          patient_id: string
          practice_id: string
          source_version_id: string
          state?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          encounter_id?: string
          id?: string
          kind?: string
          location_id?: string
          order_id?: string
          patient_id?: string
          practice_id?: string
          source_version_id?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "operational_fulfillments_practice_id_encounter_id_source_v_fkey"
            columns: ["practice_id", "encounter_id", "source_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_versions"
            referencedColumns: ["practice_id", "encounter_id", "id"]
          },
          {
            foreignKeyName: "operational_fulfillments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_fulfillments_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "operational_fulfillments_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
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
      patient_contact_channels: {
        Row: {
          channel: string
          created_at: string
          created_by: string
          destination: string
          guardian_id: string | null
          id: string
          location_id: string
          patient_id: string
          practice_id: string
          recipient_kind: string
          revoked_at: string | null
          revoked_by: string | null
          state: string
          version: number
        }
        Insert: {
          channel: string
          created_at?: string
          created_by: string
          destination: string
          guardian_id?: string | null
          id: string
          location_id: string
          patient_id: string
          practice_id: string
          recipient_kind: string
          revoked_at?: string | null
          revoked_by?: string | null
          state?: string
          version?: number
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string
          destination?: string
          guardian_id?: string | null
          id?: string
          location_id?: string
          patient_id?: string
          practice_id?: string
          recipient_kind?: string
          revoked_at?: string | null
          revoked_by?: string | null
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_contact_channels_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_contact_channels_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_contact_channels_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_contact_channels_practice_id_patient_id_guardian_i_fkey"
            columns: ["practice_id", "patient_id", "guardian_id"]
            isOneToOne: false
            referencedRelation: "patient_guardian_relationships"
            referencedColumns: ["practice_id", "patient_id", "id"]
          },
        ]
      }
      patient_contact_consents: {
        Row: {
          allowed: boolean
          contact_id: string
          contact_version: number
          guardian_version: number | null
          id: string
          patient_id: string
          practice_id: string
          purpose: string
          recorded_at: string
          recorded_by: string
          revoked_at: string | null
          source_ref: string
          source_time: string
          version: number
        }
        Insert: {
          allowed: boolean
          contact_id: string
          contact_version: number
          guardian_version?: number | null
          id: string
          patient_id: string
          practice_id: string
          purpose: string
          recorded_at?: string
          recorded_by: string
          revoked_at?: string | null
          source_ref: string
          source_time: string
          version: number
        }
        Update: {
          allowed?: boolean
          contact_id?: string
          contact_version?: number
          guardian_version?: number | null
          id?: string
          patient_id?: string
          practice_id?: string
          purpose?: string
          recorded_at?: string
          recorded_by?: string
          revoked_at?: string | null
          source_ref?: string
          source_time?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_contact_consents_practice_id_patient_id_contact_id_fkey"
            columns: ["practice_id", "patient_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "patient_contact_channels"
            referencedColumns: ["practice_id", "patient_id", "id"]
          },
        ]
      }
      patient_contact_events: {
        Row: {
          action: string
          actor_user_id: string
          details: Json
          happened_at: string
          id: number
          location_id: string
          patient_id: string
          practice_id: string
          record_id: string
          record_kind: string
          record_version: number
        }
        Insert: {
          action: string
          actor_user_id: string
          details: Json
          happened_at?: string
          id?: never
          location_id: string
          patient_id: string
          practice_id: string
          record_id: string
          record_kind: string
          record_version: number
        }
        Update: {
          action?: string
          actor_user_id?: string
          details?: Json
          happened_at?: string
          id?: never
          location_id?: string
          patient_id?: string
          practice_id?: string
          record_id?: string
          record_kind?: string
          record_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_contact_events_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_contact_events_practice_id_patient_id_fkey"
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
      patient_guardian_relationships: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          label: string
          location_id: string
          patient_id: string
          policy_version: string
          practice_id: string
          purposes: string[]
          relationship: string
          review_source_ref: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_ref: string
          state: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id: string
          label: string
          location_id: string
          patient_id: string
          policy_version?: string
          practice_id: string
          purposes?: string[]
          relationship: string
          review_source_ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ref: string
          state?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          label?: string
          location_id?: string
          patient_id?: string
          policy_version?: string
          practice_id?: string
          purposes?: string[]
          relationship?: string
          review_source_ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ref?: string
          state?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_guardian_relationships_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_guardian_relationships_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "patient_guardian_relationships_practice_id_patient_id_fkey"
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
      synthetic_import_batches: {
        Row: {
          created_at: string
          created_by: string
          cursor: number
          expected_rows: number
          id: string
          location_id: string
          mapping_version: string
          practice_id: string
          source_ref: string
          source_rows: Json
          source_sha256: string
          state: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          cursor?: number
          expected_rows: number
          id: string
          location_id: string
          mapping_version: string
          practice_id: string
          source_ref: string
          source_rows: Json
          source_sha256: string
          state?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          cursor?: number
          expected_rows?: number
          id?: string
          location_id?: string
          mapping_version?: string
          practice_id?: string
          source_ref?: string
          source_rows?: Json
          source_sha256?: string
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "synthetic_import_batches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synthetic_import_batches_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      synthetic_import_events: {
        Row: {
          action: string
          actor_user_id: string
          batch_id: string
          cursor: number
          happened_at: string
          practice_id: string
          state: string
          version: number
        }
        Insert: {
          action: string
          actor_user_id: string
          batch_id: string
          cursor: number
          happened_at?: string
          practice_id: string
          state: string
          version: number
        }
        Update: {
          action?: string
          actor_user_id?: string
          batch_id?: string
          cursor?: number
          happened_at?: string
          practice_id?: string
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "synthetic_import_events_practice_id_batch_id_fkey"
            columns: ["practice_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "synthetic_import_batches"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      synthetic_import_rows: {
        Row: {
          batch_id: string
          errors: string[]
          kind: string
          ordinal: number
          practice_id: string
          preview_target: Json | null
          source_id: string
          state: string
        }
        Insert: {
          batch_id: string
          errors: string[]
          kind: string
          ordinal: number
          practice_id: string
          preview_target?: Json | null
          source_id: string
          state: string
        }
        Update: {
          batch_id?: string
          errors?: string[]
          kind?: string
          ordinal?: number
          practice_id?: string
          preview_target?: Json | null
          source_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "synthetic_import_rows_practice_id_batch_id_fkey"
            columns: ["practice_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "synthetic_import_batches"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          contact_permission: boolean
          created_at: string
          created_by: string
          date_from: string
          date_to: string
          doctor_user_id: string
          id: string
          location_id: string
          location_name: string
          location_version: number
          minute_end: number
          minute_start: number
          patient_id: string
          permission_recorded_at: string
          permission_source: string
          practice_id: string
          requested_type: Json
          state: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          contact_permission: boolean
          created_at?: string
          created_by: string
          date_from: string
          date_to: string
          doctor_user_id: string
          id?: string
          location_id: string
          location_name: string
          location_version: number
          minute_end: number
          minute_start: number
          patient_id: string
          permission_recorded_at?: string
          permission_source: string
          practice_id: string
          requested_type: Json
          state?: string
          timezone: string
          updated_at?: string
          version?: number
        }
        Update: {
          contact_permission?: boolean
          created_at?: string
          created_by?: string
          date_from?: string
          date_to?: string
          doctor_user_id?: string
          id?: string
          location_id?: string
          location_name?: string
          location_version?: number
          minute_end?: number
          minute_start?: number
          patient_id?: string
          permission_recorded_at?: string
          permission_source?: string
          practice_id?: string
          requested_type?: Json
          state?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_practice_id_doctor_user_id_fkey"
            columns: ["practice_id", "doctor_user_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id", "owner_user_id"]
          },
          {
            foreignKeyName: "waitlist_entries_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "waitlist_entries_practice_id_patient_id_fkey"
            columns: ["practice_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "practice_patients"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      waitlist_events: {
        Row: {
          action: string
          actor_user_id: string
          entry_id: string
          happened_at: string
          id: number
          location_id: string
          offer_id: string | null
          practice_id: string
          reason: string | null
          record_version: number
        }
        Insert: {
          action: string
          actor_user_id: string
          entry_id: string
          happened_at?: string
          id?: never
          location_id: string
          offer_id?: string | null
          practice_id: string
          reason?: string | null
          record_version: number
        }
        Update: {
          action?: string
          actor_user_id?: string
          entry_id?: string
          happened_at?: string
          id?: never
          location_id?: string
          offer_id?: string | null
          practice_id?: string
          reason?: string | null
          record_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_events_practice_id_entry_id_fkey"
            columns: ["practice_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "waitlist_events_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "waitlist_events_practice_id_offer_id_fkey"
            columns: ["practice_id", "offer_id"]
            isOneToOne: false
            referencedRelation: "waitlist_offers"
            referencedColumns: ["practice_id", "id"]
          },
        ]
      }
      waitlist_offers: {
        Row: {
          appointment_id: string | null
          commitment_end: string
          commitment_start: string
          consultation_snapshot: Json
          created_at: string
          created_by: string
          day: string
          doctor_user_id: string
          ends_at: string
          entry_id: string
          expires_at: string
          id: string
          location_id: string
          location_version: number
          minute: number
          practice_id: string
          record_version: number
          schedule_version: number
          starts_at: string
          state: string
        }
        Insert: {
          appointment_id?: string | null
          commitment_end: string
          commitment_start: string
          consultation_snapshot: Json
          created_at?: string
          created_by: string
          day: string
          doctor_user_id: string
          ends_at: string
          entry_id: string
          expires_at: string
          id?: string
          location_id: string
          location_version: number
          minute: number
          practice_id: string
          record_version: number
          schedule_version: number
          starts_at: string
          state: string
        }
        Update: {
          appointment_id?: string | null
          commitment_end?: string
          commitment_start?: string
          consultation_snapshot?: Json
          created_at?: string
          created_by?: string
          day?: string
          doctor_user_id?: string
          ends_at?: string
          entry_id?: string
          expires_at?: string
          id?: string
          location_id?: string
          location_version?: number
          minute?: number
          practice_id?: string
          record_version?: number
          schedule_version?: number
          starts_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_offers_practice_id_appointment_id_fkey"
            columns: ["practice_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "waitlist_offers_practice_id_doctor_user_id_fkey"
            columns: ["practice_id", "doctor_user_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id", "owner_user_id"]
          },
          {
            foreignKeyName: "waitlist_offers_practice_id_entry_id_fkey"
            columns: ["practice_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["practice_id", "id"]
          },
          {
            foreignKeyName: "waitlist_offers_practice_id_location_id_fkey"
            columns: ["practice_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["practice_id", "id"]
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
      doctor_activate_manual_payment: {
        Args: { p_key: string; p_notice: string; p_revision: number }
        Returns: Json
      }
      doctor_administration_readiness: { Args: never; Returns: Json }
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
      doctor_auth_email_exists: { Args: { p_email: string }; Returns: boolean }
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
      doctor_book_consultation: {
        Args: {
          p_day: string
          p_key: string
          p_location: string
          p_location_version: number
          p_minute: number
          p_patient: string
          p_practice: string
          p_schedule_version: number
          p_type: string
          p_type_version: number
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
      doctor_clinical_command: {
        Args: {
          p_action: string
          p_encounter: string
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_clinical_detail: {
        Args: {
          p_encounter: string
          p_location: string
          p_page?: number
          p_practice: string
        }
        Returns: Json
      }
      doctor_clinical_export: {
        Args: {
          p_encounter: string
          p_key: string
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_clinical_release_delivery: {
        Args: {
          p_actor: string
          p_key?: string
          p_release: string
          p_session: string
          p_version: string
        }
        Returns: Json
      }
      doctor_clinical_released: { Args: { p_release: string }; Returns: Json }
      doctor_clinical_workspace: {
        Args: {
          p_location: string
          p_page?: number
          p_practice: string
          p_search?: string
        }
        Returns: Json
      }
      doctor_complete_onboarding: {
        Args: { p_draft_version: number; p_key: string }
        Returns: Json
      }
      doctor_consultation_availability: {
        Args: {
          p_appointment?: string
          p_day: string
          p_location: string
          p_practice: string
          p_type: string
          p_version: number
        }
        Returns: Json
      }
      doctor_consultation_types: {
        Args: { p_location: string; p_practice: string }
        Returns: Json
      }
      doctor_contact_command: {
        Args: {
          p_action: string
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_patient: string
          p_practice: string
          p_record: string
        }
        Returns: Json
      }
      doctor_contact_eligibility: {
        Args: {
          p_intent: Json
          p_location: string
          p_patient: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_contact_guardian_options: {
        Args: {
          p_location: string
          p_page: number
          p_patient: string
          p_practice: string
          p_search: string
        }
        Returns: Json
      }
      doctor_contact_history: {
        Args: {
          p_kind: string
          p_location: string
          p_page: number
          p_patient: string
          p_practice: string
          p_record: string
        }
        Returns: Json
      }
      doctor_contact_preferences: {
        Args: {
          p_contact_page: number
          p_guardian_page: number
          p_location: string
          p_patient: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_contexts: { Args: never; Returns: Json }
      doctor_create_saas_quote: {
        Args: {
          p_account_revision: number
          p_configuration_revision: number
          p_document_ref: string
          p_interval: string
          p_key: string
          p_terms: string
        }
        Returns: Json
      }
      doctor_deliver_payment_evidence: {
        Args: {
          p_actor: string
          p_evidence: string
          p_key?: string
          p_notice: string
          p_session: string
        }
        Returns: Json
      }
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
      doctor_finalize_payment_evidence: {
        Args: { p_actor: string; p_intent: string; p_session: string }
        Returns: Json
      }
      doctor_fulfillment_command: {
        Args: {
          p_action: string
          p_id: string
          p_input: Json
          p_key: string
          p_location: string
          p_patient: string
          p_practice: string
          p_version: number
        }
        Returns: Json
      }
      doctor_fulfillments: {
        Args: {
          p_location: string
          p_page: number
          p_patient: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_import_command: {
        Args: {
          p_action: string
          p_batch: string
          p_input: Json
          p_key: string
          p_location: string
          p_practice: string
          p_version: number
        }
        Returns: Json
      }
      doctor_import_preview: {
        Args: {
          p_batch: string
          p_location: string
          p_page: number
          p_practice: string
        }
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
      doctor_manual_payment_configuration: { Args: never; Returns: Json }
      doctor_manual_payment_reconciliation: {
        Args: {
          p_from?: string
          p_page?: number
          p_review_queue?: boolean
          p_status?: string
          p_until?: string
        }
        Returns: Json
      }
      doctor_manual_payments: {
        Args: { p_notice?: string; p_page?: number; p_review_queue?: boolean }
        Returns: Json
      }
      doctor_manual_review_capability: { Args: never; Returns: Json }
      doctor_onboard: {
        Args: {
          p_key: string
          p_location_name: string
          p_name: string
          p_timezone: string
        }
        Returns: Json
      }
      doctor_operational_report: {
        Args: {
          p_from: string
          p_kind: string
          p_location: string
          p_page: number
          p_practice: string
          p_to: string
        }
        Returns: Json
      }
      doctor_operations_status: { Args: never; Returns: Json }
      doctor_outbox: {
        Args: {
          p_location: string
          p_page: number
          p_patient: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_outbox_command: {
        Args: {
          p_action: string
          p_input: Json
          p_key: string
          p_location: string
          p_message: string
          p_patient: string
          p_practice: string
          p_version: number
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
      doctor_payment_evidence_access: {
        Args: { p_notice: string; p_write: boolean }
        Returns: Json
      }
      doctor_personal_account_audit: {
        Args: { p_page?: number; p_query?: string }
        Returns: Json
      }
      doctor_practice_setup: { Args: never; Returns: Json }
      doctor_prepare_manual_payment: {
        Args: {
          p_configuration_revision: number
          p_intent: string
          p_key: string
        }
        Returns: Json
      }
      doctor_prepare_saas_payment: {
        Args: { p_key: string; p_quote: string }
        Returns: Json
      }
      doctor_privacy_requests: { Args: never; Returns: Json }
      doctor_reception_command: {
        Args: {
          p_action: string
          p_appointment: string
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
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
      doctor_reserve_payment_evidence: {
        Args: {
          p_actor: string
          p_filename: string
          p_key: string
          p_mime: string
          p_notice: string
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
      doctor_review_manual_payment: {
        Args: {
          p_action: string
          p_currency: string
          p_independently_verified: boolean
          p_key: string
          p_notice: string
          p_reason: string
          p_received_at: string
          p_received_minor: string
          p_received_reference: string
          p_revision: number
          p_verification_ref: string
        }
        Returns: Json
      }
      doctor_runtime_contract: { Args: never; Returns: Json }
      doctor_saas_financial_status: {
        Args: { p_page?: number; p_size?: number }
        Returns: Json
      }
      doctor_saas_plan_catalog: { Args: never; Returns: Json }
      doctor_saas_quote: { Args: { p_quote: string }; Returns: Json }
      doctor_saas_status: { Args: never; Returns: Json }
      doctor_saas_terms: { Args: never; Returns: Json }
      doctor_saas_terms_document: { Args: { p_terms: string }; Returns: Json }
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
      doctor_start_saas_trial: {
        Args: {
          p_configuration_revision: number
          p_document_ref: string
          p_key: string
          p_terms: string
        }
        Returns: Json
      }
      doctor_submit_manual_payment: {
        Args: {
          p_configuration_revision: number
          p_intent: string
          p_key: string
          p_reference: string
          p_transferred_at: string
        }
        Returns: Json
      }
      doctor_submit_privacy_request: {
        Args: { p_key: string; p_kind: string }
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
      doctor_waitlist: {
        Args: {
          p_location: string
          p_page?: number
          p_practice: string
          p_search?: string
          p_state?: string
        }
        Returns: Json
      }
      doctor_waitlist_command: {
        Args: {
          p_action: string
          p_entry: string
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_waitlist_history: {
        Args: {
          p_entry: string
          p_location: string
          p_page?: number
          p_practice: string
        }
        Returns: Json
      }
      doctor_worklist: {
        Args: {
          p_location: string
          p_mine: boolean
          p_overdue: boolean
          p_page: number
          p_practice: string
          p_state: string
        }
        Returns: Json
      }
      doctor_worklist_command: {
        Args: {
          p_action: string
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_practice: string
          p_task: string
        }
        Returns: Json
      }
      doctor_worklist_history: {
        Args: {
          p_location: string
          p_page: number
          p_practice: string
          p_task: string
        }
        Returns: Json
      }
      doctor_worklist_options: {
        Args: { p_location: string; p_practice: string }
        Returns: Json
      }
      doctor_write_consultation_type: {
        Args: {
          p_expected_version: number
          p_input: Json
          p_key: string
          p_location: string
          p_practice: string
          p_type: string
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

