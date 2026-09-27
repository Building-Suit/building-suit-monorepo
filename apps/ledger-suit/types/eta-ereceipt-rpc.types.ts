import type { Json } from './database.types'

type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }

export type EtaEreceiptRpcDatabase = { public: {
  Tables: Record<string, never>
  Views: Record<string, never>
  Enums: Record<string, never>
  CompositeTypes: Record<string, never>
  Functions: {
    configure_eta_ereceipt_preproduction: Rpc<{
      p_organization_id: string
      p_vat_profile_id: string
      p_issuer_trade_name: string
      p_branch_code: string
      p_branch_address: Json
      p_taxpayer_activity_code: string
      p_pos_device_serial: string
      p_authoritative_source_id: string
      p_source_scope_approval_reference: string
      p_b2c_onboarding_evidence_reference: string
      p_pos_activation_evidence_reference: string
      p_signing_certificate_reference: string
      p_evidence_verified_on: string
      p_effective_from: string
    }>
    prepare_eta_ereceipt_document: Rpc<{
      p_organization_id: string
      p_vat_document_id: string
      p_receipt_number: string
      p_issued_at: string
      p_source_snapshot: Json
      p_idempotency_key: string
    }>
    request_eta_ereceipt_preproduction_submission: Rpc<{
      p_organization_id: string
      p_document_id: string
    }, Json>
    read_eta_ereceipt_preproduction_submission: Rpc<{
      p_organization_id: string
      p_document_id: string
    }, Json>
  }
} }
