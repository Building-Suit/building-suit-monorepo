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
      activity_correlations: {
        Row: {
          created_at: string
          dispatch_id: string
          domain_audit_id: string | null
          target_audit_id: string | null
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          domain_audit_id?: string | null
          target_audit_id?: string | null
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          domain_audit_id?: string | null
          target_audit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_correlations_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: true
            referencedRelation: "adapter_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_remote_events: {
        Row: {
          action: string
          actor: string | null
          binding_id: string
          event_id: string
          observed_at: string
          occurred_at: string
          reason: string
          stream: string
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          binding_id: string
          event_id: string
          observed_at?: string
          occurred_at: string
          reason: string
          stream: string
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          binding_id?: string
          event_id?: string
          observed_at?: string
          occurred_at?: string
          reason?: string
          stream?: string
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_remote_events_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_remote_state: {
        Row: {
          binding_id: string
          last_failed_at: string | null
          last_observed_at: string | null
          next_page: number
          observed_total: number | null
          stream: string
        }
        Insert: {
          binding_id: string
          last_failed_at?: string | null
          last_observed_at?: string | null
          next_page?: number
          observed_total?: number | null
          stream: string
        }
        Update: {
          binding_id?: string
          last_failed_at?: string | null
          last_observed_at?: string | null
          next_page?: number
          observed_total?: number | null
          stream?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_remote_state_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
        ]
      }
      adapter_attempt_results: {
        Row: {
          attempt_id: string
          created_at: string
          outcome: string
          response_digest: string | null
          target_audit_id: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          outcome: string
          response_digest?: string | null
          target_audit_id?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          outcome?: string
          response_digest?: string | null
          target_audit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adapter_attempt_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "adapter_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      adapter_attempts: {
        Row: {
          configuration_versions: Json
          created_at: string
          dispatch_id: string
          expires_at: string
          id: string
          key_id: string
          nonce: string
          request_timestamp: number
          secret_reference_id: string
        }
        Insert: {
          configuration_versions: Json
          created_at?: string
          dispatch_id: string
          expires_at: string
          id?: string
          key_id: string
          nonce?: string
          request_timestamp: number
          secret_reference_id: string
        }
        Update: {
          configuration_versions?: Json
          created_at?: string
          dispatch_id?: string
          expires_at?: string
          id?: string
          key_id?: string
          nonce?: string
          request_timestamp?: number
          secret_reference_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adapter_attempts_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "adapter_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adapter_attempts_secret_reference_id_fkey"
            columns: ["secret_reference_id"]
            isOneToOne: false
            referencedRelation: "integration_secret_references"
            referencedColumns: ["id"]
          },
        ]
      }
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
      adapter_dispatches: {
        Row: {
          actor_user_id: string
          audience: string
          binding_id: string
          body: string
          body_digest: string
          config_versions: Json
          correlation_id: string
          created_at: string
          envelope: Json
          id: string
          request_id: string
        }
        Insert: {
          actor_user_id: string
          audience: string
          binding_id: string
          body: string
          body_digest: string
          config_versions: Json
          correlation_id: string
          created_at?: string
          envelope: Json
          id?: string
          request_id: string
        }
        Update: {
          actor_user_id?: string
          audience?: string
          binding_id?: string
          body?: string
          body_digest?: string
          config_versions?: Json
          correlation_id?: string
          created_at?: string
          envelope?: Json
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adapter_dispatches_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
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
      admin_live_invalidations: {
        Row: {
          authority_environment_id: string
          binding_id: string | null
          created_at: string
          delivered_at: string | null
          id: string
          kinds: string[]
          source_key: string
        }
        Insert: {
          authority_environment_id: string
          binding_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          kinds: string[]
          source_key: string
        }
        Update: {
          authority_environment_id?: string
          binding_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          kinds?: string[]
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_live_invalidations_authority_environment_id_fkey"
            columns: ["authority_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_live_invalidations_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
        ]
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
      custom_offer_dispatches: {
        Row: {
          action: string
          created_at: string
          dispatch_id: string
          offer_version_id: string
          request_id: string
        }
        Insert: {
          action: string
          created_at?: string
          dispatch_id: string
          offer_version_id: string
          request_id: string
        }
        Update: {
          action?: string
          created_at?: string
          dispatch_id?: string
          offer_version_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_offer_dispatches_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: true
            referencedRelation: "adapter_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_dispatches_offer_version_id_fkey"
            columns: ["offer_version_id"]
            isOneToOne: false
            referencedRelation: "custom_offer_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_offer_revocations: {
        Row: {
          correlation_id: string
          created_at: string
          creator_user_id: string
          offer_version_id: string
          reason: string
          request_fingerprint: string
          request_id: string
        }
        Insert: {
          correlation_id: string
          created_at?: string
          creator_user_id: string
          offer_version_id: string
          reason: string
          request_fingerprint: string
          request_id: string
        }
        Update: {
          correlation_id?: string
          created_at?: string
          creator_user_id?: string
          offer_version_id?: string
          reason?: string
          request_fingerprint?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_offer_revocations_offer_version_id_fkey"
            columns: ["offer_version_id"]
            isOneToOne: true
            referencedRelation: "custom_offer_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_offer_target_receipts: {
        Row: {
          created_at: string
          dispatch_id: string
          redemption_token: string | null
          state: string
          target_audit_id: string
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          redemption_token?: string | null
          state: string
          target_audit_id: string
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          redemption_token?: string | null
          state?: string
          target_audit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_offer_target_receipts_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: true
            referencedRelation: "custom_offer_dispatches"
            referencedColumns: ["dispatch_id"]
          },
        ]
      }
      custom_offer_versions: {
        Row: {
          authority_environment_id: string
          base_plan_id: string
          billing_interval: string
          binding_id: string
          company_id: string
          correlation_id: string
          created_at: string
          creator_user_id: string
          currency: string
          definition_id: string
          display_name: string
          entitlements: Json
          expires_at: string
          id: string
          price_amount: number
          reason: string
          recipient_user_id: string
          request_fingerprint: string
          request_id: string
          resource_limits: Json
          suit_id: string
          target_binding_id: string
          target_environment_id: string
          template_reference: string | null
          version: number
        }
        Insert: {
          authority_environment_id: string
          base_plan_id: string
          billing_interval: string
          binding_id: string
          company_id: string
          correlation_id: string
          created_at?: string
          creator_user_id: string
          currency: string
          definition_id: string
          display_name: string
          entitlements: Json
          expires_at: string
          id?: string
          price_amount: number
          reason: string
          recipient_user_id: string
          request_fingerprint: string
          request_id: string
          resource_limits: Json
          suit_id: string
          target_binding_id: string
          target_environment_id: string
          template_reference?: string | null
          version: number
        }
        Update: {
          authority_environment_id?: string
          base_plan_id?: string
          billing_interval?: string
          binding_id?: string
          company_id?: string
          correlation_id?: string
          created_at?: string
          creator_user_id?: string
          currency?: string
          definition_id?: string
          display_name?: string
          entitlements?: Json
          expires_at?: string
          id?: string
          price_amount?: number
          reason?: string
          recipient_user_id?: string
          request_fingerprint?: string
          request_id?: string
          resource_limits?: Json
          suit_id?: string
          target_binding_id?: string
          target_environment_id?: string
          template_reference?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_offer_versions_authority_environment_id_fkey"
            columns: ["authority_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_versions_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "suit_environment_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_versions_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: false
            referencedRelation: "suit_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_versions_target_environment_id_fkey"
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
      release_candidate_baseline: {
        Row: {
          production_sha: string | null
          singleton: boolean
        }
        Insert: {
          production_sha?: string | null
          singleton?: boolean
        }
        Update: {
          production_sha?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      release_candidate_pointer: {
        Row: {
          revision_key: string | null
          singleton: boolean
        }
        Insert: {
          revision_key?: string | null
          singleton?: boolean
        }
        Update: {
          revision_key?: string | null
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "release_candidate_pointer_revision_key_fkey"
            columns: ["revision_key"]
            isOneToOne: false
            referencedRelation: "release_candidate_revisions"
            referencedColumns: ["key"]
          },
        ]
      }
      release_candidate_preview: {
        Row: {
          revision_key: string | null
          singleton: boolean
        }
        Insert: {
          revision_key?: string | null
          singleton?: boolean
        }
        Update: {
          revision_key?: string | null
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "release_candidate_preview_revision_key_fkey"
            columns: ["revision_key"]
            isOneToOne: false
            referencedRelation: "release_candidate_revisions"
            referencedColumns: ["key"]
          },
        ]
      }
      release_candidate_promotions: {
        Row: {
          deployment_sha: string
          digest: string
          first_published_at: string
          manifest: Json
          revision_key: string
        }
        Insert: {
          deployment_sha: string
          digest: string
          first_published_at: string
          manifest: Json
          revision_key: string
        }
        Update: {
          deployment_sha?: string
          digest?: string
          first_published_at?: string
          manifest?: Json
          revision_key?: string
        }
        Relationships: []
      }
      release_candidate_revisions: {
        Row: {
          created_at: string
          digest: string
          key: string
          manifest: Json
          ready_at: string | null
          request: Json
        }
        Insert: {
          created_at?: string
          digest: string
          key: string
          manifest: Json
          ready_at?: string | null
          request: Json
        }
        Update: {
          created_at?: string
          digest?: string
          key?: string
          manifest?: Json
          ready_at?: string | null
          request?: Json
        }
        Relationships: []
      }
      release_candidate_versions: {
        Row: {
          evidence: string
          suit_id: string
          version: string
        }
        Insert: {
          evidence: string
          suit_id: string
          version: string
        }
        Update: {
          evidence?: string
          suit_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_candidate_versions_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: true
            referencedRelation: "suit_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      release_catalog_configuration: {
        Row: {
          anchor_sha: string
          authority_environment_id: string
          cursor_sha: string
          repository: string
          singleton: boolean
        }
        Insert: {
          anchor_sha: string
          authority_environment_id: string
          cursor_sha: string
          repository: string
          singleton?: boolean
        }
        Update: {
          anchor_sha?: string
          authority_environment_id?: string
          cursor_sha?: string
          repository?: string
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "release_catalog_configuration_authority_environment_id_fkey"
            columns: ["authority_environment_id"]
            isOneToOne: false
            referencedRelation: "admin_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      release_consumed_fragments: {
        Row: {
          fragment_digest: string
          fragment_id: string
          source_sha: string
        }
        Insert: {
          fragment_digest: string
          fragment_id: string
          source_sha: string
        }
        Update: {
          fragment_digest?: string
          fragment_id?: string
          source_sha?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_consumed_fragments_source_sha_fkey"
            columns: ["source_sha"]
            isOneToOne: false
            referencedRelation: "release_manifests"
            referencedColumns: ["source_sha"]
          },
        ]
      }
      release_manifests: {
        Row: {
          accepted_at: string
          deployment_sha: string | null
          digest: string
          first_published_at: string | null
          manifest: Json
          ordinal: number
          request: Json
          source_sha: string
        }
        Insert: {
          accepted_at?: string
          deployment_sha?: string | null
          digest: string
          first_published_at?: string | null
          manifest: Json
          ordinal?: never
          request: Json
          source_sha: string
        }
        Update: {
          accepted_at?: string
          deployment_sha?: string | null
          digest?: string
          first_published_at?: string | null
          manifest?: Json
          ordinal?: never
          request?: Json
          source_sha?: string
        }
        Relationships: []
      }
      release_version_heads: {
        Row: {
          baseline_evidence: string
          suit_id: string
          version: string
        }
        Insert: {
          baseline_evidence: string
          suit_id: string
          version: string
        }
        Update: {
          baseline_evidence?: string
          suit_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_version_heads_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: true
            referencedRelation: "suit_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      release_versions: {
        Row: {
          source_sha: string
          suit_id: string
          version: string
        }
        Insert: {
          source_sha: string
          suit_id: string
          version: string
        }
        Update: {
          source_sha?: string
          suit_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_versions_source_sha_fkey"
            columns: ["source_sha"]
            isOneToOne: false
            referencedRelation: "release_manifests"
            referencedColumns: ["source_sha"]
          },
          {
            foreignKeyName: "release_versions_suit_id_fkey"
            columns: ["suit_id"]
            isOneToOne: false
            referencedRelation: "suit_registry"
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
          sort_order: number
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
          sort_order?: number
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
          sort_order?: number
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
      release_candidate_acknowledge: {
        Args: { p_receipt: Json }
        Returns: undefined
      }
      release_candidate_promote: {
        Args: {
          p_deployment_sha: string
          p_main_parent: string
          p_main_tree: string
          p_release: Json
        }
        Returns: Json
      }
      release_candidate_ready: {
        Args: { p_digest: string; p_key: string }
        Returns: undefined
      }
      release_candidate_refresh: { Args: { p_snapshot: Json }; Returns: Json }
      release_candidate_state: { Args: never; Returns: Json }
      release_catalog_state: { Args: never; Returns: Json }
      release_public_feed: { Args: never; Returns: Json }
      release_publish: {
        Args: {
          p_deployment_sha: string
          p_environment: string
          p_ref: string
          p_releases: Json
        }
        Returns: Json
      }
      release_stage_accept: { Args: { p_request: Json }; Returns: Json }
      super_admin_activity_context: {
        Args: { p_binding: string; p_stream: string }
        Returns: Json
      }
      super_admin_activity_failure: {
        Args: { p_binding: string; p_stream: string }
        Returns: undefined
      }
      super_admin_activity_observe: {
        Args: { p_binding: string; p_projection: Json; p_request: string }
        Returns: undefined
      }
      super_admin_activity_read: { Args: { p_query: Json }; Returns: Json }
      super_admin_adapter_claim: {
        Args: { p_dispatch_id: string }
        Returns: Json
      }
      super_admin_adapter_complete: {
        Args: { p_attempt_id: string; p_response: Json }
        Returns: Json
      }
      super_admin_adapter_enqueue: { Args: { p_input: Json }; Returns: string }
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
      super_admin_custom_offer_command: {
        Args: { p_input: Json }
        Returns: Json
      }
      super_admin_custom_offers_read: {
        Args: { p_binding_id: string }
        Returns: Json
      }
      super_admin_live_flush: { Args: { p_limit?: number }; Returns: number }
      super_admin_live_topic: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
