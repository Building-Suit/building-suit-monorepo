import type { Json } from './database.types'

type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }

export type EtaRpcDatabase = { public: {
  Tables: Record<string, never>
  Views: Record<string, never>
  Enums: Record<string, never>
  CompositeTypes: Record<string, never>
  Functions: {
    configure_eta_preproduction: Rpc<{
      p_organization_id: string
      p_vat_profile_id: string
      p_issuer_name: string
      p_branch_id: string
      p_taxpayer_activity_code: string
      p_issuer_address: Json
      p_onboarding_evidence_reference: string
      p_onboarding_evidence_verified_on: string
      p_signing_certificate_reference: string
      p_effective_from: string
    }>
    prepare_eta_b2b_document: Rpc<{
      p_organization_id: string
      p_vat_document_id: string
      p_internal_id: string
      p_issued_at: string
      p_receiver: Json
      p_lines: Json
      p_idempotency_key: string
    }>
    request_eta_preproduction_submission: Rpc<{
      p_organization_id: string
      p_document_id: string
    }, Json>
    read_eta_preproduction_submission: Rpc<{
      p_organization_id: string
      p_document_id: string
    }, Json>
  }
} }
