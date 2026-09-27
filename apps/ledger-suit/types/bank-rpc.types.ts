import type { Json } from './database.types'
type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }
export type BankRpcDatabase = { public: { Tables: Record<string, never>, Views: Record<string, never>, Enums: Record<string, never>, CompositeTypes: Record<string, never>, Functions: {
  read_bank_reconciliation_workspace: Rpc<{ p_organization_id: string, p_reconciliation_id?: string | null }, Json>
  import_bank_statement: Rpc<{ p_organization_id: string, p_bank_account_id: string, p_file_name: string, p_file_sha256: string, p_statement_start: string, p_statement_end: string, p_opening_balance_minor: string, p_closing_balance_minor: string, p_currency_code: string, p_rows: Json }>
  correct_bank_statement_line: Rpc<{ p_organization_id: string, p_statement_line_id: string, p_transaction_date: string, p_amount_minor: string, p_description: string, p_external_reference: string | null, p_reason: string }, undefined>
  match_bank_items: Rpc<{ p_organization_id: string, p_reconciliation_id: string, p_statement_line_ids: string[], p_transaction_ids: string[], p_idempotency_key: string }>
  unmatch_bank_items: Rpc<{ p_organization_id: string, p_match_group_id: string, p_reason: string }, undefined>
  create_bank_adjustment: Rpc<{ p_organization_id: string, p_reconciliation_id: string, p_statement_line_id: string, p_offset_account_id: string, p_reason: string, p_idempotency_key: string }>
  add_bank_outstanding_item: Rpc<{ p_organization_id: string, p_reconciliation_id: string, p_transaction_id: string, p_reason: string }>
  remove_bank_outstanding_item: Rpc<{ p_organization_id: string, p_outstanding_item_id: string, p_reason: string }, undefined>
  complete_bank_reconciliation: Rpc<{ p_organization_id: string, p_reconciliation_id: string }, undefined>
  reopen_bank_reconciliation: Rpc<{ p_organization_id: string, p_reconciliation_id: string, p_reason: string }, undefined>
} } }
