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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      hq_can_receive_events: { Args: never; Returns: boolean }
      hq_company_snapshot: { Args: never; Returns: Json }
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
      hq_publish_company_plan: { Args: { p_document: Json }; Returns: Json }
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
