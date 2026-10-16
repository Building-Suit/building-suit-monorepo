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
      audit_events: {
        Row: {
          actor_user_id: string
          entity_id: string
          event_type: string
          happened_at: string
          id: number
          practice_id: string
        }
        Insert: {
          actor_user_id: string
          entity_id: string
          event_type: string
          happened_at?: string
          id?: never
          practice_id: string
        }
        Update: {
          actor_user_id?: string
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
          location_id: string
          membership_id: string
          practice_id: string
        }
        Insert: {
          location_id: string
          membership_id: string
          practice_id: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      doctor_archive_location: {
        Args: {
          p_expected_version: number
          p_key: string
          p_location: string
          p_practice: string
        }
        Returns: Json
      }
      doctor_complete_onboarding: {
        Args: { p_draft_version: number; p_key: string }
        Returns: Json
      }
      doctor_contexts: { Args: never; Returns: Json }
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
      doctor_practice_setup: { Args: never; Returns: Json }
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
      doctor_session_context: { Args: never; Returns: Json }
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

