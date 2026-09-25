import type { Json } from './database.types'
type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }
export type AssetRpcDatabase = { public: { Tables: Record<string, never>, Views: Record<string, never>, Enums: Record<string, never>, CompositeTypes: Record<string, never>, Functions: {
  read_fixed_asset_workspace: Rpc<{ p_organization_id: string, p_as_of_date?: string | null }, Json>
  register_fixed_asset: Rpc<{ p_organization_id: string, p_asset_code: string, p_name: string, p_acquisition_transaction_id: string, p_cost_account_id: string, p_accumulated_depreciation_account_id: string, p_depreciation_expense_account_id: string, p_impairment_expense_account_id: string, p_gain_loss_account_id: string, p_acquisition_cost_minor: string, p_acquisition_date: string, p_in_service_date: string, p_useful_life_months: number, p_residual_value_minor?: string, p_method?: 'straight_line' | 'declining_balance', p_declining_rate_basis_points?: number | null, p_description?: string | null, p_replaces_asset_id?: string | null, p_idempotency_key: string }>
  post_asset_depreciation: Rpc<{ p_organization_id: string, p_schedule_id: string, p_idempotency_key: string }>
  change_asset_depreciation_policy: Rpc<{ p_organization_id: string, p_asset_id: string, p_effective_from: string, p_residual_value_minor: string, p_useful_life_months: number, p_method: 'straight_line' | 'declining_balance', p_declining_rate_basis_points: number | null, p_reason: string, p_idempotency_key: string }>
  record_asset_impairment: Rpc<{ p_organization_id: string, p_asset_id: string, p_date: string, p_amount_minor: string, p_reason: string, p_idempotency_key: string }>
  dispose_fixed_asset: Rpc<{ p_organization_id: string, p_asset_id: string, p_disposal_date: string, p_proceeds_minor: string, p_proceeds_account_id: string | null, p_reason: string, p_idempotency_key: string }>
  reverse_fixed_asset_event: Rpc<{ p_organization_id: string, p_event_id: string, p_reversal_date: string, p_reason: string, p_idempotency_key: string }>
} } }
