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
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by_profile_id: string | null
          created_at: string
          id: string
          is_closed: boolean
          period_end: string
          period_start: string
          shop_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_profile_id?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          period_end: string
          period_start: string
          shop_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by_profile_id?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          period_end?: string
          period_start?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_closed_by_profile_id_fkey"
            columns: ["closed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_commands: {
        Row: {
          actor_profile_id: string
          appointment_id: string | null
          created_at: string
          operation: string
          payload_hash: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          appointment_id?: string | null
          created_at?: string
          operation: string
          payload_hash: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          appointment_id?: string | null
          created_at?: string
          operation?: string
          payload_hash?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_commands_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_commands_appointment_id_shop_id_fkey"
            columns: ["appointment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointment_commands_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_events: {
        Row: {
          action: string
          actor_profile_id: string
          after_state: Json
          appointment_id: string
          before_state: Json | null
          id: string
          occurred_at: string
          request_id: string | null
          shop_id: string
        }
        Insert: {
          action: string
          actor_profile_id: string
          after_state: Json
          appointment_id: string
          before_state?: Json | null
          id?: string
          occurred_at?: string
          request_id?: string | null
          shop_id: string
        }
        Update: {
          action?: string
          actor_profile_id?: string
          after_state?: Json
          appointment_id?: string
          before_state?: Json | null
          id?: string
          occurred_at?: string
          request_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_appointment_id_shop_id_fkey"
            columns: ["appointment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointment_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_schedule_blocks: {
        Row: {
          created_at: string
          created_by_profile_id: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_block_kind"]
          location_id: string
          membership_id: string
          note: string | null
          shop_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          ends_at: string
          id?: string
          kind: Database["public"]["Enums"]["appointment_block_kind"]
          location_id: string
          membership_id: string
          note?: string | null
          shop_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_block_kind"]
          location_id?: string
          membership_id?: string
          note?: string | null
          shop_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_schedule_blocks_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_schedule_blocks_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointment_schedule_blocks_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      appointment_schedule_events: {
        Row: {
          actor_profile_id: string
          after_state: Json
          before_state: Json
          id: string
          location_id: string
          membership_id: string
          occurred_at: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          after_state: Json
          before_state: Json
          id?: string
          location_id: string
          membership_id: string
          occurred_at?: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          after_state?: Json
          before_state?: Json
          id?: string
          location_id?: string
          membership_id?: string
          occurred_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_schedule_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_schedule_events_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointment_schedule_events_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointment_schedule_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_working_hours: {
        Row: {
          created_at: string
          ends_local: string
          location_id: string
          membership_id: string
          shop_id: string
          starts_local: string
          timezone: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_local: string
          location_id: string
          membership_id: string
          shop_id: string
          starts_local: string
          timezone?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_local?: string
          location_id?: string
          membership_id?: string
          shop_id?: string
          starts_local?: string
          timezone?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_working_hours_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointment_working_hours_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_membership_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by_profile_id: string
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          ends_at: string
          id: string
          identity_kind: Database["public"]["Enums"]["appointment_identity_kind"]
          location_id: string
          no_show_at: string | null
          notes: string | null
          sale_id: string | null
          service_id: string | null
          shop_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          walk_in_name: string | null
          walk_in_phone: string | null
        }
        Insert: {
          assigned_membership_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_profile_id: string
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          ends_at: string
          id?: string
          identity_kind?: Database["public"]["Enums"]["appointment_identity_kind"]
          location_id: string
          no_show_at?: string | null
          notes?: string | null
          sale_id?: string | null
          service_id?: string | null
          shop_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          walk_in_name?: string | null
          walk_in_phone?: string | null
        }
        Update: {
          assigned_membership_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_profile_id?: string
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          ends_at?: string
          id?: string
          identity_kind?: Database["public"]["Enums"]["appointment_identity_kind"]
          location_id?: string
          no_show_at?: string | null
          notes?: string | null
          sale_id?: string | null
          service_id?: string | null
          shop_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          walk_in_name?: string | null
          walk_in_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_membership_id_shop_id_fkey"
            columns: ["assigned_membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointments_client_id_shop_id_fkey"
            columns: ["client_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id", "shop_id"]
          },
          {
            foreignKeyName: "appointments_client_id_shop_id_fkey"
            columns: ["client_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointments_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "appointments_sale_location_fk"
            columns: ["sale_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "appointments_service_id_shop_id_fkey"
            columns: ["service_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      cash_drawer_events: {
        Row: {
          actor_membership_id: string
          amount: number
          created_at: string
          event_kind: string
          id: string
          location_id: string
          occurred_at: string
          payment_id: string | null
          reason: string | null
          reference: string | null
          request_id: string | null
          session_id: string
          shop_id: string
        }
        Insert: {
          actor_membership_id: string
          amount: number
          created_at?: string
          event_kind: string
          id?: string
          location_id: string
          occurred_at?: string
          payment_id?: string | null
          reason?: string | null
          reference?: string | null
          request_id?: string | null
          session_id: string
          shop_id: string
        }
        Update: {
          actor_membership_id?: string
          amount?: number
          created_at?: string
          event_kind?: string
          id?: string
          location_id?: string
          occurred_at?: string
          payment_id?: string | null
          reason?: string | null
          reference?: string | null
          request_id?: string | null
          session_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawer_events_actor_membership_id_shop_id_fkey"
            columns: ["actor_membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "cash_drawer_events_payment_id_shop_id_location_id_fkey"
            columns: ["payment_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "cash_drawer_events_session_id_shop_id_location_id_fkey"
            columns: ["session_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by_membership_id: string | null
          closing_amount: number | null
          closing_notes: string | null
          created_at: string
          expected_amount: number | null
          id: string
          location_id: string
          notes: string | null
          opened_at: string
          opened_by_membership_id: string
          opening_amount: number
          register_key: string
          shop_id: string
          status: Database["public"]["Enums"]["cash_session_status"]
          variance_amount: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by_membership_id?: string | null
          closing_amount?: number | null
          closing_notes?: string | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          location_id: string
          notes?: string | null
          opened_at?: string
          opened_by_membership_id: string
          opening_amount: number
          register_key?: string
          shop_id: string
          status?: Database["public"]["Enums"]["cash_session_status"]
          variance_amount?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by_membership_id?: string | null
          closing_amount?: number | null
          closing_notes?: string | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          location_id?: string
          notes?: string | null
          opened_at?: string
          opened_by_membership_id?: string
          opening_amount?: number
          register_key?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["cash_session_status"]
          variance_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_membership_id_shop_id_fkey"
            columns: ["closed_by_membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "cash_sessions_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_membership_id_shop_id_fkey"
            columns: ["opened_by_membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      cash_shift_requests: {
        Row: {
          actor_profile_id: string
          completed_at: string | null
          created_at: string
          operation: string
          payload_hash: string
          request_id: string
          result_id: string | null
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          completed_at?: string | null
          created_at?: string
          operation: string
          payload_hash: string
          request_id: string
          result_id?: string | null
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          completed_at?: string | null
          created_at?: string
          operation?: string
          payload_hash?: string
          request_id?: string
          result_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_shift_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shift_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          created_at: string
          created_by_profile_id: string
          id: string
          is_active: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_import_requests: {
        Row: {
          created_at: string
          created_by_profile_id: string
          import_kind: string
          payload_hash: string
          request_id: string
          result: Json
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          import_kind: string
          payload_hash: string
          request_id: string
          result: Json
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          import_kind?: string
          payload_hash?: string
          request_id?: string
          result?: Json
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_requests_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          archived_at: string | null
          archived_by_profile_id: string | null
          created_at: string
          created_by_profile_id: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          archived_by_profile_id?: string | null
          created_at?: string
          created_by_profile_id: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          archived_by_profile_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_archived_by_profile_id_fkey"
            columns: ["archived_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_events: {
        Row: {
          actor_profile_id: string | null
          amount: number
          created_at: string
          cumulative_fraction: number
          event_key: string
          id: string
          kind: string
          reason: string
          snapshot_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          amount: number
          created_at?: string
          cumulative_fraction?: number
          event_key: string
          id?: string
          kind: string
          reason: string
          snapshot_id: string
        }
        Update: {
          actor_profile_id?: string | null
          amount?: number
          created_at?: string
          cumulative_fraction?: number
          event_key?: string
          id?: string
          kind?: string
          reason?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "commission_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_line_assignments: {
        Row: {
          actor_profile_id: string
          appointment_id: string | null
          created_at: string
          line_id: string
          membership_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          appointment_id?: string | null
          created_at?: string
          line_id: string
          membership_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          appointment_id?: string | null
          created_at?: string
          line_id?: string
          membership_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_line_assignments_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_line_assignments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_line_assignments_appointment_id_shop_id_fkey"
            columns: ["appointment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_line_assignments_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_line_assignments_line_id_shop_id_fkey"
            columns: ["line_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_line_assignments_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_line_assignments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_policy_versions: {
        Row: {
          actor_profile_id: string
          created_at: string
          id: string
          policy: Json
          reason: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          id?: string
          policy: Json
          reason: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          id?: string
          policy?: Json
          reason?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_policy_versions_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_policy_versions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_snapshots: {
        Row: {
          appointment_id: string | null
          created_at: string
          currency: string
          employee_name: string | null
          employee_profile_id: string
          id: string
          invoice_id: string
          item_type: string
          line_id: string
          membership_id: string
          net_line_amount: number
          original_commission: number
          policy_version: string
          policy_version_id: string
          quantity: number
          rate: number
          rate_type: string
          shop_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          currency: string
          employee_name?: string | null
          employee_profile_id: string
          id?: string
          invoice_id: string
          item_type: string
          line_id: string
          membership_id: string
          net_line_amount: number
          original_commission: number
          policy_version?: string
          policy_version_id: string
          quantity: number
          rate: number
          rate_type: string
          shop_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          currency?: string
          employee_name?: string | null
          employee_profile_id?: string
          id?: string
          invoice_id?: string
          item_type?: string
          line_id?: string
          membership_id?: string
          net_line_amount?: number
          original_commission?: number
          policy_version?: string
          policy_version_id?: string
          quantity?: number
          rate?: number
          rate_type?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_snapshots_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_appointment_id_shop_id_fkey"
            columns: ["appointment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_snapshots_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "commission_snapshots_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "commission_snapshots_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_snapshots_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_line_id_shop_id_invoice_id_fkey"
            columns: ["line_id", "shop_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id", "shop_id", "invoice_id"]
          },
          {
            foreignKeyName: "commission_snapshots_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_snapshots_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "commission_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_policy_version_id_shop_id_fkey"
            columns: ["policy_version_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "commission_policy_versions"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "commission_snapshots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_adjustments: {
        Row: {
          adjustment_group_id: string
          amount: number
          created_at: string
          created_by_profile_id: string
          effective_at: string
          id: string
          kind: Database["public"]["Enums"]["payment_adjustment_kind"]
          location_id: string
          original_allocation_id: string
          original_payment_id: string
          reason: string
          reference: string | null
          refund_payment_id: string | null
          sale_correction_id: string | null
          shop_id: string
        }
        Insert: {
          adjustment_group_id: string
          amount: number
          created_at?: string
          created_by_profile_id: string
          effective_at: string
          id?: string
          kind: Database["public"]["Enums"]["payment_adjustment_kind"]
          location_id: string
          original_allocation_id: string
          original_payment_id: string
          reason: string
          reference?: string | null
          refund_payment_id?: string | null
          sale_correction_id?: string | null
          shop_id: string
        }
        Update: {
          adjustment_group_id?: string
          amount?: number
          created_at?: string
          created_by_profile_id?: string
          effective_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_adjustment_kind"]
          location_id?: string
          original_allocation_id?: string
          original_payment_id?: string
          reason?: string
          reference?: string | null
          refund_payment_id?: string | null
          sale_correction_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_adjustments_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_original_allocation_id_shop_i_fkey"
            columns: [
              "original_allocation_id",
              "shop_id",
              "original_payment_id",
            ]
            isOneToOne: false
            referencedRelation: "customer_payment_allocations"
            referencedColumns: ["id", "shop_id", "payment_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_original_location_fk"
            columns: ["original_payment_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_original_payment_id_shop_id_fkey"
            columns: ["original_payment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_refund_location_fk"
            columns: ["refund_payment_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_refund_payment_id_shop_id_fkey"
            columns: ["refund_payment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_sale_correction_fk"
            columns: ["sale_correction_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "sale_corrections"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "customer_payment_adjustments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          location_id: string
          payment_id: string
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          location_id: string
          payment_id: string
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          location_id?: string
          payment_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_allocations_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_invoice_location_fk"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_id_shop_id_fkey"
            columns: ["payment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_location_fk"
            columns: ["payment_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "customer_payment_allocations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_requests: {
        Row: {
          actor_profile_id: string
          completed_at: string | null
          created_at: string
          operation: string
          payload_hash: string
          request_id: string
          result_id: string | null
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          completed_at?: string | null
          created_at?: string
          operation: string
          payload_hash: string
          request_id: string
          result_id?: string | null
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          completed_at?: string | null
          created_at?: string
          operation?: string
          payload_hash?: string
          request_id?: string
          result_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payment_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_audit_events: {
        Row: {
          created_at: string
          error_code: string | null
          from_state: string | null
          id: number
          outbox_id: string
          to_state: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          from_state?: string | null
          id?: never
          outbox_id: string
          to_state: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          from_state?: string | null
          id?: never
          outbox_id?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "eta_audit_events_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "eta_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_outbox: {
        Row: {
          adapter_version: string
          attempts: number
          channel: string
          created_at: string
          created_by_profile_id: string | null
          device_serial: string | null
          document_uuid: string | null
          error_code: string | null
          id: string
          invoice_id: string
          lease_id: string | null
          lease_until: string | null
          location_id: string
          next_attempt_at: string
          payload: string | null
          payload_hash: string | null
          profile_version_id: string
          request_id: string
          shop_id: string
          signing_certificate_fingerprint: string | null
          source: Json
          state: string
          submission_uuid: string | null
          updated_at: string
        }
        Insert: {
          adapter_version?: string
          attempts?: number
          channel?: string
          created_at?: string
          created_by_profile_id?: string | null
          device_serial?: string | null
          document_uuid?: string | null
          error_code?: string | null
          id?: string
          invoice_id: string
          lease_id?: string | null
          lease_until?: string | null
          location_id: string
          next_attempt_at?: string
          payload?: string | null
          payload_hash?: string | null
          profile_version_id: string
          request_id: string
          shop_id: string
          signing_certificate_fingerprint?: string | null
          source: Json
          state?: string
          submission_uuid?: string | null
          updated_at?: string
        }
        Update: {
          adapter_version?: string
          attempts?: number
          channel?: string
          created_at?: string
          created_by_profile_id?: string | null
          device_serial?: string | null
          document_uuid?: string | null
          error_code?: string | null
          id?: string
          invoice_id?: string
          lease_id?: string | null
          lease_until?: string | null
          location_id?: string
          next_attempt_at?: string
          payload?: string | null
          payload_hash?: string | null
          profile_version_id?: string
          request_id?: string
          shop_id?: string
          signing_certificate_fingerprint?: string | null
          source?: Json
          state?: string
          submission_uuid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eta_outbox_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eta_outbox_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "eta_outbox_profile_version_id_shop_id_fkey"
            columns: ["profile_version_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "eta_profile_versions"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "eta_outbox_shop_id_device_serial_fkey"
            columns: ["shop_id", "device_serial"]
            isOneToOne: false
            referencedRelation: "eta_pos_chains"
            referencedColumns: ["shop_id", "device_serial"]
          },
        ]
      }
      eta_pos_chains: {
        Row: {
          device_serial: string
          last_uuid: string
          shop_id: string
        }
        Insert: {
          device_serial: string
          last_uuid?: string
          shop_id: string
        }
        Update: {
          device_serial?: string
          last_uuid?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eta_pos_chains_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_profile_versions: {
        Row: {
          actor_profile_id: string
          configuration: Json
          created_at: string
          id: string
          reason: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          configuration: Json
          created_at?: string
          id?: string
          reason: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          configuration?: Json
          created_at?: string
          id?: string
          reason?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eta_profile_versions_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eta_profile_versions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_sale_sources: {
        Row: {
          created_at: string
          invoice_id: string
          location_id: string
          profile_version_id: string
          shop_id: string
          source: Json
        }
        Insert: {
          created_at?: string
          invoice_id: string
          location_id: string
          profile_version_id: string
          shop_id: string
          source: Json
        }
        Update: {
          created_at?: string
          invoice_id?: string
          location_id?: string
          profile_version_id?: string
          shop_id?: string
          source?: Json
        }
        Relationships: [
          {
            foreignKeyName: "eta_sale_sources_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "eta_sale_sources_profile_version_id_shop_id_fkey"
            columns: ["profile_version_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "eta_profile_versions"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by_profile_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_events: {
        Row: {
          action: string
          actor_profile_id: string
          after_snapshot: Json
          before_snapshot: Json | null
          created_at: string
          expense_id: string
          id: string
          location_id: string
          reason: string | null
          request_id: string
          result_expense_id: string | null
          shop_id: string
        }
        Insert: {
          action: string
          actor_profile_id: string
          after_snapshot: Json
          before_snapshot?: Json | null
          created_at?: string
          expense_id: string
          id?: string
          location_id: string
          reason?: string | null
          request_id: string
          result_expense_id?: string | null
          shop_id: string
        }
        Update: {
          action?: string
          actor_profile_id?: string
          after_snapshot?: Json
          before_snapshot?: Json | null
          created_at?: string
          expense_id?: string
          id?: string
          location_id?: string
          reason?: string | null
          request_id?: string
          result_expense_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_events_expense_id_shop_id_fkey"
            columns: ["expense_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "expense_events_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "expense_events_result_expense_id_shop_id_fkey"
            columns: ["result_expense_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          correction_reason: string | null
          corrects_expense_id: string | null
          created_at: string
          created_by_profile_id: string
          currency: string
          expense_date: string
          id: string
          location_id: string
          notes: string | null
          paid_at: string | null
          replaced_by_expense_id: string | null
          request_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["expense_status"]
          superseded_reason: string | null
          title: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          correction_reason?: string | null
          corrects_expense_id?: string | null
          created_at?: string
          created_by_profile_id: string
          currency?: string
          expense_date?: string
          id?: string
          location_id: string
          notes?: string | null
          paid_at?: string | null
          replaced_by_expense_id?: string | null
          request_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["expense_status"]
          superseded_reason?: string | null
          title: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          correction_reason?: string | null
          corrects_expense_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          currency?: string
          expense_date?: string
          id?: string
          location_id?: string
          notes?: string | null
          paid_at?: string | null
          replaced_by_expense_id?: string | null
          request_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["expense_status"]
          superseded_reason?: string | null
          title?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_shop_fk"
            columns: ["category_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "expenses_corrects_shop_fk"
            columns: ["corrects_expense_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "expenses_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "expenses_replaced_by_shop_fk"
            columns: ["replaced_by_expense_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_voided_by_profile_fk"
            columns: ["voided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          created_at: string
          id: string
          location_id: string
          product_id: string
          quantity_received: number
          received_at: string
          remaining_quantity: number
          shop_id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["inventory_source_type"]
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          product_id: string
          quantity_received: number
          received_at?: string
          remaining_quantity: number
          shop_id: string
          source_id?: string | null
          source_type: Database["public"]["Enums"]["inventory_source_type"]
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          product_id?: string
          quantity_received?: number
          received_at?: string
          remaining_quantity?: number
          shop_id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["inventory_source_type"]
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by_profile_id: string
          id: string
          invoice_item_id: string | null
          location_id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          product_id: string
          quantity_change: number
          reference_id: string | null
          reversal_of_movement_id: string | null
          sale_correction_id: string | null
          shop_id: string
          unit_cost_snapshot: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by_profile_id: string
          id?: string
          invoice_item_id?: string | null
          location_id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          product_id: string
          quantity_change: number
          reference_id?: string | null
          reversal_of_movement_id?: string | null
          sale_correction_id?: string | null
          shop_id: string
          unit_cost_snapshot?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          id?: string
          invoice_item_id?: string | null
          location_id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          product_id?: string
          quantity_change?: number
          reference_id?: string | null
          reversal_of_movement_id?: string | null
          sale_correction_id?: string | null
          shop_id?: string
          unit_cost_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_location_fk"
            columns: ["batch_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_shop_product_fk"
            columns: ["batch_id", "shop_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id", "shop_id", "product_id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_shop_product_fk"
            columns: ["batch_id", "shop_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_batches"
            referencedColumns: ["batch_id", "shop_id", "product_id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_reversal_source_fk"
            columns: ["reversal_of_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_sale_correction_fk"
            columns: ["sale_correction_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "sale_corrections"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "inventory_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_threshold_changes: {
        Row: {
          changed_at: string
          changed_by_profile_id: string
          id: string
          new_threshold: number
          previous_threshold: number
          product_id: string
          shop_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_profile_id: string
          id?: string
          new_threshold: number
          previous_threshold: number
          product_id: string
          shop_id: string
        }
        Update: {
          changed_at?: string
          changed_by_profile_id?: string
          id?: string
          new_threshold?: number
          previous_threshold?: number
          product_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_threshold_changes_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_threshold_changes_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_threshold_changes_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_threshold_changes_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_threshold_changes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_type_snapshot: string | null
          discount_value_snapshot: number | null
          id: string
          invoice_id: string
          item_name: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          line_order: number | null
          product_barcode_snapshot: string | null
          product_id: string | null
          product_sku_snapshot: string | null
          quantity: number
          service_cleanup_minutes_snapshot: number | null
          service_duration_minutes_snapshot: number | null
          service_id: string | null
          service_location_ids_snapshot: string[] | null
          service_staff_membership_ids_snapshot: string[] | null
          shop_id: string
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_type_snapshot?: string | null
          discount_value_snapshot?: number | null
          id?: string
          invoice_id: string
          item_name: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_order?: number | null
          product_barcode_snapshot?: string | null
          product_id?: string | null
          product_sku_snapshot?: string | null
          quantity?: number
          service_cleanup_minutes_snapshot?: number | null
          service_duration_minutes_snapshot?: number | null
          service_id?: string | null
          service_location_ids_snapshot?: string[] | null
          service_staff_membership_ids_snapshot?: string[] | null
          shop_id: string
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_type_snapshot?: string | null
          discount_value_snapshot?: number | null
          id?: string
          invoice_id?: string
          item_name?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_order?: number | null
          product_barcode_snapshot?: string | null
          product_id?: string | null
          product_sku_snapshot?: string | null
          quantity?: number
          service_cleanup_minutes_snapshot?: number | null
          service_duration_minutes_snapshot?: number | null
          service_id?: string | null
          service_location_ids_snapshot?: string[] | null
          service_staff_membership_ids_snapshot?: string[] | null
          shop_id?: string
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_paid_amounts"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_shop_fk"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_shop_fk"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_shop_fk"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "invoice_items_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "invoice_items_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "invoice_items_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "invoice_items_service_shop_fk"
            columns: ["service_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      invoices: {
        Row: {
          assigned_to_profile_id: string | null
          client_address_snapshot: string | null
          client_email_snapshot: string | null
          client_id: string | null
          client_name_snapshot: string | null
          client_phone_snapshot: string | null
          created_at: string
          created_by_profile_id: string
          currency: string
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          issued_by_profile_id: string | null
          location_id: string
          notes: string | null
          shop_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          tax_order_discount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          assigned_to_profile_id?: string | null
          client_address_snapshot?: string | null
          client_email_snapshot?: string | null
          client_id?: string | null
          client_name_snapshot?: string | null
          client_phone_snapshot?: string | null
          created_at?: string
          created_by_profile_id: string
          currency?: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          issued_by_profile_id?: string | null
          location_id: string
          notes?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tax_order_discount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          assigned_to_profile_id?: string | null
          client_address_snapshot?: string | null
          client_email_snapshot?: string | null
          client_id?: string | null
          client_name_snapshot?: string | null
          client_phone_snapshot?: string | null
          created_at?: string
          created_by_profile_id?: string
          currency?: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          issued_by_profile_id?: string | null
          location_id?: string
          notes?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tax_order_discount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_assigned_to_profile_id_fkey"
            columns: ["assigned_to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_shop_fk"
            columns: ["client_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id", "shop_id"]
          },
          {
            foreignKeyName: "invoices_client_shop_fk"
            columns: ["client_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "invoices_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_profile_id_fkey"
            columns: ["issued_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_location_assignments: {
        Row: {
          created_at: string
          location_id: string
          membership_id: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          membership_id: string
          shop_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          membership_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_location_assignments_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "membership_location_assignments_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      membership_roles: {
        Row: {
          membership_id: string
          role_id: string
        }
        Insert: {
          membership_id: string
          role_id: string
        }
        Update: {
          membership_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          created_by_profile_id: string
          currency: string
          customer_kind:
            | Database["public"]["Enums"]["customer_payment_kind"]
            | null
          id: string
          invoice_id: string | null
          location_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          original_payment_id: string | null
          paid_at: string
          payment_direction: Database["public"]["Enums"]["payment_direction"]
          reference: string | null
          sale_correction_id: string | null
          sale_return_refund_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["payment_status"]
          supplier_kind:
            | Database["public"]["Enums"]["supplier_payment_kind"]
            | null
          vendor_id: string | null
          vendor_invoice_id: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          created_by_profile_id: string
          currency?: string
          customer_kind?:
            | Database["public"]["Enums"]["customer_payment_kind"]
            | null
          id?: string
          invoice_id?: string | null
          location_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          original_payment_id?: string | null
          paid_at?: string
          payment_direction: Database["public"]["Enums"]["payment_direction"]
          reference?: string | null
          sale_correction_id?: string | null
          sale_return_refund_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          supplier_kind?:
            | Database["public"]["Enums"]["supplier_payment_kind"]
            | null
          vendor_id?: string | null
          vendor_invoice_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          currency?: string
          customer_kind?:
            | Database["public"]["Enums"]["customer_payment_kind"]
            | null
          id?: string
          invoice_id?: string | null
          location_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          original_payment_id?: string | null
          paid_at?: string
          payment_direction?: Database["public"]["Enums"]["payment_direction"]
          reference?: string | null
          sale_correction_id?: string | null
          sale_return_refund_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          supplier_kind?:
            | Database["public"]["Enums"]["supplier_payment_kind"]
            | null
          vendor_id?: string | null
          vendor_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_shop_fk"
            columns: ["client_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id", "shop_id"]
          },
          {
            foreignKeyName: "payments_client_shop_fk"
            columns: ["client_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "payments_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_paid_amounts"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_location_fk"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "payments_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "payments_original_customer_payment_fk"
            columns: ["original_payment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "payments_sale_correction_fk"
            columns: ["sale_correction_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "sale_corrections"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "payments_sale_return_refund_id_fkey"
            columns: ["sale_return_refund_id"]
            isOneToOne: true
            referencedRelation: "sale_return_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_balances"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_balances"
            referencedColumns: ["vendor_invoice_id"]
          },
          {
            foreignKeyName: "payments_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_paid_amounts"
            referencedColumns: ["vendor_invoice_id"]
          },
          {
            foreignKeyName: "payments_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_invoice_location_fk"
            columns: ["vendor_invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          portal_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          portal_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_catalog_legacy_mappings: {
        Row: {
          after_snapshot: Json
          before_snapshot: Json
          legacy_plan_id: string
          migrated_at: string
          strategy: string
          subscriptions_at_migration: number
          successor_plan_id: string
        }
        Insert: {
          after_snapshot: Json
          before_snapshot: Json
          legacy_plan_id: string
          migrated_at?: string
          strategy: string
          subscriptions_at_migration: number
          successor_plan_id: string
        }
        Update: {
          after_snapshot?: Json
          before_snapshot?: Json
          legacy_plan_id?: string
          migrated_at?: string
          strategy?: string
          subscriptions_at_migration?: number
          successor_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_catalog_legacy_mappings_legacy_plan_id_fkey"
            columns: ["legacy_plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_catalog_legacy_mappings_successor_plan_id_fkey"
            columns: ["successor_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_catalog_terms: {
        Row: {
          billing_interval: string
          catalog_generation: number
          created_at: string
          currency: string
          display_name: string
          effective_from: string
          id: string
          is_public: boolean
          is_purchasable: boolean
          offer_entitlements: Json
          plan_id: string
          plan_variant: string | null
          price_amount: number
          private_offer_id: string | null
          resource_limits: Json
          trial_days: number
          variant_name: string | null
          version: number
        }
        Insert: {
          billing_interval: string
          catalog_generation?: number
          created_at?: string
          currency: string
          display_name: string
          effective_from?: string
          id?: string
          is_public: boolean
          is_purchasable: boolean
          offer_entitlements?: Json
          plan_id: string
          plan_variant?: string | null
          price_amount: number
          private_offer_id?: string | null
          resource_limits: Json
          trial_days: number
          variant_name?: string | null
          version: number
        }
        Update: {
          billing_interval?: string
          catalog_generation?: number
          created_at?: string
          currency?: string
          display_name?: string
          effective_from?: string
          id?: string
          is_public?: boolean
          is_purchasable?: boolean
          offer_entitlements?: Json
          plan_id?: string
          plan_variant?: string | null
          price_amount?: number
          private_offer_id?: string | null
          resource_limits?: Json
          trial_days?: number
          variant_name?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_catalog_terms_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_catalog_terms_private_offer_id_fkey"
            columns: ["private_offer_id"]
            isOneToOne: true
            referencedRelation: "shop_private_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_interval: string
          catalog_version: number
          created_at: string
          currency: string
          features: Json
          id: string
          is_active: boolean
          is_coming_soon: boolean
          is_public: boolean
          is_purchasable: boolean
          name: string
          portal_id: string
          price_amount: number
          resource_limits: Json
          slug: string
          sort_order: number
          stripe_mode: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          catalog_version?: number
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_coming_soon?: boolean
          is_public?: boolean
          is_purchasable?: boolean
          name: string
          portal_id: string
          price_amount: number
          resource_limits?: Json
          slug: string
          sort_order?: number
          stripe_mode?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          catalog_version?: number
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_coming_soon?: boolean
          is_public?: boolean
          is_purchasable?: boolean
          name?: string
          portal_id?: string
          price_amount?: number
          resource_limits?: Json
          slug?: string
          sort_order?: number
          stripe_mode?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_events: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string | null
          after_state: Json
          before_state: Json | null
          id: string
          occurred_at: string
          parameters: Json
          reason: string
          request_id: string
          shop_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id?: string | null
          after_state: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          parameters?: Json
          reason: string
          request_id: string
          shop_id: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string | null
          after_state?: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          parameters?: Json
          reason?: string
          request_id?: string
          shop_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          display_name: string | null
          enabled: boolean
          provisioned_at: string
          role: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          enabled?: boolean
          provisioned_at?: string
          role: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          enabled?: boolean
          provisioned_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_billing_events: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string | null
          after_state: Json
          before_state: Json | null
          id: string
          occurred_at: string
          parameters: Json
          reason: string
          request_id: string
          shop_id: string | null
          submission_id: string | null
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id?: string | null
          after_state: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          parameters?: Json
          reason: string
          request_id: string
          shop_id?: string | null
          submission_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string | null
          after_state?: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          parameters?: Json
          reason?: string
          request_id?: string
          shop_id?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_billing_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_billing_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "shop_billing_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plan_events: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string | null
          after_state: Json
          before_state: Json | null
          id: string
          occurred_at: string
          parameters: Json
          plan_id: string | null
          reason: string
          request_id: string
          shop_id: string | null
          subscription_id: string | null
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id?: string | null
          after_state: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          parameters: Json
          plan_id?: string | null
          reason: string
          request_id: string
          shop_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string | null
          after_state?: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          parameters?: Json
          plan_id?: string | null
          reason?: string
          request_id?: string
          shop_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_plan_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_plan_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_plan_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      portals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_original: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_original?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_original?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_sale_contexts: {
        Row: {
          appointment_id: string | null
          created_at: string
          customer_name_snapshot: string | null
          invoice_id: string
          location_id: string
          shop_id: string
          staff_membership_id: string
          staff_name_snapshot: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          customer_name_snapshot?: string | null
          invoice_id: string
          location_id: string
          shop_id: string
          staff_membership_id: string
          staff_name_snapshot: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          customer_name_snapshot?: string | null
          invoice_id?: string
          location_id?: string
          shop_id?: string
          staff_membership_id?: string
          staff_name_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_contexts_appointment_id_shop_id_location_id_fkey"
            columns: ["appointment_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "pos_sale_contexts_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "pos_sale_contexts_staff_membership_id_shop_id_fkey"
            columns: ["staff_membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      pos_sale_requests: {
        Row: {
          actor_profile_id: string
          completed_at: string | null
          created_at: string
          invoice_id: string | null
          operation: string
          payload_hash: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          completed_at?: string | null
          created_at?: string
          invoice_id?: string | null
          operation: string
          payload_hash: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          completed_at?: string | null
          created_at?: string
          invoice_id?: string | null
          operation?: string
          payload_hash?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_requests_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "pos_sale_requests_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "pos_sale_requests_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "pos_sale_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          created_at: string
          product_id: string
          shop_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          shop_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          shop_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "product_suppliers_vendor_id_shop_id_fkey"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_balances"
            referencedColumns: ["vendor_id", "shop_id"]
          },
          {
            foreignKeyName: "product_suppliers_vendor_id_shop_id_fkey"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          created_by_profile_id: string
          id: string
          image_object_name: string | null
          image_url: string | null
          is_active: boolean
          name: string
          reorder_threshold: number
          sale_price: number
          shop_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by_profile_id: string
          id?: string
          image_object_name?: string | null
          image_url?: string | null
          is_active?: boolean
          name: string
          reorder_threshold?: number
          sale_price?: number
          shop_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          id?: string
          image_object_name?: string | null
          image_url?: string | null
          is_active?: boolean
          name?: string
          reorder_threshold?: number
          sale_price?: number
          shop_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_shop_fk"
            columns: ["category_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "products_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email_snapshot: string | null
          id: string
          portal_id: string
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_snapshot?: string | null
          id?: string
          portal_id: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_snapshot?: string | null
          id?: string
          portal_id?: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          created_at: string
          id: string
          inventory_batch_id: string
          product_id: string
          purchase_return_id: string
          quantity: number
          shop_id: string
          total_amount: number
          unit_cost: number
          vendor_invoice_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_batch_id: string
          product_id: string
          purchase_return_id: string
          quantity: number
          shop_id: string
          total_amount: number
          unit_cost: number
          vendor_invoice_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_batch_id?: string
          product_id?: string
          purchase_return_id?: string
          quantity?: number
          shop_id?: string
          total_amount?: number
          unit_cost?: number
          vendor_invoice_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_inventory_batch_id_fkey"
            columns: ["inventory_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_inventory_batch_id_fkey"
            columns: ["inventory_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_return_items_purchase_return_id_shop_id_fkey"
            columns: ["purchase_return_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_return_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_vendor_invoice_item_id_fkey"
            columns: ["vendor_invoice_item_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          created_by_profile_id: string
          id: string
          reason: string
          reference: string | null
          returned_at: string
          shop_id: string
          total_amount: number
          vendor_id: string
          vendor_invoice_id: string
          vendor_name_snapshot: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          id?: string
          reason: string
          reference?: string | null
          returned_at: string
          shop_id: string
          total_amount: number
          vendor_id: string
          vendor_invoice_id: string
          vendor_name_snapshot: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          id?: string
          reason?: string
          reference?: string | null
          returned_at?: string
          shop_id?: string
          total_amount?: number
          vendor_id?: string
          vendor_invoice_id?: string
          vendor_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_vendor_id_shop_id_fkey"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_balances"
            referencedColumns: ["vendor_id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_returns_vendor_id_shop_id_fkey"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_returns_vendor_invoice_id_shop_id_fkey"
            columns: ["vendor_invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_balances"
            referencedColumns: ["vendor_invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "purchase_returns_vendor_invoice_id_shop_id_fkey"
            columns: ["vendor_invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_system: boolean
          key: string | null
          name: string
          name_ar: string | null
          shop_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string | null
          name: string
          name_ar?: string | null
          shop_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string | null
          name?: string
          name_ar?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_corrections: {
        Row: {
          created_at: string
          created_by_profile_id: string
          effective_at: string
          id: string
          invoice_id: string
          kind: Database["public"]["Enums"]["sale_correction_kind"]
          location_id: string
          payload_hash: string
          reason: string
          reference: string | null
          refund_amount: number
          request_id: string
          restored_quantity: number
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          effective_at: string
          id?: string
          invoice_id: string
          kind: Database["public"]["Enums"]["sale_correction_kind"]
          location_id: string
          payload_hash: string
          reason: string
          reference?: string | null
          refund_amount: number
          request_id: string
          restored_quantity: number
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          effective_at?: string
          id?: string
          invoice_id?: string
          kind?: Database["public"]["Enums"]["sale_correction_kind"]
          location_id?: string
          payload_hash?: string
          reason?: string
          reference?: string | null
          refund_amount?: number
          request_id?: string
          restored_quantity?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_corrections_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_corrections_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "sale_corrections_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      sale_number_counters: {
        Row: {
          next_number: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          next_number: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          next_number?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_number_counters_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_receipt_issue_snapshots: {
        Row: {
          created_at: string
          invoice_id: string
          location_id: string
          shop_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          invoice_id: string
          location_id: string
          shop_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          invoice_id?: string
          location_id?: string
          shop_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sale_receipt_issue_snapshots_invoice_id_shop_id_location_i_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
        ]
      }
      sale_receipts: {
        Row: {
          created_at: string
          invoice_id: string
          location_id: string
          shop_id: string
          snapshot: Json
          snapshot_version: number
        }
        Insert: {
          created_at?: string
          invoice_id: string
          location_id: string
          shop_id: string
          snapshot: Json
          snapshot_version?: number
        }
        Update: {
          created_at?: string
          invoice_id?: string
          location_id?: string
          shop_id?: string
          snapshot?: Json
          snapshot_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_receipts_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
        ]
      }
      sale_requests: {
        Row: {
          actor_profile_id: string
          completed_at: string | null
          created_at: string
          invoice_id: string | null
          operation: string
          payload_hash: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          completed_at?: string | null
          created_at?: string
          invoice_id?: string | null
          operation: string
          payload_hash: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          completed_at?: string | null
          created_at?: string
          invoice_id?: string | null
          operation?: string
          payload_hash?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_requests_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "sale_requests_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "sale_requests_invoice_id_shop_id_fkey"
            columns: ["invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "sale_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_lines: {
        Row: {
          disposition: string
          line_id: string
          net: number
          original_snapshot: Json
          quantity: number
          return_id: string
          shop_id: string
          tax: number
          total: number
        }
        Insert: {
          disposition: string
          line_id: string
          net: number
          original_snapshot: Json
          quantity: number
          return_id: string
          shop_id: string
          tax: number
          total: number
        }
        Update: {
          disposition?: string
          line_id?: string
          net?: number
          original_snapshot?: Json
          quantity?: number
          return_id?: string
          shop_id?: string
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_lines_line_id_shop_id_fkey"
            columns: ["line_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "sale_return_lines_return_id_shop_id_fkey"
            columns: ["return_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      sale_return_refund_events: {
        Row: {
          actor_profile_id: string
          created_at: string
          id: string
          operation: string
          payment_id: string | null
          reason: string
          reference: string
          refund_id: string
          request_id: string
          shop_id: string
          state: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          id?: string
          operation: string
          payment_id?: string | null
          reason: string
          reference: string
          refund_id: string
          request_id: string
          shop_id: string
          state: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          id?: string
          operation?: string
          payment_id?: string | null
          reason?: string
          reference?: string
          refund_id?: string
          request_id?: string
          shop_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_refund_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_refund_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_refund_events_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "sale_return_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_refund_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_refunds: {
        Row: {
          allocation_id: string
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          payment_id: string
          return_id: string
          shop_id: string
        }
        Insert: {
          allocation_id: string
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          payment_id: string
          return_id: string
          shop_id: string
        }
        Update: {
          allocation_id?: string
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          payment_id?: string
          return_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_refunds_allocation_id_shop_id_payment_id_fkey"
            columns: ["allocation_id", "shop_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "customer_payment_allocations"
            referencedColumns: ["id", "shop_id", "payment_id"]
          },
          {
            foreignKeyName: "sale_return_refunds_return_id_shop_id_fkey"
            columns: ["return_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      sale_return_sources: {
        Row: {
          created_at: string
          invoice_id: string
          location_id: string
          shop_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          invoice_id: string
          location_id: string
          shop_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          invoice_id?: string
          location_id?: string
          shop_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_sources_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
        ]
      }
      sale_return_stock: {
        Row: {
          disposition: string
          line_id: string
          movement_id: string
          quantity: number
          restoration_movement_id: string | null
          return_id: string
        }
        Insert: {
          disposition: string
          line_id: string
          movement_id: string
          quantity: number
          restoration_movement_id?: string | null
          return_id: string
        }
        Update: {
          disposition?: string
          line_id?: string
          movement_id?: string
          quantity?: number
          restoration_movement_id?: string | null
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_stock_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_stock_restoration_movement_id_fkey"
            columns: ["restoration_movement_id"]
            isOneToOne: true
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_stock_return_id_line_id_fkey"
            columns: ["return_id", "line_id"]
            isOneToOne: false
            referencedRelation: "sale_return_lines"
            referencedColumns: ["return_id", "line_id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          actor_profile_id: string
          created_at: string
          currency: string
          debt_reduction: number
          due_after: number
          due_before: number
          id: string
          invoice_id: string
          location_id: string
          net: number
          original_document: Json
          payload: Json
          reason: string
          refund_due: number
          request_id: string
          shop_id: string
          tax: number
          total: number
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          currency: string
          debt_reduction: number
          due_after: number
          due_before: number
          id?: string
          invoice_id: string
          location_id: string
          net: number
          original_document: Json
          payload: Json
          reason: string
          refund_due: number
          request_id: string
          shop_id: string
          tax: number
          total: number
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          currency?: string
          debt_reduction?: number
          due_after?: number
          due_before?: number
          id?: string
          invoice_id?: string
          location_id?: string
          net?: number
          original_document?: Json
          payload?: Json
          reason?: string
          refund_due?: number
          request_id?: string
          shop_id?: string
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
        ]
      }
      sale_tax_snapshots: {
        Row: {
          created_at: string
          invoice_id: string
          location_id: string
          policy_version_id: string | null
          shop_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          invoice_id: string
          location_id: string
          policy_version_id?: string | null
          shop_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          invoice_id?: string
          location_id?: string
          policy_version_id?: string | null
          shop_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sale_tax_snapshots_invoice_id_shop_id_location_id_fkey"
            columns: ["invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "sale_tax_snapshots_policy_version_id_shop_id_fkey"
            columns: ["policy_version_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "tax_policy_versions"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      service_completion_cancellations: {
        Row: {
          actor_profile_id: string
          created_at: string
          payload: Json
          reason: string
          request_id: string
          resolution_request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          payload: Json
          reason: string
          request_id: string
          resolution_request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          payload?: Json
          reason?: string
          request_id?: string
          resolution_request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_completion_cancellations_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_completion_cancellations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      service_fulfillment_sale_links: {
        Row: {
          actor_profile_id: string
          created_at: string
          fulfillment_id: string
          line_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          fulfillment_id: string
          line_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          fulfillment_id?: string
          line_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_fulfillment_sale_links_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_fulfillment_sale_links_fulfillment_id_shop_id_fkey"
            columns: ["fulfillment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "service_fulfillments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_fulfillment_sale_links_line_id_shop_id_fkey"
            columns: ["line_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      service_fulfillments: {
        Row: {
          actor_profile_id: string
          appointment_id: string | null
          completed_at: string
          id: string
          line_id: string | null
          location_id: string
          materials: Json
          payload: Json
          quantity: number
          reason: string
          recipe_version_id: string | null
          request_id: string
          service_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          appointment_id?: string | null
          completed_at?: string
          id?: string
          line_id?: string | null
          location_id: string
          materials: Json
          payload: Json
          quantity: number
          reason: string
          recipe_version_id?: string | null
          request_id: string
          service_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          appointment_id?: string | null
          completed_at?: string
          id?: string
          line_id?: string | null
          location_id?: string
          materials?: Json
          payload?: Json
          quantity?: number
          reason?: string
          recipe_version_id?: string | null
          request_id?: string
          service_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_fulfillments_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_fulfillments_appointment_id_shop_id_fkey"
            columns: ["appointment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_fulfillments_line_id_shop_id_fkey"
            columns: ["line_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_fulfillments_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_fulfillments_recipe_version_id_shop_id_fkey"
            columns: ["recipe_version_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "service_recipe_versions"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_fulfillments_service_id_shop_id_fkey"
            columns: ["service_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_fulfillments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      service_location_availability: {
        Row: {
          created_at: string
          location_id: string
          service_id: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          service_id: string
          shop_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          service_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_location_availability_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_location_availability_service_id_shop_id_fkey"
            columns: ["service_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      service_material_consumptions: {
        Row: {
          batch_id: string
          fulfillment_id: string
          id: string
          movement_id: string
          product_id: string
          quantity: number
          shop_id: string
          unit: string
          unit_cost: number
        }
        Insert: {
          batch_id: string
          fulfillment_id: string
          id?: string
          movement_id: string
          product_id: string
          quantity: number
          shop_id: string
          unit: string
          unit_cost: number
        }
        Update: {
          batch_id?: string
          fulfillment_id?: string
          id?: string
          movement_id?: string
          product_id?: string
          quantity?: number
          shop_id?: string
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_material_consumptions_batch_id_shop_id_product_id_fkey"
            columns: ["batch_id", "shop_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id", "shop_id", "product_id"]
          },
          {
            foreignKeyName: "service_material_consumptions_batch_id_shop_id_product_id_fkey"
            columns: ["batch_id", "shop_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_batches"
            referencedColumns: ["batch_id", "shop_id", "product_id"]
          },
          {
            foreignKeyName: "service_material_consumptions_fulfillment_id_shop_id_fkey"
            columns: ["fulfillment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "service_fulfillments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_material_consumptions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_material_consumptions_product_id_shop_id_unit_fkey"
            columns: ["product_id", "shop_id", "unit"]
            isOneToOne: false
            referencedRelation: "service_material_units"
            referencedColumns: ["product_id", "shop_id", "unit"]
          },
        ]
      }
      service_material_corrections: {
        Row: {
          actor_profile_id: string
          consumption_id: string
          created_at: string
          id: string
          movement_id: string
          quantity: number
          reason: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          consumption_id: string
          created_at?: string
          id?: string
          movement_id: string
          quantity: number
          reason: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          consumption_id?: string
          created_at?: string
          id?: string
          movement_id?: string
          quantity?: number
          reason?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_material_corrections_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_material_corrections_consumption_id_fkey"
            columns: ["consumption_id"]
            isOneToOne: false
            referencedRelation: "service_material_consumptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_material_corrections_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      service_material_units: {
        Row: {
          actor_profile_id: string
          created_at: string
          dimension: string | null
          product_id: string
          shop_id: string
          unit: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          dimension?: string | null
          product_id: string
          shop_id: string
          unit: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          dimension?: string | null
          product_id?: string
          shop_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_material_units_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_material_units_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "service_material_units_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "service_material_units_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      service_recipe_versions: {
        Row: {
          actor_profile_id: string
          created_at: string
          effective_at: string
          id: string
          materials: Json
          reason: string
          request_id: string
          requested_effective_at: string | null
          service_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          effective_at: string
          id?: string
          materials: Json
          reason: string
          request_id: string
          requested_effective_at?: string | null
          service_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          effective_at?: string
          id?: string
          materials?: Json
          reason?: string
          request_id?: string
          requested_effective_at?: string | null
          service_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_recipe_versions_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_recipe_versions_service_id_shop_id_fkey"
            columns: ["service_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      service_staff_eligibility: {
        Row: {
          created_at: string
          membership_id: string
          service_id: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          membership_id: string
          service_id: string
          shop_id: string
        }
        Update: {
          created_at?: string
          membership_id?: string
          service_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_eligibility_membership_id_shop_id_fkey"
            columns: ["membership_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "service_staff_eligibility_service_id_shop_id_fkey"
            columns: ["service_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      services: {
        Row: {
          base_sale_price: number | null
          category_id: string | null
          cleanup_minutes: number
          created_at: string
          created_by_profile_id: string
          default_discount_type: string | null
          default_discount_value: number | null
          description: string | null
          duration_minutes: number | null
          id: string
          image_object_name: string | null
          image_url: string | null
          is_active: boolean
          name: string
          scheduling_enabled: boolean
          shop_id: string
          updated_at: string
        }
        Insert: {
          base_sale_price?: number | null
          category_id?: string | null
          cleanup_minutes?: number
          created_at?: string
          created_by_profile_id: string
          default_discount_type?: string | null
          default_discount_value?: number | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_object_name?: string | null
          image_url?: string | null
          is_active?: boolean
          name: string
          scheduling_enabled?: boolean
          shop_id: string
          updated_at?: string
        }
        Update: {
          base_sale_price?: number | null
          category_id?: string | null
          cleanup_minutes?: number
          created_at?: string
          created_by_profile_id?: string
          default_discount_type?: string | null
          default_discount_value?: number | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_object_name?: string | null
          image_url?: string | null
          is_active?: boolean
          name?: string
          scheduling_enabled?: boolean
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_shop_fk"
            columns: ["category_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "services_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_account_provision_commands: {
        Row: {
          action: string
          body_digest: string
          created_at: string
          envelope: Json
          id: string
          invitation_before_at: string | null
          invitation_started_at: string | null
          invitation_state: string
          job_id: string
          principal_id: string
          request_id: string
          result: Json | null
        }
        Insert: {
          action: string
          body_digest: string
          created_at?: string
          envelope: Json
          id?: string
          invitation_before_at?: string | null
          invitation_started_at?: string | null
          invitation_state?: string
          job_id: string
          principal_id: string
          request_id: string
          result?: Json | null
        }
        Update: {
          action?: string
          body_digest?: string
          created_at?: string
          envelope?: Json
          id?: string
          invitation_before_at?: string | null
          invitation_started_at?: string | null
          invitation_state?: string
          job_id?: string
          principal_id?: string
          request_id?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_account_provision_commands_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "shop_account_provisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provision_commands_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "shop_super_admin_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_account_provision_events: {
        Row: {
          action: string
          actor: Json
          command_id: string | null
          data: Json
          id: string
          job_id: string | null
          occurred_at: string
          reason: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor: Json
          command_id?: string | null
          data: Json
          id?: string
          job_id?: string | null
          occurred_at?: string
          reason: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor?: Json
          command_id?: string | null
          data?: Json
          id?: string
          job_id?: string | null
          occurred_at?: string
          reason?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_account_provision_events_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "shop_account_provision_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provision_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "shop_account_provisions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_account_provisioning_settings: {
        Row: {
          auth_timeout_ms: number
          enabled: boolean
          id: boolean
          invitation_ready: boolean
          invite_redirect_url: string
          lease_seconds: number
        }
        Insert: {
          auth_timeout_ms: number
          enabled?: boolean
          id: boolean
          invitation_ready?: boolean
          invite_redirect_url: string
          lease_seconds: number
        }
        Update: {
          auth_timeout_ms?: number
          enabled?: boolean
          id?: boolean
          invitation_ready?: boolean
          invite_redirect_url?: string
          lease_seconds?: number
        }
        Relationships: []
      }
      shop_account_provisions: {
        Row: {
          activation_audit_id: string | null
          active_command_id: string | null
          active_snapshot: Json | null
          auth_user_id: string
          created_at: string
          email: string
          id: string
          last_event_id: string | null
          latest_invitation_command_id: string | null
          lease_token: string | null
          lease_until: string | null
          owner_claimed_at: string | null
          payload: Json
          phase: string
          principal_id: string
          shop_id: string | null
          subscription_id: string | null
          version: number
        }
        Insert: {
          activation_audit_id?: string | null
          active_command_id?: string | null
          active_snapshot?: Json | null
          auth_user_id?: string
          created_at?: string
          email: string
          id?: string
          last_event_id?: string | null
          latest_invitation_command_id?: string | null
          lease_token?: string | null
          lease_until?: string | null
          owner_claimed_at?: string | null
          payload: Json
          phase?: string
          principal_id: string
          shop_id?: string | null
          subscription_id?: string | null
          version?: number
        }
        Update: {
          activation_audit_id?: string | null
          active_command_id?: string | null
          active_snapshot?: Json | null
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          last_event_id?: string | null
          latest_invitation_command_id?: string | null
          lease_token?: string | null
          lease_until?: string | null
          owner_claimed_at?: string | null
          payload?: Json
          phase?: string
          principal_id?: string
          shop_id?: string | null
          subscription_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_account_provisions_activation_audit_id_fkey"
            columns: ["activation_audit_id"]
            isOneToOne: false
            referencedRelation: "platform_plan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provisions_active_command_id_fkey"
            columns: ["active_command_id"]
            isOneToOne: false
            referencedRelation: "shop_account_provision_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provisions_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "shop_account_provision_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provisions_latest_invitation_command_id_fkey"
            columns: ["latest_invitation_command_id"]
            isOneToOne: false
            referencedRelation: "shop_account_provision_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provisions_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "shop_super_admin_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provisions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_account_provisions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_billing_configuration: {
        Row: {
          enabled: boolean
          instructions_ar: string
          instructions_en: string
          payment_link: string | null
          qr_alt_ar: string
          qr_alt_en: string
          qr_image_url: string | null
          recipient_alias: string | null
          recipient_details: string
          singleton: boolean
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          enabled?: boolean
          instructions_ar?: string
          instructions_en?: string
          payment_link?: string | null
          qr_alt_ar?: string
          qr_alt_en?: string
          qr_image_url?: string | null
          recipient_alias?: string | null
          recipient_details?: string
          singleton?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          enabled?: boolean
          instructions_ar?: string
          instructions_en?: string
          payment_link?: string | null
          qr_alt_ar?: string
          qr_alt_en?: string
          qr_image_url?: string | null
          recipient_alias?: string | null
          recipient_details?: string
          singleton?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: []
      }
      shop_billing_payment_evidence: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          object_name: string
          original_file_name: string
          retained_until: string
          sha256: string
          shop_id: string
          size_bytes: number
          submission_id: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          object_name: string
          original_file_name: string
          retained_until: string
          sha256: string
          shop_id: string
          size_bytes: number
          submission_id: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          object_name?: string
          original_file_name?: string
          retained_until?: string
          sha256?: string
          shop_id?: string
          size_bytes?: number
          submission_id?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_billing_payment_evidence_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_billing_payment_evidence_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "shop_billing_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_billing_submissions: {
        Row: {
          activation_days: number | null
          amount: number | null
          approved_subscription_end: string | null
          billing_interval_snapshot: string | null
          catalog_terms_id: string | null
          currency: string
          effective_price_amount: number | null
          expected_amount: number | null
          id: string
          kind: string
          list_price_amount: number | null
          metadata: Json
          offer_entitlements: Json
          paid_amount: number | null
          plan_id: string | null
          plan_name_snapshot: string | null
          plan_slug_snapshot: string | null
          plan_variant_snapshot: string | null
          price_override_id: string | null
          price_source: string | null
          quoted_at: string | null
          received_amount: number | null
          received_date: string | null
          received_reference: string | null
          reference: string | null
          request_id: string | null
          resource_limits_snapshot: Json | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          shop_id: string
          status: string
          submitted_at: string
          submitted_by_profile_id: string | null
          transfer_date: string | null
          transfer_reference: string | null
        }
        Insert: {
          activation_days?: number | null
          amount?: number | null
          approved_subscription_end?: string | null
          billing_interval_snapshot?: string | null
          catalog_terms_id?: string | null
          currency?: string
          effective_price_amount?: number | null
          expected_amount?: number | null
          id?: string
          kind: string
          list_price_amount?: number | null
          metadata?: Json
          offer_entitlements?: Json
          paid_amount?: number | null
          plan_id?: string | null
          plan_name_snapshot?: string | null
          plan_slug_snapshot?: string | null
          plan_variant_snapshot?: string | null
          price_override_id?: string | null
          price_source?: string | null
          quoted_at?: string | null
          received_amount?: number | null
          received_date?: string | null
          received_reference?: string | null
          reference?: string | null
          request_id?: string | null
          resource_limits_snapshot?: Json | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          shop_id: string
          status?: string
          submitted_at?: string
          submitted_by_profile_id?: string | null
          transfer_date?: string | null
          transfer_reference?: string | null
        }
        Update: {
          activation_days?: number | null
          amount?: number | null
          approved_subscription_end?: string | null
          billing_interval_snapshot?: string | null
          catalog_terms_id?: string | null
          currency?: string
          effective_price_amount?: number | null
          expected_amount?: number | null
          id?: string
          kind?: string
          list_price_amount?: number | null
          metadata?: Json
          offer_entitlements?: Json
          paid_amount?: number | null
          plan_id?: string | null
          plan_name_snapshot?: string | null
          plan_slug_snapshot?: string | null
          plan_variant_snapshot?: string | null
          price_override_id?: string | null
          price_source?: string | null
          quoted_at?: string | null
          received_amount?: number | null
          received_date?: string | null
          received_reference?: string | null
          reference?: string | null
          request_id?: string | null
          resource_limits_snapshot?: Json | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          shop_id?: string
          status?: string
          submitted_at?: string
          submitted_by_profile_id?: string | null
          transfer_date?: string | null
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_billing_submissions_catalog_terms_id_fkey"
            columns: ["catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_billing_submissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_billing_submissions_price_override_id_fkey"
            columns: ["price_override_id"]
            isOneToOne: false
            referencedRelation: "subscription_price_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_billing_submissions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_billing_submissions_submitted_by_profile_id_fkey"
            columns: ["submitted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_business_mode_changes: {
        Row: {
          changed_at: string
          changed_by_profile_id: string
          id: string
          new_mode: Database["public"]["Enums"]["business_mode"]
          previous_mode: Database["public"]["Enums"]["business_mode"]
          shop_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_profile_id: string
          id?: string
          new_mode: Database["public"]["Enums"]["business_mode"]
          previous_mode: Database["public"]["Enums"]["business_mode"]
          shop_id: string
        }
        Update: {
          changed_at?: string
          changed_by_profile_id?: string
          id?: string
          new_mode?: Database["public"]["Enums"]["business_mode"]
          previous_mode?: Database["public"]["Enums"]["business_mode"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_business_mode_changes_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_business_mode_changes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_cash_policy_changes: {
        Row: {
          changed_at: string
          changed_by_profile_id: string
          id: string
          new_required: boolean
          previous_required: boolean
          shop_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_profile_id: string
          id?: string
          new_required: boolean
          previous_required: boolean
          shop_id: string
        }
        Update: {
          changed_at?: string
          changed_by_profile_id?: string
          id?: string
          new_required?: boolean
          previous_required?: boolean
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_cash_policy_changes_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_cash_policy_changes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_currency_changes: {
        Row: {
          changed_at: string
          changed_by_profile_id: string
          id: string
          new_currency: string
          previous_currency: string
          shop_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_profile_id: string
          id?: string
          new_currency: string
          previous_currency: string
          shop_id: string
        }
        Update: {
          changed_at?: string
          changed_by_profile_id?: string
          id?: string
          new_currency?: string
          previous_currency?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_currency_changes_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_currency_changes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_locations: {
        Row: {
          address: string | null
          archived_at: string | null
          code: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          phone: string | null
          shop_id: string
          status: Database["public"]["Enums"]["shop_location_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          phone?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["shop_location_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          phone?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["shop_location_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_locations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_membership_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          id: string
          membership_id: string
          occurred_at: string
          shop_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          membership_id: string
          occurred_at?: string
          shop_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          membership_id?: string
          occurred_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_membership_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_memberships: {
        Row: {
          created_at: string
          id: string
          job_title: string | null
          profile_id: string
          removed_at: string | null
          role: string
          shop_id: string
          status: Database["public"]["Enums"]["shop_membership_status"]
          team_full_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_title?: string | null
          profile_id: string
          removed_at?: string | null
          role: string
          shop_id: string
          status?: Database["public"]["Enums"]["shop_membership_status"]
          team_full_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_title?: string | null
          profile_id?: string
          removed_at?: string | null
          role?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["shop_membership_status"]
          team_full_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_private_offer_redemptions: {
        Row: {
          offer_id: string
          redeemed_at: string
          redeemed_by_user_id: string
          request_id: string
          submission_id: string
        }
        Insert: {
          offer_id: string
          redeemed_at?: string
          redeemed_by_user_id: string
          request_id: string
          submission_id: string
        }
        Update: {
          offer_id?: string
          redeemed_at?: string
          redeemed_by_user_id?: string
          request_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_private_offer_redemptions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "shop_private_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_private_offer_redemptions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "shop_billing_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_private_offer_revocations: {
        Row: {
          created_at: string
          integration_principal_id: string
          offer_id: string
          reason: string
          request_id: string
        }
        Insert: {
          created_at?: string
          integration_principal_id: string
          offer_id: string
          reason: string
          request_id: string
        }
        Update: {
          created_at?: string
          integration_principal_id?: string
          offer_id?: string
          reason?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_private_offer_revocations_integration_principal_id_fkey"
            columns: ["integration_principal_id"]
            isOneToOne: false
            referencedRelation: "shop_super_admin_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_private_offer_revocations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "shop_private_offer_security"
            referencedColumns: ["offer_id"]
          },
        ]
      }
      shop_private_offer_security: {
        Row: {
          created_at: string
          entitlements: Json
          offer_id: string
          token_digest: string
        }
        Insert: {
          created_at?: string
          entitlements: Json
          offer_id: string
          token_digest: string
        }
        Update: {
          created_at?: string
          entitlements?: Json
          offer_id?: string
          token_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_private_offer_security_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "shop_private_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_private_offers: {
        Row: {
          billing_interval: string
          created_at: string
          currency: string
          display_name: string
          expires_at: string
          id: string
          integration_principal_id: string
          offer_version: number
          plan_id: string
          price_amount: number
          reason: string
          recipient_user_id: string
          request_id: string
          resource_limits: Json
          shop_id: string
          suit: string
          target_binding_id: string
          target_environment_id: string
        }
        Insert: {
          billing_interval: string
          created_at?: string
          currency: string
          display_name: string
          expires_at: string
          id: string
          integration_principal_id: string
          offer_version: number
          plan_id: string
          price_amount: number
          reason: string
          recipient_user_id: string
          request_id: string
          resource_limits: Json
          shop_id: string
          suit: string
          target_binding_id: string
          target_environment_id: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          currency?: string
          display_name?: string
          expires_at?: string
          id?: string
          integration_principal_id?: string
          offer_version?: number
          plan_id?: string
          price_amount?: number
          reason?: string
          recipient_user_id?: string
          request_id?: string
          resource_limits?: Json
          shop_id?: string
          suit?: string
          target_binding_id?: string
          target_environment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_private_offers_integration_principal_id_fkey"
            columns: ["integration_principal_id"]
            isOneToOne: false
            referencedRelation: "shop_super_admin_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_private_offers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_private_offers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_profile_changes: {
        Row: {
          changed_at: string
          changed_by_profile_id: string
          id: string
          new_name: string
          previous_name: string
          shop_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_profile_id: string
          id?: string
          new_name: string
          previous_name: string
          shop_id: string
        }
        Update: {
          changed_at?: string
          changed_by_profile_id?: string
          id?: string
          new_name?: string
          previous_name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_profile_changes_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_profile_changes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_proration_credit_accounts: {
        Row: {
          balance_minor: number
          currency: string
          subscription_id: string
          updated_at: string
          version: number
        }
        Insert: {
          balance_minor?: number
          currency?: string
          subscription_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          balance_minor?: number
          currency?: string
          subscription_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_proration_credit_accounts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_proration_credit_ledger: {
        Row: {
          balance_after_minor: number
          balance_before_minor: number
          cash_minor: number
          created_at: string
          currency: string
          delta_minor: number
          quote_id: string
          rounding_adjustment_minor: number
          service_value_minor: number
          subscription_id: string
          unused_prepaid_minor: number
          version_after: number
          version_before: number
        }
        Insert: {
          balance_after_minor: number
          balance_before_minor: number
          cash_minor: number
          created_at?: string
          currency: string
          delta_minor: number
          quote_id: string
          rounding_adjustment_minor: number
          service_value_minor: number
          subscription_id: string
          unused_prepaid_minor: number
          version_after: number
          version_before: number
        }
        Update: {
          balance_after_minor?: number
          balance_before_minor?: number
          cash_minor?: number
          created_at?: string
          currency?: string
          delta_minor?: number
          quote_id?: string
          rounding_adjustment_minor?: number
          service_value_minor?: number
          subscription_id?: string
          unused_prepaid_minor?: number
          version_after?: number
          version_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_proration_credit_ledger_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "shop_proration_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_credit_ledger_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_proration_quotes: {
        Row: {
          actor_user_id: string
          calculation: Json
          catalog_terms_id: string
          commerce: Json
          created_at: string
          credit_version: number
          expires_at: string
          funding_evidence: Json
          id: string
          parameters: Json
          private_offer_id: string | null
          request_id: string
          shop_id: string
          state: string
          subscription_before: Json
          subscription_id: string
          xpay_order_id: string | null
        }
        Insert: {
          actor_user_id: string
          calculation: Json
          catalog_terms_id: string
          commerce: Json
          created_at?: string
          credit_version: number
          expires_at: string
          funding_evidence: Json
          id?: string
          parameters: Json
          private_offer_id?: string | null
          request_id: string
          shop_id: string
          state?: string
          subscription_before: Json
          subscription_id: string
          xpay_order_id?: string | null
        }
        Update: {
          actor_user_id?: string
          calculation?: Json
          catalog_terms_id?: string
          commerce?: Json
          created_at?: string
          credit_version?: number
          expires_at?: string
          funding_evidence?: Json
          id?: string
          parameters?: Json
          private_offer_id?: string | null
          request_id?: string
          shop_id?: string
          state?: string
          subscription_before?: Json
          subscription_id?: string
          xpay_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_proration_quotes_catalog_terms_id_fkey"
            columns: ["catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_quotes_private_offer_id_fkey"
            columns: ["private_offer_id"]
            isOneToOne: false
            referencedRelation: "shop_private_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_quotes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_quotes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_quotes_xpay_order_id_fkey"
            columns: ["xpay_order_id"]
            isOneToOne: true
            referencedRelation: "shop_xpay_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_proration_settlements: {
        Row: {
          cash_minor: number
          cycle_start: string
          period_end: string
          period_start: string
          prepaid_value_minor: number
          quote_id: string
          settled_at: string
          subscription_before: Json
          subscription_id: string
          xpay_order_id: string | null
        }
        Insert: {
          cash_minor: number
          cycle_start: string
          period_end: string
          period_start: string
          prepaid_value_minor: number
          quote_id: string
          settled_at?: string
          subscription_before: Json
          subscription_id: string
          xpay_order_id?: string | null
        }
        Update: {
          cash_minor?: number
          cycle_start?: string
          period_end?: string
          period_start?: string
          prepaid_value_minor?: number
          quote_id?: string
          settled_at?: string
          subscription_before?: Json
          subscription_id?: string
          xpay_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_proration_settlements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "shop_proration_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_settlements_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_proration_settlements_xpay_order_id_fkey"
            columns: ["xpay_order_id"]
            isOneToOne: true
            referencedRelation: "shop_xpay_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_realtime_versions: {
        Row: {
          feature: string
          location_id: string | null
          revision: number
          scope_key: string
          shop_id: string
        }
        Insert: {
          feature: string
          location_id?: string | null
          revision?: number
          scope_key: string
          shop_id: string
        }
        Update: {
          feature?: string
          location_id?: string | null
          revision?: number
          scope_key?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_realtime_versions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_realtime_versions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_receipt_settings: {
        Row: {
          address: string | null
          created_at: string
          display_name: string | null
          document_direction: string
          document_label: string | null
          document_language: string
          footer: string | null
          logo_data_url: string | null
          notes: string | null
          paper_size: string
          phone: string | null
          reference_label: string | null
          shop_id: string
          show_descriptions: boolean
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          display_name?: string | null
          document_direction?: string
          document_label?: string | null
          document_language?: string
          footer?: string | null
          logo_data_url?: string | null
          notes?: string | null
          paper_size?: string
          phone?: string | null
          reference_label?: string | null
          shop_id: string
          show_descriptions?: boolean
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          display_name?: string | null
          document_direction?: string
          document_label?: string | null
          document_language?: string
          footer?: string | null
          logo_data_url?: string | null
          notes?: string | null
          paper_size?: string
          phone?: string | null
          reference_label?: string | null
          shop_id?: string
          show_descriptions?: boolean
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_receipt_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_receipt_settings_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_scheduled_plan_changes: {
        Row: {
          actor_user_id: string
          cancelled_at: string | null
          catalog_terms_id: string | null
          completed_at: string | null
          completed_quote_id: string | null
          created_at: string
          effective_at: string
          id: string
          private_offer_id: string | null
          private_offer_parameters: Json | null
          request_id: string
          shop_id: string
          state: string
          subscription_before: Json
          subscription_id: string
          target: Json
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          cancelled_at?: string | null
          catalog_terms_id?: string | null
          completed_at?: string | null
          completed_quote_id?: string | null
          created_at?: string
          effective_at: string
          id?: string
          private_offer_id?: string | null
          private_offer_parameters?: Json | null
          request_id: string
          shop_id: string
          state?: string
          subscription_before: Json
          subscription_id: string
          target: Json
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          cancelled_at?: string | null
          catalog_terms_id?: string | null
          completed_at?: string | null
          completed_quote_id?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          private_offer_id?: string | null
          private_offer_parameters?: Json | null
          request_id?: string
          shop_id?: string
          state?: string
          subscription_before?: Json
          subscription_id?: string
          target?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_scheduled_plan_changes_catalog_terms_id_fkey"
            columns: ["catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_scheduled_plan_changes_completed_quote_id_fkey"
            columns: ["completed_quote_id"]
            isOneToOne: false
            referencedRelation: "shop_proration_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_scheduled_plan_changes_private_offer_id_fkey"
            columns: ["private_offer_id"]
            isOneToOne: false
            referencedRelation: "shop_private_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_scheduled_plan_changes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_scheduled_plan_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_super_admin_integrations: {
        Row: {
          allowed_operations: string[]
          audience: string
          created_at: string
          enabled: boolean
          id: string
          key_id: string
          max_clock_skew_seconds: number
          nonce_retention_seconds: number
          protocol_version: string
          retired_at: string | null
          source_binding_id: string
          target_binding_id: string
          target_environment_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          allowed_operations: string[]
          audience: string
          created_at?: string
          enabled?: boolean
          id?: string
          key_id: string
          max_clock_skew_seconds: number
          nonce_retention_seconds: number
          protocol_version?: string
          retired_at?: string | null
          source_binding_id: string
          target_binding_id: string
          target_environment_id: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          allowed_operations?: string[]
          audience?: string
          created_at?: string
          enabled?: boolean
          id?: string
          key_id?: string
          max_clock_skew_seconds?: number
          nonce_retention_seconds?: number
          protocol_version?: string
          retired_at?: string | null
          source_binding_id?: string
          target_binding_id?: string
          target_environment_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      shop_super_admin_nonce_receipts: {
        Row: {
          body_digest: string
          expires_at: string
          id: string
          integration_principal_id: string
          key_id: string
          nonce: string
          received_at: string
          request_id: string
          request_timestamp: number
        }
        Insert: {
          body_digest: string
          expires_at: string
          id?: string
          integration_principal_id: string
          key_id: string
          nonce: string
          received_at?: string
          request_id: string
          request_timestamp: number
        }
        Update: {
          body_digest?: string
          expires_at?: string
          id?: string
          integration_principal_id?: string
          key_id?: string
          nonce?: string
          received_at?: string
          request_id?: string
          request_timestamp?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_super_admin_nonce_receipts_integration_principal_id_fkey"
            columns: ["integration_principal_id"]
            isOneToOne: false
            referencedRelation: "shop_super_admin_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_super_admin_requests: {
        Row: {
          body_digest: string
          correlation_id: string
          external_authority_binding_id: string
          external_role_snapshot: string
          external_session_id: string | null
          external_subject_id: string
          id: string
          integration_principal_id: string
          is_command: boolean
          occurred_at: string
          operation: string
          operation_version: string
          reason: string | null
          request_id: string
          result: Json | null
          result_digest: string
          result_version: number
          target_resource_id: string | null
          underlying_audit_id: string | null
        }
        Insert: {
          body_digest: string
          correlation_id: string
          external_authority_binding_id: string
          external_role_snapshot: string
          external_session_id?: string | null
          external_subject_id: string
          id?: string
          integration_principal_id: string
          is_command: boolean
          occurred_at?: string
          operation: string
          operation_version: string
          reason?: string | null
          request_id: string
          result?: Json | null
          result_digest: string
          result_version?: number
          target_resource_id?: string | null
          underlying_audit_id?: string | null
        }
        Update: {
          body_digest?: string
          correlation_id?: string
          external_authority_binding_id?: string
          external_role_snapshot?: string
          external_session_id?: string | null
          external_subject_id?: string
          id?: string
          integration_principal_id?: string
          is_command?: boolean
          occurred_at?: string
          operation?: string
          operation_version?: string
          reason?: string | null
          request_id?: string
          result?: Json | null
          result_digest?: string
          result_version?: number
          target_resource_id?: string | null
          underlying_audit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_super_admin_requests_integration_principal_id_fkey"
            columns: ["integration_principal_id"]
            isOneToOne: false
            referencedRelation: "shop_super_admin_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_team_events: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json
          before_state: Json | null
          id: string
          occurred_at: string
          reason: string | null
          request_id: string
          shop_id: string
          target_invitation_id: string | null
          target_membership_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          reason?: string | null
          request_id: string
          shop_id: string
          target_invitation_id?: string | null
          target_membership_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json
          before_state?: Json | null
          id?: string
          occurred_at?: string
          reason?: string | null
          request_id?: string
          shop_id?: string
          target_invitation_id?: string | null
          target_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_team_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_team_events_target_invitation_id_fkey"
            columns: ["target_invitation_id"]
            isOneToOne: false
            referencedRelation: "shop_team_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_team_events_target_membership_id_fkey"
            columns: ["target_membership_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_team_invitation_locations: {
        Row: {
          invitation_id: string
          location_id: string
          shop_id: string
        }
        Insert: {
          invitation_id: string
          location_id: string
          shop_id: string
        }
        Update: {
          invitation_id?: string
          location_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_team_invitation_locations_invitation_id_shop_id_fkey"
            columns: ["invitation_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_team_invitations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "shop_team_invitation_locations_location_id_shop_id_fkey"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      shop_team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_membership_id: string | null
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invitation_code: string
          invited_by_user_id: string
          job_title: string | null
          request_id: string
          revoked_at: string | null
          role_id: string
          shop_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_membership_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          expires_at?: string
          id?: string
          invitation_code?: string
          invited_by_user_id: string
          job_title?: string | null
          request_id: string
          revoked_at?: string | null
          role_id: string
          shop_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_membership_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_code?: string
          invited_by_user_id?: string
          job_title?: string | null
          request_id?: string
          revoked_at?: string | null
          role_id?: string
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_team_invitations_accepted_membership_id_fkey"
            columns: ["accepted_membership_id"]
            isOneToOne: false
            referencedRelation: "shop_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_team_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_team_invitations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_xpay_inbox: {
        Row: {
          event_id: string
          event_type: string
          merchant_id: string
          mode: string
          payload_digest: string
          processed_at: string | null
          received_at: string
          session_id: string
          state: string
        }
        Insert: {
          event_id: string
          event_type: string
          merchant_id: string
          mode: string
          payload_digest: string
          processed_at?: string | null
          received_at?: string
          session_id: string
          state?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          merchant_id?: string
          mode?: string
          payload_digest?: string
          processed_at?: string | null
          received_at?: string
          session_id?: string
          state?: string
        }
        Relationships: []
      }
      shop_xpay_orders: {
        Row: {
          actor_user_id: string
          amount_minor: number
          catalog_terms_id: string
          checkout_url: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          merchant_id: string
          mode: string
          private_offer_id: string | null
          quote: Json
          request_id: string
          session_id: string | null
          session_request: Json | null
          shop_id: string
          state: string
          subscription_before: Json
          subscription_id: string
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          amount_minor: number
          catalog_terms_id: string
          checkout_url?: string | null
          created_at?: string
          currency: string
          expires_at?: string | null
          id?: string
          merchant_id: string
          mode: string
          private_offer_id?: string | null
          quote: Json
          request_id: string
          session_id?: string | null
          session_request?: Json | null
          shop_id: string
          state?: string
          subscription_before: Json
          subscription_id: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          amount_minor?: number
          catalog_terms_id?: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          merchant_id?: string
          mode?: string
          private_offer_id?: string | null
          quote?: Json
          request_id?: string
          session_id?: string | null
          session_request?: Json | null
          shop_id?: string
          state?: string
          subscription_before?: Json
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_xpay_orders_catalog_terms_id_fkey"
            columns: ["catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_xpay_orders_private_offer_id_fkey"
            columns: ["private_offer_id"]
            isOneToOne: false
            referencedRelation: "shop_private_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_xpay_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_xpay_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_xpay_paid_observations: {
        Row: {
          amount_minor: number
          currency: string
          merchant_id: string
          mode: string
          order_id: string
          payment_intent_id: string
          session_id: string
          verified_at: string
        }
        Insert: {
          amount_minor: number
          currency: string
          merchant_id: string
          mode: string
          order_id: string
          payment_intent_id: string
          session_id: string
          verified_at?: string
        }
        Update: {
          amount_minor?: number
          currency?: string
          merchant_id?: string
          mode?: string
          order_id?: string
          payment_intent_id?: string
          session_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_xpay_paid_observations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "shop_xpay_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_xpay_payments: {
        Row: {
          amount_minor: number
          currency: string
          id: string
          merchant_id: string
          mode: string
          order_id: string
          payment_intent_id: string
          period_end: string
          period_start: string
          session_id: string
          snapshot: Json
          verified_at: string
        }
        Insert: {
          amount_minor: number
          currency: string
          id?: string
          merchant_id: string
          mode: string
          order_id: string
          payment_intent_id: string
          period_end: string
          period_start: string
          session_id: string
          snapshot: Json
          verified_at?: string
        }
        Update: {
          amount_minor?: number
          currency?: string
          id?: string
          merchant_id?: string
          mode?: string
          order_id?: string
          payment_intent_id?: string
          period_end?: string
          period_start?: string
          session_id?: string
          snapshot?: Json
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_xpay_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "shop_xpay_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          business_currency: string
          business_mode: Database["public"]["Enums"]["business_mode"]
          created_at: string
          currency_lock_record_id: string | null
          currency_lock_source: string | null
          currency_locked_at: string | null
          id: string
          name: string
          portal_id: string
          require_open_cash_shift: boolean
          status: Database["public"]["Enums"]["shop_status"]
          updated_at: string
        }
        Insert: {
          business_currency?: string
          business_mode?: Database["public"]["Enums"]["business_mode"]
          created_at?: string
          currency_lock_record_id?: string | null
          currency_lock_source?: string | null
          currency_locked_at?: string | null
          id?: string
          name: string
          portal_id: string
          require_open_cash_shift?: boolean
          status?: Database["public"]["Enums"]["shop_status"]
          updated_at?: string
        }
        Update: {
          business_currency?: string
          business_mode?: Database["public"]["Enums"]["business_mode"]
          created_at?: string
          currency_lock_record_id?: string | null
          currency_lock_source?: string | null
          currency_locked_at?: string | null
          id?: string
          name?: string
          portal_id?: string
          require_open_cash_shift?: boolean
          status?: Database["public"]["Enums"]["shop_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_requests: {
        Row: {
          created_at: string
          created_by_profile_id: string
          id: string
          note: string | null
          product_id: string
          quantity_change: number
          shop_id: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          id: string
          note?: string | null
          product_id: string
          quantity_change: number
          shop_id: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity_change?: number
          shop_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_requests_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          completed_at: string
          counted_at: string
          counted_quantity: number
          created_at: string
          created_by_profile_id: string
          expected_quantity: number
          external_reference: string
          id: string
          location_id: string
          positive_variance_unit_cost: number | null
          product_id: string
          reason: string
          shop_id: string
          variance_quantity: number
        }
        Insert: {
          completed_at?: string
          counted_at: string
          counted_quantity: number
          created_at?: string
          created_by_profile_id: string
          expected_quantity: number
          external_reference: string
          id: string
          location_id: string
          positive_variance_unit_cost?: number | null
          product_id: string
          reason: string
          shop_id: string
          variance_quantity: number
        }
        Update: {
          completed_at?: string
          counted_at?: string
          counted_quantity?: number
          created_at?: string
          created_by_profile_id?: string
          expected_quantity?: number
          external_reference?: string
          id?: string
          location_id?: string
          positive_variance_unit_cost?: number | null
          product_id?: string
          reason?: string
          shop_id?: string
          variance_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "stock_counts_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "stock_counts_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "stock_counts_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "stock_counts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_commercial_periods: {
        Row: {
          approved_at: string
          billing_interval: string
          billing_submission_id: string | null
          catalog_terms_id: string
          created_at: string
          currency: string
          id: string
          list_price_amount: number
          offer_entitlements: Json
          period_end: string
          period_start: string
          plan_name: string
          plan_slug: string
          plan_variant: string | null
          price_amount: number
          price_override_id: string | null
          proration_quote_id: string | null
          resource_limits: Json
          subscription_id: string
          xpay_order_id: string | null
        }
        Insert: {
          approved_at: string
          billing_interval: string
          billing_submission_id?: string | null
          catalog_terms_id: string
          created_at?: string
          currency: string
          id?: string
          list_price_amount: number
          offer_entitlements?: Json
          period_end: string
          period_start: string
          plan_name: string
          plan_slug: string
          plan_variant?: string | null
          price_amount: number
          price_override_id?: string | null
          proration_quote_id?: string | null
          resource_limits: Json
          subscription_id: string
          xpay_order_id?: string | null
        }
        Update: {
          approved_at?: string
          billing_interval?: string
          billing_submission_id?: string | null
          catalog_terms_id?: string
          created_at?: string
          currency?: string
          id?: string
          list_price_amount?: number
          offer_entitlements?: Json
          period_end?: string
          period_start?: string
          plan_name?: string
          plan_slug?: string
          plan_variant?: string | null
          price_amount?: number
          price_override_id?: string | null
          proration_quote_id?: string | null
          resource_limits?: Json
          subscription_id?: string
          xpay_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_commercial_periods_billing_submission_id_fkey"
            columns: ["billing_submission_id"]
            isOneToOne: true
            referencedRelation: "shop_billing_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_commercial_periods_catalog_terms_id_fkey"
            columns: ["catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_commercial_periods_price_override_id_fkey"
            columns: ["price_override_id"]
            isOneToOne: false
            referencedRelation: "subscription_price_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_commercial_periods_proration_quote_id_fkey"
            columns: ["proration_quote_id"]
            isOneToOne: true
            referencedRelation: "shop_proration_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_commercial_periods_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_commercial_periods_xpay_order_id_fkey"
            columns: ["xpay_order_id"]
            isOneToOne: true
            referencedRelation: "shop_xpay_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_change_requests: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          effective_at: string
          from_catalog_terms_id: string
          from_plan_id: string
          id: string
          reason: string
          subscription_id: string
          to_catalog_terms_id: string
          to_plan_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          effective_at: string
          from_catalog_terms_id: string
          from_plan_id: string
          id?: string
          reason: string
          subscription_id: string
          to_catalog_terms_id: string
          to_plan_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          effective_at?: string
          from_catalog_terms_id?: string
          from_plan_id?: string
          id?: string
          reason?: string
          subscription_id?: string
          to_catalog_terms_id?: string
          to_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_change_requests_from_catalog_terms_id_fkey"
            columns: ["from_catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_change_requests_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_change_requests_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_change_requests_to_catalog_terms_id_fkey"
            columns: ["to_catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_change_requests_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_price_override_revocations: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          effective_at: string
          id: string
          price_override_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          effective_at?: string
          id?: string
          price_override_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          effective_at?: string
          id?: string
          price_override_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_price_override_revocations_price_override_id_fkey"
            columns: ["price_override_id"]
            isOneToOne: true
            referencedRelation: "subscription_price_overrides"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_price_overrides: {
        Row: {
          amount: number
          created_at: string
          created_by_user_id: string | null
          currency: string
          effective_from: string
          expires_at: string | null
          id: string
          reason: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          effective_from: string
          expires_at?: string | null
          id?: string
          reason: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          effective_from?: string
          expires_at?: string | null
          id?: string
          reason?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_price_overrides_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_metadata: Json
          catalog_terms_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          locked_at: string | null
          plan_id: string
          profile_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subsription_id: string | null
          trial_consumed: boolean
          trial_end_at: string | null
          trial_start_at: string | null
          updated_at: string
        }
        Insert: {
          billing_metadata?: Json
          catalog_terms_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          locked_at?: string | null
          plan_id: string
          profile_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subsription_id?: string | null
          trial_consumed?: boolean
          trial_end_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_metadata?: Json
          catalog_terms_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          locked_at?: string | null
          plan_id?: string
          profile_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subsription_id?: string | null
          trial_consumed?: boolean
          trial_end_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_catalog_terms_id_fkey"
            columns: ["catalog_terms_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_credits: {
        Row: {
          amount: number
          created_at: string
          created_by_profile_id: string
          effective_at: string
          id: string
          purchase_return_id: string | null
          reason: string
          reference: string | null
          shop_id: string
          vendor_id: string
          vendor_invoice_id: string
          vendor_name_snapshot: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_profile_id: string
          effective_at: string
          id?: string
          purchase_return_id?: string | null
          reason: string
          reference?: string | null
          shop_id: string
          vendor_id: string
          vendor_invoice_id: string
          vendor_name_snapshot: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_profile_id?: string
          effective_at?: string
          id?: string
          purchase_return_id?: string | null
          reason?: string
          reference?: string | null
          shop_id?: string
          vendor_id?: string
          vendor_invoice_id?: string
          vendor_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_credits_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credits_purchase_return_id_shop_id_fkey"
            columns: ["purchase_return_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_credits_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credits_vendor_id_shop_id_fkey"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_balances"
            referencedColumns: ["vendor_id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_credits_vendor_id_shop_id_fkey"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_credits_vendor_invoice_id_shop_id_fkey"
            columns: ["vendor_invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_balances"
            referencedColumns: ["vendor_invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_credits_vendor_invoice_id_shop_id_fkey"
            columns: ["vendor_invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      supplier_operation_requests: {
        Row: {
          actor_profile_id: string
          completed_at: string | null
          created_at: string
          operation: string
          payload_hash: string
          request_id: string
          result_id: string | null
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          completed_at?: string | null
          created_at?: string
          operation: string
          payload_hash: string
          request_id: string
          result_id?: string | null
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          completed_at?: string | null
          created_at?: string
          operation?: string
          payload_hash?: string
          request_id?: string
          result_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_operation_requests_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_operation_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          location_id: string
          payment_id: string
          shop_id: string
          vendor_invoice_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          location_id: string
          payment_id: string
          shop_id: string
          vendor_invoice_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          location_id?: string
          payment_id?: string
          shop_id?: string
          vendor_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_invoice_location_fk"
            columns: ["vendor_invoice_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_id_shop_id_fkey"
            columns: ["payment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_location_fk"
            columns: ["payment_id", "shop_id", "location_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id", "location_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_vendor_invoice_id_shop_id_fkey"
            columns: ["vendor_invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_balances"
            referencedColumns: ["vendor_invoice_id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_vendor_invoice_id_shop_id_fkey"
            columns: ["vendor_invoice_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      supplier_payment_reversals: {
        Row: {
          amount: number
          created_at: string
          created_by_profile_id: string
          effective_at: string
          id: string
          original_allocation_id: string
          original_payment_id: string
          reason: string
          reference: string | null
          reversal_group_id: string
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_profile_id: string
          effective_at: string
          id?: string
          original_allocation_id: string
          original_payment_id: string
          reason: string
          reference?: string | null
          reversal_group_id: string
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_profile_id?: string
          effective_at?: string
          id?: string
          original_allocation_id?: string
          original_payment_id?: string
          reason?: string
          reference?: string | null
          reversal_group_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_reversals_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_reversals_original_allocation_id_shop_id__fkey"
            columns: [
              "original_allocation_id",
              "shop_id",
              "original_payment_id",
            ]
            isOneToOne: false
            referencedRelation: "supplier_payment_allocations"
            referencedColumns: ["id", "shop_id", "payment_id"]
          },
          {
            foreignKeyName: "supplier_payment_reversals_original_payment_id_shop_id_fkey"
            columns: ["original_payment_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "supplier_payment_reversals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      support_notification_outbox: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          delivery_status: string
          email_payload: Json | null
          failed_at: string | null
          first_attempt_at: string | null
          id: string
          kind: string
          last_attempt_at: string | null
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          provider_email_id: string | null
          recipient: string
          request_id: string
          sent_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          email_payload?: Json | null
          failed_at?: string | null
          first_attempt_at?: string | null
          id?: string
          kind: string
          last_attempt_at?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          provider_email_id?: string | null
          recipient: string
          request_id: string
          sent_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          email_payload?: Json | null
          failed_at?: string | null
          first_attempt_at?: string | null
          id?: string
          kind?: string
          last_attempt_at?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          provider_email_id?: string | null
          recipient?: string
          request_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_notification_outbox_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          category: string
          created_at: string
          customer_message: string
          id: string
          priority: string
          requester_email: string
          requester_profile_id: string | null
          shop_id: string | null
          status: string
          subject: string
        }
        Insert: {
          category: string
          created_at?: string
          customer_message: string
          id?: string
          priority?: string
          requester_email: string
          requester_profile_id?: string | null
          shop_id?: string | null
          status?: string
          subject: string
        }
        Update: {
          category?: string
          created_at?: string
          customer_message?: string
          id?: string
          priority?: string
          requester_email?: string
          requester_profile_id?: string | null
          shop_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_policy_versions: {
        Row: {
          actor_profile_id: string
          created_at: string
          effective_at: string
          id: string
          policy: Json
          reason: string
          request_id: string
          shop_id: string
        }
        Insert: {
          actor_profile_id: string
          created_at?: string
          effective_at: string
          id?: string
          policy: Json
          reason: string
          request_id: string
          shop_id: string
        }
        Update: {
          actor_profile_id?: string
          created_at?: string
          effective_at?: string
          id?: string
          policy?: Json
          reason?: string
          request_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_policy_versions_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_policy_versions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoice_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          total_cost: number
          unit_cost: number
          vendor_invoice_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          total_cost: number
          unit_cost: number
          vendor_invoice_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
          vendor_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_items_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_balances"
            referencedColumns: ["vendor_invoice_id"]
          },
          {
            foreignKeyName: "vendor_invoice_items_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoice_paid_amounts"
            referencedColumns: ["vendor_invoice_id"]
          },
          {
            foreignKeyName: "vendor_invoice_items_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoices: {
        Row: {
          created_at: string
          created_by_profile_id: string
          currency: string
          id: string
          invoice_number: string | null
          issued_at: string | null
          location_id: string
          notes: string | null
          request_id: string | null
          request_payload: Json | null
          shop_id: string
          status: Database["public"]["Enums"]["vendor_invoice_status"]
          total_amount: number
          updated_at: string
          vendor_id: string | null
          vendor_name_snapshot: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          currency?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          location_id: string
          notes?: string | null
          request_id?: string | null
          request_payload?: Json | null
          shop_id: string
          status?: Database["public"]["Enums"]["vendor_invoice_status"]
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_name_snapshot: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          location_id?: string
          notes?: string | null
          request_id?: string | null
          request_payload?: Json | null
          shop_id?: string
          status?: Database["public"]["Enums"]["vendor_invoice_status"]
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_location_shop_fk"
            columns: ["location_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "shop_locations"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "vendor_invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_balances"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_shop_fk"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendor_balances"
            referencedColumns: ["vendor_id", "shop_id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_shop_fk"
            columns: ["vendor_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          archived_at: string | null
          archived_by_profile_id: string | null
          contact_name: string | null
          created_at: string
          created_by_profile_id: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          archived_by_profile_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by_profile_id: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          archived_by_profile_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by_profile_id?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_archived_by_profile_id_fkey"
            columns: ["archived_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cash_flow_daily: {
        Row: {
          day: string | null
          net_cash_flow: number | null
          shop_id: string | null
        }
        Relationships: []
      }
      cash_flow_monthly: {
        Row: {
          month: string | null
          net_cash_flow: number | null
          shop_id: string | null
        }
        Relationships: []
      }
      client_balances: {
        Row: {
          balance: number | null
          client_id: string | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cogs_movements: {
        Row: {
          batch_id: string | null
          cogs_amount: number | null
          created_at: string | null
          invoice_id: string | null
          product_id: string | null
          quantity_sold: number | null
          shop_id: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_shop_product_fk"
            columns: ["batch_id", "shop_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id", "shop_id", "product_id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_shop_product_fk"
            columns: ["batch_id", "shop_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_batches"
            referencedColumns: ["batch_id", "shop_id", "product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cogs_margin: {
        Row: {
          cogs: number | null
          day: string | null
          gross_profit: number | null
          revenue: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_stock: {
        Row: {
          days_since_last_sale: string | null
          last_sold_at: string | null
          oldest_batch_date: string | null
          product_id: string | null
          quantity_on_hand: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_aging: {
        Row: {
          product_id: string | null
          qty_0_30: number | null
          qty_31_60: number | null
          qty_61_90: number | null
          qty_90_plus: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_aging_value: {
        Row: {
          product_id: string | null
          shop_id: string | null
          value_0_30: number | null
          value_31_60: number | null
          value_61_90: number | null
          value_90_plus: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_batches: {
        Row: {
          age_interval: string | null
          batch_id: string | null
          product_id: string | null
          received_at: string | null
          remaining_quantity: number | null
          shop_id: string | null
          unit_cost: number | null
        }
        Insert: {
          age_interval?: never
          batch_id?: string | null
          product_id?: string | null
          received_at?: string | null
          remaining_quantity?: number | null
          shop_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          age_interval?: never
          batch_id?: string | null
          product_id?: string | null
          received_at?: string | null
          remaining_quantity?: number | null
          shop_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_turnover: {
        Row: {
          avg_inventory: number | null
          product_id: string | null
          quantity_sold_90d: number | null
          shop_id: string | null
          turnover_ratio: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_balances: {
        Row: {
          balance_due: number | null
          invoice_id: string | null
          paid_amount: number | null
          shop_id: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_cogs: {
        Row: {
          invoice_id: string | null
          total_cogs: number | null
        }
        Relationships: []
      }
      invoice_gross_margin: {
        Row: {
          cogs: number | null
          gross_profit: number | null
          invoice_id: string | null
          revenue: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_paid_amounts: {
        Row: {
          invoice_id: string | null
          paid_amount: number | null
        }
        Relationships: []
      }
      invoice_product_cogs: {
        Row: {
          invoice_id: string | null
          product_cogs: number | null
          product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_product_revenue: {
        Row: {
          invoice_id: string | null
          product_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_gross_margin"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_paid_amounts"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_products: {
        Row: {
          inventory_value: number | null
          name: string | null
          product_id: string | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          sale_price: number | null
          shop_id: string | null
          sku: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cogs_margin: {
        Row: {
          cogs: number | null
          gross_profit: number | null
          month: string | null
          revendue: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      net_profit: {
        Row: {
          day: string | null
          net_profit: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_average_inventory: {
        Row: {
          avg_quantity_on_hand: number | null
          product_id: string | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_last_sale: {
        Row: {
          last_sold_at: string | null
          product_id: string | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_profitability: {
        Row: {
          cogs: number | null
          gross_profit: number | null
          product_id: string | null
          revenue: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales_90d: {
        Row: {
          product_id: string | null
          quantity_sold_90d: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "low_stock_products"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_shop_fk"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "inventory_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          inventory_value: number | null
          is_active: boolean | null
          name: string | null
          product_id: string | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          sale_price: number | null
          shop_id: string | null
          sku: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_balances: {
        Row: {
          balance: number | null
          shop_id: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoice_balances: {
        Row: {
          balance_due: number | null
          paid_amount: number | null
          shop_id: string | null
          total_amount: number | null
          vendor_invoice_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoice_paid_amounts: {
        Row: {
          paid_amount: number | null
          vendor_invoice_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_shop_invitation: {
        Args: { p_invitation_code: string; p_request_id: string }
        Returns: string
      }
      adjust_stock: {
        Args: {
          p_note: string
          p_product_id: string
          p_quantity_change: number
          p_request_id: string
          p_shop_id: string
          p_unit_cost: number
        }
        Returns: string
      }
      appointment_calendar: {
        Args: {
          p_from: string
          p_location_id: string
          p_membership_id?: string
          p_shop_id: string
          p_to: string
        }
        Returns: Json
      }
      appointment_options: { Args: { p_shop_id: string }; Returns: Json }
      archive_customer: {
        Args: { p_customer_id: string; p_shop_id: string }
        Returns: undefined
      }
      archive_product: {
        Args: { p_product_id: string; p_shop_id: string }
        Returns: undefined
      }
      archive_service: {
        Args: { p_service_id: string; p_shop_id: string }
        Returns: undefined
      }
      archive_shop_location: {
        Args: { p_location_id: string; p_shop_id: string }
        Returns: undefined
      }
      archive_vendor: {
        Args: { p_shop_id: string; p_vendor_id: string }
        Returns: undefined
      }
      assert_period_is_open: {
        Args: { _date: string; _shop_id: string }
        Returns: undefined
      }
      assign_membership_locations: {
        Args: {
          p_location_ids: string[]
          p_membership_id: string
          p_shop_id: string
        }
        Returns: undefined
      }
      assign_sale_commission: {
        Args: {
          p_appointment_id?: string
          p_line_id: string
          p_membership_id: string
          p_shop_id: string
        }
        Returns: undefined
      }
      barcode_label_data: {
        Args: {
          p_category_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      business_currency_settings: { Args: { p_shop_id: string }; Returns: Json }
      cash_shift_dashboard: {
        Args: {
          p_cashier_membership_id?: string
          p_location_id: string
          p_page?: number
          p_page_size?: number
          p_shop_id: string
        }
        Returns: Json
      }
      catalog_import: {
        Args: {
          p_dry_run?: boolean
          p_kind: string
          p_request_id: string
          p_rows: Json
          p_shop_id: string
        }
        Returns: Json
      }
      catalog_sales_report: {
        Args: {
          p_category_id?: string
          p_from?: string
          p_shop_id: string
          p_to?: string
        }
        Returns: Json
      }
      checkout_customerless_sale: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      checkout_location_sale: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_location_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      checkout_pos_sale: {
        Args: {
          p_amount: number
          p_appointment_request_id: string
          p_invoice_id: string
          p_issue_request_id: string
          p_location_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at: string
          p_payment_request_id: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      claim_support_notification: { Args: never; Returns: Json }
      close_cash_shift: {
        Args: {
          p_counted_amount: number
          p_notes?: string
          p_request_id: string
          p_session_id: string
          p_shop_id: string
        }
        Returns: string
      }
      commission_assignment_context: {
        Args: { p_invoice_id: string; p_shop_id: string }
        Returns: Json
      }
      commission_history: {
        Args: { p_invoice_id?: string; p_offset?: number; p_shop_id: string }
        Returns: Json
      }
      complete_service: {
        Args: {
          p_appointment_id?: string
          p_line_id: string
          p_location_id: string
          p_materials?: Json
          p_quantity: number
          p_reason?: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      correct_location_sale: {
        Args: {
          p_effective_at: string
          p_invoice_id: string
          p_location_id: string
          p_reason: string
          p_reference?: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      correct_service_material: {
        Args: {
          p_consumption_id: string
          p_quantity: number
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      create_owner_shop:
        | {
            Args: {
              p_business_mode: Database["public"]["Enums"]["business_mode"]
              p_shop_name: string
            }
            Returns: string
          }
        | {
            Args: {
              p_business_mode: Database["public"]["Enums"]["business_mode"]
              p_main_location_address: string
              p_main_location_code: string
              p_main_location_name: string
              p_main_location_phone: string
              p_shop_name: string
            }
            Returns: string
          }
        | {
            Args: { p_plan_slug: string; p_shop_name: string }
            Returns: string
          }
        | {
            Args: {
              p_business_mode: Database["public"]["Enums"]["business_mode"]
              p_plan_slug: string
              p_shop_name: string
            }
            Returns: string
          }
      create_sale_return: {
        Args: {
          p_expected_plan: Json
          p_invoice_id: string
          p_lines: Json
          p_location_id: string
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      create_supplier_purchase: {
        Args: {
          p_invoice_number: string
          p_issued_on: string
          p_items: Json
          p_notes: string
          p_request_id: string
          p_shop_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      create_vendor: {
        Args: {
          p_address: string
          p_contact_name: string
          p_email: string
          p_name: string
          p_notes: string
          p_phone: string
          p_shop_id: string
          p_tax_number: string
        }
        Returns: string
      }
      customer_access: {
        Args: { p_shop_id: string }
        Returns: {
          can_manage: boolean
          can_view: boolean
        }[]
      }
      customer_statement: {
        Args: {
          p_customer_id: string
          p_page?: number
          p_page_size?: number
          p_shop_id: string
        }
        Returns: Json
      }
      deduct_inventory_fifo: {
        Args: {
          _actor_profile_id: string
          _product_id: string
          _quantity: number
          _reference_id: string
          _shop_id: string
        }
        Returns: undefined
      }
      define_service_material_unit: {
        Args: { p_product_id: string; p_shop_id: string; p_unit: string }
        Returns: undefined
      }
      eta_original_document_reference: {
        Args: { p_invoice_id: string; p_shop_id: string }
        Returns: Json
      }
      eta_settings: {
        Args: { p_offset?: number; p_shop_id: string }
        Returns: Json
      }
      fast_pay_location_sale: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_due_date: string
          p_invoice_id: string
          p_lines: Json
          p_location_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_paid_at: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      finish_support_notification: {
        Args: {
          p_error?: string
          p_id: string
          p_lease_token: string
          p_provider_email_id?: string
          p_status: string
        }
        Returns: boolean
      }
      get_customer: {
        Args: { p_customer_id: string; p_shop_id: string }
        Returns: {
          address: string
          archived_at: string
          can_manage: boolean
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          notes: string
          phone: string
          updated_at: string
        }[]
      }
      get_location_sale: {
        Args: { p_invoice_id: string; p_location_id: string; p_shop_id: string }
        Returns: Json
      }
      get_location_sale_receipt: {
        Args: { p_invoice_id: string; p_location_id: string; p_shop_id: string }
        Returns: Json
      }
      get_purchase: {
        Args: { p_purchase_id: string; p_shop_id: string }
        Returns: Json
      }
      get_sale: {
        Args: { p_invoice_id: string; p_shop_id: string }
        Returns: Json
      }
      get_sale_return: {
        Args: { p_location_id: string; p_return_id: string; p_shop_id: string }
        Returns: Json
      }
      get_sale_tax_snapshot: {
        Args: { p_invoice_id: string; p_shop_id: string }
        Returns: Json
      }
      inventory_access: {
        Args: { p_shop_id: string }
        Returns: {
          can_manage: boolean
          can_view: boolean
          inventory_enabled: boolean
        }[]
      }
      invite_shop_member: {
        Args: {
          p_display_name: string
          p_email: string
          p_location_ids: string[]
          p_request_id: string
          p_role_key: string
          p_shop_id: string
        }
        Returns: Json
      }
      invite_shop_staff: {
        Args: {
          p_display_name: string
          p_email: string
          p_job_title: string
          p_location_ids: string[]
          p_request_id: string
          p_role_key: string
          p_shop_id: string
        }
        Returns: Json
      }
      issue_invoice_and_deduct_inventory: {
        Args: { _actor_profile_id: string; _invoice_id: string }
        Returns: undefined
      }
      issue_location_sale: {
        Args: {
          p_invoice_id: string
          p_location_id: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      issue_sale: {
        Args: { p_invoice_id: string; p_request_id: string; p_shop_id: string }
        Returns: string
      }
      link_appointment_sale: {
        Args: {
          p_appointment_id: string
          p_request_id: string
          p_sale_id: string
          p_shop_id: string
        }
        Returns: string
      }
      list_catalog_categories: {
        Args: { p_shop_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      list_customers: {
        Args: {
          p_is_active?: boolean
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      list_expenses: {
        Args: {
          p_category_id?: string
          p_from?: string
          p_location_id: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
          p_status?: string
          p_to?: string
        }
        Returns: Json
      }
      list_inventory: {
        Args: { p_low_stock_only?: boolean; p_shop_id: string }
        Returns: Json
      }
      list_inventory_history: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_product_id?: string
          p_shop_id: string
        }
        Returns: Json
      }
      list_location_sales: {
        Args: {
          p_from?: string
          p_location_id: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
          p_status?: Database["public"]["Enums"]["invoice_status"]
          p_to?: string
        }
        Returns: Json
      }
      list_outstanding_invoices: {
        Args: {
          p_customer_id?: string
          p_overdue_only?: boolean
          p_page?: number
          p_page_size?: number
          p_shop_id: string
        }
        Returns: Json
      }
      list_products: {
        Args: {
          p_category_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      list_purchases: {
        Args: {
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_settlement?: string
          p_shop_id: string
          p_status?: Database["public"]["Enums"]["vendor_invoice_status"]
          p_to?: string
          p_vendor_id?: string
        }
        Returns: Json
      }
      list_sales: {
        Args: {
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
          p_status?: Database["public"]["Enums"]["invoice_status"]
          p_to?: string
        }
        Returns: Json
      }
      list_services: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      list_services_by_category: {
        Args: {
          p_category_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      list_shop_locations: {
        Args: { p_shop_id: string }
        Returns: {
          address: string
          archived_at: string
          code: string
          id: string
          is_default: boolean
          name: string
          phone: string
          shop_id: string
          status: Database["public"]["Enums"]["shop_location_status"]
        }[]
      }
      list_stock_counts: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_product_id?: string
          p_shop_id: string
        }
        Returns: Json
      }
      list_vendors: {
        Args: {
          p_is_active?: boolean
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      location_operational_report: {
        Args: {
          p_from?: string
          p_location_id?: string
          p_shop_id: string
          p_to?: string
        }
        Returns: Json
      }
      manage_shop_member: {
        Args: {
          p_action: string
          p_location_ids?: string[]
          p_membership_id: string
          p_reason?: string
          p_request_id: string
          p_role_key?: string
          p_shop_id: string
        }
        Returns: undefined
      }
      open_cash_shift: {
        Args: {
          p_location_id: string
          p_notes?: string
          p_opening_amount: number
          p_register_key: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      payment_access: {
        Args: { p_shop_id: string }
        Returns: {
          can_receive: boolean
          can_refund: boolean
          can_reverse: boolean
          can_view: boolean
        }[]
      }
      platform_admin_billing_command: {
        Args: {
          p_action: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
          p_submission_id: string
        }
        Returns: Json
      }
      platform_admin_billing_read: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_resource?: string
          p_status?: string
        }
        Returns: Json
      }
      platform_admin_command: {
        Args: {
          p_action: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      platform_admin_read: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_resource: string
          p_search?: string
          p_shop_id?: string
          p_status?: string
        }
        Returns: Json
      }
      platform_admin_session: { Args: never; Returns: Json }
      platform_plan_command: {
        Args: {
          p_action: string
          p_payload?: Json
          p_plan_id?: string
          p_reason: string
          p_request_id: string
          p_shop_id?: string
        }
        Returns: Json
      }
      platform_plan_read: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_resource?: string
          p_shop_id?: string
        }
        Returns: Json
      }
      pos_catalog_search: {
        Args: {
          p_barcode?: string
          p_item_type?: string
          p_location_id: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      pos_catalog_search_by_category: {
        Args: {
          p_barcode?: string
          p_category_id?: string
          p_item_type?: string
          p_location_id: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shop_id: string
        }
        Returns: Json
      }
      pos_checkout_context: {
        Args: {
          p_customer_search?: string
          p_location_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      post_vendor_invoice_and_create_batches: {
        Args: { _actor_profile_id: string; _vendor_invoice_id: string }
        Returns: undefined
      }
      prepare_support_notification: {
        Args: { p_id: string; p_lease_token: string; p_payload: Json }
        Returns: Json
      }
      preview_sale_return: {
        Args: {
          p_invoice_id: string
          p_lines: Json
          p_location_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      queue_eta_invoice: {
        Args: {
          p_invoice_id: string
          p_reason: string
          p_receiver: Json
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      queue_eta_receipt: {
        Args: {
          p_buyer: Json
          p_invoice_id: string
          p_payment_method: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      quote_sale_tax: {
        Args: { p_lines: Json; p_location_id: string; p_shop_id: string }
        Returns: Json
      }
      receipt_settings: { Args: { p_shop_id: string }; Returns: Json }
      reconcile_offline_cash_command: {
        Args: {
          p_args: Json
          p_kind: string
          p_reason: string
          p_resolution_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      reconcile_offline_pos_sale: {
        Args: {
          p_location_id: string
          p_original_args: Json
          p_reason: string
          p_request_id: string
          p_resolution_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      reconcile_service_completion: {
        Args: {
          p_args: Json
          p_reason: string
          p_resolution_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      record_cash_movement: {
        Args: {
          p_amount: number
          p_kind: string
          p_reason: string
          p_reference: string
          p_request_id: string
          p_session_id: string
          p_shop_id: string
        }
        Returns: string
      }
      record_commission_adjustment: {
        Args: {
          p_amount: number
          p_kind: string
          p_reason: string
          p_request_id: string
          p_shop_id: string
          p_snapshot_id: string
        }
        Returns: undefined
      }
      record_customer_receipt: {
        Args: {
          p_allocations: Json
          p_amount: number
          p_customer_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_paid_at: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      record_location_customer_receipt: {
        Args: {
          p_allocations: Json
          p_amount: number
          p_customer_id: string
          p_location_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_paid_at: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      record_purchase_return: {
        Args: {
          p_items: Json
          p_purchase_id: string
          p_reason: string
          p_reference: string
          p_request_id: string
          p_returned_at: string
          p_shop_id: string
        }
        Returns: string
      }
      record_sale_return_refund: {
        Args: {
          p_location_id: string
          p_operation: string
          p_reason: string
          p_reference: string
          p_refund_id: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      record_stock_count: {
        Args: {
          p_counted_at: string
          p_counted_quantity: number
          p_positive_variance_unit_cost: number
          p_product_id: string
          p_reason: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      record_supplier_credit: {
        Args: {
          p_amount: number
          p_effective_at: string
          p_purchase_id: string
          p_reason: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      record_supplier_payment: {
        Args: {
          p_allocations: Json
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_paid_at: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      redeem_shop_private_offer:
        | {
            Args: {
              p_offer_id: string
              p_offer_version: number
              p_paid_amount: number
              p_request_id: string
              p_shop_id: string
              p_target_binding_id: string
              p_target_environment_id: string
              p_transfer_date: string
              p_transfer_reference: string
            }
            Returns: string
          }
        | {
            Args: {
              p_offer_id: string
              p_offer_version: number
              p_paid_amount: number
              p_redemption_token: string
              p_request_id: string
              p_shop_id: string
              p_target_binding_id: string
              p_target_environment_id: string
              p_transfer_date: string
              p_transfer_reference: string
            }
            Returns: string
          }
      refund_customer_receipt: {
        Args: {
          p_allocations: Json
          p_effective_at: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_original_payment_id: string
          p_reason: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      replay_offline_cash_command: {
        Args: { p_args: Json; p_kind: string; p_shop_id: string }
        Returns: string
      }
      replay_offline_pos_sale: {
        Args: {
          p_amount: number
          p_appointment_id: string
          p_appointment_request_id: string
          p_customer_id: string
          p_issue_request_id: string
          p_lines: Json
          p_location_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_paid_at: string
          p_payment_request_id: string
          p_reference: string
          p_request_id: string
          p_save_request_id: string
          p_shift_id: string
          p_shop_id: string
          p_staff_membership_id: string
        }
        Returns: string
      }
      reserve_shop_billing_payment_evidence: {
        Args: {
          p_mime_type: string
          p_original_file_name: string
          p_sha256: string
          p_size_bytes: number
          p_submission_id: string
        }
        Returns: Json
      }
      restore_shop_location: {
        Args: { p_location_id: string; p_shop_id: string }
        Returns: undefined
      }
      return_inventory_for_invoice: {
        Args: { _actor_profile_id: string; _invoice_id: string }
        Returns: undefined
      }
      reverse_customer_receipt: {
        Args: {
          p_allocations: Json
          p_effective_at: string
          p_original_payment_id: string
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      reverse_supplier_payment: {
        Args: {
          p_allocations: Json
          p_effective_at: string
          p_original_payment_id: string
          p_reason: string
          p_reference: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      revoke_shop_invitation: {
        Args: {
          p_invitation_id: string
          p_reason?: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: undefined
      }
      sale_access: {
        Args: { p_shop_id: string }
        Returns: {
          can_issue: boolean
          can_manage: boolean
          can_view: boolean
        }[]
      }
      sale_catalog: { Args: { p_shop_id: string }; Returns: Json }
      sale_correction_state: {
        Args: { p_invoice_id: string; p_location_id: string; p_shop_id: string }
        Returns: Json
      }
      sale_return_context: {
        Args: {
          p_invoice_id: string
          p_location_id: string
          p_offset?: number
          p_shop_id: string
        }
        Returns: Json
      }
      save_appointment: {
        Args: {
          p_appointment_id: string
          p_customer_id: string
          p_identity_kind: string
          p_location_id: string
          p_membership_id: string
          p_notes: string
          p_request_id: string
          p_service_id: string
          p_shop_id: string
          p_starts_at: string
          p_walk_in_name: string
          p_walk_in_phone: string
        }
        Returns: string
      }
      save_business_currency: {
        Args: { p_currency: string; p_shop_id: string }
        Returns: Json
      }
      save_catalog_category: {
        Args: { p_category_id: string; p_name: string; p_shop_id: string }
        Returns: string
      }
      save_commission_policy: {
        Args: {
          p_policy: Json
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_customer: {
        Args: {
          p_address: string
          p_customer_id: string
          p_email: string
          p_name: string
          p_notes: string
          p_phone: string
          p_shop_id: string
        }
        Returns: string
      }
      save_document_settings: {
        Args: { p_settings: Json; p_shop_id: string }
        Returns: Json
      }
      save_eta_configuration: {
        Args: {
          p_configuration: Json
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_expense: {
        Args: {
          p_amount: number
          p_category_name: string
          p_correction_reason?: string
          p_expense_date: string
          p_expense_id: string
          p_location_id: string
          p_notes: string
          p_request_id: string
          p_shop_id: string
          p_title: string
        }
        Returns: string
      }
      save_location_sale_draft: {
        Args: {
          p_customer_id: string
          p_due_date: string
          p_invoice_id: string
          p_lines: Json
          p_location_id: string
          p_notes: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_pos_sale_draft: {
        Args: {
          p_appointment_id: string
          p_customer_id: string
          p_invoice_id: string
          p_lines: Json
          p_location_id: string
          p_notes: string
          p_request_id: string
          p_shop_id: string
          p_staff_membership_id: string
        }
        Returns: string
      }
      save_product: {
        Args: {
          p_barcode: string
          p_name: string
          p_product_id: string
          p_sale_price: number
          p_shop_id: string
          p_sku: string
        }
        Returns: string
      }
      save_product_with_category: {
        Args: {
          p_barcode: string
          p_category_id: string
          p_name: string
          p_product_id: string
          p_sale_price: number
          p_shop_id: string
          p_sku: string
        }
        Returns: string
      }
      save_receipt_settings: {
        Args: {
          p_address: string
          p_display_name: string
          p_footer: string
          p_paper_size: string
          p_phone: string
          p_shop_id: string
        }
        Returns: Json
      }
      save_sale_draft: {
        Args: {
          p_customer_id: string
          p_invoice_id: string
          p_lines: Json
          p_notes: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_sale_draft_with_due_date: {
        Args: {
          p_customer_id: string
          p_due_date: string
          p_invoice_id: string
          p_lines: Json
          p_notes: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_service:
        | {
            Args: {
              p_base_sale_price: number
              p_description: string
              p_discount_type: string
              p_discount_value: number
              p_name: string
              p_service_id: string
              p_shop_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_base_sale_price: number
              p_cleanup_minutes: number
              p_description: string
              p_discount_type: string
              p_discount_value: number
              p_duration_minutes: number
              p_location_ids: string[]
              p_name: string
              p_scheduling_enabled: boolean
              p_service_id: string
              p_shop_id: string
              p_staff_membership_ids: string[]
            }
            Returns: string
          }
      save_service_recipe: {
        Args: {
          p_effective_at: string
          p_materials: Json
          p_reason: string
          p_request_id: string
          p_service_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_service_with_category: {
        Args: {
          p_base_sale_price: number
          p_category_id: string
          p_cleanup_minutes: number
          p_description: string
          p_discount_type: string
          p_discount_value: number
          p_duration_minutes: number
          p_location_ids: string[]
          p_name: string
          p_scheduling_enabled: boolean
          p_service_id: string
          p_shop_id: string
          p_staff_membership_ids: string[]
        }
        Returns: string
      }
      save_shop_location: {
        Args: {
          p_address?: string
          p_code?: string
          p_location_id: string
          p_name: string
          p_phone?: string
          p_shop_id: string
        }
        Returns: string
      }
      save_shop_member_details: {
        Args: {
          p_full_name: string
          p_job_title: string
          p_membership_id: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: undefined
      }
      save_shop_profile: {
        Args: { p_display_name: string; p_shop_id: string }
        Returns: string
      }
      save_shop_team_member: {
        Args: {
          p_full_name: string
          p_job_title: string
          p_location_ids: string[]
          p_membership_id: string
          p_request_id: string
          p_role_key: string
          p_shop_id: string
        }
        Returns: undefined
      }
      save_shop_team_role: {
        Args: {
          p_archive?: boolean
          p_name: string
          p_name_ar: string
          p_permission_keys: string[]
          p_request_id: string
          p_role_key: string
          p_shop_id: string
        }
        Returns: string
      }
      save_staff_schedule: {
        Args: {
          p_blocks: Json
          p_location_id: string
          p_membership_id: string
          p_shop_id: string
          p_timezone: string
          p_working_hours: Json
        }
        Returns: undefined
      }
      save_tax_policy: {
        Args: {
          p_effective_at: string
          p_policy: Json
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: string
      }
      save_vendor: {
        Args: {
          p_address: string
          p_contact_name: string
          p_email: string
          p_name: string
          p_notes: string
          p_phone: string
          p_shop_id: string
          p_tax_number: string
          p_vendor_id: string
        }
        Returns: string
      }
      service_fulfillment_context: {
        Args: {
          p_invoice_id?: string
          p_location_id: string
          p_offset?: number
          p_shop_id: string
        }
        Returns: Json
      }
      service_recipe_context: {
        Args: { p_offset?: number; p_shop_id: string }
        Returns: Json
      }
      service_scheduling_options: { Args: { p_shop_id: string }; Returns: Json }
      set_catalog_item_category: {
        Args: {
          p_category_id: string
          p_item_id: string
          p_item_type: string
          p_shop_id: string
        }
        Returns: undefined
      }
      set_reorder_threshold: {
        Args: { p_product_id: string; p_shop_id: string; p_threshold: number }
        Returns: undefined
      }
      set_sale_order_discount: {
        Args: { p_discount: number; p_invoice_id: string; p_shop_id: string }
        Returns: undefined
      }
      set_shop_business_mode: {
        Args: {
          p_business_mode: Database["public"]["Enums"]["business_mode"]
          p_shop_id: string
        }
        Returns: Database["public"]["Enums"]["business_mode"]
      }
      set_shop_cash_policy: {
        Args: { p_required: boolean; p_shop_id: string }
        Returns: boolean
      }
      shop_admin_provisioned_owner_claim: { Args: never; Returns: Json }
      shop_billing_change_cancel: {
        Args: { p_change_id: string; p_shop_id: string }
        Returns: Json
      }
      shop_billing_change_preview: {
        Args: {
          p_catalog_terms_id: string
          p_private_offer?: Json
          p_shop_id: string
        }
        Returns: Json
      }
      shop_billing_change_read: { Args: { p_shop_id: string }; Returns: Json }
      shop_billing_change_schedule: {
        Args: {
          p_catalog_terms_id: string
          p_private_offer?: Json
          p_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      shop_billing_payment_evidence_read: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      shop_billing_read: { Args: { p_shop_id: string }; Returns: Json }
      shop_cash_policy: { Args: { p_shop_id: string }; Returns: boolean }
      shop_catalog_media: {
        Args: { p_action: string; p_payload: Json; p_shop_id: string }
        Returns: Json
      }
      shop_eta_claim: { Args: never; Returns: Json }
      shop_eta_invoice_acknowledge: {
        Args: {
          p_document_uuid: string
          p_id: string
          p_lease_id: string
          p_submission_uuid: string
        }
        Returns: undefined
      }
      shop_eta_invoice_claim: { Args: never; Returns: Json }
      shop_eta_invoice_link_recovery: {
        Args: {
          p_document_uuid: string
          p_id: string
          p_submission_uuid: string
        }
        Returns: undefined
      }
      shop_eta_invoice_prepare: {
        Args: {
          p_certificate_fingerprint: string
          p_id: string
          p_lease_id: string
          p_payload: string
        }
        Returns: undefined
      }
      shop_eta_invoice_recovery_context: {
        Args: { p_id: string }
        Returns: Json
      }
      shop_eta_link_recovery: {
        Args: {
          p_document_uuid: string
          p_id: string
          p_submission_uuid: string
        }
        Returns: undefined
      }
      shop_eta_prepare: {
        Args: {
          p_document_uuid: string
          p_id: string
          p_lease_id: string
          p_payload: string
          p_previous_uuid: string
        }
        Returns: undefined
      }
      shop_eta_recovery_context: { Args: { p_id: string }; Returns: Json }
      shop_eta_transition: {
        Args: {
          p_error_code?: string
          p_id: string
          p_lease_id: string
          p_retry_seconds?: number
          p_state: string
          p_submission_uuid?: string
        }
        Returns: undefined
      }
      shop_has_active_subscription: {
        Args: { _shop_id: string }
        Returns: boolean
      }
      shop_has_feature: {
        Args: { _feature_key: string; _shop_id: string }
        Returns: boolean
      }
      shop_operating_report: {
        Args: {
          p_anchor_date?: string
          p_location_id?: string
          p_period?: string
          p_shop_id: string
        }
        Returns: Json
      }
      shop_operational_report: {
        Args: {
          p_from?: string
          p_location_id?: string
          p_page?: number
          p_page_size?: number
          p_report: string
          p_shop_id: string
          p_to?: string
        }
        Returns: Json
      }
      shop_permission_access: {
        Args: { p_permission_keys: string[]; p_shop_id: string }
        Returns: Json
      }
      shop_plan_change_validation: {
        Args: { p_shop_id: string; p_target_plan_slug: string }
        Returns: Json
      }
      shop_plan_usage: { Args: { p_shop_id: string }; Returns: Json }
      shop_private_offer_read: {
        Args: {
          p_offer_id: string
          p_offer_version: number
          p_redemption_token: string
          p_shop_id: string
          p_target_binding_id: string
          p_target_environment_id: string
        }
        Returns: Json
      }
      shop_public_plan_catalog: {
        Args: never
        Returns: {
          billing_interval: string
          catalog_terms_id: string
          currency: string
          features: Json
          id: string
          is_coming_soon: boolean
          is_purchasable: boolean
          name: string
          plan_variant: string
          price_amount: number
          resource_limits: Json
          slug: string
          trial_days: number
          variant_name: string
        }[]
      }
      shop_super_admin_account_begin: {
        Args: {
          p_body_digest: string
          p_envelope: Json
          p_nonce: string
          p_principal_id: string
        }
        Returns: Json
      }
      shop_super_admin_account_step: {
        Args: {
          p_command_id: string
          p_details?: Json
          p_lease_token: string
          p_step: string
        }
        Returns: Json
      }
      shop_super_admin_bridge_accept_nonce: {
        Args: {
          p_body_digest: string
          p_key_id: string
          p_nonce: string
          p_principal_id: string
          p_request_id: string
          p_request_timestamp: number
        }
        Returns: Json
      }
      shop_super_admin_bridge_evidence_access: {
        Args: {
          p_body_digest: string
          p_envelope: Json
          p_nonce: string
          p_principal_id: string
        }
        Returns: Json
      }
      shop_super_admin_bridge_invoke: {
        Args: {
          p_body_digest: string
          p_envelope: Json
          p_nonce: string
          p_principal_id: string
        }
        Returns: Json
      }
      shop_super_admin_bridge_principal: {
        Args: {
          p_audience: string
          p_key_id: string
          p_source_binding_id: string
          p_target_binding_id: string
          p_target_environment_id: string
        }
        Returns: Json
      }
      shop_team_read: { Args: { p_shop_id: string }; Returns: Json }
      shop_xpay_apply_session: {
        Args: { p_event_id?: string; p_session: Json }
        Returns: Json
      }
      shop_xpay_bind_session: {
        Args: { p_order_id: string; p_session: Json }
        Returns: Json
      }
      shop_xpay_checkout_status: { Args: { p_shop_id: string }; Returns: Json }
      shop_xpay_inbox_receive: {
        Args: {
          p_digest: string
          p_event_id: string
          p_merchant_id: string
          p_mode: string
          p_session_id: string
          p_type: string
        }
        Returns: Json
      }
      shop_xpay_order_create: {
        Args: {
          p_catalog_terms_id: string
          p_private_offer?: Json
          p_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      shop_xpay_order_read: {
        Args: { p_order_id?: string; p_shop_id: string }
        Returns: Json
      }
      shop_xpay_prepare_session: {
        Args: { p_body: Json; p_order_id: string }
        Returns: Json
      }
      shop_xpay_proration_abandon: {
        Args: { p_quote_id: string; p_shop_id: string }
        Returns: Json
      }
      shop_xpay_proration_credit_confirm: {
        Args: { p_quote_id: string; p_shop_id: string }
        Returns: Json
      }
      shop_xpay_proration_order: {
        Args: { p_quote_id: string; p_shop_id: string }
        Returns: Json
      }
      shop_xpay_proration_quote: {
        Args: {
          p_catalog_terms_id: string
          p_private_offer?: Json
          p_request_id: string
          p_shop_id: string
        }
        Returns: Json
      }
      shop_xpay_proration_read: {
        Args: { p_quote_id: string; p_shop_id: string }
        Returns: Json
      }
      shop_xpay_proration_status: { Args: { p_shop_id: string }; Returns: Json }
      shop_xpay_reconcile_candidates: { Args: never; Returns: Json }
      shop_xpay_schedule_reconciliation: {
        Args: { p_enabled: boolean; p_project_ref: string }
        Returns: Json
      }
      shop_xpay_server_order: { Args: { p_order_id: string }; Returns: Json }
      submit_shop_billing_notice:
        | {
            Args: {
              p_paid_amount: number
              p_request_id: string
              p_shop_id: string
              p_transfer_date: string
              p_transfer_reference: string
            }
            Returns: string
          }
        | {
            Args: {
              p_paid_amount: number
              p_request_id: string
              p_requested_plan_slug: string
              p_shop_id: string
              p_transfer_date: string
              p_transfer_reference: string
            }
            Returns: string
          }
        | {
            Args: {
              p_paid_amount: number
              p_request_id: string
              p_requested_catalog_terms_id: string
              p_requested_plan_slug: string
              p_shop_id: string
              p_transfer_date: string
              p_transfer_reference: string
            }
            Returns: string
          }
      submit_support_request: {
        Args: {
          p_category: string
          p_consent: boolean
          p_honeypot?: string
          p_message: string
          p_reply_email: string
          p_subject: string
        }
        Returns: Json
      }
      supplier_access: {
        Args: { p_shop_id: string }
        Returns: {
          can_manage_purchases: boolean
          can_manage_suppliers: boolean
          can_record_credit: boolean
          can_record_payment: boolean
          can_return_stock: boolean
          can_reverse_payment: boolean
          can_view: boolean
        }[]
      }
      tax_settings: { Args: { p_shop_id: string }; Returns: Json }
      transfer_shop_ownership: {
        Args: {
          p_reason: string
          p_request_id: string
          p_shop_id: string
          p_target_membership_id: string
        }
        Returns: undefined
      }
      transition_appointment: {
        Args: {
          p_appointment_id: string
          p_reason?: string
          p_request_id: string
          p_shop_id: string
          p_status: string
        }
        Returns: string
      }
      user_has_shop_permission: {
        Args: { _permission_key: string; _shop_id: string }
        Returns: boolean
      }
      user_is_member_of_shop: { Args: { _shop_id: string }; Returns: boolean }
      void_expense: {
        Args: {
          p_expense_id: string
          p_location_id: string
          p_reason: string
          p_request_id: string
          p_shop_id: string
        }
        Returns: undefined
      }
      void_supplier_purchase: {
        Args: { p_purchase_id: string; p_shop_id: string }
        Returns: undefined
      }
    }
    Enums: {
      appointment_block_kind: "break" | "time_off"
      appointment_identity_kind: "customer" | "walk_in"
      appointment_status:
        | "booked"
        | "arrived"
        | "waiting"
        | "in_service"
        | "completed"
        | "cancelled"
        | "no_show"
      business_mode: "product" | "service" | "mixed"
      cash_session_status: "open" | "closed"
      customer_payment_kind: "receipt" | "refund"
      expense_status: "unpaid" | "paid" | "void"
      inventory_movement_type: "in" | "out" | "adjustment"
      inventory_source_type: "vendor_invoice" | "manual"
      invoice_item_type: "custom" | "service" | "product"
      invoice_status: "draft" | "issued" | "paid" | "refunded" | "void"
      payment_adjustment_kind: "reversal" | "refund"
      payment_direction: "in" | "out"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "card"
        | "wallet"
        | "cheque"
        | "other"
      payment_status: "pending" | "completed" | "failed" | "void"
      profile_status: "active" | "suspended" | "archived"
      sale_correction_kind: "void" | "full_return"
      shop_location_status: "active" | "archived"
      shop_membership_status: "active" | "invited" | "suspended"
      shop_status: "active" | "suspended" | "archived"
      supplier_payment_kind: "payment"
      vendor_invoice_status: "draft" | "posted" | "void"
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
    Enums: {
      appointment_block_kind: ["break", "time_off"],
      appointment_identity_kind: ["customer", "walk_in"],
      appointment_status: [
        "booked",
        "arrived",
        "waiting",
        "in_service",
        "completed",
        "cancelled",
        "no_show",
      ],
      business_mode: ["product", "service", "mixed"],
      cash_session_status: ["open", "closed"],
      customer_payment_kind: ["receipt", "refund"],
      expense_status: ["unpaid", "paid", "void"],
      inventory_movement_type: ["in", "out", "adjustment"],
      inventory_source_type: ["vendor_invoice", "manual"],
      invoice_item_type: ["custom", "service", "product"],
      invoice_status: ["draft", "issued", "paid", "refunded", "void"],
      payment_adjustment_kind: ["reversal", "refund"],
      payment_direction: ["in", "out"],
      payment_method: [
        "cash",
        "bank_transfer",
        "card",
        "wallet",
        "cheque",
        "other",
      ],
      payment_status: ["pending", "completed", "failed", "void"],
      profile_status: ["active", "suspended", "archived"],
      sale_correction_kind: ["void", "full_return"],
      shop_location_status: ["active", "archived"],
      shop_membership_status: ["active", "invited", "suspended"],
      shop_status: ["active", "suspended", "archived"],
      supplier_payment_kind: ["payment"],
      vendor_invoice_status: ["draft", "posted", "void"],
    },
  },
} as const
