import type { Json } from './database.types'
type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }
export type DimensionKind = 'cost_center' | 'project'
export type DimensionRpcDatabase = { public: { Tables: Record<string, never>, Views: Record<string, never>, Enums: Record<string, never>, CompositeTypes: Record<string, never>, Functions: {
  read_dimension_workspace: Rpc<{ p_organization_id: string }, Json>
  report_by_accounting_dimension: Rpc<{ p_organization_id: string, p_report_kind: 'general_ledger' | 'trial_balance' | 'profit_loss' | 'balance_sheet' | 'cash_flow', p_dimension_kind: DimensionKind, p_from_date: string, p_to_date: string, p_dimension_value_id?: string | null }, Json>
  save_dimension_value: Rpc<{ p_organization_id: string, p_kind: DimensionKind, p_code: string, p_name: string, p_description: string | null, p_request_id: string, p_dimension_value_id?: string | null }>
  archive_dimension_value: Rpc<{ p_organization_id: string, p_dimension_value_id: string, p_request_id: string }>
  set_account_dimension_policy: Rpc<{ p_organization_id: string, p_account_id: string, p_kind: DimensionKind, p_requirement: 'optional' | 'required' }>
} } }
