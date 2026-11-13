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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      hq_agent_conversations: {
        Row: {
          created_at: string
          founder_user_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          founder_user_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          founder_user_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_agent_jobs: {
        Row: {
          agent_id: string
          artifact_id: string | null
          attempt: number
          completed_at: string | null
          conversation_id: string
          created_at: string
          depends_on: string | null
          error: string | null
          founder_message_id: string
          founder_user_id: string
          id: string
          kind: string
          lease_expires_at: string | null
          lease_token: string | null
          lesson_id: string | null
          recovery_count: number
          recovery_of: string | null
          request_key: string
          result_digest: string | null
          result_text: string | null
          started_at: string | null
          status: string
          task_id: string | null
          worker_id: string | null
        }
        Insert: {
          agent_id: string
          artifact_id?: string | null
          attempt?: number
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          depends_on?: string | null
          error?: string | null
          founder_message_id: string
          founder_user_id: string
          id?: string
          kind?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          lesson_id?: string | null
          recovery_count?: number
          recovery_of?: string | null
          request_key: string
          result_digest?: string | null
          result_text?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          worker_id?: string | null
        }
        Update: {
          agent_id?: string
          artifact_id?: string | null
          attempt?: number
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          depends_on?: string | null
          error?: string | null
          founder_message_id?: string
          founder_user_id?: string
          id?: string
          kind?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          lesson_id?: string | null
          recovery_count?: number
          recovery_of?: string | null
          request_key?: string
          result_digest?: string | null
          result_text?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_agent_jobs_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "hq_task_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_jobs_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "hq_agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_jobs_founder_message_id_fkey"
            columns: ["founder_message_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_jobs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hq_business_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_chat_recovery_source_fk"
            columns: [
              "recovery_of",
              "conversation_id",
              "founder_message_id",
              "founder_user_id",
              "agent_id",
              "kind",
            ]
            isOneToOne: false
            referencedRelation: "hq_agent_jobs"
            referencedColumns: [
              "id",
              "conversation_id",
              "founder_message_id",
              "founder_user_id",
              "agent_id",
              "kind",
            ]
          },
        ]
      }
      hq_agent_lessons: {
        Row: {
          agent_id: string
          body: string
          content_digest: string
          created_at: string
          digest: string
          founder_user_id: string
          id: string
          publication_digest: string | null
          publication_reference: string | null
          published_at: string | null
          reviewed_at: string | null
          reviewed_by_job_id: string | null
          source_digest: string
          source_id: string
          source_type: string
          status: string
          summary: string
        }
        Insert: {
          agent_id: string
          body: string
          content_digest: string
          created_at?: string
          digest: string
          founder_user_id: string
          id?: string
          publication_digest?: string | null
          publication_reference?: string | null
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by_job_id?: string | null
          source_digest: string
          source_id: string
          source_type: string
          status?: string
          summary: string
        }
        Update: {
          agent_id?: string
          body?: string
          content_digest?: string
          created_at?: string
          digest?: string
          founder_user_id?: string
          id?: string
          publication_digest?: string | null
          publication_reference?: string | null
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by_job_id?: string | null
          source_digest?: string
          source_id?: string
          source_type?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_agent_lessons_reviewed_by_job_id_fkey"
            columns: ["reviewed_by_job_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_agent_messages: {
        Row: {
          agent_id: string
          conversation_id: string
          created_at: string
          id: string
          job_id: string | null
          kind: string
          mention_ids: string[]
          reply_to: string | null
          role: string
          task_id: string | null
          text: string
        }
        Insert: {
          agent_id: string
          conversation_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          mention_ids?: string[]
          reply_to?: string | null
          role: string
          task_id?: string | null
          text: string
        }
        Update: {
          agent_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          mention_ids?: string[]
          reply_to?: string | null
          role?: string
          task_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "hq_agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "hq_agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_agent_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hq_business_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_business_tasks: {
        Row: {
          acceptance: string
          assignee_id: string | null
          brief: string
          completed_at: string | null
          conversation_id: string
          created_at: string
          deliverable: string | null
          error: string | null
          founder_message_id: string
          founder_user_id: string
          id: string
          repair_count: number
          request_key: string
          requested_assignee_id: string | null
          review_summary: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acceptance: string
          assignee_id?: string | null
          brief: string
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          deliverable?: string | null
          error?: string | null
          founder_message_id: string
          founder_user_id: string
          id?: string
          repair_count?: number
          request_key: string
          requested_assignee_id?: string | null
          review_summary?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acceptance?: string
          assignee_id?: string | null
          brief?: string
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          deliverable?: string | null
          error?: string | null
          founder_message_id?: string
          founder_user_id?: string
          id?: string
          repair_count?: number
          request_key?: string
          requested_assignee_id?: string | null
          review_summary?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_business_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_business_tasks_founder_message_id_fkey"
            columns: ["founder_message_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_company_plans: {
        Row: {
          approved_at: string | null
          created_at: string
          document: Json
          id: string
          legacy: boolean
          legacy_approved_on: string | null
          proposal_key: string
          revision: number
          source_evidence: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          document: Json
          id: string
          legacy?: boolean
          legacy_approved_on?: string | null
          proposal_key: string
          revision: number
          source_evidence?: Json | null
          status: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          document?: Json
          id?: string
          legacy?: boolean
          legacy_approved_on?: string | null
          proposal_key?: string
          revision?: number
          source_evidence?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_departments: {
        Row: {
          approved_at: string | null
          department_key: string
          id: string
          legacy_approved_on: string | null
          name: string
          name_ar: string | null
          plan_id: string
        }
        Insert: {
          approved_at?: string | null
          department_key: string
          id: string
          legacy_approved_on?: string | null
          name: string
          name_ar?: string | null
          plan_id: string
        }
        Update: {
          approved_at?: string | null
          department_key?: string
          id?: string
          legacy_approved_on?: string | null
          name?: string
          name_ar?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_departments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hq_company_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_founders: {
        Row: {
          bound_at: string
          invitation_id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          bound_at?: string
          invitation_id: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          bound_at?: string
          invitation_id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hq_meeting_contributions: {
        Row: {
          agent_id: string
          binding_digest: string
          business_task_id: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          founder_message_id: string | null
          generation: number
          id: string
          job_id: string | null
          meeting_id: string
          request_key: string
          response_artifact_id: string | null
          response_digest: string | null
          response_message_id: string | null
          response_text: string | null
          source_event_id: number
          source_kind: string
          status: string
        }
        Insert: {
          agent_id: string
          binding_digest: string
          business_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          founder_message_id?: string | null
          generation: number
          id?: string
          job_id?: string | null
          meeting_id: string
          request_key: string
          response_artifact_id?: string | null
          response_digest?: string | null
          response_message_id?: string | null
          response_text?: string | null
          source_event_id: number
          source_kind: string
          status: string
        }
        Update: {
          agent_id?: string
          binding_digest?: string
          business_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          founder_message_id?: string | null
          generation?: number
          id?: string
          job_id?: string | null
          meeting_id?: string
          request_key?: string
          response_artifact_id?: string | null
          response_digest?: string | null
          response_message_id?: string | null
          response_text?: string | null
          source_event_id?: number
          source_kind?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_meeting_contributions_business_task_id_fkey"
            columns: ["business_task_id"]
            isOneToOne: false
            referencedRelation: "hq_business_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_contributions_founder_message_id_fkey"
            columns: ["founder_message_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_contributions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "hq_agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_contributions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "hq_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_contributions_response_artifact_id_fkey"
            columns: ["response_artifact_id"]
            isOneToOne: false
            referencedRelation: "hq_task_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_contributions_response_message_id_fkey"
            columns: ["response_message_id"]
            isOneToOne: false
            referencedRelation: "hq_agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_contributions_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "hq_meeting_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_meeting_events: {
        Row: {
          actor_id: string
          created_at: string
          id: number
          kind: string
          meeting_id: string
          payload: Json
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: never
          kind: string
          meeting_id: string
          payload: Json
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: never
          kind?: string
          meeting_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hq_meeting_events_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "hq_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_meeting_plan_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_session: string | null
          created_at: string
          digest: string
          document: Json
          meeting_id: string
          plan_id: string
          start_policy: string | null
          status: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_session?: string | null
          created_at?: string
          digest: string
          document: Json
          meeting_id: string
          plan_id: string
          start_policy?: string | null
          status: string
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_session?: string | null
          created_at?: string
          digest?: string
          document?: Json
          meeting_id?: string
          plan_id?: string
          start_policy?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_meeting_plan_versions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "hq_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_meeting_task_links: {
        Row: {
          business_task_id: string
          created_at: string
          instruction: Json
          meeting_id: string
          plan_id: string | null
          plan_version: number | null
          reported_at: string | null
          request_key: string
          task_key: string
          task_kind: string
        }
        Insert: {
          business_task_id: string
          created_at?: string
          instruction: Json
          meeting_id: string
          plan_id?: string | null
          plan_version?: number | null
          reported_at?: string | null
          request_key: string
          task_key: string
          task_kind: string
        }
        Update: {
          business_task_id?: string
          created_at?: string
          instruction?: Json
          meeting_id?: string
          plan_id?: string | null
          plan_version?: number | null
          reported_at?: string | null
          request_key?: string
          task_key?: string
          task_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_meeting_task_links_business_task_id_fkey"
            columns: ["business_task_id"]
            isOneToOne: true
            referencedRelation: "hq_business_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_task_links_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "hq_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_meeting_task_links_meeting_id_plan_id_plan_version_fkey"
            columns: ["meeting_id", "plan_id", "plan_version"]
            isOneToOne: false
            referencedRelation: "hq_meeting_plan_versions"
            referencedColumns: ["meeting_id", "plan_id", "version"]
          },
        ]
      }
      hq_meetings: {
        Row: {
          connection: string
          created_at: string
          disconnect_policy: string
          ended_at: string | null
          floor: string | null
          founder_id: string
          generation: number
          id: string
          language: string
          participants: string[]
          paused: boolean
          projection_digest: string | null
          revision: number
          status: string
          title: string
        }
        Insert: {
          connection?: string
          created_at?: string
          disconnect_policy?: string
          ended_at?: string | null
          floor?: string | null
          founder_id: string
          generation?: number
          id: string
          language: string
          participants: string[]
          paused?: boolean
          projection_digest?: string | null
          revision?: number
          status?: string
          title: string
        }
        Update: {
          connection?: string
          created_at?: string
          disconnect_policy?: string
          ended_at?: string | null
          floor?: string | null
          founder_id?: string
          generation?: number
          id?: string
          language?: string
          participants?: string[]
          paused?: boolean
          projection_digest?: string | null
          revision?: number
          status?: string
          title?: string
        }
        Relationships: []
      }
      hq_plan_decisions: {
        Row: {
          actor_user_id: string
          decided_at: string
          decision: string
          document: Json
          id: string
          plan_id: string
          plan_revision: number
          request_key: string
          session_id: string
        }
        Insert: {
          actor_user_id: string
          decided_at?: string
          decision: string
          document: Json
          id?: string
          plan_id: string
          plan_revision: number
          request_key: string
          session_id: string
        }
        Update: {
          actor_user_id?: string
          decided_at?: string
          decision?: string
          document?: Json
          id?: string
          plan_id?: string
          plan_revision?: number
          request_key?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_plan_decisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "hq_company_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_task_artifacts: {
        Row: {
          agent_id: string
          created_at: string
          digest: string
          id: string
          input_artifact_id: string | null
          job_id: string
          kind: string
          task_id: string | null
          text: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          digest: string
          id?: string
          input_artifact_id?: string | null
          job_id: string
          kind: string
          task_id?: string | null
          text: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          digest?: string
          id?: string
          input_artifact_id?: string | null
          job_id?: string
          kind?: string
          task_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_task_artifacts_input_artifact_id_fkey"
            columns: ["input_artifact_id"]
            isOneToOne: false
            referencedRelation: "hq_task_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_task_artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "hq_agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_task_artifacts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hq_business_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hq_agent_snapshot: { Args: never; Returns: Json }
      hq_brain_authorize_worker: {
        Args: { p_token_hash: string }
        Returns: boolean
      }
      hq_brain_bind_manifest: {
        Args: { p_proposal_key: string; p_source_id: string }
        Returns: Json
      }
      hq_brain_channel_confirm: {
        Args: {
          p_channel_id: string
          p_expires_at: string
          p_resource_id: string
        }
        Returns: Json
      }
      hq_brain_channel_prepare: {
        Args: {
          p_channel_id: string
          p_expires_at: string
          p_token_hash: string
        }
        Returns: Json
      }
      hq_brain_dispatch_recover: { Args: never; Returns: Json }
      hq_brain_notify: {
        Args: {
          p_channel_id: string
          p_resource_id: string
          p_token_hash: string
        }
        Returns: boolean
      }
      hq_brain_publish_plan: {
        Args: {
          p_digest: string
          p_document: Json
          p_proposal_key: string
          p_source_id: string
          p_source_version: string
        }
        Returns: Json
      }
      hq_brain_sync_claim: { Args: { p_owner: string }; Returns: Json }
      hq_brain_sync_commit: {
        Args: {
          p_complete: boolean
          p_cursor: string
          p_files: Json
          p_generation: number
          p_owner: string
        }
        Returns: Json
      }
      hq_brain_sync_fail: {
        Args: { p_owner: string; p_reason: string }
        Returns: Json
      }
      hq_brain_sync_status: { Args: never; Returns: Json }
      hq_can_receive_agent_jobs: { Args: never; Returns: boolean }
      hq_can_receive_events: { Args: never; Returns: boolean }
      hq_cancel_task: { Args: { p_task_id: string }; Returns: Json }
      hq_company_snapshot: { Args: never; Returns: Json }
      hq_create_task: {
        Args: {
          p_acceptance: string
          p_assignee_id: string
          p_brief: string
          p_request_key: string
          p_title: string
        }
        Returns: Json
      }
      hq_decide_company_plan: {
        Args: {
          p_decision: string
          p_plan_id: string
          p_request_key: string
          p_revision: number
        }
        Returns: Json
      }
      hq_founder_access: { Args: never; Returns: Json }
      hq_live_flush: { Args: { p_limit?: number }; Returns: number }
      hq_meeting_command: {
        Args: { p_command: Json; p_meeting_id: string; p_request_key: string }
        Returns: Json
      }
      hq_meeting_create: {
        Args: {
          p_id: string
          p_language: string
          p_participants: string[]
          p_request_key: string
          p_title: string
        }
        Returns: Json
      }
      hq_meeting_roster: { Args: never; Returns: Json }
      hq_meeting_snapshot: { Args: { p_meeting_id: string }; Returns: Json }
      hq_office_observations: { Args: never; Returns: Json }
      hq_publish_company_plan: { Args: { p_document: Json }; Returns: Json }
      hq_send_ceo_message: {
        Args: { p_prompt: string; p_request_key: string }
        Returns: Json
      }
      hq_worker_claim:
        | {
            Args: { p_lease_seconds: number; p_worker_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_lease_seconds: number
              p_meeting_protocol: number
              p_worker_id: string
            }
            Returns: Json
          }
      hq_worker_parallel_claim: {
        Args: { p_lease_seconds: number; p_meeting_protocol: number; p_worker_id: string }
        Returns: Json
      }
      hq_worker_finish: {
        Args: {
          p_error: string
          p_job_id: string
          p_lease_token: string
          p_reply: string
          p_worker_id: string
        }
        Returns: Json
      }
      hq_worker_finish_v2: {
        Args: {
          p_error: string
          p_evidence: Json
          p_job_id: string
          p_lease_token: string
          p_reply: string
          p_worker_id: string
        }
        Returns: Json
      }
      hq_worker_heartbeat: {
        Args: {
          p_job_id: string
          p_lease_token: string
          p_status: string
          p_worker_id: string
        }
        Returns: Json
      }
      hq_worker_pending_lessons: {
        Args: { p_worker_id: string }
        Returns: Json
      }
      hq_worker_presence: { Args: { p_worker_id: string }; Returns: Json }
      hq_worker_publish_lesson: {
        Args: {
          p_digest: string
          p_lesson_id: string
          p_reference: string
          p_worker_id: string
        }
        Returns: Json
      }
      hq_worker_roster_sources: { Args: { p_worker_id: string }; Returns: Json }
      hq_worker_skill_context: {
        Args: {
          p_job_id: string
          p_lease_token: string
          p_skill_ids: Json
          p_worker_id: string
        }
        Returns: Json
      }
      hq_worker_sync_roster: {
        Args: { p_agents: Json; p_worker_id: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
