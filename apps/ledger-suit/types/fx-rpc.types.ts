import type { Json } from './database.types'

type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }
export type FxRpcDatabase = { public: { Tables: Record<string, never>, Views: Record<string, never>, Enums: Record<string, never>, CompositeTypes: Record<string, never>, Functions: {
  configure_fx_accounts: Rpc<{ p_organization_id: string, p_realized_gain: string, p_realized_loss: string, p_unrealized_gain: string, p_unrealized_loss: string }>
  post_fx_open_item: Rpc<{ p_organization_id: string, p_subledger_type: string, p_counterparty_id: string, p_control_account_id: string, p_offset_account_id: string, p_document_date: string, p_due_date: string, p_reference: string, p_currency_code: string, p_original_minor: string, p_recognition_rate: string, p_rate_date: string, p_rate_source: string, p_rate_reference: string, p_idempotency_key: string }>
  post_fx_settlement: Rpc<{ p_organization_id: string, p_subledger_type: string, p_counterparty_id: string, p_control_account_id: string, p_cash_account_id: string, p_settlement_date: string, p_reference: string, p_settlement_currency: string, p_gross_settlement_minor: string, p_settlement_rate: string, p_rate_date: string, p_rate_source: string, p_rate_reference: string, p_allocations: Json, p_idempotency_key: string }>
  reverse_fx_open_item: Rpc<{ p_organization_id: string, p_item_id: string, p_date: string, p_reason: string, p_idempotency_key: string }>
  reverse_fx_settlement: Rpc<{ p_organization_id: string, p_settlement_id: string, p_date: string, p_reason: string, p_idempotency_key: string }>
  preview_fx_revaluation: Rpc<{ p_organization_id: string, p_subledger_type: string, p_control_account_id: string, p_as_of_date: string, p_rates: Json }, FxRevaluationLine[]>
  confirm_fx_revaluation: Rpc<{ p_organization_id: string, p_subledger_type: string, p_control_account_id: string, p_as_of_date: string, p_reference: string, p_rate_source: string, p_rates: Json, p_idempotency_key: string }>
  reverse_fx_revaluation: Rpc<{ p_organization_id: string, p_batch_id: string, p_date: string, p_reason: string, p_idempotency_key: string }>
  read_fx_workspace: Rpc<{ p_organization_id: string, p_subledger_type: string, p_as_of_date: string }, Json>
} } }

export interface FxRevaluationLine { open_item_id: string, reference: string, currency_code: string, outstanding_minor: string, current_carrying_base_minor: string, closing_rate: string, closing_base_minor: string, delta_base_minor: string, rate_reference: string }
