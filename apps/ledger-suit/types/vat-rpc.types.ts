import type { Json } from './database.types'
type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }
export type VatDirection = 'output' | 'input'
export type VatDocumentKind = 'invoice' | 'credit' | 'reversal'
export type VatRpcDatabase = { public: { Tables: Record<string, never>, Views: Record<string, never>, Enums: Record<string, never>, CompositeTypes: Record<string, never>, Functions: {
  configure_egypt_vat: Rpc<{ p_organization_id: string, p_registration_number: string, p_effective_from: string, p_output_vat_account_id: string, p_input_vat_account_id: string }>
  post_egypt_vat_document: Rpc<{ p_organization_id: string, p_direction: VatDirection, p_kind: VatDocumentKind, p_document_date: string, p_tax_point_date: string, p_reference: string, p_taxable_base_minor: string | number, p_base_account_id: string, p_gross_account_id: string, p_idempotency_key: string, p_counterparty_id?: string | null, p_input_eligible?: boolean, p_reason?: string | null, p_adjusts_document_id?: string | null, p_rule_code?: string }>
  reverse_egypt_vat_document: Rpc<{ p_organization_id: string, p_document_id: string, p_document_date: string, p_tax_point_date: string, p_reason: string, p_idempotency_key: string }>
  read_egypt_vat_report: Rpc<{ p_organization_id: string, p_from_date: string, p_to_date: string }, Json>
  read_egypt_vat_workspace: Rpc<{ p_organization_id: string, p_from_date: string, p_to_date: string }, Json>
} } }

