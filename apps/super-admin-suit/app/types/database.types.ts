export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      adapter_capability_policy: {
        Row: {
          adapter_registration_id: string
          capability_key: string
          command_scopes: string[]
          created_at: string
          enabled: boolean
          id: string
          max_version: string
          min_version: string
          query_scopes: string[]
          updated_at: string
          version: number
        }
        Insert: {
          adapter_registration_id: string
          capability_key: string
          command_scopes?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          max_version: string
          min_version: string
          query_scopes?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          adapter_registration_id?: string
          capability_key?: string
          command_scopes?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          max_version?: string
          min_version?: string
          query_scopes?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "adapter_capability_policy_adapter_registration_id_fkey"
            columns: ["adapter_registration_id"]
            isOneToOne: false
            referencedRelation: "adapter_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      adapter_manifest_observations: {
        Row: {
          binding_id: string
          expires_at: string
          id: string
          manifest_digest: string
          manifest_revision: string
          observed_at: string
          protocol_versions: string[]
          verification_outcome: string
          verified_capabilities: Json
        }
        Insert: {
          binding_id: string
          expires_at: string
          id?: string
          manifest_digest: string
          manifest_revision: string
          observed_at?: string
          protocol_versions: string[]
          verification_outcome: string
          verified_capabilities: Json
        }
        Update: {
          binding_id?: string
          expires_at?: string
          id?: string
          manifest_digest?: string
          manifest_revision?: string
          observed_at?: string
          protocol_versions?: string[]
          verification_outcome?: string
          verified_capabilities?: Json
        }
        Relationships: [
          {
            foreignKeyName: "adapter_manifest_observations_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
        ]
      }
      adapter_registrations: {
        Row: {
          adapter_key: string
          binding_id: string
          created_at: string
          id: string
          manifest_max_age_seconds: number
          manifest_schema_version: string
          protocol_max_version: string
          protocol_min_version: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          adapter_key: string
          binding_id: string
          created_at?: string
          id?: string
          manifest_max_age_seconds: number
          manifest_schema_version: string
          protocol_max_version: string
          protocol_min_version: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          adapter_key?: string
          binding_id?: string
          created_at?: string
          id?: string
          manifest_max_age_seconds?: number
          manifest_schema_version?: string
          protocol_max_version?: string
          protocol_min_version?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "adapter_registrations_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: true
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_environments: {
        Row: {
          binding_fingerprint: string | null
          created_at: string
          display_name: Json
          environment_kind: string
          id: string
          stable_key: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          binding_fingerprint?: string | null
          created_at?: string
          display_name: Json
          environment_kind: string
          id?: string
          stable_key: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          binding_fingerprint?: string | null
          created_at?: string
          display_name?: Json
          environment_kind?: string
          id?: string
          stable_key?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      configuration_revisions: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          after_state: Json | null
          authority_environment_id: string
          before_state: Json | null
          correlation_id: string
          id: string
          occurred_at: string
          reason: string
          request_id: string
          resource_id: string
          resource_type: string
          resource_version: number
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          after_state?: Json | null
          authority_environment_id: string
          before_state?: Json | null
          correlation_id: string
          id?: string
          occurred_at?: string
          reason: string
          request_id: string
          resource_id: string
          resource_type: string
          resource_version: number
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          after_state?: Json | null
          authority_environment_id?: string
          before_state?: Json | null
          correlation_id?: string
          id?: string
          occurred_at?: string
          reason?: string
          request_id?: string
          resource_id?: string
          resource_type?: string
          resource_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "configuration_revisions_authority_environment_id_fkey"
            columns: ["authority_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      control_plane_events: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          after_state: Json | null
          authority_environment_id: string
          before_state: Json | null
          correlation_id: string
          id: string
          occurred_at: string
          reason: string
          request_fingerprint: string
          request_id: string
          result: Json
          safe_parameters: Json
          suit_id: string | null
          target_environment_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          after_state?: Json | null
          authority_environment_id: string
          before_state?: Json | null
          correlation_id: string
          id?: string
          occurred_at?: string
          reason: string
          request_fingerprint: string
          request_id: string
          result: Json
          safe_parameters?: Json
          suit_id?: string | null
          target_environment_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          after_state?: Json | null
          authority_environment_id?: string
          before_state?: Json | null
          correlation_id?: string
          id?: string
          occurred_at?: string
          reason?: string
          request_fingerprint?: string
          request_id?: string
          result?: Json
          safe_parameters?: Json
          suit_id?: string | null
          target_environment_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_plane_events_authority_environment_id_fkey"
            columns: ["authority_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_plane_events_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: false
            referencedRelation: "suit_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_plane_events_target_environment_id_fkey"
            columns: ["target_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_providers: {
        Row: {
          configuration_schema_version: string
          created_at: string
          display_name: Json
          id: string
          provider_kind: string
          stable_key: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          configuration_schema_version: string
          created_at?: string
          display_name: Json
          id?: string
          provider_kind: string
          stable_key: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          configuration_schema_version?: string
          created_at?: string
          display_name?: Json
          id?: string
          provider_kind?: string
          stable_key?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      integration_secret_references: {
        Row: {
          binding_id: string
          created_at: string
          id: string
          key_id: string
          key_version: number
          provider_id: string
          purpose: string
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          vault_secret_id: string
          version: number
        }
        Insert: {
          binding_id: string
          created_at?: string
          id?: string
          key_id: string
          key_version: number
          provider_id: string
          purpose: string
          status?: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
          vault_secret_id: string
          version?: number
        }
        Update: {
          binding_id?: string
          created_at?: string
          id?: string
          key_id?: string
          key_version?: number
          provider_id?: string
          purpose?: string
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vault_secret_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_secret_references_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_secret_references_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          binding_id: string | null
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          non_secret_value: Json
          provider_id: string
          schema_version: string
          setting_key: string
          status: string
          updated_at: string
          value_type: string
          version: number
        }
        Insert: {
          binding_id?: string | null
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          non_secret_value: Json
          provider_id: string
          schema_version: string
          setting_key: string
          status?: string
          updated_at?: string
          value_type: string
          version?: number
        }
        Update: {
          binding_id?: string | null
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          non_secret_value?: Json
          provider_id?: string
          schema_version?: string
          setting_key?: string
          status?: string
          updated_at?: string
          value_type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_items: {
        Row: {
          created_at: string
          description: Json
          enabled: boolean
          id: string
          label: Json
          module_kind: string
          required_capability_key: string | null
          required_capability_version: string | null
          route_descriptor: Json
          sort_order: number
          stable_key: string
          suit_id: string
          updated_at: string
          version: number
          visibility_policy: Json
        }
        Insert: {
          created_at?: string
          description?: Json
          enabled?: boolean
          id?: string
          label: Json
          module_kind: string
          required_capability_key?: string | null
          required_capability_version?: string | null
          route_descriptor: Json
          sort_order?: number
          stable_key: string
          suit_id: string
          updated_at?: string
          version?: number
          visibility_policy?: Json
        }
        Update: {
          created_at?: string
          description?: Json
          enabled?: boolean
          id?: string
          label?: Json
          module_kind?: string
          required_capability_key?: string | null
          required_capability_version?: string | null
          route_descriptor?: Json
          sort_order?: number
          stable_key?: string
          suit_id?: string
          updated_at?: string
          version?: number
          visibility_policy?: Json
        }
        Relationships: [
          {
            foreignKeyName: "navigation_items_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: false
            referencedRelation: "suit_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          authority_environment_id: string
          disabled_at: string | null
          enabled: boolean
          provisioned_at: string
          provisioned_by: string
          role: string
          user_id: string
        }
        Insert: {
          authority_environment_id: string
          disabled_at?: string | null
          enabled?: boolean
          provisioned_at?: string
          provisioned_by: string
          role?: string
          user_id: string
        }
        Update: {
          authority_environment_id?: string
          disabled_at?: string | null
          enabled?: boolean
          provisioned_at?: string
          provisioned_by?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_authority_environment_id_fkey"
            columns: ["authority_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      suit_environment_bindings: {
        Row: {
          adapter_base_url: string
          admin_environment_id: string
          audience: string
          created_at: string
          egress_policy: Json
          id: string
          status: string
          suit_id: string
          target_environment_id: string
          target_identity_fingerprint: string
          updated_at: string
          version: number
        }
        Insert: {
          adapter_base_url: string
          admin_environment_id: string
          audience: string
          created_at?: string
          egress_policy: Json
          id?: string
          status?: string
          suit_id: string
          target_environment_id: string
          target_identity_fingerprint: string
          updated_at?: string
          version?: number
        }
        Update: {
          adapter_base_url?: string
          admin_environment_id?: string
          audience?: string
          created_at?: string
          egress_policy?: Json
          id?: string
          status?: string
          suit_id?: string
          target_environment_id?: string
          target_identity_fingerprint?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "suit_environment_bindings_admin_environment_id_fkey"
            columns: ["admin_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suit_environment_bindings_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: false
            referencedRelation: "suit_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suit_environment_bindings_target_environment_id_fkey"
            columns: ["target_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      suit_registry: {
        Row: {
          adapter_contract_version: string
          asset_reference: string
          created_at: string
          description: Json
          display_name: Json
          id: string
          stable_key: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          adapter_contract_version: string
          asset_reference: string
          created_at?: string
          description?: Json
          display_name: Json
          id?: string
          stable_key: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          adapter_contract_version?: string
          asset_reference?: string
          created_at?: string
          description?: Json
          display_name?: Json
          id?: string
          stable_key?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      super_admin_configuration_command: {
        Args: {
          p_correlation_id: string
          p_expected_version: number
          p_payload: Json
          p_reason: string
          p_request_id: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: Json
      }
      super_admin_configuration_read: {
        Args: { p_id?: string; p_resource: string }
        Returns: Json
      }
      super_admin_session: { Args: never; Returns: Json }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

