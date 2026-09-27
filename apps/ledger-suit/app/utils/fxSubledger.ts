export type FxSubledgerType = 'customer' | 'supplier'
export interface FxCurrency { code: string, minor_unit: number, name: string }
export interface FxAccount { id: string, name: string, type: string, subtype: string, role: string, subledger: string | null, currency: string }
export interface FxItem { id: string, counterparty_id: string, counterparty_name: string, control_account_id: string, reference: string, document_date: string, due_date: string, currency_code: string, original_minor: string, outstanding_minor: string, recognition_rate: string, carrying_base_minor: string, rate_source: string, rate_reference: string }
export interface FxSettlement { id: string, date: string, reference: string, currency_code: string, gross_minor: string, rate: string, rate_source: string, rate_reference: string, carrying_base_minor: string, settlement_base_minor: string, realized_fx_base_minor: string, reverses_settlement_id: string | null }
export interface FxWorkspace {
  currencies: FxCurrency[]
  mapping: null | { realized_gain_account_id: string, realized_loss_account_id: string, unrealized_gain_account_id: string, unrealized_loss_account_id: string }
  counterparties: { id: string, name: string }[]
  accounts: FxAccount[]
  items: FxItem[]
  settlements: FxSettlement[]
  allocations: { id: string, settlement_reference: string, item_reference: string, document_currency: string, settlement_currency: string, document_amount_minor: string, settlement_amount_minor: string, allocation_rate: string, conversion_evidence: string, carrying_base_minor: string, settlement_base_minor: string, realized_fx_base_minor: string, rounding_residual_base_minor: string }[]
  revaluations: { id: string, as_of_date: string, reference: string, rate_source: string, delta_base_minor: string, transaction_id: string | null }[]
}
