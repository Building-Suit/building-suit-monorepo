import type { Json } from './database.types'

// Product-owned RPC contract; the generated common database snapshot stays intact.
type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }
export type InventoryRpcDatabase = { public: { Tables: Record<string, never>, Views: Record<string, never>, Enums: Record<string, never>, CompositeTypes: Record<string, never>, Functions: {
  configure_inventory_source: Rpc<{ p_organization_id: string, p_source_key: string, p_actor_id: string, p_effective_from: string, p_control_account_id: string, p_cogs_account_id: string, p_offset_account_id: string }>
  create_inventory_control_account: Rpc<{ p_organization_id: string, p_name: string }>
  ingest_inventory_fact: Rpc<{ p_organization_id: string, p_source_id: string, p_fact: Json }>
  read_inventory_workspace: Rpc<{ p_organization_id: string, p_as_of_date: string, p_offset?: number, p_limit?: number, p_fact_id?: string }, Json>
} } }
